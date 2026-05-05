import { useState } from "react";

const plan = [
  {
    phase: "00",
    title: "Foundation & Environment",
    duration: "Week 1–2",
    color: "#00ff88",
    objective: "Local dev environment that mirrors production edge behavior. Nothing gets built on a shaky foundation.",
    steps: [
      "Install Node.js 20 LTS, Wrangler CLI (Cloudflare Workers SDK), Docker Desktop",
      "Create a Cloudflare account, enable Workers, set up a test domain",
      "Clone Miniflare repo — read the source to understand how Workers are simulated locally",
      "Set up a local Nginx reverse proxy to simulate the man-in-the-middle architecture",
      "Create a private Git monorepo: /proxy-core /data-layer /dashboard /evals",
      "Set up GitHub Actions for CI: lint + test on every push, zero exceptions",
      "Read: Cloudflare Workers docs end-to-end (not tutorials — actual docs)",
      "Read: HTTP/1.1 RFC 7230–7235 — every header, every method, understand the protocol",
    ],
    evals: [
      {
        id: "E00-1",
        name: "Environment Smoke Test",
        method: "Deploy a Hello World Cloudflare Worker that reads the incoming User-Agent header and returns it as JSON",
        pass: "Worker responds in < 10ms, returns correct UA string, deploys in < 30 seconds via Wrangler",
        fail: "Any timeout, wrong response format, or deploy error"
      },
      {
        id: "E00-2",
        name: "Local Proxy Verification",
        method: "Run curl through local Nginx proxy to a test origin. Verify request headers are preserved and response is unmodified",
        pass: "All headers round-trip correctly, response body byte-identical to direct request",
        fail: "Any header dropped, modified, or response body changed"
      },
      {
        id: "E00-3",
        name: "CI Pipeline Gate",
        method: "Push a deliberately broken file to trigger CI failure. Then fix it and verify CI passes",
        pass: "CI fails on broken code, passes on fix, total cycle < 2 minutes",
        fail: "CI doesn't catch the error or takes > 5 minutes"
      }
    ]
  },
  {
    phase: "01",
    title: "Bot Detection Engine",
    duration: "Week 3–5",
    color: "#ff6b35",
    objective: "Know with certainty which LLM crawler is hitting you. Not guessing — verifying.",
    steps: [
      "Build a bot identity registry: JSON file with every known LLM crawler UA string, published IP range URL, and bot category (training / indexing / realtime)",
      "Write a script that fetches live IP ranges from OpenAI, Anthropic, Perplexity JSON endpoints every 6 hours and diffs against stored version",
      "Implement UA string parser in Workers: extract bot name, version, operator from raw UA",
      "Implement reverse DNS verification: for any claimed bot IP, verify PTR record matches expected domain",
      "Build a honeypot: 10 URLs that serve 200 OK to bots but are never linked from anywhere — log everything that hits them",
      "Implement JA3/JA4 TLS fingerprinting layer to catch bots spoofing legitimate UAs",
      "Build a confidence scoring system: UA match = 30 pts, IP range match = 40 pts, PTR match = 20 pts, behavioral = 10 pts. Score < 70 = unverified",
      "Log every request: timestamp, raw UA, parsed identity, IP, confidence score, page hit",
    ],
    evals: [
      {
        id: "E01-1",
        name: "Known Bot Detection Accuracy",
        method: "Replay 500 real crawler requests from server logs (use Common Crawl's public log dataset). Run through detection engine.",
        pass: "≥ 97% correctly identified, < 1% false positives on human traffic",
        fail: "< 95% accuracy or any human traffic flagged as bot"
      },
      {
        id: "E01-2",
        name: "IP Range Freshness",
        method: "Manually change one IP in the local registry to an outdated address. Verify the auto-update script catches and corrects it within 6 hours",
        pass: "Registry auto-updates, diff logged, alert fired if IP range changes by > 10%",
        fail: "Stale IP data persists > 6 hours without alert"
      },
      {
        id: "E01-3",
        name: "Spoofed Bot Rejection",
        method: "Send 100 requests with GPTBot UA string from a residential IP (not OpenAI's range). Check confidence scores.",
        pass: "All 100 score < 70 confidence, flagged as unverified, served default response",
        fail: "Any spoofed request scores > 70 or receives optimized content"
      },
      {
        id: "E01-4",
        name: "Honeypot Sensitivity",
        method: "Run for 72 hours. Review honeypot logs.",
        pass: "Zero human traffic hits honeypot. At least one undeclared crawler detected.",
        fail: "Human traffic detected in honeypot (means pages are linked somewhere unintentionally)"
      }
    ]
  },
  {
    phase: "02",
    title: "JavaScript Pre-Renderer",
    duration: "Week 6–9",
    color: "#a855f7",
    objective: "Serve a fully rendered, clean HTML snapshot to any LLM crawler that can't execute JS. Under 200ms.",
    steps: [
      "Deploy a Puppeteer cluster on a VPS (not edge — too expensive to render at edge). Start with 4 parallel Chrome instances.",
      "Implement render queue with Bull (Redis-backed job queue): URLs enter queue, rendered HTML exits",
      "Build a render cache: SHA256 hash of URL + query params = cache key. Store rendered HTML in Redis with 4-hour TTL",
      "Implement smart wait strategy: don't use networkidle (too slow). Wait for DOMContentLoaded + largest meaningful paint signal",
      "Handle edge cases: infinite scroll (scroll 3x, capture), lazy images (force load), shadow DOM (flatten for LLM consumption)",
      "Build a cache warmer: when bot detection sees a new URL, pre-render it before the next crawler hit",
      "Implement diff detection: re-render only when page content has changed (compare hash of critical elements)",
      "Connect renderer to proxy: bot detected → check cache → cache miss → queue render → serve snapshot",
    ],
    evals: [
      {
        id: "E02-1",
        name: "Render Latency",
        method: "Send 1000 cached page requests through the full proxy stack. Measure p50, p95, p99 latency.",
        pass: "p50 < 50ms, p95 < 150ms, p99 < 300ms (cached path)",
        fail: "p95 > 200ms or any timeout"
      },
      {
        id: "E02-2",
        name: "JS Content Capture",
        method: "Build 5 test pages that render critical content only via JavaScript (React SPA, lazy load, shadow DOM, dynamic text, async fetch). Run each through renderer.",
        pass: "All 5 pages return HTML containing the JS-rendered content in the snapshot",
        fail: "Any page returns placeholder text or empty content sections"
      },
      {
        id: "E02-3",
        name: "Cache Hit Rate",
        method: "Simulate 10,000 crawler requests across 500 unique URLs. Measure cache hit rate after 24-hour warm period.",
        pass: "Cache hit rate > 85%. No origin overload.",
        fail: "Cache hit rate < 80% or origin receives > 20% of total requests"
      },
      {
        id: "E02-4",
        name: "Render Accuracy vs Human View",
        method: "Take 20 random client pages. Compare rendered snapshot to what a human sees in Chrome. Use visual diff tool (Pixelmatch).",
        pass: "Content parity > 95%. All text content present. Schema-relevant elements captured.",
        fail: "Missing navigation, missing body content, or wrong text in snapshot"
      }
    ]
  },
  {
    phase: "03",
    title: "Content Transformation Engine",
    duration: "Week 10–13",
    color: "#00b4d8",
    objective: "Transform arbitrary client HTML into AI-optimized content automatically, per crawler, per page type.",
    steps: [
      "Build an HTML parser layer: ingest raw HTML, produce a structured content tree (headings, paragraphs, lists, tables, metadata)",
      "Build a page type classifier: Blog / Product / Service / About / FAQ / Landing — use heuristics first, ML later",
      "Build schema injection module per page type: Blog → Article schema, Product → Product schema, Service → Service schema with FAQ",
      "Build Q&A atomizer: detect question-shaped headings (H2/H3 starting with What/How/Why/When/Where), wrap with Q&A markup",
      "Build entity extractor: identify brand name, product names, categories, locations from content. Output as JSON-LD named entities.",
      "Build statistical signal injector: detect claims without citations, flag them, append citation wrapper markup",
      "Build per-crawler transformation profiles: GPTBot gets one output, PerplexityBot gets another (Perplexity weights freshness signals differently than OpenAI)",
      "Build a transformation audit log: for every page transformed, store original HTML, transformed HTML, and diff — reviewable in dashboard",
    ],
    evals: [
      {
        id: "E03-1",
        name: "Schema Validity",
        method: "Run 100 transformed pages through Google Rich Results Test API and schema.org validator.",
        pass: "100% valid schema, zero errors, zero warnings",
        fail: "Any invalid schema output"
      },
      {
        id: "E03-2",
        name: "Page Type Classification Accuracy",
        method: "Build a labeled test set of 200 pages (40 per type). Run classifier against it.",
        pass: "≥ 92% classification accuracy across all page types",
        fail: "< 90% accuracy or any page type < 85%"
      },
      {
        id: "E03-3",
        name: "Entity Extraction Precision",
        method: "Take 50 real client pages. Manually label entities. Compare to extractor output.",
        pass: "≥ 88% precision, ≥ 85% recall on brand name and product entity extraction",
        fail: "< 85% precision or missed brand name on any page"
      },
      {
        id: "E03-4",
        name: "LLM Citation Test (the real one)",
        method: "Take 10 pages before and after transformation. Ask ChatGPT, Perplexity, and Claude identical questions that the page answers. Record citation rate before and after.",
        pass: "Citation rate increases ≥ 30% post-transformation across all three LLMs",
        fail: "No measurable improvement or citation rate decreases"
      },
      {
        id: "E03-5",
        name: "Zero Human Impact",
        method: "A/B test: 1000 human visitors see original, 1000 see transformed version (via browser UA detection). Compare Core Web Vitals and bounce rate.",
        pass: "No statistically significant difference in CWV or bounce rate between groups",
        fail: "Any CWV regression or bounce rate increase > 5%"
      }
    ]
  },
  {
    phase: "04",
    title: "Data Pipeline & Intelligence Layer",
    duration: "Week 14–17",
    color: "#ffd60a",
    objective: "Turn raw crawler hit data into actionable intelligence. This is your moat.",
    steps: [
      "Deploy ClickHouse on a dedicated server. Schema design: bot_events table (timestamp, bot_id, confidence, url, page_type, transformation_applied, cache_hit)",
      "Build a Kafka producer in the proxy: every bot hit fires an event to a Kafka topic within 5ms (async, non-blocking)",
      "Build a Kafka consumer that writes to ClickHouse in micro-batches (every 100ms or 1000 events, whichever first)",
      "Build a citation tracking module: daily job that prompts ChatGPT, Perplexity, and Claude with 50 test queries per client. Records whether client is cited.",
      "Build a correlation engine: given crawler hit data and citation data, run Pearson correlation between transformation events and citation outcomes",
      "Build an anomaly detector: if a crawler's hit pattern changes significantly (frequency, pages, timing), fire an alert — it means the LLM updated its retrieval algorithm",
      "Build a competitive intelligence layer: track which other domains appear alongside client in LLM citations for the same queries",
      "Build dbt transformation models to power dashboard metrics: citation rate, share of voice, crawler coverage, transformation impact",
    ],
    evals: [
      {
        id: "E04-1",
        name: "Pipeline Throughput",
        method: "Load test: simulate 50,000 concurrent bot events. Measure end-to-end latency from proxy hit to ClickHouse write.",
        pass: "p99 < 500ms end-to-end. Zero event loss. Kafka consumer lag < 10 seconds.",
        fail: "Any event loss or Kafka lag > 30 seconds under load"
      },
      {
        id: "E04-2",
        name: "Citation Tracking Accuracy",
        method: "Manually verify 100 citation tracking results against actual LLM responses. Compare automated tracking to manual ground truth.",
        pass: "≥ 95% accuracy. Zero false positives (claiming citation when none exists).",
        fail: "< 93% accuracy or any false positive"
      },
      {
        id: "E04-3",
        name: "Correlation Signal Validity",
        method: "Run correlation engine on 30 days of data from 5 test clients. Verify statistical methodology with a p-value threshold.",
        pass: "Statistically significant correlation (p < 0.05) between transformation events and citation improvement for ≥ 3 of 5 clients",
        fail: "No significant correlation found (means either product doesn't work or methodology is wrong — both require investigation)"
      },
      {
        id: "E04-4",
        name: "Anomaly Detection Sensitivity",
        method: "Manually simulate a crawler behavior change: change hit frequency pattern for GPTBot in test data. Verify detector fires.",
        pass: "Alert fires within 24 hours of pattern change. False positive rate < 5% over 30-day period.",
        fail: "Alert doesn't fire, or fires > 3 false positives per week"
      }
    ]
  },
  {
    phase: "05",
    title: "Client Dashboard",
    duration: "Week 18–20",
    color: "#ff006e",
    objective: "The product surface. What clients pay for and what they see every day. Must be self-explanatory.",
    steps: [
      "Design three core views: Overview (health at a glance), Crawlers (which bots, when, what they saw), Citations (which LLMs cite you and for what)",
      "Build real-time crawler feed: live stream of bot hits with identity, confidence score, page, and transformation applied",
      "Build citation timeline: for each tracked query, show citation history over time across ChatGPT / Perplexity / Claude / Gemini",
      "Build competitor comparison: show client citation rate vs top 3 competitors for shared queries",
      "Build transformation diff viewer: for any page, show original vs transformed HTML side by side. Show schema injected. Show entities extracted.",
      "Build alert system: email + webhook when citation rate drops > 20%, when a new competitor appears in citations, when a crawler stops hitting site",
      "Build onboarding flow: client installs a DNS redirect or drops a JS snippet. System auto-discovers pages and starts transformation within 15 minutes.",
      "Ship a public-facing report: monthly PDF showing citation rate trend, crawler coverage, top cited pages, recommendations",
    ],
    evals: [
      {
        id: "E05-1",
        name: "Onboarding Time",
        method: "Time 10 test client onboardings end-to-end: from account creation to first crawler hit being tracked.",
        pass: "< 15 minutes for DNS method, < 5 minutes for JS snippet method. Zero support required.",
        fail: "> 20 minutes or requires any manual intervention"
      },
      {
        id: "E05-2",
        name: "Dashboard Comprehension Test",
        method: "Show the dashboard to 5 people who have never seen it (CMO-level, non-technical). Ask them to explain what they see and find their citation rate.",
        pass: "4 out of 5 correctly identify their citation rate and understand the trend within 2 minutes",
        fail: "Majority require explanation to understand core metrics"
      },
      {
        id: "E05-3",
        name: "Data Freshness",
        method: "Trigger a crawler hit manually. Measure time until it appears in the dashboard.",
        pass: "< 30 seconds from crawler hit to dashboard update",
        fail: "> 60 seconds or requires page refresh"
      },
      {
        id: "E05-4",
        name: "Alert Reliability",
        method: "Simulate a citation rate drop of 25% for a test client. Verify alert fires.",
        pass: "Alert fires within 1 hour. Correct client notified. Correct metric cited in alert.",
        fail: "Alert doesn't fire or fires for wrong client"
      }
    ]
  },
  {
    phase: "06",
    title: "Production Hardening & Scale",
    duration: "Week 21–24",
    color: "#06d6a0",
    objective: "Make it production-ready. This runs in front of client websites — it cannot fail.",
    steps: [
      "Implement circuit breakers on every external dependency: renderer down → serve cached version, ClickHouse down → buffer to local queue",
      "Set up multi-region deployment: Workers run globally, renderer clusters in EU-West and US-East minimum",
      "Implement automated bot IP range updates with zero-downtime deployment: update fires, new config propagates to all edge nodes in < 60 seconds",
      "Run full chaos engineering suite: kill the renderer, kill Kafka, kill ClickHouse, kill Redis — verify graceful degradation each time",
      "Security audit: penetration test the proxy itself. You're a MITM by design — verify no client data leaks between tenants.",
      "GDPR compliance review: what data are you storing? For how long? Under what legal basis? Build data deletion pipeline.",
      "Load test at 10x projected capacity before first enterprise client",
      "Write runbooks for every failure mode identified in chaos testing. On-call rotation documented.",
    ],
    evals: [
      {
        id: "E06-1",
        name: "Chaos Test: Renderer Down",
        method: "Kill all renderer instances. Verify proxy behavior for 30 minutes.",
        pass: "Proxy serves cached versions for all previously rendered pages. New uncached pages served unmodified (not broken). Zero client downtime.",
        fail: "Any 5xx returned to LLM crawlers or human traffic"
      },
      {
        id: "E06-2",
        name: "Load Test",
        method: "Simulate 100,000 concurrent requests across 10 test client domains using k6.",
        pass: "p99 latency < 500ms. Zero 5xx. CPU < 70% on all nodes. Auto-scaling fires correctly.",
        fail: "Any 5xx, p99 > 1 second, or auto-scaling fails to trigger"
      },
      {
        id: "E06-3",
        name: "Tenant Isolation",
        method: "Security test: attempt to access Client A's transformation data or cached pages from Client B's account context.",
        pass: "Zero cross-tenant data access possible. Every attempt returns 403.",
        fail: "Any cross-tenant data visible"
      },
      {
        id: "E06-4",
        name: "IP Range Update Speed",
        method: "Trigger a manual IP range update. Measure propagation time to all edge nodes.",
        pass: "Full propagation < 60 seconds. Zero dropped requests during update.",
        fail: "> 2 minutes propagation or any request failure during update"
      }
    ]
  },
  {
    phase: "07",
    title: "First Client & Validation",
    duration: "Week 25–28",
    color: "#fb5607",
    objective: "One real paying client. Real data. Prove the product works before scaling.",
    steps: [
      "Identify one beta client: mid-size B2B company, existing website, measurable product (already tracks some SEO). Offer 60 days free.",
      "Run a baseline: 30 days of citation tracking before proxy goes live. Document current citation rate across all target queries.",
      "Go live with proxy on one subdirectory first (/blog or /products). Not the whole domain.",
      "Run weekly citation checks: same query set, same three LLMs, document every change.",
      "Run monthly review call: show the client their data. Get qualitative feedback on dashboard usability.",
      "After 60 days: present before/after citation rate data. If improvement ≥ 20%, pitch paid contract.",
      "Document every failure, edge case, and unexpected behavior. These become the product roadmap.",
      "Use this client's data to build the first public case study — anonymized if needed.",
    ],
    evals: [
      {
        id: "E07-1",
        name: "Citation Rate Improvement",
        method: "Compare citation rate 30 days pre-proxy vs 60 days post-proxy across 50 tracked queries.",
        pass: "Citation rate improvement ≥ 20% across ChatGPT + Perplexity combined. At least one new LLM citation on pages that had zero before.",
        fail: "< 10% improvement or negative trend. Requires full diagnosis before next client."
      },
      {
        id: "E07-2",
        name: "Zero Production Incidents",
        method: "Monitor client website performance metrics for full 60-day period.",
        pass: "Zero incidents caused by proxy. Client Core Web Vitals unchanged. Zero human traffic complaints.",
        fail: "Any incident traceable to proxy layer"
      },
      {
        id: "E07-3",
        name: "Client Renewal Signal",
        method: "At day 60 review, present data and ask for paid contract decision.",
        pass: "Client signs paid contract OR provides specific, actionable reasons they won't. Both outcomes are useful.",
        fail: "Client is indifferent — means product isn't creating enough value to drive a decision either way"
      }
    ]
  }
];

