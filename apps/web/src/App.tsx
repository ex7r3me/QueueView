import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface ApiError {
  error?: string;
}

type DemoJobState = "waiting" | "active" | "completed" | "failed" | "retry_scheduled";
type QueueJobTab = "latest" | "active" | "completed" | "failed" | "waiting" | "retryScheduled";
type PrimaryView = "overview" | "queues" | "failures";
type ExperienceLayer = "raw" | "pattern" | "opinionated";
type DemoQueueJobAction = "requeue" | "mark_failed" | "mark_completed";
type DemoQueueActorRole = "viewer" | "operator" | "admin";
type DemoQueueEnvironmentScope = "demo" | "staging" | "production";

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
  ops: {
    supportedActions: DemoQueueJobAction[];
    recentEvents: DemoQueueOperationEvent[];
    governance: DemoQueueGovernancePolicy;
  };
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

interface DemoQueueOperationEvent {
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

interface DemoQueueOpsSnapshot {
  enabled: boolean;
  updatedAt: string;
  counters: Record<DemoQueueJobAction, number>;
  recentEvents: DemoQueueOperationEvent[];
}

interface DemoQueueAuditSnapshot {
  enabled: boolean;
  updatedAt: string;
  totalEvents: number;
  recentEvents: DemoQueueOperationEvent[];
}

interface DemoQueueGovernancePolicy {
  actorId: string;
  actorRole: DemoQueueActorRole;
  environmentScope: DemoQueueEnvironmentScope;
  allowedActions: DemoQueueJobAction[];
  confirmationRequiredActions: DemoQueueJobAction[];
  blockedReason: string | null;
  policyVersion: string;
}

type PatternSignalKind = "failure_cluster" | "retry_loop" | "lag_backlog_anomaly";

interface DemoQueuePatternSignal {
  id: string;
  queueName: string;
  kind: PatternSignalKind;
  severity: "low" | "medium" | "high";
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

interface DemoQueuePatternQueueSummary {
  queueName: string;
  incidentScore: number;
  health: {
    status: "healthy" | "watch" | "degraded" | "critical";
    confidence: number;
    reason: string;
  };
  signals: DemoQueuePatternSignal[];
}

interface DemoQueuePatternSnapshot {
  enabled: boolean;
  updatedAt: string;
  queues: DemoQueuePatternQueueSummary[];
  topSignals: DemoQueuePatternSignal[];
}

type IncidentStatus = "active" | "monitoring";
type IncidentSeverityFilter = "all" | "high" | "medium" | "low";
type IncidentStatusFilter = "all" | IncidentStatus;

interface DemoQueueIncident {
  id: string;
  title: string;
  severity: "low" | "medium" | "high";
  status: IncidentStatus;
  incidentScore: number;
  summary: string;
  signalKinds: PatternSignalKind[];
  queues: Array<{
    queueName: string;
    incidentScore: number;
    healthStatus: "healthy" | "watch" | "degraded" | "critical";
    healthReason: string;
    primarySignal: DemoQueuePatternSignal;
  }>;
}

interface DemoQueueIncidentSnapshot {
  enabled: boolean;
  updatedAt: string;
  incidents: DemoQueueIncident[];
}

interface DemoQueueAlertThresholds {
  failureClusterWarn: number;
  failureClusterCritical: number;
  retryLoopWarn: number;
  retryLoopCritical: number;
  lagBacklogWarn: number;
  lagBacklogCritical: number;
  minNotificationIntervalMs: number;
}

interface DemoQueueAlertState {
  id: string;
  queueName: string;
  kind: PatternSignalKind;
  status: "watch" | "triggered";
  severity: "critical" | "high" | "medium" | "low";
  summary: string;
  triggeredAt: string;
  updatedAt: string;
}

interface DemoQueueAlertNotification {
  id: string;
  at: string;
  queueName: string;
  kind: PatternSignalKind;
  severity: "critical" | "high" | "medium" | "low";
  event: "triggered" | "escalated" | "resolved";
  message: string;
}

interface DemoQueueAlertSnapshot {
  enabled: boolean;
  updatedAt: string;
  thresholds: DemoQueueAlertThresholds;
  active: DemoQueueAlertState[];
  notifications: DemoQueueAlertNotification[];
}

interface DemoQueueActionResult {
  enabled: boolean;
  updatedAt: string;
  accepted: boolean;
  action: DemoQueueJobAction;
  queueName: string;
  reason: string | null;
  job: DemoQueueJob | null;
  governance: DemoQueueGovernancePolicy;
}

type AlertSeverity = "critical" | "high" | "medium" | "low";
type AlertWorkflowState = "new" | "acknowledged" | "muted" | "resolved" | "failed_delivery";
type AlertStatusFilter = "all" | AlertWorkflowState;
type AlertSourceFilter = "all" | PatternSignalKind;
type AlertOwnerFilter = "all" | "unassigned" | "me";
type AlertTimeFilter = "all" | "1h" | "24h" | "7d";
type AlertLayoutMode = "desktop" | "tablet" | "mobile";

interface AlertOwnerMetadata {
  ownerId: string;
  ownerRole: DemoQueueActorRole;
  acknowledgedAt: string;
}

interface AlertWorkflowItem {
  id: string;
  queueName: string;
  kind: PatternSignalKind;
  severity: AlertSeverity;
  summary: string;
  triggeredAt: string;
  updatedAt: string;
  state: AlertWorkflowState;
  owner: AlertOwnerMetadata | null;
  muteReason: string;
  muteUntil: string;
  resolutionNote: string;
  lastDeliveryRetryAt: string | null;
}

const REFRESH_INTERVAL_MS = 5000;
const QUEUE_HASH_PREFIX = "#/queues/";
const UI_STATE_STORAGE_KEY = "queueview.ui-state.v1";
const UI_STATE_SCHEMA_VERSION = 2;
const CONTEXT_STALE_WARNING_MS = 24 * 60 * 60 * 1000;
const CONTEXT_EXPIRED_MS = 72 * 60 * 60 * 1000;
const ALERT_OWNER_ID = "web.operator";
const ALERT_MOBILE_MAX_WIDTH = 767;
const ALERT_TABLET_MAX_WIDTH = 1023;

const PRIMARY_VIEWS: PrimaryView[] = ["overview", "queues", "failures"];
const EXPERIENCE_LAYERS: ExperienceLayer[] = ["raw", "pattern", "opinionated"];
const QUEUE_JOB_TABS: QueueJobTab[] = ["latest", "active", "completed", "failed", "waiting", "retryScheduled"];
const ACTOR_ROLES: DemoQueueActorRole[] = ["viewer", "operator", "admin"];
const ENVIRONMENT_SCOPES: DemoQueueEnvironmentScope[] = ["demo", "staging", "production"];
const INCIDENT_SEVERITY_FILTERS: IncidentSeverityFilter[] = ["all", "high", "medium", "low"];
const INCIDENT_STATUS_FILTERS: IncidentStatusFilter[] = ["all", "active", "monitoring"];
const ALERT_STATUS_FILTERS: AlertStatusFilter[] = ["all", "new", "acknowledged", "muted", "resolved", "failed_delivery"];
const ALERT_SOURCE_FILTERS: AlertSourceFilter[] = ["all", "failure_cluster", "retry_loop", "lag_backlog_anomaly"];
const ALERT_OWNER_FILTERS: AlertOwnerFilter[] = ["all", "unassigned", "me"];
const ALERT_TIME_FILTERS: AlertTimeFilter[] = ["all", "1h", "24h", "7d"];
const ALERT_SEVERITY_RANK: Record<AlertSeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1
};
const ALERT_STATE_TRANSITIONS: Record<AlertWorkflowState, AlertWorkflowState[]> = {
  new: ["acknowledged", "muted", "resolved", "failed_delivery"],
  acknowledged: ["muted", "resolved", "failed_delivery"],
  muted: ["acknowledged", "resolved", "failed_delivery"],
  resolved: [],
  failed_delivery: ["acknowledged", "muted", "resolved"]
};

interface RecommendationTemplate {
  diagnosis: string;
  nextAction: string;
  playbook: string[];
}

interface RestoreBannerState {
  tone: "info" | "warning";
  message: string;
  canRetry: boolean;
}

interface PersistedUiState {
  primaryView: PrimaryView;
  experienceLayer: ExperienceLayer;
  queueQuery: string;
  incidentQuery: string;
  incidentSeverityFilter: IncidentSeverityFilter;
  incidentStatusFilter: IncidentStatusFilter;
  activeTab: QueueJobTab;
  actorRole: DemoQueueActorRole;
  environmentScope: DemoQueueEnvironmentScope;
  alertStatusFilter: AlertStatusFilter;
  alertSourceFilter: AlertSourceFilter;
  alertOwnerFilter: AlertOwnerFilter;
  alertTimeFilter: AlertTimeFilter;
  selectedAlertId: string | null;
}

interface PersistedUiSnapshot extends PersistedUiState {
  schemaVersion: number;
  savedAt: string;
  queueSelection: string | null;
}

interface PersistedUiReadResult {
  state: PersistedUiState;
  savedQueueSelection: string | null;
  hasSnapshot: boolean;
  ageMs: number | null;
  invalidPayload: boolean;
}

interface HashRouteState {
  queueName: string | null;
  tab: QueueJobTab | null;
  origin: "alert" | null;
  alertId: string | null;
  hasExplicitQueue: boolean;
  hasExplicitTab: boolean;
}

const DEFAULT_UI_STATE: PersistedUiState = {
  primaryView: "overview",
  experienceLayer: "raw",
  queueQuery: "",
  incidentQuery: "",
  incidentSeverityFilter: "all",
  incidentStatusFilter: "all",
  activeTab: "latest",
  actorRole: "operator",
  environmentScope: "demo",
  alertStatusFilter: "all",
  alertSourceFilter: "all",
  alertOwnerFilter: "all",
  alertTimeFilter: "all",
  selectedAlertId: null
};

function normalizePersistedUiState(
  parsed: { [K in keyof PersistedUiState]?: PersistedUiState[K] | undefined }
): PersistedUiState {
  return {
    primaryView: PRIMARY_VIEWS.includes(parsed.primaryView as PrimaryView) ? (parsed.primaryView as PrimaryView) : DEFAULT_UI_STATE.primaryView,
    experienceLayer: EXPERIENCE_LAYERS.includes(parsed.experienceLayer as ExperienceLayer)
      ? (parsed.experienceLayer as ExperienceLayer)
      : DEFAULT_UI_STATE.experienceLayer,
    queueQuery: typeof parsed.queueQuery === "string" ? parsed.queueQuery : DEFAULT_UI_STATE.queueQuery,
    incidentQuery: typeof parsed.incidentQuery === "string" ? parsed.incidentQuery : DEFAULT_UI_STATE.incidentQuery,
    incidentSeverityFilter: INCIDENT_SEVERITY_FILTERS.includes(parsed.incidentSeverityFilter as IncidentSeverityFilter)
      ? (parsed.incidentSeverityFilter as IncidentSeverityFilter)
      : DEFAULT_UI_STATE.incidentSeverityFilter,
    incidentStatusFilter: INCIDENT_STATUS_FILTERS.includes(parsed.incidentStatusFilter as IncidentStatusFilter)
      ? (parsed.incidentStatusFilter as IncidentStatusFilter)
      : DEFAULT_UI_STATE.incidentStatusFilter,
    activeTab: QUEUE_JOB_TABS.includes(parsed.activeTab as QueueJobTab) ? (parsed.activeTab as QueueJobTab) : DEFAULT_UI_STATE.activeTab,
    actorRole: ACTOR_ROLES.includes(parsed.actorRole as DemoQueueActorRole) ? (parsed.actorRole as DemoQueueActorRole) : DEFAULT_UI_STATE.actorRole,
    environmentScope: ENVIRONMENT_SCOPES.includes(parsed.environmentScope as DemoQueueEnvironmentScope)
      ? (parsed.environmentScope as DemoQueueEnvironmentScope)
      : DEFAULT_UI_STATE.environmentScope,
    alertStatusFilter: ALERT_STATUS_FILTERS.includes(parsed.alertStatusFilter as AlertStatusFilter)
      ? (parsed.alertStatusFilter as AlertStatusFilter)
      : DEFAULT_UI_STATE.alertStatusFilter,
    alertSourceFilter: ALERT_SOURCE_FILTERS.includes(parsed.alertSourceFilter as AlertSourceFilter)
      ? (parsed.alertSourceFilter as AlertSourceFilter)
      : DEFAULT_UI_STATE.alertSourceFilter,
    alertOwnerFilter: ALERT_OWNER_FILTERS.includes(parsed.alertOwnerFilter as AlertOwnerFilter)
      ? (parsed.alertOwnerFilter as AlertOwnerFilter)
      : DEFAULT_UI_STATE.alertOwnerFilter,
    alertTimeFilter: ALERT_TIME_FILTERS.includes(parsed.alertTimeFilter as AlertTimeFilter)
      ? (parsed.alertTimeFilter as AlertTimeFilter)
      : DEFAULT_UI_STATE.alertTimeFilter,
    selectedAlertId: typeof parsed.selectedAlertId === "string" ? parsed.selectedAlertId : null
  };
}

function readPersistedUiState(): PersistedUiReadResult {
  try {
    const raw = window.localStorage.getItem(UI_STATE_STORAGE_KEY);
    if (!raw) {
      return {
        state: DEFAULT_UI_STATE,
        savedQueueSelection: null,
        hasSnapshot: false,
        ageMs: null,
        invalidPayload: false
      };
    }

    const parsed = JSON.parse(raw) as
      | (Partial<PersistedUiSnapshot> & { activeSection?: PrimaryView; viewMode?: ExperienceLayer; jobTab?: QueueJobTab })
      | Partial<PersistedUiState>;
    const normalized = normalizePersistedUiState({
      ...parsed,
      primaryView:
        (parsed as { activeSection?: PrimaryView }).activeSection !== undefined
          ? (parsed as { activeSection?: PrimaryView }).activeSection
          : parsed.primaryView,
      experienceLayer:
        (parsed as { viewMode?: ExperienceLayer }).viewMode !== undefined
          ? (parsed as { viewMode?: ExperienceLayer }).viewMode
          : parsed.experienceLayer,
      activeTab:
        (parsed as { jobTab?: QueueJobTab }).jobTab !== undefined
          ? (parsed as { jobTab?: QueueJobTab }).jobTab
          : parsed.activeTab
    });
    const parsedSnapshot = parsed as Partial<PersistedUiSnapshot>;
    const savedQueueSelection = typeof parsedSnapshot.queueSelection === "string"
      ? parsedSnapshot.queueSelection
      : null;
    const savedAt = typeof (parsed as Partial<PersistedUiSnapshot>).savedAt === "string"
      ? Date.parse((parsed as Partial<PersistedUiSnapshot>).savedAt ?? "")
      : Number.NaN;
    const ageMs = Number.isFinite(savedAt) ? Math.max(0, Date.now() - savedAt) : null;
    const hasSnapshot =
      typeof (parsed as Partial<PersistedUiSnapshot>).savedAt === "string" ||
      typeof parsed.primaryView === "string" ||
      typeof (parsed as { activeSection?: string }).activeSection === "string";

    return {
      state: normalized,
      savedQueueSelection,
      hasSnapshot,
      ageMs,
      invalidPayload: hasSnapshot && (parsed as Partial<PersistedUiSnapshot>).schemaVersion !== undefined &&
        (parsed as Partial<PersistedUiSnapshot>).schemaVersion !== UI_STATE_SCHEMA_VERSION
    };
  } catch {
    return {
      state: DEFAULT_UI_STATE,
      savedQueueSelection: null,
      hasSnapshot: false,
      ageMs: null,
      invalidPayload: true
    };
  }
}

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

function isFeatureEnabled(rawValue: string | undefined, defaultValue: boolean): boolean {
  if (rawValue === undefined) {
    return defaultValue;
  }
  const normalized = rawValue.trim().toLowerCase();
  if (["0", "false", "off", "no"].includes(normalized)) {
    return false;
  }
  if (["1", "true", "on", "yes"].includes(normalized)) {
    return true;
  }
  return defaultValue;
}

function parseHashRouteState(hash: string): HashRouteState {
  if (!hash.startsWith(QUEUE_HASH_PREFIX)) {
    return {
      queueName: null,
      tab: null,
      origin: null,
      alertId: null,
      hasExplicitQueue: false,
      hasExplicitTab: false
    };
  }

  const route = hash.slice(QUEUE_HASH_PREFIX.length).trim();
  if (!route) {
    return {
      queueName: null,
      tab: null,
      origin: null,
      alertId: null,
      hasExplicitQueue: false,
      hasExplicitTab: false
    };
  }

  const [encodedQueueName, queryString] = route.split("?", 2);
  const queueName = decodeURIComponent(encodedQueueName ?? "");
  if (!queueName) {
    return {
      queueName: null,
      tab: null,
      origin: null,
      alertId: null,
      hasExplicitQueue: false,
      hasExplicitTab: false
    };
  }

  const params = new URLSearchParams(queryString ?? "");
  const tabCandidate = params.get("tab");
  const tab = QUEUE_JOB_TABS.includes(tabCandidate as QueueJobTab) ? (tabCandidate as QueueJobTab) : null;
  const origin = params.get("origin") === "alert" ? "alert" : null;
  const alertId = origin === "alert" ? params.get("alertId") : null;

  return {
    queueName,
    tab,
    origin,
    alertId,
    hasExplicitQueue: true,
    hasExplicitTab: tab !== null
  };
}

function queueHash(queueName: string, tab?: QueueJobTab, origin?: "alert", alertId?: string): string {
  const base = `${QUEUE_HASH_PREFIX}${encodeURIComponent(queueName)}`;
  const params = new URLSearchParams();
  if (tab) {
    params.set("tab", tab);
  }
  if (origin) {
    params.set("origin", origin);
  }
  if (origin === "alert" && alertId) {
    params.set("alertId", alertId);
  }

  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

function queueTabForJobState(state: DemoJobState): QueueJobTab {
  if (state === "retry_scheduled") {
    return "retryScheduled";
  }
  return state;
}

function preferredAlertJobStates(kind: PatternSignalKind): DemoJobState[] {
  if (kind === "failure_cluster") {
    return ["failed", "retry_scheduled", "active", "waiting", "completed"];
  }
  if (kind === "retry_loop") {
    return ["retry_scheduled", "active", "failed", "waiting", "completed"];
  }
  return ["waiting", "active", "retry_scheduled", "failed", "completed"];
}

function signalKindLabel(kind: PatternSignalKind): string {
  if (kind === "failure_cluster") {
    return "failure cluster";
  }
  if (kind === "retry_loop") {
    return "retry loop";
  }
  return "lag/backlog anomaly";
}

function canTransitionAlertState(from: AlertWorkflowState, to: AlertWorkflowState): boolean {
  return ALERT_STATE_TRANSITIONS[from].includes(to);
}

function isAlertInTimeWindow(iso: string, filter: AlertTimeFilter): boolean {
  if (filter === "all") {
    return true;
  }

  const triggeredAt = Date.parse(iso);
  if (!Number.isFinite(triggeredAt)) {
    return false;
  }

  const elapsed = Date.now() - triggeredAt;
  if (filter === "1h") {
    return elapsed <= 60 * 60 * 1000;
  }
  if (filter === "24h") {
    return elapsed <= 24 * 60 * 60 * 1000;
  }
  return elapsed <= 7 * 24 * 60 * 60 * 1000;
}

function toDateTimeLocalInputValue(iso: string): string {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) {
    return "";
  }

  const date = new Date(parsed);
  const pad = (value: number) => String(value).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function recommendationTemplate(signal: DemoQueuePatternSignal): RecommendationTemplate {
  if (signal.kind === "failure_cluster") {
    return {
      diagnosis: "Failure cluster detected with concentrated failed jobs.",
      nextAction: "Start with failed jobs and validate a single canary requeue before bulk actions.",
      playbook: [
        "Open Failed jobs and sample the top 3 errors.",
        "Confirm whether recent deploy/config changes correlate with failures.",
        "Requeue a narrow subset only after error pattern validation."
      ]
    };
  }

  if (signal.kind === "retry_loop") {
    return {
      diagnosis: "Retry pressure suggests jobs are cycling without resolution.",
      nextAction: "Inspect retry-scheduled jobs first, then decide whether to pause intake.",
      playbook: [
        "Open Retry tab and inspect attempt counts and last errors.",
        "Check dependency health before manual retries.",
        "Escalate if retries continue to grow over two refresh windows."
      ]
    };
  }

  return {
    diagnosis: "Backlog growth indicates throughput lag versus intake.",
    nextAction: "Inspect waiting jobs and confirm worker throughput capacity.",
    playbook: [
      "Open Waiting tab and identify oldest queued jobs.",
      "Validate active worker count and processing latency.",
      "Prioritize high-value jobs while stabilization is in progress."
    ]
  };
}

export function App() {
  const [persistedUiState] = useState<PersistedUiReadResult>(readPersistedUiState);
  const alertCenterEnabled = isFeatureEnabled(import.meta.env.VITE_ALERT_CENTER_ENABLED, true);
  const [initialRouteState] = useState<HashRouteState>(() => parseHashRouteState(window.location.hash));
  const initialSelectedQueueName =
    initialRouteState.queueName ??
    (initialRouteState.hasExplicitQueue ||
    !persistedUiState.savedQueueSelection ||
    (persistedUiState.ageMs !== null && persistedUiState.ageMs >= CONTEXT_EXPIRED_MS)
      ? null
      : persistedUiState.savedQueueSelection);
  const initialActiveTab = initialRouteState.tab ?? persistedUiState.state.activeTab;
  const [snapshot, setSnapshot] = useState<DemoQueueSnapshot | null>(null);
  const [opsSnapshot, setOpsSnapshot] = useState<DemoQueueOpsSnapshot | null>(null);
  const [patternSnapshot, setPatternSnapshot] = useState<DemoQueuePatternSnapshot | null>(null);
  const [incidentSnapshot, setIncidentSnapshot] = useState<DemoQueueIncidentSnapshot | null>(null);
  const [alertSnapshot, setAlertSnapshot] = useState<DemoQueueAlertSnapshot | null>(null);
  const [auditSnapshot, setAuditSnapshot] = useState<DemoQueueAuditSnapshot | null>(null);
  const [queueDetail, setQueueDetail] = useState<DemoQueueDetail | null>(null);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [restoreBanner, setRestoreBanner] = useState<RestoreBannerState | null>(() => {
    if (persistedUiState.invalidPayload) {
      return {
        tone: "warning",
        message: "Saved triage context was invalid and defaults were applied.",
        canRetry: false
      };
    }
    if (!persistedUiState.hasSnapshot) {
      return {
        tone: "info",
        message: "No saved triage context found. Starting fresh.",
        canRetry: false
      };
    }
    if (
      persistedUiState.ageMs !== null &&
      persistedUiState.ageMs >= CONTEXT_EXPIRED_MS &&
      persistedUiState.savedQueueSelection &&
      !initialRouteState.hasExplicitQueue
    ) {
      return {
        tone: "warning",
        message: "Saved context from 3+ days ago was partially applied to avoid stale detail data.",
        canRetry: false
      };
    }
    if (persistedUiState.ageMs !== null && persistedUiState.ageMs >= CONTEXT_STALE_WARNING_MS) {
      return {
        tone: "warning",
        message: "Context may be outdated.",
        canRetry: false
      };
    }
    return null;
  });
  const [pendingActionJobId, setPendingActionJobId] = useState<string | null>(null);
  const [actorRole, setActorRole] = useState<DemoQueueActorRole>(persistedUiState.state.actorRole);
  const [environmentScope, setEnvironmentScope] = useState<DemoQueueEnvironmentScope>(persistedUiState.state.environmentScope);
  const [confirmationSatisfied, setConfirmationSatisfied] = useState(false);
  const [activeTab, setActiveTab] = useState<QueueJobTab>(initialActiveTab);
  const [primaryView, setPrimaryView] = useState<PrimaryView>(persistedUiState.state.primaryView);
  const [experienceLayer, setExperienceLayer] = useState<ExperienceLayer>(persistedUiState.state.experienceLayer);
  const [queueQuery, setQueueQuery] = useState(persistedUiState.state.queueQuery);
  const [incidentQuery, setIncidentQuery] = useState(persistedUiState.state.incidentQuery);
  const [incidentSeverityFilter, setIncidentSeverityFilter] =
    useState<IncidentSeverityFilter>(persistedUiState.state.incidentSeverityFilter);
  const [incidentStatusFilter, setIncidentStatusFilter] =
    useState<IncidentStatusFilter>(persistedUiState.state.incidentStatusFilter);
  const [suggestedQueueTab, setSuggestedQueueTab] = useState<QueueJobTab | null>(null);
  const [thresholdDraft, setThresholdDraft] = useState<DemoQueueAlertThresholds | null>(null);
  const [thresholdSavePending, setThresholdSavePending] = useState(false);
  const [alertWorkflowById, setAlertWorkflowById] = useState<Record<string, AlertWorkflowItem>>({});
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(persistedUiState.state.selectedAlertId);
  const [alertStatusFilter, setAlertStatusFilter] = useState<AlertStatusFilter>(persistedUiState.state.alertStatusFilter);
  const [alertSourceFilter, setAlertSourceFilter] = useState<AlertSourceFilter>(persistedUiState.state.alertSourceFilter);
  const [alertOwnerFilter, setAlertOwnerFilter] = useState<AlertOwnerFilter>(persistedUiState.state.alertOwnerFilter);
  const [alertTimeFilter, setAlertTimeFilter] = useState<AlertTimeFilter>(persistedUiState.state.alertTimeFilter);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [alertDetailOpen, setAlertDetailOpen] = useState(false);
  const [liveAnnouncement, setLiveAnnouncement] = useState("");
  const [pendingAlertFocusKey, setPendingAlertFocusKey] = useState<string | null>(null);
  const [pendingAlertJobFocusId, setPendingAlertJobFocusId] = useState<string | null>(null);
  const [alertReturnContext, setAlertReturnContext] = useState<{
    alertId: string;
    openDetail: boolean;
  } | null>(null);
  const [selectedQueueName, setSelectedQueueName] = useState<string | null>(initialSelectedQueueName);
  const [lastListScrollY, setLastListScrollY] = useState(0);
  const [lastOpenedQueueName, setLastOpenedQueueName] = useState<string | null>(null);
  const previousSelectedQueueNameRef = useRef<string | null>(selectedQueueName);
  const initialLoadPendingRef = useRef(true);
  const queueHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const alertDetailHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const jobItemRefs = useRef<Record<string, HTMLLIElement | null>>({});
  const openQueueButtonsRef = useRef<Record<string, HTMLButtonElement | null>>({});
  const alertActionButtonsRef = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    const onResize = () => {
      setViewportWidth(window.innerWidth);
    };

    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, []);

  const loadDemoQueues = useCallback(async () => {
    const shouldLoadInsights = experienceLayer !== "raw" && !selectedQueueName;

    try {
      const [snapshotPayload, opsPayload, patternPayload, incidentPayload, alertPayload] = await Promise.all([
        apiRequest<DemoQueueSnapshot>("/demo/queues"),
        apiRequest<DemoQueueOpsSnapshot>("/demo/queues/ops"),
        shouldLoadInsights
          ? apiRequest<DemoQueuePatternSnapshot>("/demo/queues/patterns")
          : Promise.resolve<DemoQueuePatternSnapshot | null>(null),
        shouldLoadInsights
          ? apiRequest<DemoQueueIncidentSnapshot>("/demo/queues/incidents")
          : Promise.resolve<DemoQueueIncidentSnapshot | null>(null),
        shouldLoadInsights
          ? (alertCenterEnabled
              ? apiRequest<DemoQueueAlertSnapshot>("/demo/queues/alerts")
              : Promise.resolve<DemoQueueAlertSnapshot | null>(null))
          : Promise.resolve<DemoQueueAlertSnapshot | null>(null)
      ]);
      let detailPayload: DemoQueueDetail | null = null;
      let auditPayload: DemoQueueAuditSnapshot | null = null;

      if (selectedQueueName && snapshotPayload.queues.some((queue) => queue.name === selectedQueueName)) {
        [detailPayload, auditPayload] = await Promise.all([
          apiRequest<DemoQueueDetail>(`/demo/queues/${encodeURIComponent(selectedQueueName)}`, {
            headers: {
              "x-queueview-role": actorRole,
              "x-queueview-env-scope": environmentScope,
              "x-queueview-actor-id": "web.operator"
            }
          }),
          apiRequest<DemoQueueAuditSnapshot>("/demo/queues/audit")
        ]);
      }
      setSnapshot(snapshotPayload);
      setOpsSnapshot(opsPayload);
      setPatternSnapshot(patternPayload);
      setIncidentSnapshot(incidentPayload);
      setAlertSnapshot(alertPayload);
      setQueueDetail(detailPayload);
      setAuditSnapshot(auditPayload);

      setError("");
      setRestoreBanner((current) => {
        if (!current) {
          return null;
        }
        if (current.canRetry && current.message.includes("Connection lost while restoring context")) {
          return null;
        }
        return current;
      });
      initialLoadPendingRef.current = false;
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load queue snapshot");
      if (initialLoadPendingRef.current && persistedUiState.hasSnapshot) {
        setRestoreBanner({
          tone: "warning",
          message: "Connection lost while restoring context. Showing last known state.",
          canRetry: true
        });
      }
    }
  }, [actorRole, alertCenterEnabled, environmentScope, experienceLayer, persistedUiState.hasSnapshot, selectedQueueName]);

  const runJobAction = useCallback(
    async (jobId: string, action: DemoQueueJobAction) => {
      if (!queueDetail) {
        return;
      }

      const governance = queueDetail.ops.governance;
      if (!governance.allowedActions.includes(action)) {
        setActionError(`Role ${governance.actorRole} cannot run ${action}.`);
        return;
      }

      if (governance.confirmationRequiredActions.includes(action) && !confirmationSatisfied) {
        setActionError(`Confirm sensitive actions before ${action}.`);
        return;
      }

      setPendingActionJobId(jobId);
      try {
        const result = await apiRequest<DemoQueueActionResult>(
          `/demo/queues/${encodeURIComponent(queueDetail.queue.name)}/jobs/${encodeURIComponent(jobId)}/actions`,
          {
            method: "POST",
            headers: {
              "x-queueview-role": actorRole,
              "x-queueview-env-scope": environmentScope,
              "x-queueview-actor-id": "web.operator"
            },
            body: JSON.stringify({ action, confirmationSatisfied })
          }
        );

        if (!result.accepted) {
          setActionError(result.reason ?? "Action was rejected.");
          return;
        }

        setActionError("");
        await loadDemoQueues();
      } catch (requestError) {
        setActionError(requestError instanceof Error ? requestError.message : "Action request failed");
      } finally {
        setPendingActionJobId(null);
      }
    },
    [actorRole, confirmationSatisfied, environmentScope, loadDemoQueues, queueDetail]
  );

  const saveAlertThresholds = useCallback(async () => {
    if (!thresholdDraft) {
      return;
    }

    setThresholdSavePending(true);
    try {
      const updated = await apiRequest<DemoQueueAlertSnapshot>("/demo/queues/alerts/thresholds", {
        method: "PATCH",
        body: JSON.stringify(thresholdDraft)
      });
      setAlertSnapshot(updated);
      setActionError("");
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : "Threshold update failed");
    } finally {
      setThresholdSavePending(false);
    }
  }, [thresholdDraft]);

