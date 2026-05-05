import { describe, it, expect } from "vitest";
import { parseHtml } from "../html-parser";

describe("parseHtml", () => {
  it("extracts title from <title> tag", () => {
    const tree = parseHtml(
      "<html><head><title>My Page Title</title></head><body></body></html>"
    );
    expect(tree.title).toBe("My Page Title");
  });

  it("returns empty string when no title", () => {
    const tree = parseHtml("<html><head></head><body></body></html>");
    expect(tree.title).toBe("");
  });

  it("extracts meta description", () => {
    const tree = parseHtml(
      `<html><head><meta name="description" content="A great page."></head><body></body></html>`
    );
    expect(tree.metaDescription).toBe("A great page.");
  });

  it("extracts meta description with reversed attribute order", () => {
    const tree = parseHtml(
      `<html><head><meta content="Reversed order." name="description"></head><body></body></html>`
    );
    expect(tree.metaDescription).toBe("Reversed order.");
  });

  it("extracts headings with correct levels", () => {
    const tree = parseHtml(
      "<html><body><h1>Main</h1><h2>Section</h2><h3>Sub</h3></body></html>"
    );
    const headings = tree.nodes.filter((n) => n.type === "heading");
    expect(headings).toHaveLength(3);
    expect(headings[0]).toMatchObject({ content: "Main", level: 1 });
    expect(headings[1]).toMatchObject({ content: "Section", level: 2 });
    expect(headings[2]).toMatchObject({ content: "Sub", level: 3 });
  });

  it("extracts only paragraphs longer than 20 characters", () => {
    const tree = parseHtml(
      "<html><body><p>Short</p><p>This paragraph is definitely longer than twenty characters.</p></body></html>"
    );
    const paras = tree.nodes.filter((n) => n.type === "paragraph");
    expect(paras).toHaveLength(1);
    expect(paras[0].content).toContain("definitely longer");
  });

  it("strips HTML tags from heading content", () => {
    const tree = parseHtml(
      "<html><body><h2><strong>Bold Heading</strong></h2></body></html>"
    );
    const h = tree.nodes.find((n) => n.type === "heading");
    expect(h?.content).toBe("Bold Heading");
  });

  it("populates rawHtml", () => {
    const html = "<html><body><p>Hello world, this is raw HTML content.</p></body></html>";
    const tree = parseHtml(html);
    expect(tree.rawHtml).toBe(html);
  });
});
