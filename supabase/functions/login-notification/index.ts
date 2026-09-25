import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'Unauthorized.' }, 401);

  const apiKey = Deno.env.get('BREVO_API_KEY');
  const senderEmail = Deno.env.get('BREVO_SENDER_EMAIL');
  if (!apiKey || !senderEmail) return json({ error: 'Email service is not configured.' }, 503);

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user?.email) return json({ error: 'Unauthorized.' }, 401);

  const timestamp = new Intl.DateTimeFormat('en-TZ', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Dar_es_Salaam',
  }).format(new Date());
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: Deno.env.get('BREVO_SENDER_NAME') || 'Dinah Stationaries', email: senderEmail },
      to: [{ email: user.email }],
      subject: 'New login to your Dinah Stationaries account',
      textContent: `A successful login to your Dinah Stationaries account was detected on ${timestamp} (East Africa Time). If this was not you, reset your password and contact your manager.`,
    }),
  });

  if (!response.ok) {
    console.error('Brevo login notification failed:', response.status, await response.text());
    return json({ error: 'Notification delivery failed.' }, 502);
  }
  return json({ sent: true });
});
