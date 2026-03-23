-- ============================================================
-- CrushIt — Achievements / Badge System Seed
-- ============================================================

INSERT INTO achievements (key, title, description, icon, badge_color, category, condition_type, condition_value)
VALUES

-- ─── TASK MILESTONES ──────────────────────────────────────────
('first_task',    'First Steps',      'Completed your first task!',    '🌟', '#FFD600', 'milestone', 'tasks_completed', 1),
('task_5',        'On a Roll',        'Completed 5 tasks',              '🎯', '#FF9800', 'tasks',     'tasks_completed', 5),
('task_25',       'Task Master',      'Completed 25 tasks',             '🔥', '#FF5722', 'tasks',     'tasks_completed', 25),
('task_100',      'Century Club',     'Completed 100 tasks',            '💯', '#E91E63', 'tasks',     'tasks_completed', 100),

-- ─── STREAK BADGES ────────────────────────────────────────────
('streak_3',      'Hat Trick',        '3-day task streak',              '🎩', '#9C27B0', 'streak', 'streak_days', 3),
('streak_7',      'Week Warrior',     '7-day task streak',              '⚔️', '#673AB7', 'streak', 'streak_days', 7),
('streak_30',     'Month Champion',   '30-day task streak',             '🏆', '#3F51B5', 'streak', 'streak_days', 30),
('streak_365',    'Legend',           '365-day task streak',            '👑', '#1976D2', 'streak', 'streak_days', 365),

-- ─── POINTS MILESTONES ────────────────────────────────────────
('points_100',    'Point Collector',  'Earned 100 total points',        '💎', '#0097A7', 'milestone', 'points_earned', 100),
('points_500',    'Star Saver',       'Earned 500 total points',        '⭐', '#00796B', 'milestone', 'points_earned', 500),
('points_1000',   'Super Star',       'Earned 1,000 total points',      '🌠', '#388E3C', 'milestone', 'points_earned', 1000),
('points_5000',   'Galaxy Brain',     'Earned 5,000 total points',      '🌌', '#1565C0', 'milestone', 'points_earned', 5000),

-- ─── LEVEL BADGES ─────────────────────────────────────────────
('level_5',       'Rising Star',      'Reached Level 5',                '🚀', '#F57F17', 'milestone', 'level_reached', 5),
('level_10',      'Star Captain',     'Reached Level 10',               '🪐', '#E65100', 'milestone', 'level_reached', 10),
('level_20',      'Galactic Hero',    'Reached Level 20',               '🦸', '#BF360C', 'milestone', 'level_reached', 20),

-- ─── REDEMPTION ───────────────────────────────────────────────
('first_redeem',  'Treat Yourself',   'Redeemed your first reward',     '🎁', '#AD1457', 'milestone', 'redemptions', 1),

-- ─── CATEGORY SPECIALISTS ─────────────────────────────────────
('chore_master',  'Chore Champion',   'Completed 50 chores',            '🏠', '#5D4037', 'tasks', 'chore_tasks',    50),
('scholar',       'Scholar',          'Completed 50 school tasks',      '📚', '#1A237E', 'tasks', 'school_tasks',   50),
('healthy_habits','Health Hero',      'Completed 30 health tasks',      '💪', '#1B5E20', 'tasks', 'health_tasks',   30),
('kindness_star', 'Kind Heart',       'Completed 20 kindness tasks',    '💛', '#F9A825', 'tasks', 'kindness_tasks', 20),

-- ─── SPECIAL ──────────────────────────────────────────────────
('weekly_perfect','Perfect Week',     'Complete all tasks in a week',   '✨', '#6A1B9A', 'special', 'weekly_perfect',  1),
('sibling_helper','Team Player',      'Helped a sibling 10 times',      '🤝', '#00695C', 'special', 'sibling_tasks',  10);
