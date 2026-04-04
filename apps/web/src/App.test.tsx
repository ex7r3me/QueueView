import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

function setViewportWidth(width: number): void {
  Object.defineProperty(window, "innerWidth", {
    writable: true,
    configurable: true,
    value: width
  });
  window.dispatchEvent(new Event("resize"));
}

describe("App", () => {
  const now = "2026-04-03T10:00:00.000Z";
  const baseJob = {
    attempts: 1,
    maxAttempts: 2,
    createdAt: now,
    startedAt: now,
    finishedAt: null,
    lastError: null,
    data: {
      externalRef: "evt_job-1",
      payloadVersion: 1,
      dryRun: false
    },
    config: {
      timeoutMs: 5000,
      removeOnComplete: true,
      priority: "normal" as const,
      retryBackoffMs: 300
    },
    replies: [
      {
        at: now,
        message: "Job enqueued"
      }
    ]
  };
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
            ...baseJob
          }
        ]
      }
    ]
  };
  const detailPayload = {
    enabled: true,
    updatedAt: now,
    queue: snapshotPayload.queues[0],
    ops: {
      supportedActions: ["requeue", "mark_failed", "mark_completed"],
      recentEvents: [],
      governance: {
        actorId: "web.operator",
        actorRole: "operator",
        environmentScope: "demo",
        allowedActions: ["requeue", "mark_completed"],
        confirmationRequiredActions: ["mark_failed", "mark_completed"],
        blockedReason: null,
        policyVersion: "2026-04-04.v1"
      }
    },
    jobs: {
      latest: [
        {
          id: "job-1",
          state: "active",
          ...baseJob
        },
        {
          id: "job-2",
          state: "completed",
          ...baseJob,
          finishedAt: now,
          data: {
            externalRef: "evt_job-2",
            payloadVersion: 1,
            dryRun: false
          }
        }
      ],
      waiting: [],
      active: [
        {
          id: "job-1",
          state: "active",
          ...baseJob
        }
      ],
      retryScheduled: [],
      completed: [
        {
          id: "job-2",
          state: "completed",
          ...baseJob,
          finishedAt: now,
          data: {
            externalRef: "evt_job-2",
            payloadVersion: 1,
            dryRun: false
          }
        }
      ],
      failed: []
    }
  };

  beforeEach(() => {
    setViewportWidth(1280);
    window.localStorage.clear();
    window.location.hash = "#/";
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
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

      if (url.endsWith("/demo/queues/ops") && method === "GET") {
        return asJsonResponse({
          enabled: true,
          updatedAt: now,
          counters: {
            requeue: 0,
            mark_failed: 0,
            mark_completed: 0
          },
          recentEvents: []
        });
      }

      if (url.endsWith("/demo/queues/patterns") && method === "GET") {
        return asJsonResponse({
          enabled: true,
          updatedAt: now,
          queues: [
            {
              queueName: "notifications",
              incidentScore: 48,
              health: {
                status: "watch",
                confidence: 0.8,
                reason: "Retry pressure is elevated."
              },
              signals: [
                {
                  id: "retry-loop-notifications",
                  queueName: "notifications",
                  kind: "retry_loop",
                  severity: "medium",
                  confidence: 0.8,
                  summary: "1 jobs are retry-scheduled with elevated retry pressure.",
                  evidence: {
                    waiting: 2,
                    active: 1,
                    retryScheduled: 1,
                    failed: 0,
                    totalProcessed: 6,
                    failedJobIds: [],
                    retryScheduledJobIds: []
                  },
                  drilldown: {
                    queueDetailPath: "#/queues/notifications",
                    suggestedTab: "retryScheduled"
                  }
                }
              ]
            }
          ],
          topSignals: [
            {
              id: "retry-loop-notifications",
              queueName: "notifications",
              kind: "retry_loop",
              severity: "medium",
              confidence: 0.8,
              summary: "1 jobs are retry-scheduled with elevated retry pressure.",
              evidence: {
                waiting: 2,
                active: 1,
                retryScheduled: 1,
                failed: 0,
                totalProcessed: 6,
                failedJobIds: [],
                retryScheduledJobIds: []
              },
              drilldown: {
                queueDetailPath: "#/queues/notifications",
                suggestedTab: "retryScheduled"
              }
            }
          ]
        });
      }

      if (url.endsWith("/demo/queues/incidents") && method === "GET") {
        return asJsonResponse({
          enabled: true,
          updatedAt: now,
          incidents: [
            {
              id: "incident-retry-loop",
              title: "Retry loops detected across 2 queues",
              severity: "high",
              status: "active",
              incidentScore: 84,
              summary: "Correlated retry pressure requires coordinated triage.",
              signalKinds: ["retry_loop"],
              queues: [
                {
                  queueName: "notifications",
                  incidentScore: 76,
                  healthStatus: "watch",
                  healthReason: "Retry pressure is elevated.",
                  primarySignal: {
                    id: "retry-loop-notifications",
                    queueName: "notifications",
                    kind: "retry_loop",
                    severity: "high",
                    confidence: 0.8,
                    summary: "1 jobs are retry-scheduled with elevated retry pressure.",
                    evidence: {
                      waiting: 2,
                      active: 1,
                      retryScheduled: 1,
                      failed: 0,
                      totalProcessed: 6,
                      failedJobIds: [],
                      retryScheduledJobIds: ["job-1"]
                    },
                    drilldown: {
                      queueDetailPath: "#/queues/notifications",
                      suggestedTab: "retryScheduled"
                    }
                  }
                }
              ]
            }
          ]
        });
      }

      if (url.endsWith("/demo/queues/alerts") && method === "GET") {
        return asJsonResponse({
          enabled: true,
          updatedAt: now,
          thresholds: {
            failureClusterWarn: 3,
            failureClusterCritical: 8,
            retryLoopWarn: 2,
            retryLoopCritical: 5,
            lagBacklogWarn: 6,
            lagBacklogCritical: 12,
            minNotificationIntervalMs: 60000
          },
          active: [
            {
              id: "failure-cluster-payments",
              queueName: "payments",
              kind: "failure_cluster",
              status: "triggered",
              severity: "critical",
              summary: "payments failure cluster reached critical threshold.",
              triggeredAt: "2026-04-03T09:58:00.000Z",
              updatedAt: "2026-04-03T09:59:00.000Z"
            },
            {
              id: "retry-loop-notifications",
              queueName: "notifications",
              kind: "retry_loop",
              status: "watch",
              severity: "medium",
              summary: "notifications retry loop at medium severity: 1 jobs in retry queue.",
              triggeredAt: now,
              updatedAt: now
            },
            {
              id: "lag-backlog-email",
              queueName: "email",
              kind: "lag_backlog_anomaly",
              status: "watch",
              severity: "low",
              summary: "email backlog anomaly at low severity.",
              triggeredAt: "2026-04-03T09:00:00.000Z",
              updatedAt: "2026-04-03T09:30:00.000Z"
            }
          ],
          notifications: [
            {
              id: "alert-notif-1",
              at: now,
              queueName: "payments",
              kind: "failure_cluster",
              severity: "critical",
              event: "triggered",
              message: "payments failure cluster reached critical threshold."
            }
          ]
        });
      }

      if (url.endsWith("/demo/queues/alerts/thresholds") && method === "PATCH") {
        return asJsonResponse({
          enabled: true,
          updatedAt: now,
          thresholds: {
            failureClusterWarn: 2,
            failureClusterCritical: 6,
            retryLoopWarn: 2,
            retryLoopCritical: 5,
            lagBacklogWarn: 6,
            lagBacklogCritical: 12,
            minNotificationIntervalMs: 60000
          },
          active: [],
          notifications: []
        });
      }

      if (url.endsWith("/demo/queues/notifications") && method === "GET") {
        return asJsonResponse(detailPayload);
      }

      if (url.endsWith("/demo/queues/notifications/jobs/job-1/actions") && method === "POST") {
        return asJsonResponse({
          enabled: true,
          updatedAt: now,
          accepted: true,
          action: "requeue",
          queueName: "notifications",
          reason: "Requeued from active.",
          job: {
            id: "job-1",
            state: "waiting",
            ...baseJob
          },
          governance: detailPayload.ops.governance
        });
      }

      if (url.endsWith("/demo/queues/audit") && method === "GET") {
        return asJsonResponse({
          enabled: true,
          updatedAt: now,
          totalEvents: 1,
          recentEvents: [
            {
              id: "audit-1",
              at: now,
              queueName: "notifications",
              jobId: "job-1",
              action: "requeue",
              fromState: "active",
              toState: "waiting",
              note: "Requeued from active.",
              actorId: "web.operator",
              actorRole: "operator",
              environmentScope: "demo",
              confirmationSatisfied: false,
              policyVersion: "2026-04-04.v1"
            }
          ]
        });
      }

      return asJsonResponse({ error: `Unhandled ${method} ${url}` }, 500);
    });
  });

  afterEach(() => {
    cleanup();
    window.location.hash = "#/";
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("renders queue overview and recent jobs", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Live Queue Monitor")).toBeInTheDocument();
      expect(screen.getAllByText("notifications").length).toBeGreaterThan(0);
    });

    expect(screen.getByText("Queue Health Table")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Queue health cards" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Raw" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pattern" })).toBeInTheDocument();
    expect(screen.queryByText("Pattern Signals (heuristic)")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Open queue notifications" }).length).toBeGreaterThan(0);
  });

  it("shows a helper notice when no saved triage context exists", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("No saved triage context found. Starting fresh.")).toBeInTheDocument();
    });
  });

  it("falls back safely when persisted triage context payload is malformed", async () => {
    window.localStorage.setItem("queueview.ui-state.v1", "{bad-json");

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Saved triage context was invalid and defaults were applied.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Raw" })).toHaveClass("active");
    });
  });

  it("hydrates alert triage filters and selected alert from persisted state", async () => {
    window.localStorage.setItem(
      "queueview.ui-state.v1",
      JSON.stringify({
        schemaVersion: 2,
        savedAt: now,
        queueSelection: null,
        primaryView: "overview",
        experienceLayer: "opinionated",
        queueQuery: "",
        incidentQuery: "",
        incidentSeverityFilter: "all",
        incidentStatusFilter: "all",
        activeTab: "latest",
        actorRole: "operator",
        environmentScope: "demo",
        alertStatusFilter: "all",
        alertSourceFilter: "retry_loop",
        alertOwnerFilter: "all",
        alertTimeFilter: "7d",
        selectedAlertId: "retry-loop-notifications"
      })
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Alert Center")).toBeInTheDocument();
      expect(screen.getByRole("combobox", { name: "Source" })).toHaveValue("retry_loop");
      expect(screen.getByRole("combobox", { name: "Time" })).toHaveValue("7d");
    });

    expect(screen.getByRole("button", { name: /notifications retry loop/i })).toHaveClass("active");
    expect(screen.getByRole("region", { name: "Alert detail" })).toHaveTextContent(/notifications retry loop/i);
  });

  it("supports alert center rollback toggle without breaking the shell", async () => {
    vi.stubEnv("VITE_ALERT_CENTER_ENABLED", "false");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Live Queue Monitor")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Opinionated" }));

    await waitFor(() => {
      expect(screen.getByText(/Alert Center rollback is active/)).toBeInTheDocument();
      expect(screen.queryByRole("list", { name: "Alert triage list" })).not.toBeInTheDocument();
      expect(screen.getByText("Incident Command Center")).toBeInTheDocument();
    });
  });

  it("uses explicit deep-link tab over persisted tab state", async () => {
    window.localStorage.setItem(
      "queueview.ui-state.v1",
      JSON.stringify({
        schemaVersion: 2,
        savedAt: now,
        queueSelection: "notifications",
        primaryView: "queues",
        experienceLayer: "opinionated",
        queueQuery: "",
        incidentQuery: "",
        incidentSeverityFilter: "all",
        incidentStatusFilter: "all",
        activeTab: "failed",
        actorRole: "operator",
        environmentScope: "demo"
      })
    );
    window.location.hash = "#/queues/notifications?tab=retryScheduled";

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Back to all queues" })).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /Retry \(0\)/ })).toHaveAttribute("aria-selected", "true");
      expect(screen.getByRole("tab", { name: /Failed \(0\)/ })).toHaveAttribute("aria-selected", "false");
    });
  });

  it("falls back safely when persisted queue selection is no longer available", async () => {
    window.localStorage.setItem(
      "queueview.ui-state.v1",
      JSON.stringify({
        schemaVersion: 2,
        savedAt: now,
        queueSelection: "ghost-queue",
        primaryView: "queues",
        experienceLayer: "pattern",
        queueQuery: "",
        incidentQuery: "",
        incidentSeverityFilter: "all",
        incidentStatusFilter: "all",
        activeTab: "failed",
        actorRole: "operator",
        environmentScope: "demo"
      })
    );
    window.location.hash = "#/";

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("We restored most of your context, but some items are no longer available.")).toBeInTheDocument();
      expect(screen.getByRole("navigation", { name: "Primary navigation" })).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: "Back to all queues" })).not.toBeInTheDocument();
  });

  it("shows assisted triage recommendations in opinionated mode", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText("notifications").length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole("button", { name: "Opinionated" }));

    await waitFor(() => {
      expect(screen.getByText("Pattern Signals (heuristic)")).toBeInTheDocument();
      expect(screen.getByText("Alert Center")).toBeInTheDocument();
      expect(screen.getByText("Incident Command Center")).toBeInTheDocument();
      expect(screen.getByText("Opinionated Triage Assistant")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Open evidence queue" })).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Open evidence queue" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open notifications evidence" })).toBeInTheDocument();
  });

  it("renders severity-first alert triage and enforces state transition validation", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Live Queue Monitor")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Opinionated" }));

    const triageTable = await screen.findByRole("table", { name: "Alert triage table" });
    const triageButtons = within(triageTable).getAllByRole("button");
    expect(triageButtons[0]?.textContent).toContain("payments");
    expect(triageButtons[1]?.textContent).toContain("notifications");
    expect(triageButtons[2]?.textContent).toContain("email");

    const notificationsRow = within(triageTable).getByRole("button", { name: /notifications retry loop/i });
    fireEvent.click(notificationsRow);

    const detail = await screen.findByRole("region", { name: "Alert detail" });
    await waitFor(() => {
      expect(within(detail).getByRole("heading", { level: 3, name: /notifications retry loop/i })).toBe(document.activeElement);
    });
    fireEvent.click(within(detail).getByRole("button", { name: "Acknowledge" }));

    await waitFor(() => {
      expect(within(detail).getByText(/owner web\.operator \(operator\) acknowledged/i)).toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent(/moved to acknowledged/i);
    });

    await waitFor(() => {
      expect(document.activeElement).toBe(notificationsRow);
    });

    fireEvent.click(within(detail).getByRole("button", { name: "Mute" }));
    await waitFor(() => {
      expect(screen.getByText("Mute reason is required before muting an alert.", { selector: ".banner.error" })).toBeInTheDocument();
    });

    fireEvent.change(within(detail).getByRole("textbox", { name: "Mute reason" }), {
      target: { value: "Planned maintenance" }
    });
    fireEvent.click(within(detail).getByRole("button", { name: "Mute" }));
    await waitFor(() => {
      expect(
        screen.getByText("Mute duration is required before muting an alert.", { selector: ".banner.error" })
      ).toBeInTheDocument();
    });

    fireEvent.change(within(detail).getByLabelText("Mute until"), {
      target: { value: "2026-04-03T11:00" }
    });
    fireEvent.click(within(detail).getByRole("button", { name: "Mute" }));
    await waitFor(() => {
      expect(within(detail).getByText(/state muted/i)).toBeInTheDocument();
    });

    fireEvent.change(within(detail).getByRole("textbox", { name: "Resolution note" }), {
      target: { value: "short" }
    });
    fireEvent.click(within(detail).getByRole("button", { name: "Resolve" }));
    await waitFor(() => {
      expect(
        screen.getByText("Resolution note must be at least 8 characters.", { selector: ".banner.error" })
      ).toBeInTheDocument();
    });

    fireEvent.change(within(detail).getByRole("textbox", { name: "Resolution note" }), {
      target: { value: "Fixed after retry strategy update" }
    });
    fireEvent.click(within(detail).getByRole("button", { name: "Resolve" }));
    await waitFor(() => {
      expect(within(detail).getByText(/state resolved/i)).toBeInTheDocument();
    });
  });

  it("supports failed-delivery retry while preserving triage actions", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Live Queue Monitor")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Opinionated" }));

    const triageTable = await screen.findByRole("table", { name: "Alert triage table" });
    const paymentsRow = within(triageTable).getByRole("button", { name: /payments failure cluster/i });
    fireEvent.click(paymentsRow);

    const detail = await screen.findByRole("region", { name: "Alert detail" });
    fireEvent.click(within(detail).getByRole("button", { name: "Mark delivery failed" }));

    await waitFor(() => {
      expect(within(detail).getByRole("button", { name: "Retry delivery" })).toBeInTheDocument();
      expect(within(detail).getByRole("button", { name: "Acknowledge" })).toBeEnabled();
      expect(within(detail).getByRole("button", { name: "Mute" })).toBeEnabled();
      expect(within(detail).getByRole("button", { name: "Resolve" })).toBeEnabled();
    });

    fireEvent.click(within(detail).getByRole("button", { name: "Retry delivery" }));
    await waitFor(() => {
      expect(within(detail).getByText(/last retry/i)).toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent(/delivery retry requested/i);
      expect(document.activeElement).toBe(paymentsRow);
    });
  });

  it("uses tablet right-side drawer for alert details", async () => {
    setViewportWidth(900);
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Live Queue Monitor")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Opinionated" }));

    const triageList = await screen.findByRole("list", { name: "Alert triage list" });
    const notificationsRow = within(triageList).getByRole("button", { name: /notifications retry loop/i });
    fireEvent.click(notificationsRow);

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Alert detail" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Close detail" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Close detail" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Alert detail" })).not.toBeInTheDocument();
      expect(document.activeElement).toBe(notificationsRow);
    });
  });

  it("uses mobile full-screen alert detail with back navigation", async () => {
    setViewportWidth(420);
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Live Queue Monitor")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Opinionated" }));
    const triageList = await screen.findByRole("list", { name: "Alert triage list" });
    const notificationsRow = within(triageList).getByRole("button", { name: /notifications retry loop/i });
    fireEvent.click(notificationsRow);

    await waitFor(() => {
      expect(screen.getByRole("region", { name: "Alert detail" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Back to alerts" })).toBeInTheDocument();
      expect(screen.queryByRole("list", { name: "Alert triage list" })).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Back to alerts" }));
    await waitFor(() => {
      expect(screen.getByRole("list", { name: "Alert triage list" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Back to alerts" })).not.toBeInTheDocument();
      expect(document.activeElement).toHaveAccessibleName(/notifications retry loop/i);
    });
  });

  it("opens alert-linked queue/job context and restores alert detail on back", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Live Queue Monitor")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Opinionated" }));

    const triageTable = await screen.findByRole("table", { name: "Alert triage table" });
    const notificationsRow = within(triageTable).getByRole("button", { name: /notifications retry loop/i });
    fireEvent.click(notificationsRow);

    const detail = await screen.findByRole("region", { name: "Alert detail" });
    expect(within(detail).getByRole("button", { name: "Open queue detail" })).toBeInTheDocument();
    expect(within(detail).getByRole("button", { name: "Open job detail" })).toBeInTheDocument();

    fireEvent.click(within(detail).getByRole("button", { name: "Open job detail" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Back to Alert Center" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /Active \(1\)/ })).toHaveAttribute("aria-selected", "true");
      expect(screen.getAllByText(/job-1/i).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole("button", { name: "Back to Alert Center" }));

    await waitFor(() => {
      expect(screen.getByRole("region", { name: "Alert detail" })).toHaveTextContent(/notifications retry loop/i);
      expect(screen.getByRole("button", { name: /notifications retry loop/i })).toHaveClass("active");
    });
  });

  it("falls back to default alert query when alert origin cannot be restored", async () => {
    window.location.hash = "#/queues/notifications?tab=failed&origin=alert";
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Back to Alert Center" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /Failed \(0\)/ })).toHaveAttribute("aria-selected", "true");
    });

    fireEvent.click(screen.getByRole("button", { name: "Back to Alert Center" }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Back to Alert Center" })).not.toBeInTheDocument();
      expect(screen.getByText("Alert Center")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Opinionated" })).toHaveClass("active");
      expect(screen.getByRole("combobox", { name: "Status" })).toHaveValue("all");
      expect(screen.getByRole("combobox", { name: "Source" })).toHaveValue("all");
    });
  });

  it("supports manual refresh", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText("notifications").length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole("button", { name: "Refresh now" }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledTimes(4);
    });
  });

  it("keeps raw mode lightweight until assisted layers are requested", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Live Queue Monitor")).toBeInTheDocument();
    });

    expect(globalThis.fetch).not.toHaveBeenCalledWith(expect.stringContaining("/demo/queues/patterns"), undefined);
    expect(globalThis.fetch).not.toHaveBeenCalledWith(expect.stringContaining("/demo/queues/incidents"), undefined);
    expect(globalThis.fetch).not.toHaveBeenCalledWith(expect.stringContaining("/demo/queues/alerts"), undefined);

    fireEvent.click(screen.getByRole("button", { name: "Pattern" }));

    await waitFor(() => {
      expect(screen.getByText("Incident Command Center")).toBeInTheDocument();
    });
  });

  it("opens a queue details page with status tabs", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText("notifications").length).toBeGreaterThan(0);
    });

    const openQueueButton = screen.getAllByRole("button", { name: "Open queue notifications" })[0];
    expect(openQueueButton).toBeDefined();
    if (!openQueueButton) {
      return;
    }
    fireEvent.click(openQueueButton);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Back to all queues" })).toBeInTheDocument();
      expect(screen.getByText("notifications", { selector: ".detail-queue-chip" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /Latest \(2\)/ })).toBeInTheDocument();
      expect(screen.getAllByText("Job details").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Data").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Config").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Error").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Replies").length).toBeGreaterThan(0);
      expect(screen.getAllByRole("button", { name: "Requeue" }).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole("tab", { name: /Completed \(1\)/ }));

    await waitFor(() => {
      expect(screen.getAllByText(/job-2/i).length).toBeGreaterThan(0);
    });
  });

  it("supports deep-link entry directly into queue detail", async () => {
    window.location.hash = "#/queues/notifications";
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Back to all queues" })).toBeInTheDocument();
      expect(screen.getByText("notifications", { selector: ".detail-queue-chip" })).toBeInTheDocument();
      expect(screen.queryByRole("navigation", { name: "Primary navigation" })).not.toBeInTheDocument();
    });
  });

  it("hides global nav in queue detail and restores list context on back", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText("notifications").length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole("button", { name: "Queues" }));
    const openQueueButton = screen.getAllByRole("button", { name: "Open queue notifications" })[0];
    expect(openQueueButton).toBeDefined();
    if (!openQueueButton) {
      return;
    }
    fireEvent.click(openQueueButton);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Back to all queues" })).toBeInTheDocument();
      expect(screen.queryByRole("navigation", { name: "Primary navigation" })).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Back to all queues" }));

    await waitFor(() => {
      expect(screen.getByRole("navigation", { name: "Primary navigation" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Queues" })).toHaveAttribute("aria-current", "page");
      const queueButtons = screen.getAllByRole("button", { name: "Open queue notifications" });
      expect(queueButtons.some((button) => button === document.activeElement)).toBe(true);
    });
  });

  it("preserves queue search state when switching assistance modes", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Live Queue Monitor")).toBeInTheDocument();
    });

    const queueSearch = screen.getByRole("textbox", { name: "Queue search" });
    fireEvent.change(queueSearch, { target: { value: "notif" } });
    expect(queueSearch).toHaveValue("notif");

    fireEvent.click(screen.getByRole("button", { name: "Pattern" }));

    await waitFor(() => {
      expect(screen.getByText("Pattern Signals (heuristic)")).toBeInTheDocument();
    });
    expect(screen.getByRole("textbox", { name: "Queue search" })).toHaveValue("notif");

    fireEvent.click(screen.getByRole("button", { name: "Opinionated" }));

    await waitFor(() => {
      expect(screen.getByText("Opinionated Triage Assistant")).toBeInTheDocument();
    });
    expect(screen.getByRole("textbox", { name: "Queue search" })).toHaveValue("notif");
  });

  it("submits queue actions from queue details", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText("notifications").length).toBeGreaterThan(0);
    });

    const openQueueButton = screen.getAllByRole("button", { name: "Open queue notifications" })[0];
    expect(openQueueButton).toBeDefined();
    if (!openQueueButton) {
      return;
    }
    fireEvent.click(openQueueButton);

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Requeue" }).length).toBeGreaterThan(0);
    });

    const firstRequeue = screen.getAllByRole("button", { name: "Requeue" })[0];
    expect(firstRequeue).toBeDefined();
    if (!firstRequeue) {
      return;
    }

    fireEvent.click(firstRequeue);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/demo/queues/notifications/jobs/job-1/actions"),
        expect.objectContaining({ method: "POST" })
      );
    });
  });
});
