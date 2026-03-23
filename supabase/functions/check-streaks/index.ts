// supabase/functions/check-streaks/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// Daily cron Edge Function — runs at 00:05 UTC every day.
// Scheduled via Supabase Dashboard → Edge Functions → check-streaks → Schedule:
//   cron: "5 0 * * *"
//
// Responsibilities:
//   1. Reset daily streaks for kids who missed yesterday.
//   2. On Mondays:  evaluate weekly streaks for the week that just ended.
//   3. On the 1st: evaluate monthly streaks for the month that just ended.
//   4. On Jan 1st: evaluate yearly streaks for the year that just ended.
//   5. For each updated streak that hits a milestone: unlock streak_reward,
//      award bonus points, log streak_milestone activity.
//
// Pure decision helpers live in _shared/checkStreaksHelpers.ts so they can be
// tested by Jest without pulling in Deno-specific imports.
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  isMondayUTC,
  isFirstOfMonthUTC,
  isJanFirstUTC,
  shouldResetDailyStreak,
  evaluateWeeklyStreak,
  evaluateMonthlyStreak,
  evaluateYearlyStreak,
  lastWeekRange,
  lastMonthRange,
  lastYearRange,
} from '../_shared/checkStreaksHelpers.ts';

// Re-export pure helpers so tests can import from this file path if needed
export {
  isMondayUTC,
  isFirstOfMonthUTC,
  isJanFirstUTC,
  shouldResetDailyStreak,
  evaluateWeeklyStreak,
  evaluateMonthlyStreak,
  evaluateYearlyStreak,
  lastWeekRange,
  lastMonthRange,
  lastYearRange,
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface StreakRow {
  id: string;
  kid_id: string;
  family_id: string;
  streak_type: string;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
  streak_start_date: string | null;
}

interface StreakRewardRow {
  id: string;
  family_id: string;
  streak_type: string;
  required_streak: number;
  reward_title: string;
  bonus_points: number;
}

// ─── serve ───────────────────────────────────────────────────────────────────

serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const now       = new Date();
  const today     = now.toISOString().slice(0, 10);
  const yesterday = new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10);

  const results = {
    daily_resets:       0,
    weekly_increments:  0,
    weekly_resets:      0,
    monthly_increments: 0,
    monthly_resets:     0,
    yearly_increments:  0,
    yearly_resets:      0,
    rewards_unlocked:   0,
    errors:             [] as string[],
  };

  // ── 1. Reset daily streaks for kids who missed yesterday ─────────────────

  const { data: dailyStreaks, error: dsErr } = await supabase
    .from('streaks')
    .select('*')
    .eq('streak_type', 'daily')
    .gt('current_streak', 0);

  if (dsErr) {
    results.errors.push(`daily fetch: ${dsErr.message}`);
  } else {
    for (const row of (dailyStreaks ?? []) as StreakRow[]) {
      if (shouldResetDailyStreak(row.last_activity_date, yesterday)) {
        const { error } = await supabase
          .from('streaks')
          .update({ current_streak: 0, updated_at: new Date().toISOString() })
          .eq('id', row.id);
        if (error) results.errors.push(`reset daily ${row.id}: ${error.message}`);
        else results.daily_resets++;
      }
    }
  }

  // Helper: award bonus points directly (service role — auth.uid() is NULL so
  // auth-hardened RPCs cannot be used; direct table write is safe here).
  // Also checks for a level-up and logs it atomically.
  async function awardBonusPoints(
    kidId: string,
    familyId: string,
    points: number,
    reason: string,
  ) {
    const { data: kid } = await supabase
      .from('profiles')
      .select('total_points, lifetime_points, xp, level')
      .eq('id', kidId)
      .single();

    if (!kid) return;

    const newTotal    = (kid.total_points    ?? 0) + points;
    const newLifetime = (kid.lifetime_points ?? 0) + points;
    const newXp       = (kid.xp             ?? 0) + points;

    await supabase.from('profiles').update({
      total_points:    newTotal,
      lifetime_points: newLifetime,
      xp:              newXp,
    }).eq('id', kidId);

    // Check for level-up using the DB's calculate_level() function
    const { data: newLevel } = await supabase.rpc('calculate_level', {
      p_lifetime_points: newLifetime,
    });

    if (newLevel && newLevel > kid.level) {
      await supabase.from('profiles').update({ level: newLevel }).eq('id', kidId);
      await supabase.from('activity_log').insert({
        family_id:  familyId,
        user_id:    kidId,
        event_type: 'level_up',
        title:      `Level ${newLevel}!`,
        body:       `You reached level ${newLevel}!`,
        metadata:   { level: newLevel },
      });
    }

    // Log the points award
    await supabase.from('activity_log').insert({
      family_id:    familyId,
      user_id:      kidId,
      event_type:   'points_awarded',
      title:        `+${points} Crush Points`,
      body:         reason,
      points_delta: points,
      metadata:     { points },
    });
  }

  // Helper: check & unlock streak rewards after a streak update
  async function checkStreakRewards(
    kidId: string,
    familyId: string,
    streakType: string,
    newStreak: number,
  ) {
    const { data: rewards } = await supabase
      .from('streak_rewards')
      .select('*')
      .eq('family_id', familyId)
      .eq('streak_type', streakType)
      .eq('required_streak', newStreak);

    for (const sr of (rewards ?? []) as StreakRewardRow[]) {
      const { data: existing } = await supabase
        .from('streak_reward_unlocks')
        .select('id')
        .eq('streak_reward_id', sr.id)
        .eq('kid_id', kidId)
        .maybeSingle();

      if (existing) continue;

      await supabase.from('streak_reward_unlocks').insert({
        streak_reward_id:     sr.id,
        kid_id:               kidId,
        bonus_points_awarded: sr.bonus_points,
      });

      if (sr.bonus_points > 0) {
        await awardBonusPoints(
          kidId,
          familyId,
          sr.bonus_points,
          `${newStreak}-${streakType} streak milestone reward`,
        );
      }

      await supabase.from('activity_log').insert({
        family_id:    familyId,
        user_id:      kidId,
        event_type:   'streak_milestone',
        title:        `${newStreak}-${streakType} streak! 🔥`,
        body:         `Unlocked: ${sr.reward_title}${sr.bonus_points > 0 ? ` (+${sr.bonus_points} pts)` : ''}`,
        points_delta: sr.bonus_points,
        metadata:     { streak_type: streakType, streak_count: newStreak, reward_id: sr.id },
      });

      results.rewards_unlocked++;
    }
  }

  // ── 2. Weekly streaks (every Monday) ─────────────────────────────────────

  if (isMondayUTC(now)) {
    const { weekStart, weekEnd } = lastWeekRange(now);
    const { data: weeklyStreaks, error: wsErr } = await supabase
      .from('streaks').select('*').eq('streak_type', 'weekly');

    if (wsErr) {
      results.errors.push(`weekly fetch: ${wsErr.message}`);
    } else {
      for (const row of (weeklyStreaks ?? []) as StreakRow[]) {
        const action = evaluateWeeklyStreak(row.last_activity_date, weekStart, weekEnd);
        if (action === 'increment') {
          const newStreak = row.current_streak + 1;
          await supabase.from('streaks').update({
            current_streak: newStreak,
            longest_streak: Math.max(row.longest_streak, newStreak),
            updated_at:     new Date().toISOString(),
          }).eq('id', row.id);
          results.weekly_increments++;
          await checkStreakRewards(row.kid_id, row.family_id, 'weekly', newStreak);
        } else {
          await supabase.from('streaks').update({ current_streak: 0, updated_at: new Date().toISOString() }).eq('id', row.id);
          results.weekly_resets++;
        }
      }
    }
  }

  // ── 3. Monthly streaks (1st of each month) ────────────────────────────────

  if (isFirstOfMonthUTC(now)) {
    const { monthStart, monthEnd } = lastMonthRange(now);
    const { data: monthlyStreaks, error: msErr } = await supabase
      .from('streaks').select('*').eq('streak_type', 'monthly');

    if (msErr) {
      results.errors.push(`monthly fetch: ${msErr.message}`);
    } else {
      for (const row of (monthlyStreaks ?? []) as StreakRow[]) {
        const action = evaluateMonthlyStreak(row.last_activity_date, monthStart, monthEnd);
        if (action === 'increment') {
          const newStreak = row.current_streak + 1;
          await supabase.from('streaks').update({
            current_streak: newStreak,
            longest_streak: Math.max(row.longest_streak, newStreak),
            updated_at:     new Date().toISOString(),
          }).eq('id', row.id);
          results.monthly_increments++;
          await checkStreakRewards(row.kid_id, row.family_id, 'monthly', newStreak);
        } else {
          await supabase.from('streaks').update({ current_streak: 0, updated_at: new Date().toISOString() }).eq('id', row.id);
          results.monthly_resets++;
        }
      }
    }
  }

  // ── 4. Yearly streaks (Jan 1st) ───────────────────────────────────────────

  if (isJanFirstUTC(now)) {
    const { yearStart, yearEnd } = lastYearRange(now);
    const { data: yearlyStreaks, error: ysErr } = await supabase
      .from('streaks').select('*').eq('streak_type', 'yearly');

    if (ysErr) {
      results.errors.push(`yearly fetch: ${ysErr.message}`);
    } else {
      for (const row of (yearlyStreaks ?? []) as StreakRow[]) {
        const action = evaluateYearlyStreak(row.last_activity_date, yearStart, yearEnd);
        if (action === 'increment') {
          const newStreak = row.current_streak + 1;
          await supabase.from('streaks').update({
            current_streak: newStreak,
            longest_streak: Math.max(row.longest_streak, newStreak),
            updated_at:     new Date().toISOString(),
          }).eq('id', row.id);
          results.yearly_increments++;
          await checkStreakRewards(row.kid_id, row.family_id, 'yearly', newStreak);
        } else {
          await supabase.from('streaks').update({ current_streak: 0, updated_at: new Date().toISOString() }).eq('id', row.id);
          results.yearly_resets++;
        }
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, today, ...results }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
