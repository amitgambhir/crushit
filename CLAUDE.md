# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Key Reference Documents

| Document | Purpose |
| --- | --- |
| `DESIGN.md` | Design system — colors, typography, spacing, components, animation, asset specs. **Update this file whenever branding or design decisions change.** |
| `SPEC_VS_CODE_CHECKLIST.md` | Feature spec vs implementation status tracker |

---

## What This Project Is

**CrushIt** — a cross-platform family task & reward app (iOS primary, Android secondary).
Kids earn "Crush Points" by completing tasks approved by parents. Points redeem for real-world rewards.

---

## Development Phases

| Phase | Session | Status | Description |
| --- | --- | --- | --- |
| 1 | 1 | ✅ Done | Supabase schema migrations + seed data |
| 1 | 2 | ✅ Done | Expo project scaffold + full auth flow |
| 1 | 3 | ✅ Done | Parent dashboard + task management + all settings screens |
| 2 | 2.1 | ✅ Done | Gamification foundation: levels, XP, achievements, streaks DB layer |
| 2 | 2.2 | ✅ Done | Kid dashboard: Realtime celebrations, ConfettiOverlay, Crush Drop |
| 2 | 2.3 | ✅ Done | check-streaks Edge Function + streak reward unlocks |
| 2 | 2.4 | ✅ Done | Push notifications (token + dispatcher) + Parent PIN lock + task kid/category filter |
| 2 | 2.5 | ✅ Done | Parent analytics, kid editable profile, kid streak rewards tab |
| 2 | 2.6 | ✅ Done | Streak milestone management UI, SPEC checklist + CLAUDE.md updated |
| 3 | — | ⬜ | Polish, photo proof, recurring tasks, App Store |

### App Store Submission Tracking

Full App Store readiness checklist is maintained in `SPEC_VS_CODE_CHECKLIST.md` § **P7 - App Store Submission Checklist**. Covers account setup, code changes, App Store Connect metadata, and build/submit steps. Update status there as items are completed.

### Known Phase 3 gaps (deferred by design)

| Area | What's missing | Where to build it |
| --- | --- | --- |
| Auth | Google Sign-In — deferred to Phase 3 (email + Apple are live) | New screen + `supabase.auth.signInWithIdToken({ provider: 'google' })` |
| Kid store | Reward detail screen (`app/(kid)/store/[id].tsx`), redemption history tab | `app/(kid)/store/[id].tsx` + history tab in `app/(kid)/store/index.tsx` |
| Kid trophies | Achievement badge grid (earned vs locked), points history chart | `app/(kid)/trophies/index.tsx` expansion + `useAchievements` hook wiring |
| Photo proof | Client compress → Storage upload → signed URL → parent viewer in approval flow | `app/(kid)/tasks/[id].tsx` upload + `ApprovalCard` viewer |
| Recurring tasks | `generate-recurring-tasks` Edge Function + cron | `supabase/functions/generate-recurring-tasks/index.ts` |
| Celebrations | `SurpriseReveal`, `PointsCounter`, level-up animation | Phase 3 gamification polish |
| App Store | Icons, splash, metadata, privacy manifest | Phase 3 |

---

## Tech Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | React Native + Expo SDK 51+ | Cross-platform, managed workflow, OTA updates |
| Routing | expo-router (file-based) | Matches SPEC directory structure exactly |
| Backend | Supabase | PostgreSQL + Auth + Realtime + Storage in one |
| Styling | NativeWind (Tailwind for RN) | Consistent design tokens, fast iteration |
| State | Zustand (client) + TanStack Query (server) | Kept separate per SPEC note §8 |
| Animations | react-native-reanimated + Lottie | Smooth 60fps; Lottie for celebration sequences |
| Forms | react-hook-form + zod | Validation at form layer, not ad hoc |

---

## Commands

```bash
# Install dependencies
npm install

# Start Expo dev server
npx expo start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Apply migrations to linked Supabase project
npx supabase db push

# Start local Supabase (requires Docker)
npx supabase start

# Deploy an Edge Function
npx supabase functions deploy <function-name>
```

---

## File Structure Notes

Follows the SPEC exactly. Key conventions:

