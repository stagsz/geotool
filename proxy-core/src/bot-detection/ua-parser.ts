import { BOT_PROFILES, BotProfile } from "./registry";

export interface UaParseResult {
  matched: boolean;
  botProfile: BotProfile | null;
  botName: string | null;
  version: string | null;
  rawUa: string;
}

export function parseUserAgent(ua: string): UaParseResult {
  for (const profile of BOT_PROFILES) {
    for (const pattern of profile.uaPatterns) {
      if (pattern.test(ua)) {
        const versionMatch = ua.match(/\/([\d]+\.[\d]+)/);
        return {
          matched: true,
          botProfile: profile,
          botName: profile.name,
          version: versionMatch ? versionMatch[1] : null,
          rawUa: ua,
        };
      }
    }
  }

  return {
    matched: false,
    botProfile: null,
    botName: null,
    version: null,
    rawUa: ua,
  };
}
