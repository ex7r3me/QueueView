import { afterAll, describe, expect, it } from "vitest";
import { app } from "../src/index.js";

describe("api smoke flow", () => {
  afterAll(async () => {
    await app.close();
  });

  it("passes health -> create session -> join queue -> call participant", async () => {
    const health = await app.inject({
      method: "GET",
      url: "/health"
    });
    expect(health.statusCode).toBe(200);

    const createSession = await app.inject({
      method: "POST",
      url: "/sessions",
      payload: { hostName: "Launch Host" }
    });
    expect(createSession.statusCode).toBe(201);

    const sessionId = createSession.json().session.id as string;
    expect(sessionId).toBeTruthy();

    const joinQueue = await app.inject({
      method: "POST",
      url: `/sessions/${sessionId}/queue`,
      payload: { displayName: "Smoke Participant" }
    });
    expect(joinQueue.statusCode).toBe(201);

    const queueEntryId = joinQueue.json().queueEntry.id as string;
    expect(queueEntryId).toBeTruthy();

    const callParticipant = await app.inject({
      method: "PATCH",
      url: `/sessions/${sessionId}/queue/${queueEntryId}`,
      payload: { state: "called" }
    });
    expect(callParticipant.statusCode).toBe(200);
    expect(callParticipant.json().queueEntry.state).toBe("called");
  });
});
