# Business Plan — LLM Visibility Platform
*Version 1.0 — May 2026 | Solo founder + AI operating model*

---

## 1. Executive Summary

Mid-market SaaS companies spend thousands per month on SEO while AI chat interfaces
(ChatGPT, Claude, Perplexity, Gemini) increasingly answer the questions their buyers are
asking — bypassing Google entirely. No tool today tells them whether AI is citing their
content. This one does.

The LLM Visibility Platform is a DNS-level edge proxy that requires zero code changes,
goes live in under an hour, and delivers three things no competitor offers in combination:
bot traffic intelligence, AI-optimised content transformation, and citation tracking.

**Business model:** Tiered SaaS subscription ($199–$1,499/mo) with usage overages.
**Target customer:** Mid-market SaaS companies (20–200 employees) with active content programs.
**Go-to-market:** Founder-led outbound sales for months 1–3, layering inbound from month 4.
**Operating model:** Solo founder paired with an AI agent harness (Hermes) acting as a
full operating partner across sales, product, and operations.
**6-month target:** 75 paying customers, $25,000 MRR, default alive.

---

## 2. Problem & Solution

### The problem

AI crawler traffic grew 10x in 2024. ChatGPT Search, Perplexity, Claude, and Gemini now
answer millions of buyer questions that previously generated Google clicks. The answers
those systems give are shaped by what their crawlers read — and how they read it.

Marketing and content teams at SaaS companies face three compounding problems:

1. **Invisible traffic.** AI crawlers don't show up in GA4 or Google Search Console.
   Teams don't know how often GPTBot, ClaudeBot, or PerplexityBot visit their site.

2. **Unreadable content.** Most SaaS sites are JavaScript-heavy. AI crawlers often can't
   execute JS, meaning product pages and docs return empty HTML. The crawler leaves with
   nothing useful to cite.

3. **No feedback loop.** Even when content is crawled, there is no way to know whether
   it was cited in an AI response. Teams can't improve what they can't measure.

### The solution

A single DNS record change routes AI crawler traffic through the platform. No code
changes. No SDK. No developer required. Within 15 minutes the customer sees their first
bot event.

The platform then:

- **Detects** AI crawlers with 70%+ confidence using UA fingerprinting, IP range matching,
  and PTR record verification. Confidence scored 0–100.
- **Pre-renders** JavaScript-heavy pages via a headless Chrome pipeline before serving
  them to bots, ensuring content is readable.
- **Transforms** HTML for AI consumption: injects schema.org markup, generates Q&A pairs
  from body content, extracts named entities, rewrites canonical and og:url tags to hide
  origin infrastructure.
- **Tracks** every bot event: which crawler, which page, what confidence, what was
  transformed. Stored per-client in isolated data partitions.
- **Measures citation score:** the platform's unique metric — correlating pages crawled
  with LLM response monitoring to surface which content is actually being cited.

### One-line positioning

> "The only platform that shows mid-market SaaS companies whether AI is actually citing
> their content — not just crawling it."

### Why now

The "AI SEO" category is being named by practitioners in 2025–2026 but no tool owns it.
The window to establish category leadership is 12–18 months. A first mover who ships a
credible citation score and accumulates proprietary bot-traffic data builds a moat that
is structurally hard to replicate.

---

## 3. Ideal Customer Profile

### Target company

| Attribute | Criteria |
|-----------|----------|
| Company type | Mid-market B2B SaaS |
| Size | 20–200 employees |
| Monthly pageviews | 50,000+ (enough bot traffic to generate data) |
| Content maturity | Active blog, docs site, or comparison/landing pages |
| SEO investment | Already pays for Ahrefs, Semrush, or Clearscope ($200–$500/mo) |
| Sales cycle | High-consideration (AI research happens before a demo request) |

### Buyer persona

- **Title:** Head of Marketing, VP Content, Director of Growth, or SEO Lead
- **Pain:** Organic traffic plateauing or declining; exec pressure about "AI search"
- **Awareness:** Knows AI crawlers exist but has no tool, no data, no narrative to bring
  to leadership
