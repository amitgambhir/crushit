# HOW TO USE THIS SPEC
This is the full specification for CrushIt. Do NOT try to build everything at once. Work through Development Phases in order. When asked to start, confirm which phase you are working on and list the first 3 files you will create before writing any code.

---

## 📦 PHASE STATUS MAP

Features in this spec are grouped into three delivery phases. When reading any section, check this map to know whether it is already shipped or still on the roadmap.

### Phase 1 — Shipped ✅

Core product loop. All of the following are implemented and passing tests.

| Area | What is shipped |
| --- | --- |
| Auth | Parent email/password sign-up + sign-in; Apple Sign-In (iOS); kid family-name + username + PIN login |
| Family | Create family (generates invite code), join family, invite code displayed in settings |
| Tasks | Parent creates/assigns tasks; kid submits with optional note; parent approves/rejects; points awarded via `approve_task()` RPC |
| Rewards | Parent creates rewards; kid redeems via `redeem_reward()` RPC; parent approves/rejects/fulfils redemptions; rejection refunds via `refund_redemption_points()` RPC |
| Crush Drop | Parent awards bonus points to a kid via `award_crush_drop()` RPC |
| Point model | `total_points` (spendable), `lifetime_points` (monotonic), `level` — all server-enforced |
| Levels | 20+ level thresholds in `calculate_level()` DB function + `constants/levels.ts` mirror |
| Settings | Notification prefs (UI only), privacy links, data export (JSON), delete family account (Edge Function) |
| Kid screens | Task list (To Do / Submitted / Done tabs), task detail + submit, reward store list, trophies summary, profile |
| Privacy/legal | Consent checkbox on sign-up, privacy/terms links, cascade-delete via `delete-family` Edge Function |
| Schema | Migrations 001–008 applied; all RLS policies active |
| Tests | 170 unit + integration tests passing (`npm test`) |

### Phase 2 — Roadmap ⬜

Gamification, automation, and richer UX. **Nothing in this section is built yet.**

| Area | What is planned |
| --- | --- |
| Realtime celebrations | Supabase Realtime subscription on `tasks` — approval triggers confetti + points burst on kid's screen (AD-009) |
| Streak automation | `check-streaks` Edge Function cron (midnight) increments/resets streak counters and unlocks `streak_rewards` |
| Achievement evaluation | `approve_task()` extended to check achievement conditions and insert `kid_achievements` rows |
| Push notifications | `send-notifications` Edge Function triggered by `activity_log` inserts; `lib/notifications.ts` + `hooks/useNotifications.ts` stubs exist |
| Google Sign-In | `supabase.auth.signInWithIdToken({ provider: 'google' })` — Apple and email are live; Google is not |
| Parent PIN lock | Lock the parent section behind a PIN separate from the account password |
| Streak rewards | Mystery reward reveal on milestone; `streak_reward_unlocks` rows; locked placeholder cards (AD-004) |
| Achievement badge UI | `AchievementBadge` component stub exists; grid view on Trophies screen to build |
| Reward detail screen | `app/(kid)/store/[id].tsx` — tap-through detail with description and redeem action |
| Redemption history | Pending/approved/fulfilled history tab on the kid store screen |
| Photo proof | `expo-image-picker` upload to `task-proofs` Storage bucket; signed URL in `tasks.proof_photo_url` (AD-010) |
| Recurring tasks | `generate-recurring-tasks` Edge Function cron creates next pending instance |
| Task filtering | Parent Tasks screen: filter by kid, category, date range |
| Analytics/dashboard | Weekly/monthly completion charts and reward analytics for parents |

### Phase 3 — Future ⬜
Polish, delight, and App Store readiness.

| Area | What is planned |
| --- | --- |
| Celebration animations | Lottie files for confetti, level-up burst, streak milestone (`ConfettiOverlay` stub exists) |
| Crush Drop kid UI | Big visible celebration when parent sends a Crush Drop |
| Family leaderboard | Kid ranking by points/streaks within a family |
| Goal savings | Kids save toward a specific reward over multiple sessions |
| Unlockable themes | Accent colour + avatar unlocks tied to level milestones |
| Seasonal events | Holiday bonus tasks and themed UI overlays |
| Older-kid auth | Optional Apple/Google account linkage for kids 13+ |
| Smart suggestions | ML-based task/reward suggestions based on family history |
| App Store / Play Store | EAS build config, App Store assets, Privacy Nutrition Label, COPPA disclosure |

---

## 🎯 PROJECT OVERVIEW

Build a cross-platform mobile app called **"CrushIt"** for iOS (primary) and Android using **React Native + Expo**. The app gamifies household tasks and personal responsibilities for kids by awarding **"Crush Points"** (brownie points) that can be redeemed for real-world rewards like screen time, ice cream trips, or special outings. Parents act as admins managing tasks and rewards; kids interact with their own personalized dashboard. The core brand feeling: **you crushed that task — now go crush the next one.** Every completion is a win worth celebrating.

---

## 📐 TECH STACK

| Layer | Technology |
|---|---|
| Framework | React Native + Expo SDK 51+ |
| Navigation | expo-router (file-based routing) |
| Backend & Auth | Supabase (PostgreSQL + Auth + Storage + Realtime) |
| Styling | NativeWind (Tailwind for React Native) + custom theme |
| State Management | Zustand |
| Notifications | expo-notifications |
| Image Handling | expo-image-picker + Supabase Storage |
| Auth Providers | Apple Sign-In, Google Sign-In, Email/Password |
| Animations | react-native-reanimated + Lottie animations |
| Icons | expo-vector-icons (Ionicons + MaterialCommunity) |
| Date/Time | date-fns |
| Forms | react-hook-form + zod |

