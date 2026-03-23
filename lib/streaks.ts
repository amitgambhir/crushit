// lib/streaks.ts
// ─────────────────────────────────────────────────────────────────────────────
// Phase 2 — Streak calculation helpers.
//
// The check-streaks Edge Function (cron, midnight) owns streak mutation.
// This file provides client-side helpers for displaying streak state and
// computing progress toward the next streak milestone.
//
// TODO (Phase 2): implement these functions.
// ─────────────────────────────────────────────────────────────────────────────

export type StreakType = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface StreakRow {
  id: string;
  kid_id: string;
  family_id: string;
  streak_type: StreakType;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
  streak_start_date: string | null;
}

/** Milestone counts that trigger streak_rewards unlock checks. */
export const STREAK_MILESTONES: Record<StreakType, number[]> = {
  daily:   [3, 7, 14, 30, 60, 100],
  weekly:  [4, 8, 12, 26, 52],
  monthly: [3, 6, 12],
  yearly:  [1, 2, 3],
};

/**
 * Returns the next milestone for a given streak type and current count.
 *
 * TODO (Phase 2): implement.
 */
export function nextMilestone(streakType: StreakType, current: number): number | null {
  const milestones = STREAK_MILESTONES[streakType];
  return milestones.find((m) => m > current) ?? null;
}

/**
 * Returns 0–1 progress toward the next milestone.
 *
 * TODO (Phase 2): implement.
 */
export function streakMilestoneProgress(streakType: StreakType, current: number): number {
  const next = nextMilestone(streakType, current);
  if (!next) return 1;
  const milestones = STREAK_MILESTONES[streakType];
  const prev = [...milestones].reverse().find((m) => m <= current) ?? 0;
  return (current - prev) / (next - prev);
}
