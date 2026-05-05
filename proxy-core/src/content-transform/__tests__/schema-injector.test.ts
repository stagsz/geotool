import { describe, it, expect } from "vitest";
import { injectSchema } from "../schema-injector";
import { parseHtml } from "../html-parser";

const baseHtml = (body = "") =>
  `<html><head><title>Product Name - Acme Corp</title></head><body>${body}</body></html>`;

describe("injectSchema", () => {
  it("injects Article schema for blog pages before </head>", () => {
    const html = baseHtml("<p>Blog content here for article.</p>");
    const tree = parseHtml(html);
    const result = injectSchema(html, tree, "blog", "https://example.com/blog/post");

    expect(result).toContain('<script type="application/ld+json">');
    expect(result).toContain('"@type": "Article"');
    const headIdx = result.indexOf("</head>");
    const scriptIdx = result.indexOf('<script type="application/ld+json">');
    expect(scriptIdx).toBeLessThan(headIdx);
  });

  it("injects Product schema for product pages", () => {
    const html = baseHtml("<button>Add to cart</button>");
    const tree = parseHtml(html);
    const result = injectSchema(html, tree, "product", "https://example.com/product/widget");

    expect(result).toContain('"@type": "Product"');
  });

  it("injects FAQPage schema with mainEntity for faq pages", () => {
    const html = baseHtml(
      "<h2>How does it work?</h2><p>It works by processing requests automatically.</p>"
    );
    const tree = parseHtml(html);
    const result = injectSchema(html, tree, "faq", "https://example.com/faq");

    expect(result).toContain('"@type": "FAQPage"');
    expect(result).toContain('"mainEntity"');
  });

  it("always injects Organization schema regardless of page type", () => {
    const html = baseHtml();
    const tree = parseHtml(html);

    for (const type of ["blog", "product", "service", "about", "faq", "landing", "unknown"] as const) {
      const result = injectSchema(html, tree, type, "https://example.com/");
      expect(result, `Expected Organization schema for type: ${type}`).toContain('"@type": "Organization"');
    }
  });

  it("inserts schema before </head>", () => {
    const html = baseHtml();
    const tree = parseHtml(html);
    const result = injectSchema(html, tree, "blog", "https://example.com/blog/x");

    expect(result.indexOf('<script type="application/ld+json">')).toBeLessThan(
      result.indexOf("</head>")
    );
  });

  it("includes the page URL in Article schema", () => {
    const url = "https://example.com/blog/my-post";
    const html = baseHtml();
    const tree = parseHtml(html);
    const result = injectSchema(html, tree, "blog", url);

    expect(result).toContain(`"url": "${url}"`);
  });
});
