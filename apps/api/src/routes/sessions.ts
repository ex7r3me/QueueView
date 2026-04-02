import type { QueueEntryState, SessionState } from "@queuview/shared";
import type { FastifyPluginAsync } from "fastify";
import { SessionService, SessionServiceError } from "../domain/session-service.js";

const SESSION_STATES: SessionState[] = ["open", "paused", "closed"];
const QUEUE_ENTRY_STATES: QueueEntryState[] = ["waiting", "called", "completed", "cancelled"];

interface SessionRoutesOptions {
  sessionService: SessionService;
}

export const sessionRoutes: FastifyPluginAsync<SessionRoutesOptions> = async (app, options) => {
  const { sessionService } = options;

  app.get("/sessions", async () => {
    return {
      sessions: sessionService.listSessions()
    };
  });

  app.get("/sessions/:sessionId", async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };

    try {
      return {
        session: sessionService.getSession(sessionId)
      };
    } catch (error) {
      return handleSessionError(error, reply);
    }
  });

  app.post("/sessions", async (request, reply) => {
    const body = request.body as { hostName?: unknown };

    try {
      const session = await sessionService.createSession({
        hostName: asString(body.hostName)
      });
      app.log.info({ sessionId: session.id, hostName: session.hostName }, "session.created");
      return reply.status(201).send({ session });
    } catch (error) {
      return handleSessionError(error, reply);
    }
  });

  app.patch("/sessions/:sessionId", async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const body = request.body as { state?: unknown };

    const nextState = asString(body.state) as SessionState;
    if (!SESSION_STATES.includes(nextState)) {
      return reply.status(400).send({ error: "state must be one of open, paused, closed" });
    }

    try {
      const session = await sessionService.updateSessionState(sessionId, nextState);
      app.log.info({ sessionId: session.id, state: session.state }, "session.state.updated");
      return { session };
    } catch (error) {
      return handleSessionError(error, reply);
    }
  });

  app.post("/sessions/:sessionId/queue", async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const body = request.body as { displayName?: unknown };

    try {
      const queueEntry = await sessionService.joinQueue(sessionId, {
        displayName: asString(body.displayName)
      });
      app.log.info(
        { sessionId, queueEntryId: queueEntry.id, queueState: queueEntry.state },
        "queue.entry.joined"
      );
      return reply.status(201).send({ queueEntry });
    } catch (error) {
      return handleSessionError(error, reply);
    }
  });

  app.patch("/sessions/:sessionId/queue/:queueEntryId", async (request, reply) => {
    const { sessionId, queueEntryId } = request.params as {
      sessionId: string;
      queueEntryId: string;
    };
    const body = request.body as { state?: unknown };

    const nextState = asString(body.state) as QueueEntryState;
    if (!QUEUE_ENTRY_STATES.includes(nextState)) {
      return reply
        .status(400)
        .send({ error: "state must be one of waiting, called, completed, cancelled" });
    }

    try {
      const queueEntry = await sessionService.updateQueueEntryState(sessionId, queueEntryId, nextState);
      app.log.info(
        { sessionId, queueEntryId: queueEntry.id, queueState: queueEntry.state },
        "queue.entry.state.updated"
      );
      return { queueEntry };
    } catch (error) {
      return handleSessionError(error, reply);
    }
  });
};

function asString(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  return "";
}

function handleSessionError(error: unknown, reply: { status: (code: number) => { send: (payload: object) => unknown } }) {
  if (error instanceof SessionServiceError) {
    return reply.status(error.statusCode).send({ error: error.message });
  }

  throw error;
}
