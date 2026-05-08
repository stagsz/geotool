# Customer-Facing Product Design
*2026-05-08 | LLM Visibility Platform*

## Scope

Design for the customer-facing product layer: auth, self-serve onboarding, billing, and multi-tenant dashboard. This sits on top of the existing `proxy-core`, `render-service`, and `data-layer` infrastructure, which are unchanged.

**Tech decisions:**
- Auth: Supabase Auth
- Billing: Lemon Squeezy (merchant of record, handles EU VAT, supports Klarna)
- Onboarding: hybrid — backend registers customer in Cloudflare KV, UI shows DNS instructions, polling confirms live
- Dashboard: existing React/Vite app extended with auth gates and per-customer hostname scoping

---

## 1. Architecture Overview

```
Browser (customer)
    │
    ▼
dashboard/ (React/Vite)
    ├── Supabase Auth (login, signup, session JWT)
    ├── /onboard  →  multi-step wizard
    │       step 1: enter domain + upstream URL
    │       step 2: wizard calls Supabase Edge Fn → registers in CF KV
    │       step 3: show CNAME instructions
    │       step 4: poll /check-live until traffic detected
    │       step 5: "you're live" confirmation screen
    ├── /dashboard  →  existing analytics UI (auth-gated, hostname pre-filled from Supabase)
    └── /billing   →  Lemon Squeezy checkout links, plan display, trial countdown

Supabase (Postgres)
    ├── auth.users  (managed by Supabase Auth)
    ├── customers   (id, user_id, hostname, upstream_url, cf_client_id, trial_ends_at, onboarded_at)
    └── subscriptions (id, customer_id, ls_subscription_id, tier, status, current_period_end)

Supabase Edge Functions
    ├── POST /onboard-customer    → validates JWT, writes to CF KV, inserts customers row
    ├── GET  /check-live          → HEAD-probes hostname, checks for Worker response header
    └── POST /ls-webhook          → verifies LS signature, upserts subscriptions row

Cloudflare Workers (proxy-core) — unchanged
    └── BOT_REGISTRY KV: keyed by hostname, value: { upstreamUrl, clientId, tier }

Lemon Squeezy
    └── checkout links per tier → webhook → /ls-webhook Edge Fn → subscriptions row updated
```

The existing Railway stats API remains unauthenticated. Per-customer data isolation is enforced by scoping every stats request to the customer's registered hostname.

---

## 2. Supabase Schema

### `customers`

```sql
id             uuid primary key default gen_random_uuid()
user_id        uuid references auth.users(id) on delete cascade
hostname       text not null unique
upstream_url   text not null
cf_client_id   text not null
trial_ends_at  timestamptz not null
onboarded_at   timestamptz
created_at     timestamptz default now()
```

### `subscriptions`

```sql
id                   uuid primary key default gen_random_uuid()
customer_id          uuid references customers(id) on delete cascade
ls_subscription_id   text not null unique
tier                 text not null        -- 'starter' | 'growth' | 'pro'
status               text not null        -- 'active' | 'paused' | 'cancelled' | 'expired'
current_period_end   timestamptz not null
updated_at           timestamptz default now()
```

**Row-level security:**
- `customers`: `user_id = auth.uid()`
- `subscriptions`: readable only via join through `customers` where `user_id = auth.uid()`

**Access gating logic:**
```
trial_ends_at > now()  →  trial access
subscriptions.status = 'active'  →  paid access
otherwise  →  paywall
```

---

## 3. Auth & Routing

| Route | Protection | Behaviour |
|-------|-----------|-----------|
| `/signup` | Public | Supabase `signUp` → confirmation email → redirect to `/onboard` |
| `/login` | Public | `signInWithPassword` → redirect based on customer state (see below) |
| `/onboard` | Session required | Resumable wizard; redirect to `/login` if no session |
| `/dashboard` | Session + access | No session → `/login`; expired + no sub → `/billing`; else render |
| `/billing` | Session required | Plan info, trial countdown, Lemon Squeezy checkout links |

**Post-login redirect logic:**
- No customer rows → `/onboard`
- All customer rows have `onboarded_at` null → `/onboard` (resume)
- At least one customer row has `onboarded_at` set → `/dashboard` (multi-domain users land on dashboard; incomplete domains are resumable from an "Add domain" flow within `/onboard`)

---

## 4. Onboarding Wizard

Five steps. Current step is resumable via `onboarded_at IS NULL` check on login; step index stored in `localStorage`.

