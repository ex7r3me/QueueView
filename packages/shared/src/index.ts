export const DEFAULT_QUEUE_LIMIT = 250;

export type SessionState = "open" | "paused" | "closed";

export type QueueEntryState = "waiting" | "called" | "completed" | "cancelled";

export interface SessionSummary {
  id: string;
  hostName: string;
  state: SessionState;
  queueSize: number;
}
