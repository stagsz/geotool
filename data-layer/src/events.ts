export interface BotHitEvent {
  botId: string | null;
  botName: string | null;
  confidence: number;
  url: string;
  pageType: string;
  transformationApplied: boolean;
  timestamp: string;
  ip: string;
  fingerprint: string | null;
  responseStatus?: number;
}

export interface CitationEvent {
  clientId: string;
  query: string;
  llm: string;
  cited: boolean;
  detectedAt: string;
}
