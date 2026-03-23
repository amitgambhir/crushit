import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Use service role key so we can create auth users
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      },
    );

    const { displayName, username, pin, avatarEmoji, colorTheme, familyId } = await req.json();

    // Validate inputs
    if (!displayName || !username || !pin || !familyId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return new Response(
        JSON.stringify({ error: 'PIN must be exactly 4 digits' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const {
      data: { user },
      error: authErr,
    } = await supabaseUser.auth.getUser();

    if (authErr || !user) {
      return new Response(
        JSON.stringify({ error: 'Not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: parentProfile, error: parentErr } = await supabaseAdmin
      .from('profiles')
      .select('id, family_id, role')
      .eq('id', user.id)
      .single();

    if (parentErr || !parentProfile) {
      return new Response(
        JSON.stringify({ error: 'Parent profile not found' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (parentProfile.role !== 'parent') {
      return new Response(
        JSON.stringify({ error: 'Only parents can create kid accounts' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (parentProfile.family_id !== familyId) {
      return new Response(
        JSON.stringify({ error: 'You can only create kid accounts in your own family' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Check username uniqueness within the family
    const { data: existing } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('username', username.toLowerCase())
      .eq('family_id', familyId)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ error: 'Username already taken in this family' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Get the family's invite_code to construct the internal email
    const { data: family, error: familyErr } = await supabaseAdmin
      .from('families')
      .select('invite_code')
      .eq('id', familyId)
      .single();

    if (familyErr || !family) {
      return new Response(
        JSON.stringify({ error: 'Family not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const internalEmail = `${username.toLowerCase()}@${family.invite_code.toLowerCase()}.crushit.internal`;

    // Create the auth user using the admin API
    const { data: authUser, error: createUserErr } = await supabaseAdmin.auth.admin.createUser({
      email: internalEmail,
      password: pin,
      email_confirm: true, // skip email confirmation for internal accounts
    });

    if (createUserErr || !authUser.user) {
      return new Response(
        JSON.stringify({ error: createUserErr?.message ?? 'Failed to create auth user' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Create the profile row
    const { error: profileErr } = await supabaseAdmin.from('profiles').insert({
      id: authUser.user.id,
      family_id: familyId,
      display_name: displayName,
      username: username.toLowerCase(),
      role: 'kid',
      avatar_emoji: avatarEmoji ?? '⭐',
      color_theme: colorTheme ?? '#FF5722',
      total_points: 0,
      lifetime_points: 0,
      level: 1,
    });

    if (profileErr) {
      // Roll back auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      return new Response(
        JSON.stringify({ error: profileErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Create one streak row per type (UNIQUE constraint requires this)
    await supabaseAdmin.from('streaks').insert([
      { kid_id: authUser.user.id, family_id: familyId, streak_type: 'daily',   current_streak: 0, longest_streak: 0 },
      { kid_id: authUser.user.id, family_id: familyId, streak_type: 'weekly',  current_streak: 0, longest_streak: 0 },
      { kid_id: authUser.user.id, family_id: familyId, streak_type: 'monthly', current_streak: 0, longest_streak: 0 },
      { kid_id: authUser.user.id, family_id: familyId, streak_type: 'yearly',  current_streak: 0, longest_streak: 0 },
    ]);

    return new Response(
      JSON.stringify({ userId: authUser.user.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
