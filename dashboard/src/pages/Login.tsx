import { useState, FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    navigate("/");
  }

  return (
    <main className="main" style={{ maxWidth: 400, margin: "80px auto" }}>
      <div className="panel">
        <div className="panel-header"><span className="panel-title">Sign in</span></div>
        <form onSubmit={handleSubmit} style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
          {error && <div className="status-bar error" role="alert">{error}</div>}
          <input
            className="input" type="email" placeholder="Email" autoComplete="email"
            value={email} onChange={(e) => setEmail(e.target.value)} required
          />
          <input
            className="input" type="password" placeholder="Password" autoComplete="current-password"
            value={password} onChange={(e) => setPassword(e.target.value)} required
          />
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
          <p style={{ textAlign: "center", color: "#6b7194", fontSize: "13px" }}>
            No account? <Link to="/signup" style={{ color: "#00e87a" }}>Start free trial</Link>
          </p>
        </form>
      </div>
    </main>
  );
}
