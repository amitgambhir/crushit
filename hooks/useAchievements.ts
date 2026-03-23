// hooks/useAchievements.ts
// Achievement data hooks — Phase 2.

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Achievement, KidAchievement } from '@/lib/database.types';

export interface AchievementWithStatus extends Achievement {
  earned: boolean;
  unlocked_at: string | null;
}

/**
 * Returns all 22 achievement definitions annotated with whether this kid
 * has earned each one.
 */
export function useKidAchievements(kidId: string | undefined) {
  return useQuery<AchievementWithStatus[]>({
    queryKey: ['achievements', kidId],
    queryFn: async () => {
      const [catalogueResult, earnedResult] = await Promise.all([
        supabase.from('achievements').select('*').order('condition_value', { ascending: true }),
        supabase
          .from('kid_achievements')
          .select('achievement_id, unlocked_at')
          .eq('kid_id', kidId!),
      ]);

      if (catalogueResult.error) throw catalogueResult.error;

      const earnedMap = new Map<string, string>(
        (earnedResult.data ?? []).map((ka: Pick<KidAchievement, 'achievement_id' | 'unlocked_at'>) => [
          ka.achievement_id,
          ka.unlocked_at,
        ])
      );

      return (catalogueResult.data ?? []).map((a: Achievement) => ({
        ...a,
        earned: earnedMap.has(a.id),
        unlocked_at: earnedMap.get(a.id) ?? null,
      }));
    },
    enabled: !!kidId,
    staleTime: 30_000,
  });
}

/**
 * Returns the most recently earned achievement for a kid.
 * Used by the Realtime celebration to show badge name.
 */
export function useLatestAchievement(kidId: string | undefined) {
  return useQuery<(KidAchievement & { achievement: Achievement }) | null>({
    queryKey: ['latest-achievement', kidId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kid_achievements')
        .select('*, achievement:achievements(*)')
        .eq('kid_id', kidId!)
        .order('unlocked_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!kidId,
  });
}
