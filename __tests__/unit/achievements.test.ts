// __tests__/unit/achievements.test.ts
// Tests for achievementConditionLabel and achievementProgress in lib/achievements.ts.
// All condition_type values come from 004_seed_achievements.sql.

import {
  achievementConditionLabel,
  achievementProgress,
  type Achievement,
  type KidStats,
} from '@/lib/achievements';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeAchievement(overrides: Partial<Achievement> = {}): Achievement {
  return {
    id: 'ach-1',
    title: 'Test',
    description: 'Test description',
    icon: '🏆',
    condition_type: 'tasks_completed',
    condition_value: 10,
    points_reward: 50,
    is_secret: false,
    ...overrides,
  };
}

const ZERO_STATS: KidStats = {
  tasksCompleted: 0,
  lifetimePoints: 0,
  level: 0,
  streakDays: 0,
};

// ─── achievementConditionLabel ────────────────────────────────────────────────

describe('achievementConditionLabel', () => {
  it('tasks_completed — singular', () => {
    const a = makeAchievement({ condition_type: 'tasks_completed', condition_value: 1 });
    expect(achievementConditionLabel(a)).toBe('Complete 1 task');
  });

  it('tasks_completed — plural', () => {
    const a = makeAchievement({ condition_type: 'tasks_completed', condition_value: 25 });
    expect(achievementConditionLabel(a)).toBe('Complete 25 tasks');
  });

  it('streak_days', () => {
    const a = makeAchievement({ condition_type: 'streak_days', condition_value: 7 });
    expect(achievementConditionLabel(a)).toBe('Maintain a 7-day streak');
  });

  it('points_earned', () => {
    const a = makeAchievement({ condition_type: 'points_earned', condition_value: 500 });
    expect(achievementConditionLabel(a)).toBe('Earn 500 Crush Points');
  });

  it('level_reached', () => {
    const a = makeAchievement({ condition_type: 'level_reached', condition_value: 10 });
    expect(achievementConditionLabel(a)).toBe('Reach Level 10');
  });

  it('redemptions — singular', () => {
    const a = makeAchievement({ condition_type: 'redemptions', condition_value: 1 });
    expect(achievementConditionLabel(a)).toBe('Redeem 1 reward');
  });

  it('redemptions — plural', () => {
    const a = makeAchievement({ condition_type: 'redemptions', condition_value: 5 });
    expect(achievementConditionLabel(a)).toBe('Redeem 5 rewards');
  });

  it('chore_tasks', () => {
    const a = makeAchievement({ condition_type: 'chore_tasks', condition_value: 50 });
    expect(achievementConditionLabel(a)).toBe('Complete 50 chore tasks');
  });

  it('school_tasks', () => {
    const a = makeAchievement({ condition_type: 'school_tasks', condition_value: 50 });
    expect(achievementConditionLabel(a)).toBe('Complete 50 school tasks');
  });

  it('health_tasks', () => {
    const a = makeAchievement({ condition_type: 'health_tasks', condition_value: 30 });
    expect(achievementConditionLabel(a)).toBe('Complete 30 health tasks');
  });

  it('kindness_tasks', () => {
    const a = makeAchievement({ condition_type: 'kindness_tasks', condition_value: 20 });
    expect(achievementConditionLabel(a)).toBe('Complete 20 kindness tasks');
  });

  it('weekly_perfect — ignores condition_value (always same label)', () => {
    const a = makeAchievement({ condition_type: 'weekly_perfect', condition_value: 1 });
    expect(achievementConditionLabel(a)).toBe('Complete all tasks in a week');
  });

  it('sibling_tasks — singular', () => {
    const a = makeAchievement({ condition_type: 'sibling_tasks', condition_value: 1 });
    expect(achievementConditionLabel(a)).toBe('Help a sibling 1 time');
  });

  it('sibling_tasks — plural', () => {
    const a = makeAchievement({ condition_type: 'sibling_tasks', condition_value: 10 });
    expect(achievementConditionLabel(a)).toBe('Help a sibling 10 times');
  });

  it('unknown condition_type falls back to achievement description', () => {
    const a = makeAchievement({ condition_type: 'future_type', description: 'Some future badge' });
    expect(achievementConditionLabel(a)).toBe('Some future badge');
  });
});

// ─── achievementProgress ─────────────────────────────────────────────────────

