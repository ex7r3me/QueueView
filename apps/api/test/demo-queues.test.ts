import { afterAll, describe, expect, it } from "vitest";
import { app } from "../src/index.js";

describe("demo queue routes", () => {
  afterAll(async () => {
    await app.close();
  });

  it("returns demo queue snapshots", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/demo/queues"
    });

    expect(response.statusCode).toBe(200);

    const payload = response.json() as {
      enabled: boolean;
      queues: Array<{ name: string; stats: { totalCreated: number } }>;
    };

    expect(payload.enabled).toBe(true);
    expect(payload.queues).toHaveLength(5);
    expect(payload.queues.every((queue) => typeof queue.name === "string")).toBe(true);
    expect(payload.queues.every((queue) => queue.stats.totalCreated >= 0)).toBe(true);
  });

  it("returns queue details for an existing queue", async () => {
    const snapshot = await app.inject({
      method: "GET",
      url: "/demo/queues"
    });
    const snapshotPayload = snapshot.json() as { queues: Array<{ name: string }> };
    const queueName = snapshotPayload.queues[0]?.name;
    expect(queueName).toBeTruthy();

    const response = await app.inject({
      method: "GET",
      url: `/demo/queues/${queueName}`
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as {
      queue: { name: string };
      jobs: { latest: unknown[]; active: unknown[]; completed: unknown[]; failed: unknown[] };
    };
    expect(payload.queue.name).toBe(queueName);
    expect(Array.isArray(payload.jobs.latest)).toBe(true);
    expect(Array.isArray(payload.jobs.active)).toBe(true);
    expect(Array.isArray(payload.jobs.completed)).toBe(true);
    expect(Array.isArray(payload.jobs.failed)).toBe(true);
  });

  it("returns 404 when queue does not exist", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/demo/queues/not-a-real-queue"
    });

    expect(response.statusCode).toBe(404);
  });
});
