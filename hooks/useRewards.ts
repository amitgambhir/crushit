import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { Reward, RewardTemplate, RewardCategory } from '@/lib/database.types';

interface CreateRewardData {
  templateId?: string;
  title: string;
  description?: string;
  category: RewardCategory;
  icon: string;
  costPoints: number;
  availableTo?: string[] | null;
  quantityAvailable?: number | null;
  isSurprise?: boolean;
  expiresAt?: string | null;
}

export type RedemptionWithDetails = {
  id: string;
  reward_id: string;
  kid_id: string;
  points_spent: number;
  status: string;
  parent_note: string | null;
  fulfilled_at: string | null;
  created_at: string;
  reward: Pick<Reward, 'id' | 'title' | 'icon' | 'cost_points' | 'category'>;
  kid: { id: string; display_name: string; avatar_emoji: string; color_theme: string };
};

export function useRewards() {
  const { family } = useAuthStore();
  return useQuery({
    queryKey: ['rewards', family?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rewards')
        .select('*')
        .eq('family_id', family!.id)
        .eq('is_active', true)
        .order('cost_points');
      if (error) throw error;
      return data as Reward[];
    },
    enabled: !!family?.id,
  });
}

export function useRewardTemplates() {
  const { family } = useAuthStore();
  return useQuery({
    queryKey: ['reward-templates', family?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reward_templates')
        .select('*')
        .or(`family_id.is.null,family_id.eq.${family!.id}`)
        .eq('is_active', true)
        .order('category')
        .order('title');
      if (error) throw error;
      return data as RewardTemplate[];
    },
    enabled: !!family?.id,
  });
}

export function usePendingRedemptions() {
  const { family } = useAuthStore();
  return useQuery({
    queryKey: ['redemptions', family?.id, 'pending'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('redemptions')
        .select(`
          *,
          reward:rewards(id, title, icon, cost_points, category),
          kid:profiles!kid_id(id, display_name, avatar_emoji, color_theme)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;
      // Family scoping is enforced by RLS; this hook only asks for pending rows.
      return data as RedemptionWithDetails[];
    },
    enabled: !!family?.id,
  });
}

export function useCreateReward() {
  const queryClient = useQueryClient();
  const { family, profile } = useAuthStore();

  return useMutation({
    mutationFn: async (data: CreateRewardData) => {
      const { error } = await supabase.from('rewards').insert({
        family_id: family!.id,
        template_id: data.templateId ?? null,
        title: data.title,
        description: data.description ?? null,
        category: data.category,
        icon: data.icon,
        cost_points: data.costPoints,
        available_to: data.availableTo ?? null,
        quantity_available: data.quantityAvailable ?? null,
        is_surprise: data.isSurprise ?? false,
        expires_at: data.expiresAt ?? null,
        created_by: profile!.id,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rewards', family?.id] });
    },
  });
}

export function useApproveRedemption() {
  const queryClient = useQueryClient();
  const { family } = useAuthStore();

  return useMutation({
    mutationFn: async (redemptionId: string) => {
      const { error } = await supabase
        .from('redemptions')
        .update({ status: 'approved' })
        .eq('id', redemptionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['redemptions', family?.id] });
    },
  });
}

export function useRejectRedemption() {
  const queryClient = useQueryClient();
  const { family } = useAuthStore();

  return useMutation({
    mutationFn: async ({ redemptionId, note }: { redemptionId: string; note: string }) => {
      // Caller identity from auth.uid() server-side (migration 014).
      const { error } = await supabase.rpc('reject_redemption', {
        p_redemption_id: redemptionId,
        p_note:          note,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['redemptions', family?.id] });
      queryClient.invalidateQueries({ queryKey: ['kids', family?.id] });
    },
  });
}

export function useFulfillRedemption() {
  const queryClient = useQueryClient();
  const { family } = useAuthStore();

  return useMutation({
    mutationFn: async (redemptionId: string) => {
      // Caller identity from auth.uid() server-side (migration 014).
      const { error } = await supabase.rpc('fulfill_redemption', { p_redemption_id: redemptionId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['redemptions', family?.id] });
    },
  });
}

// Called by kid — routes through the redeem_reward() Postgres RPC (AD-001).
// Kid identity resolved from auth.uid() server-side (migration 014).
export function useRedeemReward() {
  const queryClient = useQueryClient();
  const { family } = useAuthStore();

  return useMutation({
    mutationFn: async (rewardId: string) => {
      const { error } = await supabase.rpc('redeem_reward', { p_reward_id: rewardId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rewards', family?.id] });
      queryClient.invalidateQueries({ queryKey: ['kids', family?.id] });
      queryClient.invalidateQueries({ queryKey: ['activity', family?.id] });
    },
  });
}
