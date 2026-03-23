// __tests__/security/check-streaks.test.ts
// Tests for the pure helper functions extracted from check-streaks/index.ts.
// The Edge Function itself uses Deno-specific imports and cannot run in Jest;
// we extract and test every decision function.

import {
  shouldResetDailyStreak,
  evaluateWeeklyStreak,
  evaluateMonthlyStreak,
  evaluateYearlyStreak,
  lastWeekRange,
  lastMonthRange,
  lastYearRange,
  isMondayUTC,
  isFirstOfMonthUTC,
  isJanFirstUTC,
} from '@/lib/checkStreaksHelpers';

// ─── shouldResetDailyStreak ──────────────────────────────────────────────────

describe('shouldResetDailyStreak', () => {
  const yesterday = '2025-03-19';

  it('returns false when last_activity_date is null (streak never started)', () => {
    expect(shouldResetDailyStreak(null, yesterday)).toBe(false);
  });

  it('returns false when last activity was yesterday (streak active)', () => {
    expect(shouldResetDailyStreak('2025-03-19', yesterday)).toBe(false);
  });

  it('returns true when last activity was the day before yesterday', () => {
    expect(shouldResetDailyStreak('2025-03-18', yesterday)).toBe(true);
  });

  it('returns true when last activity was many days ago', () => {
    expect(shouldResetDailyStreak('2025-01-01', yesterday)).toBe(true);
  });

  it('returns false when last_activity_date is empty string', () => {
    // empty string is falsy → treated as null
    expect(shouldResetDailyStreak('', yesterday)).toBe(false);
  });
});

// ─── evaluateWeeklyStreak ────────────────────────────────────────────────────

describe('evaluateWeeklyStreak', () => {
  const weekStart = '2025-03-10'; // Monday
  const weekEnd   = '2025-03-16'; // Sunday

  it('returns increment when last activity is within last week', () => {
    expect(evaluateWeeklyStreak('2025-03-10', weekStart, weekEnd)).toBe('increment');
    expect(evaluateWeeklyStreak('2025-03-13', weekStart, weekEnd)).toBe('increment');
    expect(evaluateWeeklyStreak('2025-03-16', weekStart, weekEnd)).toBe('increment');
  });

  it('returns reset when last activity is null', () => {
    expect(evaluateWeeklyStreak(null, weekStart, weekEnd)).toBe('reset');
  });

  it('returns reset when last activity is before last week', () => {
    expect(evaluateWeeklyStreak('2025-03-09', weekStart, weekEnd)).toBe('reset');
    expect(evaluateWeeklyStreak('2025-01-01', weekStart, weekEnd)).toBe('reset');
  });

  it('returns reset when last activity is after weekEnd (future — should not happen)', () => {
    expect(evaluateWeeklyStreak('2025-03-17', weekStart, weekEnd)).toBe('reset');
  });

  it('is inclusive on both boundaries', () => {
    expect(evaluateWeeklyStreak(weekStart, weekStart, weekEnd)).toBe('increment');
    expect(evaluateWeeklyStreak(weekEnd,   weekStart, weekEnd)).toBe('increment');
  });
});

// ─── evaluateMonthlyStreak ───────────────────────────────────────────────────

describe('evaluateMonthlyStreak', () => {
  const monthStart = '2025-02-01';
  const monthEnd   = '2025-02-28';

  it('returns increment when active in last month', () => {
    expect(evaluateMonthlyStreak('2025-02-14', monthStart, monthEnd)).toBe('increment');
    expect(evaluateMonthlyStreak('2025-02-01', monthStart, monthEnd)).toBe('increment');
    expect(evaluateMonthlyStreak('2025-02-28', monthStart, monthEnd)).toBe('increment');
  });

  it('returns reset when null', () => {
    expect(evaluateMonthlyStreak(null, monthStart, monthEnd)).toBe('reset');
  });

  it('returns reset when activity was before last month', () => {
    expect(evaluateMonthlyStreak('2025-01-31', monthStart, monthEnd)).toBe('reset');
  });
});

// ─── evaluateYearlyStreak ────────────────────────────────────────────────────

describe('evaluateYearlyStreak', () => {
  const yearStart = '2024-01-01';
  const yearEnd   = '2024-12-31';

  it('returns increment when active during the last year', () => {
    expect(evaluateYearlyStreak('2024-06-15', yearStart, yearEnd)).toBe('increment');
    expect(evaluateYearlyStreak('2024-01-01', yearStart, yearEnd)).toBe('increment');
    expect(evaluateYearlyStreak('2024-12-31', yearStart, yearEnd)).toBe('increment');
  });

  it('returns reset when null', () => {
    expect(evaluateYearlyStreak(null, yearStart, yearEnd)).toBe('reset');
  });

  it('returns reset when activity was before last year', () => {
    expect(evaluateYearlyStreak('2023-12-31', yearStart, yearEnd)).toBe('reset');
  });
});

// ─── lastWeekRange ───────────────────────────────────────────────────────────

