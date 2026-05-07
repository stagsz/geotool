import { BotDetectionEngine } from "./bot-detection";
import { ContentTransformEngine } from "./content-transform";
import { updateIpRegistries } from "./bot-detection/ip-updater";
import { fetchRendered } from "./render-client";
import { getClientConfig } from "./client-registry";

export interface Env {
  BOT_REGISTRY: KVNamespace;
  CLIENT_REGISTRY: KVNamespace;
  RENDER_CACHE: KVNamespace;
  RENDER_SERVICE_URL: string;
  UPSTREAM_URL: string;
  EVENTS_API_KEY?: string;
  PROXY_TOKEN?: string;
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
  fingerprint: string | null;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const hostname = new URL(request.url).hostname;

    if (hostname.endsWith(".workers.dev") && env.PROXY_TOKEN) {
      const token = request.headers.get("X-Proxy-Token");
      if (token !== env.PROXY_TOKEN) {
        return new Response("Unauthorized", { status: 401 });
      }
    }

    const clientConfig = await getClientConfig(hostname, env.CLIENT_REGISTRY);
    const upstreamUrl = clientConfig?.upstreamUrl ?? env.UPSTREAM_URL;
    const renderServiceUrl = clientConfig?.renderServiceUrl ?? env.RENDER_SERVICE_URL;
    const eventsApiKey = clientConfig?.eventsApiKey ?? env.EVENTS_API_KEY;

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
      const rendered = await fetchRendered(request.url, renderServiceUrl);
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
            fingerprint: detection.fingerprint,
          }, renderServiceUrl, eventsApiKey)
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
      const upstream = new URL(upstreamUrl);
      const upstreamReqUrl = new URL(request.url);
      upstreamReqUrl.hostname = upstream.hostname;
      upstreamReqUrl.protocol = upstream.protocol;
      upstreamReqUrl.port = upstream.port;
      const botHeaders = new Headers(request.headers);
      botHeaders.delete("accept-encoding");
      const originResponse = await fetch(
        new Request(upstreamReqUrl.toString(), { headers: botHeaders, method: request.method })
      );
      const transformed = await transformer.transform(originResponse, detection.botId, request.url);

      const event: BotEvent = {
        botId: detection.botId,
        botName: detection.botName,
        confidence: detection.confidence,
        url: request.url,
        pageType: transformed.headers.get("x-llm-proxy-page-type") ?? "unknown",
        transformationApplied: true,
        timestamp: detection.timestamp,
        ip: detection.ip,
        fingerprint: detection.fingerprint,
      };
      ctx.waitUntil(publishBotEvent(event, renderServiceUrl, eventsApiKey));

      return transformed;
    }

    const upstream = new URL(upstreamUrl);
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

export async function publishBotEvent(
  event: BotEvent,
  eventsUrl?: string,
  apiKey?: string
): Promise<void> {
  if (eventsUrl) {
    try {
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (apiKey) headers["authorization"] = `Bearer ${apiKey}`;
      await fetch(`${eventsUrl}/events`, {
        method: "POST",
        headers,
        body: JSON.stringify([event]),
        signal: AbortSignal.timeout(2000),
      });
    } catch {
      console.log("[BOT_EVENT_FALLBACK]", JSON.stringify(event));
    }
  } else {
    console.log("[BOT_EVENT]", JSON.stringify(event));
  }
}
