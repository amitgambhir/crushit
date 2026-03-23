// hooks/useStreakRewards.ts
// Streak reward hooks — Phase 2.
//
// Parents use useStreakRewards to manage milestone rewards per streak type.
// Kids use useKidUnlockedStreakRewards to see rewards they've already unlocked.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import type { StreakType } from '@/lib/streaks';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StreakReward {
  id:                 string;
  family_id:          string;
  streak_type:        StreakType;
  required_streak:    number;
  reward_title:       string;
  reward_description: string | null;
  bonus_points:       number;
  is_surprise:        boolean;
  surprise_icon:      string;
  actual_icon:        string | null;
  created_by:         string | null;
  created_at:         string;
}

export interface StreakRewardUnlock {
  id:                   string;
  streak_reward_id:     string;
  kid_id:               string;
  unlocked_at:          string;
  bonus_points_awarded: number;
  streak_reward:        StreakReward;
}

export interface CreateStreakRewardInput {
  streak_type:        StreakType;
  required_streak:    number;
  reward_title:       string;
  reward_description?: string;
  bonus_points?:      number;
  is_surprise?:       boolean;
  actual_icon?:       string;
}

// ─── Parent hooks ─────────────────────────────────────────────────────────────

/**
 * All streak rewards configured by this family, optionally filtered by type.
 */
export function useStreakRewards(streakType?: StreakType) {
  const { family } = useAuthStore();
  return useQuery<StreakReward[]>({
    queryKey: ['streak-rewards', family?.id, streakType],
    queryFn: async () => {
      let q = supabase
        .from('streak_rewards')
        .select('*')
        .eq('family_id', family!.id);
      if (streakType) q = q.eq('streak_type', streakType);
      const { data, error } = await q
        .order('streak_type')
        .order('required_streak');
      if (error) throw error;
      return data as StreakReward[];
    },
    enabled: !!family?.id,
  });
}

/**
 * Create a new streak reward milestone for this family.
 */
export function useCreateStreakReward() {
  const { family, profile } = useAuthStore();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateStreakRewardInput) => {
      const { data, error } = await supabase
        .from('streak_rewards')
        .insert({
          family_id:          family!.id,
          streak_type:        input.streak_type,
          required_streak:    input.required_streak,
          reward_title:       input.reward_title,
          reward_description: input.reward_description ?? null,
          bonus_points:       input.bonus_points ?? 0,
          is_surprise:        input.is_surprise ?? true,
          actual_icon:        input.actual_icon ?? null,
          created_by:         profile!.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data as StreakReward;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['streak-rewards', family?.id] });
    },
  });
}

/**
 * Delete a streak reward milestone (parent only).
 */
export function useDeleteStreakReward() {
  const { family } = useAuthStore();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (rewardId: string) => {
      const { error } = await supabase
        .from('streak_rewards')
        .delete()
        .eq('id', rewardId)
        .eq('family_id', family!.id); // belt-and-suspenders RLS guard
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['streak-rewards', family?.id] });
    },
  });
}

// ─── Kid hooks ────────────────────────────────────────────────────────────────

/**
 * Returns streak reward unlock records for a kid, with the parent-visible
 * reward details joined.  Ordered most-recent first.
 */
export function useKidUnlockedStreakRewards(kidId: string | undefined) {
  return useQuery<StreakRewardUnlock[]>({
    queryKey: ['streak-reward-unlocks', kidId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('streak_reward_unlocks')
        .select('*, streak_reward:streak_rewards(*)')
        .eq('kid_id', kidId!)
        .order('unlocked_at', { ascending: false });
      if (error) throw error;
      return data as StreakRewardUnlock[];
    },
    enabled: !!kidId,
  });
}
