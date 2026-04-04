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
    if (payload.jobs.latest.length > 0) {
      const latestJob = payload.jobs.latest[0] as {
        data?: unknown;
        config?: unknown;
        replies?: unknown;
      };
      expect(latestJob.data).toBeTypeOf("object");
      expect(latestJob.config).toBeTypeOf("object");
      expect(Array.isArray(latestJob.replies)).toBe(true);
    }
  });

  it("returns 404 when queue does not exist", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/demo/queues/not-a-real-queue"
    });

    expect(response.statusCode).toBe(404);
  });

  it("returns operations telemetry snapshot", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/demo/queues/ops"
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as {
      counters: { requeue: number; mark_failed: number; mark_completed: number };
      recentEvents: unknown[];
    };
    expect(payload.counters.requeue).toBeGreaterThanOrEqual(0);
    expect(payload.counters.mark_failed).toBeGreaterThanOrEqual(0);
    expect(payload.counters.mark_completed).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(payload.recentEvents)).toBe(true);
  });

  it("returns queue pattern signals with drill-down evidence", async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 350);
    });

    const response = await app.inject({
      method: "GET",
      url: "/demo/queues/patterns"
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as {
      enabled: boolean;
      queues: Array<{
        queueName: string;
        incidentScore: number;
        health: { status: string; confidence: number; reason: string };
        signals: Array<{
          queueName: string;
          kind: string;
          confidence: number;
          evidence: { waiting: number; failed: number; failedJobIds: string[] };
          drilldown: { queueDetailPath: string; suggestedTab: string };
        }>;
      }>;
      topSignals: Array<{ queueName: string; kind: string }>;
    };

    expect(payload.enabled).toBe(true);
    expect(payload.queues.length).toBeGreaterThan(0);
    expect(payload.queues.every((queue) => queue.incidentScore >= 0 && queue.incidentScore <= 100)).toBe(true);
    expect(payload.queues.every((queue) => queue.health.confidence >= 0 && queue.health.confidence <= 1)).toBe(true);
    expect(payload.queues.every((queue) => typeof queue.health.reason === "string")).toBe(true);
    for (const queue of payload.queues) {
      for (const signal of queue.signals) {
        expect(signal.queueName).toBe(queue.queueName);
        expect(signal.confidence).toBeGreaterThanOrEqual(0);
        expect(signal.confidence).toBeLessThanOrEqual(1);
        expect(signal.drilldown.queueDetailPath).toContain(encodeURIComponent(queue.queueName));
        expect(Array.isArray(signal.evidence.failedJobIds)).toBe(true);
      }
    }
    expect(Array.isArray(payload.topSignals)).toBe(true);
  });

  it("returns incident command snapshot with cross-queue correlation", async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 350);
    });

    const response = await app.inject({
      method: "GET",
      url: "/demo/queues/incidents"
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as {
      enabled: boolean;
      incidents: Array<{
        id: string;
        severity: string;
        status: string;
        incidentScore: number;
        signalKinds: string[];
        queues: Array<{
          queueName: string;
          incidentScore: number;
          primarySignal: { drilldown: { queueDetailPath: string; suggestedTab: string } };
        }>;
      }>;
    };

    expect(payload.enabled).toBe(true);
    expect(Array.isArray(payload.incidents)).toBe(true);
    for (const incident of payload.incidents) {
      expect(incident.id.length).toBeGreaterThan(0);
      expect(incident.incidentScore).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(incident.signalKinds)).toBe(true);
      expect(incident.queues.length).toBeGreaterThan(0);
      for (const queue of incident.queues) {
        expect(queue.incidentScore).toBeGreaterThanOrEqual(0);
        expect(queue.primarySignal.drilldown.queueDetailPath).toContain(encodeURIComponent(queue.queueName));
      }
    }
  });

  it("returns alert center snapshot with thresholds and notifications", async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 550);
    });

    const response = await app.inject({
      method: "GET",
      url: "/demo/queues/alerts"
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as {
      thresholds: { failureClusterWarn: number; lagBacklogCritical: number };
      active: Array<{ queueName: string; severity: string; status: string }>;
      notifications: Array<{ queueName: string; event: string; message: string }>;
    };
    expect(payload.thresholds.failureClusterWarn).toBeGreaterThan(0);
    expect(payload.thresholds.lagBacklogCritical).toBeGreaterThan(0);
    expect(Array.isArray(payload.active)).toBe(true);
    expect(Array.isArray(payload.notifications)).toBe(true);
  });

  it("updates alert thresholds", async () => {
    const response = await app.inject({
      method: "PATCH",
      url: "/demo/queues/alerts/thresholds",
      payload: {
        failureClusterWarn: 2,
        failureClusterCritical: 6,
        minNotificationIntervalMs: 15_000
      }
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as {
      thresholds: {
        failureClusterWarn: number;
        failureClusterCritical: number;
        minNotificationIntervalMs: number;
      };
    };
    expect(payload.thresholds.failureClusterWarn).toBe(2);
    expect(payload.thresholds.failureClusterCritical).toBe(6);
    expect(payload.thresholds.minNotificationIntervalMs).toBe(15_000);
  });

  it("applies manual queue actions", async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 350);
    });

    const snapshotResponse = await app.inject({
      method: "GET",
      url: "/demo/queues"
    });
    const snapshotPayload = snapshotResponse.json() as { queues: Array<{ name: string }> };
    const queueName = snapshotPayload.queues[0]?.name;
    expect(queueName).toBeTruthy();

    const detailResponse = await app.inject({
      method: "GET",
      url: `/demo/queues/${queueName}`
    });
    const detailPayload = detailResponse.json() as {
      jobs: {
        active: Array<{ id: string }>;
        waiting: Array<{ id: string }>;
        retryScheduled: Array<{ id: string }>;
        latest: Array<{ id: string }>;
      };
    };
    const jobId =
      detailPayload.jobs.active[0]?.id ??
      detailPayload.jobs.waiting[0]?.id ??
      detailPayload.jobs.retryScheduled[0]?.id ??
      detailPayload.jobs.latest[0]?.id;
    expect(jobId).toBeTruthy();

    const actionResponse = await app.inject({
      method: "POST",
      url: `/demo/queues/${queueName}/jobs/${jobId}/actions`,
      headers: {
        "x-queueview-role": "admin",
        "x-queueview-env-scope": "demo",
        "x-queueview-actor-id": "test.admin"
      },
      payload: {
        action: "mark_completed",
        confirmationSatisfied: true
      }
    });

    expect(actionResponse.statusCode).toBe(200);
    const actionPayload = actionResponse.json() as {
      accepted: boolean;
      action: string;
      job: { id: string; state: string };
    };
    expect(actionPayload.accepted).toBe(true);
    expect(actionPayload.action).toBe("mark_completed");
    expect(actionPayload.job.id).toBe(jobId);
    expect(actionPayload.job.state).toBe("completed");
  });

  it("rejects sensitive actions without confirmation", async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 350);
    });

    const snapshotResponse = await app.inject({
      method: "GET",
      url: "/demo/queues"
    });
    const snapshotPayload = snapshotResponse.json() as { queues: Array<{ name: string }> };
    const queueName = snapshotPayload.queues[0]?.name;
    expect(queueName).toBeTruthy();

    const detailResponse = await app.inject({
      method: "GET",
      url: `/demo/queues/${queueName}`
    });
    const detailPayload = detailResponse.json() as {
      jobs: { latest: Array<{ id: string }> };
    };
    const jobId = detailPayload.jobs.latest[0]?.id;
    expect(jobId).toBeTruthy();

    const actionResponse = await app.inject({
      method: "POST",
      url: `/demo/queues/${queueName}/jobs/${jobId}/actions`,
      headers: {
        "x-queueview-role": "operator",
        "x-queueview-env-scope": "demo",
        "x-queueview-actor-id": "test.operator"
      },
      payload: {
        action: "mark_completed",
        confirmationSatisfied: false
      }
    });

    expect(actionResponse.statusCode).toBe(200);
    const actionPayload = actionResponse.json() as {
      accepted: boolean;
      reason: string;
    };
    expect(actionPayload.accepted).toBe(false);
    expect(actionPayload.reason).toContain("Confirmation required");
  });

  it("returns audit trail snapshot", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/demo/queues/audit"
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as {
      totalEvents: number;
      recentEvents: unknown[];
    };
    expect(payload.totalEvents).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(payload.recentEvents)).toBe(true);
  });
});
