import { useState, useEffect, useCallback, useRef } from "react";
import { fetchStats, fetchHostnames, fetchPageDetail, formatBotName, StatsResponse, PageDetailResponse } from "./api";
import { useAuth } from "./lib/auth";
import { isAccessGranted } from "./lib/access";
import { PlanBadge } from "./components/PlanBadge";
import { AccountMenu } from "./components/AccountMenu";
import { PaywallOverlay } from "./components/PaywallOverlay";

// ── SVG Sparkline ────────────────────────────────────────────────────────────

interface SparklineProps {
  data: Array<{ date: string; count: number }>;
}

function Sparkline({ data }: SparklineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const HEIGHT = 130;
  const PAD_LEFT = 42;
  const PAD_RIGHT = 16;
  const PAD_TOP = 8;
  const PAD_BOTTOM = 24;

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(w);
    });
    obs.observe(containerRef.current);
    setWidth(containerRef.current.clientWidth);
    return () => obs.disconnect();
  }, []);

  if (!data || data.length === 0) {
    return (
      <div ref={containerRef} className="sparkline-wrap">
        <p className="empty">No daily data available.</p>
      </div>
    );
  }

  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const chartW = width - PAD_LEFT - PAD_RIGHT;
  const chartH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const step = data.length > 1 ? chartW / (data.length - 1) : chartW;

  const pts = data.map((d, i) => ({
    x: PAD_LEFT + i * step,
    y: PAD_TOP + chartH - (d.count / maxCount) * chartH,
    ...d,
  }));

  const polylinePoints = pts.map((p) => `${p.x},${p.y}`).join(" ");
  const polygonPoints = [
    `${pts[0].x},${PAD_TOP + chartH}`,
    ...pts.map((p) => `${p.x},${p.y}`),
    `${pts[pts.length - 1].x},${PAD_TOP + chartH}`,
  ].join(" ");

  const gradientId = "sparkGrad";
  const firstDate = data[0].date;
  const lastDate = data[data.length - 1].date;

  const yTickY = PAD_TOP + 4;
  const yZeroY = PAD_TOP + chartH;

  return (
    <div ref={containerRef} className="sparkline-wrap">
      <svg
        width="100%"
        height={HEIGHT}
        viewBox={`0 0 ${width} ${HEIGHT}`}
        preserveAspectRatio="none"
        aria-label="Daily hit trend"
        role="img"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00e87a" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#00e87a" stopOpacity="0.01" />
          </linearGradient>
          <filter id="lineglow">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {[0.25, 0.5, 0.75, 1].map((frac) => {
          const gy = PAD_TOP + chartH - frac * chartH;
          return (
            <line key={frac} x1={PAD_LEFT} y1={gy} x2={PAD_LEFT + chartW} y2={gy} stroke="#2a2f47" strokeWidth="1" />
          );
        })}

        <polygon points={polygonPoints} fill={`url(#${gradientId})`} />

        <polyline
          points={polylinePoints}
          fill="none"
          stroke="#00e87a"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          filter="url(#lineglow)"
        />

        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="#0c0e14" stroke="#00e87a" strokeWidth="1.5">
            <title>{`${p.date}: ${p.count} hits`}</title>
          </circle>
        ))}

        <text x={PAD_LEFT - 6} y={yTickY} textAnchor="end" dominantBaseline="hanging" fill="#6b7194" fontSize="10" fontFamily="IBM Plex Mono, monospace">
          {maxCount}
        </text>
        <text x={PAD_LEFT - 6} y={yZeroY} textAnchor="end" dominantBaseline="auto" fill="#6b7194" fontSize="10" fontFamily="IBM Plex Mono, monospace">
          0
        </text>

        <text x={pts[0].x} y={HEIGHT - 4} textAnchor="start" fill="#6b7194" fontSize="10" fontFamily="IBM Plex Mono, monospace">
          {firstDate}
        </text>
        {data.length > 1 && (
          <text x={pts[pts.length - 1].x} y={HEIGHT - 4} textAnchor="end" fill="#6b7194" fontSize="10" fontFamily="IBM Plex Mono, monospace">
            {lastDate}
          </text>
        )}
      </svg>
    </div>
  );
}

// ── Bot card with page-type breakdown ────────────────────────────────────────

