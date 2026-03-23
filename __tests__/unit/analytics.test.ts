// __tests__/unit/analytics.test.ts
// Tests for the pure analytics helpers in lib/analytics.ts.

import {
  startOfWeekUTC,
  startOfMonthUTC,
  tasksThisWeek,
  completedThisWeek,
  perKidWeeklyStats,
  pointsAwardedThisWeek,
  pointsAwardedThisMonth,
  activeKidsThisWeek,
} from '@/lib/analytics';
import type { Task, ActivityLog, Profile } from '@/lib/database.types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

// Wednesday 2025-03-19 12:00 UTC
const NOW = new Date('2025-03-19T12:00:00Z');
// Monday of that week = 2025-03-17
const WEEK_START = '2025-03-17T00:00:00.000Z';
// First of the month = 2025-03-01
const MONTH_START = '2025-03-01T00:00:00.000Z';

function makeTask(overrides: Partial<Task> & { created_at: string }): Task {
  return {
    id: 'task-1',
    family_id: 'fam-1',
    template_id: null,
    assigned_to: 'kid-1',
    assigned_by: 'parent-1',
    title: 'Clean room',
    description: null,
    category: 'chores',
    icon: '🧹',
    points: 10,
    due_date: null,
    recurrence: 'once',
    recurrence_day: null,
    status: 'pending',
    requires_photo_proof: false,
    proof_photo_url: null,
    proof_note: null,
    completed_at: null,
    approved_at: null,
    approved_by: null,
    rejection_reason: null,
    ...overrides,
  };
}

function makeLog(overrides: Partial<ActivityLog> & { created_at: string }): ActivityLog {
  return {
    id: 'log-1',
    family_id: 'fam-1',
    user_id: 'kid-1',
    event_type: 'task_completed',
    title: 'Task done',
    body: null,
    points_delta: 10,
    metadata: null,
    ...overrides,
  };
}

function makeKid(id: string, overrides: Partial<Profile> = {}): Profile {
  return {
    id,
    family_id: 'fam-1',
    display_name: `Kid ${id}`,
    username: id,
    role: 'kid',
    avatar_url: null,
    avatar_emoji: '⭐',
    total_points: 0,
    lifetime_points: 0,
    level: 1,
    xp: 0,
    date_of_birth: null,
    color_theme: '#6C63FF',
    created_at: '2025-01-01T00:00:00Z',
    last_active: '2025-01-01T00:00:00Z',
    push_token: null,
    ...overrides,
  };
}

// ─── startOfWeekUTC ────────────────────────────────────────────────────────────

describe('startOfWeekUTC', () => {
  it('Wednesday → preceding Monday', () => {
    const d = startOfWeekUTC(NOW); // Wed 2025-03-19
    expect(d.toISOString()).toBe(WEEK_START);
  });

  it('Monday → same day', () => {
    const mon = new Date('2025-03-17T08:00:00Z');
    const d = startOfWeekUTC(mon);
    expect(d.toISOString()).toBe(WEEK_START);
  });

  it('Sunday → preceding Monday (6 days back)', () => {
    const sun = new Date('2025-03-23T00:00:00Z');
    const d = startOfWeekUTC(sun);
    expect(d.toISOString()).toBe('2025-03-17T00:00:00.000Z');
  });

  it('returns midnight UTC', () => {
    const d = startOfWeekUTC(NOW);
    expect(d.getUTCHours()).toBe(0);
    expect(d.getUTCMinutes()).toBe(0);
    expect(d.getUTCSeconds()).toBe(0);
  });
});

// ─── startOfMonthUTC ──────────────────────────────────────────────────────────

describe('startOfMonthUTC', () => {
  it('returns the 1st of the current month at midnight UTC', () => {
    const d = startOfMonthUTC(NOW);
    expect(d.toISOString()).toBe(MONTH_START);
  });

  it('handles January correctly', () => {
    const jan = new Date('2025-01-15T10:00:00Z');
    const d = startOfMonthUTC(jan);
    expect(d.toISOString()).toBe('2025-01-01T00:00:00.000Z');
  });
});

