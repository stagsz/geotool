import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Onboard from "./pages/Onboard";
import Billing from "./pages/Billing";
import App from "./App";

function RootRedirect() {
  const { session, loading, customers } = useAuth();
  if (loading) return <div className="status-bar loading"><span className="spinner" /> Loading…</div>;
  if (!session) return <Navigate to="/login" replace />;
  const hasOnboarded = customers.some((c) => c.onboarded_at != null);
  if (customers.length === 0 || !hasOnboarded) return <Navigate to="/onboard" replace />;
  return <Navigate to="/dashboard" replace />;
}

export default function Router() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/onboard" element={<ProtectedRoute><Onboard /></ProtectedRoute>} />
          <Route path="/billing" element={<ProtectedRoute><Billing /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><App /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