function BotCard({
  byBot,
  byBotAndPageType,
}: {
  byBot: Record<string, number>;
  byBotAndPageType: Record<string, Record<string, number>>;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const entries = Object.entries(byBot).sort((a, b) => b[1] - a[1]);
  const maxVal = entries[0]?.[1] ?? 1;

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div className="card">
      <div className="card-label">Bots detected</div>
      {entries.length === 0 ? (
        <p className="empty">No bot traffic recorded.</p>
      ) : (
        <div className="bot-list">
          {entries.map(([id, count]) => {
            const pageTypes = Object.entries(byBotAndPageType[id] ?? {}).sort((a, b) => b[1] - a[1]);
            const isExpanded = expanded.has(id);
            return (
              <div key={id}>
                <div
                  className="bot-row"
                  onClick={() => pageTypes.length > 0 && toggle(id)}
                  style={{ cursor: pageTypes.length > 0 ? "pointer" : "default" }}
                >
                  <span className="bot-name" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    {pageTypes.length > 0 && (
                      <span style={{ fontSize: "9px", opacity: 0.5, userSelect: "none" }}>
                        {isExpanded ? "▾" : "▸"}
                      </span>
                    )}
                    {formatBotName(id)}
                  </span>
                  <div className="bot-bar-track">
                    <div className="bot-bar-fill" style={{ width: `${(count / maxVal) * 100}%` }} />
                  </div>
                  <span className="bot-count">{count}</span>
                </div>
                {isExpanded &&
                  pageTypes.map(([pt, ptCount]) => (
                    <div key={pt} className="bot-row" style={{ paddingLeft: "16px", opacity: 0.72 }}>
                      <span className="bot-name" style={{ fontSize: "11px" }}>{pt}</span>
                      <div className="bot-bar-track">
                        <div className="bot-bar-fill" style={{ width: `${(ptCount / count) * 100}%`, opacity: 0.6 }} />
                      </div>
                      <span className="bot-count" style={{ fontSize: "11px" }}>{ptCount}</span>
                    </div>
                  ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Page type card ───────────────────────────────────────────────────────────

function PageTypeCard({ byPageType }: { byPageType: Record<string, number> }) {
  const entries = Object.entries(byPageType).sort((a, b) => b[1] - a[1]);
  return (
    <div className="card">
      <div className="card-label">Page types</div>
      {entries.length === 0 ? (
        <p className="empty">No page type data.</p>
      ) : (
        <div className="page-type-list">
          {entries.map(([type, count]) => (
            <div key={type} className="page-type-tag">
              <span className="page-type-name">{type}</span>
              <span className="page-type-count">{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Response status card ─────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  "2": "#00e87a",
  "3": "#4fa8e8",
  "4": "#f0a030",
  "5": "#e85050",
  "0": "#6b7194",
};

function StatusCard({ byStatus }: { byStatus: Record<string, number> }) {
  const entries = Object.entries(byStatus)
    .filter(([, count]) => count > 0)
    .sort(([a], [b]) => Number(a) - Number(b));
  const maxVal = Math.max(...entries.map(([, c]) => c), 1);

  return (
    <div className="card">
      <div className="card-label">Response status</div>
      {entries.length === 0 ? (
        <p className="empty">No status data.</p>
      ) : (
        <div className="bot-list">
          {entries.map(([code, count]) => {
            const band = code === "0" ? "0" : code[0];
            const color = STATUS_COLOR[band] ?? "#6b7194";
            return (
              <div key={code} className="bot-row">
                <span className="bot-name mono" style={{ color }}>{code === "0" ? "unknown" : code}</span>
                <div className="bot-bar-track">
                  <div className="bot-bar-fill" style={{ width: `${(count / maxVal) * 100}%`, background: color }} />
                </div>
                <span className="bot-count">{count}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Hourly heatmap ───────────────────────────────────────────────────────────

function HourlyHeatmap({ byHour }: { byHour: Array<{ hour: number; count: number }> }) {
  const maxCount = Math.max(...byHour.map((h) => h.count), 1);
  return (
    <div className="panel">
      <div className="panel-header">
        <span className="panel-title">Hourly activity</span>
        <span className="panel-meta">UTC</span>
      </div>
      <div style={{ padding: "12px 16px 16px", overflowX: "auto" }}>
        <div style={{ display: "flex", gap: "3px", minWidth: "480px" }}>
          {byHour.map(({ hour, count }) => {
            const intensity = count / maxCount;
            const opacity = count === 0 ? 0.06 : 0.12 + intensity * 0.88;
            return (
              <div key={hour} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                <div
                  title={`${String(hour).padStart(2, "0")}:00 UTC — ${count} hit${count !== 1 ? "s" : ""}`}
                  style={{
                    height: "32px",
                    width: "100%",
                    borderRadius: "3px",
                    background: `rgba(0, 232, 122, ${opacity})`,
                  }}
                />
                {hour % 6 === 0 && (
                  <span style={{ fontSize: "9px", color: "#6b7194", fontFamily: "IBM Plex Mono, monospace" }}>
                    {String(hour).padStart(2, "0")}h
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Mini heatmap (used inside drill-down) ────────────────────────────────────

function MiniHeatmap({ byHour }: { byHour: Array<{ hour: number; count: number }> }) {
  const maxCount = Math.max(...byHour.map((h) => h.count), 1);
  return (
    <div style={{ display: "flex", gap: "2px" }}>
      {byHour.map(({ hour, count }) => {
        const intensity = count / maxCount;
        const opacity = count === 0 ? 0.06 : 0.12 + intensity * 0.88;
        return (
          <div
            key={hour}
            title={`${String(hour).padStart(2, "0")}:00 UTC — ${count}`}
            style={{ flex: 1, height: "18px", borderRadius: "2px", background: `rgba(0, 232, 122, ${opacity})` }}
          />
        );
      })}
    </div>
  );
}

// ── Top pages panel with drill-down ─────────────────────────────────────────

function TopPagesPanel({ pages, days }: { pages: StatsResponse["topPages"]; days: number }) {
  const maxCount = pages[0]?.count ?? 1;
  const [expandedUrl, setExpandedUrl] = useState<string | null>(null);
  const [detail, setDetail] = useState<PageDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  async function handleRowClick(url: string) {
    if (expandedUrl === url) {
      setExpandedUrl(null);
      setDetail(null);
      return;
    }
    setExpandedUrl(url);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const d = await fetchPageDetail(url, days);
      setDetail(d);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : String(err));
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="panel-title">Top pages</span>
        <span className="panel-meta">{pages.length} urls</span>
      </div>
      {pages.length === 0 ? (
        <p className="empty">No page data available.</p>
      ) : (
        <div className="top-pages-list">
          {pages.map((p, i) => (
            <div key={p.url}>
              <div className="top-page-row" onClick={() => handleRowClick(p.url)} style={{ cursor: "pointer" }}>
                <span className="top-page-rank">#{i + 1}</span>
                <span className="top-page-url" title={p.url} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  <span style={{ fontSize: "9px", opacity: 0.45, userSelect: "none" }}>
                    {expandedUrl === p.url ? "▾" : "▸"}
                  </span>
                  {p.url}
                </span>
                <div className="top-page-bar-track">
                  <div className="top-page-bar-fill" style={{ width: `${(p.count / maxCount) * 100}%` }} />
                </div>
                <span className="top-page-count">{p.count}</span>
              </div>

              {expandedUrl === p.url && (
                <div style={{
                  margin: "0 0 8px 0",
                  padding: "12px 16px",
                  background: "rgba(255,255,255,0.03)",
                  borderRadius: "6px",
                  fontSize: "12px",
                }}>
                  {detailLoading && <span style={{ color: "#6b7194" }}>Loading…</span>}
                  {detailError && <span style={{ color: "#e85050" }}>{detailError}</span>}
                  {detail && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      <div style={{ display: "flex", gap: "32px", flexWrap: "wrap" }}>
                        <div>
                          <div style={{ color: "#6b7194", marginBottom: "6px", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                            Bots
                          </div>
                          {Object.entries(detail.byBot)
                            .sort(([, a], [, b]) => b - a)
                            .map(([bot, count]) => (
                              <div key={bot} style={{ display: "flex", gap: "8px", marginBottom: "3px" }}>
                                <span style={{ color: "#c8cde8", minWidth: "90px" }}>{formatBotName(bot)}</span>
                                <span style={{ color: "#00e87a" }}>{count}</span>
                              </div>
                            ))}
                        </div>
                        <div>
                          <div style={{ color: "#6b7194", marginBottom: "6px", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                            Status
                          </div>
                          {Object.entries(detail.byStatus)
                            .filter(([, c]) => c > 0)
                            .sort(([a], [b]) => Number(a) - Number(b))
                            .map(([code, count]) => {
                              const band = code === "0" ? "0" : code[0];
                              return (
                                <div key={code} style={{ display: "flex", gap: "8px", marginBottom: "3px" }}>
                                  <span className="mono" style={{ color: STATUS_COLOR[band] ?? "#6b7194", minWidth: "60px" }}>
                                    {code === "0" ? "unknown" : code}
                                  </span>
                                  <span style={{ color: "#c8cde8" }}>{count}</span>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: "#6b7194", marginBottom: "6px", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                          Hourly (UTC)
                        </div>
                        <MiniHeatmap byHour={detail.byHour} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [days, setDays] = useState<number>(30);
  const [hostname, setHostname] = useState<string>("");
  const [hostnameInput, setHostnameInput] = useState<string>("");
  const [hostnames, setHostnames] = useState<string[]>([]);
  const [hostnamesLoaded, setHostnamesLoaded] = useState(false);
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState<number>(0);

  const { customers, subscription } = useAuth();
  const activeCustomer = customers.find((c) => c.onboarded_at != null) ?? customers[0];
  const granted = isAccessGranted({
    trialEndsAt: activeCustomer?.trial_ends_at ?? null,
    subscriptionStatus: subscription?.status ?? null,
  });

  useEffect(() => {
    const names = customers.map((c) => c.hostname);
    setHostnames(names);
    setHostnamesLoaded(true);
    if (names.length > 0 && !hostname) {
      setHostname(names[0]);
    }
  }, [customers]);

  // Debounce text input → hostname state (only used when dropdown not available)
  useEffect(() => {
    if (hostnamesLoaded && hostnames.length > 0) return;
    const t = setTimeout(() => setHostname(hostnameInput), 500);
    return () => clearTimeout(t);
  }, [hostnameInput, hostnamesLoaded, hostnames.length]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchStats(days, hostname);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [days, hostname, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = () => setRefreshKey((k) => k + 1);

  const sinceLabel = data?.since
    ? new Date(data.since).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;

  const useDropdown = hostnamesLoaded && hostnames.length > 0;

  return (
    <>
      {/* ── Header ── */}
      <header className="header">
        <div className="header-brand">
          <div className="header-logo" aria-hidden="true">
            <svg viewBox="0 0 16 16" fill="currentColor">
              <path d="M2 4h12v1.5H2V4zm0 3.5h8V9H2V7.5zm0 3.5h10v1.5H2V11z" />
            </svg>
          </div>
          <span className="header-wordmark">LLM Proxy</span>
        </div>

        <div className="header-sep" />

        <div className="header-controls">
          {useDropdown ? (
            <select
              className="select"
              value={hostname}
              onChange={(e) => setHostname(e.target.value)}
              aria-label="Filter by hostname"
            >
              <option value="">All sites</option>
              {hostnames.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              className="input input-hostname"
              placeholder="hostname filter…"
              value={hostnameInput}
              onChange={(e) => setHostnameInput(e.target.value)}
              aria-label="Filter by hostname"
              spellCheck={false}
            />
          )}

          <select
            className="select"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            aria-label="Time range"
          >
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
          </select>

          <button
            className="btn btn-primary"
            onClick={handleRefresh}
            disabled={loading}
            aria-label="Refresh data"
          >
            {loading ? <span className="spinner" /> : (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M10 6A4 4 0 1 1 6 2V0L9 3 6 6V4a2 2 0 1 0 2 2h2z" fill="currentColor" />
              </svg>
            )}
            {loading ? "Loading" : "Refresh"}
          </button>

          <PlanBadge
            trialEndsAt={activeCustomer?.trial_ends_at ?? null}
            tier={subscription?.tier ?? null}
            status={subscription?.status ?? null}
          />
          <AccountMenu />

          {sinceLabel && (
            <span className="header-since" aria-live="polite">
              since {sinceLabel}
            </span>
          )}
        </div>
      </header>

      {/* ── Content ── */}
      <main className="main">
        {error && (
          <div className="status-bar error" role="alert">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" />
              <path d="M7 4v3.5M7 9.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            {error}
          </div>
        )}

        {loading && !data && (
          <div className="status-bar loading" aria-live="polite">
            <span className="spinner" />
            Fetching analytics…
          </div>
        )}

        {data && (
          <>
            {/* ── Stat cards row ── */}
            <div className="cards-row">
              <div className="card">
                <div className="card-label">Total hits</div>
                <div className="total-number mono">{data.total.toLocaleString()}</div>
                {sinceLabel && <div className="total-since">since {sinceLabel}</div>}
              </div>

              <BotCard byBot={data.byBot} byBotAndPageType={data.byBotAndPageType ?? {}} />
              <PageTypeCard byPageType={data.byPageType} />
              <StatusCard byStatus={data.byStatus ?? {}} />
            </div>

            {/* ── Daily trend ── */}
            <div className="panel">
              <div className="panel-header">
                <span className="panel-title">Daily trend</span>
                <span className="panel-meta">{data.byDay.length} days</span>
              </div>
              <Sparkline data={data.byDay} />
            </div>

            {/* ── Hourly heatmap ── */}
            <HourlyHeatmap byHour={data.byHour ?? []} />

            {/* ── Top pages ── */}
            <TopPagesPanel pages={data.topPages} days={days} />
          </>
        )}
      </main>
      {!granted && <PaywallOverlay />}
    </>
  );
}
