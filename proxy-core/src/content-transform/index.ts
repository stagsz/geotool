import { parseHtml } from "./html-parser";
import { classifyPage, parseServerTimingPageType, PageType } from "./page-classifier";
import { injectSchema } from "./schema-injector";
import { atomizeQa } from "./qa-atomizer";
import { extractEntities } from "./entity-extractor";

export interface TransformResult {
  html: string;
  pageType: string;
  entitiesExtracted: number;
  schemasInjected: number;
  originalSize: number;
  transformedSize: number;
}

export class ContentTransformEngine {
  async transform(response: Response, _botId: string | null): Promise<Response> {
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) return response;

    const html = await response.text();
    const pageTypeHint = parseServerTimingPageType(response.headers.get("server-timing"));
    const result = this.transformHtml(html, response.url, _botId, pageTypeHint);

    const headers = new Headers(response.headers);
    headers.delete("content-encoding");
    headers.delete("transfer-encoding");
    headers.delete("content-length");
    headers.set("content-type", "text/html; charset=utf-8");
    headers.set("x-llm-proxy-page-type", result.pageType);
    headers.set("x-llm-proxy-entities", String(result.entitiesExtracted));
    headers.set("x-llm-proxy-processed", "true");

    return new Response(result.html, { status: response.status, headers });
  }

  transformHtml(
    html: string,
    url: string,
    _botId: string | null,
    pageTypeHint?: PageType | null
  ): TransformResult {
    const tree = parseHtml(html);
    const pageType = pageTypeHint ?? classifyPage(tree, url);
    const entities = extractEntities(tree);

    let transformed = injectSchema(html, tree, pageType, url);
    transformed = atomizeQa(transformed);

    return {
      html: transformed,
      pageType,
      entitiesExtracted: entities.length,
      schemasInjected: 1,
      originalSize: html.length,
      transformedSize: transformed.length,
    };
  }
}
