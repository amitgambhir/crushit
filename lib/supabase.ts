import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ─── Kid auth helpers ──────────────────────────────────────────────────────────
// Kids don't have real email addresses. We construct an internal email from their
// username + family invite_code so Supabase Auth handles the session correctly
// while RLS still scopes data to the family. See AD-005 in CLAUDE.md.

export function kidEmail(username: string, inviteCode: string): string {
  return `${username.toLowerCase()}@${inviteCode.toLowerCase()}.crushit.internal`;
}
