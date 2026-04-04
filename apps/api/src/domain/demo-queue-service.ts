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
  data: Record<string, unknown>;
  config: {
    timeoutMs: number;
    removeOnComplete: boolean;
    priority: "low" | "normal" | "high";
    retryBackoffMs: number;
  };
  replies: Array<{
    at: string;
    message: string;
  }>;
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
  ops: {
    supportedActions: DemoQueueJobAction[];
    recentEvents: DemoQueueOperationEvent[];
    governance: DemoQueueGovernancePolicy;
  };
  jobs: {
    latest: DemoQueueJobView[];
    waiting: DemoQueueJobView[];
    active: DemoQueueJobView[];
    retryScheduled: DemoQueueJobView[];
    completed: DemoQueueJobView[];
    failed: DemoQueueJobView[];
  };
  alerts: {
    thresholds: DemoQueueAlertThresholds;
    active: DemoQueueAlertState[];
    lastNotification: DemoQueueAlertNotificationEvent | null;
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
  data: Record<string, unknown>;
  config: {
    timeoutMs: number;
    removeOnComplete: boolean;
    priority: "low" | "normal" | "high";
    retryBackoffMs: number;
  };
  replies: Array<{
    at: string;
    message: string;
  }>;
}

export interface DemoQueuesSnapshot {
  enabled: boolean;
  updatedAt: string;
  queues: DemoQueueView[];
}

export type DemoQueueSignalKind = "failure_cluster" | "retry_loop" | "lag_backlog_anomaly";
export type DemoQueueSignalSeverity = "low" | "medium" | "high";
export type DemoQueueHealthStatus = "healthy" | "watch" | "degraded" | "critical";

export interface DemoQueuePatternSignal {
  id: string;
  queueName: string;
  kind: DemoQueueSignalKind;
  severity: DemoQueueSignalSeverity;
  confidence: number;
  summary: string;
  evidence: {
    waiting: number;
    active: number;
    retryScheduled: number;
    failed: number;
    totalProcessed: number;
    failedJobIds: string[];
    retryScheduledJobIds: string[];
  };
  drilldown: {
    queueDetailPath: string;
    suggestedTab: "failed" | "retryScheduled" | "waiting";
  };
}

export interface DemoQueuePatternQueueSummary {
  queueName: string;
  incidentScore: number;
  health: {
    status: DemoQueueHealthStatus;
    confidence: number;
    reason: string;
  };
  signals: DemoQueuePatternSignal[];
}

export interface DemoQueuePatternSnapshot {
  enabled: boolean;
  updatedAt: string;
  queues: DemoQueuePatternQueueSummary[];
  topSignals: DemoQueuePatternSignal[];
}

export interface DemoQueueIncidentEntry {
  queueName: string;
  incidentScore: number;
  healthStatus: DemoQueueHealthStatus;
  healthReason: string;
  primarySignal: DemoQueuePatternSignal;
}

export interface DemoQueueIncident {
  id: string;
  title: string;
  severity: DemoQueueSignalSeverity;
  status: "active" | "monitoring";
  incidentScore: number;
  summary: string;
  signalKinds: DemoQueueSignalKind[];
  queues: DemoQueueIncidentEntry[];
}

export interface DemoQueueIncidentSnapshot {
  enabled: boolean;
  updatedAt: string;
  incidents: DemoQueueIncident[];
}

export interface DemoQueueAlertThresholds {
  failureClusterWarn: number;
  failureClusterCritical: number;
  retryLoopWarn: number;
  retryLoopCritical: number;
  lagBacklogWarn: number;
  lagBacklogCritical: number;
  minNotificationIntervalMs: number;
}

export interface DemoQueueAlertThresholdPatch {
  failureClusterWarn?: number;
  failureClusterCritical?: number;
  retryLoopWarn?: number;
  retryLoopCritical?: number;
  lagBacklogWarn?: number;
  lagBacklogCritical?: number;
  minNotificationIntervalMs?: number;
}

export interface DemoQueueAlertState {
  id: string;
  queueName: string;
  kind: DemoQueueSignalKind;
  status: "watch" | "triggered";
  severity: DemoQueueSignalSeverity;
  summary: string;
  triggeredAt: string;
  updatedAt: string;
  evidence: {
    waiting: number;
    active: number;
    retryScheduled: number;
    failed: number;
    totalProcessed: number;
  };
}

export interface DemoQueueAlertNotificationEvent {
  id: string;
  at: string;
  queueName: string;
  kind: DemoQueueSignalKind;
  severity: DemoQueueSignalSeverity;
  event: "triggered" | "escalated" | "resolved";
  message: string;
}

export interface DemoQueueAlertSnapshot {
  enabled: boolean;
  updatedAt: string;
  thresholds: DemoQueueAlertThresholds;
  active: DemoQueueAlertState[];
  notifications: DemoQueueAlertNotificationEvent[];
}

