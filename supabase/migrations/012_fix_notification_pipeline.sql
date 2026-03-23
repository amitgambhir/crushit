-- Migration 012: Fix notification pipeline + streak evaluation correctness
-- ============================================================
-- Fixes three bugs found in QA review:
--
-- BUG 1 (Critical): No activity_log event exists for kid task submission,
--   so parents never receive push notifications to review tasks.
--   Fix: add 'task_submitted' to event_type constraint + create submit_task() RPC.
--
-- BUG 2 (High): Achievement streak_days check reads current_streak BEFORE
--   update_kid_daily_streak() increments it → achievements unlock one approval late.
--   Fix: reorder approve_task() so streak update runs first.
--
-- BUG 3 (High): weekly/monthly/yearly streak rows never have last_activity_date
--   updated, so check-streaks cron always resets them.
--   Fix: update_kid_daily_streak() now sets last_activity_date on all streak types.
-- ============================================================

-- ── 1. Extend activity_log event_type constraint ──────────────────────────────

ALTER TABLE activity_log
  DROP CONSTRAINT IF EXISTS activity_log_event_type_check;

ALTER TABLE activity_log
  ADD CONSTRAINT activity_log_event_type_check CHECK (event_type IN (
    'task_submitted',       -- kid submitted for parent review (NEW)
    'task_completed',       -- parent approved → kid notified
    'task_rejected',        -- parent rejected → kid notified
    'reward_redeemed',      -- kid redeemed → parent notified
    'redemption_rejected',  -- parent rejected redemption → kid notified
    'redemption_fulfilled', -- parent fulfilled redemption → kid notified
    'streak_milestone',     -- streak reward unlocked → kid notified
    'badge_earned',         -- achievement badge earned → kid notified
    'level_up',             -- level up → kid notified
    'points_awarded',       -- bonus points → kid notified
    'crush_drop'            -- crush drop bonus → kid notified
  ));

-- ── 2. update_kid_daily_streak() — also updates non-daily last_activity_date ─