describe('lastWeekRange', () => {
  it('returns Mon–Sun of previous week when called on a Monday', () => {
    // Monday 2025-03-17 → previous week was Mon 2025-03-10 to Sun 2025-03-16
    const monday = new Date('2025-03-17T00:00:00Z');
    const { weekStart, weekEnd } = lastWeekRange(monday);
    expect(weekStart).toBe('2025-03-10');
    expect(weekEnd).toBe('2025-03-16');
  });

  it('weekStart is always a Monday', () => {
    const d = new Date('2025-01-06T00:00:00Z'); // Monday
    const { weekStart } = lastWeekRange(d);
    expect(new Date(weekStart + 'T00:00:00Z').getUTCDay()).toBe(1); // 1 = Monday
  });

  it('weekEnd is always a Sunday', () => {
    const d = new Date('2025-01-06T00:00:00Z');
    const { weekEnd } = lastWeekRange(d);
    expect(new Date(weekEnd + 'T00:00:00Z').getUTCDay()).toBe(0); // 0 = Sunday
  });

  it('the range is always 7 days', () => {
    const d = new Date('2025-06-02T00:00:00Z'); // Monday
    const { weekStart, weekEnd } = lastWeekRange(d);
    const diff = (new Date(weekEnd).getTime() - new Date(weekStart).getTime()) / 86_400_000;
    expect(diff).toBe(6); // inclusive: Mon + 6 days = Sun
  });
});

// ─── lastMonthRange ──────────────────────────────────────────────────────────

describe('lastMonthRange', () => {
  it('returns full previous month for a typical month', () => {
    // 1 March 2025 → February 2025
    const d = new Date('2025-03-01T00:00:00Z');
    const { monthStart, monthEnd } = lastMonthRange(d);
    expect(monthStart).toBe('2025-02-01');
    expect(monthEnd).toBe('2025-02-28');
  });

  it('handles January → December of previous year', () => {
    const d = new Date('2025-01-01T00:00:00Z');
    const { monthStart, monthEnd } = lastMonthRange(d);
    expect(monthStart).toBe('2024-12-01');
    expect(monthEnd).toBe('2024-12-31');
  });

  it('handles leap year February (2024)', () => {
    const d = new Date('2024-03-01T00:00:00Z');
    const { monthStart, monthEnd } = lastMonthRange(d);
    expect(monthStart).toBe('2024-02-01');
    expect(monthEnd).toBe('2024-02-29');
  });

  it('handles months with 31 days', () => {
    const d = new Date('2025-02-01T00:00:00Z'); // 1 Feb → last month = January
    const { monthStart, monthEnd } = lastMonthRange(d);
    expect(monthStart).toBe('2025-01-01');
    expect(monthEnd).toBe('2025-01-31');
  });
});

// ─── lastYearRange ───────────────────────────────────────────────────────────

describe('lastYearRange', () => {
  it('returns the previous calendar year', () => {
    const d = new Date('2025-01-01T00:00:00Z');
    const { yearStart, yearEnd } = lastYearRange(d);
    expect(yearStart).toBe('2024-01-01');
    expect(yearEnd).toBe('2024-12-31');
  });

  it('always starts on Jan 1 and ends on Dec 31', () => {
    const d = new Date('2026-06-15T00:00:00Z');
    const { yearStart, yearEnd } = lastYearRange(d);
    expect(yearStart.endsWith('-01-01')).toBe(true);
    expect(yearEnd.endsWith('-12-31')).toBe(true);
  });
});

// ─── Calendar helpers ─────────────────────────────────────────────────────────

describe('isMondayUTC', () => {
  it('returns true for a Monday', () => {
    expect(isMondayUTC(new Date('2025-03-17T00:00:00Z'))).toBe(true);
  });
  it('returns false for a Tuesday', () => {
    expect(isMondayUTC(new Date('2025-03-18T00:00:00Z'))).toBe(false);
  });
  it('returns false for a Sunday', () => {
    expect(isMondayUTC(new Date('2025-03-16T00:00:00Z'))).toBe(false);
  });
});

describe('isFirstOfMonthUTC', () => {
  it('returns true on the 1st', () => {
    expect(isFirstOfMonthUTC(new Date('2025-03-01T00:00:00Z'))).toBe(true);
  });
  it('returns false on the 2nd', () => {
    expect(isFirstOfMonthUTC(new Date('2025-03-02T00:00:00Z'))).toBe(false);
  });
});

describe('isJanFirstUTC', () => {
  it('returns true on Jan 1st', () => {
    expect(isJanFirstUTC(new Date('2025-01-01T00:00:00Z'))).toBe(true);
  });
  it('returns false on Jan 2nd', () => {
    expect(isJanFirstUTC(new Date('2025-01-02T00:00:00Z'))).toBe(false);
  });
  it('returns false on Dec 31st', () => {
    expect(isJanFirstUTC(new Date('2024-12-31T00:00:00Z'))).toBe(false);
  });
});
