import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const LS_WEBHOOK_SECRET = Deno.env.get("LEMON_SQUEEZY_WEBHOOK_SECRET")!;

async function verifySignature(body: string, signature: string): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(LS_WEBHOOK_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const sigBytes = Uint8Array.from(
      signature.match(/.{2}/g)!.map((h) => parseInt(h, 16)),
    );
    return await crypto.subtle.verify("HMAC", key, sigBytes, new TextEncoder().encode(body));
  } catch {
    return false;
  }
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const signature = req.headers.get("X-Signature") ?? "";
  const body = await req.text();

  if (!(await verifySignature(body, signature))) {
    return new Response("Invalid signature", { status: 403 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(body);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const meta = payload.meta as Record<string, unknown> | undefined;
  const data = payload.data as Record<string, unknown> | undefined;
  const eventName = meta?.event_name as string | undefined;
  const customData = meta?.custom_data as Record<string, string> | undefined;
  const cfClientId = customData?.customer_id;

  const attrs = data?.attributes as Record<string, unknown> | undefined;
  const lsSubscriptionId = String(data?.id ?? "");
  const rawTier = ((attrs?.product_name as string | undefined) ?? "").toLowerCase();
  const tier = (["starter", "growth", "pro"].find((t) => rawTier.includes(t)) ?? "starter") as "starter" | "growth" | "pro";
  const lsStatus = attrs?.status as string | undefined;
  const currentPeriodEnd = attrs?.renews_at as string | undefined;

  if (!cfClientId) {
    console.warn("ls-webhook: missing customer_id in custom_data");
    return new Response("OK", { status: 200 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("cf_client_id", cfClientId)
    .single();

  if (!customer) {
    console.warn("ls-webhook: no customer for cf_client_id", cfClientId);
    return new Response("OK", { status: 200 });
  }

  if (eventName === "subscription_created" || eventName === "subscription_updated") {
    const status = lsStatus === "active" ? "active" : "paused";
    await supabase.from("subscriptions").upsert({
      customer_id: (customer as { id: string }).id,
      ls_subscription_id: lsSubscriptionId,
      tier,
      status,
      current_period_end: currentPeriodEnd ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "ls_subscription_id" });

  } else if (eventName === "subscription_cancelled" || eventName === "subscription_expired") {
    const status = eventName === "subscription_cancelled" ? "cancelled" : "expired";
    await supabase.from("subscriptions")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("ls_subscription_id", lsSubscriptionId);
  }

  return new Response("OK", { status: 200 });
});
