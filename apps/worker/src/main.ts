/**
 * PixEcom Worker — Milestone 2.3.7 (WS2)
 *
 * Structured JSON logging for all worker events.
 * Log shape: { ts, level, queue, jobId, sellerId?, durationMs?, msg }
 *
 * No secrets logged (no tokens, no URLs, no payloads).
 */
import { Worker } from "bullmq";
import IORedis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const QUEUE_NAME = "stats-sync";

// ── Structured logger ────────────────────────────────────────────────────────

function log(
  level: "info" | "warn" | "error",
  msg: string,
  extra?: Record<string, unknown>,
): void {
  const record = {
    ts: new Date().toISOString(),
    level,
    queue: QUEUE_NAME,
    msg,
    ...(extra ?? {}),
  };
  // Always newline-delimited JSON — suitable for Railway / Datadog / Loki
  process.stdout.write(JSON.stringify(record) + "\n");
}

// ── Bootstrap ────────────────────────────────────────────────────────────────

async function bootstrap() {
  const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const startedAt = Date.now();
      const jobId    = job.id ?? "unknown";
      // sellerId is expected in job.data — never log tokens or URLs
      const sellerId = (job.data as Record<string, unknown>)?.sellerId as string | undefined;

      log("info", "Job started", { jobId, sellerId });

      // Stats sync processor — to be implemented in feature phase
      // (Phase 1 stub: no-op)

      const durationMs = Date.now() - startedAt;
      log("info", "Job completed", { jobId, sellerId, durationMs });
    },
    {
      connection: connection as any,
      concurrency: 5,
    },
  );

  worker.on("completed", (job) => {
    log("info", "Job marked completed", { jobId: job.id });
  });

  worker.on("failed", (job, err) => {
    log("error", "Job failed", {
      jobId: job?.id ?? "unknown",
      errorMsg: err.message,
    });
  });

  worker.on("error", (err) => {
    log("error", "Worker error", { errorMsg: err.message });
  });

  log("info", "Worker started", { redisConnected: true });
}

bootstrap().catch((err) => {
  process.stdout.write(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: "error",
      queue: QUEUE_NAME,
      msg: "Worker failed to start",
      errorMsg: (err as Error).message,
    }) + "\n",
  );
  process.exit(1);
});