export type DemoQueueJobAction = "requeue" | "mark_failed" | "mark_completed";
export type DemoQueueActorRole = "viewer" | "operator" | "admin";
export type DemoQueueEnvironmentScope = "demo" | "staging" | "production";

export interface DemoQueueActionContext {
  actorId: string;
  actorRole: DemoQueueActorRole;
  environmentScope: DemoQueueEnvironmentScope;
  confirmationSatisfied: boolean;
}

export interface DemoQueueGovernancePolicy {
  actorId: string;
  actorRole: DemoQueueActorRole;
  environmentScope: DemoQueueEnvironmentScope;
  allowedActions: DemoQueueJobAction[];
  confirmationRequiredActions: DemoQueueJobAction[];
  blockedReason: string | null;
  policyVersion: string;
}

export interface DemoQueueOperationEvent {
  id: string;
  at: string;
  queueName: string;
  jobId: string;
  action: DemoQueueJobAction;
  fromState: DemoJobState;
  toState: DemoJobState;
  note: string;
  actorId: string;
  actorRole: DemoQueueActorRole;
  environmentScope: DemoQueueEnvironmentScope;
  confirmationSatisfied: boolean;
  policyVersion: string;
}

export interface DemoQueueOpsSnapshot {
  enabled: boolean;
  updatedAt: string;
  counters: Record<DemoQueueJobAction, number>;
  recentEvents: DemoQueueOperationEvent[];
}

export interface DemoQueueAuditSnapshot {
  enabled: boolean;
  updatedAt: string;
  totalEvents: number;
  recentEvents: DemoQueueOperationEvent[];
}

export interface DemoQueueActionResult {
  enabled: boolean;
  updatedAt: string;
  accepted: boolean;
  action: DemoQueueJobAction;
  queueName: string;
  reason: string | null;
  job: DemoQueueJobView | null;
  governance: DemoQueueGovernancePolicy;
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
const MAX_OPERATION_EVENTS = 120;
const MAX_ALERT_NOTIFICATION_EVENTS = 120;
const ALERT_TRIGGER_STREAK = 2;
const SUPPORTED_ACTIONS: DemoQueueJobAction[] = ["requeue", "mark_failed", "mark_completed"];

const DEFAULT_ALERT_THRESHOLDS: DemoQueueAlertThresholds = {
  failureClusterWarn: 3,
  failureClusterCritical: 8,
  retryLoopWarn: 2,
  retryLoopCritical: 5,
  lagBacklogWarn: 6,
  lagBacklogCritical: 12,
  minNotificationIntervalMs: 60_000
};

interface AlertRuntimeState {
  queueName: string;
  kind: DemoQueueSignalKind;
  severity: DemoQueueSignalSeverity | null;
  streak: number;
  status: "clear" | "watch" | "triggered";
  triggeredAt: string | null;
  updatedAt: string;
  lastNotifiedAt: number | null;
  evidence: {
    waiting: number;
    active: number;
    retryScheduled: number;
    failed: number;
    totalProcessed: number;
  };
}

export class DemoQueueService {
  readonly #enabled: boolean;
  readonly #queues: DemoQueueRuntime[];
  readonly #operationCounters: Record<DemoQueueJobAction, number>;
  #operationEvents: DemoQueueOperationEvent[] = [];
  #alertThresholds: DemoQueueAlertThresholds = { ...DEFAULT_ALERT_THRESHOLDS };
  #alertRuntimeStates: Map<string, AlertRuntimeState> = new Map();
  #alertNotifications: DemoQueueAlertNotificationEvent[] = [];
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
    this.#operationCounters = {
      requeue: 0,
      mark_failed: 0,
      mark_completed: 0
    };
    this.#refreshAlerts(Date.now());
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