---

## 🗄️ DATABASE SCHEMA (Supabase / PostgreSQL)

Create the following tables with RLS (Row Level Security) enabled on all:

```sql
-- Families
CREATE TABLE families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  invite_code TEXT UNIQUE NOT NULL,        -- 6-character alphanumeric code for family joining
  created_at TIMESTAMPTZ DEFAULT now()
);

-- User Profiles (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  family_id UUID REFERENCES families(id),
  display_name TEXT NOT NULL,
  username TEXT UNIQUE,                    -- kids log in with username
  role TEXT NOT NULL CHECK (role IN ('parent', 'kid')),
  avatar_url TEXT,
  avatar_emoji TEXT DEFAULT '⭐',         -- fallback emoji avatar
  total_points INT DEFAULT 0,              -- "Crush Points" balance (spendable)
  lifetime_points INT DEFAULT 0,           -- never decremented, for level calculation
  level INT DEFAULT 1,
  xp INT DEFAULT 0,
  date_of_birth DATE,
  color_theme TEXT DEFAULT '#6C63FF',      -- per-kid accent color
  created_at TIMESTAMPTZ DEFAULT now(),
  last_active TIMESTAMPTZ DEFAULT now()
);

-- Task Library (standard + family-custom tasks)
CREATE TABLE task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES families(id),  -- NULL = system/standard template
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,                  -- 'chores', 'school', 'personal', 'health', 'creative', 'kindness', 'custom'
  icon TEXT NOT NULL,                      -- emoji icon
  default_points INT NOT NULL DEFAULT 10,
  estimated_minutes INT,
  difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),
  is_active BOOL DEFAULT TRUE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Assigned Tasks (instances of templates assigned to kids)
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id),
  template_id UUID REFERENCES task_templates(id),
  assigned_to UUID REFERENCES profiles(id),   -- NULL = available for anyone to claim
  assigned_by UUID REFERENCES profiles(id),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  icon TEXT NOT NULL,
  points INT NOT NULL,
  due_date TIMESTAMPTZ,
  recurrence TEXT CHECK (recurrence IN ('once', 'daily', 'weekdays', 'weekends', 'weekly', 'monthly')),
  recurrence_day INT,                          -- day of week (0-6) or day of month
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'approved', 'rejected', 'expired')),
  requires_photo_proof BOOL DEFAULT FALSE,
  proof_photo_url TEXT,
  proof_note TEXT,
  completed_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES profiles(id),
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Reward Library
CREATE TABLE reward_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES families(id),     -- NULL = system template
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,                     -- 'screen_time', 'food', 'outing', 'toy', 'privilege', 'experience', 'custom'
  icon TEXT NOT NULL,
  cost_points INT NOT NULL,
  is_active BOOL DEFAULT TRUE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Family Rewards (redeemable rewards set by parents)
CREATE TABLE rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id),
  template_id UUID REFERENCES reward_templates(id),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  icon TEXT NOT NULL,
  cost_points INT NOT NULL,
  available_to UUID[],                         -- NULL = all kids, else specific kid UUIDs
  quantity_available INT,                      -- NULL = unlimited
  quantity_redeemed INT DEFAULT 0,
  is_surprise BOOL DEFAULT FALSE,              -- hidden until unlocked (for streak rewards)
  surprise_reveal_at_points INT,               -- reveal the surprise at this points threshold
  is_active BOOL DEFAULT TRUE,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Redemptions
CREATE TABLE redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reward_id UUID NOT NULL REFERENCES rewards(id),
  kid_id UUID NOT NULL REFERENCES profiles(id),
  points_spent INT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'fulfilled')),
  parent_note TEXT,
  fulfilled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Streaks
CREATE TABLE streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kid_id UUID NOT NULL REFERENCES profiles(id),
  streak_type TEXT NOT NULL CHECK (streak_type IN ('daily', 'weekly', 'monthly', 'yearly')),
  current_streak INT DEFAULT 0,
  longest_streak INT DEFAULT 0,
  last_activity_date DATE,
  streak_start_date DATE,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Special Streak Rewards (weekly/monthly/yearly bonus rewards)
CREATE TABLE streak_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id),
  streak_type TEXT NOT NULL CHECK (streak_type IN ('weekly', 'monthly', 'yearly')),
  required_streak INT NOT NULL,               -- e.g. 4 = 4-week streak
  reward_title TEXT NOT NULL,
  reward_description TEXT,
  bonus_points INT DEFAULT 0,
  is_surprise BOOL DEFAULT TRUE,
  surprise_icon TEXT DEFAULT '🎁',            -- shown before reveal
  actual_icon TEXT,                           -- revealed after unlock
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Streak Reward Unlocks
CREATE TABLE streak_reward_unlocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  streak_reward_id UUID NOT NULL REFERENCES streak_rewards(id),
  kid_id UUID NOT NULL REFERENCES profiles(id),
  unlocked_at TIMESTAMPTZ DEFAULT now(),
  bonus_points_awarded INT DEFAULT 0
);

-- Achievements / Badges
CREATE TABLE achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,                   -- e.g. 'first_task', 'streak_7', 'level_5'
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  badge_color TEXT NOT NULL,
  category TEXT NOT NULL,                     -- 'milestone', 'streak', 'tasks', 'special'
  condition_type TEXT NOT NULL,               -- 'tasks_completed', 'streak_days', 'level_reached', 'points_earned'
  condition_value INT NOT NULL
);

-- Kid Achievement Unlocks
CREATE TABLE kid_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kid_id UUID NOT NULL REFERENCES profiles(id),
  achievement_id UUID NOT NULL REFERENCES achievements(id),
  unlocked_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(kid_id, achievement_id)
);

-- Notifications / Activity Log
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id),
  user_id UUID REFERENCES profiles(id),
  event_type TEXT NOT NULL,                   -- 'task_completed', 'reward_redeemed', 'streak_milestone', 'badge_earned', 'level_up', 'points_awarded'
  title TEXT NOT NULL,
  body TEXT,
  points_delta INT DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 📋 STANDARD TASK LIBRARY

Seed the `task_templates` table (family_id = NULL) with these standard tasks:

### 🏠 Chores
| Title | Icon | Points | Difficulty | Est. Minutes |
|---|---|---|---|---|
| Make your bed | 🛏️ | 5 | easy | 5 |
| Clean your room | 🧹 | 15 | medium | 20 |
| Vacuum living room | 🧹 | 20 | medium | 15 |
| Clean bathroom | 🚿 | 25 | hard | 25 |
| Wash dishes | 🍽️ | 15 | medium | 15 |
| Load/unload dishwasher | 🫧 | 10 | easy | 10 |
| Take out trash | 🗑️ | 10 | easy | 5 |
| Fold and put away laundry | 👕 | 20 | medium | 20 |
| Water the plants | 🌱 | 10 | easy | 5 |
| Feed the pet | 🐾 | 10 | easy | 5 |
| Walk the dog | 🐕 | 20 | medium | 20 |
| Sweep/mop kitchen floor | 🪣 | 20 | medium | 15 |
| Wipe kitchen counters | 🧽 | 10 | easy | 5 |
| Set the dinner table | 🍴 | 10 | easy | 5 |
| Clear the dinner table | 🍽️ | 10 | easy | 5 |
| Clean out car | 🚗 | 15 | medium | 15 |
| Organize pantry | 📦 | 25 | hard | 30 |
| Wash windows | 🪟 | 20 | hard | 20 |
| Rake leaves | 🍂 | 25 | hard | 30 |
| Shovel snow | ❄️ | 30 | hard | 30 |

### 📚 School / Study
| Title | Icon | Points | Difficulty | Est. Minutes |
|---|---|---|---|---|
| Complete homework | 📖 | 20 | medium | 45 |
| Read for 20 minutes | 📗 | 15 | easy | 20 |
| Read for 30 minutes | 📘 | 20 | medium | 30 |
| Practice spelling words | ✏️ | 15 | medium | 15 |
| Study for test | 🎓 | 30 | hard | 45 |
| Practice math flashcards | ➕ | 15 | medium | 15 |
| Write in journal | 📓 | 15 | easy | 15 |
| Complete a worksheet | 📄 | 20 | medium | 30 |
| Watch educational video | 🎬 | 10 | easy | 20 |
| Practice instrument | 🎵 | 20 | medium | 30 |
| No devices during study | 🚫📱 | 25 | hard | 60 |
| Get 100% on a quiz | ⭐ | 50 | hard | — |

### 💪 Health & Personal
| Title | Icon | Points | Difficulty | Est. Minutes |
|---|---|---|---|---|
| Brush teeth (morning) | 🦷 | 5 | easy | 3 |
| Brush teeth (night) | 🦷 | 5 | easy | 3 |
| Exercise for 20 min | 🏃 | 20 | medium | 20 |
| Drink 8 glasses of water | 💧 | 10 | easy | — |
| Go to bed on time | 🌙 | 10 | easy | — |
| No screen time before bed | 📵 | 15 | medium | — |
| Eat all your vegetables | 🥦 | 10 | easy | — |
| Take a shower/bath | 🛁 | 10 | easy | 15 |
| Floss teeth | 🦷 | 5 | easy | 3 |

### 🤝 Kindness & Character
| Title | Icon | Points | Difficulty | Est. Minutes |
|---|---|---|---|---|
| Help a sibling | 🤝 | 20 | medium | — |
| Say something kind to someone | 💛 | 10 | easy | — |
| Share a toy or game | 🎮 | 15 | easy | — |
| Write a thank you note | 💌 | 20 | medium | 10 |
| Help a neighbor | 🏘️ | 25 | medium | 20 |
| No fighting or arguing all day | ☮️ | 25 | hard | — |
| Be patient and wait your turn | ⏳ | 15 | medium | — |
| Compliment someone sincerely | 🌟 | 10 | easy | — |

### 🎨 Creative / Fun
| Title | Icon | Points | Difficulty | Est. Minutes |
|---|---|---|---|---|
| Draw or paint something | 🎨 | 15 | easy | 30 |
| Build something with Legos | 🧱 | 15 | easy | 30 |
| Cook or bake with a parent | 🍳 | 25 | medium | 45 |
| Learn a new word | 📖 | 10 | easy | 5 |
| Complete a puzzle | 🧩 | 20 | medium | 30 |
| Write a short story | ✍️ | 25 | medium | 30 |
| Practice coding | 💻 | 20 | medium | 30 |

---

## 🎁 STANDARD REWARD LIBRARY

Seed `reward_templates` (family_id = NULL):

### 📱 Screen Time
| Title | Icon | Points |
|---|---|---|
| 30 min extra screen time | 📱 | 30 |
| 1 hour extra screen time | 📺 | 55 |
| Pick the family movie tonight | 🎬 | 40 |
| Stay up 30 min late | 🌙 | 35 |
| Skip one chore (parent's choice) | 🙅 | 50 |
| No chores for a day | 🎉 | 100 |

### 🍦 Food & Treats
| Title | Icon | Points |
|---|---|---|
| Trip to Sweet Frog / Ice Cream | 🍦 | 60 |
| Pick dessert tonight | 🍰 | 30 |
| Breakfast for dinner night | 🥞 | 45 |
| Favorite meal for dinner | 🍝 | 60 |
| Baking day (pick what to bake) | 🍪 | 50 |
| Candy from the store | 🍬 | 25 |
| Pizza night | 🍕 | 60 |
| Smoothie of your choice | 🥤 | 20 |

### 🏟️ Outings & Experiences
| Title | Icon | Points |
|---|---|---|
| Trip to the park | 🌳 | 50 |
| Movie at the theater | 🎥 | 120 |
| Mini golf outing | ⛳ | 100 |
| Bowling trip | 🎳 | 100 |
| Trampoline park | 🤸 | 120 |
| Arcade trip | 🕹️ | 100 |
| Pool / Waterpark day | 🏊 | 150 |
| Camping night | ⛺ | 200 |
| Choose a family day trip | 🗺️ | 250 |

### 🎁 Privileges & Special
| Title | Icon | Points |
|---|---|---|
| One-on-one time with Mom | 💗 | 75 |
| One-on-one time with Dad | 💙 | 75 |
| Sleep in a fort/tent in house | 🏕️ | 60 |
| Choose a new book | 📚 | 40 |
| Choose a new toy (budget $10) | 🎁 | 150 |
| Choose a new toy (budget $20) | 🎁 | 250 |
| Invite a friend to sleepover | 🛌 | 200 |
| Pick any game for family night | 🎲 | 50 |
| Wear pajamas all day | 👕 | 30 |
| Be the boss for an hour | 👑 | 40 |
| No vegetables for one meal | 🥦 | 35 |

---

## 🏆 ACHIEVEMENTS / BADGE SYSTEM

Seed the `achievements` table with:

| Key | Title | Icon | Description | Condition |
|---|---|---|---|---|
| first_task | First Steps | 🌟 | Completed your first task! | tasks_completed >= 1 |
| task_5 | On a Roll | 🎯 | Completed 5 tasks | tasks_completed >= 5 |
| task_25 | Task Master | 🔥 | Completed 25 tasks | tasks_completed >= 25 |
| task_100 | Century Club | 💯 | Completed 100 tasks | tasks_completed >= 100 |
| streak_3 | Hat Trick | 🎩 | 3-day task streak | daily_streak >= 3 |
| streak_7 | Week Warrior | ⚔️ | 7-day task streak | daily_streak >= 7 |
| streak_30 | Month Champion | 🏆 | 30-day task streak | daily_streak >= 30 |
| streak_365 | Legend | 👑 | 365-day task streak | daily_streak >= 365 |
| points_100 | Point Collector | 💎 | Earned 100 total points | lifetime_points >= 100 |
| points_500 | Star Saver | ⭐ | Earned 500 total points | lifetime_points >= 500 |
| points_1000 | Super Star | 🌠 | Earned 1,000 total points | lifetime_points >= 1000 |
| points_5000 | Galaxy Brain | 🌌 | Earned 5,000 total points | lifetime_points >= 5000 |
| level_5 | Rising Star | 🚀 | Reached Level 5 | level >= 5 |
| level_10 | Star Captain | 🪐 | Reached Level 10 | level >= 10 |
| level_20 | Galactic Hero | 🦸 | Reached Level 20 | level >= 20 |
| first_redeem | Treat Yourself | 🎁 | Redeemed your first reward | redemptions >= 1 |
| chore_master | Chore Champion | 🏠 | Completed 50 chores | chore_tasks >= 50 |
| scholar | Scholar | 📚 | Completed 50 school tasks | school_tasks >= 50 |
| healthy_habits | Health Hero | 💪 | Completed 30 health tasks | health_tasks >= 30 |
| kindness_star | Kind Heart | 💛 | Completed 20 kindness tasks | kindness_tasks >= 20 |
| weekly_perfect | Perfect Week | ✨ | Complete all tasks in a week | weekly_perfect >= 1 |
| sibling_helper | Team Player | 🤝 | Helped a sibling 10 times | sibling_tasks >= 10 |

---

## 📐 LEVEL SYSTEM

Use a cumulative XP / lifetime Crush Points scale:

| Level | Points Required | Title |
|---|---|---|
| 1 | 0 | Rookie Crusher 🥊 |
| 2 | 50 | Task Tackler 💪 |
| 3 | 125 | Go-Getter ⚡ |
| 4 | 250 | Power Player 🔥 |
| 5 | 450 | Crush Machine 🤖 |
| 6 | 700 | Boss Mode 😎 |
| 7 | 1000 | Unstoppable 🚀 |
| 8 | 1400 | Elite Crusher 🏅 |
| 9 | 1900 | Legend in Training 🌟 |
| 10 | 2500 | Full Legend 🏆 |
| 11–15 | +700 each | Champion Crusher 🥇 |
| 16–20 | +1000 each | Mega Champion 💥 |
| 21+ | +1500 each | Ultimate Crusher 👑 |

---

## 🎯 STREAK SYSTEM

### Daily Streak
- Increment if kid completes ≥ 1 task per calendar day
- Reset to 0 if no task completed (with grace period: 1 missed day per 7-day streak)
- Show animated streak counter on kid dashboard

### Weekly Streak
- Increment if kid completes ≥ 3 tasks in a calendar week (Mon–Sun)
- Parents can configure the minimum weekly threshold (default: 3)

### Monthly Streak
- Increment if weekly streak was maintained for all weeks in a month

### Yearly Streak
- Increment if monthly streak was maintained for all months in a year

### Streak Rewards
- Parents set up streak reward milestones (e.g., 4-week streak → surprise reward)
- Reward is stored as a **surprise** (shows 🎁 icon) until the milestone is hit
- On hitting the milestone: **animated reveal sequence** shows the actual reward with confetti and sound
- Bonus points awarded automatically

---

## 🖥️ APP SCREENS & NAVIGATION

### Auth Flow
- **Splash Screen** — animated logo with stars/galaxy theme
- **Welcome Screen** — "Join a Family" or "Create a Family"
- **Sign Up** — Name, email/password OR Apple/Google SSO
- **Family Setup** — Create family name, optionally add invite code
- **Role Selection** — Am I a Parent or a Kid?
- **Kid Login** — Username + PIN (4-6 digit) or Password (simpler for young kids)

### Parent App (Tab Navigation)

**Tab 1: Dashboard (Home)**
- Family overview — all kids, their points, recent activity
- Today's task completion rate across all kids
- Pending task approvals (badge count on tab)
- Recent activity feed
- Quick-add task button

**Tab 2: Kids**
- List of all kids with avatar, level, points, streak
- Tap kid → Kid Detail:
  - Point balance + lifetime points
  - Level progress bar
  - Current streaks (daily/weekly/monthly/yearly)
  - Task history
  - Badges earned
  - Pending redemptions

**Tab 3: Tasks**
- Sub-tabs: Active | Pending Approval | Completed
- Filter by kid, category, date
- Approve/reject submitted tasks (with photo proof viewer)
- Add new task (floating action button → Task Builder)
- Task Builder: choose kid, template or custom, set points, due date, recurrence, photo proof required

**Tab 4: Rewards**
- Active rewards in the store
- Pending redemption requests (badge count)
- Add/edit rewards
- Streak reward milestones management

**Tab 5: Settings**
- Family profile (name, invite code)
- Manage family members (add/remove)
- Notification preferences
- Task & reward library management
- Streak thresholds
- Parent PIN/lock
- Sign out

### Kid App (Tab Navigation)

**Tab 1: My Crushes (Dashboard)**
- Greeting with avatar + name
- Current **Crush Points** (large, animated counter with fist/lightning icon)
- Level badge + progress to next level
- Active streak indicators (flame for daily, calendar for weekly, etc.)
- "Today's Tasks" — scrollable cards
- Recent badges earned (horizontal scroll)

**Tab 2: My Tasks**
- Sub-tabs: To Do | Done | All
- Task cards with icon, title, points value, due date countdown
- Tap to complete → optionally add photo proof + note → submit for approval
- Overdue tasks highlighted in red
- Completed/approved tasks show green checkmark + points earned

**Tab 3: Reward Store**
- Grid of available rewards with icons, names, point costs
- "Can afford" vs "saving up" visual state
- Tap → Reward Detail with description + redeem button
- Redemption confirmation with points preview
- My Redemptions → pending/approved/fulfilled history
- Streak Rewards section showing locked 🎁 mysteries + progress bars

**Tab 4: My Trophies**
- Level card with title and progress bar
- All badges (earned = full color, locked = grayscale + lock icon)
- Streak record cards (longest ever streaks)
- Points history chart (weekly bar chart)

**Tab 5: My Profile**
- Avatar (tap to change photo or choose emoji)
- Display name
- Username
- Accent color picker
- Stats summary

---

## 🎨 DESIGN SYSTEM & UI/UX

### Design Philosophy
Bold, energetic, and celebratory — but still clean enough for parents to love. Think **Duolingo meets Nike Training Club**: gamified delight with a motivational punch. The app should feel like it's cheering the kid on at every step. Not cartoonish or babyish — cool enough for a 12-year-old, approachable enough for a 5-year-old. Every task completion should feel like a **mic drop moment**.

### Color Palette
```
Primary:     #FF5722  (electric orange — "crush energy")
Secondary:   #FFD600  (lightning yellow — "Crush Points/coins")
Success:     #00C853  (green — task crushed!)
Warning:     #FF9800  (amber — due soon, streak at risk)
Danger:      #FF1744  (red — overdue, expired)
Background:  #0F0F0F  (near black — bold, punchy dark mode)
Surface:     #1C1C1C  (dark cards)
Surface2:    #2A2A2A  (elevated cards)
Text:        #FFFFFF  (primary text)
TextMuted:   #9E9E9E  (secondary text)
Accent:      Per-kid color (set by parent/kid from palette of 12 bold colors)
```

Support both **dark mode (default)** and **light mode**.

### Typography
```
Display Font:    Nunito (rounded, friendly, great for kids)
Body Font:       Inter
Mono:            JetBrains Mono (for points/numbers)
```
Use these via `@expo-google-fonts`.

### Component Library (build custom, no external UI kit)
- **CrushBadge** — animated fist/lightning bolt + point number, pulses and "crushes" on update
- **TaskCard** — category icon, title, points chip, due date, status pill
- **RewardCard** — icon, title, cost chip, "I want this!" affordability state
- **StreakBadge** — flame icon, count, color by streak type
- **LevelBar** — current level, XP bar, next level preview
- **AchievementBadge** — icon, title, color, unlock animation
- **KidAvatar** — photo or emoji, level ring, accent color border
- **ConfettiOverlay** — full-screen confetti on task approval / reward unlock / level up
- **SurpriseReveal** — gift box → animated open → reward reveal
- **ApprovalCard** — parent task approval with photo proof, approve/reject buttons
- **PointsCounter** — smooth animated number roller

### Animations (react-native-reanimated)
- Points counter: smooth number rollup when points change
- Level-up: full-screen celebration with particle effects
- Badge unlock: zoom in + glow + shake
- Streak milestone: flame animation grows and pulses
- Surprise reveal: 3-2-1 countdown → box shakes → opens → confetti
- Task completion: checkmark draws itself + point burst
- Daily login: star "falls" into the kid's collection

---

## 🔔 NOTIFICATIONS

Use `expo-notifications` for:
- Task reminders (1 hour before due, on due date)
- Task approved by parent → kid notified with points earned
- Task rejected → kid notified with reason
- Redemption approved → kid notified
- Streak at risk (if no task done by 7pm)
- Streak milestone reached
- Level up
- New task assigned
- Weekly summary for parents (Sunday evening — completion rates per kid)

---

## 🔐 AUTHENTICATION & SECURITY

- **Parents**: Full auth (Apple/Google SSO or email/password), can set a **Parent PIN** (4-6 digit) to lock parent sections
- **Kids**: Created by parents — assigned a display name, username, and PIN. Kid logs in with username + PIN (simple, fast). Optionally link to Apple/Google for older kids.
- **Family Invite Code**: 6-character code for adding additional devices or second parent
- **RLS (Row Level Security)**: 
  - Profiles can only read/write their own family's data
  - Kids cannot read `streak_rewards` content until unlocked
  - Kids cannot modify task points or create rewards
  - Parents can read all family data

---

## 📁 PROJECT STRUCTURE

```
/app
  /(auth)
    _layout.tsx
    welcome.tsx
    sign-in.tsx
    sign-up.tsx
    family-setup.tsx
    kid-login.tsx
  /(parent)
    _layout.tsx           ← parent tab navigator
    index.tsx             ← Dashboard
    kids/
      index.tsx
      [id].tsx            ← Kid Detail
    tasks/
      index.tsx
      new.tsx             ← Task Builder
      [id].tsx
    rewards/
      index.tsx
      new.tsx
    settings/
      index.tsx
  /(kid)
    _layout.tsx           ← kid tab navigator
    index.tsx             ← My Stars Dashboard
    tasks/
      index.tsx
      [id].tsx
    store/
      index.tsx
      [id].tsx
    trophies/
      index.tsx
    profile/
      index.tsx
