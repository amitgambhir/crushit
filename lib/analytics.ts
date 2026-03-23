// lib/analytics.ts
// Pure analytics helpers for the parent dashboard.
// No Supabase or React imports — safe to unit-test directly.

import type { Task, ActivityLog, Profile } from './database.types';

// ─── Time helpers ─────────────────────────────────────────────────────────────

/**
 * Returns midnight UTC on the most recent Monday (start of ISO week).
 */
export function startOfWeekUTC(now = new Date()): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay(); // 0 = Sun, 1 = Mon, …
  const daysToMonday = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - daysToMonday);
  return d;
}

/**
 * Returns midnight UTC on the first day of the current month.
 */
export function startOfMonthUTC(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

// ─── Task analytics ───────────────────────────────────────────────────────────

export interface PerKidWeeklyStat {
  kidId: string;
  displayName: string;
  avatarEmoji: string;
  colorTheme: string;
  assigned: number;  // tasks created this week assigned to this kid
  completed: number; // of those, how many are now 'approved'
  rate: number;      // 0–1
}

/**
 * Filters tasks created since the start of the current ISO week.
 */
export function tasksThisWeek(tasks: Task[], now = new Date()): Task[] {
  const weekStart = startOfWeekUTC(now).toISOString();
  return tasks.filter((t) => t.created_at >= weekStart);
}

/**
 * Counts tasks approved (completed) since the start of the current ISO week.
 * Uses approved_at when available, falls back to created_at for approved tasks
 * that pre-date the approved_at column.
 */
export function completedThisWeek(tasks: Task[], now = new Date()): Task[] {
  const weekStart = startOfWeekUTC(now).toISOString();
  return tasks.filter(
    (t) =>
      t.status === 'approved' &&
      ((t.approved_at && t.approved_at >= weekStart) || t.created_at >= weekStart),
  );
}

/**
 * Per-kid stats for the current week.
 * Only includes kids who have at least one task assigned.
 */
export function perKidWeeklyStats(
  tasks: Task[],
  kids: Profile[],
  now = new Date(),
): PerKidWeeklyStat[] {
  const weekTasks = tasksThisWeek(tasks, now);

  return kids
    .map((kid) => {
      const kidTasks = weekTasks.filter((t) => t.assigned_to === kid.id);
      const completed = kidTasks.filter((t) => t.status === 'approved').length;
      return {
        kidId: kid.id,
        displayName: kid.display_name,
        avatarEmoji: kid.avatar_emoji,
        colorTheme: kid.color_theme,
        assigned: kidTasks.length,
        completed,
        rate: kidTasks.length === 0 ? 0 : completed / kidTasks.length,
      };
    })
    .filter((s) => s.assigned > 0);
}

// ─── Points analytics ─────────────────────────────────────────────────────────

/**
 * Total points awarded to kids this week (positive points_delta entries
 * in the activity log created since the start of the current week).
 */
export function pointsAwardedThisWeek(log: ActivityLog[], now = new Date()): number {
  const weekStart = startOfWeekUTC(now).toISOString();
  return log
    .filter((entry) => entry.created_at >= weekStart && entry.points_delta > 0)
    .reduce((sum, entry) => sum + entry.points_delta, 0);
}

/**
 * Total points awarded this month (positive points_delta entries in the
 * activity log created since the start of the current calendar month).
 */
export function pointsAwardedThisMonth(log: ActivityLog[], now = new Date()): number {
  const monthStart = startOfMonthUTC(now).toISOString();
  return log
    .filter((entry) => entry.created_at >= monthStart && entry.points_delta > 0)
    .reduce((sum, entry) => sum + entry.points_delta, 0);
}

/**
 * Number of unique kids who completed at least one task this week.
 */
export function activeKidsThisWeek(tasks: Task[], now = new Date()): number {
  const done = completedThisWeek(tasks, now);
  return new Set(done.map((t) => t.assigned_to).filter(Boolean)).size;
}
