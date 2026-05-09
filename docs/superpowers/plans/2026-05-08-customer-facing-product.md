# Customer-Facing Product Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add auth (Supabase), self-serve onboarding, Lemon Squeezy billing, and per-customer dashboard scoping to the existing React analytics app.

**Architecture:** Supabase handles auth and customer state (two tables: `customers`, `subscriptions`). Three Supabase Edge Functions handle onboarding registration, live-detection probing, and Lemon Squeezy webhooks. The existing dashboard React app gains a router, auth context, and four new pages; the analytics components are unchanged.

**Tech Stack:** React 18, React Router v6, @supabase/supabase-js v2, Supabase Edge Functions (Deno), Lemon Squeezy, Vitest + @testing-library/react, Vite

---

## File Map

**New files:**
- `supabase/migrations/001_schema.sql` — customers + subscriptions tables + RLS policies
- `supabase/functions/onboard-customer/index.ts` — Edge Function: register domain in CF KV
- `supabase/functions/check-live/index.ts` — Edge Function: probe DNS, set onboarded_at
- `supabase/functions/ls-webhook/index.ts` — Edge Function: Lemon Squeezy webhook handler
- `dashboard/src/lib/supabase.ts` — Supabase client singleton
- `dashboard/src/lib/access.ts` — trial/subscription access check (pure function)
- `dashboard/src/lib/access.test.ts` — access check tests
- `dashboard/src/lib/auth.tsx` — AuthContext, AuthProvider, useAuth hook
- `dashboard/src/components/ProtectedRoute.tsx` — session guard
- `dashboard/src/components/PlanBadge.tsx` — header chip showing plan/trial state
- `dashboard/src/components/PlanBadge.test.tsx` — PlanBadge tests
- `dashboard/src/components/AccountMenu.tsx` — avatar dropdown (Billing, Sign out)
- `dashboard/src/components/PaywallOverlay.tsx` — tier cards overlay over blurred dashboard
- `dashboard/src/pages/Login.tsx` — sign-in page
- `dashboard/src/pages/Signup.tsx` — sign-up + email confirmation page
- `dashboard/src/pages/Onboard.tsx` — 4-step onboarding wizard
- `dashboard/src/pages/Billing.tsx` — plan management + checkout links
- `dashboard/src/Router.tsx` — BrowserRouter + all routes
- `dashboard/src/test-setup.ts` — @testing-library/jest-dom setup

**Modified files:**
- `dashboard/package.json` — add runtime + dev deps
- `dashboard/vite.config.ts` — add vitest jsdom config
- `dashboard/src/main.tsx` — mount Router instead of App
- `dashboard/src/App.tsx` — add auth imports, hostname from context, PlanBadge, AccountMenu, PaywallOverlay
- `dashboard/.env.local` — Supabase + LS env vars (create, never commit)

---

## Task 1: Supabase project + schema migration

**Files:**
- Create: `supabase/migrations/001_schema.sql`

- [ ] **Step 1: Create a Supabase project**

Go to https://supabase.com/dashboard → New project. Note the **Project URL** and **anon key** (Settings → API). You'll need them in Task 2.

- [ ] **Step 2: Write the migration SQL**

Create `supabase/migrations/001_schema.sql`:

```sql
create table public.customers (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete cascade not null,
  hostname       text not null unique,
  upstream_url   text not null,
  cf_client_id   text not null,
  trial_ends_at  timestamptz not null,
  onboarded_at   timestamptz,
  created_at     timestamptz default now() not null
);

alter table public.customers enable row level security;

create policy "Users manage their own customers"
  on public.customers for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table public.subscriptions (
  id                  uuid primary key default gen_random_uuid(),
  customer_id         uuid references public.customers(id) on delete cascade not null,
  ls_subscription_id  text not null unique,
  tier                text not null check (tier in ('starter', 'growth', 'pro')),
  status              text not null check (status in ('active', 'paused', 'cancelled', 'expired')),
  current_period_end  timestamptz not null,
  updated_at          timestamptz default now() not null
);

alter table public.subscriptions enable row level security;

create policy "Users read their own subscriptions"
  on public.subscriptions for select
  using (
    exists (
      select 1 from public.customers c
      where c.id = customer_id and c.user_id = auth.uid()
    )
  );
```