  const retryRestore = useCallback(() => {
    setError("");
    void loadDemoQueues();
  }, [loadDemoQueues]);

  useEffect(() => {
    if (!initialRouteState.hasExplicitQueue && initialSelectedQueueName && window.location.hash === "#/") {
      window.location.hash = queueHash(initialSelectedQueueName);
    }
  }, [initialRouteState.hasExplicitQueue, initialSelectedQueueName]);

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
      const route = parseHashRouteState(window.location.hash);
      setSelectedQueueName(route.queueName);
      if (route.tab) {
        setActiveTab(route.tab);
      }
    };

    window.addEventListener("hashchange", onHashChange);
    return () => {
      window.removeEventListener("hashchange", onHashChange);
    };
  }, []);

  useEffect(() => {
    if (previousSelectedQueueNameRef.current === selectedQueueName) {
      return;
    }
    previousSelectedQueueNameRef.current = selectedQueueName;

    setConfirmationSatisfied(false);
  }, [selectedQueueName]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        UI_STATE_STORAGE_KEY,
        JSON.stringify({
          schemaVersion: UI_STATE_SCHEMA_VERSION,
          savedAt: new Date().toISOString(),
          queueSelection: selectedQueueName,
          activeSection: primaryView,
          viewMode: experienceLayer,
          jobTab: activeTab,
          primaryView,
          experienceLayer,
          queueQuery,
          incidentQuery,
          incidentSeverityFilter,
          incidentStatusFilter,
          activeTab,
          actorRole,
          environmentScope,
          alertStatusFilter,
          alertSourceFilter,
          alertOwnerFilter,
          alertTimeFilter,
          selectedAlertId
        } satisfies PersistedUiSnapshot & {
          activeSection: PrimaryView;
          viewMode: ExperienceLayer;
          jobTab: QueueJobTab;
        })
      );
    } catch {
      // no-op: persistence is best-effort
    }
  }, [
    activeTab,
    alertOwnerFilter,
    alertSourceFilter,
    alertStatusFilter,
    alertTimeFilter,
    actorRole,
    environmentScope,
    experienceLayer,
    incidentQuery,
    incidentSeverityFilter,
    incidentStatusFilter,
    primaryView,
    queueQuery,
    selectedAlertId,
    selectedQueueName
  ]);

  useEffect(() => {
    if (!snapshot || !selectedQueueName) {
      return;
    }

    const queueExists = snapshot.queues.some((queue) => queue.name === selectedQueueName);
    if (queueExists) {
      return;
    }

    setSelectedQueueName(null);
    window.location.hash = "#/";
    setRestoreBanner({
      tone: "warning",
      message: "We restored most of your context, but some items are no longer available.",
      canRetry: true
    });
  }, [selectedQueueName, snapshot]);

  useEffect(() => {
    if (selectedQueueName || !lastOpenedQueueName) {
      return;
    }

    window.setTimeout(() => {
      openQueueButtonsRef.current[lastOpenedQueueName]?.focus();
    }, 0);
  }, [lastOpenedQueueName, selectedQueueName]);

  useEffect(() => {
    if (!alertSnapshot) {
      setThresholdDraft(null);
      return;
    }

    setThresholdDraft(alertSnapshot.thresholds);
  }, [alertSnapshot]);

  useEffect(() => {
    if (!alertSnapshot) {
      setAlertWorkflowById({});
      setSelectedAlertId(null);
      return;
    }

    setAlertWorkflowById((current) => {
      const next: Record<string, AlertWorkflowItem> = {};
      for (const alert of alertSnapshot.active) {
        const existing = current[alert.id];
        next[alert.id] = {
          id: alert.id,
          queueName: alert.queueName,
          kind: alert.kind,
          severity: alert.severity,
          summary: alert.summary,
          triggeredAt: alert.triggeredAt,
          updatedAt: existing?.updatedAt ?? alert.updatedAt,
          state: existing?.state ?? "new",
          owner: existing?.owner ?? null,
          muteReason: existing?.muteReason ?? "",
          muteUntil: existing?.muteUntil ?? "",
          resolutionNote: existing?.resolutionNote ?? "",
          lastDeliveryRetryAt: existing?.lastDeliveryRetryAt ?? null
        };
      }
      return next;
    });

    setSelectedAlertId((current) => {
      if (current && alertSnapshot.active.some((alert) => alert.id === current)) {
        return current;
      }
      return alertSnapshot.active[0]?.id ?? null;
    });
  }, [alertSnapshot]);

  useEffect(() => {
    if (!pendingAlertFocusKey) {
      return;
    }

    window.setTimeout(() => {
      alertActionButtonsRef.current[pendingAlertFocusKey]?.focus();
      setPendingAlertFocusKey(null);
    }, 0);
  }, [pendingAlertFocusKey]);

  useEffect(() => {
    if (!selectedQueueName || !pendingAlertJobFocusId) {
      return;
    }

    window.setTimeout(() => {
      jobItemRefs.current[pendingAlertJobFocusId]?.focus();
      setPendingAlertJobFocusId(null);
    }, 0);
  }, [pendingAlertJobFocusId, selectedQueueName]);

  useEffect(() => {
    if (!selectedQueueName || !suggestedQueueTab) {
      return;
    }

    setActiveTab(suggestedQueueTab);
    setSuggestedQueueTab(null);
  }, [selectedQueueName, suggestedQueueTab]);

  const updateAlertField = useCallback((alertId: string, field: "muteReason" | "muteUntil" | "resolutionNote", value: string) => {
    setAlertWorkflowById((current) => {
      const item = current[alertId];
      if (!item) {
        return current;
      }

      return {
        ...current,
        [alertId]: {
          ...item,
          [field]: value
        }
      };
    });
  }, []);

  const transitionAlertState = useCallback(
    (alertId: string, targetState: AlertWorkflowState) => {
      const current = alertWorkflowById[alertId];
      if (!current) {
        return;
      }

      if (!canTransitionAlertState(current.state, targetState)) {
        const message = `Transition ${current.state} → ${targetState} is not allowed.`;
        setActionError(message);
        setLiveAnnouncement(message);
        return;
      }

      if (targetState === "muted") {
        if (!current.muteReason.trim()) {
          const message = "Mute reason is required before muting an alert.";
          setActionError(message);
          setLiveAnnouncement(message);
          return;
        }
        if (!current.muteUntil.trim() || !Number.isFinite(Date.parse(current.muteUntil))) {
          const message = "Mute duration is required before muting an alert.";
          setActionError(message);
          setLiveAnnouncement(message);
          return;
        }
      }

      if (targetState === "resolved" && current.resolutionNote.trim().length < 8) {
        const message = "Resolution note must be at least 8 characters.";
        setActionError(message);
        setLiveAnnouncement(message);
        return;
      }

      const now = new Date().toISOString();
      const owner =
        targetState === "acknowledged" && current.state === "new"
          ? {
              ownerId: ALERT_OWNER_ID,
              ownerRole: actorRole,
              acknowledgedAt: now
            }
          : current.owner;

      setAlertWorkflowById((workflow) => ({
        ...workflow,
        [alertId]: {
          ...current,
          state: targetState,
          owner,
          updatedAt: now
        }
      }));
      setActionError("");
      setLiveAnnouncement(
        `Alert ${current.queueName} moved to ${targetState.replaceAll("_", " ")}${owner ? ` by ${owner.ownerId}` : ""}.`
      );
      setPendingAlertFocusKey(`list:${alertId}`);
    },
    [actorRole, alertWorkflowById]
  );

  const retryAlertDelivery = useCallback((alertId: string) => {
    const current = alertWorkflowById[alertId];
    if (!current || current.state !== "failed_delivery") {
      return;
    }

    const now = new Date().toISOString();
    setAlertWorkflowById((workflow) => ({
      ...workflow,
      [alertId]: {
        ...current,
        updatedAt: now,
        lastDeliveryRetryAt: now
      }
    }));
    setActionError("");
    setLiveAnnouncement(`Delivery retry requested for alert ${current.queueName}.`);
    setPendingAlertFocusKey(`list:${alertId}`);
  }, [alertWorkflowById]);

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

  const filteredQueues = useMemo(() => {
    if (!snapshot) {
      return [];
    }

    const query = queueQuery.trim().toLowerCase();
    if (!query) {
      return snapshot.queues;
    }

    return snapshot.queues.filter((queue) => queue.name.toLowerCase().includes(query));
  }, [snapshot, queueQuery]);

  const failedQueues = useMemo(() => {
    return [...filteredQueues]
      .filter((queue) => queue.stats.failed > 0)
      .sort((left, right) => right.stats.failed - left.stats.failed);
  }, [filteredQueues]);

  const recommendationItems = useMemo(() => {
    if (!patternSnapshot) {
      return [];
    }

    const filteredQueueNames = new Set(filteredQueues.map((queue) => queue.name));
    const incidentScoreByQueue = new Map(
      patternSnapshot.queues.map((queue) => [queue.queueName, queue.incidentScore] as const)
    );

    return patternSnapshot.topSignals
      .filter((signal) => filteredQueueNames.has(signal.queueName))
      .map((signal) => {
        const template = recommendationTemplate(signal);
        const incidentScore = incidentScoreByQueue.get(signal.queueName) ?? 0;
        const requiresVerification = signal.confidence < 0.7;
        return {
          ...signal,
          incidentScore,
          ...template,
          safetyNote: requiresVerification
            ? "Low-confidence signal. Validate raw queue metrics before acting."
            : "Guidance only. Queue mutations remain manual and operator-confirmed."
        };
      })
      .sort((left, right) => right.incidentScore - left.incidentScore || right.confidence - left.confidence);
  }, [filteredQueues, patternSnapshot]);

  const filteredIncidents = useMemo(() => {
    if (!incidentSnapshot) {
      return [];
    }

    const query = incidentQuery.trim().toLowerCase();
    return incidentSnapshot.incidents.filter((incident) => {
      if (incidentSeverityFilter !== "all" && incident.severity !== incidentSeverityFilter) {
        return false;
      }

      if (incidentStatusFilter !== "all" && incident.status !== incidentStatusFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      const searchable = [
        incident.title,
        incident.summary,
        ...incident.signalKinds,
        ...incident.queues.map((queue) => queue.queueName)
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [incidentQuery, incidentSeverityFilter, incidentSnapshot, incidentStatusFilter]);

  const sortedFilteredAlerts = useMemo(() => {
    const items = Object.values(alertWorkflowById).filter((alert) => {
      if (alertStatusFilter !== "all" && alert.state !== alertStatusFilter) {
        return false;
      }
      if (alertSourceFilter !== "all" && alert.kind !== alertSourceFilter) {
        return false;
      }
      if (alertOwnerFilter === "me" && alert.owner?.ownerId !== ALERT_OWNER_ID) {
        return false;
      }
      if (alertOwnerFilter === "unassigned" && alert.owner !== null) {
        return false;
      }
      return isAlertInTimeWindow(alert.triggeredAt, alertTimeFilter);
    });

    return items.sort((left, right) => {
      const severityDelta = ALERT_SEVERITY_RANK[right.severity] - ALERT_SEVERITY_RANK[left.severity];
      if (severityDelta !== 0) {
        return severityDelta;
      }
      return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
    });
  }, [alertOwnerFilter, alertSourceFilter, alertStatusFilter, alertTimeFilter, alertWorkflowById]);

  const selectedAlert = useMemo(
    () => sortedFilteredAlerts.find((alert) => alert.id === selectedAlertId) ?? sortedFilteredAlerts[0] ?? null,
    [selectedAlertId, sortedFilteredAlerts]
  );
  const selectedAlertQueue = useMemo(
    () => (selectedAlert ? snapshot?.queues.find((queue) => queue.name === selectedAlert.queueName) ?? null : null),
    [selectedAlert, snapshot?.queues]
  );
  const selectedAlertJobContext = useMemo(() => {
    if (!selectedAlertQueue || !selectedAlert) {
      return null;
    }

    const preferredStates = preferredAlertJobStates(selectedAlert.kind);
    const prioritized = selectedAlertQueue.recentJobs.find((job) => preferredStates.includes(job.state));
    const linkedJob = prioritized ?? selectedAlertQueue.recentJobs[0] ?? null;
    if (!linkedJob) {
      return null;
    }

    return {
      jobId: linkedJob.id,
      tab: queueTabForJobState(linkedJob.state)
    };
  }, [selectedAlert, selectedAlertQueue]);

  const alertLayoutMode: AlertLayoutMode = useMemo(() => {
    if (viewportWidth <= ALERT_MOBILE_MAX_WIDTH) {
      return "mobile";
    }
    if (viewportWidth <= ALERT_TABLET_MAX_WIDTH) {
      return "tablet";
    }
    return "desktop";
  }, [viewportWidth]);
  const showAlertList = alertLayoutMode !== "mobile" || !alertDetailOpen;
  const showDesktopAlertDetail = alertLayoutMode === "desktop" && selectedAlert;
  const showTabletAlertDetail = alertLayoutMode === "tablet" && alertDetailOpen && selectedAlert;
  const showMobileAlertDetail = alertLayoutMode === "mobile" && alertDetailOpen && selectedAlert;
  const isAlertDetailVisible = Boolean(selectedAlert) && (alertLayoutMode === "desktop" || alertDetailOpen);

  useEffect(() => {
    if (!selectedAlert && selectedAlertId !== null) {
      setSelectedAlertId(null);
      return;
    }

    if (selectedAlert && selectedAlert.id !== selectedAlertId) {
      setSelectedAlertId(selectedAlert.id);
    }
  }, [selectedAlert, selectedAlertId]);

  useEffect(() => {
    if (alertLayoutMode === "desktop") {
      setAlertDetailOpen(true);
      return;
    }
    setAlertDetailOpen(false);
  }, [alertLayoutMode]);

  useEffect(() => {
    if (!selectedAlert) {
      setAlertDetailOpen(false);
    }
  }, [selectedAlert]);

  useEffect(() => {
    if (!isAlertDetailVisible) {
      return;
    }

    window.setTimeout(() => {
      alertDetailHeadingRef.current?.focus();
    }, 0);
  }, [isAlertDetailVisible, selectedAlert?.id]);

  const closeAlertDetail = useCallback(() => {
    if (!selectedAlert) {
      return;
    }

    setAlertDetailOpen(false);
    setPendingAlertFocusKey(`list:${selectedAlert.id}`);
  }, [selectedAlert]);

  const openAlertLinkedContext = useCallback(
    (target: "queue" | "job") => {
      if (!selectedAlert) {
        return;
      }

      const tab = target === "job" ? selectedAlertJobContext?.tab : undefined;
      const openDetail = alertLayoutMode === "desktop" || alertDetailOpen;

      setAlertReturnContext({
        alertId: selectedAlert.id,
        openDetail
      });
      if (target === "job" && selectedAlertJobContext) {
        setPendingAlertJobFocusId(selectedAlertJobContext.jobId);
      }

      window.location.hash = queueHash(selectedAlert.queueName, tab, "alert", selectedAlert.id);
    },
    [alertDetailOpen, alertLayoutMode, selectedAlert, selectedAlertJobContext]
  );

  const renderAlertDetail = useCallback(
    (mode: AlertLayoutMode) => {
      if (!selectedAlert) {
        return null;
      }

      const isTabletDetail = mode === "tablet";
      const isMobileDetail = mode === "mobile";
      const detailClassName = [
        "panel",
        "alert-detail",
        isTabletDetail ? "alert-detail-drawer" : "",
        isMobileDetail ? "alert-detail-mobile" : ""
      ]
        .filter(Boolean)
        .join(" ");

      return (
        <section
          className={detailClassName}
          aria-label="Alert detail"
          role={isTabletDetail ? "dialog" : undefined}
          aria-modal={isTabletDetail ? "true" : undefined}
        >
          {isTabletDetail || isMobileDetail ? (
            <div className={isMobileDetail ? "alert-mobile-topbar" : "alert-drawer-topbar"}>
              <button
                type="button"
                className="ghost"
                onClick={closeAlertDetail}
              >
                {isMobileDetail ? "Back to alerts" : "Close detail"}
              </button>
              <span className="pill">{selectedAlert.severity}</span>
            </div>
          ) : null}
          <div className="panel-header">
            <h3 ref={alertDetailHeadingRef} tabIndex={-1}>
              {selectedAlert.queueName} {signalKindLabel(selectedAlert.kind)}
            </h3>
            {!isTabletDetail && !isMobileDetail ? <span className="pill">{selectedAlert.severity}</span> : null}
          </div>
          <p>{selectedAlert.summary}</p>
          <p className="queue-meta">
            state {selectedAlert.state.replaceAll("_", " ")} | source {signalKindLabel(selectedAlert.kind)} | triggered{" "}
            {formatTimestamp(selectedAlert.triggeredAt)}
          </p>
          <p className="queue-meta">
            owner{" "}
            {selectedAlert.owner
              ? `${selectedAlert.owner.ownerId} (${selectedAlert.owner.ownerRole}) acknowledged ${formatTimestamp(selectedAlert.owner.acknowledgedAt)}`
              : "unassigned"}
          </p>
          <div className="job-actions">
            <button type="button" className="ghost action-button" onClick={() => openAlertLinkedContext("queue")}>
              Open queue detail
            </button>
            {selectedAlertJobContext ? (
              <button type="button" className="ghost action-button" onClick={() => openAlertLinkedContext("job")}>
                Open job detail
              </button>
            ) : null}
          </div>

          {selectedAlert.state === "failed_delivery" ? (
            <div className="banner warning">
              <p>Delivery failed. Retry delivery before final closure.</p>
              <button
                type="button"
                className="ghost"
                ref={(button) => {
                  alertActionButtonsRef.current[`${selectedAlert.id}:retry_delivery`] = button;
                }}
                onClick={() => retryAlertDelivery(selectedAlert.id)}
              >
                Retry delivery
              </button>
              {selectedAlert.lastDeliveryRetryAt ? (
                <p className="queue-meta">Last retry {formatTimestamp(selectedAlert.lastDeliveryRetryAt)}</p>
              ) : null}
            </div>
          ) : null}

          <div className="alert-form-grid">
            <label>
              Mute reason
              <input
                value={selectedAlert.muteReason}
                onChange={(event) => updateAlertField(selectedAlert.id, "muteReason", event.target.value)}
                placeholder="Required for mute"
              />
            </label>
            <label>
              Mute until
              <input
                type="datetime-local"
                value={toDateTimeLocalInputValue(selectedAlert.muteUntil)}
                onChange={(event) => updateAlertField(selectedAlert.id, "muteUntil", event.target.value)}
              />
            </label>
            <label>
              Resolution note
              <textarea
                value={selectedAlert.resolutionNote}
                onChange={(event) => updateAlertField(selectedAlert.id, "resolutionNote", event.target.value)}
                placeholder="At least 8 characters"
              />
            </label>
          </div>

          <div className={isMobileDetail ? "job-actions alert-action-sheet" : "job-actions"}>
            <button
              type="button"
              className="ghost action-button"
              ref={(button) => {
                alertActionButtonsRef.current[`${selectedAlert.id}:acknowledged`] = button;
              }}
              onClick={() => transitionAlertState(selectedAlert.id, "acknowledged")}
              disabled={!canTransitionAlertState(selectedAlert.state, "acknowledged")}
            >
              Acknowledge
            </button>
            <button
              type="button"
              className="ghost action-button"
              ref={(button) => {
                alertActionButtonsRef.current[`${selectedAlert.id}:muted`] = button;
              }}
              onClick={() => transitionAlertState(selectedAlert.id, "muted")}
              disabled={!canTransitionAlertState(selectedAlert.state, "muted")}
            >
              Mute
            </button>
            <button
              type="button"
              className="ghost action-button"
              ref={(button) => {
                alertActionButtonsRef.current[`${selectedAlert.id}:resolved`] = button;
              }}
              onClick={() => transitionAlertState(selectedAlert.id, "resolved")}
              disabled={!canTransitionAlertState(selectedAlert.state, "resolved")}
            >
              Resolve
            </button>
            <button
              type="button"
              className="ghost action-button danger"
              ref={(button) => {
                alertActionButtonsRef.current[`${selectedAlert.id}:failed_delivery`] = button;
              }}
              onClick={() => transitionAlertState(selectedAlert.id, "failed_delivery")}
              disabled={!canTransitionAlertState(selectedAlert.state, "failed_delivery")}
            >
              Mark delivery failed
            </button>
          </div>
        </section>
      );
    },
    [closeAlertDetail, openAlertLinkedContext, retryAlertDelivery, selectedAlert, selectedAlertJobContext, transitionAlertState, updateAlertField]
  );

  const setQueueFromSuggestion = useCallback(
    (path: string, suggestedTab: DemoQueuePatternSignal["drilldown"]["suggestedTab"]) => {
      setSuggestedQueueTab(suggestedTab);
      window.location.hash = path;
    },
    []
  );
  const openQueue = useCallback((queueName: string) => {
    setLastListScrollY(window.scrollY);
    setLastOpenedQueueName(queueName);
    setActiveTab("latest");
    window.location.hash = queueHash(queueName);
  }, []);
  const backToQueues = useCallback(() => {
    const route = parseHashRouteState(window.location.hash);
    if (route.origin === "alert") {
      const alertIdToRestore = alertReturnContext?.alertId ?? route.alertId;
      const openDetailOnRestore = alertReturnContext?.openDetail ?? true;
      setPrimaryView("overview");
      setExperienceLayer("opinionated");
      if (alertIdToRestore) {
        setSelectedAlertId(alertIdToRestore);
        setAlertDetailOpen(openDetailOnRestore);
      } else {
        setQueueQuery("");
        setIncidentQuery("");
        setIncidentSeverityFilter("all");
        setIncidentStatusFilter("all");
        setAlertStatusFilter("all");
        setAlertSourceFilter("all");
        setAlertOwnerFilter("all");
        setAlertTimeFilter("all");
        setSelectedAlertId(null);
        setAlertDetailOpen(alertLayoutMode === "desktop");
      }
      setAlertReturnContext(null);
      window.location.hash = "#/";
      return;
    }

    window.location.hash = "#/";
    window.setTimeout(() => {
      try {
        window.scrollTo({ top: lastListScrollY, behavior: "auto" });
      } catch {
        // no-op: jsdom does not implement scrollTo
      }
      if (!lastOpenedQueueName) {
        return;
      }

      openQueueButtonsRef.current[lastOpenedQueueName]?.focus();
    }, 0);
  }, [alertLayoutMode, alertReturnContext, lastListScrollY, lastOpenedQueueName]);

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
  const queueOpsEvents = queueDetail?.ops.recentEvents ?? [];
  const queueAuditEvents = useMemo(
    () =>
      auditSnapshot?.recentEvents.filter((event) => event.queueName === queueDetail?.queue.name).slice(0, 12) ?? [],
    [auditSnapshot?.recentEvents, queueDetail?.queue.name]
  );
  const inQueueDetail = selectedQueueName !== null;
  const primaryViewLabel =
    primaryView === "overview" ? "Overview" : primaryView === "queues" ? "Queues" : "Failures";
  const breadcrumbItems = inQueueDetail
    ? ["Operations", primaryViewLabel, selectedQueueName ?? "Queue details"]
    : ["Operations", primaryViewLabel];

  useEffect(() => {
    if (!inQueueDetail || !queueDetail || !queueHeadingRef.current) {
      return;
    }

    queueHeadingRef.current.focus();
  }, [inQueueDetail, queueDetail]);

  return (
    <div className="dashboard-layout">
      <aside className="panel side-rail" aria-label="Application menu">
        <div className="side-rail-heading">
          <p className="eyebrow">QueueView</p>
          <p className="subtitle side-rail-copy">Operations center</p>
        </div>
        {!inQueueDetail ? (
          <nav className="primary-nav side-nav" aria-label="Primary navigation">
            <button
              type="button"
              className={primaryView === "overview" ? "ghost nav-chip active" : "ghost nav-chip"}
              onClick={() => setPrimaryView("overview")}
              aria-current={primaryView === "overview" ? "page" : undefined}
            >
              Overview
            </button>
            <button
              type="button"
              className={primaryView === "queues" ? "ghost nav-chip active" : "ghost nav-chip"}
              onClick={() => setPrimaryView("queues")}
              aria-current={primaryView === "queues" ? "page" : undefined}
            >
              Queues
            </button>
            <button
              type="button"
              className={primaryView === "failures" ? "ghost nav-chip active" : "ghost nav-chip"}
              onClick={() => setPrimaryView("failures")}
              aria-current={primaryView === "failures" ? "page" : undefined}
            >
              Failures
            </button>
          </nav>
        ) : (
          <p className="queue-meta">Queue detail mode</p>
        )}
      </aside>

      <main className={inQueueDetail ? "app-shell queue-detail-shell" : "app-shell global-shell"}>
        <header className="panel topbar">
          <div>
            <h1>Live Queue Monitor</h1>
            <p className="subtitle">
              Operations-first information architecture with focused queue triage and controlled assisted guidance.
            </p>
            <nav className="breadcrumbs" aria-label="Breadcrumb">
              {breadcrumbItems.map((item, index) => (
                <span key={`${item}-${index}`} className="crumb">
                  {item}
                </span>
              ))}
            </nav>
          </div>
          <div className="hero-controls">
            <nav className="layer-switch" aria-label="Assistance mode">
              <button
                type="button"
                className={experienceLayer === "raw" ? "ghost nav-chip active" : "ghost nav-chip"}
                onClick={() => setExperienceLayer("raw")}
              >
                Raw
              </button>
              <button
                type="button"
                className={experienceLayer === "pattern" ? "ghost nav-chip active" : "ghost nav-chip"}
                onClick={() => setExperienceLayer("pattern")}
              >
                Pattern
              </button>
              <button
                type="button"
                className={experienceLayer === "opinionated" ? "ghost nav-chip active" : "ghost nav-chip"}
                onClick={() => setExperienceLayer("opinionated")}
              >
                Opinionated
              </button>
            </nav>
          </div>
        </header>

        {error ? (
          <p role="alert" className="banner error">
            {error}
          </p>
        ) : null}
        {restoreBanner ? (
          <div role="alert" className={`banner ${restoreBanner.tone === "warning" ? "warning" : "info"}`}>
            <p>{restoreBanner.message}</p>
            <div className="banner-actions">
              {restoreBanner.canRetry ? (
                <button type="button" className="ghost" onClick={retryRestore}>
                  Retry restore
                </button>
              ) : null}
              <button type="button" className="ghost" onClick={() => setRestoreBanner(null)}>
                Dismiss
              </button>
            </div>
          </div>
        ) : null}

      {snapshot?.enabled &&
      !selectedQueueName &&
      primaryView === "overview" &&
      !alertCenterEnabled &&
      experienceLayer !== "raw" ? (
        <section className="panel queue-table-wrap">
          <div className="panel-header">
            <h2>Alert Center</h2>
            <span className="pill">disabled</span>
          </div>
          <p className="queue-meta triage-meta">
            Alert Center rollback is active. Set <code>VITE_ALERT_CENTER_ENABLED=true</code> to re-enable triage surface.
          </p>
        </section>
      ) : null}

      {snapshot?.enabled &&
      !selectedQueueName &&
      primaryView === "overview" &&
      alertSnapshot &&
      thresholdDraft &&
      experienceLayer !== "raw" ? (
        <section className="panel queue-table-wrap">
          <div className="panel-header">
            <h2>Alert Center</h2>
            <span className="pill">updated {formatTimestamp(alertSnapshot.updatedAt)}</span>
          </div>
          <p className="queue-meta triage-meta">
            Threshold-driven reliability alerts with notification guardrails and queue-level triage context.
          </p>
          <div className="threshold-grid" aria-label="Alert threshold controls">
            <label>
              Failure warn
              <input
                type="number"
                min={1}
                value={thresholdDraft.failureClusterWarn}
                onChange={(event) =>
                  setThresholdDraft((current) =>
                    current ? { ...current, failureClusterWarn: Number.parseInt(event.target.value, 10) || 1 } : current
                  )
                }
              />
            </label>
            <label>
              Failure critical
              <input
                type="number"
                min={1}
                value={thresholdDraft.failureClusterCritical}
                onChange={(event) =>
                  setThresholdDraft((current) =>
                    current
                      ? { ...current, failureClusterCritical: Number.parseInt(event.target.value, 10) || 1 }
                      : current
                  )
                }
              />
            </label>
            <label>
              Retry warn
              <input
                type="number"
                min={1}
                value={thresholdDraft.retryLoopWarn}
                onChange={(event) =>
                  setThresholdDraft((current) =>
                    current ? { ...current, retryLoopWarn: Number.parseInt(event.target.value, 10) || 1 } : current
                  )
                }
              />
            </label>
            <label>
              Retry critical
              <input
                type="number"
                min={1}
                value={thresholdDraft.retryLoopCritical}
                onChange={(event) =>
                  setThresholdDraft((current) =>
                    current ? { ...current, retryLoopCritical: Number.parseInt(event.target.value, 10) || 1 } : current
                  )
                }
              />
            </label>
            <label>
              Backlog warn
              <input
                type="number"
                min={1}
                value={thresholdDraft.lagBacklogWarn}
                onChange={(event) =>
                  setThresholdDraft((current) =>
                    current ? { ...current, lagBacklogWarn: Number.parseInt(event.target.value, 10) || 1 } : current
                  )
                }
              />
            </label>
            <label>
              Backlog critical
              <input
                type="number"
                min={1}
                value={thresholdDraft.lagBacklogCritical}
                onChange={(event) =>
                  setThresholdDraft((current) =>
                    current ? { ...current, lagBacklogCritical: Number.parseInt(event.target.value, 10) || 1 } : current
                  )
                }
              />
            </label>
          </div>
          <button type="button" className="ghost" disabled={thresholdSavePending} onClick={() => void saveAlertThresholds()}>
            {thresholdSavePending ? "Saving thresholds..." : "Save thresholds"}
          </button>
          <div className="alert-filter-grid" aria-label="Alert triage filters">
            <label>
              Status
              <select value={alertStatusFilter} onChange={(event) => setAlertStatusFilter(event.target.value as AlertStatusFilter)}>
                {ALERT_STATUS_FILTERS.map((status) => (
                  <option key={`alert-status-${status}`} value={status}>
                    {status.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Source
              <select value={alertSourceFilter} onChange={(event) => setAlertSourceFilter(event.target.value as AlertSourceFilter)}>
                {ALERT_SOURCE_FILTERS.map((source) => (
                  <option key={`alert-source-${source}`} value={source}>
                    {source === "all" ? "all" : signalKindLabel(source)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Owner
              <select value={alertOwnerFilter} onChange={(event) => setAlertOwnerFilter(event.target.value as AlertOwnerFilter)}>
                {ALERT_OWNER_FILTERS.map((owner) => (
                  <option key={`alert-owner-${owner}`} value={owner}>
                    {owner}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Time
              <select value={alertTimeFilter} onChange={(event) => setAlertTimeFilter(event.target.value as AlertTimeFilter)}>
                {ALERT_TIME_FILTERS.map((window) => (
                  <option key={`alert-time-${window}`} value={window}>
                    {window}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {sortedFilteredAlerts.length === 0 ? (
            <p className="queue-meta">No alerts match the current triage filters.</p>
          ) : (
            <div className={`alert-triage-layout ${alertLayoutMode}`}>
              {showAlertList ? (
                alertLayoutMode === "desktop" ? (
                  <table className="alert-triage-table" aria-label="Alert triage table">
                    <thead>
                      <tr>
                        <th scope="col">Alert</th>
                        <th scope="col">Severity</th>
                        <th scope="col">State</th>
                        <th scope="col">Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedFilteredAlerts.map((alert) => (
                        <tr key={`triage-${alert.id}`}>
                          <th scope="row">
                            <button
                              type="button"
                              className={selectedAlert?.id === alert.id ? "ghost alert-list-button active" : "ghost alert-list-button"}
                              ref={(button) => {
                                alertActionButtonsRef.current[`list:${alert.id}`] = button;
                              }}
                              onClick={() => {
                                setSelectedAlertId(alert.id);
                              }}
                            >
                              <strong>{alert.queueName}</strong> {signalKindLabel(alert.kind)}
                            </button>
                          </th>
                          <td>{alert.severity}</td>
                          <td>{alert.state.replaceAll("_", " ")}</td>
                          <td>{formatTimestamp(alert.updatedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <ul className="alert-triage-list" aria-label="Alert triage list">
                    {sortedFilteredAlerts.map((alert) => (
                      <li key={`triage-${alert.id}`}>
                        <button
                          type="button"
                          className={selectedAlert?.id === alert.id ? "ghost alert-list-button active" : "ghost alert-list-button"}
                          ref={(button) => {
                            alertActionButtonsRef.current[`list:${alert.id}`] = button;
                          }}
                          onClick={() => {
                            setSelectedAlertId(alert.id);
                            setAlertDetailOpen(true);
                          }}
                        >
                          <strong>{alert.queueName}</strong> {signalKindLabel(alert.kind)}
                          <span className="queue-meta">
                            severity {alert.severity} | state {alert.state.replaceAll("_", " ")} | updated{" "}
                            {formatTimestamp(alert.updatedAt)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )
              ) : null}
              {showDesktopAlertDetail ? renderAlertDetail("desktop") : null}
            </div>
          )}
          {showTabletAlertDetail ? (
            <>
              <button
                type="button"
                className="alert-drawer-scrim"
                aria-label="Close alert detail drawer"
                onClick={closeAlertDetail}
              />
              {renderAlertDetail("tablet")}
            </>
          ) : null}
          {showMobileAlertDetail ? renderAlertDetail("mobile") : null}
          <div>
            <h3>Recent notifications</h3>
            {alertSnapshot.notifications.length === 0 ? (
              <p className="queue-meta">No notifications emitted yet.</p>
            ) : (
              <ul className="job-list">
                {alertSnapshot.notifications.slice(0, 6).map((notification) => (
                  <li key={notification.id} className="job-item">
                    <p>
                      <strong>{notification.queueName}</strong> {signalKindLabel(notification.kind)} ({notification.event})
                    </p>
                    <p className="queue-meta">
                      severity {notification.severity} | {formatTimestamp(notification.at)}
                    </p>
                    <p className="queue-meta">{notification.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
            {liveAnnouncement}
          </p>
        </section>
      ) : null}

      {snapshot?.enabled &&
      !selectedQueueName &&
      primaryView === "overview" &&
      incidentSnapshot &&
      experienceLayer !== "raw" ? (
        <section className="panel queue-table-wrap">
          <div className="panel-header">
            <h2>Incident Command Center</h2>
            <span className="pill">updated {formatTimestamp(incidentSnapshot.updatedAt)}</span>
          </div>
          <p className="queue-meta triage-meta">
            Cross-queue correlation view for active signals. Use filters to isolate incidents, then jump directly to raw
            queue evidence.
          </p>

          <div className="incident-filter-bar">
            <label htmlFor="incident-query">Incident search</label>
            <input
              id="incident-query"
              name="incident-query"
              value={incidentQuery}
              onChange={(event) => setIncidentQuery(event.target.value)}
              placeholder="Filter incidents by queue, kind, or summary"
            />
            <div className="incident-chip-row" role="group" aria-label="Incident severity filter">
              {(["all", "high", "medium", "low"] as const).map((severity) => (
                <button
                  key={`severity-${severity}`}
                  type="button"
                  className={incidentSeverityFilter === severity ? "ghost nav-chip active" : "ghost nav-chip"}
                  onClick={() => setIncidentSeverityFilter(severity)}
                >
                  severity: {severity}
                </button>
              ))}
            </div>
            <div className="incident-chip-row" role="group" aria-label="Incident status filter">
              {(["all", "active", "monitoring"] as const).map((status) => (
                <button
                  key={`status-${status}`}
                  type="button"
                  className={incidentStatusFilter === status ? "ghost nav-chip active" : "ghost nav-chip"}
                  onClick={() => setIncidentStatusFilter(status)}
                >
                  status: {status}
                </button>
              ))}
            </div>
          </div>

          {filteredIncidents.length === 0 ? (
            <p className="queue-meta">No incidents match the current triage filters.</p>
          ) : (
            <ul className="recommendation-list">
              {filteredIncidents.map((incident) => (
                <li key={incident.id} className="recommendation-card">
                  <div className="panel-header">
                    <p>
                      <strong>{incident.title}</strong>
                    </p>
                    <span className="pill">score {incident.incidentScore}</span>
                  </div>
                  <p className="queue-meta">
                    severity {incident.severity} | status {incident.status} | queues {incident.queues.length}
                  </p>
                  <p>{incident.summary}</p>
                  <p className="queue-meta">Signals: {incident.signalKinds.map((kind) => signalKindLabel(kind)).join(", ")}</p>
                  <ul className="incident-queue-list">
                    {incident.queues.map((queue) => (
                      <li key={`${incident.id}-${queue.queueName}`} className="incident-queue-item">
                        <div>
                          <p>
                            <strong>{queue.queueName}</strong> ({queue.healthStatus})
                          </p>
                          <p className="queue-meta">
                            queue score {queue.incidentScore} | {queue.healthReason}
                          </p>
                          <p className="queue-meta">
                            top signal {signalKindLabel(queue.primarySignal.kind)} ({queue.primarySignal.severity})
                          </p>
                          <p className="queue-meta">
                            failed ids {queue.primarySignal.evidence.failedJobIds.slice(0, 3).join(", ") || "none"} |
                            retry ids {queue.primarySignal.evidence.retryScheduledJobIds.slice(0, 3).join(", ") || "none"}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="ghost queue-nav"
                          onClick={() =>
                            setQueueFromSuggestion(
                              queue.primarySignal.drilldown.queueDetailPath,
                              queue.primarySignal.drilldown.suggestedTab
                            )
                          }
                        >
                          Open {queue.queueName} evidence
                        </button>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {snapshot?.enabled &&
      !selectedQueueName &&
      primaryView === "overview" &&
      patternSnapshot &&
      experienceLayer !== "raw" ? (
        <section className="panel queue-table-wrap">
          <h2>Pattern Signals (heuristic)</h2>
          {patternSnapshot.topSignals.length === 0 ? (
            <p className="queue-meta">No anomaly signals detected from current queue movement.</p>
          ) : (
            <ul className="job-list">
              {patternSnapshot.topSignals.map((signal) => (
                <li key={signal.id} className="job-item">
                  <p>
                    <strong>{signal.queueName}</strong> {signal.kind.replaceAll("_", " ")} ({signal.severity})
                  </p>
                  <p className="queue-meta">
                    score{" "}
                    {patternSnapshot.queues.find((queue) => queue.queueName === signal.queueName)?.incidentScore ?? 0}
                    {" | "}confidence {Math.round(signal.confidence * 100)}%
                  </p>
                  <p className="queue-meta">{signal.summary}</p>
                  <p className="queue-meta">
                    waiting {signal.evidence.waiting} | retry {signal.evidence.retryScheduled} | failed{" "}
                    {signal.evidence.failed}
                  </p>
                  <button
                    type="button"
                    className="ghost queue-nav"
                    onClick={() => setQueueFromSuggestion(signal.drilldown.queueDetailPath, signal.drilldown.suggestedTab)}
                  >
                    Open evidence queue
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {snapshot?.enabled &&
      !selectedQueueName &&
      primaryView === "overview" &&
      patternSnapshot &&
      experienceLayer === "opinionated" ? (
        <section className="panel queue-table-wrap">
          <h2>Opinionated Triage Assistant</h2>
          <p className="queue-meta triage-meta">
            Assisted mode ranks likely incident priorities and proposes next steps. All queue actions remain manual.
          </p>
          {recommendationItems.length === 0 ? (
            <p className="queue-meta">No recommendation candidates for the current queue filter.</p>
          ) : (
            <ul className="recommendation-list">
              {recommendationItems.map((item) => (
                <li key={`recommendation-${item.id}`} className="recommendation-card">
                  <div className="panel-header">
                    <p>
                      <strong>{item.queueName}</strong> {signalKindLabel(item.kind)}
                    </p>
                    <span className="pill">score {item.incidentScore}</span>
                  </div>
                  <p className="queue-meta">
                    confidence {Math.round(item.confidence * 100)}% | severity {item.severity}
                  </p>
                  <p>{item.diagnosis}</p>
                  <p className="queue-meta">{item.nextAction}</p>
                  <ul className="playbook-list">
                    {item.playbook.map((step) => (
                      <li key={`${item.id}-${step}`}>{step}</li>
                    ))}
                  </ul>
                  <p className="queue-meta safety-note">{item.safetyNote}</p>
                  <button
                    type="button"
                    className="ghost queue-nav"
                    onClick={() => setQueueFromSuggestion(item.drilldown.queueDetailPath, item.drilldown.suggestedTab)}
                  >
                    Open queue in {item.drilldown.suggestedTab} tab
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
      {actionError ? (
        <p role="alert" className="banner error">
          {actionError}
        </p>
      ) : null}

      {!inQueueDetail ? (
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
          {opsSnapshot ? (
            <div className="ops-summary" aria-label="Queue operations summary">
              <p className="kpi-label">Manual actions (runtime)</p>
              <p className="queue-meta">
                Requeue {opsSnapshot.counters.requeue} | Mark failed {opsSnapshot.counters.mark_failed} | Mark
                completed {opsSnapshot.counters.mark_completed}
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      {snapshot && !snapshot.enabled ? (
        <section className="panel">
          <p>Demo queues are disabled. Set `DEMO_JOB_RUNNERS=true` to enable `/demo/queues`.</p>
        </section>
      ) : null}

      {snapshot?.enabled && !selectedQueueName ? (
        <section className="panel queue-controls">
          <label htmlFor="queue-query">Queue search</label>
          <input
            id="queue-query"
            name="queue-query"
            value={queueQuery}
            onChange={(event) => setQueueQuery(event.target.value)}
            placeholder="Filter by queue name"
          />
        </section>
      ) : null}

      {snapshot?.enabled && !selectedQueueName && primaryView === "overview" ? (
        <section className="panel queue-table-wrap">
          <h2>Queue Health Table</h2>
          <table className="queue-table" aria-label="Queue health table">
            <thead>
              <tr>
                <th scope="col">Queue</th>
                <th scope="col">Waiting</th>
                <th scope="col">Active</th>
                <th scope="col">Failed</th>
                <th scope="col">Retry</th>
                <th scope="col">Processed</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredQueues.map((queue) => (
                <tr key={`${queue.name}-row`}>
                  <td>{queue.name}</td>
                  <td>{queue.stats.waiting}</td>
                  <td>{queue.stats.active}</td>
                  <td>{queue.stats.failed}</td>
                  <td>{queue.stats.retryScheduled}</td>
                  <td>{queue.stats.totalProcessed}</td>
                  <td>
                    <button
                      type="button"
                      className="ghost table-action"
                      ref={(button) => {
                        openQueueButtonsRef.current[queue.name] = button;
                      }}
                      aria-label={`Open queue ${queue.name}`}
                      onClick={() => openQueue(queue.name)}
                    >
                      Open queue
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="queue-health-cards" aria-label="Queue health cards">
            {filteredQueues.map((queue) => (
              <li key={`${queue.name}-mobile`} className="queue-health-card">
                <div className="panel-header">
                  <h3>{queue.name}</h3>
                  <span className="pill">processed {queue.stats.totalProcessed}</span>
                </div>
                <div className="stats-grid">
                  <p>waiting: {queue.stats.waiting}</p>
                  <p>active: {queue.stats.active}</p>
                  <p>failed: {queue.stats.failed}</p>
                  <p>retry: {queue.stats.retryScheduled}</p>
                </div>
                <button
                  type="button"
                  className="ghost queue-nav"
                  ref={(button) => {
                    openQueueButtonsRef.current[queue.name] = button;
                  }}
                  aria-label={`Open queue ${queue.name}`}
                  onClick={() => openQueue(queue.name)}
                >
                  Open queue
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {snapshot?.enabled && !selectedQueueName && primaryView === "queues" ? (
        <section className="queue-board">
          {filteredQueues.map((queue) => (
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

              <button
                type="button"
                className="ghost queue-nav"
                ref={(button) => {
                  openQueueButtonsRef.current[queue.name] = button;
                }}
                aria-label={`Open queue ${queue.name}`}
                onClick={() => openQueue(queue.name)}
              >
                Open queue
              </button>
            </article>
          ))}
        </section>
      ) : null}

      {snapshot?.enabled && !selectedQueueName && primaryView === "failures" ? (
        <section className="queue-board">
          {failedQueues.length === 0 ? (
            <article className="panel queue-card">
              <h2>No queue failures right now</h2>
              <p className="queue-meta">All filtered queues are currently healthy.</p>
            </article>
          ) : (
            failedQueues.map((queue) => (
              <article key={`${queue.name}-failure`} className="panel queue-card failure-card">
                <div className="panel-header">
                  <h2>{queue.name}</h2>
                  <span className="pill">{queue.stats.failed} failed</span>
                </div>
                <p className="queue-meta">
                  Last snapshot shows {queue.stats.retryScheduled} retry-scheduled and {queue.stats.active} active.
                </p>
                <button
                  type="button"
                  className="ghost queue-nav"
                  ref={(button) => {
                    openQueueButtonsRef.current[queue.name] = button;
                  }}
                  aria-label={`Open queue ${queue.name}`}
                  onClick={() => openQueue(queue.name)}
                >
                  Open queue
                </button>
              </article>
            ))
          )}
        </section>
      ) : null}

        {snapshot?.enabled && selectedQueueName ? (
        <section className="panel queue-detail">
          <div className="detail-topbar">
            <div className="detail-header">
              <button type="button" className="ghost detail-back" onClick={backToQueues}>
                {parseHashRouteState(window.location.hash).origin === "alert" ? "Back to Alert Center" : "Back to all queues"}
              </button>
              {queueDetail ? <span className="pill detail-queue-chip">{queueDetail.queue.name}</span> : null}
              {queueDetail ? (
                <p className="queue-meta detail-updated">Updated {formatTimestamp(queueDetail.updatedAt)}</p>
              ) : null}
            </div>
          </div>

          {queueDetail ? (
            <>
              <div className="panel-header detail-title-row">
                <h2 tabIndex={-1} ref={queueHeadingRef}>
                  {queueDetail.queue.name}
                </h2>
                <span className="pill">c{queueDetail.queue.settings.concurrency}</span>
              </div>
              <p className="queue-meta">
                every {queueDetail.queue.settings.enqueueEveryMs}ms | proc{" "}
                {queueDetail.queue.settings.processingMsMin}-{queueDetail.queue.settings.processingMsMax}ms | fail{" "}
                {formatPercent(queueDetail.queue.settings.failureRate)} | retries {queueDetail.queue.settings.maxRetries}
              </p>

              <div className="stats-grid detail-stats">
                <p>waiting: {queueDetail.queue.stats.waiting}</p>
                <p>active: {queueDetail.queue.stats.active}</p>
                <p>retry: {queueDetail.queue.stats.retryScheduled}</p>
                <p>done: {queueDetail.queue.stats.completed}</p>
                <p>failed: {queueDetail.queue.stats.failed}</p>
                <p>processed: {queueDetail.queue.stats.totalProcessed}</p>
              </div>

              <section className="panel queue-controls">
                <label htmlFor="role-select">Operator role</label>
                <select
                  id="role-select"
                  name="role-select"
                  value={actorRole}
                  onChange={(event) => setActorRole(event.target.value as DemoQueueActorRole)}
                >
                  <option value="viewer">viewer</option>
                  <option value="operator">operator</option>
                  <option value="admin">admin</option>
                </select>
                <label htmlFor="scope-select">Environment scope</label>
                <select
                  id="scope-select"
                  name="scope-select"
                  value={environmentScope}
                  onChange={(event) => setEnvironmentScope(event.target.value as DemoQueueEnvironmentScope)}
                >
                  <option value="demo">demo</option>
                  <option value="staging">staging</option>
                  <option value="production">production</option>
                </select>
                <label htmlFor="confirm-sensitive">
                  <input
                    id="confirm-sensitive"
                    name="confirm-sensitive"
                    type="checkbox"
                    checked={confirmationSatisfied}
                    onChange={(event) => setConfirmationSatisfied(event.target.checked)}
                  />{" "}
                  Confirm sensitive actions (mark failed/completed)
                </label>
                <p className="queue-meta">
                  Allowed actions: {queueDetail.ops.governance.allowedActions.join(", ") || "none"} | policy{" "}
                  {queueDetail.ops.governance.policyVersion}
                </p>
                {queueDetail.ops.governance.blockedReason ? (
                  <p className="error-inline">{queueDetail.ops.governance.blockedReason}</p>
                ) : null}
              </section>

              <nav className="tabs" aria-label="Queue job tabs" role="tablist">
                <button
                  type="button"
                  className={activeTab === "latest" ? "tab active" : "tab"}
                  onClick={() => setActiveTab("latest")}
                  role="tab"
                  aria-selected={activeTab === "latest"}
                >
                  Latest ({queueDetail.jobs.latest.length})
                </button>
                <button
                  type="button"
                  className={activeTab === "active" ? "tab active" : "tab"}
                  onClick={() => setActiveTab("active")}
                  role="tab"
                  aria-selected={activeTab === "active"}
                >
                  Active ({queueDetail.jobs.active.length})
                </button>
                <button
                  type="button"
                  className={activeTab === "completed" ? "tab active" : "tab"}
                  onClick={() => setActiveTab("completed")}
                  role="tab"
                  aria-selected={activeTab === "completed"}
                >
                  Completed ({queueDetail.jobs.completed.length})
                </button>
                <button
                  type="button"
                  className={activeTab === "failed" ? "tab active" : "tab"}
                  onClick={() => setActiveTab("failed")}
                  role="tab"
                  aria-selected={activeTab === "failed"}
                >
                  Failed ({queueDetail.jobs.failed.length})
                </button>
                <button
                  type="button"
                  className={activeTab === "waiting" ? "tab active" : "tab"}
                  onClick={() => setActiveTab("waiting")}
                  role="tab"
                  aria-selected={activeTab === "waiting"}
                >
                  Waiting ({queueDetail.jobs.waiting.length})
                </button>
                <button
                  type="button"
                  className={activeTab === "retryScheduled" ? "tab active" : "tab"}
                  onClick={() => setActiveTab("retryScheduled")}
                  role="tab"
                  aria-selected={activeTab === "retryScheduled"}
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
                    <li
                      key={job.id}
                      className="job-item"
                      tabIndex={-1}
                      ref={(item) => {
                        jobItemRefs.current[job.id] = item;
                      }}
                    >
                      <p>
                        {job.id} <strong>{job.state}</strong> ({job.attempts}/{job.maxAttempts})
                      </p>
                      <p className="queue-meta">
                        created {formatTimestamp(job.createdAt)}
                        {job.startedAt ? ` | started ${formatTimestamp(job.startedAt)}` : ""}
                        {job.finishedAt ? ` | finished ${formatTimestamp(job.finishedAt)}` : ""}
                      </p>
                      {job.lastError ? <p className="error-inline">{job.lastError}</p> : null}
                      <div className="job-actions">
                        <button
                          type="button"
                          className="ghost action-button"
                          onClick={() => void runJobAction(job.id, "requeue")}
                          disabled={
                            pendingActionJobId === job.id ||
                            !queueDetail.ops.governance.allowedActions.includes("requeue")
                          }
                        >
                          Requeue
                        </button>
                        <button
                          type="button"
                          className="ghost action-button"
                          onClick={() => void runJobAction(job.id, "mark_completed")}
                          disabled={
                            pendingActionJobId === job.id ||
                            !queueDetail.ops.governance.allowedActions.includes("mark_completed") ||
                            (!confirmationSatisfied &&
                              queueDetail.ops.governance.confirmationRequiredActions.includes("mark_completed"))
                          }
                        >
                          Mark completed
                        </button>
                        <button
                          type="button"
                          className="ghost action-button danger"
                          onClick={() => void runJobAction(job.id, "mark_failed")}
                          disabled={
                            pendingActionJobId === job.id ||
                            !queueDetail.ops.governance.allowedActions.includes("mark_failed") ||
                            (!confirmationSatisfied &&
                              queueDetail.ops.governance.confirmationRequiredActions.includes("mark_failed"))
                          }
                        >
                          Mark failed
                        </button>
                      </div>
                      <div className="job-details">
                        <p>
                          <strong>Job details</strong>
                        </p>
                        <p>
                          <strong>Data</strong>
                        </p>
                        <pre>{JSON.stringify(job.data, null, 2)}</pre>
                        <p>
                          <strong>Config</strong>
                        </p>
                        <pre>{JSON.stringify(job.config, null, 2)}</pre>
                        <p>
                          <strong>Error</strong>
                        </p>
                        <p className="queue-meta">{job.lastError ?? "None"}</p>
                        <p>
                          <strong>Replies</strong>
                        </p>
                        {job.replies.length === 0 ? (
                          <p className="queue-meta">No replies yet.</p>
                        ) : (
                          <ul className="reply-list">
                            {job.replies.map((reply, index) => (
                              <li key={`${job.id}-reply-${index}`}>
                                <strong>{formatTimestamp(reply.at)}</strong> {reply.message}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <section className="ops-log">
                <h3>Recent manual actions</h3>
                {queueOpsEvents.length === 0 ? (
                  <p className="queue-meta">No manual actions recorded for this queue.</p>
                ) : (
                  <ul className="reply-list">
                    {queueOpsEvents.map((event) => (
                      <li key={event.id}>
                        <strong>{formatTimestamp(event.at)}</strong> {event.action} {event.jobId} ({event.fromState} to{" "}
                        {event.toState})
                      </li>
                    ))}
                  </ul>
                )}
                <h3>Audit trail evidence</h3>
                {queueAuditEvents.length === 0 ? (
                  <p className="queue-meta">No audit records captured for this queue yet.</p>
                ) : (
                  <ul className="reply-list">
                    {queueAuditEvents.map((event) => (
                      <li key={`audit-${event.id}`}>
                        <strong>{formatTimestamp(event.at)}</strong> {event.actorRole}/{event.actorId}{" "}
                        {event.environmentScope} {event.action} {event.jobId} ({event.fromState} to {event.toState})
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          ) : (
            <p>Loading queue details...</p>
          )}
        </section>
        ) : null}
      </main>
    </div>
  );
}