- `/(auth)` — unauthenticated screens
- `/(parent)` — parent tab app (redirected to if `role = 'parent'`)
- `/(kid)` — kid tab app (redirected to if `role = 'kid'`)
- `/lib` — pure logic (no React), imported by both app and Edge Functions where possible
- `/constants` — static data that mirrors DB seed values (used for UI without extra queries)
- `/supabase/migrations` — numbered SQL files, applied in order via `supabase db push`
- `/supabase/functions` — Edge Functions (Deno runtime)

---

## Architectural Decisions

### AD-001 — All point mutations go through Postgres functions

**Decision:** Never mutate `total_points`, `lifetime_points`, `xp`, or `level` from the client directly. All changes route through server-side Postgres functions: `approve_task()`, `redeem_reward()`, `award_crush_drop()`.

**Why:** SPEC explicitly requires this to prevent client-side manipulation. Postgres functions run with `SECURITY DEFINER` and enforce business rules atomically.

**Affects:** Any feature that changes a kid's points must call the RPC, not update the table directly.

### AD-002 — `calculate_level()` is a Postgres IMMUTABLE function

**Decision:** Level thresholds live in a single `calculate_level(lifetime_points INT)` Postgres function, mirrored in `/constants/levels.ts` for UI display only.

**Why:** Level must always be consistent with `lifetime_points`. Computing it in the DB inside `approve_task()` means there's no race condition or drift between client and server state.

**Mirror:** Keep `/constants/levels.ts` in sync manually if thresholds change.

### AD-003 — `streaks` table has UNIQUE(kid_id, streak_type)

**Decision:** One row per kid per streak type (daily/weekly/monthly/yearly), enforced at the DB level.

**Why:** The Edge Function cron uses upsert (`ON CONFLICT DO UPDATE`) — this prevents duplicate streak rows from parallel runs or retries.

### AD-004 — Kids cannot read `streak_rewards` content until unlocked

**Decision:** RLS on `streak_rewards` blocks kids from reading rows unless there's a matching entry in `streak_reward_unlocks`.

**Why:** Surprise rewards must stay hidden until the streak milestone is hit. SPEC §Authentication & Security.

**UI implication:** The kid's Reward Store shows a 🎁 placeholder card with a progress bar; the actual reward title/icon only renders after unlock.

### AD-005 — Kid PIN stored as `pin_hash` (bcrypt)

**Decision:** `profiles.pin_hash TEXT` stores a bcrypt hash of the kid's PIN. The SPEC SQL omitted this column but the auth spec requires it.

**Why:** Never store PINs in plaintext. Hashing happens server-side in the Edge Function or via a Postgres `crypt()` call.

**Kid auth flow:** Username + PIN → look up profile by username → `crypt(pin, pin_hash) = pin_hash` check server-side → issue session.

### AD-006 — `lifetime_points` is never decremented

**Decision:** `total_points` is the spendable balance (goes down on redemption). `lifetime_points` and `xp` only ever increase.

**Why:** Levels and achievements are based on `lifetime_points` so kids never "de-level" after spending points. Redemptions deduct only `total_points`.

### AD-007 — RLS uses `get_my_family_id()` and `is_parent()` helper functions

**Decision:** All RLS policies call these two `SECURITY DEFINER` helper functions rather than inline subqueries.

**Why:** Avoids repeating `(SELECT family_id FROM profiles WHERE id = auth.uid())` in every policy, and makes policies readable and auditable.

### AD-008 — State management split: Zustand for auth/UI, TanStack Query for server data

**Decision:** Zustand stores hold: auth session, current profile, UI state (modals, active tab). TanStack Query handles all Supabase data fetching, caching, and invalidation.

**Why:** Per SPEC implementation note §8. Mixing server cache with UI state in one store leads to stale data bugs.

**Pattern:** Zustand `authStore` → session. TanStack Query `useTasks()`, `useRewards()` etc → data.

### AD-009 — Supabase Realtime drives kid celebration animations

**Decision:** When a parent approves a task, the kid's screen reacts via a Supabase Realtime subscription on the `tasks` table (filtered by `assigned_to = kid.id AND status = 'approved'`). No polling.