/components
  ui/
    PointsBadge.tsx
    TaskCard.tsx
    RewardCard.tsx
    StreakBadge.tsx
    LevelBar.tsx
    AchievementBadge.tsx
    KidAvatar.tsx
    ConfettiOverlay.tsx
    SurpriseReveal.tsx
    ApprovalCard.tsx
    PointsCounter.tsx
    Button.tsx
    Card.tsx
    Input.tsx
    Modal.tsx
    Skeleton.tsx
  layout/
    TabBar.tsx
    Header.tsx
    SafeArea.tsx
/hooks
  useAuth.ts
  useFamily.ts
  useTasks.ts
  useRewards.ts
  useStreaks.ts
  useAchievements.ts
  useNotifications.ts
/store
  authStore.ts
  familyStore.ts
  taskStore.ts
  rewardStore.ts
/lib
  supabase.ts
  notifications.ts
  achievements.ts        ← achievement checking engine
  streaks.ts             ← streak update logic
  levels.ts              ← XP / leveling logic
  points.ts              ← points delta calculations
/constants
  theme.ts
  tasks.ts               ← standard task library seed data
  rewards.ts             ← standard reward library seed data
  achievements.ts        ← all badge definitions
  levels.ts              ← level thresholds
/assets
  animations/            ← Lottie JSON files
    confetti.json
    star-burst.json
    level-up.json
    fire-streak.json
    gift-open.json
