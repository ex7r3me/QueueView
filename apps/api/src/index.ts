import cors from "@fastify/cors";
import Fastify from "fastify";
import { DemoQueueService } from "./domain/demo-queue-service.js";
import { demoQueueRoutes } from "./routes/demo-queues.js";
import { healthRoute } from "./routes/health.js";

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";
const corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:5173";

const app = Fastify({ logger: true });
const demoQueueService = DemoQueueService.initFromEnvironment();

await app.register(cors, {
  origin: corsOrigin
});

await app.register(healthRoute);
await app.register(demoQueueRoutes, { demoQueueService });

app.addHook("onClose", async () => {
  demoQueueService.stop();
});

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    await app.listen({ port, host });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

export { app };
