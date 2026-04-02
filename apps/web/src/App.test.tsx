import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

interface QueueEntry {
  id: string;
  displayName: string;
  joinedAt: string;
  updatedAt: string;
  state: "waiting" | "called" | "completed" | "cancelled";
}

interface Session {
  id: string;
  hostName: string;
  state: "open" | "paused" | "closed";
  createdAt: string;
  updatedAt: string;
  queue: QueueEntry[];
}

function asJsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

describe("App", () => {
  const now = "2026-04-02T10:00:00.000Z";
  let session: Session;

  beforeEach(() => {
    session = {
      id: "session-1",
      hostName: "Host One",
      state: "open",
      createdAt: now,
      updatedAt: now,
      queue: []
    };

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      const method = init?.method ?? "GET";

      if (url.endsWith("/sessions") && method === "GET") {
        return asJsonResponse({
          sessions: [
            {
              id: session.id,
              hostName: session.hostName,
              state: session.state,
              queueSize: session.queue.length
            }
          ]
        });
      }

      if (url.endsWith("/sessions") && method === "POST") {
        session = {
          ...session,
          hostName: JSON.parse(String(init?.body)).hostName
        };
        return asJsonResponse({ session }, 201);
      }

      if (url.endsWith(`/sessions/${session.id}`) && method === "GET") {
        return asJsonResponse({ session });
      }

      if (url.endsWith(`/sessions/${session.id}`) && method === "PATCH") {
        session = {
          ...session,
          state: JSON.parse(String(init?.body)).state
        };
        return asJsonResponse({ session });
      }

      if (url.endsWith(`/sessions/${session.id}/queue`) && method === "POST") {
        const payload = JSON.parse(String(init?.body)) as { displayName: string };
        const queueEntry: QueueEntry = {
          id: "entry-1",
          displayName: payload.displayName,
          state: "waiting",
          joinedAt: now,
          updatedAt: now
        };
        session = {
          ...session,
          queue: [...session.queue, queueEntry]
        };
        return asJsonResponse({ queueEntry }, 201);
      }

      if (url.endsWith(`/sessions/${session.id}/queue/entry-1`) && method === "PATCH") {
        const payload = JSON.parse(String(init?.body)) as { state: QueueEntry["state"] };
        session = {
          ...session,
          queue: session.queue.map((entry) =>
            entry.id === "entry-1"
              ? {
                  ...entry,
                  state: payload.state,
                  updatedAt: now
                }
              : entry
          )
        };
        return asJsonResponse({ queueEntry: session.queue[0] });
      }

      return asJsonResponse({ error: `Unhandled ${method} ${url}` }, 500);
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("creates a session from host console", async () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText("Host display name"), {
      target: { value: "Support Lead" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Create queue" }));

    await waitFor(() => {
      expect(screen.getByText("Session session-1 created")).toBeInTheDocument();
    });

    expect(screen.getAllByText("session-1", { exact: false }).length).toBeGreaterThan(0);
  });

  it("joins queue from participant view and shows status", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Participant View" }));
    fireEvent.change(screen.getByLabelText("Session ID"), {
      target: { value: "session-1" }
    });
    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "Taylor" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Join queue" }));

    await waitFor(() => {
      expect(screen.getByText("Joined queue successfully")).toBeInTheDocument();
    });

    expect(screen.getByText("Your status:", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("waiting", { exact: false })).toBeInTheDocument();
  });

  it("calls next waiting participant from host controls", async () => {
    session.queue = [
      {
        id: "entry-1",
        displayName: "Taylor",
        state: "waiting",
        joinedAt: now,
        updatedAt: now
      }
    ];

    render(<App />);

    const sessionButton = await screen.findByRole("button", { name: /Host One.*in queue/ });
    fireEvent.click(sessionButton);

    await waitFor(() => {
      expect(screen.getByText("Waiting:", { exact: false })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Call next waiting" }));

    await waitFor(() => {
      expect(screen.getByText("Queue entry moved to called")).toBeInTheDocument();
    });
  });
});
