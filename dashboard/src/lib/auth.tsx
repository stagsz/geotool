import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export interface Customer {
  id: string;
  user_id: string;
  hostname: string;
  upstream_url: string;
  cf_client_id: string;
  trial_ends_at: string;
  onboarded_at: string | null;
}

export interface Subscription {
  tier: "starter" | "growth" | "pro";
  status: "active" | "paused" | "cancelled" | "expired";
  current_period_end: string;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  customers: Customer[];
  subscription: Subscription | null;
  loading: boolean;
  signOut: () => Promise<void>;
  reloadCustomers: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadCustomerData() {
    setLoading(true);
    const { data: rows, error: custError } = await supabase.from("customers").select("*");
    if (custError) {
      console.error("loadCustomerData: customers fetch failed", custError);
      setLoading(false);
      return;
    }
    const customerRows = (rows ?? []) as Customer[];
    setCustomers(customerRows);

    if (customerRows.length > 0) {
      const { data: subRows, error: subError } = await supabase
        .from("subscriptions")
        .select("tier, status, current_period_end")
        .in("customer_id", customerRows.map((r) => r.id))
        .order("updated_at", { ascending: false })
        .limit(1);
      if (subError) {
        console.error("loadCustomerData: subscriptions fetch failed", subError);
      } else {
        setSubscription((subRows?.[0] as Subscription) ?? null);
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        loadCustomerData();
      } else {
        setCustomers([]);
        setSubscription(null);
        setLoading(false);
      }
    });
    return () => authSub.unsubscribe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{
      session,
      user: session?.user ?? null,
      customers,
      subscription,
      loading,
      signOut,
      reloadCustomers: loadCustomerData,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
