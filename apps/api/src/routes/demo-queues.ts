import type { FastifyPluginAsync } from "fastify";
import type {
  DemoQueueActionContext,
  DemoQueueActorRole,
  DemoQueueAlertThresholdPatch,
  DemoQueueEnvironmentScope,
  DemoQueueJobAction
} from "../domain/demo-queue-service.js";
import { DemoQueueService } from "../domain/demo-queue-service.js";

interface DemoQueueRoutesOptions {
  demoQueueService: DemoQueueService;
}

export const demoQueueRoutes: FastifyPluginAsync<DemoQueueRoutesOptions> = async (app, options) => {
  const { demoQueueService } = options;

  const toActionContext = (request: {
    headers: Record<string, unknown>;
    body?: unknown;
  }): DemoQueueActionContext => {
    const roleHeader = request.headers["x-queueview-role"];
    const actorRole: DemoQueueActorRole =
      roleHeader === "viewer" || roleHeader === "admin" || roleHeader === "operator" ? roleHeader : "operator";

    const scopeHeader = request.headers["x-queueview-env-scope"];
    const environmentScope: DemoQueueEnvironmentScope =
      scopeHeader === "demo" || scopeHeader === "staging" || scopeHeader === "production" ? scopeHeader : "demo";

    const actorIdHeader = request.headers["x-queueview-actor-id"];
    const actorId = typeof actorIdHeader === "string" && actorIdHeader.trim() ? actorIdHeader : "operator.local";

    const confirmationSatisfied =
      typeof request.body === "object" &&
      request.body !== null &&
      "confirmationSatisfied" in request.body &&
      (request.body as { confirmationSatisfied?: boolean }).confirmationSatisfied === true;

    return {
      actorId,
      actorRole,
      environmentScope,
      confirmationSatisfied
    };
  };

  app.get("/demo/queues", async () => {
    return demoQueueService.snapshot();
  });

  app.get("/demo/queues/ops", async () => {
    return demoQueueService.opsSnapshot();
  });

  app.get("/demo/queues/audit", async () => {
    return demoQueueService.auditSnapshot();
  });

  app.get("/demo/queues/patterns", async () => {
    return demoQueueService.patternSnapshot();
  });

  app.get("/demo/queues/incidents", async () => {
    return demoQueueService.incidentSnapshot();
  });

  app.get("/demo/queues/alerts", async () => {
    return demoQueueService.alertsSnapshot();
  });

  app.patch<{ Body: DemoQueueAlertThresholdPatch }>("/demo/queues/alerts/thresholds", async (request) => {
    return demoQueueService.updateAlertThresholds(request.body ?? {});
  });

  app.post<{
    Params: { queueName: string; jobId: string };
    Body: { action: DemoQueueJobAction; confirmationSatisfied?: boolean };
  }>(
    "/demo/queues/:queueName/jobs/:jobId/actions",
    async (request, reply) => {
      const { queueName, jobId } = request.params;
      const { action } = request.body;
      const actionContext = toActionContext(request);

      const result = demoQueueService.applyJobAction(queueName, jobId, action, actionContext);
      if (!result) {
        return reply.code(404).send({ error: "Queue or job not found" });
      }

      return result;
    }
  );

  app.get<{ Params: { queueName: string } }>("/demo/queues/:queueName", async (request, reply) => {
    const detail = demoQueueService.queueDetail(request.params.queueName, toActionContext(request));
    if (!detail) {
      return reply.code(404).send({ error: "Queue not found" });
    }

    return detail;
  });
};