/supabase
  migrations/
    001_initial_schema.sql
    002_seed_tasks.sql
    003_seed_rewards.sql
    004_seed_achievements.sql
  functions/
    check-streaks/        ← Edge Function: daily cron job
    send-notifications/   ← Edge Function: notification dispatcher
```

---

## ⚡ KEY BUSINESS LOGIC

### Task Completion Flow
1. Kid marks task as complete (optionally adds photo + note)
2. Status → `submitted`
3. Parent receives notification + in-app alert (badge on Tasks tab)
4. Parent reviews (photo if required), approves or rejects with note
5. On approval:
   - `tasks.status` → `approved`
   - `profiles.total_points` += task.points
   - `profiles.lifetime_points` += task.points (never decremented)
   - XP += task.points
   - Recalculate level
   - Update daily streak
   - Check achievement triggers
   - Log to `activity_log`
   - Push notification to kid
   - Animate: confetti + points burst on kid's screen (via Supabase Realtime subscription)
6. On rejection:
   - `tasks.status` → `rejected`
   - Store rejection_reason
   - Push notification to kid

### Recurring Task Generation
- Use Supabase Edge Function (daily cron at midnight) to generate next instance of recurring tasks
- Edge Function: check all `recurrence != 'once'` tasks for the family, generate next `pending` task

### Points Redemption Flow
1. Kid requests redemption from Reward Store
2. Validate kid has enough points
3. Deduct points: `total_points` -= reward.cost_points (but NOT lifetime_points)
4. Create `redemptions` record with `status = 'pending'`
5. Parent notified
6. Parent approves (or rejects with reason)
7. On approval → mark as `fulfilled` when delivered in real life
8. If reward has limited quantity, decrement `quantity_available`

### Streak Checking (Daily Edge Function)
```
For each kid in all families:
  - Check if any task was approved yesterday
  - If yes: increment daily streak, update longest if needed
  - If no: if kid has streak grace (1 per 7-day window): don't reset, consume grace
  - If no and no grace: reset streak to 0
  - Check weekly streak (end of Sunday)
  - Check monthly streak (end of last day of month)
  - Check if any streak_rewards thresholds hit
  - If yes and it's a surprise reward: unlock + trigger reveal notification