  static defaultActionContext(): DemoQueueActionContext {
    return {
      actorId: "operator.local",
      actorRole: "operator",
      environmentScope: "demo",
      confirmationSatisfied: false
    };
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

  opsSnapshot(): DemoQueueOpsSnapshot {
    return {
      enabled: this.#enabled,
      updatedAt: new Date().toISOString(),
      counters: { ...this.#operationCounters },
      recentEvents: [...this.#operationEvents]
    };
  }

  auditSnapshot(): DemoQueueAuditSnapshot {
    return {
      enabled: this.#enabled,
      updatedAt: new Date().toISOString(),
      totalEvents: this.#operationEvents.length,
      recentEvents: [...this.#operationEvents]
    };
  }

  patternSnapshot(): DemoQueuePatternSnapshot {
    const queueSummaries = this.#queues.map((queue) => this.#queuePatternSummary(queue));
    const topSignals = queueSummaries
      .flatMap((summary) => summary.signals)
      .sort((left, right) => {
        const severityDelta = signalSeverityWeight(right.severity) - signalSeverityWeight(left.severity);
        if (severityDelta !== 0) {
          return severityDelta;
        }

        return right.confidence - left.confidence;
      })
      .slice(0, 12);

    return {
      enabled: this.#enabled,
      updatedAt: new Date().toISOString(),
      queues: queueSummaries.sort((left, right) => right.incidentScore - left.incidentScore),
      topSignals
    };
  }

  incidentSnapshot(): DemoQueueIncidentSnapshot {
    const queueSummaries = this.#queues.map((queue) => this.#queuePatternSummary(queue));
    const queueSummaryByName = new Map(queueSummaries.map((summary) => [summary.queueName, summary] as const));
    const signalsByKind = new Map<DemoQueueSignalKind, DemoQueuePatternSignal[]>();

    for (const summary of queueSummaries) {
      for (const signal of summary.signals) {
        const existing = signalsByKind.get(signal.kind);
        if (existing) {
          existing.push(signal);
          continue;
        }

        signalsByKind.set(signal.kind, [signal]);
      }
    }

    const incidents: DemoQueueIncident[] = [];
    const queueNamesInCrossQueueIncidents = new Set<string>();

    for (const [kind, groupedSignals] of signalsByKind.entries()) {
      const queueNames = new Set(groupedSignals.map((signal) => signal.queueName));
      if (queueNames.size < 2) {
        continue;
      }

      const incidentEntries = groupedSignals
        .map((signal) => {
          const queueSummary = queueSummaryByName.get(signal.queueName);
          if (!queueSummary) {
            return null;
          }

          queueNamesInCrossQueueIncidents.add(signal.queueName);
          return {
            queueName: signal.queueName,
            incidentScore: queueSummary.incidentScore,
            healthStatus: queueSummary.health.status,
            healthReason: queueSummary.health.reason,
            primarySignal: signal
          } satisfies DemoQueueIncidentEntry;
        })
        .filter((entry): entry is DemoQueueIncidentEntry => entry !== null)
        .sort((left, right) => right.incidentScore - left.incidentScore);

      const maxQueueScore = incidentEntries.reduce((max, entry) => Math.max(max, entry.incidentScore), 0);
      const maxSignalSeverity = groupedSignals.reduce(
        (max, signal) => Math.max(max, signalSeverityWeight(signal.severity)),
        1
      );
      const incidentSeverity = weightToSignalSeverity(maxSignalSeverity);
      const incidentScore = Math.round(maxQueueScore * 0.8 + maxSignalSeverity * 6);

      incidents.push({
        id: `cross-queue-${kind}`,
        title: `${signalKindLabel(kind)} detected across ${queueNames.size} queues`,
        severity: incidentSeverity,
        status: incidentSeverity === "high" ? "active" : "monitoring",
        incidentScore,
        summary: `Correlated ${signalKindLabel(kind)} signals require coordinated triage across multiple queues.`,
        signalKinds: [kind],
        queues: incidentEntries
      });
    }

    for (const summary of queueSummaries) {
      if (summary.incidentScore < 70 || queueNamesInCrossQueueIncidents.has(summary.queueName)) {
        continue;
      }

      const [primarySignal] = [...summary.signals].sort(
        (left, right) => signalSeverityWeight(right.severity) - signalSeverityWeight(left.severity)
      );
      if (!primarySignal) {
        continue;
      }

      incidents.push({
        id: `single-queue-${summary.queueName}`,
        title: `${summary.queueName} hotspot`,
        severity: primarySignal.severity,
        status: primarySignal.severity === "high" ? "active" : "monitoring",
        incidentScore: summary.incidentScore,
        summary: `Single-queue hotspot with elevated risk profile. Prioritize direct evidence review.`,
        signalKinds: [primarySignal.kind],
        queues: [
          {
            queueName: summary.queueName,
            incidentScore: summary.incidentScore,
            healthStatus: summary.health.status,
            healthReason: summary.health.reason,
            primarySignal
          }
        ]
      });
    }

    return {
      enabled: this.#enabled,
      updatedAt: new Date().toISOString(),
      incidents: incidents.sort((left, right) => right.incidentScore - left.incidentScore)
    };
  }

  alertsSnapshot(): DemoQueueAlertSnapshot {
    return {
      enabled: this.#enabled,
      updatedAt: new Date().toISOString(),
      thresholds: { ...this.#alertThresholds },
      active: [...this.#alertRuntimeStates.values()]
        .filter(
          (
            state
          ): state is AlertRuntimeState & {
            status: "watch" | "triggered";
            severity: DemoQueueSignalSeverity;
            triggeredAt: string;
          } => state.status !== "clear" && state.severity !== null && state.triggeredAt !== null
        )
        .map((state) => {
          const status: DemoQueueAlertState["status"] = state.status === "triggered" ? "triggered" : "watch";
          return {
            id: `${state.kind}-${state.queueName}`,
            queueName: state.queueName,
            kind: state.kind,
            status,
            severity: state.severity,
            summary: this.#alertSummary(state.kind, state.queueName, state.severity, state.evidence),
            triggeredAt: state.triggeredAt,
            updatedAt: state.updatedAt,
            evidence: { ...state.evidence }
          };
        })
        .sort((left, right) => {
          const severityDelta = signalSeverityWeight(right.severity) - signalSeverityWeight(left.severity);
          if (severityDelta !== 0) {
            return severityDelta;
          }

          return right.updatedAt.localeCompare(left.updatedAt);
        }),
      notifications: [...this.#alertNotifications]
    };
  }

  updateAlertThresholds(patch: DemoQueueAlertThresholdPatch): DemoQueueAlertSnapshot {
    const sanitizePair = (
      warnCandidate: number | undefined,
      criticalCandidate: number | undefined,
      currentWarn: number,
      currentCritical: number
    ): [number, number] => {
      const nextWarn = Number.isFinite(warnCandidate) ? Math.max(1, Math.round(warnCandidate as number)) : currentWarn;
      const nextCritical = Number.isFinite(criticalCandidate)
        ? Math.max(nextWarn, Math.round(criticalCandidate as number))
        : Math.max(nextWarn, currentCritical);
      return [nextWarn, nextCritical];
    };

    const [failureClusterWarn, failureClusterCritical] = sanitizePair(
      patch.failureClusterWarn,
      patch.failureClusterCritical,
      this.#alertThresholds.failureClusterWarn,
      this.#alertThresholds.failureClusterCritical
    );
    const [retryLoopWarn, retryLoopCritical] = sanitizePair(
      patch.retryLoopWarn,
      patch.retryLoopCritical,
      this.#alertThresholds.retryLoopWarn,
      this.#alertThresholds.retryLoopCritical
    );
    const [lagBacklogWarn, lagBacklogCritical] = sanitizePair(
      patch.lagBacklogWarn,
      patch.lagBacklogCritical,
      this.#alertThresholds.lagBacklogWarn,
      this.#alertThresholds.lagBacklogCritical
    );
    const minNotificationIntervalMs = Number.isFinite(patch.minNotificationIntervalMs)
      ? Math.max(5_000, Math.round(patch.minNotificationIntervalMs as number))
      : this.#alertThresholds.minNotificationIntervalMs;

    this.#alertThresholds = {
      failureClusterWarn,
      failureClusterCritical,
      retryLoopWarn,
      retryLoopCritical,
      lagBacklogWarn,
      lagBacklogCritical,
      minNotificationIntervalMs
    };

    this.#refreshAlerts(Date.now());
    return this.alertsSnapshot();
  }

  queueDetail(queueName: string, context: DemoQueueActionContext = DemoQueueService.defaultActionContext()): DemoQueueDetail | null {
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
      ops: {
        supportedActions: [...SUPPORTED_ACTIONS],
        recentEvents: this.#operationEvents.filter((event) => event.queueName === queueName).slice(0, 12),
        governance: this.governancePolicy(context)
      },
      jobs: {
        latest: toView(latest),
        waiting: toView(latest.filter((job) => job.state === "waiting")),
        active: toView(latest.filter((job) => job.state === "active")),
        retryScheduled: toView(latest.filter((job) => job.state === "retry_scheduled")),
        completed: toView(latest.filter((job) => job.state === "completed")),
        failed: toView(latest.filter((job) => job.state === "failed"))
      },
      alerts: {
        thresholds: { ...this.#alertThresholds },
        active: this.alertsSnapshot().active.filter((alert) => alert.queueName === queueName),
        lastNotification: this.#alertNotifications.find((event) => event.queueName === queueName) ?? null
      }
    };
  }

  applyJobAction(
    queueName: string,
    jobId: string,
    action: DemoQueueJobAction,
    context: DemoQueueActionContext = DemoQueueService.defaultActionContext()
  ): DemoQueueActionResult | null {
    const queue = this.#queues.find((candidate) => candidate.name === queueName);
    if (!queue) {
      return null;
    }

    const job = queue.jobs.find((candidate) => candidate.id === jobId);
    if (!job) {
      return null;
    }

    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const governance = this.governancePolicy(context);

    if (!this.#enabled) {
      return {
        enabled: this.#enabled,
        updatedAt: nowIso,
        accepted: false,
        action,
        queueName,
        reason: "Demo queue runners are disabled.",
        job: this.#jobView(job),
        governance
      };
    }

    if (governance.blockedReason) {
      return {
        enabled: this.#enabled,
        updatedAt: nowIso,
        accepted: false,
        action,
        queueName,
        reason: governance.blockedReason,
        job: this.#jobView(job),
        governance
      };
    }

    if (!governance.allowedActions.includes(action)) {
      return {
        enabled: this.#enabled,
        updatedAt: nowIso,
        accepted: false,
        action,
        queueName,
        reason: `Role ${governance.actorRole} is not permitted to ${action}.`,
        job: this.#jobView(job),
        governance
      };
    }

    if (governance.confirmationRequiredActions.includes(action) && !context.confirmationSatisfied) {
      return {
        enabled: this.#enabled,
        updatedAt: nowIso,
        accepted: false,
        action,
        queueName,
        reason: `Confirmation required before ${action}.`,
        job: this.#jobView(job),
        governance
      };
    }

    const fromState = job.state;
    const result = this.#applyActionToJob(job, action, nowIso, now);
    if (!result.accepted || result.toState === null) {
      return {
        enabled: this.#enabled,
        updatedAt: nowIso,
        accepted: false,
        action,
        queueName,
        reason: result.reason,
        job: this.#jobView(job),
        governance
      };
    }

    if (action === "mark_completed") {
      queue.completed += 1;
      queue.totalProcessed += 1;
    } else if (action === "mark_failed") {
      queue.failed += 1;
      queue.totalProcessed += 1;
    }

    this.#recordOperation({
      id: randomUUID().slice(0, 8),
      at: nowIso,
      queueName,
      jobId: job.id,
      action,
      fromState,
      toState: result.toState,
      note: result.reason,
      actorId: governance.actorId,
      actorRole: governance.actorRole,
      environmentScope: governance.environmentScope,
      confirmationSatisfied: context.confirmationSatisfied,
      policyVersion: governance.policyVersion
    });

    return {
      enabled: this.#enabled,
      updatedAt: nowIso,
      accepted: true,
      action,
      queueName,
      reason: result.reason,
      job: this.#jobView(job),
      governance
    };
  }

  governancePolicy(context: DemoQueueActionContext): DemoQueueGovernancePolicy {
    const sanitizedRole: DemoQueueActorRole = context.actorRole;
    const sanitizedScope: DemoQueueEnvironmentScope = context.environmentScope;
    const policyVersion = "2026-04-04.v1";
    const confirmationRequiredActions: DemoQueueJobAction[] = ["mark_failed", "mark_completed"];
    const blockedReason =
      sanitizedScope !== "demo"
        ? `Environment scope ${sanitizedScope} is read-only in demo mode.`
        : null;

    if (sanitizedRole === "viewer") {
      return {
        actorId: context.actorId,
        actorRole: sanitizedRole,
        environmentScope: sanitizedScope,
        allowedActions: [],
        confirmationRequiredActions,
        blockedReason,
        policyVersion
      };
    }

    if (sanitizedRole === "admin") {
      return {
        actorId: context.actorId,
        actorRole: sanitizedRole,
        environmentScope: sanitizedScope,
        allowedActions: [...SUPPORTED_ACTIONS],
        confirmationRequiredActions,
        blockedReason,
        policyVersion
      };
    }

    return {
      actorId: context.actorId,
      actorRole: sanitizedRole,
      environmentScope: sanitizedScope,
      allowedActions: ["requeue", "mark_completed"],
      confirmationRequiredActions,
      blockedReason,
      policyVersion
    };
  }

  #recordOperation(event: DemoQueueOperationEvent): void {
    this.#operationCounters[event.action] += 1;
    this.#operationEvents = [event, ...this.#operationEvents].slice(0, MAX_OPERATION_EVENTS);
  }

  #applyActionToJob(
    job: DemoJob,
    action: DemoQueueJobAction,
    nowIso: string,
    now: number
  ): { accepted: boolean; toState: DemoJobState | null; reason: string } {
    if (action === "requeue") {
      const fromState = job.state;
      if (fromState === "active") {
        return {
          accepted: false,
          toState: null,
          reason: "Cannot requeue while job is active."
        };
      }

      job.state = "waiting";
      job.startedAt = null;
      job.finishedAt = null;
      job.availableAt = now;
      job.lastError = null;
      if (job.attempts >= job.maxAttempts) {
        job.maxAttempts = job.attempts + 1;
      }
      job.replies.push({
        at: nowIso,
        message: "Operator requeued job"
      });

      return {
        accepted: true,
        toState: "waiting",
        reason: `Requeued from ${fromState}.`
      };
    }

    if (action === "mark_failed") {
      if (job.state === "failed") {
        return {
          accepted: false,
          toState: null,
          reason: "Job is already failed."
        };
      }

      if (job.state === "completed") {
        return {
          accepted: false,
          toState: null,
          reason: "Completed job cannot be marked failed."
        };
      }

      job.state = "failed";
      job.finishedAt = nowIso;
      job.availableAt = now;
      job.lastError = "Marked as failed by operator";
      job.replies.push({
        at: nowIso,
        message: "Operator marked job as failed"
      });

      return {
        accepted: true,
        toState: "failed",
        reason: "Marked as failed."
      };
    }

    if (action === "mark_completed") {
      if (job.state === "completed") {
        return {
          accepted: false,
          toState: null,
          reason: "Job is already completed."
        };
      }

      if (job.state === "failed") {
        return {
          accepted: false,
          toState: null,
          reason: "Failed job must be requeued before completion."
        };
      }

      job.state = "completed";
      job.finishedAt = nowIso;
      job.availableAt = now;
      job.lastError = null;
      job.replies.push({
        at: nowIso,
        message: "Operator marked job as completed"
      });

      return {
        accepted: true,
        toState: "completed",
        reason: "Marked as completed."
      };
    }

    return {
      accepted: false,
      toState: null,
      reason: "Unsupported action."
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
      lastError: job.lastError,
      data: job.data,
      config: job.config,
      replies: job.replies
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

    this.#refreshAlerts(now);
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
        job.replies.push({
          at: job.finishedAt,
          message: "Job completed successfully"
        });
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
        job.replies.push({
          at: job.finishedAt,
          message: `Attempt failed, retry #${job.attempts} scheduled`
        });
        queue.retried += 1;
        continue;
      }

      job.state = "failed";
      job.finishedAt = new Date(now).toISOString();
      job.lastError = "Max retries exhausted";
      job.replies.push({
        at: job.finishedAt,
        message: "Retries exhausted, job marked as failed"
      });
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
      job.replies.push({
        at: job.startedAt,
        message: `Worker started attempt ${job.attempts + 1}`
      });
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

  #refreshAlerts(now: number): void {
    const nowIso = new Date(now).toISOString();

    for (const queue of this.#queues) {
      const queueView = this.#queueView(queue);
      const evidence = {
        waiting: queueView.stats.waiting,
        active: queueView.stats.active,
        retryScheduled: queueView.stats.retryScheduled,
        failed: queueView.stats.failed,
        totalProcessed: queueView.stats.totalProcessed
      };
      const alertInputs: Array<{
        kind: DemoQueueSignalKind;
        metric: number;
        warnThreshold: number;
        criticalThreshold: number;
      }> = [
        {
          kind: "failure_cluster",
          metric: evidence.failed,
          warnThreshold: this.#alertThresholds.failureClusterWarn,
          criticalThreshold: this.#alertThresholds.failureClusterCritical
        },
        {
          kind: "retry_loop",
          metric: evidence.retryScheduled,
          warnThreshold: this.#alertThresholds.retryLoopWarn,
          criticalThreshold: this.#alertThresholds.retryLoopCritical
        },
        {
          kind: "lag_backlog_anomaly",
          metric: evidence.waiting,
          warnThreshold: this.#alertThresholds.lagBacklogWarn,
          criticalThreshold: this.#alertThresholds.lagBacklogCritical
        }
      ];

      for (const input of alertInputs) {
        const stateKey = `${queue.name}:${input.kind}`;
        const previousState = this.#alertRuntimeStates.get(stateKey);
        const severity = this.#severityForMetric(input.metric, input.warnThreshold, input.criticalThreshold);
        const streak = severity === null ? 0 : (previousState?.severity === severity ? previousState.streak + 1 : 1);
        const isTriggered = severity !== null && streak >= ALERT_TRIGGER_STREAK;
        const status: AlertRuntimeState["status"] =
          !isTriggered || severity === null ? "clear" : severity === "high" ? "triggered" : "watch";
        const triggeredAt = status === "clear" ? null : previousState?.triggeredAt ?? nowIso;

        const nextState: AlertRuntimeState = {
          queueName: queue.name,
          kind: input.kind,
          severity,
          streak,
          status,
          triggeredAt,
          updatedAt: nowIso,
          lastNotifiedAt: previousState?.lastNotifiedAt ?? null,
          evidence
        };

        const shouldNotify =
          status !== "clear" &&
          severity !== null &&
          (!previousState ||
            previousState.status === "clear" ||
            (previousState.severity !== null &&
              signalSeverityWeight(severity) > signalSeverityWeight(previousState.severity)));
        const withinInterval =
          nextState.lastNotifiedAt !== null &&
          now - nextState.lastNotifiedAt < this.#alertThresholds.minNotificationIntervalMs;

        if (shouldNotify && !withinInterval) {
          const event: DemoQueueAlertNotificationEvent["event"] =
            previousState?.status === "clear" || !previousState ? "triggered" : "escalated";

          this.#alertNotifications = [
            {
              id: randomUUID().slice(0, 8),
              at: nowIso,
              queueName: queue.name,
              kind: input.kind,
              severity,
              event,
              message: this.#alertSummary(input.kind, queue.name, severity, evidence)
            },
            ...this.#alertNotifications
          ].slice(0, MAX_ALERT_NOTIFICATION_EVENTS);
          nextState.lastNotifiedAt = now;
        }

        if (status === "clear" && previousState && previousState.status !== "clear" && previousState.severity !== null) {
          const resolvedWithinInterval =
            previousState.lastNotifiedAt !== null &&
            now - previousState.lastNotifiedAt < this.#alertThresholds.minNotificationIntervalMs;
          if (!resolvedWithinInterval) {
            this.#alertNotifications = [
              {
                id: randomUUID().slice(0, 8),
                at: nowIso,
                queueName: queue.name,
                kind: input.kind,
                severity: previousState.severity,
                event: "resolved" as const,
                message: `${queue.name} ${signalKindLabel(input.kind).toLowerCase()} alert recovered below threshold.`
              },
              ...this.#alertNotifications
            ].slice(0, MAX_ALERT_NOTIFICATION_EVENTS);
            nextState.lastNotifiedAt = now;
          }
        }

        this.#alertRuntimeStates.set(stateKey, nextState);
      }
    }
  }

