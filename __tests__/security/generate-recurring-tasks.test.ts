// __tests__/security/generate-recurring-tasks.test.ts
// Tests for the pure helper functions extracted from generate-recurring-tasks/index.ts.

import {
  nextDueDate,
  shouldGenerate,
  type Recurrence,
} from '@/lib/recurringTaskHelpers';

// ─── shouldGenerate ───────────────────────────────────────────────────────────

describe('shouldGenerate', () => {
  it('returns true for approved tasks', () => {
    expect(shouldGenerate('approved')).toBe(true);
  });

  it('returns true for expired tasks', () => {
    expect(shouldGenerate('expired')).toBe(true);
  });

  it('returns false for pending tasks (not terminal)', () => {
    expect(shouldGenerate('pending')).toBe(false);
  });

  it('returns false for submitted tasks (awaiting review)', () => {
    expect(shouldGenerate('submitted')).toBe(false);
  });

  it('returns false for rejected tasks (parent rejected, not auto-recurring)', () => {
    expect(shouldGenerate('rejected')).toBe(false);
  });
});

// ─── nextDueDate — daily ──────────────────────────────────────────────────────

describe('nextDueDate: daily', () => {
  it('returns tomorrow for a daily task', () => {
    const from = new Date('2025-03-19T00:00:00Z');
    expect(nextDueDate('daily', from)).toBe('2025-03-20');
  });

  it('crosses month boundary correctly', () => {
    expect(nextDueDate('daily', new Date('2025-01-31T00:00:00Z'))).toBe('2025-02-01');
  });

  it('crosses year boundary correctly', () => {
    expect(nextDueDate('daily', new Date('2024-12-31T00:00:00Z'))).toBe('2025-01-01');
  });
});

// ─── nextDueDate — weekdays ───────────────────────────────────────────────────

describe('nextDueDate: weekdays', () => {
  // 2025-03-14 is a Friday
  it('skips Saturday and Sunday after a Friday', () => {
    const friday = new Date('2025-03-14T00:00:00Z');
    expect(nextDueDate('weekdays', friday)).toBe('2025-03-17'); // Monday
  });

  // 2025-03-13 is a Thursday
  it('advances one day from a Thursday to Friday', () => {
    const thursday = new Date('2025-03-13T00:00:00Z');
    expect(nextDueDate('weekdays', thursday)).toBe('2025-03-14');
  });

  // Saturday → Monday
  it('skips Sunday from a Saturday', () => {
    const saturday = new Date('2025-03-15T00:00:00Z');
    expect(nextDueDate('weekdays', saturday)).toBe('2025-03-17');
  });

  // Sunday → Monday
  it('advances one day from a Sunday to Monday', () => {
    const sunday = new Date('2025-03-16T00:00:00Z');
    expect(nextDueDate('weekdays', sunday)).toBe('2025-03-17');
  });

  it('never lands on a Saturday (day 6)', () => {
    for (let offset = 0; offset < 7; offset++) {
      const d = new Date('2025-03-17T00:00:00Z');
      d.setUTCDate(d.getUTCDate() + offset);
      const result = nextDueDate('weekdays', d);
      expect(new Date(result + 'T00:00:00Z').getUTCDay()).not.toBe(6);
    }
  });

  it('never lands on a Sunday (day 0)', () => {
    for (let offset = 0; offset < 7; offset++) {
      const d = new Date('2025-03-17T00:00:00Z');
      d.setUTCDate(d.getUTCDate() + offset);
      const result = nextDueDate('weekdays', d);
      expect(new Date(result + 'T00:00:00Z').getUTCDay()).not.toBe(0);
    }
  });
});

// ─── nextDueDate — weekends ───────────────────────────────────────────────────

describe('nextDueDate: weekends', () => {
  // 2025-03-14 Friday → next weekend day = Saturday 2025-03-15
  it('finds next Saturday from a Friday', () => {
    expect(nextDueDate('weekends', new Date('2025-03-14T00:00:00Z'))).toBe('2025-03-15');
  });

  // Saturday → Sunday
  it('finds Sunday from a Saturday', () => {
    expect(nextDueDate('weekends', new Date('2025-03-15T00:00:00Z'))).toBe('2025-03-16');
  });

  // Sunday → next Saturday
  it('finds next Saturday from a Sunday', () => {
    expect(nextDueDate('weekends', new Date('2025-03-16T00:00:00Z'))).toBe('2025-03-22');
  });

  // Monday → Saturday
  it('finds next Saturday from a Monday', () => {
    expect(nextDueDate('weekends', new Date('2025-03-17T00:00:00Z'))).toBe('2025-03-22');
  });

  it('always lands on Sat (6) or Sun (0)', () => {
    for (let offset = 0; offset < 7; offset++) {
      const d = new Date('2025-03-17T00:00:00Z');
      d.setUTCDate(d.getUTCDate() + offset);
      const result = nextDueDate('weekends', d);
      const day = new Date(result + 'T00:00:00Z').getUTCDay();
      expect([0, 6]).toContain(day);
    }
  });
});

// ─── nextDueDate — weekly ─────────────────────────────────────────────────────

describe('nextDueDate: weekly', () => {
  it('returns exactly 7 days later', () => {
    expect(nextDueDate('weekly', new Date('2025-03-19T00:00:00Z'))).toBe('2025-03-26');
  });

  it('preserves the day-of-week', () => {
    const from = new Date('2025-03-19T00:00:00Z'); // Wednesday
    const next = nextDueDate('weekly', from);
    expect(new Date(next + 'T00:00:00Z').getUTCDay()).toBe(from.getUTCDay());
  });

  it('crosses month boundaries', () => {
    expect(nextDueDate('weekly', new Date('2025-03-28T00:00:00Z'))).toBe('2025-04-04');
  });
});

// ─── nextDueDate — monthly ────────────────────────────────────────────────────

describe('nextDueDate: monthly', () => {
  it('advances one calendar month', () => {
    expect(nextDueDate('monthly', new Date('2025-03-15T00:00:00Z'))).toBe('2025-04-15');
  });

  it('crosses year boundary', () => {
    expect(nextDueDate('monthly', new Date('2024-12-15T00:00:00Z'))).toBe('2025-01-15');
  });

  it('clamps to month-end when source day > days in target month (Jan 31 → Feb 28)', () => {
    expect(nextDueDate('monthly', new Date('2025-01-31T00:00:00Z'))).toBe('2025-02-28');
  });

  it('clamps to Feb 29 in a leap year', () => {
    expect(nextDueDate('monthly', new Date('2024-01-31T00:00:00Z'))).toBe('2024-02-29');
  });

  it('advances from Feb 28 to Mar 28 (not clamped)', () => {
    expect(nextDueDate('monthly', new Date('2025-02-28T00:00:00Z'))).toBe('2025-03-28');
  });

  it('advances from the 1st of the month correctly', () => {
    expect(nextDueDate('monthly', new Date('2025-03-01T00:00:00Z'))).toBe('2025-04-01');
  });
});

// ─── Recurrence type exhaustiveness ──────────────────────────────────────────

describe('nextDueDate: all recurrences return a future date', () => {
  const from = new Date('2025-03-19T00:00:00Z'); // Wednesday
  const recurrences: Recurrence[] = ['daily', 'weekdays', 'weekends', 'weekly', 'monthly'];

  recurrences.forEach((r) => {
    it(`${r}: returned date is after the source date`, () => {
      const next = nextDueDate(r, from);
      expect(next > '2025-03-19').toBe(true);
    });

    it(`${r}: returned date matches YYYY-MM-DD format`, () => {
      const next = nextDueDate(r, from);
      expect(next).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});
