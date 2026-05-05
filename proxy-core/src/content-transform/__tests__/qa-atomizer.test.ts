import { describe, it, expect } from "vitest";
import { atomizeQa } from "../qa-atomizer";

describe("atomizeQa", () => {
  it("wraps 'How' heading + paragraph with schema.org Question/Answer", () => {
    const html = "<h2>How does this work?</h2><p>It works by doing X, Y, Z.</p>";
    const result = atomizeQa(html);
    expect(result).toContain('itemtype="https://schema.org/Question"');
    expect(result).toContain('itemtype="https://schema.org/Answer"');
    expect(result).toContain("How does this work?");
    expect(result).toContain("It works by doing X, Y, Z.");
  });

  it("does not wrap non-question headings", () => {
    const html = "<h2>Getting Started</h2><p>Here is how you get started.</p>";
    const result = atomizeQa(html);
    expect(result).not.toContain("schema.org/Question");
    expect(result).toBe(html);
  });

  it("wraps h3 question headings as well", () => {
    const html = "<h3>Why should I use this?</h3><p>Because it saves time.</p>";
    const result = atomizeQa(html);
    expect(result).toContain("schema.org/Question");
  });

  it("does NOT wrap h1 headings (only h2 and h3)", () => {
    const html = "<h1>What is this product?</h1><p>It is an AI proxy.</p>";
    const result = atomizeQa(html);
    expect(result).not.toContain("schema.org/Question");
  });

  it("wraps all 12 question starter words", () => {
    const starters = [
      "What",
      "How",
      "Why",
      "When",
      "Where",
      "Who",
      "Which",
      "Can",
      "Does",
      "Is",
      "Are",
      "Do",
    ];
    for (const starter of starters) {
      const html = `<h2>${starter} is this thing?</h2><p>Answer goes here and is long enough.</p>`;
      const result = atomizeQa(html);
      expect(result, `Expected "${starter}" to trigger wrapping`).toContain(
        "schema.org/Question"
      );
    }
  });

  it("is case-insensitive for question starters", () => {
    const html = "<h2>how does it work?</h2><p>It works like this exactly.</p>";
    const result = atomizeQa(html);
    expect(result).toContain("schema.org/Question");
  });

  it("leaves non-adjacent heading+paragraph pairs unchanged", () => {
    const html = "<h2>How does it work?</h2><div>divider</div><p>Answer paragraph.</p>";
    const result = atomizeQa(html);
    expect(result).not.toContain("schema.org/Question");
  });
});
