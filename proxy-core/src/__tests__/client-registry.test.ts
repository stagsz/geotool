import { describe, it, expect, vi } from "vitest";
import { getClientConfig } from "../client-registry";

const makeKv = (data: Record<string, unknown>) => ({
  get: vi.fn().mockImplementation((key: string) =>
    Promise.resolve(data[key] ?? null)
  ),
  put: vi.fn().mockResolvedValue(undefined),
});

describe("getClientConfig", () => {
  it("returns config for a known hostname", async () => {
    const kv = makeKv({
      "client-config:example.com": { upstreamUrl: "https://origin.example.com" },
    });
    const config = await getClientConfig("example.com", kv);
    expect(config).toEqual({ upstreamUrl: "https://origin.example.com" });
  });

  it("returns null for an unknown hostname", async () => {
    const kv = makeKv({});
    expect(await getClientConfig("unknown.com", kv)).toBeNull();
  });

  it("includes renderServiceUrl when present", async () => {
    const kv = makeKv({
      "client-config:client.com": {
        upstreamUrl: "https://origin.client.com",
        renderServiceUrl: "https://render.client.com",
      },
    });
    const config = await getClientConfig("client.com", kv);
    expect(config?.renderServiceUrl).toBe("https://render.client.com");
  });

  it("looks up key with client-config: prefix", async () => {
    const kv = makeKv({});
    await getClientConfig("example.com", kv);
    expect(kv.get).toHaveBeenCalledWith("client-config:example.com", "json");
  });

  it("includes eventsApiKey when present", async () => {
    const kv = makeKv({
      "client-config:secure.com": {
        upstreamUrl: "https://origin.secure.com",
        eventsApiKey: "per-client-secret",
      },
    });
    const config = await getClientConfig("secure.com", kv);
    expect(config?.eventsApiKey).toBe("per-client-secret");
  });
});
