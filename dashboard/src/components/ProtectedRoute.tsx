import { Navigate } from "react-router-dom";
import { ReactNode } from "react";
import { useAuth } from "../lib/auth";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) return <div className="status-bar loading"><span className="spinner" /> Loading…</div>;
  if (!session) return <Navigate to="/login" replace />;

  return <>{children}</>;
}
