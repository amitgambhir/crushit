-- ============================================================
-- CrushIt — Standard Reward Library Seed
-- family_id = NULL means system/global template
-- ============================================================

INSERT INTO reward_templates (title, category, icon, cost_points)
VALUES

-- ─── SCREEN TIME ──────────────────────────────────────────────
('30 min extra screen time',         'screen_time', '📱',  30),
('1 hour extra screen time',         'screen_time', '📺',  55),
('Pick the family movie tonight',    'screen_time', '🎬',  40),
('Stay up 30 min late',              'screen_time', '🌙',  35),
('Skip one chore (parent''s choice)','privilege',   '🙅',  50),
('No chores for a day',              'privilege',   '🎉', 100),

-- ─── FOOD & TREATS ────────────────────────────────────────────
('Trip to Sweet Frog / Ice Cream',   'food', '🍦',  60),
('Pick dessert tonight',             'food', '🍰',  30),
('Breakfast for dinner night',       'food', '🥞',  45),
('Favorite meal for dinner',         'food', '🍝',  60),
('Baking day (pick what to bake)',   'food', '🍪',  50),
('Candy from the store',             'food', '🍬',  25),
('Pizza night',                      'food', '🍕',  60),
('Smoothie of your choice',          'food', '🥤',  20),

-- ─── OUTINGS & EXPERIENCES ────────────────────────────────────
('Trip to the park',                 'outing', '🌳',  50),
('Movie at the theater',             'outing', '🎥', 120),
('Mini golf outing',                 'outing', '⛳', 100),
('Bowling trip',                     'outing', '🎳', 100),
('Trampoline park',                  'outing', '🤸', 120),
('Arcade trip',                      'outing', '🕹️', 100),
('Pool / Waterpark day',             'outing', '🏊', 150),
('Camping night',                    'experience', '⛺', 200),
('Choose a family day trip',         'experience', '🗺️', 250),

-- ─── PRIVILEGES & SPECIAL ─────────────────────────────────────
('One-on-one time with Mom',         'privilege', '💗',  75),
('One-on-one time with Dad',         'privilege', '💙',  75),
('Sleep in a fort/tent in house',    'privilege', '🏕️',  60),
('Choose a new book',                'privilege', '📚',  40),
('Choose a new toy (budget $10)',     'toy',       '🎁', 150),
('Choose a new toy (budget $20)',     'toy',       '🎁', 250),
('Invite a friend to sleepover',     'privilege', '🛌', 200),
('Pick any game for family night',   'privilege', '🎲',  50),
('Wear pajamas all day',             'privilege', '👕',  30),
('Be the boss for an hour',          'privilege', '👑',  40),
('No vegetables for one meal',       'privilege', '🥦',  35);