```

### Achievement Checking
After every task approval, redemption, or level-up, run `checkAchievements(kidId)`:
- Query kid's current stats
- Compare against all achievement conditions
- Insert any newly met achievements into `kid_achievements`
- Trigger badge unlock animation via Realtime

---

## 🧩 ADDITIONAL FEATURES TO IMPLEMENT

### 1. Family Leaderboard
- Weekly leaderboard among siblings (resets every Sunday)
- Shows ranking, **Crush Points** earned that week, task count
- 🥇🥈🥉 podium UI for top 3
- Fun, not stressful — frame it as "Crush of the Week" not raw competition

### 2. Bonus Crush Drops
- Parents can give spontaneous **"Crush Drop"** — award bonus points with a custom reason (e.g., "Amazing attitude today! +20 💥")
- Shows as an explosion/fist-bump animation on kid's screen

### 3. Task Bidding (for teens)
- Parents can post "up for grabs" tasks (not assigned to any specific kid)
- Any kid can claim it first
- Good for optional bonus tasks

### 4. Goal Savings
- Kid can "save toward" a specific reward
- Progress bar on reward card shows how close they are
- Option to lock points for a goal (can't be spent elsewhere)

### 5. Family Feed / Chat
- Simple in-app activity feed showing family activity
- Parents can react with emoji to a kid's completed task
- Celebration comments (not full messaging, keep it safe/simple)

### 6. Smart Suggestions
- Based on past patterns, suggest tasks for parents ("Jamie usually makes their bed daily — add it as recurring?")
- Suggest reward categories based on redemption history

### 7. Parent Dashboard Analytics
- Weekly/monthly charts: tasks completed per kid, points earned, redemptions
- Completion rate by category
- Most popular rewards
- Kid progress over time

### 8. Parental Controls
- Parent PIN required to access parent sections on shared devices
- Separate "kid lock" mode that disables switching to parent view
- Time restrictions (app available 7am–9pm for kids, configurable)

### 9. Themes & Customization
- Kids can unlock cosmetic themes for their dashboard with points (e.g., "Ocean Theme", "Space Theme", "Rainbow Theme") — purely cosmetic, fun way to spend a few points
- Each theme changes colors, background patterns, icon set

### 10. Seasonal Events
- Holiday-themed bonus tasks and rewards (Halloween, Christmas, Thanksgiving)
- Limited-time achievement badges ("Summer Star 2025")
- These can be triggered manually by parents

---

## 🔏 PRIVACY POLICY & LEGAL INTEGRATION

### Privacy Policy Hosting
Host the privacy policy at a public URL: `https://crushitapp.com/privacy`
During development, use a GitHub Pages or Notion public page as a placeholder URL.

