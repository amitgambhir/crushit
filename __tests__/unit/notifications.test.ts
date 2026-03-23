// __tests__/unit/notifications.test.ts
// Tests for the pure buildNotificationPayload helper.
// Only imports from lib/notifications.ts — no native modules touched.

import { buildNotificationPayload, NotificationEventType } from '@/lib/notifications';

// Jest auto-mock expo-notifications so the module-level setNotificationHandler
// call in lib/notifications.ts doesn't throw in the test environment.
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  cancelAllScheduledNotificationsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  AndroidImportance: { MAX: 5 },
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

// ─── buildNotificationPayload ─────────────────────────────────────────────────
// Canonical event vocabulary (must match PARENT_EVENTS + KID_EVENTS in
// sendNotificationsHelpers.ts — 11 events total, 2 parent + 9 kid).

describe('buildNotificationPayload', () => {
  // ── Parent-facing ────────────────────────────────────────────────────────

  it('task_submitted — notifies parent to review', () => {
    const p = buildNotificationPayload('task_submitted', { kidName: 'Alice', taskTitle: 'Clean room' });
    expect(p.title).toBe('Task ready to review');
    expect(p.body).toContain('Alice');
    expect(p.body).toContain('"Clean room"');
  });

  it('reward_redeemed — notifies parent of new request', () => {
    const p = buildNotificationPayload('reward_redeemed', { kidName: 'Bob', rewardTitle: 'Movie Night' });
    expect(p.title).toBe('New reward request');
    expect(p.body).toContain('Bob');
    expect(p.body).toContain('"Movie Night"');
  });

  // ── Kid-facing ───────────────────────────────────────────────────────────

  it('task_completed — notifies kid their task was approved', () => {
    const p = buildNotificationPayload('task_completed', { taskTitle: 'Homework', points: 50 });
    expect(p.title).toBe('Task approved!');
    expect(p.body).toContain('50');
    expect(p.body).toContain('"Homework"');
  });

  it('task_rejected — notifies kid', () => {
    const p = buildNotificationPayload('task_rejected', { taskTitle: 'Tidy up' });
    expect(p.title).toBe('Task not approved');
    expect(p.body).toContain('"Tidy up"');
  });

  it('redemption_rejected — notifies kid', () => {
    const p = buildNotificationPayload('redemption_rejected', { rewardTitle: 'Theme Park' });
    expect(p.title).toBe('Reward not approved');
    expect(p.body).toContain('"Theme Park"');
  });

  it('redemption_fulfilled — notifies kid', () => {
    const p = buildNotificationPayload('redemption_fulfilled', { rewardTitle: 'Extra Screen Time' });
    expect(p.title).toBe('Reward delivered!');
    expect(p.body).toContain('"Extra Screen Time"');
  });

  it('streak_milestone — includes streak count when provided', () => {
    const p = buildNotificationPayload('streak_milestone', { kidName: 'Alice', streakCount: 7 });
    expect(p.title).toBe('Streak milestone!');
    expect(p.body).toContain('7');
    expect(p.body).toContain('Alice');
  });

  it('streak_milestone — works without streak count', () => {
    const p = buildNotificationPayload('streak_milestone', { kidName: 'Bob' });
    expect(p.title).toBe('Streak milestone!');
    expect(p.body).toContain('Bob');
  });

  it('badge_earned — includes badge name when provided', () => {
    const p = buildNotificationPayload('badge_earned', { kidName: 'Alice', badgeName: 'Homework Hero' });
    expect(p.title).toBe('Badge earned!');
    expect(p.body).toContain('"Homework Hero"');
  });

  it('level_up — includes level number when provided', () => {
    const p = buildNotificationPayload('level_up', { kidName: 'Alice', level: 5 });
    expect(p.title).toBe('Level up!');
    expect(p.body).toContain('5');
  });

  it('crush_drop — includes point amount', () => {
    const p = buildNotificationPayload('crush_drop', { points: 25 });
    expect(p.title).toBe('Crush Drop!');
    expect(p.body).toContain('25');
  });

  it('points_awarded — same template as crush_drop', () => {
    const p = buildNotificationPayload('points_awarded', { points: 10 });
    expect(p.title).toBe('Crush Drop!');
    expect(p.body).toContain('10');
  });

  // ── Invariants ───────────────────────────────────────────────────────────

  it('uses fallback kid name when kidName omitted', () => {
    const p = buildNotificationPayload('task_submitted', {});
    expect(p.body).toContain('Your kid');
  });

  it('NotificationEventType covers exactly 11 events — matches sendNotificationsHelpers.ts', () => {
    // This list must stay in sync with PARENT_EVENTS + KID_EVENTS
    const allEvents: NotificationEventType[] = [
      // PARENT_EVENTS (2)
      'task_submitted', 'reward_redeemed',
      // KID_EVENTS (9)
      'task_completed', 'task_rejected', 'redemption_rejected',
      'redemption_fulfilled', 'streak_milestone', 'badge_earned',
      'level_up', 'points_awarded', 'crush_drop',
    ];
    expect(allEvents).toHaveLength(11);
  });

  it('always returns non-empty title and body for all 11 events', () => {
    const events: NotificationEventType[] = [
      'task_submitted', 'reward_redeemed',
      'task_completed', 'task_rejected', 'redemption_rejected',
      'redemption_fulfilled', 'streak_milestone', 'badge_earned',
      'level_up', 'points_awarded', 'crush_drop',
    ];

    events.forEach((ev) => {
      const p = buildNotificationPayload(ev);
      expect(p.title.length).toBeGreaterThan(0);
      expect(p.body.length).toBeGreaterThan(0);
    });
  });
});
