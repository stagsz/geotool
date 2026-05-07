import { parseUserAgent } from "./ua-parser";
import { calculateConfidence, ConfidenceFactors } from "./confidence-scorer";
import { isHoneypotRequest, HoneypotHit } from "./honeypot";
import { isIpInCidr, KvStore } from "./ip-updater";
import { verifyPtr } from "./ptr-verifier";
import { analyzeBehavior, BehaviorSignal } from "./behavior-analyzer";

export interface DetectionResult {
  isBot: boolean;
  isHoneypot: boolean;
  botId: string | null;
  botName: string | null;
  confidence: number;
  verified: boolean;
  ip: string;
  userAgent: string;
  fingerprint: string | null;
  timestamp: string;
  behaviorSignals: BehaviorSignal[];
}

export class BotDetectionEngine {
  constructor(
    private readonly kv: KvStore,
    private readonly fetcher: typeof fetch = fetch
  ) {}

  async detect(request: Request): Promise<DetectionResult> {
    const url = new URL(request.url);
    const ua = request.headers.get("user-agent") ?? "";
    const ip =
      request.headers.get("cf-connecting-ip") ??
      (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
    const fingerprint =
      request.headers.get("cf-ja4-fingerprint") ??
      request.headers.get("cf-ja3-fingerprint");
    const timestamp = new Date().toISOString();

    if (isHoneypotRequest(url.pathname)) {
      return {
        isBot: true,
        isHoneypot: true,
        botId: null,
        botName: null,
        confidence: 0,
        verified: false,
        ip,
        userAgent: ua,
        fingerprint,
        timestamp,
        behaviorSignals: [],
      };
    }

    const uaResult = parseUserAgent(ua);
    if (!uaResult.matched || !uaResult.botProfile) {
      return {
        isBot: false,
        isHoneypot: false,
        botId: null,
        botName: null,
        confidence: 0,
        verified: false,
        ip,
        userAgent: ua,
        fingerprint,
        timestamp,
        behaviorSignals: [],
      };
    }

    const profile = uaResult.botProfile;
    const behavior = analyzeBehavior(request);
    const [ipInRange, ptrVerified] = await Promise.all([
      this.checkIpInRange(ip, profile.id),
      verifyPtr(ip, profile.expectedPtrDomain, this.fetcher),
    ]);

    const factors: ConfidenceFactors = {
      uaMatch: true,
      ipInRange,
      ptrVerified,
      behaviorNormal: behavior.behaviorNormal,
    };

    const confidence = calculateConfidence(factors);

    return {
      isBot: true,
      isHoneypot: false,
      botId: profile.id,
      botName: profile.name,
      confidence: confidence.score,
      verified: confidence.verified,
      ip,
      userAgent: ua,
      fingerprint,
      timestamp,
      behaviorSignals: behavior.signals,
    };
  }

  async logHoneypotHit(
    request: Request,
    detection: DetectionResult
  ): Promise<void> {
    const hit: HoneypotHit = {
      timestamp: detection.timestamp,
      ip: detection.ip,
      userAgent: detection.userAgent,
      path: new URL(request.url).pathname,
      headers: Object.fromEntries(request.headers.entries()),
    };
    console.log("[HONEYPOT]", JSON.stringify(hit));
  }

  private async checkIpInRange(ip: string, botId: string): Promise<boolean> {
    const ranges = (await this.kv.get(
      `ip-ranges:${botId}`,
      "json"
    )) as string[] | null;
    if (!ranges || ranges.length === 0) return false;
    return ranges.some((cidr) => isIpInCidr(ip, cidr));
  }
}
