// lib/notifications.ts
// Push notification helpers for CrushIt (AD-009 / send-notifications Edge Function).
//
// Split into two layers:
//   1. Pure helpers (buildNotificationPayload) — safe to import in tests
//   2. Native helpers (registerForPushNotifications, scheduleStreakReminder)
//      — depend on expo-notifications, not importable in Jest without mocking

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Canonical 11-event vocabulary — must match PARENT_EVENTS + KID_EVENTS in
// lib/sendNotificationsHelpers.ts exactly. One source of truth for event names.
export type NotificationEventType =
  // PARENT_EVENTS — routed to parent by the send-notifications Edge Function
  | 'task_submitted'      // kid submitted for review → parent notified
  | 'reward_redeemed'     // kid redeemed a reward → parent notified
  // KID_EVENTS — routed to user_id (the kid) by the Edge Function
  | 'task_completed'      // parent approved task → kid notified
  | 'task_rejected'       // parent rejected task → kid notified
  | 'redemption_rejected' // parent rejected redemption → kid notified
  | 'redemption_fulfilled'// parent fulfilled redemption → kid notified
  | 'streak_milestone'    // streak reward unlocked → kid notified
  | 'badge_earned'        // achievement badge earned → kid notified
  | 'level_up'            // levelled up → kid notified
  | 'points_awarded'      // points awarded → kid notified
  | 'crush_drop';         // bonus Crush Drop → kid notified

export interface NotificationContext {
  kidName?: string;
  taskTitle?: string;
  rewardTitle?: string;
  points?: number;
  streakType?: string;
  streakCount?: number;
  level?: number;
  badgeName?: string;
}

/**
 * Pure function — builds the title and body for a push notification.
 * No native imports; safe to test in Jest.
 */
export function buildNotificationPayload(
  eventType: NotificationEventType,
  ctx: NotificationContext = {},
): { title: string; body: string } {
  const kid = ctx.kidName ?? 'Your kid';
  const task = ctx.taskTitle ? `"${ctx.taskTitle}"` : 'a task';
  const reward = ctx.rewardTitle ? `"${ctx.rewardTitle}"` : 'a reward';
  const pts = ctx.points ?? 0;

  switch (eventType) {
    // ── Parent-facing ─────────────────────────────────────────────────────────
    case 'task_submitted':
      return {
        title: 'Task ready to review',
        body: `${kid} submitted ${task} — approve or reject?`,
      };
    case 'reward_redeemed':
      return {
        title: 'New reward request',
        body: `${kid} wants to redeem ${reward}`,
      };
    // ── Kid-facing ────────────────────────────────────────────────────────────
    case 'task_completed':
      return {
        title: 'Task approved!',
        body: `You earned ${pts} Crush Points for ${task}`,
      };
    case 'task_rejected':
      return {
        title: 'Task not approved',
        body: `Your parent reviewed ${task} and sent it back`,
      };
    case 'redemption_rejected':
      return {
        title: 'Reward not approved',
        body: `${reward} wasn't approved this time`,
      };
    case 'redemption_fulfilled':
      return {
        title: 'Reward delivered!',
        body: `Enjoy ${reward}! Your parent has fulfilled it`,
      };
    case 'streak_milestone':
      return {
        title: 'Streak milestone!',
        body: ctx.streakCount
          ? `${kid} hit a ${ctx.streakCount}-day streak — awesome!`
          : `${kid} hit a streak milestone!`,
      };
    case 'badge_earned':
      return {
        title: 'Badge earned!',
        body: ctx.badgeName
          ? `${kid} earned the "${ctx.badgeName}" badge`
          : `${kid} earned a new badge!`,
      };
    case 'level_up':
      return {
        title: 'Level up!',
        body: ctx.level
          ? `${kid} reached Level ${ctx.level}!`
          : `${kid} levelled up!`,
      };
    case 'crush_drop':
    case 'points_awarded':
      return {
        title: 'Crush Drop!',
        body: `You received ${pts} bonus Crush Points!`,
      };
  }
}

// ─── Native helpers ───────────────────────────────────────────────────────────

// Configure how notifications are displayed when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Requests notification permissions and returns the Expo push token.
 * Returns null if permission is denied or the device doesn't support push.
 * Store the returned token in profiles.push_token via useNotifications().
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Physical device required on iOS
  if (Platform.OS === 'ios') {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return null;
  } else {
    // Android — request permission (required API 33+)
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return null;

    // Android notification channel
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync();
    return tokenData.data;
  } catch {
    // Simulator or misconfigured project — not a fatal error
    return null;
  }
}

/**
 * Schedule a local notification reminding the kid to keep their streak alive.
 * Called when streak data is loaded and the streak is at risk of resetting.
 */
export async function scheduleStreakReminder(streakType: string): Promise<void> {
  // Cancel any existing streak reminders first to avoid duplicates
  await Notifications.cancelAllScheduledNotificationsAsync();

  const now = new Date();
  // Remind at 8 PM local time today
  const trigger = new Date(now);
  trigger.setHours(20, 0, 0, 0);
  // If it's already past 8 PM, skip — streak cron will handle the reset
  if (trigger <= now) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Keep your streak alive!',
      body: `Complete a task today to protect your ${streakType} streak!`,
    },
    trigger: { type: 'date', date: trigger } as Notifications.DateTriggerInput,
  });
}