- [ ] **Step 3: Run the migration**

In the Supabase dashboard → SQL Editor → paste the contents of `001_schema.sql` → Run.

Expected: two new tables visible in Table Editor with RLS enabled.

- [ ] **Step 4: Enable email confirmations (optional for dev)**

Supabase dashboard → Authentication → Providers → Email → disable "Confirm email" during local development to skip the confirmation step. Re-enable before going live.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/001_schema.sql
git commit -m "feat: add customers and subscriptions schema"
```

---

## Task 2: Install dependencies + test environment

**Files:**
- Modify: `dashboard/package.json`
- Modify: `dashboard/vite.config.ts`
- Create: `dashboard/src/test-setup.ts`

- [ ] **Step 1: Install runtime dependencies**

```bash
cd dashboard
npm install @supabase/supabase-js react-router-dom
```

Expected: `@supabase/supabase-js` and `react-router-dom` appear in `dependencies`.

- [ ] **Step 2: Install test dependencies**

```bash
npm install -D @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom
```

- [ ] **Step 3: Update vite.config.ts**

Replace the entire file:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
  },
});
```

- [ ] **Step 4: Create test-setup.ts**

```ts
import "@testing-library/jest-dom";
```

- [ ] **Step 5: Verify tests still pass**

```bash
npm test
```

Expected: existing tests pass (or 0 test files found — either is fine).

- [ ] **Step 6: Commit**

```bash
cd ..
git add dashboard/package.json dashboard/vite.config.ts dashboard/src/test-setup.ts
git commit -m "feat: add supabase, react-router, testing-library dependencies"
```

---

## Task 3: Supabase client + access helper

**Files:**
- Create: `dashboard/src/lib/supabase.ts`
- Create: `dashboard/src/lib/access.ts`
- Create: `dashboard/src/lib/access.test.ts`

- [ ] **Step 1: Write failing tests for access helper**

Create `dashboard/src/lib/access.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { isAccessGranted } from "./access";

describe("isAccessGranted", () => {
  const FUTURE = new Date(Date.now() + 86400000).toISOString();
  const PAST = new Date(Date.now() - 86400000).toISOString();

  it("grants access when subscription is active", () => {
    expect(isAccessGranted({ trialEndsAt: PAST, subscriptionStatus: "active" })).toBe(true);
  });

  it("grants access when trial has not expired", () => {
    expect(isAccessGranted({ trialEndsAt: FUTURE, subscriptionStatus: null })).toBe(true);
  });

  it("grants access when trial active and subscription cancelled", () => {
    expect(isAccessGranted({ trialEndsAt: FUTURE, subscriptionStatus: "cancelled" })).toBe(true);
  });

  it("denies access when trial expired and no subscription", () => {
    expect(isAccessGranted({ trialEndsAt: PAST, subscriptionStatus: null })).toBe(false);
  });

  it("denies access when trial expired and subscription cancelled", () => {
    expect(isAccessGranted({ trialEndsAt: PAST, subscriptionStatus: "cancelled" })).toBe(false);
  });

  it("denies access when trialEndsAt is null and no subscription", () => {
    expect(isAccessGranted({ trialEndsAt: null, subscriptionStatus: null })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

```bash
cd dashboard && npx vitest run src/lib/access.test.ts
```

Expected: FAIL — "Cannot find module './access'"

- [ ] **Step 3: Create access.ts**

```ts
interface AccessInput {
  trialEndsAt: string | null;
  subscriptionStatus: string | null;
}