CREATE OR REPLACE FUNCTION update_kid_daily_streak(
  p_kid_id    UUID,
  p_family_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_streak     streaks%ROWTYPE;
  v_today      DATE := CURRENT_DATE;
  v_new_streak INT  := 0;
  v_sr         streak_rewards%ROWTYPE;
BEGIN
  SELECT * INTO v_streak
  FROM streaks
  WHERE kid_id = p_kid_id AND streak_type = 'daily'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN; -- no streak row means create-kid hasn't run; skip silently
  END IF;

  IF v_streak.last_activity_date IS NULL THEN
    -- First ever task
    v_new_streak := 1;
    UPDATE streaks SET
      current_streak     = 1,
      longest_streak     = GREATEST(longest_streak, 1),
      last_activity_date = v_today,
      streak_start_date  = v_today,
      updated_at         = now()
    WHERE id = v_streak.id;

  ELSIF v_streak.last_activity_date = v_today THEN
    -- Already logged today — no-op for daily, but still update non-daily below
    NULL;

  ELSIF v_streak.last_activity_date = v_today - 1 THEN
    -- Consecutive day → increment
    v_new_streak := v_streak.current_streak + 1;
    UPDATE streaks SET
      current_streak     = v_new_streak,
      longest_streak     = GREATEST(longest_streak, v_new_streak),
      last_activity_date = v_today,
      updated_at         = now()
    WHERE id = v_streak.id;

  ELSE
    -- Gap (missed ≥1 day; cron may have already reset, but guard here too)
    v_new_streak := 1;
    UPDATE streaks SET
      current_streak     = 1,
      longest_streak     = GREATEST(longest_streak, 1),
      last_activity_date = v_today,
      streak_start_date  = v_today,
      updated_at         = now()
    WHERE id = v_streak.id;
  END IF;

  -- ── BUG 3 FIX: Stamp today on weekly/monthly/yearly rows so check-streaks
  --               cron can evaluate them correctly.
  UPDATE streaks SET
    last_activity_date = v_today,
    updated_at         = now()
  WHERE kid_id     = p_kid_id
    AND streak_type IN ('weekly', 'monthly', 'yearly')
    AND (last_activity_date IS NULL OR last_activity_date < v_today);

  -- Skip milestone check when streak didn't change (already counted today)
  IF v_new_streak = 0 THEN
    RETURN;
  END IF;

  -- ── Streak reward milestone check (daily only) ────────────────────────────
  FOR v_sr IN
    SELECT sr.*
    FROM streak_rewards sr
    WHERE sr.family_id      = p_family_id
      AND sr.streak_type    = 'daily'
      AND sr.required_streak = v_new_streak
      AND NOT EXISTS (
        SELECT 1 FROM streak_reward_unlocks sru
        WHERE sru.streak_reward_id = sr.id
          AND sru.kid_id           = p_kid_id
      )
  LOOP
    INSERT INTO streak_reward_unlocks (streak_reward_id, kid_id, bonus_points_awarded)
    VALUES (v_sr.id, p_kid_id, v_sr.bonus_points)
    ON CONFLICT (streak_reward_id, kid_id) DO NOTHING;

    IF v_sr.bonus_points > 0 THEN
      UPDATE profiles SET
        total_points    = total_points    + v_sr.bonus_points,
        lifetime_points = lifetime_points + v_sr.bonus_points,
        xp              = xp              + v_sr.bonus_points,
        level           = calculate_level(lifetime_points + v_sr.bonus_points),
        last_active     = now()
      WHERE id = p_kid_id;
    END IF;

    INSERT INTO activity_log (
      family_id, user_id, event_type, title, body, points_delta, metadata
    ) VALUES (
      p_family_id,
      p_kid_id,
      'streak_milestone',
      v_new_streak || '-day streak! 🔥',
      'Unlocked: ' || v_sr.reward_title ||
        CASE WHEN v_sr.bonus_points > 0
             THEN ' (+' || v_sr.bonus_points || ' pts)'
             ELSE ''
        END,
      v_sr.bonus_points,
      jsonb_build_object(
        'streak_type',  'daily',
        'streak_count', v_new_streak,
        'reward_id',    v_sr.id
      )
    );
  END LOOP;
END;
$$;

-- ── 3. submit_task() RPC — kid submits a task + logs task_submitted event ────

CREATE OR REPLACE FUNCTION submit_task(
  p_task_id         UUID,
  p_proof_note      TEXT DEFAULT NULL,
  p_proof_photo_url TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_task  tasks%ROWTYPE;
  v_kid   profiles%ROWTYPE;
BEGIN
  -- Lock and fetch task; only the assigned kid may submit
  SELECT * INTO v_task FROM tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found';
  END IF;
  IF v_task.status != 'pending' THEN
    RAISE EXCEPTION 'Task is not in pending state (current: %)', v_task.status;
  END IF;
  IF v_task.assigned_to != auth.uid() THEN
    RAISE EXCEPTION 'Not authorised to submit this task';
  END IF;

  SELECT * INTO v_kid FROM profiles WHERE id = v_task.assigned_to;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kid profile not found';
  END IF;

  -- Update task
  UPDATE tasks SET
    status          = 'submitted',
    completed_at    = now(),
    proof_note      = p_proof_note,
    proof_photo_url = p_proof_photo_url
  WHERE id = p_task_id;

  -- Log task_submitted so send-notifications can push to the family parent
  INSERT INTO activity_log (family_id, user_id, event_type, title, body, metadata)
  VALUES (
    v_task.family_id,
    v_kid.id,
    'task_submitted',
    'Task submitted: ' || v_task.title,
    v_kid.display_name || ' completed a task — ready for review',
    jsonb_build_object(
      'task_id',    p_task_id,
      'task_title', v_task.title,
      'kid_name',   v_kid.display_name
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION submit_task(UUID, TEXT, TEXT) TO authenticated;

-- ── 4. approve_task() — fix BUG 2: streak before achievements ─────────────────

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
      'task_id',    p_task_id,
      'task_title', v_task.title,
      'points',     v_task.points,
      'approved_by', p_parent_id
    )
  );

  -- ── BUG 2 FIX: Update daily streak BEFORE achievement check so streak_days
  --               achievements see the newly incremented streak value.
  PERFORM update_kid_daily_streak(v_kid.id, v_task.family_id);

  -- Re-fetch kid after streak update (level_up check needs fresh data)
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
        -- Reads the streak after update_kid_daily_streak() has already run
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
