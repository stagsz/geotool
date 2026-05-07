export type BehaviorSignal =
  | "browser-headers-present"  // sec-fetch-* present — only Chromium browsers send these
  | "regional-accept-language" // locale like "en-US,en;q=0.9" — browser, not crawler
  | "full-browser-accept"      // Accept includes image/webp or image/avif — browser rendering
  | "referer-present";         // Referer set — page navigation, not direct programmatic access

export interface BehaviorAnalysis {
  behaviorNormal: boolean;
  signals: BehaviorSignal[];
}

/**
 * Detects inconsistency between claimed bot identity and actual request headers.
 * A request claiming to be a crawler but carrying browser-only headers is likely spoofed.
 * Returns behaviorNormal=false when strong browser fingerprint signals are present.
 */
export function analyzeBehavior(request: Request): BehaviorAnalysis {
  const signals: BehaviorSignal[] = [];

  if (request.headers.has("sec-fetch-mode") || request.headers.has("sec-fetch-site")) {
    signals.push("browser-headers-present");
  }

  const lang = request.headers.get("accept-language") ?? "";
  if (/[a-z]{2}-[A-Z]{2}/.test(lang)) {
    signals.push("regional-accept-language");
  }

  const accept = request.headers.get("accept") ?? "";
  if (accept.includes("image/webp") || accept.includes("image/avif")) {
    signals.push("full-browser-accept");
  }

  if (request.headers.has("referer")) {
    signals.push("referer-present");
  }

  // Strong signals are those only browsers produce — their presence alongside a bot UA
  // indicates header spoofing rather than a legitimate crawler misconfiguration.
  const strongBrowserSignals: BehaviorSignal[] = ["browser-headers-present", "full-browser-accept"];
  const behaviorNormal = !signals.some((s) => strongBrowserSignals.includes(s));

  return { behaviorNormal, signals };
}
