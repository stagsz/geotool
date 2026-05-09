import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { isAccessGranted } from "../lib/access";

const TIERS = [
  { key: "starter", label: "Starter", monthly: 199, annual: 159, domains: "1 domain", requests: "100k req/mo", history: "30-day history" },
  { key: "growth", label: "Growth", monthly: 599, annual: 479, domains: "5 domains", requests: "500k req/mo", history: "90-day history + Slack alerts" },
  { key: "pro", label: "Pro", monthly: 1499, annual: 1199, domains: "Unlimited domains", requests: "2M req/mo", history: "1-year history + API access" },
] as const;

const LS_URLS: Record<string, { monthly: string; annual: string }> = {
  starter: { monthly: import.meta.env.VITE_LS_STARTER_MONTHLY_URL as string, annual: import.meta.env.VITE_LS_STARTER_ANNUAL_URL as string },
  growth: { monthly: import.meta.env.VITE_LS_GROWTH_MONTHLY_URL as string, annual: import.meta.env.VITE_LS_GROWTH_ANNUAL_URL as string },
  pro: { monthly: import.meta.env.VITE_LS_PRO_MONTHLY_URL as string, annual: import.meta.env.VITE_LS_PRO_ANNUAL_URL as string },
};

export default function Billing() {
  const navigate = useNavigate();
  const { user, customers, subscription } = useAuth();
  const customer = customers.find((c) => c.onboarded_at != null) ?? customers[0];
  const email = encodeURIComponent(user?.email ?? "");
  const cfClientId = encodeURIComponent(customer?.cf_client_id ?? "");

  const trialEndsAt = customer?.trial_ends_at ?? null;
  const daysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000))
    : null;

  const hasAccess = isAccessGranted({ trialEndsAt, subscriptionStatus: subscription?.status ?? null });

  function checkoutUrl(tierKey: string, period: "monthly" | "annual") {
    const base = LS_URLS[tierKey]?.[period] ?? "";
    return `${base}?checkout[email]=${email}&checkout[custom][customer_id]=${cfClientId}`;
  }

  return (
    <main className="main" style={{ maxWidth: 760, margin: "40px auto", padding: "0 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
        <button className="btn" onClick={() => navigate("/dashboard")} style={{ fontSize: "12px" }}>
          ← Dashboard
        </button>
        <h1 style={{ color: "#c8cde8", fontSize: "18px", fontWeight: 600, fontFamily: "IBM Plex Mono, monospace" }}>
          Billing
        </h1>
      </div>

      <div className="panel" style={{ marginBottom: "24px" }}>
        <div className="panel-header"><span className="panel-title">Current plan</span></div>
        <div style={{ padding: "16px", color: "#c8cde8" }}>
          {subscription?.status === "active" ? (
            <p>
              <strong>{subscription.tier.toUpperCase()}</strong> — renews{" "}
              {new Date(subscription.current_period_end).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>
          ) : daysLeft !== null && daysLeft > 0 ? (
            <p>Free trial — <strong>{daysLeft} day{daysLeft !== 1 ? "s" : ""} remaining</strong></p>
          ) : (
            <p style={{ color: "#e85050" }}>Trial expired. Choose a plan below to restore access.</p>
          )}
        </div>
      </div>

      {(!hasAccess || subscription?.status !== "active") && (
        <>
          <p style={{ color: "#6b7194", marginBottom: "16px", fontSize: "13px" }}>
            All plans include bot detection, JS pre-rendering, content transformation, and citation tracking.
            <br />Overage: $0.002 per request above included volume.
          </p>
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
            {TIERS.map((tier) => (
              <div key={tier.key} className="panel" style={{ flex: 1, minWidth: "200px", padding: "20px" }}>
                <div style={{ fontWeight: 600, color: "#c8cde8", marginBottom: "4px" }}>{tier.label}</div>
                <div style={{ fontSize: "24px", fontWeight: 700, color: "#00e87a", marginBottom: "4px" }}>
                  ${tier.monthly}<span style={{ fontSize: "13px", color: "#6b7194" }}>/mo</span>
                </div>
                <div style={{ fontSize: "12px", color: "#6b7194", marginBottom: "16px" }}>
                  {tier.domains} · {tier.requests}<br />{tier.history}
                </div>
                <a
                  href={checkoutUrl(tier.key, "monthly")}
                  className="btn btn-primary"
                  style={{ display: "block", textAlign: "center", textDecoration: "none", marginBottom: "8px" }}
                >
                  ${tier.monthly}/mo
                </a>
                <a
                  href={checkoutUrl(tier.key, "annual")}
                  className="btn"
                  style={{ display: "block", textAlign: "center", textDecoration: "none", fontSize: "12px" }}
                >
                  ${tier.annual}/mo billed annually
                </a>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
