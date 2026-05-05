export interface ContentNode {
  type: "heading" | "paragraph" | "list" | "meta";
  level?: number;
  content: string;
}

export interface ContentTree {
  title: string;
  metaDescription: string;
  canonicalUrl: string;
  nodes: ContentNode[];
  rawHtml: string;
}

export function parseHtml(html: string): ContentTree {
  return {
    title: extractTitle(html),
    metaDescription: extractMetaContent(html, "description"),
    canonicalUrl: extractCanonical(html),
    nodes: extractNodes(html),
    rawHtml: html,
  };
}

function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? stripTags(m[1]).trim() : "";
}

function extractMetaContent(html: string, name: string): string {
  const patterns = [
    new RegExp(
      `<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`,
      "i"
    ),
  ];
  for (const pattern of patterns) {
    const m = html.match(pattern);
    if (m) return m[1];
  }
  return "";
}

function extractCanonical(html: string): string {
  const m = html.match(
    /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i
  );
  return m ? m[1] : "";
}

function extractNodes(html: string): ContentNode[] {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const body = bodyMatch ? bodyMatch[1] : html;
  const nodes: ContentNode[] = [];

  const headingRe = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = headingRe.exec(body)) !== null) {
    nodes.push({
      type: "heading",
      level: parseInt(m[1], 10),
      content: stripTags(m[2]).trim(),
    });
  }

  const paraRe = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  while ((m = paraRe.exec(body)) !== null) {
    const content = stripTags(m[1]).trim();
    if (content.length > 20) {
      nodes.push({ type: "paragraph", content });
    }
  }

  return nodes;
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
