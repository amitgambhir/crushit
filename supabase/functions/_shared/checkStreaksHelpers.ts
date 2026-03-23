// supabase/functions/_shared/checkStreaksHelpers.ts
// Pure helper functions for the check-streaks Edge Function.
// Imported by both the Deno Edge Function and Jest tests (via lib/ re-export).

/**
 * Returns true if today (UTC) is Monday — triggers weekly streak evaluation
 * for the week that just ended (Mon–Sun).
 */
export function isMondayUTC(date = new Date()): boolean {
  return date.getUTCDay() === 1;
}

/**
 * Returns true if today (UTC) is the 1st of the month — triggers monthly
 * streak evaluation.
 */
export function isFirstOfMonthUTC(date = new Date()): boolean {
  return date.getUTCDate() === 1;
}

/**
 * Returns true if today (UTC) is 1 Jan — triggers yearly streak evaluation.
 */
export function isJanFirstUTC(date = new Date()): boolean {
  return date.getUTCMonth() === 0 && date.getUTCDate() === 1;
}

/**
 * Determines whether a daily streak row should be reset because the kid
 * missed yesterday.
 *
 * Rules:
 *   - last_activity_date IS NULL or '' → nothing to reset (never started)
 *   - last_activity_date = yesterday   → streak was updated, fine
 *   - last_activity_date < yesterday   → missed at least one day → reset
 */
export function shouldResetDailyStreak(
  lastActivityDate: string | null,
  yesterday: string,
): boolean {
  if (!lastActivityDate) return false;
  return lastActivityDate < yesterday;
}

/**
 * Determines whether a weekly streak should be incremented or reset.
 * Called on Monday with the date range (Mon–Sun) of the week that just ended.
 */
export function evaluateWeeklyStreak(
  lastActivityDate: string | null,
  weekStart: string,
  weekEnd: string,
): 'increment' | 'reset' {
  if (!lastActivityDate) return 'reset';
  return lastActivityDate >= weekStart && lastActivityDate <= weekEnd
    ? 'increment'
    : 'reset';
}

/**
 * Determines whether a monthly streak should be incremented or reset.
 * Called on the 1st with the date range of the month that just ended.
 */
export function evaluateMonthlyStreak(
  lastActivityDate: string | null,
  monthStart: string,
  monthEnd: string,
): 'increment' | 'reset' {
  if (!lastActivityDate) return 'reset';
  return lastActivityDate >= monthStart && lastActivityDate <= monthEnd
    ? 'increment'
    : 'reset';
}

/**
 * Determines whether a yearly streak should be incremented or reset.
 * Called on Jan 1st with the date range of the year that just ended.
 */
export function evaluateYearlyStreak(
  lastActivityDate: string | null,
  yearStart: string,
  yearEnd: string,
): 'increment' | 'reset' {
  if (!lastActivityDate) return 'reset';
  return lastActivityDate >= yearStart && lastActivityDate <= yearEnd
    ? 'increment'
    : 'reset';
}

/**
 * Returns the date range (Mon–Sun) for the week that ended yesterday.
 * Call this on a Monday.
 */
export function lastWeekRange(today = new Date()): { weekStart: string; weekEnd: string } {
  const sunday = new Date(today);
  sunday.setUTCDate(today.getUTCDate() - 1); // yesterday = Sunday
  const monday = new Date(sunday);
  monday.setUTCDate(sunday.getUTCDate() - 6); // Monday of that week
  return {
    weekStart: monday.toISOString().slice(0, 10),
    weekEnd:   sunday.toISOString().slice(0, 10),
  };
}

/**
 * Returns the date range for the month that just ended.
 * Call this on the 1st of the month.
 */
export function lastMonthRange(today = new Date()): { monthStart: string; monthEnd: string } {
  const firstOfThisMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const lastOfPrevMonth  = new Date(firstOfThisMonth.getTime() - 86_400_000);
  const firstOfPrevMonth = new Date(Date.UTC(lastOfPrevMonth.getUTCFullYear(), lastOfPrevMonth.getUTCMonth(), 1));
  return {
    monthStart: firstOfPrevMonth.toISOString().slice(0, 10),
    monthEnd:   lastOfPrevMonth.toISOString().slice(0, 10),
  };
}

/**
 * Returns the date range for the year that just ended.
 * Call this on Jan 1st.
 */
export function lastYearRange(today = new Date()): { yearStart: string; yearEnd: string } {
  const lastYear = today.getUTCFullYear() - 1;
  return {
    yearStart: `${lastYear}-01-01`,
    yearEnd:   `${lastYear}-12-31`,
  };
}
