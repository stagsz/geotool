import { describe, it, expect } from "vitest";
import { ContentTransformEngine, rewriteOriginUrls } from "../index";

const engine = new ContentTransformEngine();

describe("ContentTransformEngine.transformHtml", () => {
  it("returns a TransformResult with pageType field", () => {
    const html = "<html><head><title>Post Title</title></head><body><p>Blog content long enough.</p></body></html>";
    const result = engine.transformHtml(html, "https://example.com/blog/post", null);

    expect(result.pageType).toBe("blog");
    expect(typeof result.entitiesExtracted).toBe("number");
    expect(typeof result.html).toBe("string");
    expect(result.originalSize).toBe(html.length);
    expect(result.transformedSize).toBeGreaterThan(0);
  });

  it("schema is present in transformed output", () => {
    const html = "<html><head><title>My Post - Brand</title></head><body><p>Content here.</p></body></html>";
    const result = engine.transformHtml(html, "https://example.com/blog/post", null);

    expect(result.html).toContain("application/ld+json");
  });

  it("transformed HTML is larger than original (schema was added)", () => {
    const html = "<html><head><title>T</title></head><body><p>Content long enough for test.</p></body></html>";
    const result = engine.transformHtml(html, "https://example.com/blog/x", null);

    expect(result.transformedSize).toBeGreaterThan(result.originalSize);
  });

  it("Q&A markup is added for question headings", () => {
    const html = `<html><head><title>FAQ</title></head><body>
      <h2>How does this work?</h2><p>It works by processing your content automatically.</p>
    </body></html>`;
    const result = engine.transformHtml(html, "https://example.com/faq", null);

    expect(result.html).toContain("schema.org/Question");
  });

  it("returns 'unknown' page type for unclassifiable URL and content", () => {
    const html = "<html><head><title>T</title></head><body><p>Generic unclassifiable content here.</p></body></html>";
    const result = engine.transformHtml(html, "https://example.com/xyz-random", null);

    expect(result.pageType).toBe("unknown");
  });

  it("pageTypeHint overrides classifier result", () => {
    const html = "<html><head><title>Store</title></head><body><button>Add to cart</button></body></html>";
    const withoutHint = engine.transformHtml(html, "https://example.com/product/x", null);
    expect(withoutHint.pageType).toBe("product");

    const withHint = engine.transformHtml(html, "https://example.com/product/x", null, "landing");
    expect(withHint.pageType).toBe("landing");
  });
});

describe("rewriteOriginUrls", () => {
  it("rewrites canonical href", () => {
    const html = `<link rel="canonical" href="https://example.com/products/shirt">`;
    expect(rewriteOriginUrls(html, "https://example.com", "https://proxy.example.com")).toBe(
      `<link rel="canonical" href="https://proxy.example.com/products/shirt">`
    );
  });

  it("rewrites og:url content", () => {
    const html = `<meta property="og:url" content="https://example.com/products/shirt">`;
    expect(rewriteOriginUrls(html, "https://example.com", "https://proxy.example.com")).toBe(
      `<meta property="og:url" content="https://proxy.example.com/products/shirt">`
    );
  });

  it("leaves other URLs untouched", () => {
    const html = `<a href="https://example.com/page">link</a>`;
    expect(rewriteOriginUrls(html, "https://example.com", "https://proxy.example.com")).toBe(html);
  });

  it("is a no-op when origin and request base match", () => {
    const html = `<link rel="canonical" href="https://example.com/products/shirt">`;
    expect(rewriteOriginUrls(html, "https://example.com", "https://example.com")).toBe(html);
  });
});

describe("ContentTransformEngine.transform (Response API)", () => {
  it("passes through non-HTML responses unchanged", async () => {
    const jsonResponse = new Response('{"key":"value"}', {
      headers: { "content-type": "application/json" },
    });
    const result = await engine.transform(jsonResponse, null);

    expect(result.headers.get("x-llm-proxy-processed")).toBeNull();
  });

  it("sets x-llm-proxy-processed header for HTML responses", async () => {
    const html = "<html><head><title>Page</title></head><body><p>Content long enough here.</p></body></html>";
    const htmlResponse = new Response(html, {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
    const result = await engine.transform(htmlResponse, "gptbot");

    expect(result.headers.get("x-llm-proxy-processed")).toBe("true");
    expect(result.headers.get("x-llm-proxy-page-type")).toBeDefined();
  });

  it("uses server-timing pageType hint over classifier", async () => {
    const html = "<html><head><title>Store</title></head><body><button>Add to cart</button></body></html>";
    const response = new Response(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "server-timing": 'render;dur=148, pageType;desc="index", servedBy;desc="td29"',
      },
    });
    const result = await engine.transform(response, "gptbot");

    expect(result.headers.get("x-llm-proxy-page-type")).toBe("landing");
  });
});
