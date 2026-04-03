import { randomUUID } from "node:crypto";

export type DemoJobState = "waiting" | "active" | "completed" | "failed" | "retry_scheduled";

export interface DemoQueueSettings {
  concurrency: number;
  enqueueEveryMs: number;
  processingMsMin: number;
  processingMsMax: number;
  failureRate: number;
  maxRetries: number;
  retryDelayMsMin: number;
  retryDelayMsMax: number;
}

interface DemoQueueConfig {
  name: string;
  settings: DemoQueueSettings;
}

interface DemoJob {
  id: string;
  state: DemoJobState;
  createdAt: string;
  availableAt: number;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
}

interface DemoQueueRuntime {
  name: string;
  settings: DemoQueueSettings;
  jobs: DemoJob[];
  completed: number;
  failed: number;
  retried: number;
  totalCreated: number;
  totalProcessed: number;
  nextEnqueueAt: number;
}

export interface DemoQueueView {
  name: string;
  settings: DemoQueueSettings;
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
  recentJobs: Array<{
    id: string;
    state: DemoJobState;
    attempts: number;
    maxAttempts: number;
    createdAt: string;
    startedAt: string | null;
    finishedAt: string | null;
    lastError: string | null;
  }>;
}

export interface DemoQueueDetail {
  enabled: boolean;
  updatedAt: string;
  queue: DemoQueueView;
  jobs: {
    latest: DemoQueueJobView[];
    waiting: DemoQueueJobView[];
    active: DemoQueueJobView[];
    retryScheduled: DemoQueueJobView[];
    completed: DemoQueueJobView[];
    failed: DemoQueueJobView[];
  };
}

export interface DemoQueueJobView {
  id: string;
  state: DemoJobState;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  lastError: string | null;
}

export interface DemoQueuesSnapshot {
  enabled: boolean;
  updatedAt: string;
  queues: DemoQueueView[];
}

const DEFAULT_QUEUE_CONFIGS: DemoQueueConfig[] = [
  {
    name: "critical-emails",
    settings: {
      concurrency: 1,
      enqueueEveryMs: 1400,
      processingMsMin: 300,
      processingMsMax: 1600,
      failureRate: 0.28,
      maxRetries: 4,
      retryDelayMsMin: 400,
      retryDelayMsMax: 2400
    }
  },
  {
    name: "billing-sync",
    settings: {
      concurrency: 2,
      enqueueEveryMs: 1100,
      processingMsMin: 500,
      processingMsMax: 2200,
      failureRate: 0.22,
      maxRetries: 3,
      retryDelayMsMin: 300,
      retryDelayMsMax: 1800
    }
  },
  {
    name: "analytics-rollup",
    settings: {
      concurrency: 3,
      enqueueEveryMs: 700,
      processingMsMin: 200,
      processingMsMax: 900,
      failureRate: 0.12,
      maxRetries: 2,
      retryDelayMsMin: 250,
      retryDelayMsMax: 1400
    }
  },
  {
    name: "video-thumbnails",
    settings: {
      concurrency: 4,
      enqueueEveryMs: 550,
      processingMsMin: 800,
      processingMsMax: 2600,
      failureRate: 0.34,
      maxRetries: 1,
      retryDelayMsMin: 700,
      retryDelayMsMax: 2200
    }
  },
  {
    name: "notifications",
    settings: {
      concurrency: 6,
      enqueueEveryMs: 450,
      processingMsMin: 80,
      processingMsMax: 500,
      failureRate: 0.08,
      maxRetries: 2,
      retryDelayMsMin: 120,
      retryDelayMsMax: 900
    }
  }
];

const TICK_MS = 250;
const MAX_RECENT_JOBS_PER_QUEUE = 60;
const MAX_RETURNED_JOBS = 8;
const MAX_RETURNED_JOBS_PER_STATE = 30;

