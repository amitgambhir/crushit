import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { Profile } from '@/lib/database.types';

interface CreateKidData {
  displayName: string;
  username: string;
  pin: string;
  avatarEmoji: string;
  colorTheme: string;
}

export function useKids() {
  const { family } = useAuthStore();
  return useQuery({
    queryKey: ['kids', family?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('family_id', family!.id)
        .eq('role', 'kid')
        .order('display_name');
      if (error) throw error;
      return data as Profile[];
    },
    enabled: !!family?.id,
  });
}

export function useKidDetail(kidId: string) {
  return useQuery({
    queryKey: ['kid', kidId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', kidId)
        .single();
      if (error) throw error;
      return data as Profile;
    },
    enabled: !!kidId,
  });
}

export function useActivityLog() {
  const { family } = useAuthStore();
  return useQuery({
    queryKey: ['activity', family?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_log')
        .select('*')
        .eq('family_id', family!.id)
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return data;
    },
    enabled: !!family?.id,
  });
}

export function useStreaks(kidId: string) {
  return useQuery({
    queryKey: ['streaks', kidId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('streaks')
        .select('*')
        .eq('kid_id', kidId);
      if (error) throw error;
      return data;
    },
    enabled: !!kidId,
  });
}

export function useCreateKid() {
  const queryClient = useQueryClient();
  const { family } = useAuthStore();

  return useMutation({
    mutationFn: async (data: CreateKidData) => {
      // Calls the create-kid Edge Function which uses admin API to create the auth user
      const { data: result, error, response } = await supabase.functions.invoke('create-kid', {
        body: { ...data, familyId: family!.id },
      });
      if (error) {
        let serverMessage: string | null = null;

        try {
          if (response && typeof response.json === 'function') {
            const body = await response.json();
            if (typeof body?.error === 'string' && body.error.trim().length > 0) {
              serverMessage = body.error;
            }
          }
        } catch {
          // Fall through to the generic error below if the function body
          // cannot be parsed for any reason.
        }

        throw new Error(serverMessage || error.message || 'Failed to create kid account');
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kids', family?.id] });
    },
  });
}

/**
 * Allows a kid to update their own avatar_emoji and color_theme.
 * On success: re-fetches their profile and pushes it into the authStore so
 * the UI updates immediately without a full page reload.
 */
export function useUpdateMyProfile() {
  const queryClient = useQueryClient();
  const { profile, family, setProfile } = useAuthStore();

  return useMutation({
    mutationFn: async (updates: { avatar_emoji?: string; color_theme?: string }) => {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', profile!.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      // Re-fetch and push into Zustand so avatar/color updates instantly
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profile!.id)
        .single();
      if (data) setProfile(data as Profile);

      queryClient.invalidateQueries({ queryKey: ['kids', family?.id] });
    },
  });
}

export function useUpdateKid() {
  const queryClient = useQueryClient();
  const { family } = useAuthStore();

  return useMutation({
    mutationFn: async ({ kidId, updates }: { kidId: string; updates: Partial<Profile> }) => {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', kidId)
        .eq('family_id', family!.id);
      if (error) throw error;
    },
    onSuccess: (_data, { kidId }) => {
      queryClient.invalidateQueries({ queryKey: ['kids', family?.id] });
      queryClient.invalidateQueries({ queryKey: ['kid', kidId] });
    },
  });
}
