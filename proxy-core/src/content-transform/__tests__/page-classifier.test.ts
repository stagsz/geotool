import { describe, it, expect } from "vitest";
import { classifyPage } from "../page-classifier";
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
