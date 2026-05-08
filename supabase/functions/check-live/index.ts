import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

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

  const hostname = new URL(req.url).searchParams.get("hostname");
  if (!hostname) {
    return new Response(JSON.stringify({ error: "hostname required" }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  let live = false;
  try {
    const probe = await fetch(`http://${hostname}/robots.txt`, {
      method: "HEAD",
      headers: { "User-Agent": "GPTBot/1.0 (+https://openai.com/gptbot)" },
      signal: AbortSignal.timeout(8000),
    });
    // CF-Ray header is injected by Cloudflare on every proxied request
    live = probe.headers.get("cf-ray") !== null;
  } catch {
    live = false;
  }

  if (live) {
    await supabase
      .from("customers")
      .update({ onboarded_at: new Date().toISOString() })
      .eq("hostname", hostname)
      .eq("user_id", user.id)
      .is("onboarded_at", null);
  }

  return new Response(JSON.stringify({ live }), {
    status: 200, headers: { ...CORS, "Content-Type": "application/json" },
  });
});
