import { ContentTree } from "./html-parser";

export type PageType =
  | "blog"
  | "product"
  | "service"
  | "about"
  | "faq"
  | "landing"
  | "unknown";

interface Signal {
  type: PageType;
  weight: number;
  test: (tree: ContentTree, url: string) => boolean;
}

const SIGNALS: Signal[] = [
  {
    type: "blog",
    weight: 3,
    test: (_, u) => /\/(blog|posts?|articles?|news)\//i.test(u),
  },
  {
    type: "blog",
    weight: 2,
    test: (t) => /published|byline|author|posted on/i.test(t.rawHtml),
  },
  { type: "blog", weight: 2, test: (t) => /<article/i.test(t.rawHtml) },

  {
    type: "product",
    weight: 3,
    test: (_, u) => /\/(product|item|shop|store)\//i.test(u),
  },
  {
    type: "product",
    weight: 3,
    test: (t) => /add to cart|buy now|sku/i.test(t.rawHtml),
  },
  {
    type: "product",
    weight: 2,
    test: (t) => /itemtype="[^"]*Product"/i.test(t.rawHtml),
  },

  {
    type: "service",
    weight: 3,
    test: (_, u) => /\/(service|solution|platform)\//i.test(u),
  },
  {
    type: "service",
    weight: 2,
    test: (t) => /get started|request a demo/i.test(t.rawHtml),
  },

  {
    type: "about",
    weight: 3,
    test: (_, u) => /\/(about|team|company|who-we-are)/i.test(u),
  },
  {
    type: "about",
    weight: 2,
    test: (t) => /our mission|our team|founded in/i.test(t.rawHtml),
  },

  {
    type: "faq",
    weight: 4,
    test: (_, u) => /\/(faq|help|support|questions)/i.test(u),
  },
  {
    type: "faq",
    weight: 3,
    test: (t) => /frequently asked|common questions/i.test(t.rawHtml),
  },

  {
    type: "landing",
    weight: 2,
    test: (t) => /sign.?up|get.?started|cta/i.test(t.rawHtml),
  },
];

export function classifyPage(tree: ContentTree, url: string): PageType {
  const scores: Record<PageType, number> = {
    blog: 0,
    product: 0,
    service: 0,
    about: 0,
    faq: 0,
    landing: 0,
    unknown: 0,
  };

  for (const signal of SIGNALS) {
    if (signal.test(tree, url)) {
      scores[signal.type] += signal.weight;
    }
  }

  const best = (
    Object.entries(scores) as Array<[PageType, number]>
  )
    .filter(([t]) => t !== "unknown")
    .sort(([, a], [, b]) => b - a)[0];

  return best && best[1] > 0 ? best[0] : "unknown";
}
