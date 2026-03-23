import { create } from 'zustand';
import { Session } from '@supabase/supabase-js';
import { Profile, Family } from '@/lib/database.types';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  family: Family | null;
  isLoading: boolean;
  /** True once the parent has entered the correct PIN this session. Resets on sign-out. */
  isPINVerified: boolean;

  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  setFamily: (family: Family | null) => void;
  setLoading: (isLoading: boolean) => void;
  setPINVerified: (verified: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  profile: null,
  family: null,
  isLoading: true,
  isPINVerified: false,

  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),
  setFamily: (family) => set({ family }),
  setLoading: (isLoading) => set({ isLoading }),
  setPINVerified: (verified) => set({ isPINVerified: verified }),
  reset: () => set({ session: null, profile: null, family: null, isLoading: false, isPINVerified: false }),
}));
