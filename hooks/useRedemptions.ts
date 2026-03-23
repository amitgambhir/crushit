// hooks/useRedemptions.ts
// Kid-facing redemption history hook.
// Parent-facing hooks (usePendingRedemptions, useApproveRedemption, etc.) live in useRewards.ts.

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { RedemptionWithDetails } from '@/hooks/useRewards';

export type RedemptionStatus = 'pending' | 'approved' | 'rejected' | 'fulfilled';

/**
 * All redemptions for a specific kid, ordered most-recent first.
 * Joins reward details so the history card can show icon + title.
 */
export function useKidRedemptions(kidId: string | undefined) {
  return useQuery<RedemptionWithDetails[]>({
    queryKey: ['kid-redemptions', kidId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('redemptions')
        .select(`
          *,
          reward:rewards(id, title, icon, cost_points, category),
          kid:profiles!kid_id(id, display_name, avatar_emoji, color_theme)
        `)
        .eq('kid_id', kidId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as RedemptionWithDetails[];
    },
    enabled: !!kidId,
    staleTime: 30_000,
  });
}

/**
 * Maps a redemption status to a human-readable label and colour token.
 */
export function redemptionStatusMeta(status: string): {
  label: string;
  color: string;
  icon: string;
} {
  switch (status) {
    case 'pending':   return { label: 'Waiting',   color: '#FF9800', icon: '⏳' };
    case 'approved':  return { label: 'Approved',  color: '#FFD600', icon: '✅' };
    case 'fulfilled': return { label: 'Delivered', color: '#00C853', icon: '🎁' };
    case 'rejected':  return { label: 'Not this time', color: '#FF1744', icon: '❌' };
    default:          return { label: status,       color: '#9E9E9E', icon: '❓' };
  }
}
