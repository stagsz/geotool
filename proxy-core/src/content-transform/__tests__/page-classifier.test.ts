import { describe, it, expect } from "vitest";
import { classifyPage, parseServerTimingPageType } from "../page-classifier";
import { parseHtml } from "../html-parser";

const bare = (body = "") =>
  parseHtml(`<html><head><title>T</title></head><body>${body}</body></html>`);

describe("classifyPage", () => {
  it("classifies /blog/* URL as blog", () => {
    expect(classifyPage(bare(), "https://example.com/blog/my-post")).toBe(
      "blog"
    );
  });

  it("classifies /articles/* URL as blog", () => {
    expect(
      classifyPage(bare(), "https://example.com/articles/something")
    ).toBe("blog");
  });

  it("classifies product page by URL + 'Add to cart' text", () => {
    const tree = bare("<button>Add to cart</button>");
    expect(
      classifyPage(tree, "https://example.com/product/widget")
    ).toBe("product");
  });

  it("classifies /faq URL with 'Frequently Asked' heading as faq", () => {
    const tree = bare("<h1>Frequently Asked Questions</h1>");
    expect(classifyPage(tree, "https://example.com/faq")).toBe("faq");
  });

  it("classifies /about URL with mission text as about", () => {
    const tree = bare("<p>Our mission is to help businesses grow.</p>");
    expect(classifyPage(tree, "https://example.com/about")).toBe("about");
  });

  it("classifies /services/* URL as service", () => {
    expect(
      classifyPage(bare(), "https://example.com/service/consulting")
    ).toBe("service");
  });

  it("returns unknown for generic page with no signals", () => {
    expect(classifyPage(bare(), "https://example.com/random-page")).toBe(
      "unknown"
    );
  });
});

describe("parseServerTimingPageType", () => {
  it("maps Shopify index to landing", () => {
    expect(parseServerTimingPageType('pageType;desc="index"')).toBe("landing");
  });

  it("maps Shopify product to product", () => {
    expect(parseServerTimingPageType('pageType;desc="product"')).toBe("product");
  });

  it("maps Shopify collection to product", () => {
    expect(parseServerTimingPageType('pageType;desc="collection"')).toBe("product");
  });

  it("maps Shopify article to blog", () => {
    expect(parseServerTimingPageType('pageType;desc="article"')).toBe("blog");
  });

  it("maps Shopify blog to blog", () => {
    expect(parseServerTimingPageType('pageType;desc="blog"')).toBe("blog");
  });

  it("maps Shopify cart to unknown", () => {
    expect(parseServerTimingPageType('pageType;desc="cart"')).toBe("unknown");
  });

  it("parses pageType from a full server-timing header with multiple entries", () => {
    const header =
      'processing;dur=535;desc="gc:19", db;dur=199, render;dur=148, pageType;desc="index", servedBy;desc="td29"';
    expect(parseServerTimingPageType(header)).toBe("landing");
  });

  it("returns null for unrecognised pageType value", () => {
    expect(parseServerTimingPageType('pageType;desc="checkout"')).toBeNull();
  });

  it("returns null when pageType entry is absent", () => {
    expect(parseServerTimingPageType('render;dur=148, db;dur=199')).toBeNull();
  });

  it("returns null for null input", () => {
    expect(parseServerTimingPageType(null)).toBeNull();
  });
});
