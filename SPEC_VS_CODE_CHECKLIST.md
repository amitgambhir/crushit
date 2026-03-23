# Spec vs Code Checklist

Ordered with the most important remaining items first.

## Completed

- [x] Fixed `streaks.family_id` schema/function mismatch.
Resolved by `supabase/migrations/007_streaks_family_id.sql`, which adds `family_id`, backfills it from `profiles`, and indexes it.

- [x] Fixed reward rejection refund logic.
`hooks/useRewards.ts` now removes the broken direct `profiles` write and uses `refund_redemption_points`.

- [x] Added a correct server-side reward rejection/refund path.
Resolved by `supabase/migrations/008_refund_redemption.sql`, which refunds only `total_points` and does not touch `lifetime_points`, `xp`, or `level`.

- [x] Made the repo type-check cleanly with `npx tsc --noEmit`.
Handled by excluding `supabase/functions/**` and `__tests__/**` from app TS compilation. `lib/notifications.ts` updated for expo-notifications API: `setNotificationHandler` now includes `shouldShowBanner`/`shouldShowList`; `scheduleNotificationAsync` uses typed `DateTriggerInput`.

- [x] Implemented streak updates on task approval.
`supabase/migrations/010_streak_on_approval.sql` — `update_kid_daily_streak()` increments the daily streak row and (migration 012) also stamps `last_activity_date` on weekly/monthly/yearly rows so the cron can evaluate them correctly.

- [x] Fixed achievement streak_days evaluation order (was reading old streak value).
`supabase/migrations/012_fix_notification_pipeline.sql` — `approve_task()` now calls `update_kid_daily_streak()` **before** the achievement loop so `streak_days` achievements see the incremented value on the same approval.

- [x] Fixed weekly/monthly/yearly streak `last_activity_date` never being updated.
`update_kid_daily_streak()` (migration 012) now UPDATEs `last_activity_date = CURRENT_DATE` on all four streak-type rows when a task is approved. The `check-streaks` cron can now evaluate non-daily streaks correctly.

- [x] Implemented achievement evaluation and unlocks.
`lib/achievements.ts` — `achievementConditionLabel()` and `achievementProgress()` implement all 11 condition types from the seed. `approve_task()` evaluates every unearned achievement after each approval (migration 010/012). `hooks/useAchievements.ts` exposes data for the kid trophies screen.

- [x] Implemented realtime task approval celebrations.
Supabase Realtime subscription in `app/(kid)/index.tsx` listens on tasks filtered by `assigned_to = kid.id`. On `status = 'approved'` change, triggers `setCelebration()` + `ConfettiOverlay`. Crush Drop celebration added via `activity_log` Realtime channel.

- [x] Fixed push notification pipeline — end to end.
Three bugs fixed in migration 012 + code:
  1. `activity_log` schema uses `user_id` (not `kid_id`/`parent_id`) — `sendNotificationsHelpers.ts` `ActivityLogRow` corrected.
  2. No event existed for kid task submission → added `task_submitted` to the constraint + `submit_task()` RPC (migration 012) logs it atomically; `send-notifications` Edge Function looks up the family parent for `PARENT_EVENTS` via `profiles` query.
  3. `useNotifications()` was never called → mounted in `app/_layout.tsx`.
  Routing: `task_submitted`/`reward_redeemed` → parent; all other events → `user_id` (kid).

- [x] Fixed `useSubmitTask` — routes through `submit_task()` RPC.
Previously did a raw client `tasks` UPDATE (no activity_log row, status/proof fields not atomic). Now calls `supabase.rpc('submit_task', {...})` — symmetric with `approve_task()` on the parent side.

- [x] Added `check-streaks` Edge Function / cron flow.
`supabase/functions/check-streaks/index.ts` — nightly cron: increments/resets streaks per kid, unlocks `streak_rewards` milestones, awards bonus points.

- [x] Added `send-notifications` Edge Function / notification dispatcher.
`supabase/functions/send-notifications/index.ts` — DB webhook on `activity_log` INSERTs. Kid events route to `user_id`; parent events (`task_submitted`, `reward_redeemed`) look up the family's parent profile by `family_id + role = parent`. POSTs to Expo Push API.

- [x] Fixed recurring task idempotency for unassigned tasks.
`generate-recurring-tasks/index.ts` — `.eq('assigned_to', task.assigned_to ?? '')` replaced with conditional `.is('assigned_to', null)` / `.eq('assigned_to', ...)` branch so NULL `assigned_to` rows are matched correctly and not re-inserted on every cron run.

- [x] Implemented Parent PIN / parent section lock.
`supabase/migrations/011_push_token_and_pin.sql` adds `set_parent_pin`, `verify_parent_pin`, `has_parent_pin` RPCs. `components/ui/PINPad.tsx`, `hooks/useParentPIN.ts`, `app/(parent)/_layout.tsx` PIN gate, `app/(parent)/settings/set-pin.tsx`.

- [x] Added task filtering by kid and category.
`app/(parent)/tasks/index.tsx` — horizontal kid filter strip + horizontal category chip strip. Both filter the `useTasks` query reactively.

- [x] Added richer streak reward management.
`app/(parent)/rewards/index.tsx` — "Milestones" tab: list + delete with confirmation. `app/(parent)/rewards/new-streak-reward.tsx` — create form. Backed by `useStreakRewards`, `useCreateStreakReward`, `useDeleteStreakReward`.

