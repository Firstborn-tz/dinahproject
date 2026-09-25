// supabase/functions/create-user/index.ts
//
// Why this exists: Supabase Auth accounts (the auth.users table) can only be
// created through the Admin API, which requires the SERVICE_ROLE key — a key
// that must never reach the browser. Every other piece of business logic in
// this app lives in plain Postgres functions (see 0001_init.sql), but "create
// a login" is the one exception Supabase's architecture requires to happen
// server-side. This Edge Function is that one small server-side piece.
//
// It:
//   1. Verifies the caller sent a valid Supabase session token.
//   2. Looks up that caller's profile and rejects anyone who isn't an
//      active Manager (same rule the SQL functions enforce everywhere else).
//   3. Creates the new auth user (with email pre-confirmed, since a Manager
//      is vouching for them — no confirmation email needed).
//   4. Inserts their profile row (role, branch, name).
//   5. Writes an audit log entry.
//
// Deploy with: supabase functions deploy create-user

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
    const authHeader = req.headers.get('Authorization') ?? '';
    const callerToken = authHeader.replace('Bearer ', '');

    if (!callerToken) {
      return json({ error: 'Not authenticated.' }, 401);
    }

    // Admin client — has the service role key, used for everything below.
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Verify the caller's token is a real, current session (works for any
    // valid user token when checked through an admin-privileged client).
    const { data: callerData, error: callerErr } = await admin.auth.getUser(callerToken);
    if (callerErr || !callerData?.user) {
      return json({ error: 'Invalid session.' }, 401);
    }

    const { data: callerProfile, error: profileErr } = await admin
      .from('profiles')
      .select('role, active, full_name')
      .eq('id', callerData.user.id)
      .single();
    if (profileErr || !callerProfile || callerProfile.role !== 'MANAGER' || !callerProfile.active) {
      return json({ error: 'Only an active Manager can create user accounts.' }, 403);
    }

    const body = await req.json();
    const { email, password, role, fullName, branchId } = body ?? {};

    if (!email || !password || !role) {
      return json({ error: 'email, password and role are required.' }, 400);
    }
    if (!['MANAGER', 'CASHIER'].includes(role)) {
      return json({ error: 'role must be MANAGER or CASHIER.' }, 400);
    }
    if (String(password).length < 8) {
      return json({ error: 'Password must be at least 8 characters.' }, 400);
    }
    if (role === 'CASHIER') {
      if (!branchId) return json({ error: 'branchId is required for a cashier account.' }, 400);
      const { data: existingActive } = await admin
        .from('profiles')
        .select('id')
        .eq('branch_id', branchId)
        .eq('role', 'CASHIER')
        .eq('active', true)
        .maybeSingle();
      if (existingActive) {
        return json({ error: 'That branch already has an active cashier. Deactivate them first.' }, 409);
      }
    }

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });
    if (createErr || !created?.user) {
      return json({ error: createErr?.message || 'Could not create the account.' }, 400);
    }

    const { error: insertErr } = await admin.from('profiles').insert({
      id: created.user.id,
      full_name: fullName || email,
      role,
      branch_id: role === 'CASHIER' ? branchId : null,
      active: true
    });
    if (insertErr) {
      // Roll back the auth user so we don't leave an orphaned login with no profile.
      await admin.auth.admin.deleteUser(created.user.id);
      return json({ error: insertErr.message }, 400);
    }

    await admin.from('audit_logs').insert({
      user_id: callerData.user.id,
      username: callerProfile.full_name,
      role: 'MANAGER',
      branch_id: role === 'CASHIER' ? branchId : null,
      action: role === 'MANAGER' ? 'ADMIN_CREATE' : 'CASHIER_CREATE',
      entity: 'user',
      details: { newUserId: created.user.id, email }
    });

    return json({ id: created.user.id, email, role, branchId: branchId ?? null, fullName: fullName || email });
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