### In-App Privacy Policy Integration

Add the following to these locations in the app:

**1. Sign-Up Screen — Consent Checkbox (required before account creation)**
```tsx
// components/legal/PrivacyConsent.tsx
<View style={styles.consentRow}>
  <Checkbox
    value={hasAgreed}
    onValueChange={setHasAgreed}
    color={hasAgreed ? '#FF5722' : undefined}
  />
  <Text style={styles.consentText}>
    I agree to the{' '}
    <Text
      style={styles.link}
      onPress={() => Linking.openURL('https://crushitapp.com/privacy')}
    >
      Privacy Policy
    </Text>
    {' '}and confirm I am the parent or guardian of any children I add.
  </Text>
</View>
// "Create Account" button is DISABLED until hasAgreed === true
```

**2. Settings → Privacy & Legal section**
```tsx
<SettingsSection title="Privacy & Legal">
  <SettingsRow
    icon="shield-checkmark"
    label="Privacy Policy"
    onPress={() => Linking.openURL('https://crushitapp.com/privacy')}
  />
  <SettingsRow
    icon="document-text"
    label="Terms of Service"
    onPress={() => Linking.openURL('https://crushitapp.com/terms')}
  />
  <SettingsRow
    icon="trash"
    label="Delete Family Account"
    destructive
    onPress={() => router.push('/settings/delete-account')}
  />
  <SettingsRow
    icon="download"
    label="Export My Data"
    onPress={() => router.push('/settings/export-data')}
  />
</SettingsSection>
```

