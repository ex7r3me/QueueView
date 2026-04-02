import { describe, expect, it } from "vitest";
import { DEFAULT_QUEUE_LIMIT, type QueueEntryState, type SessionState } from "../src/index";

describe("shared constants", () => {
  it("exposes default queue limit", () => {
    expect(DEFAULT_QUEUE_LIMIT).toBe(250);
  });

  it("exposes session and queue states", () => {
    const sessionState: SessionState = "open";
    const queueState: QueueEntryState = "waiting";

    expect(sessionState).toBe("open");
    expect(queueState).toBe("waiting");
  });
});
