import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

export function AccountMenu() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const initials = (user?.email ?? "?")[0].toUpperCase();

  async function handleSignOut() {
    await signOut();
    navigate("/login");
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        className="btn"
        onClick={() => setOpen((o) => !o)}
        style={{ width: 28, height: 28, borderRadius: "50%", padding: 0, fontWeight: 600 }}
        aria-label="Account menu"
        aria-expanded={open}
      >
        {initials}
      </button>
      {open && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 99 }}
            onClick={() => setOpen(false)}
          />
          <div style={{
            position: "absolute", right: 0, top: "36px",
            background: "#161926", border: "1px solid #2a2f47",
            borderRadius: "6px", minWidth: "140px", zIndex: 100,
          }}>
            <button
              className="btn"
              onClick={() => { navigate("/billing"); setOpen(false); }}
              style={{ width: "100%", textAlign: "left", padding: "10px 14px", borderRadius: 0, background: "none" }}
            >
              Billing
            </button>
            <button
              className="btn"
              onClick={handleSignOut}
              style={{ width: "100%", textAlign: "left", padding: "10px 14px", borderRadius: 0, background: "none", color: "#e85050" }}
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
