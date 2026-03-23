// hooks/useNotifications.ts
// Registers for push notifications on app boot and persists the Expo push token
// to profiles.push_token so the send-notifications Edge Function can dispatch
// to this device.

import { useState, useEffect, useRef } from 'react';
import { registerForPushNotifications } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';

export function useNotifications() {
  const { profile } = useAuthStore();
  const [pushToken, setPushToken] = useState<string | null>(null);
  const registeredRef = useRef(false);

  useEffect(() => {
    // Only run once per session; skip if no profile yet
    if (registeredRef.current || !profile?.id) return;
    registeredRef.current = true;

    async function register() {
      const token = await registerForPushNotifications();
      if (!token) return;

      setPushToken(token);

      // Persist to DB so the Edge Function can look it up by profile id
      await supabase
        .from('profiles')
        .update({ push_token: token })
        .eq('id', profile!.id);
    }

    register();
  }, [profile?.id]);

  return { pushToken };
}
