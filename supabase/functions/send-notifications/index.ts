// supabase/functions/send-notifications/index.ts
// Triggered by a DB webhook on activity_log INSERT events.
// Looks up the recipient's push_token and sends an Expo push notification.
//
// Routing:
//   - KID events   → user_id in the row is the recipient
//   - PARENT events → look up the family's parent profile by family_id
//
// Expo Push API: https://docs.expo.dev/push-notifications/sending-notifications/

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  getRecipientId,
  isParentEvent,
  buildNotificationMessage,
  type ActivityLogRow,
} from '../_shared/sendNotificationsHelpers.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: ActivityLogRow;
  schema: string;
}

// ── Helper: send one Expo push notification ───────────────────────────────────

async function sendPush(
  token: string,
  title: string,
  body: string,
  data: Record<string, string>,
): Promise<void> {
  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: token, title, body, sound: 'default', data }),
  });
  if (!response.ok) {
    const text = await response.text();
    console.error('Expo push failed:', text);
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  try {
    const payload: WebhookPayload = await req.json();

    if (payload.type !== 'INSERT' || payload.table !== 'activity_log') {
      return new Response('ignored', { status: 200 });
    }

    const row = payload.record;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { title, body } = buildNotificationMessage(row);
    const pushData = { eventType: row.event_type, familyId: row.family_id };

    if (isParentEvent(row.event_type)) {
      // Parent events (task_submitted, reward_redeemed): notify ALL parents in
      // the family so co-parents both receive the notification (bug fix — was
      // using .limit(1).maybeSingle() which only reached one parent arbitrarily).
      const { data: parents } = await supabase
        .from('profiles')
        .select('push_token')
        .eq('family_id', row.family_id)
        .eq('role', 'parent')
        .not('push_token', 'is', null);

      if (!parents || parents.length === 0) {
        return new Response('no parent tokens', { status: 200 });
      }

      await Promise.all(
        parents
          .filter((p: { push_token: string | null }) => p.push_token)
          .map((p: { push_token: string }) => sendPush(p.push_token, title, body, pushData)),
      );

      return new Response('ok', { status: 200 });
    }

    // Kid event: route to the user_id on the activity_log row
    const recipientId = getRecipientId(row);
    if (!recipientId) {
      return new Response('no recipient', { status: 200 });
    }

    const { data: profileData, error: profileErr } = await supabase
      .from('profiles')
      .select('push_token')
      .eq('id', recipientId)
      .single();

    if (profileErr || !profileData?.push_token) {
      return new Response('no push token', { status: 200 });
    }

    await sendPush(profileData.push_token, title, body, pushData);

    return new Response('ok', { status: 200 });
  } catch (err) {
    console.error('send-notifications error:', err);
    return new Response('error', { status: 500 });
  }
});
