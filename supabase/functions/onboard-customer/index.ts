import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CF_ACCOUNT_ID = Deno.env.get("CF_ACCOUNT_ID")!;
const CF_API_TOKEN = Deno.env.get("CF_API_TOKEN")!;
const CF_KV_NAMESPACE_ID = Deno.env.get("CF_KV_NAMESPACE_ID")!;
const WORKER_CNAME = Deno.env.get("WORKER_CNAME")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response("Unauthorized", { status: 401 });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser(
    authHeader.replace("Bearer ", ""),
  );
  if (authError || !user) return new Response("Unauthorized", { status: 401 });

  let hostname: string, upstream_url: string;
  try {
    ({ hostname, upstream_url } = await req.json());
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  if (!hostname || !upstream_url) {
    return new Response(JSON.stringify({ error: "hostname and upstream_url required" }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(hostname)) {
    return new Response(JSON.stringify({ error: "Invalid hostname format. Use: acme.com" }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const cfClientId = `cus_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;

  const kvRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces/${CF_KV_NAMESPACE_ID}/values/${encodeURIComponent(`client-config:${hostname}`)}`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${CF_API_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ upstreamUrl: upstream_url, clientId: cfClientId, tier: "trial" }),
    },
  );

  if (!kvRes.ok) {
    const body = await kvRes.text();
    return new Response(JSON.stringify({ error: `CF KV write failed: ${body}` }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const { error: insertError } = await supabase.from("customers").insert({
    user_id: user.id,
    hostname,
    upstream_url,
    cf_client_id: cfClientId,
    trial_ends_at: trialEndsAt,
  });

  if (insertError) {
    return new Response(JSON.stringify({ error: insertError.message }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ cname_target: WORKER_CNAME, cf_client_id: cfClientId }), {
    status: 200, headers: { ...CORS, "Content-Type": "application/json" },
  });
});
