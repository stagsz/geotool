import { describe, it, expect } from "vitest";
import { parseUserAgent } from "../ua-parser";

describe("parseUserAgent", () => {
  it("detects GPTBot", () => {
    const result = parseUserAgent(
      "Mozilla/5.0 AppleWebKit/537.36 (compatible; GPTBot/1.0; +https://openai.com/gptbot)"
    );
    expect(result.matched).toBe(true);
    expect(result.botProfile?.id).toBe("gptbot");
    expect(result.botName).toBe("GPTBot");
  });

  it("detects ClaudeBot", () => {
    const result = parseUserAgent(
      "ClaudeBot/1.0; +https://anthropic.com/claude-bot"
    );
    expect(result.matched).toBe(true);
    expect(result.botProfile?.id).toBe("claudebot");
  });

  it("detects anthropic-ai UA variant", () => {
    const result = parseUserAgent(
      "Mozilla/5.0 (compatible; anthropic-ai/1.0)"
    );
    expect(result.matched).toBe(true);
    expect(result.botProfile?.id).toBe("claudebot");
  });

  it("detects PerplexityBot", () => {
    const result = parseUserAgent(
      "Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://docs.perplexity.ai/docs/perplexitybot)"
    );
    expect(result.matched).toBe(true);
    expect(result.botProfile?.id).toBe("perplexitybot");
  });

  it("detects Google-Extended", () => {
    const result = parseUserAgent("Mozilla/5.0 (compatible; Google-Extended)");
    expect(result.matched).toBe(true);
    expect(result.botProfile?.id).toBe("google-extended");
  });

  it("detects CCBot", () => {
    const result = parseUserAgent(
      "CCBot/2.0 (https://commoncrawl.org/faq/)"
    );
    expect(result.matched).toBe(true);
    expect(result.botProfile?.id).toBe("ccbot");
  });

  it("returns matched:false for a standard human Chrome UA", () => {
    const result = parseUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    expect(result.matched).toBe(false);
    expect(result.botProfile).toBeNull();
    expect(result.botName).toBeNull();
  });

  it("returns matched:false for standard Googlebot (not an LLM bot)", () => {
    const result = parseUserAgent(
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
    );
    expect(result.matched).toBe(false);
  });

  it("returns matched:false for empty UA", () => {
    const result = parseUserAgent("");
    expect(result.matched).toBe(false);
  });

  it("extracts version when present", () => {
    const result = parseUserAgent("GPTBot/1.2");
    expect(result.matched).toBe(true);
    expect(result.version).toBe("1.2");
  });
});