- **Budget:** Can approve $199–$599/mo without a procurement process
- **Trigger:** Any news story about ChatGPT Search, Perplexity growth, or AI displacing
  Google clicks

### Negative ICP

- E-commerce or physical product companies (content is not their growth lever)
- Enterprise (>500 employees) — procurement cycles too long for 6-month target
- Agencies seeking white-label — margin and control tradeoffs not worth it in year one

---

## 4. Revenue Model & Pricing

### Subscription tiers

| Tier | Monthly | Annual (20% off) | Included | Best for |
|------|---------|-----------------|----------|----------|
| Starter | $199 | $1,910 ($159/mo) | 1 domain · 100k bot req/mo · 30-day history | Validation, early adopters |
| Growth | $599 | $5,750 ($479/mo) | 5 domains · 500k req/mo · 90-day history · Slack alerts | Primary revenue driver |
| Pro | $1,499 | $14,390 ($1,199/mo) | Unlimited domains · 2M req/mo · 1yr history · API access | Power users, expansion |

### Overage billing

$0.002 per bot request above the included monthly volume. Automatic, shown in-dashboard.
Customers receive a Slack/email alert at 80% of their included volume.

### Free trial

14 days, no credit card required. One domain only. Removes the primary objection in cold
outreach ("I'd have to convince my team to pay before we know if it works").

### Annual contract strategy

Goal: 40% of customers on annual by month 6. Levers:
- 20% discount surfaces prominently at checkout
- Annual invoice upfront — useful for customers with annual SaaS budgets to spend
- Personal outreach to month-2+ customers: "We're offering a rate lock if you go annual
  before end of month"

### Revenue mix projection (month 6)

Two scenarios based on tier mix and annual discount uptake:

| Tier | Customers | Full monthly price | Conservative (40% annual, Starter-heavy) |
|------|-----------|-------------------|------------------------------------------|
| Starter | 35 | $6,965 | $5,500 |
| Growth | 32 | $19,168 | $14,400 |
| Pro | 8 | $11,992 | $7,200 |
| Overages | — | ~$1,500 | ~$800 |
| **Total** | **75** | **~$39,625** | **~$27,900** |

The **milestone target of $25,000 MRR** uses the conservative scenario: blended ARPU of
~$333, accounting for annual discounts (20% off for ~40% of customers) and an early mix
weighted toward Starter-tier while Growth tier customers accumulate through months 4–6.

---

## 5. Go-To-Market Strategy

### Philosophy

Solo founder, zero existing audience, 6-month runway to revenue. The only viable motion
is direct outbound: find the right people, send a specific message, close manually. Volume
is secondary to fit. The first 10 customers teach you more than any market research.

### Month 1: Foundation

**Product readiness**
- Self-serve onboarding fully functional: DNS change → first bot event visible in ≤15 min
- Billing integrated (Klarna), free trial flow tested end-to-end
- Dashboard shows: top crawled pages, crawler identity, transformation log, citation score

**Prospect list**
- Build a list of 300 mid-market SaaS companies using Apollo.io + manual LinkedIn research
- Filter criteria: active blog (10+ posts in last 6 months), ranking for competitive
  keywords (Ahrefs DR 30–70), Head of Marketing identifiable on LinkedIn
- Enrich with email via Apollo or Hunter.io

**Cold sequence (3 emails over 12 days)**

