// lib/achievements.ts
// ─────────────────────────────────────────────────────────────────────────────
// Achievement evaluation helpers (client-side mirror of DB logic).
//
// The DB seeds 22 achievement definitions in 004_seed_achievements.sql.
// Unlocking happens server-side after approve_task() fires, but the UI needs
// to know which badges a kid has earned and which are locked.
// ─────────────────────────────────────────────────────────────────────────────

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  condition_type: string;
  condition_value: number;
  points_reward: number;
  is_secret: boolean;
}

export interface KidAchievement {
  achievement_id: string;
  kid_id: string;
  unlocked_at: string;
  achievement: Achievement;
}

export type KidStats = {
  tasksCompleted: number;
  lifetimePoints: number;
  level: number;
  streakDays: number;
  redemptions?: number;
  choreTasks?: number;
  schoolTasks?: number;
  healthTasks?: number;
  kindnessTasks?: number;
  weeklyPerfect?: number;
  siblingTasks?: number;
};

/**
 * Returns the display label for an achievement's condition, e.g.
 * "Complete 10 tasks" or "Reach Level 5".
 *
 * Condition types come from 004_seed_achievements.sql:
 *   tasks_completed, streak_days, points_earned, level_reached,
 *   redemptions, chore_tasks, school_tasks, health_tasks,
 *   kindness_tasks, weekly_perfect, sibling_tasks
 */
export function achievementConditionLabel(achievement: Achievement): string {
  const n = achievement.condition_value;
  switch (achievement.condition_type) {
    case 'tasks_completed': return `Complete ${n} task${n !== 1 ? 's' : ''}`;
    case 'streak_days':     return `Maintain a ${n}-day streak`;
    case 'points_earned':   return `Earn ${n} Crush Points`;
    case 'level_reached':   return `Reach Level ${n}`;
    case 'redemptions':     return `Redeem ${n} reward${n !== 1 ? 's' : ''}`;
    case 'chore_tasks':     return `Complete ${n} chore tasks`;
    case 'school_tasks':    return `Complete ${n} school tasks`;
    case 'health_tasks':    return `Complete ${n} health tasks`;
    case 'kindness_tasks':  return `Complete ${n} kindness tasks`;
    case 'weekly_perfect':  return 'Complete all tasks in a week';
    case 'sibling_tasks':   return `Help a sibling ${n} time${n !== 1 ? 's' : ''}`;
    default:                return achievement.description;
  }
}

/**
 * Returns 0–1 progress toward an achievement given a kid's current stats.
 * Clamped to [0, 1]; returns 1.0 once the threshold is met.
 */
export function achievementProgress(
  achievement: Achievement,
  stats: KidStats,
): number {
  const n = achievement.condition_value;
  let current = 0;

  switch (achievement.condition_type) {
    case 'tasks_completed': current = stats.tasksCompleted;              break;
    case 'streak_days':     current = stats.streakDays;                  break;
    case 'points_earned':   current = stats.lifetimePoints;              break;
    case 'level_reached':   current = stats.level;                       break;
    case 'redemptions':     current = stats.redemptions ?? 0;            break;
    case 'chore_tasks':     current = stats.choreTasks ?? 0;             break;
    case 'school_tasks':    current = stats.schoolTasks ?? 0;            break;
    case 'health_tasks':    current = stats.healthTasks ?? 0;            break;
    case 'kindness_tasks':  current = stats.kindnessTasks ?? 0;          break;
    case 'weekly_perfect':  current = stats.weeklyPerfect ?? 0;          break;
    case 'sibling_tasks':   current = stats.siblingTasks ?? 0;           break;
    default:                return 0;
  }

  return Math.min(1, current / n);
}
