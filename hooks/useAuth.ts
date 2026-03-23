import { useState } from 'react';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase, kidEmail } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { Profile, Family } from '@/lib/database.types';

export function useAuth() {
  const { setSession, setProfile, setFamily, reset } = useAuthStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function clearError() {
    setError(null);
  }

  // ─── Load profile + family for the current session user ───────────────────
  async function loadProfile(userId: string): Promise<Profile | null> {
    const { data, error: err } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (err || !data) return null;
    setProfile(data as Profile);

    if (data.family_id) {
      const { data: familyData } = await supabase
        .from('families')
        .select('*')
        .eq('id', data.family_id)
        .single();

      if (familyData) setFamily(familyData as Family);
    }

    return data as Profile;
  }

  // ─── Parent: sign in with email + password ─────────────────────────────────
  async function signInWithEmail(email: string, password: string) {
    setIsSubmitting(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) throw err;
      if (data.session) {
        setSession(data.session);
        await loadProfile(data.session.user.id);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setIsSubmitting(false);
    }
  }

  // ─── Parent: sign up with email + password ─────────────────────────────────
  async function signUpWithEmail(email: string, password: string, displayName: string) {
    setIsSubmitting(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.auth.signUp({ email, password });
      if (err) throw err;
      if (!data.user) throw new Error('Sign up failed — no user returned');

      // Create profile (role set to parent by default for account creators)
      const { error: profileErr } = await supabase.from('profiles').insert({
        id: data.user.id,
        display_name: displayName,
        role: 'parent',
      });
      if (profileErr) throw profileErr;

      // Seed the new parent profile into local state immediately so the auth
      // guard can route to /family-setup even if the first profile re-fetch
      // races or momentarily returns null.
      setProfile({
        id: data.user.id,
        family_id: null,
        display_name: displayName,
        username: null,
        role: 'parent',
        avatar_url: null,
        avatar_emoji: '⭐',
        total_points: 0,
        lifetime_points: 0,
        level: 1,
        xp: 0,
        date_of_birth: null,
        color_theme: 'blue',
        created_at: new Date().toISOString(),
        last_active: new Date().toISOString(),
        push_token: null,
      } as Profile);
      setFamily(null);

      if (data.session) {
        setSession(data.session);
        await loadProfile(data.user.id);
      } else {
        setError('Account created but no session — check Supabase email confirmation setting');
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : (err as { message?: string })?.message ?? 'Sign up failed';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  // ─── Parent: Apple Sign-In (iOS only) ─────────────────────────────────────
  async function signInWithApple() {
    setIsSubmitting(true);
    setError(null);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) throw new Error('No identity token from Apple');

      const { data, error: err } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });
      if (err) throw err;

      if (data.session) {
        setSession(data.session);
        const profile = await loadProfile(data.session.user.id);

        // First-time Apple sign-in: create profile if it doesn't exist
        if (!profile) {
          const displayName =
            credential.fullName?.givenName
              ? `${credential.fullName.givenName} ${credential.fullName.familyName ?? ''}`.trim()
              : 'Parent';

          await supabase.from('profiles').insert({
            id: data.session.user.id,
            display_name: displayName,
            role: 'parent',
          });
          await loadProfile(data.session.user.id);
        }
      }
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'ERR_REQUEST_CANCELED') return; // user cancelled
      setError(err instanceof Error ? err.message : 'Apple Sign-In failed');
    } finally {
      setIsSubmitting(false);
    }
  }

  // ─── Kid: sign in with family name + username + PIN ───────────────────────
  // Kid accounts have an internal email: {username}@{invite_code}.crushit.internal
  // The PIN is used as the Supabase password. See AD-005, AD-011, AD-012.
  // Family name is required to scope username lookup — prevents kids from
  // guessing usernames belonging to other families.
  async function signInAsKid(familyName: string, username: string, pin: string) {
    setIsSubmitting(true);
    setError(null);
    try {
      // Step 1: resolve invite_code via family name + username (anon RPC)
      const { data: rows, error: lookupErr } = await supabase
        .rpc('get_kid_login_info', { p_family_name: familyName, p_username: username });

      const inviteCode = Array.isArray(rows) ? rows[0]?.invite_code : rows?.invite_code;
      if (lookupErr || !inviteCode) {
        throw new Error('Family or username not found');
      }

      const internalEmail = kidEmail(username, inviteCode);

      // Step 2: sign in with the constructed email + PIN as password
      const { data, error: signInErr } = await supabase.auth.signInWithPassword({
        email: internalEmail,
        password: pin,
      });
      if (signInErr) throw new Error('Incorrect PIN');

      if (data.session) {
        setSession(data.session);
        await loadProfile(data.session.user.id);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  }

  // ─── Create family (parent, post sign-up) ─────────────────────────────────
  async function createFamily(name: string) {
    setIsSubmitting(true);
    setError(null);
    try {
      const { data: family, error: familyErr } = await supabase
        .rpc('create_family', { p_name: name })
        .single();
      if (familyErr) throw familyErr;

      setFamily(family as Family);

      // Refresh profile
      await loadProfile((useAuthStore.getState().session?.user.id ?? ''));
      return family as Family;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not create family');
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }

  // ─── Join family with invite code ─────────────────────────────────────────
  async function joinFamily(inviteCode: string) {
    setIsSubmitting(true);
    setError(null);
    try {
      const { data: family, error: lookupErr } = await supabase
        .rpc('join_family', { p_invite_code: inviteCode })
        .single();
      if (lookupErr || !family) throw new Error('Invalid invite code');

      setFamily(family as Family);
      await loadProfile((useAuthStore.getState().session?.user.id ?? ''));
      return family as Family;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not join family');
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }

  // ─── Sign out ──────────────────────────────────────────────────────────────
  async function signOut() {
    await supabase.auth.signOut();
    reset();
  }

  return {
    isSubmitting,
    error,
    clearError,
    loadProfile,
    signInWithEmail,
    signUpWithEmail,
    signInWithApple,
    signInAsKid,
    createFamily,
    joinFamily,
    signOut,
  };
}
