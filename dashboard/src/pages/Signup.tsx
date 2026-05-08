import { useState, FormEvent } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setDone(true);
  }

  if (done) {
    return (
      <main className="main" style={{ maxWidth: 400, margin: "80px auto" }}>
        <div className="panel">
          <div className="panel-header"><span className="panel-title">Check your email</span></div>
          <p style={{ padding: "16px", color: "#c8cde8" }}>
            We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account, then{" "}
            <Link to="/login" style={{ color: "#00e87a" }}>sign in</Link>.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="main" style={{ maxWidth: 400, margin: "80px auto" }}>
      <div className="panel">
        <div className="panel-header"><span className="panel-title">Start free trial</span></div>
        <form onSubmit={handleSubmit} style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
          {error && <div className="status-bar error" role="alert">{error}</div>}
          <input
            className="input" type="email" placeholder="Email" autoComplete="email"
            value={email} onChange={(e) => setEmail(e.target.value)} required
          />
          <input
            className="input" type="password" placeholder="Password (min 8 chars)"
            autoComplete="new-password" minLength={8}
            value={password} onChange={(e) => setPassword(e.target.value)} required
          />
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? "Creating account…" : "Create account — free, no card"}
          </button>
          <p style={{ textAlign: "center", color: "#6b7194", fontSize: "13px" }}>
            Have an account? <Link to="/login" style={{ color: "#00e87a" }}>Sign in</Link>
          </p>
        </form>
      </div>
    </main>
  );
}
