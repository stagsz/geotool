import puppeteer from "puppeteer-core";
import type { Browser } from "puppeteer-core";

export interface RenderResult {
  html: string;
  url: string;
  renderedAt: string;
  durationMs: number;
}

export class PageRenderer {
  private browser: Browser | null = null;

  async init(): Promise<void> {
    const executablePath = process.env.CHROME_PATH;
    this.browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      ...(executablePath ? { executablePath } : { channel: "chrome" }),
    });
  }

  async render(url: string): Promise<RenderResult> {
    if (!this.browser) {
      throw new Error("not initialized");
    }
    const page = await this.browser.newPage();
    const start = Date.now();
    try {
      page.setDefaultTimeout(15000);
      await page.goto(url, { waitUntil: "domcontentloaded" });
      const html = await page.content();
      return {
        html,
        url,
        renderedAt: new Date().toISOString(),
        durationMs: Date.now() - start,
      };
    } finally {
      await page.close();
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