describe('achievementProgress', () => {
  it('returns 0 when stats are all zero', () => {
    const a = makeAchievement({ condition_type: 'tasks_completed', condition_value: 10 });
    expect(achievementProgress(a, ZERO_STATS)).toBe(0);
  });

  it('returns 1 when the threshold is exactly met', () => {
    const a = makeAchievement({ condition_type: 'tasks_completed', condition_value: 10 });
    expect(achievementProgress(a, { ...ZERO_STATS, tasksCompleted: 10 })).toBe(1);
  });

  it('clamps to 1 when stats exceed the threshold', () => {
    const a = makeAchievement({ condition_type: 'tasks_completed', condition_value: 10 });
    expect(achievementProgress(a, { ...ZERO_STATS, tasksCompleted: 50 })).toBe(1);
  });

  it('returns fractional progress', () => {
    const a = makeAchievement({ condition_type: 'tasks_completed', condition_value: 100 });
    expect(achievementProgress(a, { ...ZERO_STATS, tasksCompleted: 25 })).toBe(0.25);
  });

  it('streak_days uses streakDays stat', () => {
    const a = makeAchievement({ condition_type: 'streak_days', condition_value: 30 });
    expect(achievementProgress(a, { ...ZERO_STATS, streakDays: 15 })).toBeCloseTo(0.5);
  });

  it('points_earned uses lifetimePoints stat', () => {
    const a = makeAchievement({ condition_type: 'points_earned', condition_value: 1000 });
    expect(achievementProgress(a, { ...ZERO_STATS, lifetimePoints: 250 })).toBe(0.25);
  });

  it('level_reached uses level stat', () => {
    const a = makeAchievement({ condition_type: 'level_reached', condition_value: 10 });
    expect(achievementProgress(a, { ...ZERO_STATS, level: 5 })).toBe(0.5);
  });

  it('redemptions defaults to 0 when not in stats', () => {
    const a = makeAchievement({ condition_type: 'redemptions', condition_value: 1 });
    expect(achievementProgress(a, ZERO_STATS)).toBe(0);
  });

  it('redemptions reads stats.redemptions', () => {
    const a = makeAchievement({ condition_type: 'redemptions', condition_value: 1 });
    expect(achievementProgress(a, { ...ZERO_STATS, redemptions: 1 })).toBe(1);
  });

  it('chore_tasks reads stats.choreTasks', () => {
    const a = makeAchievement({ condition_type: 'chore_tasks', condition_value: 50 });
    expect(achievementProgress(a, { ...ZERO_STATS, choreTasks: 10 })).toBe(0.2);
  });

  it('school_tasks reads stats.schoolTasks', () => {
    const a = makeAchievement({ condition_type: 'school_tasks', condition_value: 50 });
    expect(achievementProgress(a, { ...ZERO_STATS, schoolTasks: 25 })).toBe(0.5);
  });

  it('health_tasks reads stats.healthTasks', () => {
    const a = makeAchievement({ condition_type: 'health_tasks', condition_value: 30 });
    expect(achievementProgress(a, { ...ZERO_STATS, healthTasks: 30 })).toBe(1);
  });

  it('kindness_tasks reads stats.kindnessTasks', () => {
    const a = makeAchievement({ condition_type: 'kindness_tasks', condition_value: 20 });
    expect(achievementProgress(a, { ...ZERO_STATS, kindnessTasks: 10 })).toBe(0.5);
  });

  it('weekly_perfect reads stats.weeklyPerfect', () => {
    const a = makeAchievement({ condition_type: 'weekly_perfect', condition_value: 1 });
    expect(achievementProgress(a, { ...ZERO_STATS, weeklyPerfect: 1 })).toBe(1);
  });

  it('sibling_tasks reads stats.siblingTasks', () => {
    const a = makeAchievement({ condition_type: 'sibling_tasks', condition_value: 10 });
    expect(achievementProgress(a, { ...ZERO_STATS, siblingTasks: 5 })).toBe(0.5);
  });

  it('unknown condition_type returns 0', () => {
    const a = makeAchievement({ condition_type: 'future_type', condition_value: 1 });
    expect(achievementProgress(a, ZERO_STATS)).toBe(0);
  });
});

// ─── Invariants ───────────────────────────────────────────────────────────────

describe('achievementProgress invariants', () => {
  const ALL_TYPES = [
    'tasks_completed', 'streak_days', 'points_earned', 'level_reached',
    'redemptions', 'chore_tasks', 'school_tasks', 'health_tasks',
    'kindness_tasks', 'weekly_perfect', 'sibling_tasks',
  ];
  const MAX_STATS: KidStats = {
    tasksCompleted: 9999, lifetimePoints: 99999, level: 99, streakDays: 999,
    redemptions: 999, choreTasks: 999, schoolTasks: 999, healthTasks: 999,
    kindnessTasks: 999, weeklyPerfect: 99, siblingTasks: 999,
  };

  it('progress is always in [0, 1] regardless of stats', () => {
    ALL_TYPES.forEach((ct) => {
      const a = makeAchievement({ condition_type: ct, condition_value: 10 });
      const p = achievementProgress(a, MAX_STATS);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    });
  });

  it('all known condition_types produce a non-empty label', () => {
    ALL_TYPES.forEach((ct) => {
      const a = makeAchievement({ condition_type: ct, condition_value: 5, description: 'fallback' });
      expect(achievementConditionLabel(a).length).toBeGreaterThan(0);
    });
  });
});
