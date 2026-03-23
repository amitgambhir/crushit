# 💥 CrushIt

**A family task and reward app where kids earn Crush Points by completing real tasks, and spend them on real rewards their parents set.**

![React Native](https://img.shields.io/badge/React_Native-Expo_55-000020?logo=expo) ![Supabase](https://img.shields.io/badge/Backend-Supabase-3FCF8E?logo=supabase) ![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?logo=typescript) ![License](https://img.shields.io/badge/License-MIT-green)

---

## Table of Contents

- [The Problem](#the-problem)
- [What It Does](#what-it-does)
- [Built On](#built-on)
- [Architecture](#architecture)
- [Quickstart](#quickstart)
- [Run Locally](#run-locally)
- [Testing the App End-to-End](#testing-the-app-end-to-end)
- [Running the Test Suite](#running-the-test-suite)
- [Deploy Your Own](#deploy-your-own)
- [Why This Is Different](#why-this-is-different)

---

## The Problem

Chore charts get ignored. Sticker systems fall apart after two weeks. Most "kids task apps" are either too babyish for a 10-year-old or too complicated for a 6-year-old to use without help. The real problem is that the reward feels arbitrary — there's no visible accumulation, no store, no moment of triumph.

CrushIt makes every task completion a small win with a number attached to it, and every reward something the kid actually negotiated for. Parents stay in control; kids stay motivated.

---

## What It Does

Kids earn **Crush Points** by completing tasks assigned by parents. Points accumulate visibly, track a level progression, and redeem against a parent-configured reward store — ice cream trips, screen time, toys, outings. Parents approve completions before points land.

| Role | Core Flow |
|---|---|
| Parent | Create tasks → assign to kids → approve completions → manage reward store |
| Kid | See tasks → mark done (+ optional note) → wait for approval → spend points |

| Feature | Status | Detail |
| --- | --- | --- |
| Task library | Shipped | 60 standard templates across chores, school, health, kindness, creative |
| Reward library | Shipped | 31 standard templates across screen time, food, outings, toys, privileges |
| Point system | Shipped | Spendable `total_points` + never-decremented `lifetime_points` for levels |
| Levels + XP | Shipped | 20+ levels, XP tracked separately; computed by `calculate_level()` Postgres function |
| Kid auth | Shipped | Family name + username + 4-digit PIN; internal email pattern, no real email required |
| Parent PIN lock | Shipped | Optional bcrypt PIN gate on the parent tab bar; set/change via Settings |
| Privacy | Shipped | COPPA/GDPR: consent on sign-up, data export, cascade delete via Edge Function |
| Streaks | Shipped | Daily/weekly/monthly/yearly streaks; `check-streaks` cron Edge Function resets + unlocks milestones |
| Streak milestones | Shipped | Parents configure surprise or revealed rewards at streak thresholds; kids see unlock cards in store |
| Achievements | Shipped | 22 badges seeded in DB; evaluated server-side on every task approval |
| Realtime celebrations | Shipped | Supabase Realtime → confetti + points burst on kid screen when parent approves |
| Push notifications | Shipped | Expo push token registered on boot; `send-notifications` Edge Function dispatches on every `activity_log` event |
| Parent analytics | Shipped | "This Week" card on parent dashboard — per-kid progress bars, completion rate, points awarded |
| Kid editable profile | Shipped | Avatar emoji grid + 12-color accent theme picker |
| Task filters | Shipped | Parent tasks screen: filter by kid and by category |
| Google Sign-In | Phase 3 | Apple Sign-In + email/password live; Google auth deferred |

---

## Built On

| Layer | Choice | Why |
|---|---|---|
| Framework | React Native + Expo SDK 55 | Managed workflow, OTA updates, single codebase for iOS + Android |
| Routing | expo-router v3 (file-based) | Directory structure maps 1:1 to the app's navigation tree |
| Backend | Supabase | Postgres + Auth + Realtime + Storage — no separate API layer needed |
| Styling | NativeWind v4 + custom theme constants | Tailwind tokens keep spacing/color consistent; `constants/theme.ts` is the single source |
| Server state | TanStack Query v5 | Per-query caching and invalidation without a global store for server data |
| Client state | Zustand | Auth session + UI state; kept strictly separate from server data (see AD-008) |
| Forms | react-hook-form + zod | Schema co-located with the screen; no separate schemas directory |
| Point mutations | Postgres SECURITY DEFINER functions | All point/state mutations go through server-side RPCs — caller identity verified via `auth.uid()`, never trusted from the client |
| Edge Functions | Supabase Deno runtime | `create-kid`, `delete-family`, `check-streaks` (streak cron), `send-notifications` (push dispatcher), `generate-recurring-tasks` (recurring task cron) |
| Fonts | `@expo-google-fonts` | Nunito (display), Inter (body), JetBrains Mono (numbers) |

---

## Architecture

```text
┌─────────────────────────────────────────────────────────┐
│                      Expo App                           │
│                                                         │
│  /(auth)          /(parent)              /(kid)         │
│  welcome          index (dashboard)      index          │
│  sign-up          kids/[id]             tasks/[id]      │
│  sign-in          tasks/new             store/          │
│  family-setup     rewards/new           trophies/       │
│  kid-login        settings/             profile/        │
│                                                         │
│  Zustand authStore ──── TanStack Query (hooks/) ─────── │
└────────────────────────┬────────────────────────────────┘
                         │ @supabase/supabase-js
                         │
┌────────────────────────▼────────────────────────────────┐
│                     Supabase                            │
│                                                         │
│  PostgreSQL                                             │
│  ├── families, profiles, tasks, rewards                 │
│  ├── redemptions, streaks, achievements                 │
│  ├── activity_log, task_templates, reward_templates     │
│  ├── approve_task() ─── SECURITY DEFINER RPC            │
│  ├── redeem_reward() ── SECURITY DEFINER RPC            │
│  └── award_crush_drop() SECURITY DEFINER RPC            │
│                                                         │
│  Auth ── kid internal email pattern (AD-012)            │
│  Realtime ── tasks subscription → kid celebration UI    │
│  Storage ── task-proofs bucket (signed URLs, 24h expiry)│
│                                                         │
│  Edge Functions (Deno)                                  │
│  ├── create-kid (admin API, no real email needed)       │
│  ├── delete-family (GDPR cascade, auth + all tables)    │
│  ├── check-streaks (nightly cron — reset + unlock)      │
│  ├── send-notifications (DB webhook → Expo Push API)    │
│  └── generate-recurring-tasks (nightly cron)            │
└─────────────────────────────────────────────────────────┘
```

---

## Quickstart

```bash
git clone https://github.com/[your-username]/crushit
cd crushit
cp .env.example .env  # fill in your Supabase URL and anon key
nvm use               # uses .nvmrc (Node 20)
npm ci
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
npx expo start
```

---

## Run Locally

### Prerequisites

| Tool | Version | Check |
|---|---|---|
| Node.js | 20.x | `node -v` |
| npm | 10.x | `npm -v` |
| Xcode | Latest | iOS Simulator (macOS only) |
| Android Studio | Latest | Android Emulator (optional) |
| Supabase project | Free tier fine | [supabase.com](https://supabase.com) |

### 1. Clone and install

```bash
git clone https://github.com/[your-username]/crushit
cd crushit
npm ci
```

If you use `nvm`, run `nvm use` first so the repo picks up Node 20 from `.nvmrc`.

### 2. Configure environment

```bash
cp .env.example .env
```

Open `.env` and fill in both values from your Supabase project (Settings → API):

```bash
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Your project ref is the `xxxx` portion of the URL — you'll need it in the next step.

This README assumes the app talks to a hosted Supabase project via `.env`. If you later switch the app to a local Supabase stack, update `.env` again and restart Expo with `npx expo start -c`.

### Clean reinstall

If your local environment gets into a weird state, reset from the lockfile instead of layering more installs on top:

```bash
npm run reinstall
```

That removes `node_modules` and `.expo`, then reinstalls exactly from `package-lock.json`.

### 3. Link Supabase and apply migrations

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

This applies all 14 migrations in order: schema → seed data (60 task templates, 31 reward templates, 22 achievements) → helper functions → RPC hardening. Takes ~30 seconds. Verify in the Supabase dashboard → Table Editor that `families`, `profiles`, `tasks`, `rewards`, and `achievements` are all present and populated.

### 4. Set Edge Function secrets

The `create-kid` function uses the Supabase admin API and needs elevated credentials (Settings → API → `service_role` key — keep this secret):

```bash
npx supabase secrets set SUPABASE_URL=https://xxxx.supabase.co
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 5. Deploy Edge Functions

```bash
npx supabase functions deploy create-kid --no-verify-jwt
npx supabase functions deploy delete-family
npx supabase functions deploy check-streaks
npx supabase functions deploy send-notifications
npx supabase functions deploy generate-recurring-tasks
```

Each should return `Deployed Function <name>`. Verify under Supabase dashboard → Edge Functions.

`create-kid` must be deployed with `--no-verify-jwt` because the function verifies the caller inside the handler and uses the service role client for admin auth operations.

> Push notifications require a physical device with Expo Go to receive. The app runs and all other features work on simulator without them.

### 6. Enable Realtime on the tasks table

In the Supabase dashboard → Database → Replication, enable Realtime for the `tasks` table and `activity_log` table. This powers the confetti celebration when a parent approves a task.

### 7. Start the dev server

```bash
npx expo start
```

Press **`i`** to open on iOS Simulator, **`a`** for Android Emulator.

If Metro seems stuck on old assets or env values, restart with:

```bash
npx expo start -c
```

---

## Testing the App End-to-End

Once the app is running, work through this flow to exercise the full stack:

### Create a family (parent)

1. Tap **Create Family** on the welcome screen
2. Enter your name, family name, and a password
3. You land on the parent dashboard

### Add a kid

1. Parent dashboard → **Kids** tab → **Add Kid**
2. Set a display name, username, and 4-digit PIN
3. The `create-kid` Edge Function creates the Supabase auth account server-side

### Sign in as the kid

Open a second device or use Expo Go on a physical device. On the welcome screen tap **Kid Login**, then enter:
- Family name (exact match)
- Username
- PIN

### Run the core loop

| Step | Who | What to expect |
|---|---|---|
| Create a task | Parent | Assign it to the kid; set points |
| Submit the task | Kid | Tap the task → Mark as done (add a note if you like) |
| Approve the task | Parent | Tasks tab → pending submission → Approve |
| Watch the celebration | Kid screen | Confetti burst + points counter via Supabase Realtime |
| Check levels + streaks | Kid dashboard | Points update instantly; streak increments next approval |
| Redeem a reward | Kid | Store tab → pick a reward → Redeem |
| Fulfill the reward | Parent | Redemptions tab → mark as fulfilled |

### Test gamification

- **Streaks:** approve tasks on consecutive days — the streak counter increments and milestone unlocks appear in the kid's store
- **Achievements:** approve enough tasks to hit a badge condition (e.g., 1 task = "First Crush" badge) — the badge appears in the kid's trophies screen
- **Levels:** accumulate `lifetime_points` past a threshold — a level-up notification fires and the kid's level badge updates
- **Crush Drop:** parent dashboard → kid profile → Award Crush Drop — bonus points land on the kid's screen immediately
- **Parent PIN:** Settings → Set Parent PIN — the parent tab bar prompts for PIN on next open

### Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Kid login fails | `create-kid` Edge Function not deployed or secrets missing | Re-deploy the function and re-set secrets |
| No confetti on approval | Realtime not enabled on `tasks` table | Dashboard → Database → Replication → enable `tasks` |
| `supabase link` fails | Wrong project ref format | Use only the ref ID (`xxxx`), not the full URL |
| `db push` errors mid-migration | Schema already partially applied | Check dashboard → SQL Editor and run the failing migration manually |
| Simulator won't open | Simulator not booted | `xcrun simctl boot "iPhone 17 Pro"` then press `i` in Expo |

---

## Running the Test Suite

460 tests across 24 suites — all pure unit/integration tests, no simulator required.

```bash
npm test                  # run all 460 tests
npm run test:watch        # watch mode during development
npm run test:coverage     # coverage report
```

Tests cover:
- All hooks (`useTasks`, `useRewards`, `useAuth`, `useStreaks`, `useAchievements`, etc.)
- Pure library functions (`lib/achievements.ts`, `lib/analytics.ts`, `lib/notifications.ts`, etc.)
- Security invariants — every point mutation asserts it routes through an RPC, never a direct table write
- Edge Function helpers (`send-notifications` routing + payload, `check-streaks`, `generate-recurring-tasks`)

---

## Deploy Your Own

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Copy the project URL and anon key into `.env`
3. Run `npx supabase link --project-ref YOUR_PROJECT_REF`
4. Run `npx supabase db push` to apply all 14 migrations
5. Deploy all Edge Functions:

   ```bash
   npx supabase functions deploy create-kid
   npx supabase functions deploy delete-family
   npx supabase functions deploy check-streaks
   npx supabase functions deploy send-notifications
   npx supabase functions deploy generate-recurring-tasks
   ```

6. Build for iOS: `npx expo build:ios` (requires Apple Developer account, bundle ID `com.yourfamily.crushit`)
7. Update `app.json` with your bundle identifier before submitting to the App Store

---

## Repo Notes

- `.env` is intentionally not committed. Use `.env.example` as the template.
- `ios/` and `android/` are treated as generated native output in this repo. If you need to recreate them locally, run `npx expo prebuild`.
- The spec and checklist docs are included in the repo so contributors can compare product intent vs implementation status.

---

## Why This Is Different

- **Points are server-enforced.** All point mutations route through Postgres `SECURITY DEFINER` RPCs. Caller identity is verified via `auth.uid()` — a kid with a jailbroken device can't inflate their balance by passing an arbitrary parent ID.
- **Kids don't need email addresses.** Authentication uses an internal email pattern (`{username}@{invite_code}.crushit.internal`) with PIN as password, so parents can create accounts for a 6-year-old without a Gmail.
- **Approval is the core loop.** Points only land after a parent approves. This keeps kids honest and gives parents a daily moment of connection — a quick scroll through what their kid actually did.

---

*Built for families where "did you do your homework?" deserves a better answer than a shrug.*
