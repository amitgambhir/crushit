-- Migration 009: Achievement evaluation on task approval
-- ============================================================
-- Replaces approve_task() to evaluate all seeded achievement conditions
-- after each approval. Inserts kid_achievements rows for newly-met conditions
-- and logs a badge_earned activity_log event per unlock.
--
-- Conditions implemented: tasks_completed, points_earned, level_reached,
--   streak_days, chore_tasks, school_tasks, health_tasks, kindness_tasks,
--   redemptions.
-- Conditions deferred (Phase 3): weekly_perfect, sibling_tasks.

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

  -- Log task_completed activity
  INSERT INTO activity_log (family_id, user_id, event_type, title, body, points_delta, metadata)
  VALUES (
    v_task.family_id,
    v_kid.id,
    'task_completed',
    'Task approved: ' || v_task.title,
    'Earned ' || v_task.points || ' Crush Points',
    v_task.points,
    jsonb_build_object('task_id', p_task_id, 'approved_by', p_parent_id)
  );

  -- ─── Achievement evaluation ────────────────────────────────────────────────
  -- Iterate only over achievements the kid hasn't unlocked yet.

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
        -- weekly_perfect, sibling_tasks — Phase 3
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
          'task_id',         p_task_id
        )
      );
    END IF;

  END LOOP;

END;
$$;