### Step 1 — Domain setup
Inputs: `hostname` (e.g. `acme.com`, no protocol) and `upstream_url` (e.g. `https://acme.com`). On submit, calls `POST /onboard-customer` Edge Function:
1. Validates Supabase JWT
2. Generates `cf_client_id` (`cus_<nanoid>`)
3. Writes `{ upstreamUrl, clientId, tier: 'trial' }` to `BOT_REGISTRY` KV via Cloudflare API
4. Inserts `customers` row with `trial_ends_at = now() + 14 days`
5. Returns the CNAME target value

### Step 2 — DNS instructions
Displays copy-pasteable CNAME record:
```
Type:  CNAME
Name:  @
Value: <worker-route-domain>   ← configured per deployment (e.g. proxy.yourdomain.com)
TTL:   Auto
```
"I've added the DNS record" button advances to step 3.

### Step 3 — Live detection
Polls `GET /check-live?hostname=acme.com` every 10 seconds. Edge Function makes a HEAD request to the hostname with a synthetic bot UA and checks for a Worker-injected response header (`X-LLM-Proxy: 1`). On confirmation, sets `customers.onboarded_at = now()`.

Timeout: 15 minutes. Fallback message: "DNS propagation can take up to 48 hours — we'll email you when you're live." Background polling continues; email sent on first confirmed live event.

### Step 4 — You're live
Success screen: "You're live. When GPTBot next visits acme.com, you'll see it here." CTA → `/dashboard`.

---

## 5. Billing Integration

### Checkout links
Three Lemon Squeezy product variants (Starter, Growth, Pro), monthly and annual. URLs are appended at runtime:
```
?checkout[email]=<user_email>&checkout[custom][customer_id]=<cf_client_id>
```

### Webhook handler (`POST /ls-webhook`)
1. Verify `X-Signature` header (HMAC-SHA256 against `LEMON_SQUEEZY_WEBHOOK_SECRET`)
2. `subscription_created` / `subscription_updated` → upsert `subscriptions` row using `meta.custom_data.customer_id`
3. `subscription_cancelled` / `subscription_expired` → set `status` accordingly

### Trial flow
- No Lemon Squeezy interaction until conversion
- `trial_ends_at` set at `customers` insert
- `/billing` shows countdown: "X days left in your free trial"
- On expiry: paywall overlay rendered over blurred dashboard content (customer sees data exists, not what it says)

---

## 6. Dashboard Changes

### New components
- `<ProtectedRoute>` — wraps `/dashboard` and `/onboard`; reads Supabase session; redirects or renders paywall as needed
- `<PlanBadge>` — header chip showing `TRIAL · N days` or tier name
- `<AccountMenu>` — avatar initials → dropdown: "Billing", "Sign out"
- `<PaywallOverlay>` — rendered over blurred dashboard; shows three tier cards with checkout links

### Hostname scoping
On dashboard mount, after session resolves, fetch `customers.hostname` via Supabase client (RLS-enforced). Pass directly into the existing `hostname` filter state. `fetchStats(days, hostname)` in `api.ts` is called as-is — no API changes needed.

Growth/Pro customers with multiple domains: `customers` allows multiple rows per `user_id`; the hostname dropdown shows all their registered domains.

### Unchanged
- `api.ts` fetch functions
- All chart and card components (Sparkline, BotCard, TopPagesPanel, HourlyHeatmap, etc.)
- Railway stats API

---

## 7. Error Handling

| Scenario | Handling |
|----------|---------|
| Onboard Edge Fn: CF KV write fails | Return 500; wizard shows retry button; no `customers` row inserted (atomic) |
| Live detection timeout | Fallback message shown; background polling continues; email sent on confirmation |
| LS webhook signature invalid | Return 403; Lemon Squeezy retries automatically |
| LS webhook `customer_id` not found | Return 200 (to stop retries); log warning to Supabase Edge Function logs for manual review |
| Trial expired, no subscription | Paywall overlay; existing data still queryable in background (for conversion hook) |
| Supabase session expired | Supabase JS client auto-refreshes; on hard failure, redirect to `/login` |

---

## 8. Testing

- **Supabase Edge Functions:** tested with Deno's built-in test runner; mock CF API and LS webhook payloads
- **Auth flows:** Vitest + React Testing Library; mock Supabase client; test redirect logic for each customer state
- **Onboarding wizard:** component tests per step; mock Edge Function responses
- **Billing webhook:** unit tests for signature verification and each event type
- **Live detection:** mock HEAD responses; test timeout and success paths
- **E2E:** manual walkthrough per release against a staging Supabase project with a test LS store

---

*Next step: implementation plan via writing-plans skill*
