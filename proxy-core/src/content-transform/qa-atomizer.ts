export const QUESTION_RE =
  /^(what|how|why|when|where|who|which|can|does|is|are|do)\b/i;

export function atomizeQa(html: string): string {
  return html.replace(
    /<(h[2-3])([^>]*)>([\s\S]*?)<\/\1>\s*<p([^>]*)>([\s\S]*?)<\/p>/gi,
    (match, tag, tagAttrs, heading, paraAttrs, answer) => {
      const plainHeading = heading.replace(/<[^>]+>/g, "").trim();
      if (!QUESTION_RE.test(plainHeading)) return match;

      return `<div itemscope itemtype="https://schema.org/Question">
  <${tag}${tagAttrs} itemprop="name">${heading}</${tag}>
  <div itemscope itemtype="https://schema.org/Answer" itemprop="acceptedAnswer">
    <p${paraAttrs} itemprop="text">${answer}</p>
  </div>
</div>`;
    }
  );
}
