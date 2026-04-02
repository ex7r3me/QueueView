import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { DEFAULT_QUEUE_LIMIT, type QueueEntryState, type SessionState } from "@queuview/shared";

interface SessionParticipant {
  id: string;
  displayName: string;
  joinedAt: string;
}

interface QueueEntry extends SessionParticipant {
  state: QueueEntryState;
  updatedAt: string;
}

export interface Session {
  id: string;
  hostName: string;
  state: SessionState;
  createdAt: string;
  updatedAt: string;
  queue: QueueEntry[];
}

interface PersistedStore {
  sessions: Session[];
}

export interface SessionSummary {
  id: string;
  hostName: string;
  state: SessionState;
  queueSize: number;
}

export interface CreateSessionInput {
  hostName: string;
}

export interface JoinQueueInput {
  displayName: string;
}

export class SessionServiceError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "SessionServiceError";
    this.statusCode = statusCode;
  }
}

export class SessionService {
  #sessions = new Map<string, Session>();
  #queueLimit: number;
  #storeFilePath: string | undefined;

  private constructor(queueLimit: number, storeFilePath: string | undefined) {
    this.#queueLimit = queueLimit;
    this.#storeFilePath = storeFilePath;
  }

  static async init(): Promise<SessionService> {
    const queueLimit = Number(process.env.QUEUE_MAX_PARTICIPANTS ?? DEFAULT_QUEUE_LIMIT);
    const storeFilePath = process.env.SESSION_STORE_FILE?.trim() || undefined;
    const service = new SessionService(queueLimit, storeFilePath);
    await service.#load();
    return service;
  }

  listSessions(): SessionSummary[] {
    return [...this.#sessions.values()]
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .map((session) => ({
        id: session.id,
        hostName: session.hostName,
        state: session.state,
        queueSize: session.queue.filter((entry) => entry.state !== "cancelled").length
      }));
  }

  getSession(sessionId: string): Session {
    return this.#getSessionOrThrow(sessionId);
  }

  async createSession(input: CreateSessionInput): Promise<Session> {
    const hostName = input.hostName?.trim();

    if (!hostName) {
      throw new SessionServiceError("hostName is required", 400);
    }

    const timestamp = new Date().toISOString();
    const session: Session = {
      id: randomUUID(),
      hostName,
      state: "open",
      createdAt: timestamp,
      updatedAt: timestamp,
      queue: []
    };

    this.#sessions.set(session.id, session);
    await this.#persist();
    return session;
  }

  async updateSessionState(sessionId: string, nextState: SessionState): Promise<Session> {
    const session = this.#getSessionOrThrow(sessionId);

    if (session.state === nextState) {
      return session;
    }

    if (!isValidSessionTransition(session.state, nextState)) {
      throw new SessionServiceError(
        `Invalid session state transition: ${session.state} -> ${nextState}`,
        409
      );
    }

    session.state = nextState;
    session.updatedAt = new Date().toISOString();
    await this.#persist();
    return session;
  }

  async joinQueue(sessionId: string, input: JoinQueueInput): Promise<QueueEntry> {
    const session = this.#getSessionOrThrow(sessionId);

    if (session.state !== "open") {
      throw new SessionServiceError("Queue can only be joined when session is open", 409);
    }

    const displayName = input.displayName?.trim();

    if (!displayName) {
      throw new SessionServiceError("displayName is required", 400);
    }

    const activeQueueEntries = session.queue.filter((entry) => entry.state !== "cancelled").length;
    if (activeQueueEntries >= this.#queueLimit) {
      throw new SessionServiceError("Queue limit reached", 409);
    }

    const timestamp = new Date().toISOString();
    const queueEntry: QueueEntry = {
      id: randomUUID(),
      displayName,
      joinedAt: timestamp,
      updatedAt: timestamp,
      state: "waiting"
    };

    session.queue.push(queueEntry);
    session.updatedAt = timestamp;
    await this.#persist();
    return queueEntry;
  }

  async updateQueueEntryState(
    sessionId: string,
    queueEntryId: string,
    nextState: QueueEntryState
  ): Promise<QueueEntry> {
    const session = this.#getSessionOrThrow(sessionId);
    const queueEntry = this.#getQueueEntryOrThrow(session, queueEntryId);

    if (queueEntry.state === nextState) {
      return queueEntry;
    }

    if (!isValidQueueTransition(queueEntry.state, nextState)) {
      throw new SessionServiceError(
        `Invalid queue state transition: ${queueEntry.state} -> ${nextState}`,
        409
      );
    }

    queueEntry.state = nextState;
    queueEntry.updatedAt = new Date().toISOString();
    session.updatedAt = queueEntry.updatedAt;
    await this.#persist();
    return queueEntry;
  }

  #getSessionOrThrow(sessionId: string): Session {
    const session = this.#sessions.get(sessionId);

    if (!session) {
      throw new SessionServiceError("Session not found", 404);
    }

    return session;
  }

  #getQueueEntryOrThrow(session: Session, queueEntryId: string): QueueEntry {
    const queueEntry = session.queue.find((entry) => entry.id === queueEntryId);

    if (!queueEntry) {
      throw new SessionServiceError("Queue entry not found", 404);
    }

    return queueEntry;
  }

  async #load(): Promise<void> {
    if (!this.#storeFilePath) {
      return;
    }

    try {
      const persistedRaw = await readFile(this.#storeFilePath, "utf-8");
      const persistedStore = JSON.parse(persistedRaw) as PersistedStore;
      const sessions = persistedStore.sessions ?? [];

      for (const session of sessions) {
        this.#sessions.set(session.id, session);
      }
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code !== "ENOENT") {
        throw error;
      }
    }
  }

  async #persist(): Promise<void> {
    if (!this.#storeFilePath) {
      return;
    }

    const persistedStore: PersistedStore = {
      sessions: [...this.#sessions.values()]
    };

    await mkdir(dirname(this.#storeFilePath), { recursive: true });
    await writeFile(this.#storeFilePath, JSON.stringify(persistedStore, null, 2));
  }
}

function isValidSessionTransition(current: SessionState, next: SessionState): boolean {
  const transitions: Record<SessionState, SessionState[]> = {
    open: ["paused", "closed"],
    paused: ["open", "closed"],
    closed: []
  };

  return transitions[current].includes(next);
}

function isValidQueueTransition(current: QueueEntryState, next: QueueEntryState): boolean {
  const transitions: Record<QueueEntryState, QueueEntryState[]> = {
    waiting: ["called", "cancelled"],
    called: ["completed", "waiting", "cancelled"],
    completed: [],
    cancelled: []
  };

  return transitions[current].includes(next);
}
