-- Migration 014: RPC auth hardening + complete level_up events
-- ============================================================
-- HIGH: All parent-acting RPCs accepted a caller-supplied p_parent_id without
--   verifying it against auth.uid(). A client could invoke any privileged
--   mutation by passing an arbitrary parent UUID. Same problem with
--   redeem_reward(p_reward_id, p_kid_id) — caller-supplied kid identity.
--   Fix: drop all caller-identity params; resolve from auth.uid() server-side
--   with a full 4-step check: auth.uid() exists → profile found → role correct
--   → same family_id as the target row.
--
-- MEDIUM: level_up events were emitted only from approve_task(). Two other
--   paths that award points — streak bonus in update_kid_daily_streak() and
--   award_crush_drop() — could silently advance a kid's level.
--   Fix: both functions now compare old vs new level and emit level_up.
-- ============================================================

-- ── Drop old spoofable signatures ─────────────────────────────────────────────
-- PostgreSQL identifies functions by (name, arg_types). CREATE OR REPLACE only
-- replaces a matching signature, so the old unguarded overloads would remain
-- callable unless explicitly dropped.

DROP FUNCTION IF EXISTS approve_task(UUID, UUID);
DROP FUNCTION IF EXISTS reject_task(UUID, TEXT, UUID);
DROP FUNCTION IF EXISTS reject_redemption(UUID, TEXT, UUID);
DROP FUNCTION IF EXISTS fulfill_redemption(UUID, UUID);
DROP FUNCTION IF EXISTS award_crush_drop(UUID, UUID, INT, TEXT);
DROP FUNCTION IF EXISTS redeem_reward(UUID, UUID);

