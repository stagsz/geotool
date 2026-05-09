import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";

const STEP_KEY = "onboard_step";
const HOSTNAME_KEY = "onboard_hostname";
type Step = 1 | 2 | 3 | 4;

export default function Onboard() {
  const navigate = useNavigate();
  const { customers, reloadCustomers } = useAuth();

  const [hostname, setHostname] = useState(() => localStorage.getItem(HOSTNAME_KEY) ?? "");
  const [upstreamUrl, setUpstreamUrl] = useState("");
  const [cnameTarget, setCnameTarget] = useState(() => import.meta.env.VITE_WORKER_CNAME as string ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const initialStep: Step = (() => {
    const stored = localStorage.getItem(STEP_KEY);
    if (stored === "2" || stored === "3") {
      if (customers.some((c) => c.hostname === localStorage.getItem(HOSTNAME_KEY))) return Number(stored) as Step;
    }
    if (stored === "4") return 4;
    return 1;
  })();
  const [step, setStep] = useState<Step>(initialStep);

  useEffect(() => {
    localStorage.setItem(STEP_KEY, String(step));
    if (step === 1) localStorage.removeItem(HOSTNAME_KEY);
  }, [step]);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  async function handleRegister() {
    setError(null);
    setSubmitting(true);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/onboard-customer`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session!.access_token}`,
        },
        body: JSON.stringify({ hostname, upstream_url: upstreamUrl }),
      }
    );
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      setError((body as { error?: string }).error ?? "Registration failed");
      return;
    }
    const body = await res.json() as { cname_target: string };
    setCnameTarget(body.cname_target);
    localStorage.setItem(HOSTNAME_KEY, hostname);
    await reloadCustomers();
    setStep(2);
  }

  function startPolling() {
    setStep(3);
    let elapsed = 0;
    const INTERVAL_MS = 10_000;
    const TIMEOUT_MS = 900_000;

    pollRef.current = setInterval(async () => {
      elapsed += INTERVAL_MS;
      if (elapsed >= TIMEOUT_MS) {
        clearInterval(pollRef.current!);
        setTimedOut(true);
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-live?hostname=${encodeURIComponent(hostname)}`,
          { headers: { Authorization: `Bearer ${session!.access_token}` } }
        );
        if (res.ok) {
          const body = await res.json() as { live: boolean };
          if (body.live) {
            clearInterval(pollRef.current!);
            await reloadCustomers();
            setStep(4);
          }
        }
      } catch {
        // network error — keep polling
      }
    }, INTERVAL_MS);
  }

  if (step === 1) {
    return (
      <main className="main" style={{ maxWidth: 480, margin: "80px auto" }}>
        <div className="panel">
          <div className="panel-header"><span className="panel-title">Step 1 of 4 — Your domain</span></div>
          <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
            {error && <div className="status-bar error" role="alert">{error}</div>}
            <label style={{ color: "#6b7194", fontSize: "12px" }}>
              Domain (no https://)
              <input
                className="input"
                style={{ display: "block", marginTop: "4px", width: "100%", boxSizing: "border-box" }}
                placeholder="acme.com"
                value={hostname}
                onChange={(e) => setHostname(e.target.value.replace(/^https?:\/\//, "").replace(/\/$/, ""))}
              />
            </label>
            <label style={{ color: "#6b7194", fontSize: "12px" }}>
              Origin URL (your actual server)
              <input
                className="input"
                style={{ display: "block", marginTop: "4px", width: "100%", boxSizing: "border-box" }}
                placeholder="https://acme.myshopify.com"
                value={upstreamUrl}
                onChange={(e) => setUpstreamUrl(e.target.value)}
              />
            </label>
            <button
              className="btn btn-primary"
              onClick={handleRegister}
              disabled={submitting || !hostname.trim() || !upstreamUrl.trim()}
            >
              {submitting ? "Registering…" : "Continue"}
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (step === 2) {
    return (
      <main className="main" style={{ maxWidth: 480, margin: "80px auto" }}>
        <div className="panel">
          <div className="panel-header"><span className="panel-title">Step 2 of 4 — Add DNS record</span></div>
          <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <p style={{ color: "#c8cde8" }}>Add this CNAME record in your DNS provider (Cloudflare, Route 53, Namecheap, etc.):</p>
            <div className="panel" style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: "13px", padding: "12px 16px", lineHeight: 2 }}>
              <div><span style={{ color: "#6b7194" }}>Type:  </span>CNAME</div>
              <div><span style={{ color: "#6b7194" }}>Name:  </span>@</div>
              <div><span style={{ color: "#6b7194" }}>Value: </span><span style={{ color: "#00e87a" }}>{cnameTarget}</span></div>
              <div><span style={{ color: "#6b7194" }}>TTL:   </span>Auto</div>
            </div>
            <p style={{ color: "#6b7194", fontSize: "12px" }}>
              If your domain is on Cloudflare, set the proxy status to DNS-only (grey cloud) initially.
            </p>
            <button className="btn btn-primary" onClick={startPolling}>
              I've added the DNS record
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (step === 3) {
    return (
      <main className="main" style={{ maxWidth: 480, margin: "80px auto" }}>
        <div className="panel">
          <div className="panel-header"><span className="panel-title">Step 3 of 4 — Verifying DNS</span></div>
          <div style={{ padding: "24px 16px", display: "flex", flexDirection: "column", gap: "12px", alignItems: "center" }}>
            {!timedOut ? (
              <>
                <span className="spinner" style={{ width: 24, height: 24 }} />
                <p style={{ color: "#6b7194", textAlign: "center" }}>
                  Checking that <strong style={{ color: "#c8cde8" }}>{hostname}</strong> is routing through the proxy.
                  This usually takes 1–5 minutes after DNS propagates.
                </p>
              </>
            ) : (
              <p style={{ color: "#6b7194", textAlign: "center" }}>
                DNS propagation is taking longer than expected — this is normal and can take up to 48 hours.
                We'll email you when your domain goes live.
              </p>
            )}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="main" style={{ maxWidth: 480, margin: "80px auto" }}>
      <div className="panel">
        <div className="panel-header"><span className="panel-title">You're live!</span></div>
        <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <p style={{ color: "#c8cde8" }}>
            <strong style={{ color: "#00e87a" }}>{hostname}</strong> is now routing AI crawler traffic through the proxy.
            When GPTBot next visits, you'll see it in your dashboard.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => { localStorage.removeItem(STEP_KEY); localStorage.removeItem(HOSTNAME_KEY); navigate("/dashboard"); }}
          >
            Go to dashboard
          </button>
        </div>
      </div>
    </main>
  );
}
