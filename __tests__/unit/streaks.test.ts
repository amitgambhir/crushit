// __tests__/unit/streaks.test.ts
// Unit tests for lib/streaks.ts pure helpers.

import {
  nextMilestone,
  streakMilestoneProgress,
  STREAK_MILESTONES,
  type StreakType,
} from '@/lib/streaks';

// ─── nextMilestone ───────────────────────────────────────────────────────────

describe('nextMilestone', () => {
  it('returns the first milestone when current is 0', () => {
    expect(nextMilestone('daily', 0)).toBe(3);
    expect(nextMilestone('weekly', 0)).toBe(4);
    expect(nextMilestone('monthly', 0)).toBe(3);
    expect(nextMilestone('yearly', 0)).toBe(1);
  });

  it('returns the next milestone above current', () => {
    expect(nextMilestone('daily', 3)).toBe(7);
    expect(nextMilestone('daily', 7)).toBe(14);
    expect(nextMilestone('daily', 14)).toBe(30);
    expect(nextMilestone('weekly', 4)).toBe(8);
    expect(nextMilestone('monthly', 3)).toBe(6);
  });

  it('returns null when current meets or exceeds the highest milestone', () => {
    expect(nextMilestone('daily', 100)).toBeNull();
    expect(nextMilestone('daily', 999)).toBeNull();
    expect(nextMilestone('weekly', 52)).toBeNull();
    expect(nextMilestone('monthly', 12)).toBeNull();
    expect(nextMilestone('yearly', 3)).toBeNull();
  });

  it('handles exactly at a milestone — returns the NEXT one', () => {
    // current = 30 → next = 60 (not 30 itself)
    expect(nextMilestone('daily', 30)).toBe(60);
  });

  it('handles mid-range values', () => {
    expect(nextMilestone('daily', 15)).toBe(30);
    expect(nextMilestone('daily', 60)).toBe(100);
    expect(nextMilestone('weekly', 12)).toBe(26);
  });

  it('covers all streak types', () => {
    const types: StreakType[] = ['daily', 'weekly', 'monthly', 'yearly'];
    types.forEach((t) => {
      const first = STREAK_MILESTONES[t][0];
      expect(nextMilestone(t, 0)).toBe(first);
    });
  });
});

// ─── streakMilestoneProgress ─────────────────────────────────────────────────

describe('streakMilestoneProgress', () => {
  it('returns 0 when at the start (current = 0, prev milestone = 0)', () => {
    // daily: milestones = [3, 7, ...]; prev=0, next=3; progress = (0-0)/(3-0) = 0
    expect(streakMilestoneProgress('daily', 0)).toBe(0);
  });

  it('returns exactly 0.5 midway between two milestones', () => {
    // daily: prev=3, next=7; midpoint=5; (5-3)/(7-3) = 0.5
    expect(streakMilestoneProgress('daily', 5)).toBe(0.5);
  });

  it('returns 1 when at or beyond the highest milestone', () => {
    expect(streakMilestoneProgress('daily', 100)).toBe(1);
    expect(streakMilestoneProgress('weekly', 52)).toBe(1);
    expect(streakMilestoneProgress('monthly', 12)).toBe(1);
    expect(streakMilestoneProgress('yearly', 3)).toBe(1);
  });

  it('is always between 0 and 1 inclusive', () => {
    const samples = [0, 1, 3, 6, 7, 10, 14, 29, 30, 59, 60, 99, 100, 200];
    samples.forEach((n) => {
      const p = streakMilestoneProgress('daily', n);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    });
  });

  it('increases monotonically within a single milestone interval', () => {
    // Between milestones 7 and 14, progress should strictly increase
    // Note: hitting a milestone resets to 0 for the next interval — that is
    // correct behaviour, so we only test within intervals, not across them.
    const withinInterval = [7, 8, 9, 10, 11, 12, 13]; // between milestone 7 and 14
    for (let i = 1; i < withinInterval.length; i++) {
      const prev = streakMilestoneProgress('daily', withinInterval[i - 1]);
      const curr = streakMilestoneProgress('daily', withinInterval[i]);
      expect(curr).toBeGreaterThan(prev);
    }
  });

  it('resets to 0 when a milestone is hit (start of next interval)', () => {
    // At exactly a milestone, progress toward the next one starts at 0
    expect(streakMilestoneProgress('daily', 3)).toBe(0);
    expect(streakMilestoneProgress('daily', 7)).toBe(0);
    expect(streakMilestoneProgress('daily', 14)).toBe(0);
  });

  it('correctly uses prev milestone as the floor', () => {
    // weekly milestones: [4, 8, 12, 26, 52]
    // current = 10: prev = 8, next = 12; (10 - 8) / (12 - 8) = 0.5
    expect(streakMilestoneProgress('weekly', 10)).toBe(0.5);
  });
});