**3. Delete Account Screen — /settings/delete-account (COPPA/GDPR required)**
- Warning message explaining the action is permanent and irreversible
- Lists exactly what will be deleted: all profiles, tasks, photos, points, redemption history
- Requires parent to type "DELETE" to confirm
- Calls Supabase Edge Function `delete-family` which cascade-deletes all family data
- Shows success confirmation, then signs out all devices

**4. Data Export Screen — /settings/export-data (GDPR required)**
- Generates a full JSON export of all family data on demand
- Includes: profiles, tasks, rewards, redemptions, activity log
- Triggers a download of a timestamped `.json` file
- Clearly labels what is and is not included in the export

**5. Kid Login Screen**
```tsx
// Unobtrusive static note at bottom — no interaction needed for kids
<Text style={styles.privacyNote}>
  Your privacy is protected · crushitapp.com/privacy
</Text>
```

### App Store Privacy Nutrition Label (declare when submitting)

| Category | Data Collected | Linked to User | Used for Tracking |
|---|---|---|---|
| Contact Info | Parent email only | Yes | No |
| Identifiers | Internal user ID | Yes | No |
| Usage Data | Anonymized app interactions | No | No |
| User Content | Task proof photos (encrypted) | Yes | No |
| Location | ❌ Not collected | — | — |
| Health | ❌ Not collected | — | — |
| Financial | ❌ Not collected | — | — |
| Browsing History | ❌ Not collected | — | — |