**Why:** SPEC requirement — confetti + points burst must appear instantly on kid's screen without them refreshing.

### AD-010 — Photo proof uploads to Supabase Storage bucket `task-proofs`

**Decision:** Compress images client-side (max 800px, 80% quality) before upload. Generate signed URLs with 24-hour expiry for parent review. Store only the URL in `tasks.proof_photo_url`.

**Why:** Keeps storage costs down; signed URLs prevent public exposure of kid photos.

### AD-011 — Kid login requires family name + username; lookup is family-scoped

**Decision:** `get_kid_login_info(p_family_name, p_username)` is a Postgres function granted to the `anon` role. It takes both family name and username, and returns only the `invite_code`. Username uniqueness is enforced as `UNIQUE(username, family_id)` — not globally unique.

**Why:** A global username lookup lets kids guess usernames belonging to unrelated families. Requiring the family name scopes the lookup so username space is isolated per family. Exposing only the invite_code (already semi-public) is the minimal surface area.

**Migration:** `005_kid_auth_helpers.sql` (original), `006_family_scoped_username.sql` (updated constraint + RPC).

### AD-012 — Kid internal email pattern: `{username}@{invite_code}.crushit.internal`

**Decision:** Kid Supabase auth accounts use a generated internal email following this pattern, with their PIN as the password.

**Why:** Kids need real `auth.users` entries for RLS to work correctly (policies check `auth.uid()`). Real emails would require verification flows unsuitable for young kids. The invite_code in the domain makes the email unique per family, preventing username collisions across families.

**Where:** `lib/supabase.ts` `kidEmail()` helper. Kid accounts are created by parents via Edge Function.

### AD-013 — Auth routing lives in root `_layout.tsx`, not per-screen

**Decision:** A single `useEffect` in `app/_layout.tsx` handles all auth state changes and route redirects. Individual screens do not contain redirect logic.

**Why:** Centralised routing prevents redirect loops and makes the auth state machine easy to audit in one place. Screens just render; the layout decides where the user belongs.

**Logic:** no session → `/(auth)/welcome`; session + no family_id → `/(auth)/family-setup`; parent → `/(parent)`; kid → `/(kid)`.

### AD-014 — `zodResolver` used in all forms; zod schemas co-located with screens

**Decision:** `react-hook-form` + `zodResolver` for all auth forms. Schema defined at the top of the screen file, not in a separate schemas/ directory.

**Why:** Simpler to read and modify — schema and form are always in the same file. Only worth extracting if shared across multiple screens.

---

## Supabase Edge Functions

| Function | Trigger | Purpose |
| --- | --- | --- |
| `create-kid` | Parent action | Create kid auth user + profile + streak rows via admin API |
| `check-streaks` | Daily cron (midnight) | Increment/reset streaks, unlock streak rewards, award bonus points |
| `send-notifications` | DB webhook on `activity_log` insert | Dispatch push notifications via expo-notifications |
| `generate-recurring-tasks` | Daily cron (midnight) | Create next pending instance of recurring tasks |
| `delete-family` | Manual RPC call | Cascade-delete all family data (GDPR/COPPA delete account) |

---

## Privacy & Legal Requirements

- Consent checkbox on sign-up screen (required before account creation)
- Privacy & Legal section in Settings (links to `https://crushitapp.com/privacy` and `/terms`)
- Delete Family Account screen: user must type "DELETE" to confirm; calls `delete-family` Edge Function
- Data Export screen: generates timestamped JSON of all family data (GDPR)
- Kid Login screen: static privacy note at bottom (no interaction needed)

---

## Design System Constants

```text
Primary:     #FF5722   (electric orange)
Secondary:   #FFD600   (lightning yellow / Crush Points)
Success:     #00C853
Warning:     #FF9800
Danger:      #FF1744
Background:  #0F0F0F   (dark mode default)
Surface:     #1C1C1C
Surface2:    #2A2A2A
Text:        #FFFFFF
TextMuted:   #9E9E9E
```

Fonts: Nunito (display) · Inter (body) · JetBrains Mono (points/numbers) — via `@expo-google-fonts`.
