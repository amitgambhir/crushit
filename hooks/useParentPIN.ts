// hooks/useParentPIN.ts
// Parent PIN lock — set, verify, and check existence via Postgres RPCs (migration 011).
//
// AD-005: PIN is stored as a bcrypt hash server-side; the plaintext never leaves the client.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';

/** Returns true when the current parent has a PIN set (pin_hash IS NOT NULL). */
export function useHasParentPIN() {
  const { profile } = useAuthStore();

  return useQuery({
    queryKey: ['parent-pin-set', profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('has_parent_pin');
      if (error) throw error;
      return data as boolean;
    },
    enabled: !!profile?.id && profile.role === 'parent',
    staleTime: 60_000, // 1 min — changes only when parent sets/removes PIN
  });
}

/**
 * Mutation: set (or change) the parent PIN.
 * Calls the set_parent_pin(p_pin) RPC which validates 4 digits and bcrypt-hashes.
 * On success, invalidates the has-pin query so the gate rechecks.
 */
export function useSetParentPIN() {
  const queryClient = useQueryClient();
  const { profile } = useAuthStore();

  return useMutation({
    mutationFn: async (pin: string) => {
      const { error } = await supabase.rpc('set_parent_pin', { p_pin: pin });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parent-pin-set', profile?.id] });
    },
  });
}

/**
 * Mutation: verify the parent PIN.
 * Returns true on match, false on mismatch.
 * Throws on DB error.
 */
export function useVerifyParentPIN() {
  return useMutation({
    mutationFn: async (pin: string): Promise<boolean> => {
      const { data, error } = await supabase.rpc('verify_parent_pin', { p_pin: pin });
      if (error) throw error;
      return data as boolean;
    },
  });
}