---

## 🚀 DEVELOPMENT PHASES

### Phase 1 — MVP (Build First)
- [ ] Supabase project setup + schema migration + seed data
- [ ] Expo project scaffold with expo-router
- [ ] Auth flow (email/password + Apple Sign-In)
- [ ] Family creation + kid account creation by parent
- [ ] Parent tab app (Dashboard, Tasks, Rewards, Kids)
- [ ] Kid tab app (Dashboard, Tasks, Store, Profile)
- [ ] Task CRUD + approval workflow
- [ ] Reward CRUD + redemption workflow
- [ ] Points system (earn + spend)
- [ ] Basic daily streak tracking
- [ ] Privacy Policy consent checkbox on sign-up
- [ ] Privacy & Legal section in Settings (with policy link)
- [ ] Delete Family Account screen (cascade delete, type "DELETE" to confirm)
- [ ] Data Export screen (JSON download)

### Phase 2 — Gamification
- [ ] Level system + XP
- [ ] Achievement badges
- [ ] Weekly/monthly/yearly streaks
- [ ] Streak surprise rewards + reveal animation
- [ ] Confetti + celebration animations
- [ ] Leaderboard
- [ ] Bonus Star Drops by parents

### Phase 3 — Polish & Advanced
- [ ] Photo proof upload + viewer
- [ ] Recurring task auto-generation (Edge Function cron)
- [ ] Goal savings feature
- [ ] Analytics dashboard for parents
- [ ] Cosmetic themes for kids
- [ ] Google Sign-In
- [ ] Seasonal events
- [ ] App Store submission (iOS) + Play Store (Android)

---

## 🔧 ENVIRONMENT SETUP

```bash
# Install Expo CLI
npx create-expo-app@latest crushit --template expo-template-blank-typescript

# Install dependencies
npx expo install expo-router expo-notifications expo-image-picker expo-auth-session
npx expo install @supabase/supabase-js @react-native-async-storage/async-storage
npx expo install react-native-reanimated react-native-gesture-handler
npx expo install @expo-google-fonts/nunito @expo-google-fonts/inter
npm install zustand react-hook-form zod date-fns nativewind
npm install @expo/vector-icons lottie-react-native

# Supabase
npm install supabase --save-dev
npx supabase init
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

### app.json additions
```json
{
  "expo": {
    "name": "CrushIt",
    "slug": "crushit",
    "scheme": "crushit",
    "plugins": [
      "expo-router",
      "expo-notifications",
      "expo-image-picker",
      [
        "expo-build-properties",
        { "ios": { "deploymentTarget": "15.0" } }
      ]
    ],
    "ios": {
      "usesAppleSignIn": true,
      "bundleIdentifier": "com.yourfamily.crushit"
    },
    "android": {
      "package": "com.yourfamily.crushit"
    }
  }
}
```

---

## 📌 IMPORTANT IMPLEMENTATION NOTES

1. **Realtime Updates**: Use Supabase Realtime subscriptions so when a parent approves a task, the kid's screen updates and shows the celebration animation instantly without polling.

2. **Offline Support**: Cache tasks and profile data locally with AsyncStorage. Queue task completions locally if offline and sync when back online.

3. **Kids UI vs Parents UI**: The router should detect the user's role on login and redirect to `/(kid)` or `/(parent)` accordingly. Include a `useRole()` hook.

4. **Security**: Never expose parent-only data to kid tokens. Use Supabase RLS policies that check `role = 'parent'` for sensitive operations. All point modifications must go through server-side logic (Edge Functions or Postgres functions) to prevent client-side manipulation.

5. **Photo Proof**: Upload to Supabase Storage bucket `task-proofs`. Generate signed URLs with 24-hour expiry for parent review. Compress images client-side before upload (max 800px, 80% quality).

6. **Kid PIN Login**: Store hashed PIN in profiles table. For young kids (under 8), offer emoji-PIN option — pick 4 emojis in sequence instead of numbers.

7. **Accessibility**: Support Dynamic Type (font scaling). Ensure all interactive elements are ≥ 44pt touch targets. Include haptic feedback on key interactions (task complete, points earned).

8. **State Management Pattern**: Zustand stores for auth/profile, tasks, rewards. React Query (TanStack Query) for server data fetching and caching. Keep them separate.

9. **App Name & Branding**: **CrushIt** — the feeling of crushing a task and owning it. Logo: a bold lightning bolt breaking through a checkmark. Tagline: *"Crush tasks. Earn rewards. Repeat."* Sound design: a satisfying crunch/thud sound effect when a task is marked complete. Mascot option: a small fierce monster named **Crush** (think Duolingo owl but punchy).

---

## 🎓 FINAL INSTRUCTION TO CLAUDE CODE

Start by:
1. Creating the Supabase schema migrations and seed files
2. Scaffolding the Expo project with the directory structure above
3. Implementing the Supabase client and auth hooks
4. Building the auth flow (welcome → sign up → family setup)
5. Then implement parent dashboard → task management → reward management
6. Then implement kid dashboard → tasks view → reward store
7. Then layer in the gamification (points animations, streaks, badges, levels)

At each step, prioritize a **working, testable feature** over perfection. Use placeholder Lottie animations if real ones aren't ready. Comment all business logic clearly.

The app should feel like a **premium, delightful product** — not a school project. Every transition should be smooth, every interaction should have haptic + visual feedback, and every kid interaction should feel celebratory.

**Build this as if a family is going to use it starting tomorrow. Every kid who opens CrushIt should feel like a champion.**
