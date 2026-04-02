import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/index.js";

describe("session routes", () => {
  beforeEach(async () => {
    const sessionsResponse = await app.inject({
      method: "GET",
      url: "/sessions"
    });

    const sessions = sessionsResponse.json().sessions as Array<{ id: string; state: string }>;

    for (const session of sessions) {
      if (session.state !== "closed") {
        await app.inject({
          method: "PATCH",
          url: `/sessions/${session.id}`,
          payload: { state: "closed" }
        });
      }
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it("creates and lists sessions", async () => {
    const createResponse = await app.inject({
      method: "POST",
      url: "/sessions",
      payload: { hostName: "Host One" }
    });

    expect(createResponse.statusCode).toBe(201);
    const createdSession = createResponse.json().session as { id: string; hostName: string; state: string };
    expect(createdSession.hostName).toBe("Host One");
    expect(createdSession.state).toBe("open");

    const listResponse = await app.inject({
      method: "GET",
      url: "/sessions"
    });

    expect(listResponse.statusCode).toBe(200);
    const listBody = listResponse.json() as {
      sessions: Array<{ id: string; hostName: string; state: string; queueSize: number }>;
    };
    expect(listBody.sessions).toEqual([
      {
        id: createdSession.id,
        hostName: "Host One",
        state: "open",
        queueSize: 0
      }
    ]);
  });

  it("enforces session state transitions", async () => {
    const createResponse = await app.inject({
      method: "POST",
      url: "/sessions",
      payload: { hostName: "Host Two" }
    });
    const sessionId = createResponse.json().session.id as string;

    const closeResponse = await app.inject({
      method: "PATCH",
      url: `/sessions/${sessionId}`,
      payload: { state: "closed" }
    });

    expect(closeResponse.statusCode).toBe(200);
    expect(closeResponse.json().session.state).toBe("closed");

    const reopenResponse = await app.inject({
      method: "PATCH",
      url: `/sessions/${sessionId}`,
      payload: { state: "open" }
    });

    expect(reopenResponse.statusCode).toBe(409);
    expect(reopenResponse.json()).toEqual({
      error: "Invalid session state transition: closed -> open"
    });
  });

  it("manages queue entries and transition constraints", async () => {
    const createResponse = await app.inject({
      method: "POST",
      url: "/sessions",
      payload: { hostName: "Host Three" }
    });
    const sessionId = createResponse.json().session.id as string;

    const joinResponse = await app.inject({
      method: "POST",
      url: `/sessions/${sessionId}/queue`,
      payload: { displayName: "Participant A" }
    });

    expect(joinResponse.statusCode).toBe(201);
    const queueEntry = joinResponse.json().queueEntry as { id: string; state: string; displayName: string };
    expect(queueEntry.displayName).toBe("Participant A");
    expect(queueEntry.state).toBe("waiting");

    const callResponse = await app.inject({
      method: "PATCH",
      url: `/sessions/${sessionId}/queue/${queueEntry.id}`,
      payload: { state: "called" }
    });

    expect(callResponse.statusCode).toBe(200);
    expect(callResponse.json().queueEntry.state).toBe("called");

    const backToWaitingResponse = await app.inject({
      method: "PATCH",
      url: `/sessions/${sessionId}/queue/${queueEntry.id}`,
      payload: { state: "waiting" }
    });

    expect(backToWaitingResponse.statusCode).toBe(200);

    const callAgainResponse = await app.inject({
      method: "PATCH",
      url: `/sessions/${sessionId}/queue/${queueEntry.id}`,
      payload: { state: "called" }
    });

    expect(callAgainResponse.statusCode).toBe(200);

    const completeResponse = await app.inject({
      method: "PATCH",
      url: `/sessions/${sessionId}/queue/${queueEntry.id}`,
      payload: { state: "completed" }
    });

    expect(completeResponse.statusCode).toBe(200);

    const backToCalledResponse = await app.inject({
      method: "PATCH",
      url: `/sessions/${sessionId}/queue/${queueEntry.id}`,
      payload: { state: "called" }
    });

    expect(backToCalledResponse.statusCode).toBe(409);
    expect(backToCalledResponse.json()).toEqual({
      error: "Invalid queue state transition: completed -> called"
    });
  });

  it("rejects joining queue after session is paused", async () => {
    const createResponse = await app.inject({
      method: "POST",
      url: "/sessions",
      payload: { hostName: "Host Four" }
    });
    const sessionId = createResponse.json().session.id as string;

    const pauseResponse = await app.inject({
      method: "PATCH",
      url: `/sessions/${sessionId}`,
      payload: { state: "paused" }
    });

    expect(pauseResponse.statusCode).toBe(200);

    const joinResponse = await app.inject({
      method: "POST",
      url: `/sessions/${sessionId}/queue`,
      payload: { displayName: "Participant B" }
    });

    expect(joinResponse.statusCode).toBe(409);
    expect(joinResponse.json()).toEqual({
      error: "Queue can only be joined when session is open"
    });
  });
});
