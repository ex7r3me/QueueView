import { useCallback, useEffect, useMemo, useState } from "react";

interface ApiError {
  error?: string;
}

type DemoJobState = "waiting" | "active" | "completed" | "failed" | "retry_scheduled";
type QueueJobTab = "latest" | "active" | "completed" | "failed" | "waiting" | "retryScheduled";

interface DemoQueueSnapshot {
  enabled: boolean;
  updatedAt: string;
  queues: DemoQueueView[];
}

interface DemoQueueView {
  name: string;
  settings: {
    concurrency: number;
    enqueueEveryMs: number;
    processingMsMin: number;
    processingMsMax: number;
    failureRate: number;
    maxRetries: number;
    retryDelayMsMin: number;
    retryDelayMsMax: number;
  };
  stats: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    retryScheduled: number;
    retried: number;
    totalCreated: number;
    totalProcessed: number;
  };
  recentJobs: DemoQueueJob[];
}

interface DemoQueueDetail {
  enabled: boolean;
  updatedAt: string;
  queue: DemoQueueView;
  jobs: {
    latest: DemoQueueJob[];
    waiting: DemoQueueJob[];
    active: DemoQueueJob[];
    retryScheduled: DemoQueueJob[];
    completed: DemoQueueJob[];
    failed: DemoQueueJob[];
  };
}

interface DemoQueueJob {
  id: string;
  state: DemoJobState;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  lastError: string | null;
}

const REFRESH_INTERVAL_MS = 5000;
const QUEUE_HASH_PREFIX = "#/queues/";

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

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function queueNameFromHash(hash: string): string | null {
  if (!hash.startsWith(QUEUE_HASH_PREFIX)) {
    return null;
  }

  const encodedQueueName = hash.slice(QUEUE_HASH_PREFIX.length).trim();
  if (!encodedQueueName) {
    return null;
  }

  return decodeURIComponent(encodedQueueName);
}

function queueHash(queueName: string): string {
  return `${QUEUE_HASH_PREFIX}${encodeURIComponent(queueName)}`;
}

