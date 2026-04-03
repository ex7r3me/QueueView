import { afterAll, describe, expect, it } from "vitest";
import { app } from "../src/index.js";

describe("api smoke flow", () => {
  afterAll(async () => {
    await app.close();
  });

  it("passes health -> demo queue snapshot", async () => {
    const health = await app.inject({
      method: "GET",
      url: "/health"
    });
    expect(health.statusCode).toBe(200);

    const demoQueues = await app.inject({
      method: "GET",
      url: "/demo/queues"
    });
    expect(demoQueues.statusCode).toBe(200);

    const payload = demoQueues.json() as {
      enabled: boolean;
      queues: Array<{ name: string }>;
    };
    expect(payload.enabled).toBe(true);
    expect(payload.queues.length).toBeGreaterThan(0);
    expect(payload.queues.every((queue) => typeof queue.name === "string")).toBe(true);
  });
});
