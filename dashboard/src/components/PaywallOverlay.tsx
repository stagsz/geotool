import { useAuth } from "../lib/auth";

const LS_URLS = {
  starter: {
    monthly: import.meta.env.VITE_LS_STARTER_MONTHLY_URL as string,
    annual: import.meta.env.VITE_LS_STARTER_ANNUAL_URL as string,
  },
  growth: {
    monthly: import.meta.env.VITE_LS_GROWTH_MONTHLY_URL as string,
    annual: import.meta.env.VITE_LS_GROWTH_ANNUAL_URL as string,
  },
  pro: {
    monthly: import.meta.env.VITE_LS_PRO_MONTHLY_URL as string,
    annual: import.meta.env.VITE_LS_PRO_ANNUAL_URL as string,
  },
};

const TIERS = [
  { key: "starter" as const, label: "Starter", price: "$199", annual: "$159", domains: "1 domain", requests: "100k req/mo" },
  { key: "growth" as const, label: "Growth", price: "$599", annual: "$479", domains: "5 domains", requests: "500k req/mo" },
  { key: "pro" as const, label: "Pro", price: "$1,499", annual: "$1,199", domains: "Unlimited", requests: "2M req/mo" },
];

export function PaywallOverlay() {
  const { user, customers } = useAuth();
  const customer = customers.find((c) => c.onboarded_at != null) ?? customers[0];
  const email = encodeURIComponent(user?.email ?? "");
  const cfClientId = encodeURIComponent(customer?.cf_client_id ?? "");

  function checkoutUrl(tierKey: keyof typeof LS_URLS, period: "monthly" | "annual") {
    const base = LS_URLS[tierKey][period] ?? "";
    return `${base}?checkout[email]=${email}&checkout[custom][customer_id]=${cfClientId}`;
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(12,14,20,0.92)",
      zIndex: 200, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", padding: "24px",
    }}>
      <h2 style={{ color: "#c8cde8", marginBottom: "8px", fontFamily: "IBM Plex Mono, monospace" }}>
        Your trial has ended
      </h2>
      <p style={{ color: "#6b7194", marginBottom: "32px" }}>
        Choose a plan to restore access to your bot traffic data.
      </p>
      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", justifyContent: "center" }}>
        {TIERS.map((tier) => (
          <div key={tier.key} className="panel" style={{ width: "220px", padding: "20px" }}>
            <div style={{ fontWeight: 600, marginBottom: "4px", color: "#c8cde8" }}>{tier.label}</div>
            <div style={{ fontSize: "22px", fontWeight: 700, color: "#00e87a", marginBottom: "4px" }}>
              {tier.price}<span style={{ fontSize: "13px", color: "#6b7194" }}>/mo</span>
            </div>
            <div style={{ fontSize: "12px", color: "#6b7194", marginBottom: "16px" }}>
              {tier.domains} · {tier.requests}
            </div>
            <a
              href={checkoutUrl(tier.key, "monthly")}
              className="btn btn-primary"
              style={{ display: "block", textAlign: "center", textDecoration: "none", marginBottom: "8px" }}
            >
              {tier.price}/mo
            </a>
            <a
              href={checkoutUrl(tier.key, "annual")}
              className="btn"
              style={{ display: "block", textAlign: "center", textDecoration: "none", fontSize: "12px" }}
            >
              {tier.annual}/mo billed annually
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
