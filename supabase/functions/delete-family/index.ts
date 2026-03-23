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
    // Verify the caller is authenticated and is a parent of the family
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Verify the caller's JWT and get their user ID
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userErr } = await supabaseClient.auth.getUser();
    if (userErr || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { familyId } = await req.json();

    // Verify the caller is a parent in this family
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('role, family_id')
      .eq('id', user.id)
      .single();

    if (profileErr || !profile || profile.role !== 'parent' || profile.family_id !== familyId) {
      return new Response(
        JSON.stringify({ error: 'Forbidden — only a parent of this family can delete it' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Collect all auth user IDs for this family (kids + parents)
    const { data: members } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('family_id', familyId);

    const memberIds = (members ?? []).map((m) => m.id);

    // Delete family data in dependency order
    // (FK cascade handles most of it, but we explicitly delete to be safe)
    await supabaseAdmin.from('redemptions').delete().in('kid_id', memberIds);
    await supabaseAdmin.from('tasks').delete().eq('family_id', familyId);
    await supabaseAdmin.from('rewards').delete().eq('family_id', familyId);
    await supabaseAdmin.from('streaks').delete().eq('family_id', familyId);
    await supabaseAdmin.from('activity_log').delete().eq('family_id', familyId);
    await supabaseAdmin.from('profiles').delete().eq('family_id', familyId);
    await supabaseAdmin.from('families').delete().eq('id', familyId);

    // Delete all auth users (kids and parents)
    for (const uid of memberIds) {
      await supabaseAdmin.auth.admin.deleteUser(uid);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
