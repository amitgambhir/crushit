-- ============================================================
-- CrushIt — Initial Schema Migration
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- FAMILIES
-- ============================================================
CREATE TABLE families (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  invite_code  TEXT UNIQUE NOT NULL,  -- 6-character alphanumeric code
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE families ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================
CREATE TABLE profiles (
  id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  family_id        UUID REFERENCES families(id),
  display_name     TEXT NOT NULL,
  username         TEXT UNIQUE,          -- kids log in with username
  role             TEXT NOT NULL CHECK (role IN ('parent', 'kid')),
  avatar_url       TEXT,
  avatar_emoji     TEXT DEFAULT '⭐',
  total_points     INT DEFAULT 0,        -- spendable Crush Points
  lifetime_points  INT DEFAULT 0,        -- never decremented; drives level
  level            INT DEFAULT 1,
  xp               INT DEFAULT 0,
  date_of_birth    DATE,
  color_theme      TEXT DEFAULT '#6C63FF',
  pin_hash         TEXT,                 -- bcrypt hash of kid/parent PIN
  created_at       TIMESTAMPTZ DEFAULT now(),
  last_active      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- TASK TEMPLATES (standard library + family-custom)
-- ============================================================
CREATE TABLE task_templates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id         UUID REFERENCES families(id),  -- NULL = system template
  title             TEXT NOT NULL,
  description       TEXT,
  category          TEXT NOT NULL CHECK (category IN (
                      'chores', 'school', 'personal', 'health',
                      'creative', 'kindness', 'custom'
                    )),
  icon              TEXT NOT NULL,
  default_points    INT NOT NULL DEFAULT 10,
  estimated_minutes INT,
  difficulty        TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),
  is_active         BOOL DEFAULT TRUE,
  created_by        UUID REFERENCES profiles(id),
  created_at        TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE task_templates ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- TASKS (assigned instances)
-- ============================================================
CREATE TABLE tasks (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id             UUID NOT NULL REFERENCES families(id),
  template_id           UUID REFERENCES task_templates(id),
  assigned_to           UUID REFERENCES profiles(id),  -- NULL = open/claimable
  assigned_by           UUID REFERENCES profiles(id),
  title                 TEXT NOT NULL,
  description           TEXT,
  category              TEXT NOT NULL,
  icon                  TEXT NOT NULL,
  points                INT NOT NULL,
  due_date              TIMESTAMPTZ,
  recurrence            TEXT CHECK (recurrence IN (
                           'once', 'daily', 'weekdays', 'weekends',
                           'weekly', 'monthly'
                         )),
  recurrence_day        INT,  -- 0-6 (day of week) or 1-31 (day of month)
  status                TEXT DEFAULT 'pending' CHECK (status IN (
                           'pending', 'submitted', 'approved', 'rejected', 'expired'
                         )),
  requires_photo_proof  BOOL DEFAULT FALSE,
  proof_photo_url       TEXT,
  proof_note            TEXT,
  completed_at          TIMESTAMPTZ,
  approved_at           TIMESTAMPTZ,
  approved_by           UUID REFERENCES profiles(id),
  rejection_reason      TEXT,
  created_at            TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- REWARD TEMPLATES
-- ============================================================
CREATE TABLE reward_templates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id    UUID REFERENCES families(id),  -- NULL = system template
  title        TEXT NOT NULL,
  description  TEXT,
  category     TEXT NOT NULL CHECK (category IN (
                 'screen_time', 'food', 'outing', 'toy',
                 'privilege', 'experience', 'custom'
               )),
  icon         TEXT NOT NULL,
  cost_points  INT NOT NULL,
  is_active    BOOL DEFAULT TRUE,
  created_by   UUID REFERENCES profiles(id),
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE reward_templates ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- REWARDS (family store items)
-- ============================================================
CREATE TABLE rewards (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id                UUID NOT NULL REFERENCES families(id),
  template_id              UUID REFERENCES reward_templates(id),
  title                    TEXT NOT NULL,
  description              TEXT,
  category                 TEXT NOT NULL,
  icon                     TEXT NOT NULL,
  cost_points              INT NOT NULL,
  available_to             UUID[],             -- NULL = all kids
  quantity_available       INT,                -- NULL = unlimited
  quantity_redeemed        INT DEFAULT 0,
  is_surprise              BOOL DEFAULT FALSE,
  surprise_reveal_at_points INT,
  is_active                BOOL DEFAULT TRUE,
  expires_at               TIMESTAMPTZ,
  created_by               UUID REFERENCES profiles(id),
  created_at               TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- REDEMPTIONS
-- ============================================================
CREATE TABLE redemptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reward_id    UUID NOT NULL REFERENCES rewards(id),
  kid_id       UUID NOT NULL REFERENCES profiles(id),
  points_spent INT NOT NULL,
  status       TEXT DEFAULT 'pending' CHECK (status IN (
                 'pending', 'approved', 'rejected', 'fulfilled'
               )),
  parent_note  TEXT,
  fulfilled_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE redemptions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STREAKS
-- ============================================================
CREATE TABLE streaks (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kid_id              UUID NOT NULL REFERENCES profiles(id),
  streak_type         TEXT NOT NULL CHECK (streak_type IN ('daily', 'weekly', 'monthly', 'yearly')),
  current_streak      INT DEFAULT 0,
  longest_streak      INT DEFAULT 0,
  last_activity_date  DATE,
  streak_start_date   DATE,
  updated_at          TIMESTAMPTZ DEFAULT now(),
  UNIQUE (kid_id, streak_type)
);

ALTER TABLE streaks ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STREAK REWARDS (milestone bonuses set by parents)
-- ============================================================
CREATE TABLE streak_rewards (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id          UUID NOT NULL REFERENCES families(id),
  streak_type        TEXT NOT NULL CHECK (streak_type IN ('weekly', 'monthly', 'yearly')),
  required_streak    INT NOT NULL,
  reward_title       TEXT NOT NULL,
  reward_description TEXT,
  bonus_points       INT DEFAULT 0,
  is_surprise        BOOL DEFAULT TRUE,
  surprise_icon      TEXT DEFAULT '🎁',
  actual_icon        TEXT,
  created_by         UUID REFERENCES profiles(id),
  created_at         TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE streak_rewards ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STREAK REWARD UNLOCKS
-- ============================================================
CREATE TABLE streak_reward_unlocks (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  streak_reward_id     UUID NOT NULL REFERENCES streak_rewards(id),
  kid_id               UUID NOT NULL REFERENCES profiles(id),
  unlocked_at          TIMESTAMPTZ DEFAULT now(),
  bonus_points_awarded INT DEFAULT 0,
  UNIQUE (streak_reward_id, kid_id)
);

ALTER TABLE streak_reward_unlocks ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- ACHIEVEMENTS
-- ============================================================
CREATE TABLE achievements (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key              TEXT UNIQUE NOT NULL,
  title            TEXT NOT NULL,
  description      TEXT NOT NULL,
  icon             TEXT NOT NULL,
  badge_color      TEXT NOT NULL,
  category         TEXT NOT NULL CHECK (category IN ('milestone', 'streak', 'tasks', 'special')),
  condition_type   TEXT NOT NULL CHECK (condition_type IN (
                     'tasks_completed', 'streak_days', 'level_reached',
                     'points_earned', 'redemptions', 'chore_tasks',
                     'school_tasks', 'health_tasks', 'kindness_tasks',
                     'weekly_perfect', 'sibling_tasks'
                   )),
  condition_value  INT NOT NULL
);

ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- KID ACHIEVEMENT UNLOCKS
-- ============================================================
CREATE TABLE kid_achievements (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kid_id         UUID NOT NULL REFERENCES profiles(id),
  achievement_id UUID NOT NULL REFERENCES achievements(id),
  unlocked_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (kid_id, achievement_id)
);

ALTER TABLE kid_achievements ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- ACTIVITY LOG
-- ============================================================
CREATE TABLE activity_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id    UUID NOT NULL REFERENCES families(id),
  user_id      UUID REFERENCES profiles(id),
  event_type   TEXT NOT NULL CHECK (event_type IN (
                 'task_completed', 'reward_redeemed', 'streak_milestone',
                 'badge_earned', 'level_up', 'points_awarded', 'crush_drop',
                 'task_rejected', 'redemption_rejected', 'redemption_fulfilled'
               )),
  title        TEXT NOT NULL,
  body         TEXT,
  points_delta INT DEFAULT 0,
  metadata     JSONB,
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_profiles_family_id ON profiles(family_id);
CREATE INDEX idx_profiles_username ON profiles(username);
CREATE INDEX idx_tasks_family_id ON tasks(family_id);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_redemptions_kid_id ON redemptions(kid_id);
CREATE INDEX idx_redemptions_status ON redemptions(status);
CREATE INDEX idx_streaks_kid_id ON streaks(kid_id);
CREATE INDEX idx_kid_achievements_kid_id ON kid_achievements(kid_id);
CREATE INDEX idx_activity_log_family_id ON activity_log(family_id);
CREATE INDEX idx_activity_log_user_id ON activity_log(user_id);
CREATE INDEX idx_activity_log_created_at ON activity_log(created_at DESC);

-- ============================================================
-- POSTGRES FUNCTIONS
-- ============================================================

-- Approve a task: atomically update points, lifetime_points, xp, level, streak
CREATE OR REPLACE FUNCTION approve_task(
  p_task_id    UUID,
  p_parent_id  UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_task        tasks%ROWTYPE;
  v_kid         profiles%ROWTYPE;
  v_new_lifetime INT;
  v_new_level   INT;
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
  -- Simple level recalc (full thresholds applied in app; DB stores result)
  v_new_level := calculate_level(v_new_lifetime);

  -- Update task
  UPDATE tasks SET
    status      = 'approved',
    approved_at = now(),
    approved_by = p_parent_id
  WHERE id = p_task_id;

  -- Update kid points
  UPDATE profiles SET
    total_points    = total_points + v_task.points,
    lifetime_points = v_new_lifetime,
    xp              = v_new_lifetime,
    level           = v_new_level,
    last_active     = now()
  WHERE id = v_kid.id;

  -- Log activity
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
END;
$$;

-- Calculate level from lifetime points
CREATE OR REPLACE FUNCTION calculate_level(p_lifetime_points INT)
RETURNS INT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_level INT := 1;
  v_pts   INT := p_lifetime_points;
BEGIN
  -- Levels 1-10 with fixed thresholds
  IF v_pts >= 2500 THEN v_level := 10;
  ELSIF v_pts >= 1900 THEN v_level := 9;
  ELSIF v_pts >= 1400 THEN v_level := 8;
  ELSIF v_pts >= 1000 THEN v_level := 7;
  ELSIF v_pts >= 700  THEN v_level := 6;
  ELSIF v_pts >= 450  THEN v_level := 5;
  ELSIF v_pts >= 250  THEN v_level := 4;
  ELSIF v_pts >= 125  THEN v_level := 3;
  ELSIF v_pts >= 50   THEN v_level := 2;
  ELSE v_level := 1;
  END IF;

  -- Levels 11-15: base 2500 + 700 each
  IF v_pts >= 2500 THEN
    DECLARE
      extra INT := v_pts - 2500;
      chunk INT := 700;
      add   INT := LEAST(FLOOR(extra / chunk)::INT, 5);
    BEGIN
      v_level := v_level + add;
    END;
  END IF;

  -- Levels 16-20: base at 2500 + 5*700 = 6000 + 1000 each
  IF v_pts >= 6000 THEN
    DECLARE
      extra INT := v_pts - 6000;
      chunk INT := 1000;
      add   INT := LEAST(FLOOR(extra / chunk)::INT, 5);
    BEGIN
      v_level := GREATEST(v_level, 15) + add;
    END;
  END IF;

  -- Levels 21+: base at 6000 + 5*1000 = 11000 + 1500 each
  IF v_pts >= 11000 THEN
    DECLARE
      extra INT := v_pts - 11000;
      chunk INT := 1500;
      add   INT := FLOOR(extra / chunk)::INT;
    BEGIN
      v_level := GREATEST(v_level, 20) + add;
    END;
  END IF;

  RETURN GREATEST(v_level, 1);
END;
$$;

-- Redeem a reward: atomically deduct points and create redemption record
CREATE OR REPLACE FUNCTION redeem_reward(
  p_reward_id UUID,
  p_kid_id    UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reward       rewards%ROWTYPE;
  v_kid          profiles%ROWTYPE;
  v_redemption_id UUID;
BEGIN
  SELECT * INTO v_reward FROM rewards WHERE id = p_reward_id FOR UPDATE;
  IF NOT FOUND OR NOT v_reward.is_active THEN
    RAISE EXCEPTION 'Reward not found or inactive';
  END IF;

  IF v_reward.quantity_available IS NOT NULL
     AND v_reward.quantity_redeemed >= v_reward.quantity_available THEN
    RAISE EXCEPTION 'Reward is out of stock';
  END IF;

  SELECT * INTO v_kid FROM profiles WHERE id = p_kid_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kid profile not found';
  END IF;

  IF v_kid.total_points < v_reward.cost_points THEN
    RAISE EXCEPTION 'Insufficient points: have %, need %', v_kid.total_points, v_reward.cost_points;
  END IF;

  -- Deduct points
  UPDATE profiles SET
    total_points = total_points - v_reward.cost_points,
    last_active  = now()
  WHERE id = p_kid_id;

  -- Increment redeemed count
  UPDATE rewards SET
    quantity_redeemed = quantity_redeemed + 1
  WHERE id = p_reward_id;

  -- Create redemption
  INSERT INTO redemptions (reward_id, kid_id, points_spent, status)
  VALUES (p_reward_id, p_kid_id, v_reward.cost_points, 'pending')
  RETURNING id INTO v_redemption_id;

  -- Log activity
  INSERT INTO activity_log (family_id, user_id, event_type, title, body, points_delta, metadata)
  VALUES (
    v_reward.family_id,
    p_kid_id,
    'reward_redeemed',
    'Reward requested: ' || v_reward.title,
    'Spent ' || v_reward.cost_points || ' Crush Points',
    -v_reward.cost_points,
    jsonb_build_object('reward_id', p_reward_id, 'redemption_id', v_redemption_id)
  );

  RETURN v_redemption_id;
END;
$$;

-- Award bonus Crush Drop points (parent gives spontaneous bonus)
CREATE OR REPLACE FUNCTION award_crush_drop(
  p_kid_id    UUID,
  p_parent_id UUID,
  p_points    INT,
  p_reason    TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_kid     profiles%ROWTYPE;
  v_family  UUID;
  v_new_lifetime INT;
  v_new_level    INT;
BEGIN
  SELECT * INTO v_kid FROM profiles WHERE id = p_kid_id FOR UPDATE;
  IF NOT FOUND OR v_kid.role != 'kid' THEN
    RAISE EXCEPTION 'Kid profile not found';
  END IF;

  v_new_lifetime := v_kid.lifetime_points + p_points;
  v_new_level    := calculate_level(v_new_lifetime);
  v_family       := v_kid.family_id;

  UPDATE profiles SET
    total_points    = total_points + p_points,
    lifetime_points = v_new_lifetime,
    xp              = v_new_lifetime,
    level           = v_new_level,
    last_active     = now()
  WHERE id = p_kid_id;

  INSERT INTO activity_log (family_id, user_id, event_type, title, body, points_delta, metadata)
  VALUES (
    v_family,
    p_kid_id,
    'crush_drop',
    'Crush Drop! +' || p_points || ' pts',
    p_reason,
    p_points,
    jsonb_build_object('awarded_by', p_parent_id)
  );
END;
$$;

-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================

-- Helper: get the family_id for the current user
CREATE OR REPLACE FUNCTION get_my_family_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT family_id FROM profiles WHERE id = auth.uid();
$$;

-- Helper: check if current user is a parent
CREATE OR REPLACE FUNCTION is_parent()
RETURNS BOOL
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role = 'parent' FROM profiles WHERE id = auth.uid();
$$;

-- FAMILIES --
CREATE POLICY "family_members_can_read_own_family"
  ON families FOR SELECT
  USING (id = get_my_family_id());

CREATE POLICY "parents_can_update_own_family"
  ON families FOR UPDATE
  USING (id = get_my_family_id() AND is_parent());

-- PROFILES --
CREATE POLICY "family_members_can_read_profiles"
  ON profiles FOR SELECT
  USING (family_id = get_my_family_id());

CREATE POLICY "users_can_update_own_profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "parents_can_update_family_profiles"
  ON profiles FOR UPDATE
  USING (family_id = get_my_family_id() AND is_parent());

CREATE POLICY "users_can_insert_own_profile"
  ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- TASK_TEMPLATES --
CREATE POLICY "anyone_can_read_system_templates"
  ON task_templates FOR SELECT
  USING (family_id IS NULL OR family_id = get_my_family_id());

CREATE POLICY "parents_can_manage_family_templates"
  ON task_templates FOR ALL
  USING (family_id = get_my_family_id() AND is_parent());

-- TASKS --
CREATE POLICY "family_members_can_read_tasks"
  ON tasks FOR SELECT
  USING (family_id = get_my_family_id());

CREATE POLICY "parents_can_manage_tasks"
  ON tasks FOR ALL
  USING (family_id = get_my_family_id() AND is_parent());

CREATE POLICY "kids_can_submit_own_tasks"
  ON tasks FOR UPDATE
  USING (
    family_id = get_my_family_id()
    AND assigned_to = auth.uid()
    AND NOT is_parent()
  );

-- REWARD_TEMPLATES --
CREATE POLICY "anyone_can_read_reward_templates"
  ON reward_templates FOR SELECT
  USING (family_id IS NULL OR family_id = get_my_family_id());

CREATE POLICY "parents_can_manage_reward_templates"
  ON reward_templates FOR ALL
  USING (family_id = get_my_family_id() AND is_parent());

-- REWARDS --
CREATE POLICY "family_members_can_read_rewards"
  ON rewards FOR SELECT
  USING (family_id = get_my_family_id());

CREATE POLICY "parents_can_manage_rewards"
  ON rewards FOR ALL
  USING (family_id = get_my_family_id() AND is_parent());

-- REDEMPTIONS --
CREATE POLICY "kids_can_read_own_redemptions"
  ON redemptions FOR SELECT
  USING (kid_id = auth.uid() OR is_parent());

CREATE POLICY "parents_can_manage_redemptions"
  ON redemptions FOR ALL
  USING (is_parent());

-- STREAKS --
CREATE POLICY "family_members_can_read_streaks"
  ON streaks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = streaks.kid_id
        AND p.family_id = get_my_family_id()
    )
  );

CREATE POLICY "system_can_manage_streaks"
  ON streaks FOR ALL
  USING (TRUE)
  WITH CHECK (TRUE);  -- managed by Edge Functions with service role

-- STREAK_REWARDS --
-- Kids cannot see actual reward content until unlocked (via unlock table)
CREATE POLICY "parents_can_read_streak_rewards"
  ON streak_rewards FOR SELECT
  USING (family_id = get_my_family_id() AND is_parent());

CREATE POLICY "kids_can_see_unlocked_streak_rewards"
  ON streak_rewards FOR SELECT
  USING (
    family_id = get_my_family_id()
    AND NOT is_parent()
    AND EXISTS (
      SELECT 1 FROM streak_reward_unlocks sru
      WHERE sru.streak_reward_id = streak_rewards.id
        AND sru.kid_id = auth.uid()
    )
  );

CREATE POLICY "parents_can_manage_streak_rewards"
  ON streak_rewards FOR ALL
  USING (family_id = get_my_family_id() AND is_parent());

-- STREAK_REWARD_UNLOCKS --
CREATE POLICY "family_members_can_read_unlocks"
  ON streak_reward_unlocks FOR SELECT
  USING (
    kid_id = auth.uid()
    OR is_parent()
  );

-- ACHIEVEMENTS (global table, all can read)
CREATE POLICY "all_can_read_achievements"
  ON achievements FOR SELECT
  USING (TRUE);

-- KID_ACHIEVEMENTS --
CREATE POLICY "family_members_can_read_kid_achievements"
  ON kid_achievements FOR SELECT
  USING (
    kid_id = auth.uid()
    OR is_parent()
  );

-- ACTIVITY_LOG --
CREATE POLICY "family_members_can_read_activity_log"
  ON activity_log FOR SELECT
  USING (family_id = get_my_family_id());
