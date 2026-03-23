-- ============================================================
-- CrushIt — Standard Task Library Seed
-- family_id = NULL means system/global template
-- ============================================================

INSERT INTO task_templates (title, category, icon, default_points, difficulty, estimated_minutes)
VALUES

-- ─── CHORES ───────────────────────────────────────────────────
('Make your bed',               'chores', '🛏️', 5,  'easy',   5),
('Clean your room',             'chores', '🧹', 15, 'medium', 20),
('Vacuum living room',          'chores', '🧹', 20, 'medium', 15),
('Clean bathroom',              'chores', '🚿', 25, 'hard',   25),
('Wash dishes',                 'chores', '🍽️', 15, 'medium', 15),
('Load/unload dishwasher',      'chores', '🫧', 10, 'easy',   10),
('Take out trash',              'chores', '🗑️', 10, 'easy',    5),
('Fold and put away laundry',   'chores', '👕', 20, 'medium', 20),
('Water the plants',            'chores', '🌱', 10, 'easy',    5),
('Feed the pet',                'chores', '🐾', 10, 'easy',    5),
('Walk the dog',                'chores', '🐕', 20, 'medium', 20),
('Sweep/mop kitchen floor',     'chores', '🪣', 20, 'medium', 15),
('Wipe kitchen counters',       'chores', '🧽', 10, 'easy',    5),
('Set the dinner table',        'chores', '🍴', 10, 'easy',    5),
('Clear the dinner table',      'chores', '🍽️', 10, 'easy',    5),
('Clean out car',               'chores', '🚗', 15, 'medium', 15),
('Organize pantry',             'chores', '📦', 25, 'hard',   30),
('Wash windows',                'chores', '🪟', 20, 'hard',   20),
('Rake leaves',                 'chores', '🍂', 25, 'hard',   30),
('Shovel snow',                 'chores', '❄️', 30, 'hard',   30),

-- ─── SCHOOL / STUDY ───────────────────────────────────────────
('Complete homework',           'school', '📖', 20, 'medium', 45),
('Read for 20 minutes',         'school', '📗', 15, 'easy',   20),
('Read for 30 minutes',         'school', '📘', 20, 'medium', 30),
('Practice spelling words',     'school', '✏️', 15, 'medium', 15),
('Study for test',              'school', '🎓', 30, 'hard',   45),
('Practice math flashcards',    'school', '➕', 15, 'medium', 15),
('Write in journal',            'school', '📓', 15, 'easy',   15),
('Complete a worksheet',        'school', '📄', 20, 'medium', 30),
('Watch educational video',     'school', '🎬', 10, 'easy',   20),
('Practice instrument',         'school', '🎵', 20, 'medium', 30),
('No devices during study',     'school', '🚫', 25, 'hard',   60),
('Get 100% on a quiz',          'school', '⭐', 50, 'hard',   NULL),

-- ─── HEALTH & PERSONAL ────────────────────────────────────────
('Brush teeth (morning)',       'health', '🦷',  5, 'easy',   3),
('Brush teeth (night)',         'health', '🦷',  5, 'easy',   3),
('Exercise for 20 min',        'health', '🏃', 20, 'medium', 20),
('Drink 8 glasses of water',   'health', '💧', 10, 'easy',   NULL),
('Go to bed on time',          'health', '🌙', 10, 'easy',   NULL),
('No screen time before bed',  'health', '📵', 15, 'medium', NULL),
('Eat all your vegetables',    'health', '🥦', 10, 'easy',   NULL),
('Take a shower/bath',         'health', '🛁', 10, 'easy',   15),
('Floss teeth',                'health', '🦷',  5, 'easy',   3),

-- ─── KINDNESS & CHARACTER ─────────────────────────────────────
('Help a sibling',                   'kindness', '🤝', 20, 'medium', NULL),
('Say something kind to someone',    'kindness', '💛', 10, 'easy',   NULL),
('Share a toy or game',              'kindness', '🎮', 15, 'easy',   NULL),
('Write a thank you note',           'kindness', '💌', 20, 'medium', 10),
('Help a neighbor',                  'kindness', '🏘️', 25, 'medium', 20),
('No fighting or arguing all day',   'kindness', '☮️', 25, 'hard',   NULL),
('Be patient and wait your turn',    'kindness', '⏳', 15, 'medium', NULL),
('Compliment someone sincerely',     'kindness', '🌟', 10, 'easy',   NULL),

-- ─── CREATIVE / FUN ───────────────────────────────────────────
('Draw or paint something',          'creative', '🎨', 15, 'easy',   30),
('Build something with Legos',       'creative', '🧱', 15, 'easy',   30),
('Cook or bake with a parent',       'creative', '🍳', 25, 'medium', 45),
('Learn a new word',                 'creative', '📖', 10, 'easy',    5),
('Complete a puzzle',                'creative', '🧩', 20, 'medium', 30),
('Write a short story',              'creative', '✍️', 25, 'medium', 30),
('Practice coding',                  'creative', '💻', 20, 'medium', 30);
