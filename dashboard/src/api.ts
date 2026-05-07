/// <reference types="vite/client" />
const BASE_URL =
  import.meta.env.VITE_API_URL ?? "https://geotool-production-4198.up.railway.app";

export interface StatsResponse {
  total: number;
  since: string;
  byBot: Record<string, number>;
  byPageType: Record<string, number>;
  topPages: Array<{ url: string; count: number }>;
  byDay: Array<{ date: string; count: number }>;
}

export const BOT_DISPLAY_NAMES: Record<string, string> = {
  gptbot: "GPTBot",
  claudebot: "ClaudeBot",
  googlebot: "Googlebot",
  bingbot: "BingBot",
  perplexitybot: "PerplexityBot",
};

export function formatBotName(id: string): string {
  return BOT_DISPLAY_NAMES[id.toLowerCase()] ?? id.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function fetchStats(days: number, hostname: string): Promise<StatsResponse> {
  const params = new URLSearchParams({ days: String(days) });
  if (hostname.trim()) {
    params.set("hostname", hostname.trim());
  }
  const res = await fetch(`${BASE_URL}/stats?${params.toString()}`);
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<StatsResponse>;
}