// ─── tasksThisWeek ────────────────────────────────────────────────────────────

describe('tasksThisWeek', () => {
  const inWeek  = makeTask({ created_at: '2025-03-18T10:00:00Z' }); // Tuesday
  const onMonday = makeTask({ id: 'task-2', created_at: WEEK_START });
  const beforeWeek = makeTask({ id: 'task-3', created_at: '2025-03-16T23:59:59Z' }); // Sunday

  it('includes tasks created on or after Monday', () => {
    expect(tasksThisWeek([inWeek, onMonday, beforeWeek], NOW)).toHaveLength(2);
  });

  it('excludes tasks created before Monday', () => {
    const result = tasksThisWeek([beforeWeek], NOW);
    expect(result).toHaveLength(0);
  });

  it('returns empty array when no tasks', () => {
    expect(tasksThisWeek([], NOW)).toHaveLength(0);
  });
});

// ─── completedThisWeek ────────────────────────────────────────────────────────

describe('completedThisWeek', () => {
  const approvedThisWeek = makeTask({
    id: 't1',
    created_at: '2025-03-18T00:00:00Z',
    status: 'approved',
    approved_at: '2025-03-18T10:00:00Z',
  });
  const pendingThisWeek = makeTask({
    id: 't2',
    created_at: '2025-03-18T00:00:00Z',
    status: 'pending',
  });
  const approvedLastWeek = makeTask({
    id: 't3',
    created_at: '2025-03-10T00:00:00Z',
    status: 'approved',
    approved_at: '2025-03-10T10:00:00Z',
  });

  it('counts only approved tasks with approved_at in this week', () => {
    const result = completedThisWeek([approvedThisWeek, pendingThisWeek, approvedLastWeek], NOW);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t1');
  });

  it('returns 0 when no tasks are approved this week', () => {
    expect(completedThisWeek([pendingThisWeek], NOW)).toHaveLength(0);
  });
});

// ─── perKidWeeklyStats ────────────────────────────────────────────────────────

describe('perKidWeeklyStats', () => {
  const kid1 = makeKid('kid-1', { color_theme: '#FF5722' });
  const kid2 = makeKid('kid-2', { color_theme: '#00C853' });

  const tasks = [
    makeTask({ id: 't1', assigned_to: 'kid-1', created_at: '2025-03-18T00:00:00Z', status: 'approved', approved_at: '2025-03-18T10:00:00Z' }),
    makeTask({ id: 't2', assigned_to: 'kid-1', created_at: '2025-03-18T00:00:00Z', status: 'pending' }),
    makeTask({ id: 't3', assigned_to: 'kid-2', created_at: '2025-03-18T00:00:00Z', status: 'approved', approved_at: '2025-03-18T11:00:00Z' }),
    makeTask({ id: 't4', assigned_to: 'kid-2', created_at: '2025-03-18T00:00:00Z', status: 'approved', approved_at: '2025-03-18T12:00:00Z' }),
  ];

  it('returns stats for each kid with tasks this week', () => {
    const stats = perKidWeeklyStats(tasks, [kid1, kid2], NOW);
    expect(stats).toHaveLength(2);
  });

  it('computes correct completion counts', () => {
    const stats = perKidWeeklyStats(tasks, [kid1, kid2], NOW);
    const s1 = stats.find((s) => s.kidId === 'kid-1')!;
    const s2 = stats.find((s) => s.kidId === 'kid-2')!;

    expect(s1.assigned).toBe(2);
    expect(s1.completed).toBe(1);
    expect(s1.rate).toBeCloseTo(0.5);

    expect(s2.assigned).toBe(2);
    expect(s2.completed).toBe(2);
    expect(s2.rate).toBeCloseTo(1);
  });

  it('excludes kids with no tasks this week', () => {
    const stats = perKidWeeklyStats(tasks, [kid1, kid2, makeKid('kid-3')], NOW);
    expect(stats.find((s) => s.kidId === 'kid-3')).toBeUndefined();
  });

  it('returns empty when no tasks this week', () => {
    expect(perKidWeeklyStats([], [kid1], NOW)).toHaveLength(0);
  });

  it('includes colorTheme for progress bar rendering', () => {
    const stats = perKidWeeklyStats(tasks, [kid1], NOW);
    expect(stats[0].colorTheme).toBe('#FF5722');
  });
});