*Email 1 — The insight:*
> Subject: GPTBot crawled [Company] 847 times last month
>
> Hi [Name], GPTBot (OpenAI's crawler) visited [company].com 847 times last month based
> on public IP range data — but none of that shows in your analytics.
>
> We built a platform that intercepts AI crawler traffic at the edge and tells you exactly
> which pages get read, how they're processed, and whether they're showing up in ChatGPT
> answers.
>
> 14-day free trial, no code changes — just a DNS record. Worth a look?

*Email 2 — The problem (day 5):*
> Subject: re: the crawler data
>
> Quick follow-up — the reason this matters: most SaaS sites are JS-heavy. GPTBot,
> ClaudeBot, and Perplexity often get empty HTML when they crawl them. Your content
> never makes it into their index.
>
> We fix that automatically and show you the delta. Happy to share what we're seeing
> across similar companies if useful.

*Email 3 — The close (day 12):*
> Subject: closing the loop
>
> Last one from me. If "AI search visibility" isn't on your radar right now, no problem —
> timing matters. If it is, I'm happy to do a 20-min walkthrough of what your site looks
> like to AI crawlers today. No pitch, just data.
>
> [calendly link]

### Month 2: Volume

- Send 30 sequences per day (Apollo bulk send + manual LinkedIn DM to same contacts)
- Target: 900 touches, 15 replies, 8 demo calls, 5 closes
- Demo format: screen-share showing their own site's bot traffic data pulled from public
  IP ranges (pre-demo research using the platform). Nothing more convincing than seeing
  your own data before you've paid.
- Close at $199 Starter with upsell path clearly described

### Month 3: Learn and tighten

- Interview every paying customer (30-min call): what made you buy, what almost stopped you
- Identify top 2 objections. Fix them in product or messaging before scaling
- Referral ask built into month-2 check-in: "Who else on your team or in your network
  would find this useful? We'll extend your trial by a month for any introduction."
- Target: 15 customers, $5,000 MRR

### Months 4–6: Scale and convert

- Continue outbound at 30/day with tightened sequence based on month-3 learnings
- Begin annual contract push for month 2+ customers
- Publish one data-driven piece per month (LinkedIn + HN): draws inbound and gives
  prospects a credibility signal when they Google after receiving cold email
- Target: 75 customers, $25,000 MRR by end of month 6

---

## 6. Operating Model — Founder + Hermes

### Overview

The business is operated by two agents: the founder, who holds judgment, relationships,
and direction, and Hermes — an AI agent harness built on Claude — who handles execution,
research, monitoring, and first-draft work across every function.

This is not automation for automation's sake. It is a deliberate capacity multiplier that
allows a solo founder to operate at the throughput of a 3–5 person early team.

### Division of responsibility

| Domain | Hermes handles | Founder handles |
|--------|---------------|-----------------|
| **Prospecting** | Research target companies, pull contacts, score fit against ICP criteria, build Apollo lists | Final ICP judgement, list approval |
| **Outreach** | Draft all cold emails and LinkedIn messages, personalise per company, schedule sequences | Review and approve before send (first 60 days mandatory) |
| **Demo prep** | Pull bot traffic data for prospect's domain pre-demo, summarise what to highlight | The demo call itself |
| **Customer ops** | Draft onboarding emails, usage reports, upsell prompts, renewal reminders | Approve comms, handle any escalation |
| **Product monitoring** | Alert on bot traffic anomalies, customer churn signals (usage drop), infrastructure errors | Decision on response |
| **Development** | Ship features, fix bugs, write tests, review infrastructure changes | Direction: what to build next and why |
| **Content** | Draft monthly data posts, social copy, changelog entries | Edit for voice, publish |
| **Analytics** | Weekly MRR report, cohort analysis, top-churned ICP segments | Strategic decisions based on data |
| **Finance** | Flag overdue invoices, overage customers, pricing experiment candidates | Approve any pricing changes |

### Operating rhythm

- **Daily (async):** Hermes runs a morning brief — overnight bot traffic summary for
  paying customers, outbound reply queue, any infrastructure alerts. Founder reviews in
  10 minutes.
- **Weekly:** Hermes produces a 1-page business review (MRR, new customers, churn, top
  prospect activity). Founder adds direction notes.
- **Monthly:** Hermes drafts the data post. Founder edits and publishes.

### Human-in-the-loop rules (non-negotiable)

1. No cold email or LinkedIn message sends without founder approval for the first 60 days
2. No pricing changes or contract modifications without founder sign-off
3. No customer-facing communication during an active complaint or churn conversation
4. No infrastructure changes to production Cloudflare Worker without founder review

### Why this is a competitive advantage

VC-backed competitors in this category will have 5+ employees and $2M in runway. The
founder + Hermes model matches their output at ~$400/mo in tooling costs. The product
itself is AI-native infrastructure — running the business with AI is on-brand and
demonstrates the thesis to early customers.

---

## 7. Infrastructure & Cost Structure

### Technical infrastructure (monthly)

| Service | Purpose | Cost |
|---------|---------|------|
| Cloudflare Workers Paid | Edge proxy runtime (10M req/day included) | $5/mo |
| Cloudflare KV | Bot registry, client config, render cache | ~$5/mo |
| Railway (render-service) | Puppeteer pre-renderer, 512MB instance | $20/mo |
| Upstash Redis | BullMQ job queue for render pipeline | $10–30/mo |
| ClickHouse Cloud | Analytics pipeline, citation event storage | $30–50/mo |
| Domain + DNS | Primary domain for platform | ~$1/mo |
| **Infrastructure subtotal** | | **$71–111/mo** |

*Infrastructure scales linearly with customer count. At 75 customers and 2M+ bot
requests/mo, expect $200–350/mo.*

### Sales & marketing tools (monthly)

| Tool | Purpose | Cost |
|------|---------|------|
| Apollo.io Basic | Prospecting database, email enrichment, sequencing | $99/mo |
| Instantly.ai | Cold email sending infrastructure, deliverability | $97/mo |
| LinkedIn Sales Navigator | Contact research and DM outreach | $99/mo |
| **Sales tools subtotal** | | **$295/mo** |

*LinkedIn Sales Navigator can be replaced with free manual research in month 1 to reduce
burn to $196/mo until first revenue lands.*

### AI operations — Hermes (monthly)

| Service | Purpose | Cost |
|---------|---------|------|
| Claude Max (Claude Code) | Development, code review, feature shipping | $100/mo |
| Anthropic API | Hermes business operations runtime | $50–150/mo |
| **AI operations subtotal** | | **$150–250/mo** |

### Business tools (monthly)

| Tool | Purpose | Cost |
|------|---------|------|
| Klarna | Payment processing (strong EU coverage, BNPL options) | ~1.7–2.49% + fixed fee by region (no monthly fee) |
| Notion | Internal docs and SOPs | $0 (free tier) |
| GitHub | Source control, CI | $0 (free tier) |
| Google Workspace | Email for business domain | $6/mo |
| **Business tools subtotal** | | **~$6/mo + Klarna fees** |

### Hardware

No dedicated hardware required. The stack is fully cloud-native:
- Cloudflare Workers handles all edge compute
- Railway hosts the render service
- ClickHouse Cloud handles analytics storage
- Founder's existing machine (Windows 11) is sufficient for development and operations

*If development velocity becomes constrained, a cloud development environment (GitHub
Codespaces at $10–18/mo) is the first optional upgrade.*

### Total monthly cost summary

| Category | Pre-revenue (month 1) | At $25k MRR (month 6) |
|----------|----------------------|----------------------|
| Infrastructure | $71–111 | $200–350 |
| Sales tools | $196–295 | $295 |
| AI operations | $150–250 | $200–300 |
| Business tools | $6 | $6 + ~$625 Klarna fees |
| **Total burn** | **$423–662/mo** | **~$1,300/mo** |

**Key insight:** At $25,000 MRR and $1,300/mo in costs, this business generates ~$23,700/mo
net before founder compensation — default alive on a sub-$700/mo pre-revenue burn rate.

---

## 8. Competitive Landscape

| Competitor | What they do | Why they don't win |
|------------|-------------|-------------------|
| Ahrefs / Semrush | Traditional SEO analytics, keyword tracking | Zero AI crawler visibility, no citation tracking, no content transformation |
| Cloudflare Zaraz | Tag and script management at the edge | Not AI-specific, no content transformation, no analytics |
| Botify | Enterprise technical SEO, crawl simulation | Outbound crawl tool only, expensive, no inbound bot analytics |
| WordLift | Structured data and schema markup | No bot detection, no citation measurement, requires CMS integration |
| Screaming Frog | Site audit crawler | Developer tool, not a business intelligence platform |
| *No direct competitor* | — | Citation tracking as a product metric does not exist anywhere else |

### Moat

Three compounding advantages:

1. **Citation analytics.** Requires (a) intercepting real crawler traffic at the edge and
   (b) correlating it with LLM response monitoring. No existing tool does both. First
   mover who establishes this metric as the standard owns the category narrative.

2. **Proprietary training data.** Every customer deployment generates bot traffic data
   across domains and industries. This aggregated, anonymised dataset becomes more
   valuable over time — usable to improve detection models, benchmark citation scores,
   and eventually offer cross-customer insights ("your citation rate is in the top 20%
   for B2B SaaS documentation sites").

3. **Edge deployment.** Cloudflare Workers run in 300+ PoPs worldwide with sub-5ms
   latency. This is not a feature incumbents can easily bolt on — it requires a complete
   architectural rewrite for any tool built on traditional server infrastructure.

---

## 9. 6-Month Milestones & Financial Targets

### Milestone roadmap

| Month | Product | Sales | Operations | MRR target |
|-------|---------|-------|------------|------------|
| **1** | Self-serve onboarding live; free trial flow tested; dashboard v1 | 300 prospects identified; cold sequence written and approved | Hermes operating rhythm established; daily brief live | $0 |
| **2** | Slack alerts shipped; citation score v1 (page-level) | 900 touches sent; 5 paying customers | First customer interviews scheduled | $1,500 |
| **3** | Top-2 objections resolved in product; referral flow added | 15 customers; referral programme launched | Monthly data post #1 published | $5,000 |
| **4** | Growth-tier feature expansion (multi-domain view, API preview) | 30 customers; first Growth upsells | Case study #1 published; HN post | $12,000 |
| **5** | Annual billing live; citation score v2 (domain-level benchmarking) | 50 customers; annual contract push begins | 10 annual contracts closed | $20,000 |
| **6** | API v1 GA; dashboard multi-user support | 75 customers; blended ARPU $333 | Series A narrative ready OR confirmed default alive | $25,000 |

### Unit economics

| Metric | Value |
|--------|-------|
| Blended ARPU (month 6) | ~$333/mo |
| Average LTV (24-month retention) | ~$8,000 |
| CAC (outbound only, time cost) | $50–100 |
| LTV:CAC ratio | 80–160x |
| Monthly burn at month 6 | ~$1,300 |
| Net margin at $25k MRR | ~95% (pre-founder salary) |

### Funding position at month 6

The business reaches default alive before month 6 — costs are covered by recurring
revenue without any external capital. This creates two options:

**Option A: Stay bootstrapped.** Take founder salary from month 6 onwards. Grow to $100k
MRR by month 18 at the same outbound + inbound pace. High autonomy, no dilution.

**Option B: Raise a small seed round ($500k–$1M).** Use ARR traction and citation
analytics moat as the narrative. Deploy capital into one sales hire and paid acquisition
to compress the timeline to $100k MRR.

Neither option requires the other. The business is fundable because it doesn't need
funding — which is the best position from which to raise.

---

## 10. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| AI crawler behaviour changes (OpenAI blocks proxies) | Medium | High | DNS-level interception is transparent to crawlers; no spoofing or blocking |
| Cold outreach deliverability degrades | Medium | Medium | Warm domains before launch; use Instantly.ai inbox rotation; stay under 30/day per domain |
| Prospect claims "we already have this" | Low | Low | No competitor has citation tracking — demo it in the call |
| Solo founder bottleneck on demo calls | Medium | Medium | Cap demos at 3/day; build self-serve demo video by month 2 |
| Citation score accuracy questioned | Medium | High | Be explicit about methodology; publish confidence intervals; iterate based on feedback |
| Infrastructure costs spike at scale | Low | Low | Cloudflare Workers pricing is extremely linear; model shows costs stay under 5% of MRR |

---

*Document version 1.0 — generated May 2026*
*Next review: June 2026 after first 5 customers close*
