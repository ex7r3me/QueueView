import type { FastifyPluginAsync } from "fastify";
import { DemoQueueService } from "../domain/demo-queue-service.js";

interface DemoQueueRoutesOptions {
  demoQueueService: DemoQueueService;
}

export const demoQueueRoutes: FastifyPluginAsync<DemoQueueRoutesOptions> = async (app, options) => {
  const { demoQueueService } = options;

  app.get("/demo/queues", async () => {
    return demoQueueService.snapshot();
  });

  app.get<{ Params: { queueName: string } }>("/demo/queues/:queueName", async (request, reply) => {
    const detail = demoQueueService.queueDetail(request.params.queueName);
    if (!detail) {
      return reply.code(404).send({ error: "Queue not found" });
    }

    return detail;
  });
};