export function isAccessGranted({ trialEndsAt, subscriptionStatus }: AccessInput): boolean {
  if (subscriptionStatus === "active") return true;
  if (trialEndsAt && new Date(trialEndsAt) > new Date()) return true;
  return false;
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run src/lib/access.test.ts
```

Expected: 6 tests pass.

- [ ] **Step 5: Create Supabase client**

Create `dashboard/src/lib/supabase.ts`:

```ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

- [ ] **Step 6: Create AuthContext**

Create `dashboard/src/lib/auth.tsx`:

```tsx
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
    const { data: rows } = await supabase.from("customers").select("*");
    const customerRows = (rows ?? []) as Customer[];
    setCustomers(customerRows);

    if (customerRows.length > 0) {
      const { data: subRows } = await supabase
        .from("subscriptions")
        .select("tier, status, current_period_end")
        .in("customer_id", customerRows.map((r) => r.id))
        .order("updated_at", { ascending: false })
        .limit(1);
      setSubscription((subRows?.[0] as Subscription) ?? null);
    }
    setLoading(false);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) loadCustomerData();
      else setLoading(false);
    });

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
```

- [ ] **Step 7: Commit**

```bash
cd ..
git add dashboard/src/lib/
git commit -m "feat: add Supabase client, auth context, access helper"
```

---

## Task 4: Router + ProtectedRoute + update main.tsx

**Files:**
- Create: `dashboard/src/components/ProtectedRoute.tsx`
- Create: `dashboard/src/Router.tsx`
- Modify: `dashboard/src/main.tsx`

- [ ] **Step 1: Create ProtectedRoute**

Create `dashboard/src/components/ProtectedRoute.tsx`:

```tsx
import { Navigate } from "react-router-dom";
import { ReactNode } from "react";
import { useAuth } from "../lib/auth";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) return <div className="status-bar loading"><span className="spinner" /> Loading…</div>;
  if (!session) return <Navigate to="/login" replace />;

  return <>{children}</>;
}
```

- [ ] **Step 2: Create Router.tsx**

Create `dashboard/src/Router.tsx`:

```tsx
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
```

- [ ] **Step 3: Update main.tsx**

Replace the entire file:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import Router from "./Router";

const root = document.getElementById("root");
if (!root) throw new Error("No #root element found");
createRoot(root).render(
  <StrictMode>
    <Router />
  </StrictMode>
);
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd dashboard && npm run lint
```

Expected: no errors. (Pages imported in Router.tsx don't exist yet — create stubs in the next step.)

- [ ] **Step 4b: Create page stubs so Router compiles**

Create `dashboard/src/pages/Login.tsx`:
```tsx
export default function Login() { return <div>Login</div>; }
```
Create `dashboard/src/pages/Signup.tsx`:
```tsx
export default function Signup() { return <div>Signup</div>; }
```
Create `dashboard/src/pages/Onboard.tsx`:
```tsx
export default function Onboard() { return <div>Onboard</div>; }
```
Create `dashboard/src/pages/Billing.tsx`:
```tsx
export default function Billing() { return <div>Billing</div>; }
```

Then re-run lint:
```bash
npm run lint
```
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
cd ..
git add dashboard/src/components/ProtectedRoute.tsx dashboard/src/Router.tsx dashboard/src/main.tsx dashboard/src/pages/
git commit -m "feat: add router, protected route, page stubs"
```

---

## Task 5: Login page

**Files:**
- Modify: `dashboard/src/pages/Login.tsx`

- [ ] **Step 1: Implement Login page**

Replace `dashboard/src/pages/Login.tsx`:

```tsx
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
```

- [ ] **Step 2: Verify lint**

```bash
cd dashboard && npm run lint
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
cd ..
git add dashboard/src/pages/Login.tsx
git commit -m "feat: add login page"
```

---

## Task 6: Signup page

**Files:**
- Modify: `dashboard/src/pages/Signup.tsx`

- [ ] **Step 1: Implement Signup page**

Replace `dashboard/src/pages/Signup.tsx`:

```tsx
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
```

- [ ] **Step 2: Verify lint**

```bash
cd dashboard && npm run lint
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
cd ..
git add dashboard/src/pages/Signup.tsx
git commit -m "feat: add signup page"
```

---

## Task 7: PlanBadge + AccountMenu + App.tsx modifications

**Files:**
- Create: `dashboard/src/components/PlanBadge.tsx`
- Create: `dashboard/src/components/PlanBadge.test.tsx`
- Create: `dashboard/src/components/AccountMenu.tsx`
- Modify: `dashboard/src/App.tsx`

- [ ] **Step 1: Write failing tests for PlanBadge**

Create `dashboard/src/components/PlanBadge.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlanBadge } from "./PlanBadge";

const FUTURE = new Date(Date.now() + 5 * 86400000).toISOString();
const PAST = new Date(Date.now() - 86400000).toISOString();

describe("PlanBadge", () => {
  it("shows tier name when subscription is active", () => {
    render(<PlanBadge trialEndsAt={PAST} tier="growth" status="active" />);
    expect(screen.getByText("GROWTH")).toBeInTheDocument();
  });

  it("shows trial countdown when trial is active", () => {
    render(<PlanBadge trialEndsAt={FUTURE} tier={null} status={null} />);
    expect(screen.getByText(/TRIAL/)).toBeInTheDocument();
    expect(screen.getByText(/5d left/)).toBeInTheDocument();
  });

  it("shows TRIAL EXPIRED when trial ended and no subscription", () => {
    render(<PlanBadge trialEndsAt={PAST} tier={null} status={null} />);
    expect(screen.getByText("TRIAL EXPIRED")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

```bash
cd dashboard && npx vitest run src/components/PlanBadge.test.tsx
```

Expected: FAIL — "Cannot find module './PlanBadge'"

- [ ] **Step 3: Create PlanBadge.tsx**

```tsx
interface Props {
  trialEndsAt: string | null;
  tier: string | null;
  status: string | null;
}

export function PlanBadge({ trialEndsAt, tier, status }: Props) {
  if (status === "active" && tier) {
    return <span className="plan-badge">{tier.toUpperCase()}</span>;
  }
  if (trialEndsAt) {
    const daysLeft = Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000));
    if (daysLeft > 0) {
      return <span className="plan-badge trial">TRIAL · {daysLeft}d left</span>;
    }
  }
  return <span className="plan-badge expired">TRIAL EXPIRED</span>;
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run src/components/PlanBadge.test.tsx
```

Expected: 3 tests pass.

- [ ] **Step 5: Create AccountMenu.tsx**

```tsx
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
```

- [ ] **Step 6: Modify App.tsx — add imports**

At the top of `dashboard/src/App.tsx`, after the existing import line, add:

```tsx
import { useAuth } from "./lib/auth";
import { isAccessGranted } from "./lib/access";
import { PlanBadge } from "./components/PlanBadge";
import { AccountMenu } from "./components/AccountMenu";
import { PaywallOverlay } from "./components/PaywallOverlay";
```

- [ ] **Step 7: Modify App.tsx — add auth state and replace fetchHostnames**

Inside the `App` function, after the existing state declarations (after `const [refreshKey, setRefreshKey] = useState<number>(0);`), add:

```tsx
const { customers, subscription } = useAuth();
const activeCustomer = customers.find((c) => c.onboarded_at != null) ?? customers[0];
const granted = isAccessGranted({
  trialEndsAt: activeCustomer?.trial_ends_at ?? null,
  subscriptionStatus: subscription?.status ?? null,
});
```

Then replace the `fetchHostnames` useEffect:

```tsx
// Replace this:
useEffect(() => {
  fetchHostnames().then((list) => {
    setHostnames(list);
    setHostnamesLoaded(true);
  });
}, []);

