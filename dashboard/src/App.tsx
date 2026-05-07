import { useState, useEffect, useCallback, useRef } from "react";
import { fetchStats, formatBotName, StatsResponse } from "./api";

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

  // Y-axis: 0 and max labels
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

        {/* Horizontal grid lines */}
        {[0.25, 0.5, 0.75, 1].map((frac) => {
          const gy = PAD_TOP + chartH - frac * chartH;
          return (
            <line
              key={frac}
              x1={PAD_LEFT}
              y1={gy}
              x2={PAD_LEFT + chartW}
              y2={gy}
              stroke="#2a2f47"
              strokeWidth="1"
            />
          );
        })}

        {/* Filled area */}
        <polygon points={polygonPoints} fill={`url(#${gradientId})`} />

        {/* Line */}
        <polyline
          points={polylinePoints}
          fill="none"
          stroke="#00e87a"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          filter="url(#lineglow)"
        />

        {/* Dots on each data point */}
        {pts.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="2.5"
            fill="#0c0e14"
            stroke="#00e87a"
            strokeWidth="1.5"
          >
            <title>{`${p.date}: ${p.count} hits`}</title>
          </circle>
        ))}

        {/* Y-axis labels */}
        <text
          x={PAD_LEFT - 6}
          y={yTickY}
          textAnchor="end"
          dominantBaseline="hanging"
          fill="#6b7194"
          fontSize="10"
          fontFamily="IBM Plex Mono, monospace"
        >
          {maxCount}
        </text>
        <text
          x={PAD_LEFT - 6}
          y={yZeroY}
          textAnchor="end"
          dominantBaseline="auto"
          fill="#6b7194"
          fontSize="10"
          fontFamily="IBM Plex Mono, monospace"
        >
          0
        </text>

        {/* X-axis: first and last date */}
        <text
          x={pts[0].x}
          y={HEIGHT - 4}
          textAnchor="start"
          fill="#6b7194"
          fontSize="10"
          fontFamily="IBM Plex Mono, monospace"
        >
          {firstDate}
        </text>
        {data.length > 1 && (
          <text
            x={pts[pts.length - 1].x}
            y={HEIGHT - 4}
            textAnchor="end"
            fill="#6b7194"
            fontSize="10"
            fontFamily="IBM Plex Mono, monospace"
          >
            {lastDate}
          </text>
        )}
      </svg>
    </div>
  );
}

// ── Bot list card ────────────────────────────────────────────────────────────

function BotCard({ byBot }: { byBot: Record<string, number> }) {
  const entries = Object.entries(byBot).sort((a, b) => b[1] - a[1]);
  const maxVal = entries[0]?.[1] ?? 1;
  return (
    <div className="card">
      <div className="card-label">Bots detected</div>
      {entries.length === 0 ? (
        <p className="empty">No bot traffic recorded.</p>
      ) : (
        <div className="bot-list">
          {entries.map(([id, count]) => (
            <div key={id} className="bot-row">
              <span className="bot-name">{formatBotName(id)}</span>
              <div className="bot-bar-track">
                <div
                  className="bot-bar-fill"
                  style={{ width: `${(count / maxVal) * 100}%` }}
                />
              </div>
              <span className="bot-count">{count}</span>
            </div>
          ))}
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

// ── Top pages panel ──────────────────────────────────────────────────────────

function TopPagesPanel({ pages }: { pages: StatsResponse["topPages"] }) {
  const maxCount = pages[0]?.count ?? 1;
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
            <div key={p.url} className="top-page-row">
              <span className="top-page-rank">#{i + 1}</span>
              <span className="top-page-url" title={p.url}>{p.url}</span>
              <div className="top-page-bar-track">
                <div
                  className="top-page-bar-fill"
                  style={{ width: `${(p.count / maxCount) * 100}%` }}
                />
              </div>
              <span className="top-page-count">{p.count}</span>
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
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState<number>(0);

  // Debounce hostname input → hostname state
  useEffect(() => {
    const t = setTimeout(() => setHostname(hostnameInput), 500);
    return () => clearTimeout(t);
  }, [hostnameInput]);

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
    ? new Date(data.since).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

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
          <input
            type="text"
            className="input input-hostname"
            placeholder="hostname filter…"
            value={hostnameInput}
            onChange={(e) => setHostnameInput(e.target.value)}
            aria-label="Filter by hostname"
            spellCheck={false}
          />

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
                <path d="M10 6A4 4 0 1 1 6 2V0L9 3 6 6V4a2 2 0 1 0 2 2h2z" fill="currentColor"/>
              </svg>
            )}
            {loading ? "Loading" : "Refresh"}
          </button>

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
              <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M7 4v3.5M7 9.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
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
              {/* Total */}
              <div className="card">
                <div className="card-label">Total hits</div>
                <div className="total-number mono">{data.total.toLocaleString()}</div>
                {sinceLabel && (
                  <div className="total-since">since {sinceLabel}</div>
                )}
              </div>

              {/* Bots */}
              <BotCard byBot={data.byBot} />

              {/* Page types */}
              <PageTypeCard byPageType={data.byPageType} />
            </div>

            {/* ── Daily trend ── */}
            <div className="panel">
              <div className="panel-header">
                <span className="panel-title">Daily trend</span>
                <span className="panel-meta">{data.byDay.length} days</span>
              </div>
              <Sparkline data={data.byDay} />
            </div>

            {/* ── Top pages ── */}
            <TopPagesPanel pages={data.topPages} />
          </>
        )}
      </main>
    </>
  );
}