-- ── 1. approve_task(p_task_id) ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION approve_task(p_task_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller        profiles%ROWTYPE;
  v_task          tasks%ROWTYPE;
  v_kid           profiles%ROWTYPE;
  v_new_lifetime  INT;
  v_new_level     INT;
  v_achievement   achievements%ROWTYPE;
  v_stat_value    INT;
  v_condition_met BOOLEAN;
BEGIN
  -- 1. Auth checks
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  SELECT * INTO v_caller FROM profiles WHERE id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Caller profile not found';
  END IF;
  IF v_caller.role != 'parent' THEN
    RAISE EXCEPTION 'Only parents can approve tasks';
  END IF;

  -- 2. Lock and fetch task
  SELECT * INTO v_task FROM tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND OR v_task.status != 'submitted' THEN
    RAISE EXCEPTION 'Task not found or not in submitted state';
  END IF;

  -- 3. Same-family check
  IF v_caller.family_id != v_task.family_id THEN
    RAISE EXCEPTION 'Task does not belong to your family';
  END IF;

  -- 4. Lock and fetch kid profile
  SELECT * INTO v_kid FROM profiles WHERE id = v_task.assigned_to FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kid profile not found';
  END IF;

  v_new_lifetime := v_kid.lifetime_points + v_task.points;
  v_new_level    := calculate_level(v_new_lifetime);

  UPDATE tasks SET
    status      = 'approved',
    approved_at = now(),
    approved_by = auth.uid()
  WHERE id = p_task_id;

  UPDATE profiles SET
    total_points    = total_points + v_task.points,
    lifetime_points = v_new_lifetime,
    xp              = v_new_lifetime,
    level           = v_new_level,
    last_active     = now()
  WHERE id = v_kid.id;

  -- task_completed → kid notified
  INSERT INTO activity_log (family_id, user_id, event_type, title, body, points_delta, metadata)
  VALUES (
    v_task.family_id, v_kid.id, 'task_completed',
    'Task approved: ' || v_task.title,
    'Earned ' || v_task.points || ' Crush Points',
    v_task.points,
    jsonb_build_object(
      'task_id',     p_task_id,
      'task_title',  v_task.title,
      'points',      v_task.points,
      'approved_by', auth.uid()
    )
  );

  -- level_up → kid notified (when approval crosses a level boundary)
  IF v_new_level > v_kid.level THEN
    INSERT INTO activity_log (family_id, user_id, event_type, title, body, points_delta, metadata)
    VALUES (
      v_task.family_id, v_kid.id, 'level_up',
      'Level Up! You reached Level ' || v_new_level,
      'Keep crushing those tasks!',
      0,
      jsonb_build_object('level', v_new_level, 'old_level', v_kid.level, 'task_id', p_task_id)
    );
  END IF;

  -- Streak update BEFORE achievement loop (so streak_days sees new value)
  PERFORM update_kid_daily_streak(v_kid.id, v_task.family_id);

  -- Re-fetch kid after streak may have awarded bonus points
  SELECT * INTO v_kid FROM profiles WHERE id = v_task.assigned_to;

  -- Achievement evaluation
  FOR v_achievement IN
    SELECT a.* FROM achievements a
    WHERE NOT EXISTS (
      SELECT 1 FROM kid_achievements ka
      WHERE ka.kid_id = v_kid.id AND ka.achievement_id = a.id
    )
  LOOP
    v_condition_met := FALSE;
    CASE v_achievement.condition_type
      WHEN 'tasks_completed' THEN
        SELECT COUNT(*) INTO v_stat_value FROM tasks
        WHERE assigned_to = v_kid.id AND status = 'approved';
        v_condition_met := v_stat_value >= v_achievement.condition_value;
      WHEN 'points_earned' THEN
        v_condition_met := v_new_lifetime >= v_achievement.condition_value;
      WHEN 'level_reached' THEN
        v_condition_met := v_new_level >= v_achievement.condition_value;
      WHEN 'streak_days' THEN
        SELECT COALESCE(MAX(current_streak), 0) INTO v_stat_value
        FROM streaks WHERE kid_id = v_kid.id AND streak_type = 'daily';
        v_condition_met := v_stat_value >= v_achievement.condition_value;
      WHEN 'chore_tasks' THEN
        SELECT COUNT(*) INTO v_stat_value FROM tasks
        WHERE assigned_to = v_kid.id AND status = 'approved' AND category = 'chores';
        v_condition_met := v_stat_value >= v_achievement.condition_value;
      WHEN 'school_tasks' THEN
        SELECT COUNT(*) INTO v_stat_value FROM tasks
        WHERE assigned_to = v_kid.id AND status = 'approved' AND category = 'school';
        v_condition_met := v_stat_value >= v_achievement.condition_value;
      WHEN 'health_tasks' THEN
        SELECT COUNT(*) INTO v_stat_value FROM tasks
        WHERE assigned_to = v_kid.id AND status = 'approved' AND category = 'health';
        v_condition_met := v_stat_value >= v_achievement.condition_value;
      WHEN 'kindness_tasks' THEN
        SELECT COUNT(*) INTO v_stat_value FROM tasks
        WHERE assigned_to = v_kid.id AND status = 'approved' AND category = 'kindness';
        v_condition_met := v_stat_value >= v_achievement.condition_value;
      WHEN 'redemptions' THEN
        SELECT COUNT(*) INTO v_stat_value FROM redemptions
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
        v_task.family_id, v_kid.id, 'badge_earned',
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

GRANT EXECUTE ON FUNCTION approve_task(UUID) TO authenticated;

-- ── 2. reject_task(p_task_id, p_reason) ──────────────────────────────────────

CREATE OR REPLACE FUNCTION reject_task(p_task_id UUID, p_reason TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller profiles%ROWTYPE;
  v_task   tasks%ROWTYPE;
  v_kid    profiles%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_caller FROM profiles WHERE id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Caller profile not found'; END IF;
  IF v_caller.role != 'parent' THEN RAISE EXCEPTION 'Only parents can reject tasks'; END IF;

  SELECT * INTO v_task FROM tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Task not found'; END IF;
  IF v_task.status != 'submitted' THEN
    RAISE EXCEPTION 'Task is not in submitted state (current: %)', v_task.status;
  END IF;
  IF v_caller.family_id != v_task.family_id THEN
    RAISE EXCEPTION 'Task does not belong to your family';
  END IF;

  SELECT * INTO v_kid FROM profiles WHERE id = v_task.assigned_to;
  IF NOT FOUND THEN RAISE EXCEPTION 'Kid profile not found'; END IF;

  UPDATE tasks SET status = 'rejected', rejection_reason = p_reason WHERE id = p_task_id;

  INSERT INTO activity_log (family_id, user_id, event_type, title, body, metadata)
  VALUES (
    v_task.family_id, v_kid.id, 'task_rejected',
    'Task rejected: ' || v_task.title,
    COALESCE(p_reason, 'Your task was not approved this time.'),
    jsonb_build_object('task_id', p_task_id, 'task_title', v_task.title, 'reason', p_reason)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION reject_task(UUID, TEXT) TO authenticated;

-- ── 3. reject_redemption(p_redemption_id, p_note) ────────────────────────────

CREATE OR REPLACE FUNCTION reject_redemption(p_redemption_id UUID, p_note TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller     profiles%ROWTYPE;
  v_redemption redemptions%ROWTYPE;
  v_reward     rewards%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_caller FROM profiles WHERE id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Caller profile not found'; END IF;
  IF v_caller.role != 'parent' THEN RAISE EXCEPTION 'Only parents can reject redemptions'; END IF;

  SELECT * INTO v_redemption FROM redemptions WHERE id = p_redemption_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Redemption not found'; END IF;
  IF v_redemption.status NOT IN ('pending', 'approved') THEN
    RAISE EXCEPTION 'Redemption cannot be rejected in current state: %', v_redemption.status;
  END IF;

  SELECT * INTO v_reward FROM rewards WHERE id = v_redemption.reward_id;
  IF v_caller.family_id != v_reward.family_id THEN
    RAISE EXCEPTION 'Redemption does not belong to your family';
  END IF;

  -- Refund total_points only — lifetime_points stays monotonic (AD-006)
  UPDATE profiles SET total_points = total_points + v_redemption.points_spent
  WHERE id = v_redemption.kid_id;

  UPDATE redemptions SET status = 'rejected', parent_note = p_note WHERE id = p_redemption_id;

  INSERT INTO activity_log (family_id, user_id, event_type, title, body, metadata)
  VALUES (
    v_reward.family_id, v_redemption.kid_id, 'redemption_rejected',
    'Redemption rejected',
    COALESCE(p_note, 'Your reward request was not approved.'),
    jsonb_build_object(
      'redemption_id', p_redemption_id,
      'reward_title',  v_reward.title,
      'points',        v_redemption.points_spent,
      'note',          p_note
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION reject_redemption(UUID, TEXT) TO authenticated;

-- ── 4. fulfill_redemption(p_redemption_id) ───────────────────────────────────

CREATE OR REPLACE FUNCTION fulfill_redemption(p_redemption_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller     profiles%ROWTYPE;
  v_redemption redemptions%ROWTYPE;
  v_reward     rewards%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_caller FROM profiles WHERE id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Caller profile not found'; END IF;
  IF v_caller.role != 'parent' THEN RAISE EXCEPTION 'Only parents can fulfill redemptions'; END IF;

  SELECT * INTO v_redemption FROM redemptions WHERE id = p_redemption_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Redemption not found'; END IF;
  IF v_redemption.status != 'approved' THEN
    RAISE EXCEPTION 'Redemption is not in approved state (current: %)', v_redemption.status;
  END IF;

  SELECT * INTO v_reward FROM rewards WHERE id = v_redemption.reward_id;
  IF v_caller.family_id != v_reward.family_id THEN
    RAISE EXCEPTION 'Redemption does not belong to your family';
  END IF;

  UPDATE redemptions SET status = 'fulfilled', fulfilled_at = now() WHERE id = p_redemption_id;

  INSERT INTO activity_log (family_id, user_id, event_type, title, body, metadata)
  VALUES (
    v_reward.family_id, v_redemption.kid_id, 'redemption_fulfilled',
    'Reward ready: ' || v_reward.title,
    'Your reward has been fulfilled!',
    jsonb_build_object('redemption_id', p_redemption_id, 'reward_title', v_reward.title)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION fulfill_redemption(UUID) TO authenticated;

-- ── 5. award_crush_drop(p_kid_id, p_points, p_reason) ────────────────────────
-- Also adds level_up event emission (was missing from migration 001).

CREATE OR REPLACE FUNCTION award_crush_drop(
  p_kid_id UUID,
  p_points INT,
  p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller       profiles%ROWTYPE;
  v_kid          profiles%ROWTYPE;
  v_new_lifetime INT;
  v_new_level    INT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_caller FROM profiles WHERE id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Caller profile not found'; END IF;
  IF v_caller.role != 'parent' THEN RAISE EXCEPTION 'Only parents can award Crush Drops'; END IF;

  SELECT * INTO v_kid FROM profiles WHERE id = p_kid_id FOR UPDATE;
  IF NOT FOUND OR v_kid.role != 'kid' THEN
    RAISE EXCEPTION 'Kid profile not found';
  END IF;
  IF v_caller.family_id != v_kid.family_id THEN
    RAISE EXCEPTION 'Kid does not belong to your family';
  END IF;

  v_new_lifetime := v_kid.lifetime_points + p_points;
  v_new_level    := calculate_level(v_new_lifetime);

  UPDATE profiles SET
    total_points    = total_points + p_points,
    lifetime_points = v_new_lifetime,
    xp              = v_new_lifetime,
    level           = v_new_level,
    last_active     = now()
  WHERE id = p_kid_id;

  -- crush_drop → kid notified
  INSERT INTO activity_log (family_id, user_id, event_type, title, body, points_delta, metadata)
  VALUES (
    v_kid.family_id, p_kid_id, 'crush_drop',
    'Crush Drop! +' || p_points || ' pts',
    p_reason,
    p_points,
    jsonb_build_object('awarded_by', auth.uid())
  );

  -- level_up → kid notified (when Crush Drop crosses a level boundary)
  IF v_new_level > v_kid.level THEN
    INSERT INTO activity_log (family_id, user_id, event_type, title, body, points_delta, metadata)
    VALUES (
      v_kid.family_id, p_kid_id, 'level_up',
      'Level Up! You reached Level ' || v_new_level,
      'A Crush Drop unlocked a new level!',
      0,
      jsonb_build_object('level', v_new_level, 'old_level', v_kid.level)
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION award_crush_drop(UUID, INT, TEXT) TO authenticated;

-- ── 6. redeem_reward(p_reward_id) ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION redeem_reward(p_reward_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_kid           profiles%ROWTYPE;
  v_reward        rewards%ROWTYPE;
  v_redemption_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Lock caller as the redeeming kid
  SELECT * INTO v_kid FROM profiles WHERE id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
  IF v_kid.role != 'kid' THEN RAISE EXCEPTION 'Only kids can redeem rewards'; END IF;

  SELECT * INTO v_reward FROM rewards WHERE id = p_reward_id FOR UPDATE;
  IF NOT FOUND OR NOT v_reward.is_active THEN
    RAISE EXCEPTION 'Reward not found or inactive';
  END IF;
  -- Same-family check
  IF v_kid.family_id != v_reward.family_id THEN
    RAISE EXCEPTION 'Reward does not belong to your family';
  END IF;

  IF v_reward.quantity_available IS NOT NULL
     AND v_reward.quantity_redeemed >= v_reward.quantity_available THEN
    RAISE EXCEPTION 'Reward is out of stock';
  END IF;

  IF v_kid.total_points < v_reward.cost_points THEN
    RAISE EXCEPTION 'Insufficient points: have %, need %', v_kid.total_points, v_reward.cost_points;
  END IF;

  UPDATE profiles SET
    total_points = total_points - v_reward.cost_points,
    last_active  = now()
  WHERE id = v_kid.id;

  UPDATE rewards SET quantity_redeemed = quantity_redeemed + 1 WHERE id = p_reward_id;

  INSERT INTO redemptions (reward_id, kid_id, points_spent, status)
  VALUES (p_reward_id, v_kid.id, v_reward.cost_points, 'pending')
  RETURNING id INTO v_redemption_id;

  INSERT INTO activity_log (family_id, user_id, event_type, title, body, points_delta, metadata)
  VALUES (
    v_reward.family_id, v_kid.id, 'reward_redeemed',
    'Reward requested: ' || v_reward.title,
    'Spent ' || v_reward.cost_points || ' Crush Points',
    -v_reward.cost_points,
    jsonb_build_object('reward_id', p_reward_id, 'redemption_id', v_redemption_id)
  );

  RETURN v_redemption_id;
END;
$$;

GRANT EXECUTE ON FUNCTION redeem_reward(UUID) TO authenticated;

-- ── 7. update_kid_daily_streak() — add level_up on streak bonus points ────────
-- Full replacement of the function from migration 012.
-- New: when streak bonus points are awarded, compare old vs new level and emit
-- level_up if the bonus crosses a level boundary.

CREATE OR REPLACE FUNCTION update_kid_daily_streak(
  p_kid_id    UUID,
  p_family_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_streak       streaks%ROWTYPE;
  v_today        DATE := CURRENT_DATE;
  v_new_streak   INT  := 0;
  v_sr           streak_rewards%ROWTYPE;
  v_old_level    INT;
  v_new_lv       INT;
  v_kid_lifetime INT;
BEGIN
  SELECT * INTO v_streak
  FROM streaks
  WHERE kid_id = p_kid_id AND streak_type = 'daily'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_streak.last_activity_date IS NULL THEN
    v_new_streak := 1;
    UPDATE streaks SET
      current_streak     = 1,
      longest_streak     = GREATEST(longest_streak, 1),
      last_activity_date = v_today,
      streak_start_date  = v_today,
      updated_at         = now()
    WHERE id = v_streak.id;

  ELSIF v_streak.last_activity_date = v_today THEN
    NULL; -- already logged today; still stamp non-daily rows below

  ELSIF v_streak.last_activity_date = v_today - 1 THEN
    v_new_streak := v_streak.current_streak + 1;
    UPDATE streaks SET
      current_streak     = v_new_streak,
      longest_streak     = GREATEST(longest_streak, v_new_streak),
      last_activity_date = v_today,
      updated_at         = now()
    WHERE id = v_streak.id;

  ELSE
    v_new_streak := 1;
    UPDATE streaks SET
      current_streak     = 1,
      longest_streak     = GREATEST(longest_streak, 1),
      last_activity_date = v_today,
      streak_start_date  = v_today,
      updated_at         = now()
    WHERE id = v_streak.id;
  END IF;

  -- Stamp today on weekly/monthly/yearly rows so check-streaks cron evaluates correctly
  UPDATE streaks SET
    last_activity_date = v_today,
    updated_at         = now()
  WHERE kid_id     = p_kid_id
    AND streak_type IN ('weekly', 'monthly', 'yearly')
    AND (last_activity_date IS NULL OR last_activity_date < v_today);

  IF v_new_streak = 0 THEN
    RETURN;
  END IF;

  -- Streak reward milestone check (daily only)
  FOR v_sr IN
    SELECT sr.*
    FROM streak_rewards sr
    WHERE sr.family_id       = p_family_id
      AND sr.streak_type     = 'daily'
      AND sr.required_streak = v_new_streak
      AND NOT EXISTS (
        SELECT 1 FROM streak_reward_unlocks sru
        WHERE sru.streak_reward_id = sr.id AND sru.kid_id = p_kid_id
      )
  LOOP
    INSERT INTO streak_reward_unlocks (streak_reward_id, kid_id, bonus_points_awarded)
    VALUES (v_sr.id, p_kid_id, v_sr.bonus_points)
    ON CONFLICT (streak_reward_id, kid_id) DO NOTHING;

    IF v_sr.bonus_points > 0 THEN
      -- Capture level before the bonus update to detect a level-up
      SELECT level, lifetime_points INTO v_old_level, v_kid_lifetime
      FROM profiles WHERE id = p_kid_id;

      v_new_lv := calculate_level(v_kid_lifetime + v_sr.bonus_points);

      UPDATE profiles SET
        total_points    = total_points    + v_sr.bonus_points,
        lifetime_points = lifetime_points + v_sr.bonus_points,
        xp              = xp              + v_sr.bonus_points,
        level           = v_new_lv,
        last_active     = now()
      WHERE id = p_kid_id;

      IF v_new_lv > v_old_level THEN
        INSERT INTO activity_log (family_id, user_id, event_type, title, body, points_delta, metadata)
        VALUES (
          p_family_id, p_kid_id, 'level_up',
          'Level Up! You reached Level ' || v_new_lv,
          'A streak milestone unlocked a new level!',
          0,
          jsonb_build_object(
            'level',         v_new_lv,
            'old_level',     v_old_level,
            'streak_type',   'daily',
            'streak_count',  v_new_streak
          )
        );
      END IF;
    END IF;

    INSERT INTO activity_log (family_id, user_id, event_type, title, body, points_delta, metadata)
    VALUES (
      p_family_id, p_kid_id, 'streak_milestone',
      v_new_streak || '-day streak! 🔥',
      'Unlocked: ' || v_sr.reward_title ||
        CASE WHEN v_sr.bonus_points > 0 THEN ' (+' || v_sr.bonus_points || ' pts)' ELSE '' END,
      v_sr.bonus_points,
      jsonb_build_object('streak_type', 'daily', 'streak_count', v_new_streak, 'reward_id', v_sr.id)
    );
  END LOOP;
END;
$$;
