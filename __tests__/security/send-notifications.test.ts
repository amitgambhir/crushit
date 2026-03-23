// __tests__/security/send-notifications.test.ts
// Tests for the pure helpers in lib/sendNotificationsHelpers.ts.
//
// Routing model (post-migration-012):
//   PARENT_EVENTS (task_submitted, reward_redeemed) → Edge Function looks up
//     family parent; getRecipientId() returns null as a signal.
//   KID_EVENTS (task_completed, task_rejected, …) → getRecipientId() returns
//     user_id (the kid's profile ID stored on the row).

import {
  getRecipientId,
  isParentEvent,
  buildNotificationMessage,
  PARENT_EVENTS,
  KID_EVENTS,
  type ActivityLogRow,
} from '@/lib/sendNotificationsHelpers';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeRow(overrides: Partial<ActivityLogRow> = {}): ActivityLogRow {
  return {
    id:         'log-1',
    family_id:  'fam-1',
    user_id:    'kid-1',      // activity_log has user_id only (not kid_id/parent_id)
    event_type: 'task_completed',
    metadata:   { kid_name: 'Alice', task_title: 'Clean room', points: 20 },
    created_at: '2026-03-20T08:00:00Z',
    ...overrides,
  };
}

// ─── isParentEvent ────────────────────────────────────────────────────────────

describe('isParentEvent', () => {
  it('returns true for task_submitted', () => {
    expect(isParentEvent('task_submitted')).toBe(true);
  });

  it('returns true for reward_redeemed', () => {
    expect(isParentEvent('reward_redeemed')).toBe(true);
  });

  it('returns false for kid events', () => {
    ['task_completed', 'task_rejected', 'badge_earned', 'level_up', 'crush_drop'].forEach((e) => {
      expect(isParentEvent(e)).toBe(false);
    });
  });

  it('returns false for unknown events', () => {
    expect(isParentEvent('future_event')).toBe(false);
  });
});

// ─── getRecipientId ───────────────────────────────────────────────────────────

describe('getRecipientId — kid events return user_id', () => {
  const KID_EVENT_TYPES = [
    'task_completed', 'task_rejected', 'redemption_rejected',
    'redemption_fulfilled', 'streak_milestone', 'badge_earned',
    'level_up', 'points_awarded', 'crush_drop',
  ];

  KID_EVENT_TYPES.forEach((evt) => {
    it(`${evt} → returns user_id (kid)`, () => {
      expect(getRecipientId(makeRow({ event_type: evt, user_id: 'kid-1' }))).toBe('kid-1');
    });
  });

  it('returns null when user_id is missing on a kid event', () => {
    expect(getRecipientId(makeRow({ event_type: 'task_completed', user_id: null }))).toBeNull();
  });
});

describe('getRecipientId — parent events return null (Edge Function must look up parent)', () => {
  it('task_submitted → null (caller looks up family parent)', () => {
    expect(getRecipientId(makeRow({ event_type: 'task_submitted' }))).toBeNull();
  });

  it('reward_redeemed → null (caller looks up family parent)', () => {
    expect(getRecipientId(makeRow({ event_type: 'reward_redeemed' }))).toBeNull();
  });
});

describe('getRecipientId — unknown events', () => {
  it('returns null for unrecognised event type', () => {
    expect(getRecipientId(makeRow({ event_type: 'future_event' }))).toBeNull();
  });
});

// ─── Set membership invariants ────────────────────────────────────────────────

describe('PARENT_EVENTS and KID_EVENTS are mutually exclusive', () => {
  it('no event type appears in both sets', () => {
    PARENT_EVENTS.forEach((evt: string) => {
      expect(KID_EVENTS.has(evt)).toBe(false);
    });
  });

  it('covers all 11 known event types', () => {
    expect(PARENT_EVENTS.size + KID_EVENTS.size).toBe(11);
  });
});

// ─── buildNotificationMessage — payload correctness ──────────────────────────

describe('buildNotificationMessage', () => {
  // Parent-facing
  it('task_submitted — parent sees kid name and task title', () => {
    const { title, body } = buildNotificationMessage(
      makeRow({ event_type: 'task_submitted', metadata: { kid_name: 'Alice', task_title: 'Clean room' } }),
    );
    expect(title).toMatch(/review/i);
    expect(body).toMatch(/Alice/);
    expect(body).toMatch(/Clean room/);
  });

  it('reward_redeemed — parent sees kid name and reward title', () => {
    const { body } = buildNotificationMessage(
      makeRow({ event_type: 'reward_redeemed', metadata: { kid_name: 'Bob', reward_title: 'Pizza night' } }),
    );
    expect(body).toMatch(/Pizza night/);
    expect(body).toMatch(/Bob/);
  });

  // Kid-facing
  it('task_completed — kid sees points earned', () => {
    const { title, body } = buildNotificationMessage(
      makeRow({ event_type: 'task_completed', metadata: { task_title: 'Homework', points: 30 } }),
    );
    expect(title).toMatch(/approved/i);
    expect(body).toMatch(/30/);
    expect(body).toMatch(/Homework/);
  });

  it('task_rejected — kid sees task title', () => {
    const { body } = buildNotificationMessage(
      makeRow({ event_type: 'task_rejected', metadata: { task_title: 'Dishes' } }),
    );
    expect(body).toMatch(/Dishes/);
  });

  it('streak_milestone — includes streak count', () => {
    const { body } = buildNotificationMessage(
      makeRow({ event_type: 'streak_milestone', metadata: { streak_count: 30 } }),
    );
    expect(body).toMatch(/30/);
  });

  it('streak_milestone — graceful fallback when streak_count missing', () => {
    const { body } = buildNotificationMessage(
      makeRow({ event_type: 'streak_milestone', metadata: {} }),
    );
    expect(body).toMatch(/milestone/i);
  });

  it('badge_earned — includes badge name', () => {
    const { body } = buildNotificationMessage(
      makeRow({ event_type: 'badge_earned', metadata: { badge_name: 'Week Warrior' } }),
    );
    expect(body).toMatch(/Week Warrior/);
  });

  it('level_up — includes level number', () => {
    const { body } = buildNotificationMessage(
      makeRow({ event_type: 'level_up', metadata: { level: 5 } }),
    );
    expect(body).toMatch(/Level 5/);
  });

  it('crush_drop — includes bonus points', () => {
    const { title, body } = buildNotificationMessage(
      makeRow({ event_type: 'crush_drop', metadata: { points: 50 } }),
    );
    expect(title).toMatch(/Crush Drop/i);
    expect(body).toMatch(/50/);
  });

  it('points_awarded — same template as crush_drop', () => {
    const { title } = buildNotificationMessage(
      makeRow({ event_type: 'points_awarded', metadata: { points: 10 } }),
    );
    expect(title).toMatch(/Crush Drop/i);
  });

  it('unknown event type — returns a safe fallback', () => {
    const { title, body } = buildNotificationMessage(makeRow({ event_type: 'future_event' }));
    expect(title).toBeTruthy();
    expect(body).toBeTruthy();
  });

  it('null metadata — uses safe fallback strings without throwing', () => {
    const { body } = buildNotificationMessage(
      makeRow({ event_type: 'task_submitted', metadata: null }),
    );
    expect(body).toMatch(/Your kid/);
  });

  it('all 11 known event types produce non-empty title and body', () => {
    [...PARENT_EVENTS, ...KID_EVENTS].forEach((evt) => {
      const { title, body } = buildNotificationMessage(makeRow({ event_type: evt }));
      expect(title.length).toBeGreaterThan(0);
      expect(body.length).toBeGreaterThan(0);
    });
  });
});