// ─── pointsAwardedThisWeek ────────────────────────────────────────────────────

describe('pointsAwardedThisWeek', () => {
  const thisWeek  = makeLog({ created_at: '2025-03-18T10:00:00Z', points_delta: 25 });
  const lastWeek  = makeLog({ id: 'l2', created_at: '2025-03-10T10:00:00Z', points_delta: 50 });
  const negative  = makeLog({ id: 'l3', created_at: '2025-03-18T10:00:00Z', points_delta: -10 });
  const zeroEntry = makeLog({ id: 'l4', created_at: '2025-03-18T10:00:00Z', points_delta: 0 });

  it('sums positive points_delta entries from this week', () => {
    expect(pointsAwardedThisWeek([thisWeek, lastWeek], NOW)).toBe(25);
  });

  it('excludes negative deltas (redemptions)', () => {
    expect(pointsAwardedThisWeek([thisWeek, negative], NOW)).toBe(25);
  });

  it('excludes zero-delta entries', () => {
    expect(pointsAwardedThisWeek([zeroEntry], NOW)).toBe(0);
  });

  it('returns 0 when no entries this week', () => {
    expect(pointsAwardedThisWeek([lastWeek], NOW)).toBe(0);
  });

  it('sums multiple entries', () => {
    const second = makeLog({ id: 'l5', created_at: '2025-03-19T08:00:00Z', points_delta: 15 });
    expect(pointsAwardedThisWeek([thisWeek, second], NOW)).toBe(40);
  });
});

// ─── pointsAwardedThisMonth ───────────────────────────────────────────────────

describe('pointsAwardedThisMonth', () => {
  const thisMonth  = makeLog({ created_at: '2025-03-05T10:00:00Z', points_delta: 30 });
  const lastMonth  = makeLog({ id: 'l2', created_at: '2025-02-28T10:00:00Z', points_delta: 100 });

  it('sums positive deltas from this calendar month', () => {
    expect(pointsAwardedThisMonth([thisMonth, lastMonth], NOW)).toBe(30);
  });

  it('returns 0 when log is empty', () => {
    expect(pointsAwardedThisMonth([], NOW)).toBe(0);
  });
});

// ─── activeKidsThisWeek ───────────────────────────────────────────────────────

describe('activeKidsThisWeek', () => {
  const tasks = [
    makeTask({ id: 't1', assigned_to: 'kid-1', created_at: '2025-03-18T00:00:00Z', status: 'approved', approved_at: '2025-03-18T10:00:00Z' }),
    makeTask({ id: 't2', assigned_to: 'kid-1', created_at: '2025-03-18T00:00:00Z', status: 'approved', approved_at: '2025-03-18T11:00:00Z' }),
    makeTask({ id: 't3', assigned_to: 'kid-2', created_at: '2025-03-18T00:00:00Z', status: 'approved', approved_at: '2025-03-18T12:00:00Z' }),
  ];

  it('counts unique kids with at least one approved task this week', () => {
    expect(activeKidsThisWeek(tasks, NOW)).toBe(2);
  });

  it('deduplicates the same kid with multiple approved tasks', () => {
    const doubled = [tasks[0], tasks[1]]; // both kid-1
    expect(activeKidsThisWeek(doubled, NOW)).toBe(1);
  });

  it('returns 0 when no approved tasks this week', () => {
    const pending = makeTask({ created_at: '2025-03-18T00:00:00Z', status: 'pending' });
    expect(activeKidsThisWeek([pending], NOW)).toBe(0);
  });
});
