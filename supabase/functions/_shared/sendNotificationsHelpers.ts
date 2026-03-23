// supabase/functions/_shared/sendNotificationsHelpers.ts
// Pure routing + payload helpers for the send-notifications Edge Function.
// Imported by both the Deno Edge Function and Jest tests (via lib/ re-export).

// Matches the actual activity_log schema: single `user_id` column (not kid_id/parent_id).
export interface ActivityLogRow {
  id: string;
  family_id: string;
  user_id: string | null;     // the user who triggered the event (usually the kid)
  event_type: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// ─── Recipient routing ────────────────────────────────────────────────────────

/**
 * Events where the PARENT should be notified (not the user_id in the row).
 * For these events the Edge Function must look up the family's parent.
 */
export const PARENT_EVENTS = new Set([
  'task_submitted',   // kid submitted a task for review
  'reward_redeemed',  // kid redeemed a reward — parent must fulfil
]);

/**
 * Events where the KID (user_id in the row) should be notified.
 */
export const KID_EVENTS = new Set([
  'task_completed',       // parent approved → kid gets points
  'task_rejected',        // parent rejected → kid informed
  'redemption_rejected',  // parent rejected redemption
  'redemption_fulfilled', // parent fulfilled redemption
  'streak_milestone',     // streak reward unlocked
  'badge_earned',         // achievement badge earned
  'level_up',             // level up
  'points_awarded',       // bonus points
  'crush_drop',           // crush drop bonus
]);

/**
 * Returns true when the event should route to the family parent rather than
 * the user_id stored in the row.
 */
export function isParentEvent(eventType: string): boolean {
  return PARENT_EVENTS.has(eventType);
}

/**
 * For KID events: returns user_id directly.
 * For PARENT events: returns null — the Edge Function must look up the parent
 *   via family_id (the row always has family_id for this purpose).
 * For unknown events: returns null (drop silently).
 */
export function getRecipientId(row: ActivityLogRow): string | null {
  if (KID_EVENTS.has(row.event_type)) return row.user_id ?? null;
  if (PARENT_EVENTS.has(row.event_type)) return null; // caller must look up parent
  return null;
}

// ─── Notification payload ─────────────────────────────────────────────────────

/**
 * Builds the push notification title + body from an activity_log row.
 */
export function buildNotificationMessage(row: ActivityLogRow): { title: string; body: string } {
  const meta   = row.metadata ?? {};
  const kid    = (meta.kid_name    as string | undefined) ?? 'Your kid';
  const task   = meta.task_title   ? `"${meta.task_title}"`   : 'a task';
  const reward = meta.reward_title ? `"${meta.reward_title}"` : 'a reward';
  const pts    = (meta.points      as number | undefined) ?? 0;

  switch (row.event_type) {
    // ── Parent-facing ──────────────────────────────────────────────────────
    case 'task_submitted':
      return { title: 'Task ready to review', body: `${kid} submitted ${task} — approve or reject?` };
    case 'reward_redeemed':
      return { title: 'New reward request', body: `${kid} wants to redeem ${reward}` };

    // ── Kid-facing ─────────────────────────────────────────────────────────
    case 'task_completed':
      return { title: 'Task approved!', body: `You earned ${pts} Crush Points for ${task}` };
    case 'task_rejected':
      return { title: 'Task not approved', body: `Your parent reviewed ${task} and sent it back` };
    case 'redemption_rejected':
      return { title: 'Reward not approved', body: `${reward} wasn't approved this time` };
    case 'redemption_fulfilled':
      return { title: 'Reward delivered!', body: `Enjoy ${reward}! Your parent has fulfilled it` };
    case 'streak_milestone': {
      const count = meta.streak_count as number | undefined;
      return {
        title: 'Streak milestone!',
        body: count ? `You hit a ${count}-day streak — awesome!` : 'You hit a streak milestone!',
      };
    }
    case 'badge_earned': {
      const badge = meta.badge_name as string | undefined;
      return {
        title: 'Achievement unlocked!',
        body: badge ? `You earned the "${badge}" badge` : 'You earned a new badge!',
      };
    }
    case 'level_up': {
      const level = meta.level as number | undefined;
      return {
        title: 'Level up!',
        body: level ? `You reached Level ${level}!` : 'You levelled up!',
      };
    }
    case 'crush_drop':
    case 'points_awarded':
      return { title: 'Crush Drop!', body: `You received ${pts} bonus Crush Points!` };
    default:
      return { title: 'CrushIt', body: 'You have a new notification' };
  }
}