// With this:
useEffect(() => {
  const names = customers.map((c) => c.hostname);
  setHostnames(names);
  setHostnamesLoaded(true);
  if (names.length > 0 && !hostname) {
    setHostname(names[0]);
  }
}, [customers]);
```

- [ ] **Step 8: Modify App.tsx — update header**

In the header JSX, after the `<div className="header-controls">` opening tag and existing controls, add PlanBadge and AccountMenu. Find the closing `</header>` tag and add these two elements to the controls div, just before the `{sinceLabel && ...}` span:

```tsx
<PlanBadge
  trialEndsAt={activeCustomer?.trial_ends_at ?? null}
  tier={subscription?.tier ?? null}
  status={subscription?.status ?? null}
/>
<AccountMenu />
```

- [ ] **Step 9: Modify App.tsx — add PaywallOverlay**

At the very end of the returned JSX, just before the closing fragment `</>`, add:

```tsx
{!granted && <PaywallOverlay />}
```

- [ ] **Step 10: Verify lint**

```bash
npm run lint
```

Expected: exits 0. (PaywallOverlay doesn't exist yet — create a stub if lint fails: `export function PaywallOverlay() { return null; }`)

- [ ] **Step 11: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 12: Commit**

```bash
cd ..
git add dashboard/src/components/ dashboard/src/App.tsx
git commit -m "feat: add PlanBadge, AccountMenu, wire auth into dashboard"
```

---

## Task 8: PaywallOverlay

**Files:**
- Create: `dashboard/src/components/PaywallOverlay.tsx`

- [ ] **Step 1: Create PaywallOverlay.tsx**

```tsx
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
```

- [ ] **Step 2: Verify lint**

```bash
cd dashboard && npm run lint
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
cd ..
git add dashboard/src/components/PaywallOverlay.tsx
git commit -m "feat: add paywall overlay for expired trial"
```

---

## Task 9: Onboarding wizard

**Files:**
- Modify: `dashboard/src/pages/Onboard.tsx`

- [ ] **Step 1: Implement Onboard.tsx**

Replace the stub at `dashboard/src/pages/Onboard.tsx`:

```tsx
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
```

- [ ] **Step 2: Verify lint**

```bash
cd dashboard && npm run lint
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
cd ..
git add dashboard/src/pages/Onboard.tsx
git commit -m "feat: add 4-step onboarding wizard"
```

---

## Task 10: Billing page

**Files:**
- Modify: `dashboard/src/pages/Billing.tsx`

- [ ] **Step 1: Implement Billing.tsx**

Replace the stub at `dashboard/src/pages/Billing.tsx`:

```tsx
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
```

- [ ] **Step 2: Verify lint**

```bash
cd dashboard && npm run lint
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
cd ..
git add dashboard/src/pages/Billing.tsx
git commit -m "feat: add billing page with Lemon Squeezy checkout links"
```

---

## Task 11: Edge Function — onboard-customer

**Files:**
- Create: `supabase/functions/onboard-customer/index.ts`

- [ ] **Step 1: Initialize Supabase CLI project**

```bash
npx supabase init
```

Expected: creates `supabase/config.toml`. If it already exists, skip.

- [ ] **Step 2: Create the Edge Function**

Create `supabase/functions/onboard-customer/index.ts`:

```ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CF_ACCOUNT_ID = Deno.env.get("CF_ACCOUNT_ID")!;
const CF_API_TOKEN = Deno.env.get("CF_API_TOKEN")!;
const CF_KV_NAMESPACE_ID = Deno.env.get("CF_KV_NAMESPACE_ID")!;
const WORKER_CNAME = Deno.env.get("WORKER_CNAME")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response("Unauthorized", { status: 401 });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser(
    authHeader.replace("Bearer ", ""),
  );
  if (authError || !user) return new Response("Unauthorized", { status: 401 });

  let hostname: string, upstream_url: string;
  try {
    ({ hostname, upstream_url } = await req.json());
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  if (!hostname || !upstream_url) {
    return new Response(JSON.stringify({ error: "hostname and upstream_url required" }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(hostname)) {
    return new Response(JSON.stringify({ error: "Invalid hostname format. Use: acme.com" }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const cfClientId = `cus_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;

  const kvRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces/${CF_KV_NAMESPACE_ID}/values/${encodeURIComponent(hostname)}`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${CF_API_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ upstreamUrl: upstream_url, clientId: cfClientId, tier: "trial" }),
    },
  );

  if (!kvRes.ok) {
    const body = await kvRes.text();
    return new Response(JSON.stringify({ error: `CF KV write failed: ${body}` }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const { error: insertError } = await supabase.from("customers").insert({
    user_id: user.id,
    hostname,
    upstream_url,
    cf_client_id: cfClientId,
    trial_ends_at: trialEndsAt,
  });

  if (insertError) {
    return new Response(JSON.stringify({ error: insertError.message }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ cname_target: WORKER_CNAME, cf_client_id: cfClientId }), {
    status: 200, headers: { ...CORS, "Content-Type": "application/json" },
  });
});
```

- [ ] **Step 3: Deploy the function**

```bash
npx supabase functions deploy onboard-customer --project-ref <YOUR_PROJECT_REF>
```

Get `<YOUR_PROJECT_REF>` from Supabase dashboard URL: `https://supabase.com/dashboard/project/<ref>`.

- [ ] **Step 4: Set Edge Function secrets**

```bash
npx supabase secrets set \
  CF_ACCOUNT_ID=<your_cf_account_id> \
  CF_API_TOKEN=<your_cf_api_token> \
  CF_KV_NAMESPACE_ID=<your_bot_registry_kv_id> \
  WORKER_CNAME=<your_worker_route_hostname> \
  --project-ref <YOUR_PROJECT_REF>
```

Get `CF_ACCOUNT_ID` from Cloudflare dashboard → right sidebar.  
Get `CF_API_TOKEN` from Cloudflare → My Profile → API Tokens → create with KV Write permission.  
Get `CF_KV_NAMESPACE_ID` from Cloudflare → Workers & Pages → KV → BOT_REGISTRY namespace ID.  
Set `WORKER_CNAME` to the public hostname of your Cloudflare Worker (e.g. `proxy.yourdomain.com`).

- [ ] **Step 5: Test with curl**

```bash
# Get a test JWT from Supabase: Auth → Users → select a user → copy JWT
curl -X POST https://<PROJECT_REF>.supabase.co/functions/v1/onboard-customer \
  -H "Authorization: Bearer <TEST_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"hostname":"test-acme.com","upstream_url":"https://test.acme.com"}'
```

Expected response:
```json
{"cname_target":"proxy.yourdomain.com","cf_client_id":"cus_..."}
```

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/onboard-customer/ supabase/config.toml
git commit -m "feat: add onboard-customer edge function"
```

---

## Task 12: Edge Function — check-live

**Files:**
- Create: `supabase/functions/check-live/index.ts`

- [ ] **Step 1: Create the Edge Function**

Create `supabase/functions/check-live/index.ts`:

```ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response("Unauthorized", { status: 401 });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser(
    authHeader.replace("Bearer ", ""),
  );
  if (authError || !user) return new Response("Unauthorized", { status: 401 });

  const hostname = new URL(req.url).searchParams.get("hostname");
  if (!hostname) {
    return new Response(JSON.stringify({ error: "hostname required" }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  let live = false;
  try {
    const probe = await fetch(`http://${hostname}/robots.txt`, {
      method: "HEAD",
      headers: { "User-Agent": "GPTBot/1.0 (+https://openai.com/gptbot)" },
      signal: AbortSignal.timeout(8000),
    });
    // CF-Ray header is injected by Cloudflare on every proxied request
    live = probe.headers.get("cf-ray") !== null;
  } catch {
    live = false;
  }

  if (live) {
    await supabase
      .from("customers")
      .update({ onboarded_at: new Date().toISOString() })
      .eq("hostname", hostname)
      .eq("user_id", user.id)
      .is("onboarded_at", null);
  }

  return new Response(JSON.stringify({ live }), {
    status: 200, headers: { ...CORS, "Content-Type": "application/json" },
  });
});
```

- [ ] **Step 2: Deploy**

```bash
npx supabase functions deploy check-live --project-ref <YOUR_PROJECT_REF>
```

- [ ] **Step 3: Test with curl**

```bash
curl "https://<PROJECT_REF>.supabase.co/functions/v1/check-live?hostname=cloudflare.com" \
  -H "Authorization: Bearer <TEST_JWT>"
```

Expected: `{"live":true}` (cloudflare.com is behind Cloudflare, so cf-ray will be present).

```bash
curl "https://<PROJECT_REF>.supabase.co/functions/v1/check-live?hostname=example.com" \
  -H "Authorization: Bearer <TEST_JWT>"
```

Expected: `{"live":false}` (example.com is not behind Cloudflare).

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/check-live/
git commit -m "feat: add check-live edge function"
```

---

## Task 13: Edge Function — ls-webhook

**Files:**
- Create: `supabase/functions/ls-webhook/index.ts`

- [ ] **Step 1: Create the Edge Function**

Create `supabase/functions/ls-webhook/index.ts`:

```ts
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
```

- [ ] **Step 2: Deploy and set secret**

```bash
npx supabase functions deploy ls-webhook --project-ref <YOUR_PROJECT_REF>
npx supabase secrets set LEMON_SQUEEZY_WEBHOOK_SECRET=<your_ls_secret> --project-ref <YOUR_PROJECT_REF>
```

Get the secret from Lemon Squeezy → Settings → Webhooks → Add endpoint → copy signing secret.
Set the webhook URL to: `https://<PROJECT_REF>.supabase.co/functions/v1/ls-webhook`
Events to subscribe: `subscription_created`, `subscription_updated`, `subscription_cancelled`, `subscription_expired`.

- [ ] **Step 3: Test with curl (signature bypass for smoke test)**

```bash
# This will return 403 (correct — no valid signature), confirming the function is live:
curl -X POST https://<PROJECT_REF>.supabase.co/functions/v1/ls-webhook \
  -H "Content-Type: application/json" \
  -H "X-Signature: 0000" \
  -d '{}'
```

Expected: `Invalid signature` with 403 status.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/ls-webhook/
git commit -m "feat: add ls-webhook edge function"
```

---

## Task 14: Environment variables + final wiring

**Files:**
- Create: `dashboard/.env.local` (never commit this file)

- [ ] **Step 1: Create .env.local**

Create `dashboard/.env.local` with all required variables:

```
# Supabase
VITE_SUPABASE_URL=https://<YOUR_PROJECT_REF>.supabase.co
VITE_SUPABASE_ANON_KEY=<your_anon_key>

# Cloudflare Worker CNAME (shown in DNS step of onboarding)
VITE_WORKER_CNAME=<your_worker_route_hostname>

# Lemon Squeezy checkout URLs (from LS dashboard → Store → Products → Share)
VITE_LS_STARTER_MONTHLY_URL=https://yourstore.lemonsqueezy.com/checkout/buy/<variant_id>
VITE_LS_STARTER_ANNUAL_URL=https://yourstore.lemonsqueezy.com/checkout/buy/<variant_id>
VITE_LS_GROWTH_MONTHLY_URL=https://yourstore.lemonsqueezy.com/checkout/buy/<variant_id>
VITE_LS_GROWTH_ANNUAL_URL=https://yourstore.lemonsqueezy.com/checkout/buy/<variant_id>
VITE_LS_PRO_MONTHLY_URL=https://yourstore.lemonsqueezy.com/checkout/buy/<variant_id>
VITE_LS_PRO_ANNUAL_URL=https://yourstore.lemonsqueezy.com/checkout/buy/<variant_id>
```

- [ ] **Step 2: Verify .env.local is gitignored**

```bash
cat .gitignore | grep env
```

If `.env.local` is not listed, add it:

```bash
echo ".env.local" >> dashboard/.gitignore
```

- [ ] **Step 3: Start the dev server and walk through the flow**

```bash
cd dashboard && npm run dev
```

Open `http://localhost:5173`. You should be redirected to `/login`. Steps to verify:
1. Go to `/signup` → create account → check email → confirm → sign in
2. Redirected to `/onboard` → enter a test domain + upstream URL → submit
3. DNS instructions screen appears with the CNAME target
4. Click "I've added the DNS record" → live detection polling starts
5. If test domain is on Cloudflare, the probe returns live → redirected to `/dashboard`
6. Dashboard loads with hostname pre-populated from your customer row
7. Header shows TRIAL badge with days remaining
8. Avatar menu → Billing → shows trial countdown + checkout links
9. Sign out → redirected to `/login`

- [ ] **Step 4: Run all tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
cd ..
git add dashboard/.gitignore
git commit -m "feat: wire environment variables, complete customer-facing product"
```

---

## CSS additions needed

The plan references CSS classes not currently in `styles.css`: `.plan-badge`, `.plan-badge.trial`, `.plan-badge.expired`. Add these to `dashboard/src/styles.css` alongside the existing card styles:

```css
.plan-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 4px;
  font-family: "IBM Plex Mono", monospace;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  background: rgba(0, 232, 122, 0.12);
  color: #00e87a;
  border: 1px solid rgba(0, 232, 122, 0.25);
}
.plan-badge.trial {
  background: rgba(240, 160, 48, 0.12);
  color: #f0a030;
  border-color: rgba(240, 160, 48, 0.25);
}
.plan-badge.expired {
  background: rgba(232, 80, 80, 0.12);
  color: #e85050;
  border-color: rgba(232, 80, 80, 0.25);
}
```

Add this as a step in Task 7 before the App.tsx modifications, or as a separate commit.