  #severityForMetric(
    metric: number,
    warnThreshold: number,
    criticalThreshold: number
  ): DemoQueueSignalSeverity | null {
    if (metric >= criticalThreshold) {
      return "high";
    }
    if (metric >= warnThreshold) {
      return "medium";
    }
    return null;
  }

  #alertSummary(
    kind: DemoQueueSignalKind,
    queueName: string,
    severity: DemoQueueSignalSeverity,
    evidence: {
      waiting: number;
      active: number;
      retryScheduled: number;
      failed: number;
      totalProcessed: number;
    }
  ): string {
    if (kind === "failure_cluster") {
      return `${queueName} failure cluster at ${severity} severity: ${evidence.failed} failed jobs observed.`;
    }
    if (kind === "retry_loop") {
      return `${queueName} retry loop at ${severity} severity: ${evidence.retryScheduled} jobs in retry queue.`;
    }
    return `${queueName} backlog lag at ${severity} severity: ${evidence.waiting} waiting jobs vs ${evidence.active} active.`;
  }

  #queuePatternSummary(queue: DemoQueueRuntime): DemoQueuePatternQueueSummary {
    const queueView = this.#queueView(queue);
    const waiting = queueView.stats.waiting;
    const active = queueView.stats.active;
    const failed = queueView.stats.failed;
    const retryScheduled = queueView.stats.retryScheduled;
    const totalProcessed = Math.max(1, queueView.stats.totalProcessed);
    const failureRateObserved = failed / totalProcessed;
    const retryPressure = Math.min(1, (retryScheduled + queueView.stats.retried) / Math.max(1, queueView.stats.totalCreated));
    const backlogPressure = Math.min(1, waiting / Math.max(1, queueView.settings.concurrency * 3));
    const failurePressure = Math.min(1, failureRateObserved / 0.35);

    const incidentScore = Math.round((failurePressure * 0.45 + backlogPressure * 0.35 + retryPressure * 0.2) * 100);
    const confidence = clamp01(queueView.stats.totalCreated / 24);

    const recentFailedJobIds = queueView.recentJobs
      .filter((job) => job.state === "failed")
      .map((job) => job.id)
      .slice(0, 6);
    const recentRetryJobIds = queueView.recentJobs
      .filter((job) => job.state === "retry_scheduled")
      .map((job) => job.id)
      .slice(0, 6);

    const signals: DemoQueuePatternSignal[] = [];

    if (failed >= Math.max(2, Math.ceil(queueView.stats.totalProcessed * 0.12)) || recentFailedJobIds.length >= 2) {
      signals.push({
        id: `failure-cluster-${queue.name}`,
        queueName: queue.name,
        kind: "failure_cluster",
        severity: failed >= Math.max(8, queueView.settings.concurrency * 2) ? "high" : "medium",
        confidence,
        summary: `${failed} failed jobs with clustered failures in recent history.`,
        evidence: {
          waiting,
          active,
          retryScheduled,
          failed,
          totalProcessed: queueView.stats.totalProcessed,
          failedJobIds: recentFailedJobIds,
          retryScheduledJobIds: recentRetryJobIds
        },
        drilldown: {
          queueDetailPath: `#/queues/${encodeURIComponent(queue.name)}`,
          suggestedTab: "failed"
        }
      });
    }

    if (retryScheduled >= queueView.settings.concurrency || retryPressure >= 0.25) {
      signals.push({
        id: `retry-loop-${queue.name}`,
        queueName: queue.name,
        kind: "retry_loop",
        severity: retryScheduled >= queueView.settings.concurrency * 2 ? "high" : "medium",
        confidence,
        summary: `${retryScheduled} jobs are retry-scheduled with elevated retry pressure.`,
        evidence: {
          waiting,
          active,
          retryScheduled,
          failed,
          totalProcessed: queueView.stats.totalProcessed,
          failedJobIds: recentFailedJobIds,
          retryScheduledJobIds: recentRetryJobIds
        },
        drilldown: {
          queueDetailPath: `#/queues/${encodeURIComponent(queue.name)}`,
          suggestedTab: "retryScheduled"
        }
      });
    }

    if (waiting >= Math.max(5, queueView.settings.concurrency * 3) || (waiting > active * 4 && waiting >= 6)) {
      signals.push({
        id: `lag-backlog-${queue.name}`,
        queueName: queue.name,
        kind: "lag_backlog_anomaly",
        severity: waiting >= queueView.settings.concurrency * 5 ? "high" : "medium",
        confidence,
        summary: `Backlog pressure rising with ${waiting} waiting jobs against concurrency ${queueView.settings.concurrency}.`,
        evidence: {
          waiting,
          active,
          retryScheduled,
          failed,
          totalProcessed: queueView.stats.totalProcessed,
          failedJobIds: recentFailedJobIds,
          retryScheduledJobIds: recentRetryJobIds
        },
        drilldown: {
          queueDetailPath: `#/queues/${encodeURIComponent(queue.name)}`,
          suggestedTab: "waiting"
        }
      });
    }

    const healthStatus: DemoQueueHealthStatus =
      incidentScore >= 80 ? "critical" : incidentScore >= 60 ? "degraded" : incidentScore >= 35 ? "watch" : "healthy";
    const healthReason = topHealthReason({
      waiting,
      failed,
      retryScheduled,
      failureRateObserved
    });

    return {
      queueName: queue.name,
      incidentScore,
      health: {
        status: healthStatus,
        confidence,
        reason: healthReason
      },
      signals
    };
  }
}

