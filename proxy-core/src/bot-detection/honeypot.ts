export const HONEYPOT_PATHS = [
  "/.well-known/llm-trap-1",
  "/api/internal/debug",
  "/admin/api/v1/users",
  "/.env.backup",
  "/wp-admin/hidden",
  "/sitemap-private.xml",
  "/feeds/all-content.xml",
  "/data/export.json",
  "/cache/full-index.html",
  "/training-data/raw.jsonl",
] as const;

const HONEYPOT_SET = new Set<string>(HONEYPOT_PATHS);

export function isHoneypotRequest(pathname: string): boolean {
  return HONEYPOT_SET.has(pathname);
}

export interface HoneypotHit {
  timestamp: string;
  ip: string;
  userAgent: string;
  path: string;
  headers: Record<string, string>;
}
