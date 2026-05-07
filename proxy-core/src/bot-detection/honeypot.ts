export const HONEYPOT_PATHS = [
  // LLM / AI dataset traps
  "/.well-known/llm-trap-1",
  "/training-data/raw.jsonl",
  "/llm-index.json",
  "/ai-corpus/full.jsonl",
  "/fine-tune-data.jsonl",
  "/sitemap-llm.xml",
  "/sitemap-training.xml",
  "/sitemap-full-archive.xml",
  "/embeddings/index.json",
  "/dataset/export.jsonl",

  // Internal API traps
  "/api/internal/debug",
  "/api/internal/metrics",
  "/api/internal/logs",
  "/api/internal/tokens",
  "/api/v1/admin/users",
  "/api/v1/admin/export",
  "/api/debug/tokens",
  "/graphql/introspection-dump",

  // Admin / credential traps
  "/admin/api/v1/users",
  "/admin/export/all",

  // Config / secret file traps
  "/.env.backup",
  "/.env",
  "/.npmrc.bak",
  "/config/secrets.yml",
  "/secrets.json",
  "/.git/config",

  // CMS traps
  "/wp-admin/hidden",
  "/wp-login.php",
  "/xmlrpc.php",

  // Data export / backup traps
  "/sitemap-private.xml",
  "/feeds/all-content.xml",
  "/data/export.json",
  "/data/full-crawl.jsonl",
  "/cache/full-index.html",
  "/exports/all-users.json",
  "/backup/db-dump.sql",
  "/dump.sql",
  "/user-data.jsonl",
  "/content-archive.tar.gz",
] as const;

/**
 * Path prefixes where any sub-path is a trap.
 * Only use prefixes that no legitimate production route would occupy.
 */
export const HONEYPOT_PREFIXES = [
  "/.git/",
  "/llm-data/",
  "/ai-training/",
  "/internal-tools/",
] as const;

const HONEYPOT_SET = new Set<string>(HONEYPOT_PATHS);

export function isHoneypotRequest(pathname: string): boolean {
  if (HONEYPOT_SET.has(pathname)) return true;
  for (const prefix of HONEYPOT_PREFIXES) {
    if (pathname.startsWith(prefix)) return true;
  }
  return false;
}

export interface HoneypotHit {
  timestamp: string;
  ip: string;
  userAgent: string;
  path: string;
  headers: Record<string, string>;
}
