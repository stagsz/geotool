import { ContentTree, ContentNode } from "./html-parser";
import { PageType } from "./page-classifier";
import { QUESTION_RE } from "./qa-atomizer";

export function injectSchema(
  html: string,
  tree: ContentTree,
  pageType: PageType,
  url: string
): string {
  const schemas: object[] = [];

  if (pageType === "blog") {
    schemas.push(buildArticleSchema(tree, url));
  } else if (pageType === "product") {
    schemas.push(buildProductSchema(tree, url));
  } else if (pageType === "faq") {
    schemas.push(buildFaqSchema(tree));
  }

  schemas.push(buildOrganizationSchema(tree, url));

  const block = schemas
    .map(
      (s) =>
        `<script type="application/ld+json">\n${JSON.stringify(s, null, 2)}\n</script>`
    )
    .join("\n");

  if (html.includes("</head>")) {
    return html.replace("</head>", `${block}\n</head>`);
  }
  return block + "\n" + html;
}

function buildArticleSchema(tree: ContentTree, url: string): object {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: tree.title,
    description: tree.metaDescription,
    url,
    datePublished: new Date().toISOString().split("T")[0],
    publisher: {
      "@type": "Organization",
      name: extractDomain(url),
    },
  };
}

function buildProductSchema(tree: ContentTree, url: string): object {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: tree.title,
    description: tree.metaDescription,
    url,
  };
}

function buildFaqSchema(tree: ContentTree): object {
  const pairs = extractQaPairs(tree.nodes);
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: pairs.map(({ question, answer }) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  };
}

function buildOrganizationSchema(tree: ContentTree, url: string): object {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: extractBrandFromTitle(tree.title),
    description: tree.metaDescription,
    url,
  };
}

function extractQaPairs(
  nodes: ContentNode[]
): Array<{ question: string; answer: string }> {
  const pairs: Array<{ question: string; answer: string }> = [];

  for (let i = 0; i < nodes.length - 1; i++) {
    const cur = nodes[i];
    const next = nodes[i + 1];
    if (
      cur.type === "heading" &&
      QUESTION_RE.test(cur.content) &&
      next.type === "paragraph"
    ) {
      pairs.push({ question: cur.content, answer: next.content });
    }
  }
  return pairs;
}

function extractBrandFromTitle(title: string): string {
  const parts = title.split(/\s*[-|]\s*/);
  return parts.length > 1
    ? parts[parts.length - 1].trim()
    : title;
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
