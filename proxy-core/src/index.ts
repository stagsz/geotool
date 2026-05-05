import { BotDetectionEngine } from "./bot-detection";
import { ContentTransformEngine } from "./content-transform";
import { updateIpRegistries } from "./bot-detection/ip-updater";
import { fetchRendered } from "./render-client";

export interface Env {
  BOT_REGISTRY: KVNamespace;
  RENDER_CACHE: KVNamespace;
  RENDER_SERVICE_URL: string;
  UPSTREAM_URL: string;
}

export interface BotEvent {
  botId: string | null;
  botName: string | null;
  confidence: number;
  url: string;
  pageType: string;
  transformationApplied: boolean;
  timestamp: string;
  ip: string;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const botEngine = new BotDetectionEngine(env.BOT_REGISTRY);
    const detection = await botEngine.detect(request);

    if (detection.isHoneypot) {
      ctx.waitUntil(botEngine.logHoneypotHit(request, detection));
      return new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    if (detection.verified) {
      const rendered = await fetchRendered(request.url, env.RENDER_SERVICE_URL);
      if (rendered !== null) {
        ctx.waitUntil(
          publishBotEvent({
            botId: detection.botId,
            botName: detection.botName,
            confidence: detection.confidence,
            url: request.url,
            pageType: "unknown",
            transformationApplied: false,
            timestamp: detection.timestamp,
            ip: detection.ip,
          })
        );
        return new Response(rendered, {
          status: 200,
          headers: {
            "content-type": "text/html",
            "x-llm-proxy-cache": "HIT",
          },
        });
      }

      const transformer = new ContentTransformEngine();
      const upstream = new URL(env.UPSTREAM_URL);
      const upstreamUrl = new URL(request.url);
      upstreamUrl.hostname = upstream.hostname;
      upstreamUrl.protocol = upstream.protocol;
      upstreamUrl.port = upstream.port;
      const botHeaders = new Headers(request.headers);
      botHeaders.delete("accept-encoding");
      const originResponse = await fetch(new Request(upstreamUrl.toString(), { headers: botHeaders, method: request.method }));
      const transformed = await transformer.transform(
        originResponse,
        detection.botId
      );

      const event: BotEvent = {
        botId: detection.botId,
        botName: detection.botName,
        confidence: detection.confidence,
        url: request.url,
        pageType:
          transformed.headers.get("x-llm-proxy-page-type") ?? "unknown",
        transformationApplied: true,
        timestamp: detection.timestamp,
        ip: detection.ip,
      };
      ctx.waitUntil(publishBotEvent(event));

      return transformed;
    }

    const upstream = new URL(env.UPSTREAM_URL);
    const url = new URL(request.url);
    url.hostname = upstream.hostname;
    url.protocol = upstream.protocol;
    url.port = upstream.port;
    return fetch(new Request(url.toString(), request));
  },

  async scheduled(
    _event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    ctx.waitUntil(updateIpRegistries(env.BOT_REGISTRY));
  },
};

async function publishBotEvent(
  event: BotEvent,
  sink?: (e: BotEvent) => void
): Promise<void> {
  if (sink) {
    sink(event);
  } else {
    console.log("[BOT_EVENT]", JSON.stringify(event));
  }
}
