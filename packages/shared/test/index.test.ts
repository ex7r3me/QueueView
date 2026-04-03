import { describe, expect, it } from "vitest";
import { DEFAULT_QUEUE_LIMIT, type QueueEntryState } from "../src/index";

describe("shared constants", () => {
  it("exposes default queue limit", () => {
    expect(DEFAULT_QUEUE_LIMIT).toBe(250);
  });

  it("exposes queue states", () => {
    const queueState: QueueEntryState = "waiting";

    expect(queueState).toBe("waiting");
  });
});
