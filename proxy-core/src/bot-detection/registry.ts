export interface BotProfile {
  id: string;
  name: string;
  uaPatterns: RegExp[];
  ipRegistryUrl: string;
  category: "training" | "indexing" | "realtime";
  expectedPtrDomain: string;
}

export const BOT_PROFILES: BotProfile[] = [
  {
    id: "gptbot",
    name: "GPTBot",
    uaPatterns: [/GPTBot\/[\d.]+/, /\bGPTBot\b/],
    ipRegistryUrl: "https://openai.com/gptbot-ranges.txt",
    category: "training",
    expectedPtrDomain: "openai.com",
  },
  {
    id: "claudebot",
    name: "ClaudeBot",
    uaPatterns: [/ClaudeBot\/[\d.]+/, /anthropic-ai/i, /\bClaudeBot\b/],
    ipRegistryUrl: "https://api.anthropic.com/ip-ranges",
    category: "indexing",
    expectedPtrDomain: "anthropic.com",
  },
  {
    id: "perplexitybot",
    name: "PerplexityBot",
    uaPatterns: [/PerplexityBot\/[\d.]+/, /\bPerplexityBot\b/],
    ipRegistryUrl: "https://docs.perplexity.ai/docs/perplexitybot",
    category: "realtime",
    expectedPtrDomain: "perplexity.ai",
  },
  {
    id: "google-extended",
    name: "Google-Extended",
    uaPatterns: [/Google-Extended/],
    ipRegistryUrl:
      "https://developers.google.com/static/search/apis/ipranges/googlebot.json",
    category: "training",
    expectedPtrDomain: "google.com",
  },
  {
    id: "ccbot",
    name: "CCBot",
    uaPatterns: [/CCBot\/[\d.]+/, /\bCCBot\b/],
    ipRegistryUrl: "https://commoncrawl.org/faq/",
    category: "training",
    expectedPtrDomain: "commoncrawl.org",
  },
];