export function App() {
  const [snapshot, setSnapshot] = useState<DemoQueueSnapshot | null>(null);
  const [queueDetail, setQueueDetail] = useState<DemoQueueDetail | null>(null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<QueueJobTab>("latest");
  const [selectedQueueName, setSelectedQueueName] = useState<string | null>(() =>
    queueNameFromHash(window.location.hash)
  );

  const loadDemoQueues = useCallback(async () => {
    try {
      const payload = await apiRequest<DemoQueueSnapshot>("/demo/queues");
      setSnapshot(payload);

      if (selectedQueueName) {
        const detail = await apiRequest<DemoQueueDetail>(
          `/demo/queues/${encodeURIComponent(selectedQueueName)}`
        );
        setQueueDetail(detail);
      } else {
        setQueueDetail(null);
      }

      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load queue snapshot");
    }
  }, [selectedQueueName]);

  useEffect(() => {
    void loadDemoQueues();
  }, [loadDemoQueues]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadDemoQueues();
    }, REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [loadDemoQueues]);

  useEffect(() => {
    const onHashChange = () => {
      setSelectedQueueName(queueNameFromHash(window.location.hash));
    };

    window.addEventListener("hashchange", onHashChange);
    return () => {
      window.removeEventListener("hashchange", onHashChange);
    };
  }, []);

  useEffect(() => {
    setActiveTab("latest");
  }, [selectedQueueName]);

  const totalWaiting = useMemo(
    () => snapshot?.queues.reduce((sum, queue) => sum + queue.stats.waiting, 0) ?? 0,
    [snapshot]
  );

  const totalActive = useMemo(
    () => snapshot?.queues.reduce((sum, queue) => sum + queue.stats.active, 0) ?? 0,
    [snapshot]
  );

  const totalFailed = useMemo(
    () => snapshot?.queues.reduce((sum, queue) => sum + queue.stats.failed, 0) ?? 0,
    [snapshot]
  );

  const activeJobs = queueDetail
    ? {
        latest: queueDetail.jobs.latest,
        active: queueDetail.jobs.active,
        completed: queueDetail.jobs.completed,
        failed: queueDetail.jobs.failed,
        waiting: queueDetail.jobs.waiting,
        retryScheduled: queueDetail.jobs.retryScheduled
      }[activeTab]
    : [];

  return (
    <main className="app-shell">
      <header className="hero">
        <p className="eyebrow">QueueView</p>
        <h1>Live Queue Monitor</h1>
        <p className="subtitle">Single-pane, bullboard-style visibility for active job runners.</p>
      </header>

      {error ? (
        <p role="alert" className="banner error">
          {error}
        </p>
      ) : null}

      <section className="panel summary-panel">
        <div>
          <h2>Overview</h2>
          <p className="summary-copy">Auto-refresh every 5 seconds.</p>
        </div>
        <button type="button" className="ghost" onClick={() => void loadDemoQueues()}>
          Refresh now
        </button>
        {snapshot ? (
          <div className="overview-grid">
            <article>
              <p className="kpi-label">Queues</p>
              <p className="kpi-value">{snapshot.queues.length}</p>
            </article>
            <article>
              <p className="kpi-label">Waiting</p>
              <p className="kpi-value">{totalWaiting}</p>
            </article>
            <article>
              <p className="kpi-label">Active</p>
              <p className="kpi-value">{totalActive}</p>
            </article>
            <article>
              <p className="kpi-label">Failed</p>
              <p className="kpi-value">{totalFailed}</p>
            </article>
            <article>
              <p className="kpi-label">Updated</p>
              <p className="kpi-value small">{formatTimestamp(snapshot.updatedAt)}</p>
            </article>
          </div>
        ) : (
          <p>Loading queue snapshot...</p>
        )}
      </section>

      {snapshot && !snapshot.enabled ? (
        <section className="panel">
          <p>Demo queues are disabled. Set `DEMO_JOB_RUNNERS=true` to enable `/demo/queues`.</p>
        </section>
      ) : null}

      {snapshot?.enabled && !selectedQueueName ? (
        <section className="queue-board">
          {snapshot.queues.map((queue) => (
            <article key={queue.name} className="panel queue-card">
              <div className="panel-header">
                <h2>{queue.name}</h2>
                <span className="pill">c{queue.settings.concurrency}</span>
              </div>
              <p className="queue-meta">
                every {queue.settings.enqueueEveryMs}ms | proc {queue.settings.processingMsMin}-
                {queue.settings.processingMsMax}ms | fail {formatPercent(queue.settings.failureRate)} | retries{" "}
                {queue.settings.maxRetries}
              </p>

              <div className="stats-grid">
                <p>waiting: {queue.stats.waiting}</p>
                <p>active: {queue.stats.active}</p>
                <p>retry: {queue.stats.retryScheduled}</p>
                <p>done: {queue.stats.completed}</p>
                <p>failed: {queue.stats.failed}</p>
                <p>processed: {queue.stats.totalProcessed}</p>
              </div>

              <button type="button" className="ghost queue-nav" onClick={() => (window.location.hash = queueHash(queue.name))}>
                Open queue
              </button>
            </article>
          ))}
        </section>
      ) : null}

      {snapshot?.enabled && selectedQueueName ? (
        <section className="panel queue-detail">
          <div className="detail-header">
            <button type="button" className="ghost" onClick={() => (window.location.hash = "#/")}>
              Back to all queues
            </button>
            {queueDetail ? <p className="queue-meta">Updated {formatTimestamp(queueDetail.updatedAt)}</p> : null}
          </div>

          {queueDetail ? (
            <>
              <div className="panel-header">
                <h2>{queueDetail.queue.name}</h2>
                <span className="pill">c{queueDetail.queue.settings.concurrency}</span>
              </div>
              <p className="queue-meta">
                every {queueDetail.queue.settings.enqueueEveryMs}ms | proc{" "}
                {queueDetail.queue.settings.processingMsMin}-{queueDetail.queue.settings.processingMsMax}ms | fail{" "}
                {formatPercent(queueDetail.queue.settings.failureRate)} | retries{" "}
                {queueDetail.queue.settings.maxRetries}
              </p>

              <div className="stats-grid detail-stats">
                <p>waiting: {queueDetail.queue.stats.waiting}</p>
                <p>active: {queueDetail.queue.stats.active}</p>
                <p>retry: {queueDetail.queue.stats.retryScheduled}</p>
                <p>done: {queueDetail.queue.stats.completed}</p>
                <p>failed: {queueDetail.queue.stats.failed}</p>
                <p>processed: {queueDetail.queue.stats.totalProcessed}</p>
              </div>

              <nav className="tabs" aria-label="Queue job tabs">
                <button
                  type="button"
                  className={activeTab === "latest" ? "tab active" : "tab"}
                  onClick={() => setActiveTab("latest")}
                >
                  Latest ({queueDetail.jobs.latest.length})
                </button>
                <button
                  type="button"
                  className={activeTab === "active" ? "tab active" : "tab"}
                  onClick={() => setActiveTab("active")}
                >
                  Active ({queueDetail.jobs.active.length})
                </button>
                <button
                  type="button"
                  className={activeTab === "completed" ? "tab active" : "tab"}
                  onClick={() => setActiveTab("completed")}
                >
                  Completed ({queueDetail.jobs.completed.length})
                </button>
                <button
                  type="button"
                  className={activeTab === "failed" ? "tab active" : "tab"}
                  onClick={() => setActiveTab("failed")}
                >
                  Failed ({queueDetail.jobs.failed.length})
                </button>
                <button
                  type="button"
                  className={activeTab === "waiting" ? "tab active" : "tab"}
                  onClick={() => setActiveTab("waiting")}
                >
                  Waiting ({queueDetail.jobs.waiting.length})
                </button>
                <button
                  type="button"
                  className={activeTab === "retryScheduled" ? "tab active" : "tab"}
                  onClick={() => setActiveTab("retryScheduled")}
                >
                  Retry ({queueDetail.jobs.retryScheduled.length})
                </button>
              </nav>

              <h3>Jobs</h3>
              {activeJobs.length === 0 ? (
                <p className="queue-meta">No jobs in this category yet.</p>
              ) : (
                <ul className="job-list detail-job-list">
                  {activeJobs.map((job) => (
                    <li key={job.id} className="job-item">
                      <p>
                        {job.id} <strong>{job.state}</strong> ({job.attempts}/{job.maxAttempts})
                      </p>
                      <p className="queue-meta">
                        created {formatTimestamp(job.createdAt)}
                        {job.startedAt ? ` | started ${formatTimestamp(job.startedAt)}` : ""}
                        {job.finishedAt ? ` | finished ${formatTimestamp(job.finishedAt)}` : ""}
                      </p>
                      {job.lastError ? <p className="error-inline">{job.lastError}</p> : null}
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p>Loading queue details...</p>
          )}
        </section>
      ) : null}
    </main>
  );
}
