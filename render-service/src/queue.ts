import { Queue, Worker, Job } from "bullmq";
import type { PageRenderer } from "./renderer";
import type { RenderCache } from "./cache";

const QUEUE_NAME = "render";

export class RenderQueue {
  private readonly queue: Queue;
  private readonly connection: { host: string; port: number };

  constructor(connection: { host: string; port: number }) {
    this.connection = connection;
    this.queue = new Queue(QUEUE_NAME, { connection });
  }

  async add(url: string): Promise<void> {
    await this.queue.add("render", { url }, { jobId: url });
  }

  startWorker(renderer: PageRenderer, cache: RenderCache): Worker {
    return new Worker(
      QUEUE_NAME,
      async (job: Job) => {
        const { url } = job.data as { url: string };
        const cached = await cache.get(url);
        if (cached !== null) return;
        const result = await renderer.render(url);
        await cache.set(url, result.html);
      },
      { connection: this.connection, concurrency: 4 }
    );
  }
}