const totalEvals = plan.reduce((sum, phase) => sum + phase.evals.length, 0);

export default function BuildPlan() {
  const [activePhase, setActivePhase] = useState(null);
  const [activeEval, setActiveEval] = useState(null);
  const [view, setView] = useState("plan");

  const allEvals = plan.flatMap(p => p.evals.map(e => ({ ...e, phaseTitle: p.title, phaseColor: p.color, phase: p.phase })));

  return (
    <div style={{
      minHeight: "100vh",
      background: "#080808",
      color: "#e8e8e8",
      fontFamily: "'Courier New', Courier, monospace",
      padding: "0",
    }}>
      {/* Header */}
      <div style={{
        borderBottom: "1px solid #1a1a1a",
        padding: "32px 40px 24px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
        flexWrap: "wrap",
        gap: "16px"
      }}>
        <div>
          <div style={{ fontSize: "11px", letterSpacing: "4px", color: "#444", marginBottom: "8px", textTransform: "uppercase" }}>
            LLM Proxy Agency — Build Plan v1.0
          </div>
          <h1 style={{
            fontSize: "clamp(22px, 4vw, 36px)",
            fontWeight: "900",
            margin: 0,
            letterSpacing: "-1px",
            color: "#fff"
          }}>
            28-Week Engineering Roadmap
          </h1>
          <div style={{ marginTop: "8px", fontSize: "13px", color: "#555" }}>
            {plan.length} phases · {totalEvals} evals · production-ready at week 28
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          {["plan", "evals"].map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: "8px 20px",
              background: view === v ? "#fff" : "transparent",
              color: view === v ? "#000" : "#555",
              border: "1px solid",
              borderColor: view === v ? "#fff" : "#222",
              borderRadius: "2px",
              cursor: "pointer",
              fontSize: "11px",
              letterSpacing: "2px",
              textTransform: "uppercase",
              fontFamily: "inherit",
              transition: "all 0.15s"
            }}>
              {v === "plan" ? "Phases" : `Evals (${totalEvals})`}
            </button>
          ))}
        </div>
      </div>

      {view === "plan" ? (
        <div style={{ padding: "32px 40px", maxWidth: "1200px" }}>
          {/* Timeline bar */}
          <div style={{ display: "flex", gap: "3px", marginBottom: "48px", height: "6px" }}>
            {plan.map(p => (
              <div key={p.phase} onClick={() => setActivePhase(activePhase === p.phase ? null : p.phase)}
                style={{
                  flex: 1,
                  background: activePhase === p.phase ? p.color : p.color + "44",
                  borderRadius: "1px",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }} />
            ))}
          </div>

          {plan.map((phase, idx) => {
            const isOpen = activePhase === phase.phase;
            return (
              <div key={phase.phase} style={{ marginBottom: "4px" }}>
                {/* Phase header */}
                <div
                  onClick={() => setActivePhase(isOpen ? null : phase.phase)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "60px 1fr auto auto",
                    alignItems: "center",
                    gap: "20px",
                    padding: "20px 24px",
                    background: isOpen ? "#111" : "#0c0c0c",
                    border: "1px solid",
                    borderColor: isOpen ? phase.color + "44" : "#111",
                    cursor: "pointer",
                    borderRadius: "2px",
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{
                    fontSize: "28px",
                    fontWeight: "900",
                    color: phase.color,
                    letterSpacing: "-2px",
                    lineHeight: 1
                  }}>
                    {phase.phase}
                  </div>
                  <div>
                    <div style={{ fontSize: "15px", fontWeight: "700", color: isOpen ? "#fff" : "#ccc", letterSpacing: "-0.3px" }}>
                      {phase.title}
                    </div>
                    {!isOpen && (
                      <div style={{ fontSize: "12px", color: "#444", marginTop: "2px" }}>{phase.objective}</div>
                    )}
                  </div>
                  <div style={{ fontSize: "11px", color: "#444", letterSpacing: "1px", whiteSpace: "nowrap" }}>
                    {phase.duration}
                  </div>
                  <div style={{
                    fontSize: "10px",
                    color: phase.color,
                    letterSpacing: "1px",
                    background: phase.color + "11",
                    padding: "4px 10px",
                    borderRadius: "2px",
                    whiteSpace: "nowrap"
                  }}>
                    {phase.evals.length} EVALS
                  </div>
                </div>

                {/* Phase body */}
                {isOpen && (
                  <div style={{
                    background: "#0d0d0d",
                    border: "1px solid",
                    borderColor: phase.color + "22",
                    borderTop: "none",
                    padding: "32px",
                    borderRadius: "0 0 2px 2px"
                  }}>
                    <div style={{
                      fontSize: "13px",
                      color: phase.color,
                      marginBottom: "28px",
                      paddingBottom: "16px",
                      borderBottom: "1px solid #1a1a1a",
                      lineHeight: "1.6"
                    }}>
                      OBJECTIVE: {phase.objective}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "40px" }}>
                      {/* Steps */}
                      <div>
                        <div style={{ fontSize: "10px", letterSpacing: "3px", color: "#444", marginBottom: "16px", textTransform: "uppercase" }}>
                          Build Steps
                        </div>
                        {phase.steps.map((step, i) => (
                          <div key={i} style={{
                            display: "flex",
                            gap: "16px",
                            padding: "10px 0",
                            borderBottom: "1px solid #141414",
                            alignItems: "flex-start"
                          }}>
                            <div style={{
                              minWidth: "22px",
                              height: "22px",
                              background: phase.color + "22",
                              color: phase.color,
                              fontSize: "10px",
                              fontWeight: "700",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              borderRadius: "2px",
                              marginTop: "1px"
                            }}>
                              {String(i + 1).padStart(2, '0')}
                            </div>
                            <div style={{ fontSize: "12px", color: "#bbb", lineHeight: "1.6" }}>{step}</div>
                          </div>
                        ))}
                      </div>

                      {/* Evals */}
                      <div>
                        <div style={{ fontSize: "10px", letterSpacing: "3px", color: "#444", marginBottom: "16px", textTransform: "uppercase" }}>
                          Eval Suite
                        </div>
                        {phase.evals.map((ev) => (
                          <div key={ev.id}
                            onClick={(e) => { e.stopPropagation(); setActiveEval(activeEval === ev.id ? null : ev.id); }}
                            style={{
                              marginBottom: "10px",
                              background: activeEval === ev.id ? "#1a1a1a" : "#111",
                              border: "1px solid",
                              borderColor: activeEval === ev.id ? phase.color + "55" : "#191919",
                              borderRadius: "2px",
                              overflow: "hidden",
                              cursor: "pointer"
                            }}>
                            <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div>
                                <span style={{ fontSize: "10px", color: phase.color, letterSpacing: "1px", marginRight: "10px" }}>{ev.id}</span>
                                <span style={{ fontSize: "12px", color: "#ddd", fontWeight: "600" }}>{ev.name}</span>
                              </div>
                              <div style={{ fontSize: "10px", color: "#333" }}>{activeEval === ev.id ? "▲" : "▼"}</div>
                            </div>

                            {activeEval === ev.id && (
                              <div style={{ padding: "0 16px 16px", borderTop: "1px solid #1a1a1a" }}>
                                <div style={{ marginTop: "14px" }}>
                                  <div style={{ fontSize: "9px", letterSpacing: "2px", color: "#444", marginBottom: "6px" }}>METHOD</div>
                                  <div style={{ fontSize: "11px", color: "#999", lineHeight: "1.6" }}>{ev.method}</div>
                                </div>
                                <div style={{ marginTop: "14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                                  <div>
                                    <div style={{ fontSize: "9px", letterSpacing: "2px", color: "#00ff88", marginBottom: "6px" }}>PASS</div>
                                    <div style={{ fontSize: "11px", color: "#888", lineHeight: "1.6" }}>{ev.pass}</div>
                                  </div>
                                  <div>
                                    <div style={{ fontSize: "9px", letterSpacing: "2px", color: "#ff4444", marginBottom: "6px" }}>FAIL</div>
                                    <div style={{ fontSize: "11px", color: "#888", lineHeight: "1.6" }}>{ev.fail}</div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Evals view */
        <div style={{ padding: "32px 40px", maxWidth: "1100px" }}>
          <div style={{ marginBottom: "32px" }}>
            <div style={{ fontSize: "11px", letterSpacing: "3px", color: "#444", marginBottom: "8px" }}>EVAL REGISTRY</div>
            <div style={{ fontSize: "13px", color: "#555" }}>
              {totalEvals} total tests across {plan.length} phases. Every pass/fail threshold is binary — no partial credit.
            </div>
          </div>

          <div style={{ display: "grid", gap: "6px" }}>
            {allEvals.map((ev) => (
              <div key={ev.id}
                onClick={() => setActiveEval(activeEval === ev.id ? null : ev.id)}
                style={{
                  background: activeEval === ev.id ? "#111" : "#0c0c0c",
                  border: "1px solid",
                  borderColor: activeEval === ev.id ? ev.phaseColor + "44" : "#141414",
                  borderRadius: "2px",
                  overflow: "hidden",
                  cursor: "pointer",
                  transition: "all 0.1s"
                }}>
                <div style={{ padding: "14px 20px", display: "grid", gridTemplateColumns: "80px 1fr 160px", alignItems: "center", gap: "20px" }}>
                  <div style={{ fontSize: "11px", color: ev.phaseColor, letterSpacing: "1px", fontWeight: "700" }}>{ev.id}</div>
                  <div style={{ fontSize: "13px", color: "#ccc" }}>{ev.name}</div>
                  <div style={{ fontSize: "10px", color: "#333", textAlign: "right", letterSpacing: "0.5px" }}>Phase {ev.phase}: {ev.phaseTitle}</div>
                </div>

                {activeEval === ev.id && (
                  <div style={{ padding: "0 20px 20px", borderTop: "1px solid #1a1a1a" }}>
                    <div style={{ marginTop: "16px", marginBottom: "16px" }}>
                      <div style={{ fontSize: "9px", letterSpacing: "2px", color: "#444", marginBottom: "8px" }}>TEST METHOD</div>
                      <div style={{ fontSize: "12px", color: "#999", lineHeight: "1.7", background: "#0a0a0a", padding: "12px", borderRadius: "2px", borderLeft: `3px solid ${ev.phaseColor}` }}>
                        {ev.method}
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                      <div style={{ background: "#0a0a0a", padding: "14px", borderRadius: "2px", borderLeft: "3px solid #00ff88" }}>
                        <div style={{ fontSize: "9px", letterSpacing: "2px", color: "#00ff88", marginBottom: "8px" }}>PASS CRITERIA</div>
                        <div style={{ fontSize: "12px", color: "#888", lineHeight: "1.6" }}>{ev.pass}</div>
                      </div>
                      <div style={{ background: "#0a0a0a", padding: "14px", borderRadius: "2px", borderLeft: "3px solid #ff4444" }}>
                        <div style={{ fontSize: "9px", letterSpacing: "2px", color: "#ff4444", marginBottom: "8px" }}>FAIL CRITERIA</div>
                        <div style={{ fontSize: "12px", color: "#888", lineHeight: "1.6" }}>{ev.fail}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{
        borderTop: "1px solid #111",
        padding: "24px 40px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "12px",
        marginTop: "40px"
      }}>
        <div style={{ fontSize: "11px", color: "#333", letterSpacing: "1px" }}>
          RULE: No phase advances until ALL evals in current phase pass. No exceptions.
        </div>
        <div style={{ display: "flex", gap: "24px" }}>
          {plan.map(p => (
            <div key={p.phase} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: p.color }} />
              <span style={{ fontSize: "10px", color: "#333" }}>P{p.phase}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
