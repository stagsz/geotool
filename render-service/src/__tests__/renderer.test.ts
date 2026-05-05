import { describe, it, expect, vi, beforeEach } from "vitest";
import { PageRenderer } from "../renderer";

const { mockPage, mockBrowser } = vi.hoisted(() => {
  const mockPage = {
    setDefaultTimeout: vi.fn(),
    goto: vi.fn().mockResolvedValue(undefined),
    content: vi.fn().mockResolvedValue("<html>rendered</html>"),
    close: vi.fn().mockResolvedValue(undefined),
  };
  const mockBrowser = {
    newPage: vi.fn().mockResolvedValue(mockPage),
    close: vi.fn().mockResolvedValue(undefined),
  };
  return { mockPage, mockBrowser };
});

vi.mock("puppeteer-core", () => ({
  default: {
    launch: vi.fn().mockResolvedValue(mockBrowser),
  },
}));

describe("PageRenderer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPage.goto.mockResolvedValue(undefined);
    mockPage.content.mockResolvedValue("<html>rendered</html>");
    mockPage.close.mockResolvedValue(undefined);
    mockBrowser.newPage.mockResolvedValue(mockPage);
  });

  it('throws "not initialized" before init()', async () => {
    const renderer = new PageRenderer();
    await expect(renderer.render("https://example.com")).rejects.toThrow(
      "not initialized"
    );
  });

  it("launches browser with headless:true and --no-sandbox after init()", async () => {
    const puppeteer = await import("puppeteer-core");
    const renderer = new PageRenderer();
    await renderer.init();
    expect(puppeteer.default.launch).toHaveBeenCalledWith(
      expect.objectContaining({
        headless: true,
        args: expect.arrayContaining(["--no-sandbox"]),
      })
    );
  });

  it("render() returns RenderResult with expected fields", async () => {
    const renderer = new PageRenderer();
    await renderer.init();
    const result = await renderer.render("https://example.com");
    expect(result).toMatchObject({
      html: "<html>rendered</html>",
      url: "https://example.com",
      renderedAt: expect.any(String),
      durationMs: expect.any(Number),
    });
  });

  it("render() calls goto with waitUntil:domcontentloaded", async () => {
    const renderer = new PageRenderer();
    await renderer.init();
    await renderer.render("https://example.com");
    expect(mockPage.goto).toHaveBeenCalledWith("https://example.com", {
      waitUntil: "domcontentloaded",
    });
  });

  it("render() calls setDefaultTimeout with 15000", async () => {
    const renderer = new PageRenderer();
    await renderer.init();
    await renderer.render("https://example.com");
    expect(mockPage.setDefaultTimeout).toHaveBeenCalledWith(15000);
  });

  it("render() closes the page in a finally block even on error", async () => {
    mockPage.content.mockRejectedValueOnce(new Error("render failed"));
    const renderer = new PageRenderer();
    await renderer.init();
    await expect(renderer.render("https://example.com")).rejects.toThrow(
      "render failed"
    );
    expect(mockPage.close).toHaveBeenCalled();
  });
});
