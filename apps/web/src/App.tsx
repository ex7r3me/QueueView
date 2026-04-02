import { useCallback, useEffect, useMemo, useState } from "react";
import type { QueueEntryState, SessionState } from "@queuview/shared";

type ViewMode = "host" | "participant";

interface SessionSummary {
  id: string;
  hostName: string;
  state: SessionState;
  queueSize: number;
}

interface QueueEntry {
  id: string;
  displayName: string;
  joinedAt: string;
  updatedAt: string;
  state: QueueEntryState;
}

interface SessionDetail {
  id: string;
  hostName: string;
  state: SessionState;
  createdAt: string;
  updatedAt: string;
  queue: QueueEntry[];
}

interface ApiError {
  error?: string;
}

const REFRESH_INTERVAL_MS = 5000;

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const payload = (await response.json()) as ApiError;
      if (payload.error) {
        message = payload.error;
      }
    } catch {
      // no-op: keep fallback message
    }

    throw new Error(message);
  }

  return (await response.json()) as T;
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function App() {
  const [mode, setMode] = useState<ViewMode>("host");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [hostName, setHostName] = useState("");
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [hostSession, setHostSession] = useState<SessionDetail | null>(null);

  const [participantSessionId, setParticipantSessionId] = useState("");
  const [participantName, setParticipantName] = useState("");
  const [participantEntryId, setParticipantEntryId] = useState("");
  const [participantSession, setParticipantSession] = useState<SessionDetail | null>(null);

  const reportError = useCallback((value: unknown) => {
    const nextError = value instanceof Error ? value.message : "Something went wrong";
    setError(nextError);
    setMessage("");
  }, []);

  const reportSuccess = useCallback((value: string) => {
    setMessage(value);
    setError("");
  }, []);

  const loadSessions = useCallback(async () => {
    try {
      const payload = await apiRequest<{ sessions: SessionSummary[] }>("/sessions");
      setSessions(payload.sessions);
    } catch (loadError) {
      reportError(loadError);
    }
  }, [reportError]);

  const loadHostSession = useCallback(
    async (sessionId: string) => {
      if (!sessionId) {
        setHostSession(null);
        return;
      }

      try {
        const payload = await apiRequest<{ session: SessionDetail }>(`/sessions/${sessionId}`);
        setHostSession(payload.session);
      } catch (loadError) {
        reportError(loadError);
      }
    },
    [reportError]
  );

  const loadParticipantSession = useCallback(
    async (sessionId: string) => {
      if (!sessionId) {
        setParticipantSession(null);
        return;
      }

      try {
        const payload = await apiRequest<{ session: SessionDetail }>(`/sessions/${sessionId}`);
        setParticipantSession(payload.session);
      } catch (loadError) {
        reportError(loadError);
      }
    },
    [reportError]
  );

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    if (!selectedSessionId && !participantSessionId) {
      return;
    }

    const interval = window.setInterval(() => {
      if (selectedSessionId) {
        void loadHostSession(selectedSessionId);
      }
      if (participantSessionId) {
        void loadParticipantSession(participantSessionId);
      }
    }, REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [loadHostSession, loadParticipantSession, participantSessionId, selectedSessionId]);

  const waitingCount = useMemo(
    () => hostSession?.queue.filter((entry) => entry.state === "waiting").length ?? 0,
    [hostSession]
  );

  const calledCount = useMemo(
    () => hostSession?.queue.filter((entry) => entry.state === "called").length ?? 0,
    [hostSession]
  );

  const participantEntry = useMemo(
    () => participantSession?.queue.find((entry) => entry.id === participantEntryId) ?? null,
    [participantEntryId, participantSession]
  );

  async function createSession(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const payload = await apiRequest<{ session: SessionDetail }>("/sessions", {
        method: "POST",
        body: JSON.stringify({ hostName })
      });

      setHostName("");
      setSelectedSessionId(payload.session.id);
      setHostSession(payload.session);
      await loadSessions();
      reportSuccess(`Session ${payload.session.id} created`);
    } catch (createError) {
      reportError(createError);
    }
  }

  async function selectSession(sessionId: string) {
    setSelectedSessionId(sessionId);
    await loadHostSession(sessionId);
  }

  async function updateSessionState(nextState: SessionState) {
    if (!hostSession) {
      return;
    }

    try {
      const payload = await apiRequest<{ session: SessionDetail }>(`/sessions/${hostSession.id}`, {
        method: "PATCH",
        body: JSON.stringify({ state: nextState })
      });

      setHostSession(payload.session);
      await loadSessions();
      reportSuccess(`Session moved to ${nextState}`);
    } catch (updateError) {
      reportError(updateError);
    }
  }

  async function updateQueueEntryState(queueEntryId: string, state: QueueEntryState) {
    if (!hostSession) {
      return;
    }

    try {
      await apiRequest<{ queueEntry: QueueEntry }>(`/sessions/${hostSession.id}/queue/${queueEntryId}`, {
        method: "PATCH",
        body: JSON.stringify({ state })
      });

      await loadHostSession(hostSession.id);
      reportSuccess(`Queue entry moved to ${state}`);
    } catch (updateError) {
      reportError(updateError);
    }
  }

  async function callNextParticipant() {
    const nextWaiting = hostSession?.queue.find((entry) => entry.state === "waiting");
    if (!nextWaiting) {
      reportError(new Error("No waiting participants"));
      return;
    }

    await updateQueueEntryState(nextWaiting.id, "called");
  }

  async function joinQueue(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const payload = await apiRequest<{ queueEntry: QueueEntry }>(
        `/sessions/${participantSessionId}/queue`,
        {
          method: "POST",
          body: JSON.stringify({ displayName: participantName })
        }
      );

      setParticipantEntryId(payload.queueEntry.id);
      setParticipantName("");
      await loadParticipantSession(participantSessionId);
      reportSuccess("Joined queue successfully");
    } catch (joinError) {
      reportError(joinError);
    }
  }

  async function refreshParticipantView() {
    await loadParticipantSession(participantSessionId);
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <p className="eyebrow">Queuview MVP</p>
        <h1>Live Queue Control</h1>
        <p className="subtitle">Hosts manage flow. Participants track their position in real time.</p>
      </header>

      <section className="mode-switch" aria-label="View mode">
        <button
          type="button"
          className={mode === "host" ? "mode-pill active" : "mode-pill"}
          onClick={() => setMode("host")}
        >
          Host Console
        </button>
        <button
          type="button"
          className={mode === "participant" ? "mode-pill active" : "mode-pill"}
          onClick={() => setMode("participant")}
        >
          Participant View
        </button>
      </section>

      {error ? (
        <p role="alert" className="banner error">
          {error}
        </p>
      ) : null}
      {message ? <p className="banner success">{message}</p> : null}

      {mode === "host" ? (
        <section className="panel-grid">
          <article className="panel">
            <h2>Create session</h2>
            <form className="stack" onSubmit={createSession}>
              <label htmlFor="host-name">Host display name</label>
              <input
                id="host-name"
                value={hostName}
                onChange={(event) => setHostName(event.target.value)}
                placeholder="Alex from support"
              />
              <button type="submit">Create queue</button>
            </form>
          </article>

          <article className="panel">
            <div className="panel-header">
              <h2>Sessions</h2>
              <button type="button" className="ghost" onClick={() => void loadSessions()}>
                Refresh
              </button>
            </div>
            {sessions.length === 0 ? <p>No sessions yet.</p> : null}
            <ul className="session-list">
              {sessions.map((session) => (
                <li key={session.id}>
                  <button
                    type="button"
                    className={selectedSessionId === session.id ? "session-item selected" : "session-item"}
                    onClick={() => void selectSession(session.id)}
                  >
                    <span>{session.hostName}</span>
                    <span>{session.state}</span>
                    <span>{session.queueSize} in queue</span>
                  </button>
                </li>
              ))}
            </ul>
          </article>

          <article className="panel wide">
            <h2>Live queue controls</h2>
            {!hostSession ? <p>Select a session to manage it.</p> : null}
            {hostSession ? (
              <>
                <p>
                  Session <strong>{hostSession.id}</strong> | state: <strong>{hostSession.state}</strong>
                </p>
                <div className="inline-actions">
                  <button type="button" onClick={() => void updateSessionState("open")}>
                    Open
                  </button>
                  <button type="button" onClick={() => void updateSessionState("paused")}>
                    Pause
                  </button>
                  <button type="button" onClick={() => void updateSessionState("closed")}>
                    Close
                  </button>
                  <button type="button" className="accent" onClick={() => void callNextParticipant()}>
                    Call next waiting
                  </button>
                </div>

                <p>
                  Waiting: <strong>{waitingCount}</strong> | Called: <strong>{calledCount}</strong> | Total:{" "}
                  <strong>{hostSession.queue.length}</strong>
                </p>

                <ul className="queue-list">
                  {hostSession.queue.map((entry) => (
                    <li key={entry.id} className="queue-item">
                      <div>
                        <p className="queue-name">{entry.displayName}</p>
                        <p className="queue-meta">
                          {entry.state} | joined {formatTimestamp(entry.joinedAt)}
                        </p>
                      </div>
                      <div className="mini-actions">
                        <button type="button" onClick={() => void updateQueueEntryState(entry.id, "called")}>Call</button>
                        <button type="button" onClick={() => void updateQueueEntryState(entry.id, "completed")}>Complete</button>
                        <button type="button" onClick={() => void updateQueueEntryState(entry.id, "cancelled")}>Cancel</button>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </article>
        </section>
      ) : (
        <section className="panel-grid">
          <article className="panel">
            <h2>Join a queue</h2>
            <form className="stack" onSubmit={joinQueue}>
              <label htmlFor="session-id">Session ID</label>
              <input
                id="session-id"
                value={participantSessionId}
                onChange={(event) => setParticipantSessionId(event.target.value)}
                placeholder="Paste session id"
              />
              <label htmlFor="participant-name">Display name</label>
              <input
                id="participant-name"
                value={participantName}
                onChange={(event) => setParticipantName(event.target.value)}
                placeholder="Taylor"
              />
              <button type="submit">Join queue</button>
            </form>
          </article>

          <article className="panel wide">
            <div className="panel-header">
              <h2>Live status</h2>
              <button type="button" className="ghost" onClick={() => void refreshParticipantView()}>
                Refresh now
              </button>
            </div>

            {!participantSession ? <p>Join or refresh a session to view your status.</p> : null}
            {participantSession ? (
              <>
                <p>
                  Session {participantSession.id} is <strong>{participantSession.state}</strong>
                </p>
                <p>
                  Queue length: <strong>{participantSession.queue.length}</strong>
                </p>
                {participantEntry ? (
                  <p>
                    Your status: <strong>{participantEntry.state}</strong>
                  </p>
                ) : (
                  <p>Your queue entry is not visible yet. It may have been removed.</p>
                )}
              </>
            ) : null}
          </article>
        </section>
      )}
    </main>
  );
}
