import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

function asJsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

describe("App", () => {
  const now = "2026-04-03T10:00:00.000Z";
  const snapshotPayload = {
    enabled: true,
    updatedAt: now,
    queues: [
      {
        name: "notifications",
        settings: {
          concurrency: 4,
          enqueueEveryMs: 500,
          processingMsMin: 100,
          processingMsMax: 600,
          failureRate: 0.1,
          maxRetries: 2,
          retryDelayMsMin: 200,
          retryDelayMsMax: 800
        },
        stats: {
          waiting: 2,
          active: 1,
          completed: 4,
          failed: 0,
          retryScheduled: 1,
          retried: 2,
          totalCreated: 8,
          totalProcessed: 6
        },
        recentJobs: [
          {
            id: "job-1",
            state: "active",
            attempts: 1,
            maxAttempts: 2,
            createdAt: now,
            startedAt: now,
            finishedAt: null,
            lastError: null
          }
        ]
      }
    ]
  };
  const detailPayload = {
    enabled: true,
    updatedAt: now,
    queue: snapshotPayload.queues[0],
    jobs: {
      latest: [
        {
          id: "job-1",
          state: "active",
          attempts: 1,
          maxAttempts: 2,
          createdAt: now,
          startedAt: now,
          finishedAt: null,
          lastError: null
        },
        {
          id: "job-2",
          state: "completed",
          attempts: 1,
          maxAttempts: 2,
          createdAt: now,
          startedAt: now,
          finishedAt: now,
          lastError: null
        }
      ],
      waiting: [],
      active: [
        {
          id: "job-1",
          state: "active",
          attempts: 1,
          maxAttempts: 2,
          createdAt: now,
          startedAt: now,
          finishedAt: null,
          lastError: null
        }
      ],
      retryScheduled: [],
      completed: [
        {
          id: "job-2",
          state: "completed",
          attempts: 1,
          maxAttempts: 2,
          createdAt: now,
          startedAt: now,
          finishedAt: now,
          lastError: null
        }
      ],
      failed: []
    }
  };

  beforeEach(() => {
    window.location.hash = "#/";
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      const method = init?.method ?? "GET";

      if (url.endsWith("/demo/queues") && method === "GET") {
        return asJsonResponse(snapshotPayload);
      }

      if (url.endsWith("/demo/queues/notifications") && method === "GET") {
        return asJsonResponse(detailPayload);
      }

      return asJsonResponse({ error: `Unhandled ${method} ${url}` }, 500);
    });
  });

  afterEach(() => {
    cleanup();
    window.location.hash = "#/";
    vi.restoreAllMocks();
  });

  it("renders queue overview and recent jobs", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Live Queue Monitor")).toBeInTheDocument();
      expect(screen.getByText("notifications")).toBeInTheDocument();
    });

    expect(screen.getByText("waiting: 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open queue" })).toBeInTheDocument();
  });

  it("supports manual refresh", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("notifications")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Refresh now" }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });
  });

  it("opens a queue details page with status tabs", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("notifications")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Open queue" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Back to all queues" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Latest \(2\)/ })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Completed \(1\)/ }));

    await waitFor(() => {
      expect(screen.getByText(/job-2/i)).toBeInTheDocument();
    });
  });
});
