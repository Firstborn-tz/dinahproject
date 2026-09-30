// supabase/functions/admin-reset-password/index.ts
//
// Lets an active Manager set a new password for any user (typically a branch
// cashier who forgot theirs). Changing another person's password requires
// Supabase's Admin API and the service role key, which must never reach the
// browser — so, like create-user, this lives in an Edge Function.
//
// Deploy with: supabase functions deploy admin-reset-password

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const callerToken = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    if (!callerToken) return json({ error: 'Not authenticated.' }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: callerData, error: callerErr } = await admin.auth.getUser(callerToken);
    if (callerErr || !callerData?.user) return json({ error: 'Invalid session.' }, 401);

    const { data: callerProfile } = await admin
      .from('profiles')
      .select('role, active, full_name')
      .eq('id', callerData.user.id)
      .single();
    if (!callerProfile || callerProfile.role !== 'MANAGER' || !callerProfile.active) {
      return json({ error: 'Only an active Manager can reset passwords.' }, 403);
    }

    const { userId, newPassword } = (await req.json()) ?? {};
    if (!userId || !newPassword) return json({ error: 'userId and newPassword are required.' }, 400);
    if (String(newPassword).length < 8) return json({ error: 'Password must be at least 8 characters.' }, 400);

    const { data: target } = await admin
      .from('profiles')
      .select('id, full_name, branch_id')
      .eq('id', userId)
      .maybeSingle();
    if (!target) return json({ error: 'That user does not exist.' }, 404);

    const { error: updateErr } = await admin.auth.admin.updateUserById(userId, { password: newPassword });
    if (updateErr) return json({ error: updateErr.message }, 400);

    await admin.from('audit_logs').insert({
      user_id: callerData.user.id,
      username: callerProfile.full_name,
      role: 'MANAGER',
      branch_id: target.branch_id,
      action: 'PASSWORD_RESET_BY_ADMIN',
      entity: 'user',
      details: { targetUserId: userId, targetName: target.full_name }
    });

    return json({ ok: true });
  } catch (err) {
    console.error(err);
    return json({ error: 'Unexpected server error.' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