- [x] Added parent analytics/dashboard summary.
`lib/analytics.ts` — pure helpers tested in 26 unit tests. `app/(parent)/index.tsx` — "This Week" card with 3-column summary + per-kid color-coded progress bars.

- [x] Added editable kid profile.
`app/(kid)/profile/index.tsx` — emoji avatar grid + color theme picker. `useUpdateMyProfile` mutation re-fetches profile into Zustand on success.

- [x] Added streak rewards / surprise unlock section for kids.
`app/(kid)/store/index.tsx` — "Streaks" tab with unlock cards and progress hints.

- [x] Add or remove spec-listed modules so structure matches reality.
All stubs filled: `hooks/useAchievements.ts`, `hooks/useNotifications.ts`, `lib/notifications.ts`, `lib/achievements.ts`, `lib/streaks.ts`, `lib/sendNotificationsHelpers.ts`, components, etc.

- [x] Reconcile README with current implementation status.
Feature table, Edge Functions section, migration count (14), Expo SDK version (55), and deploy steps all updated.

- [x] Auth-hardened all privileged RPCs — caller identity resolved from auth.uid() server-side.
`supabase/migrations/014_rpc_auth_hardening.sql` — drops all old spoofable signatures (`approve_task(UUID,UUID)`, `reject_task(UUID,TEXT,UUID)`, `reject_redemption(UUID,TEXT,UUID)`, `fulfill_redemption(UUID,UUID)`, `award_crush_drop(UUID,UUID,INT,TEXT)`, `redeem_reward(UUID,UUID)`). New signatures accept no caller-identity param; each verifies auth.uid() is non-null, loads caller profile, checks role, and checks same family_id as the target row. Hooks updated to match.

- [x] Completed level_up event emission across all point-award paths.
`approve_task` (migration 013) + `award_crush_drop` + `update_kid_daily_streak` bonus (migration 014) all now compare old vs new level and emit `level_up` when a boundary is crossed.

- [x] Aligned lib/notifications.ts event vocabulary with sendNotificationsHelpers.ts.
`NotificationEventType` now covers the same canonical 11 events: `task_submitted`/`reward_redeemed` (parent) + 9 kid events. Removed stale `task_approved` and `achievement_unlocked`. `buildNotificationPayload` cases updated to match. `notifications.test.ts` updated.

- [x] Fixed missing activity_log event sources for task_rejected, redemption_rejected, redemption_fulfilled, level_up.
`supabase/migrations/013_missing_activity_log_events.sql` — `reject_task()`, `reject_redemption()`, `fulfill_redemption()` RPCs write status + activity_log atomically. `approve_task()` now emits `level_up` when `v_new_level > v_kid.level`. `useRejectTask`, `useRejectRedemption`, `useFulfillRedemption` all updated to call the new RPCs.

- [x] Fixed multi-parent notification — all parents in the family now receive push notifications.
`supabase/functions/send-notifications/index.ts` — replaced `.limit(1).maybeSingle()` with a query for all parent profiles with push tokens, sending to each via `Promise.all`.

## P2 - Auth / Security Gaps

- [ ] Add Google Sign-In for parents.
Deferred to Phase 3 by design (email + Apple are live). Will use `supabase.auth.signInWithIdToken({ provider: 'google' })`.

- [ ] Implement optional older-kid auth linking if still in scope.
Spec mentions optional Apple/Google linkage for older kids; not present.

## P3 - Parent Workflow Gaps

- [ ] Add photo proof review/viewer in parent approval flow.
Storage bucket `task-proofs` is configured (AD-010); `usePhotoUpload` hook is built and tested; UI viewer in `ApprovalCard` not built.

- [ ] Add notification preferences in Settings.
Push token registration is live; per-event preference toggles not built.

## P4 - Kid Workflow Gaps

- [x] Add reward detail screen.
`app/(kid)/store/[id].tsx` exists.

- [ ] Add redemption history screen/state.
Spec includes pending/approved/fulfilled reward history for kids.

- [ ] Expand My Trophies screen to match spec.
Missing earned/locked badge grid and points history chart.

- [ ] Complete photo proof upload flow — parent viewer.
Kid-side picker/upload UI is wired in `app/(kid)/tasks/[id].tsx`. Parent-side proof viewer in `ApprovalCard` is still open.

- [ ] Add overdue visual treatment.
Spec calls for overdue task highlighting and stronger completed/rewarded state UX.

## P5 - Gamification / Delight Gaps

- [ ] Build badge UI system.
`AchievementBadge` component is a stub; earned vs locked grid not built.

- [ ] Build celebration animation components from the spec.
`ConfettiOverlay` is partially wired; missing: `SurpriseReveal`, `PointsCounter`, full level-up and streak milestone animations.

- [ ] Add family leaderboard.

- [ ] Add goal savings.

- [ ] Add family feed reactions/comments.

- [ ] Add smart suggestions.

- [ ] Add unlockable themes/customization.

- [ ] Add seasonal events.

## P6 - Phase 3 Deferred

- [ ] Photo proof upload + viewer (end to end).
Client-side compress → Storage upload → signed URL → parent approval viewer.

- [ ] App Store submission prep.
Icons, splash, metadata, privacy manifest, review notes.
