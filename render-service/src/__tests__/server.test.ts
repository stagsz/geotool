import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRenderServer } from "../server";
import type { RenderCache } from "../cache";
import type { RenderQueue } from "../queue";

describe("createRenderServer", () => {
  let cache: { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> };
  let queue: { add: ReturnType<typeof vi.fn> };
  let server: ReturnType<typeof createRenderServer>;
  let port: number;

  beforeEach(async () => {
    cache = { get: vi.fn(), set: vi.fn() };
    queue = { add: vi.fn().mockResolvedValue(undefined) };
    server = createRenderServer(
      cache as unknown as RenderCache,
      queue as unknown as RenderQueue
    );
    port = await new Promise<number>((resolve) => {
      server.listen(0, () => {
        const addr = server.address() as { port: number };
        resolve(addr.port);
      });
    });
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("GET /health returns 200 with {status:ok}", async () => {
    const res = await fetch(`http://localhost:${port}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("GET /render without url returns 400", async () => {
    const res = await fetch(`http://localhost:${port}/render`);
    expect(res.status).toBe(400);
  });

  it("GET /render?url=... returns 200 with cached HTML on hit", async () => {
    cache.get.mockResolvedValue("<html>cached</html>");
    const res = await fetch(
      `http://localhost:${port}/render?url=https://example.com`
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("<html>cached</html>");
  });

  it("GET /render?url=... returns 202 and calls queue.add on cache miss", async () => {
    cache.get.mockResolvedValue(null);
    const res = await fetch(
      `http://localhost:${port}/render?url=https://example.com`
    );
    expect(res.status).toBe(202);
    expect(queue.add).toHaveBeenCalledWith("https://example.com");
  });
});