export class DemoQueueService {
  readonly #enabled: boolean;
  readonly #queues: DemoQueueRuntime[];
  #timer: NodeJS.Timeout | null = null;

  constructor(enabled: boolean) {
    this.#enabled = enabled;
    this.#queues = DEFAULT_QUEUE_CONFIGS.map((config) => ({
      name: config.name,
      settings: { ...config.settings },
      jobs: [],
      completed: 0,
      failed: 0,
      retried: 0,
      totalCreated: 0,
      totalProcessed: 0,
      nextEnqueueAt: Date.now() + randomInt(80, 520)
    }));
  }

  static initFromEnvironment(): DemoQueueService {
    const raw = process.env.DEMO_JOB_RUNNERS;
    const shouldEnable = raw
      ? ["1", "true", "yes", "on"].includes(raw.trim().toLowerCase())
      : process.env.NODE_ENV !== "production";

    const service = new DemoQueueService(shouldEnable);
    if (shouldEnable) {
      service.start();
    }

    return service;
  }

  start(): void {
    if (!this.#enabled || this.#timer) {
      return;
    }

    this.#timer = setInterval(() => {
      this.#tick();
    }, TICK_MS);
  }

  stop(): void {
    if (!this.#timer) {
      return;
    }

    clearInterval(this.#timer);
    this.#timer = null;
  }

  snapshot(): DemoQueuesSnapshot {
    return {
      enabled: this.#enabled,
      updatedAt: new Date().toISOString(),
      queues: this.#queues.map((queue) => this.#queueView(queue))
    };
  }

  queueDetail(queueName: string): DemoQueueDetail | null {
    const queue = this.#queues.find((candidate) => candidate.name === queueName);
    if (!queue) {
      return null;
    }

    const latest = this.#sortJobsByRecentTime(queue.jobs);
    const toView = (jobs: DemoJob[]): DemoQueueJobView[] =>
      jobs.slice(0, MAX_RETURNED_JOBS_PER_STATE).map((job) => this.#jobView(job));

    return {
      enabled: this.#enabled,
      updatedAt: new Date().toISOString(),
      queue: this.#queueView(queue),
      jobs: {
        latest: toView(latest),
        waiting: toView(latest.filter((job) => job.state === "waiting")),
        active: toView(latest.filter((job) => job.state === "active")),
        retryScheduled: toView(latest.filter((job) => job.state === "retry_scheduled")),
        completed: toView(latest.filter((job) => job.state === "completed")),
        failed: toView(latest.filter((job) => job.state === "failed"))
      }
    };
  }

  #queueView(queue: DemoQueueRuntime): DemoQueueView {
    const waiting = queue.jobs.filter((job) => job.state === "waiting").length;
    const active = queue.jobs.filter((job) => job.state === "active").length;
    const retryScheduled = queue.jobs.filter((job) => job.state === "retry_scheduled").length;

    const recentJobs = this.#sortJobsByRecentTime(queue.jobs).slice(0, MAX_RETURNED_JOBS).map((job) =>
      this.#jobView(job)
    );

    return {
      name: queue.name,
      settings: queue.settings,
      stats: {
        waiting,
        active,
        completed: queue.completed,
        failed: queue.failed,
        retryScheduled,
        retried: queue.retried,
        totalCreated: queue.totalCreated,
        totalProcessed: queue.totalProcessed
      },
      recentJobs
    };
  }

  #sortJobsByRecentTime(jobs: DemoJob[]): DemoJob[] {
    return [...jobs].sort((left, right) => {
      const leftTime = left.finishedAt ?? left.startedAt ?? left.createdAt;
      const rightTime = right.finishedAt ?? right.startedAt ?? right.createdAt;
      return rightTime.localeCompare(leftTime);
    });
  }

  #jobView(job: DemoJob): DemoQueueJobView {
    return {
      id: job.id,
      state: job.state,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      lastError: job.lastError
    };
  }

  #tick(): void {
    const now = Date.now();

    for (const queue of this.#queues) {
      this.#enqueueDueJobs(queue, now);
      this.#promoteDueRetries(queue, now);
      this.#completeFinishedJobs(queue, now);
      this.#startAvailableJobs(queue, now);
      this.#trimRecentJobs(queue);
    }
  }

  #enqueueDueJobs(queue: DemoQueueRuntime, now: number): void {
    while (now >= queue.nextEnqueueAt) {
      queue.jobs.push(createJob(now, queue.settings.maxRetries));
      queue.totalCreated += 1;
      queue.nextEnqueueAt += queue.settings.enqueueEveryMs;
    }
  }

  #promoteDueRetries(queue: DemoQueueRuntime, now: number): void {
    for (const job of queue.jobs) {
      if (job.state === "retry_scheduled" && now >= job.availableAt) {
        job.state = "waiting";
      }
    }
  }

  #completeFinishedJobs(queue: DemoQueueRuntime, now: number): void {
    for (const job of queue.jobs) {
      if (job.state !== "active" || now < job.availableAt) {
        continue;
      }

      queue.totalProcessed += 1;
      const failed = Math.random() < queue.settings.failureRate;
      if (!failed) {
        job.state = "completed";
        job.finishedAt = new Date(now).toISOString();
        job.lastError = null;
        queue.completed += 1;
        continue;
      }

      const hasRetriesLeft = job.attempts < job.maxAttempts;
      if (hasRetriesLeft) {
        job.attempts += 1;
        job.state = "retry_scheduled";
        job.finishedAt = new Date(now).toISOString();
        job.lastError = "Random worker failure";
        job.availableAt = now + randomInt(queue.settings.retryDelayMsMin, queue.settings.retryDelayMsMax);
        queue.retried += 1;
        continue;
      }

      job.state = "failed";
      job.finishedAt = new Date(now).toISOString();
      job.lastError = "Max retries exhausted";
      queue.failed += 1;
    }
  }

  #startAvailableJobs(queue: DemoQueueRuntime, now: number): void {
    const active = queue.jobs.filter((job) => job.state === "active").length;
    let availableSlots = Math.max(0, queue.settings.concurrency - active);

    if (availableSlots <= 0) {
      return;
    }

    const waitingJobs = queue.jobs
      .filter((job) => job.state === "waiting")
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));

    for (const job of waitingJobs) {
      if (availableSlots <= 0) {
        break;
      }

      job.state = "active";
      job.startedAt = new Date(now).toISOString();
      job.availableAt = now + randomInt(queue.settings.processingMsMin, queue.settings.processingMsMax);
      availableSlots -= 1;
    }
  }

  #trimRecentJobs(queue: DemoQueueRuntime): void {
    if (queue.jobs.length <= MAX_RECENT_JOBS_PER_QUEUE) {
      return;
    }

    queue.jobs = queue.jobs
      .slice()
      .sort((left, right) => {
        const leftPinned = left.state === "active" || left.state === "waiting" || left.state === "retry_scheduled";
        const rightPinned = right.state === "active" || right.state === "waiting" || right.state === "retry_scheduled";
        if (leftPinned !== rightPinned) {
          return leftPinned ? -1 : 1;
        }

        const leftTime = left.finishedAt ?? left.startedAt ?? left.createdAt;
        const rightTime = right.finishedAt ?? right.startedAt ?? right.createdAt;
        return rightTime.localeCompare(leftTime);
      })
      .slice(0, MAX_RECENT_JOBS_PER_QUEUE);
  }
}

function createJob(now: number, maxRetries: number): DemoJob {
  const createdAt = new Date(now).toISOString();
  return {
    id: randomUUID().slice(0, 8),
    state: "waiting",
    createdAt,
    availableAt: now,
    startedAt: null,
    finishedAt: null,
    durationMs: 0,
    attempts: 0,
    maxAttempts: maxRetries,
    lastError: null
  };
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