function createJob(now: number, maxRetries: number): DemoJob {
  const timeoutMs = randomInt(1000, 12000);
  const retryBackoffMs = randomInt(150, 2500);
  const priorities = ["low", "normal", "high"] as const;
  const priority = priorities[randomInt(0, priorities.length - 1)] ?? "normal";
  const createdAt = new Date(now).toISOString();
  const jobId = randomUUID().slice(0, 8);
  return {
    id: jobId,
    state: "waiting",
    createdAt,
    availableAt: now,
    startedAt: null,
    finishedAt: null,
    durationMs: 0,
    attempts: 0,
    maxAttempts: maxRetries,
    lastError: null,
    data: {
      externalRef: `evt_${jobId}`,
      payloadVersion: 1,
      dryRun: Math.random() < 0.1
    },
    config: {
      timeoutMs,
      removeOnComplete: Math.random() < 0.5,
      priority,
      retryBackoffMs
    },
    replies: [
      {
        at: createdAt,
        message: "Job enqueued"
      }
    ]
  };
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp01(value: number): number {
  if (value < 0) {
    return 0;
  }

  if (value > 1) {
    return 1;
  }

  return value;
}

function signalSeverityWeight(severity: DemoQueueSignalSeverity): number {
  if (severity === "high") {
    return 3;
  }

  if (severity === "medium") {
    return 2;
  }

  return 1;
}

function weightToSignalSeverity(weight: number): DemoQueueSignalSeverity {
  if (weight >= 3) {
    return "high";
  }

  if (weight === 2) {
    return "medium";
  }

  return "low";
}

function signalKindLabel(kind: DemoQueueSignalKind): string {
  if (kind === "failure_cluster") {
    return "Failure clusters";
  }

  if (kind === "retry_loop") {
    return "Retry loops";
  }

  return "Backlog anomalies";
}

function topHealthReason(input: {
  waiting: number;
  failed: number;
  retryScheduled: number;
  failureRateObserved: number;
}): string {
  const { waiting, failed, retryScheduled, failureRateObserved } = input;
  if (failed > 0 && failureRateObserved >= 0.2) {
    return `Failure pressure is elevated (${Math.round(failureRateObserved * 100)}% observed failure rate).`;
  }

  if (retryScheduled > 0) {
    return `Retry pressure is elevated with ${retryScheduled} jobs scheduled for retry.`;
  }

  if (waiting > 0) {
    return `Backlog pressure detected with ${waiting} waiting jobs.`;
  }

  return "No material reliability anomalies detected in current snapshot.";
}
