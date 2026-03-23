-- Migration 013: Add missing activity_log event sources
-- ============================================================
-- Fixes QA findings (High + Medium):
--
-- BUG 1 (High): task_rejected, redemption_rejected, redemption_fulfilled, and
--   level_up events are never emitted. Hooks use raw table writes with no
--   corresponding activity_log inserts, so kids never get push notifications
--   for rejected tasks, rejected redemptions, or fulfilled redemptions, and
--   level-up celebrations never fire.
--   Fix: create reject_task(), reject_redemption(), fulfill_redemption() RPCs.
--   Fix: update approve_task() to emit a level_up event when level increases.
--
-- BUG 2 (Medium): parent-directed notifications only reach one parent.
--   send-notifications Edge Function uses .limit(1).maybeSingle() — fixed in
--   the Edge Function code, not this migration.
-- ============================================================

-- ── 1. reject_task() — parent rejects a task + logs task_rejected event ───────

CREATE OR REPLACE FUNCTION reject_task(
  p_task_id   UUID,
  p_reason    TEXT,
  p_parent_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_task tasks%ROWTYPE;
  v_kid  profiles%ROWTYPE;
BEGIN
  SELECT * INTO v_task FROM tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found';
  END IF;
  IF v_task.status != 'submitted' THEN
    RAISE EXCEPTION 'Task is not in submitted state (current: %)', v_task.status;
  END IF;

  SELECT * INTO v_kid FROM profiles WHERE id = v_task.assigned_to;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kid profile not found';
  END IF;

  UPDATE tasks SET
    status           = 'rejected',
    rejection_reason = p_reason
  WHERE id = p_task_id;

  INSERT INTO activity_log (family_id, user_id, event_type, title, body, metadata)
  VALUES (
    v_task.family_id,
    v_kid.id,
    'task_rejected',
    'Task rejected: ' || v_task.title,
    COALESCE(p_reason, 'Your task was not approved this time.'),
    jsonb_build_object(
      'task_id',    p_task_id,
      'task_title', v_task.title,
      'reason',     p_reason
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION reject_task(UUID, TEXT, UUID) TO authenticated;

-- ── 2. reject_redemption() — parent rejects + refunds + logs event ────────────

CREATE OR REPLACE FUNCTION reject_redemption(
  p_redemption_id UUID,
  p_note          TEXT,
  p_parent_id     UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_redemption redemptions%ROWTYPE;
  v_reward     rewards%ROWTYPE;
BEGIN
  SELECT * INTO v_redemption FROM redemptions WHERE id = p_redemption_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Redemption not found';
  END IF;
  IF v_redemption.status NOT IN ('pending', 'approved') THEN
    RAISE EXCEPTION 'Redemption cannot be rejected in current state: %', v_redemption.status;
  END IF;

  SELECT * INTO v_reward FROM rewards WHERE id = v_redemption.reward_id;

  -- Refund total_points only — lifetime_points stays monotonic (AD-006)
  UPDATE profiles SET
    total_points = total_points + v_redemption.total_points
  WHERE id = v_redemption.kid_id;

  UPDATE redemptions SET
    status      = 'rejected',
    parent_note = p_note
  WHERE id = p_redemption_id;

  INSERT INTO activity_log (family_id, user_id, event_type, title, body, metadata)
  VALUES (
    v_redemption.family_id,
    v_redemption.kid_id,
    'redemption_rejected',
    'Redemption rejected',
    COALESCE(p_note, 'Your reward request was not approved.'),
    jsonb_build_object(
      'redemption_id', p_redemption_id,
      'reward_title',  v_reward.title,
      'points',        v_redemption.total_points,
      'note',          p_note
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION reject_redemption(UUID, TEXT, UUID) TO authenticated;

-- ── 3. fulfill_redemption() — parent fulfills + logs event ───────────────────

CREATE OR REPLACE FUNCTION fulfill_redemption(
  p_redemption_id UUID,
  p_parent_id     UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_redemption redemptions%ROWTYPE;
  v_reward     rewards%ROWTYPE;
BEGIN
  SELECT * INTO v_redemption FROM redemptions WHERE id = p_redemption_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Redemption not found';
  END IF;
  IF v_redemption.status != 'approved' THEN
    RAISE EXCEPTION 'Redemption is not in approved state (current: %)', v_redemption.status;
  END IF;

  SELECT * INTO v_reward FROM rewards WHERE id = v_redemption.reward_id;

  UPDATE redemptions SET
    status       = 'fulfilled',
    fulfilled_at = now()
  WHERE id = p_redemption_id;

  INSERT INTO activity_log (family_id, user_id, event_type, title, body, metadata)
  VALUES (
    v_redemption.family_id,
    v_redemption.kid_id,
    'redemption_fulfilled',
    'Reward ready: ' || v_reward.title,
    'Your reward has been fulfilled!',
    jsonb_build_object(
      'redemption_id', p_redemption_id,
      'reward_title',  v_reward.title
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION fulfill_redemption(UUID, UUID) TO authenticated;

-- ── 4. approve_task() — add level_up event when level increases ───────────────
-- Full replacement of the function from migration 012, adding the level_up
-- INSERT between the task_completed log and the streak update.

CREATE OR REPLACE FUNCTION approve_task(
  p_task_id    UUID,
  p_parent_id  UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_task          tasks%ROWTYPE;
  v_kid           profiles%ROWTYPE;
  v_new_lifetime  INT;
  v_new_level     INT;
  v_achievement   achievements%ROWTYPE;
  v_stat_value    INT;
  v_condition_met BOOLEAN;
BEGIN
  -- Lock and fetch task
  SELECT * INTO v_task FROM tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND OR v_task.status != 'submitted' THEN
    RAISE EXCEPTION 'Task not found or not in submitted state';
  END IF;

  -- Lock and fetch kid profile
  SELECT * INTO v_kid FROM profiles WHERE id = v_task.assigned_to FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kid profile not found';
  END IF;

  v_new_lifetime := v_kid.lifetime_points + v_task.points;
  v_new_level    := calculate_level(v_new_lifetime);

  -- Update task status
  UPDATE tasks SET
    status      = 'approved',
    approved_at = now(),
    approved_by = p_parent_id
  WHERE id = p_task_id;

  -- Update kid points and level
  UPDATE profiles SET
    total_points    = total_points + v_task.points,
    lifetime_points = v_new_lifetime,
    xp              = v_new_lifetime,
    level           = v_new_level,
    last_active     = now()
  WHERE id = v_kid.id;

  -- Log task_completed activity (kid receives "approved!" notification)
  INSERT INTO activity_log (family_id, user_id, event_type, title, body, points_delta, metadata)
  VALUES (
    v_task.family_id,
    v_kid.id,
    'task_completed',
    'Task approved: ' || v_task.title,
    'Earned ' || v_task.points || ' Crush Points',
    v_task.points,
    jsonb_build_object(
      'task_id',     p_task_id,
      'task_title',  v_task.title,
      'points',      v_task.points,
      'approved_by', p_parent_id
    )
  );

  -- Emit level_up event when the kid reaches a new level (migration 013 addition)
  IF v_new_level > v_kid.level THEN
    INSERT INTO activity_log (family_id, user_id, event_type, title, body, points_delta, metadata)
    VALUES (
      v_task.family_id,
      v_kid.id,
      'level_up',
      'Level Up! You reached Level ' || v_new_level,
      'Keep crushing those tasks!',
      0,
      jsonb_build_object(
        'level',     v_new_level,
        'old_level', v_kid.level,
        'task_id',   p_task_id
      )
    );
  END IF;

  -- Update daily streak BEFORE achievement check so streak_days achievements
  -- see the newly incremented streak value (bug fix from migration 012).
  PERFORM update_kid_daily_streak(v_kid.id, v_task.family_id);

  -- Re-fetch kid after streak update
  SELECT * INTO v_kid FROM profiles WHERE id = v_task.assigned_to;

  -- ── Achievement evaluation ─────────────────────────────────────────────────

  FOR v_achievement IN
    SELECT a.*
    FROM achievements a
    WHERE NOT EXISTS (
      SELECT 1 FROM kid_achievements ka
      WHERE ka.kid_id = v_kid.id AND ka.achievement_id = a.id
    )
  LOOP
    v_condition_met := FALSE;

    CASE v_achievement.condition_type

      WHEN 'tasks_completed' THEN
        SELECT COUNT(*) INTO v_stat_value
        FROM tasks
        WHERE assigned_to = v_kid.id AND status = 'approved';
        v_condition_met := v_stat_value >= v_achievement.condition_value;

      WHEN 'points_earned' THEN
        v_condition_met := v_new_lifetime >= v_achievement.condition_value;

      WHEN 'level_reached' THEN
        v_condition_met := v_new_level >= v_achievement.condition_value;

      WHEN 'streak_days' THEN
        SELECT COALESCE(MAX(current_streak), 0) INTO v_stat_value
        FROM streaks
        WHERE kid_id = v_kid.id AND streak_type = 'daily';
        v_condition_met := v_stat_value >= v_achievement.condition_value;

      WHEN 'chore_tasks' THEN
        SELECT COUNT(*) INTO v_stat_value
        FROM tasks
        WHERE assigned_to = v_kid.id AND status = 'approved' AND category = 'chores';
        v_condition_met := v_stat_value >= v_achievement.condition_value;

      WHEN 'school_tasks' THEN
        SELECT COUNT(*) INTO v_stat_value
        FROM tasks
        WHERE assigned_to = v_kid.id AND status = 'approved' AND category = 'school';
        v_condition_met := v_stat_value >= v_achievement.condition_value;

      WHEN 'health_tasks' THEN
        SELECT COUNT(*) INTO v_stat_value
        FROM tasks
        WHERE assigned_to = v_kid.id AND status = 'approved' AND category = 'health';
        v_condition_met := v_stat_value >= v_achievement.condition_value;

      WHEN 'kindness_tasks' THEN
        SELECT COUNT(*) INTO v_stat_value
        FROM tasks
        WHERE assigned_to = v_kid.id AND status = 'approved' AND category = 'kindness';
        v_condition_met := v_stat_value >= v_achievement.condition_value;

      WHEN 'redemptions' THEN
        SELECT COUNT(*) INTO v_stat_value
        FROM redemptions
        WHERE kid_id = v_kid.id AND status IN ('approved', 'fulfilled');
        v_condition_met := v_stat_value >= v_achievement.condition_value;

      ELSE
        v_condition_met := FALSE;

    END CASE;

    IF v_condition_met THEN
      INSERT INTO kid_achievements (kid_id, achievement_id)
      VALUES (v_kid.id, v_achievement.id)
      ON CONFLICT (kid_id, achievement_id) DO NOTHING;

      INSERT INTO activity_log (family_id, user_id, event_type, title, body, points_delta, metadata)
      VALUES (
        v_task.family_id,
        v_kid.id,
        'badge_earned',
        'Badge earned: ' || v_achievement.title,
        v_achievement.description,
        0,
        jsonb_build_object(
          'achievement_id',  v_achievement.id,
          'achievement_key', v_achievement.key,
          'badge_name',      v_achievement.title,
          'task_id',         p_task_id
        )
      );
    END IF;

  END LOOP;

END;
$$;
