# FLO-44 Incident Command Center UX + Snapshot Handoff Spec

## Scope

This document defines implementation-ready UX specifications for an incident command center that consolidates queue telemetry, pattern signals, and guided actions into one triage workspace.

Deliverables included:
- cross-queue incident context layout
- snapshot/share handoff flow for escalation to engineering and support
- desktop and mobile interaction states
- accessibility and focus-order guidance
- engineering handoff mapped to the current React app structure

Parent ticket: [FLO-42](/FLO/issues/FLO-42)  
Source ticket: [FLO-44](/FLO/issues/FLO-44)  
Context: [FLO-32](/FLO/issues/FLO-32), [FLO-37](/FLO/issues/FLO-37)

## Product intent

### Primary user outcome

When an incident starts, operators should be able to:
1. understand blast radius across all queues in under 30 seconds
2. decide first-response action order with confidence
3. share an exact, timestamped incident snapshot with engineering/support without copy-paste loss

### Command center principles

- Keep global context and queue-specific detail visible in one workflow.
- Prefer guided prioritization, but preserve direct access to raw state.
- Make escalation structured and repeatable via snapshot bundles.

## Information architecture

### Incident command center shell

Global layout regions (desktop):
1. `Incident header`
2. `Queue incident matrix`
3. `Insight rail` (pattern + opinionated guidance)
4. `Snapshot drawer` (on-demand handoff composer)

### Incident header modules

- Incident status pill: `Monitoring`, `Investigating`, `Mitigating`, `Resolved`
- Time range selector: `15m`, `1h`, `6h`, `24h`
- Active filters: queue tags, severity, ownership
- Last refresh + stale-data indicator
- Primary action: `Create snapshot`

### Queue incident matrix

Required columns:
- Queue name
- Severity score
- Waiting delta
- Failure rate delta
- Retry pressure
- Active incidents count
- Suggested next action
- Open queue action

Sorting defaults:
- Primary: severity score descending
- Secondary: failure rate delta descending

### Insight rail

Panels:
- Pattern signals (spike, stuck, retry churn, throughput collapse)
- Opinionated action queue with confidence + rationale
- Incident timeline events (action log, snapshot creates, status changes)

## Key flows

### Flow A: Rapid incident orientation

1. User lands in command center with default `1h` range.
2. Header summarizes incident state and stale-data risk.
3. User scans queue matrix top rows sorted by severity.
4. User opens first queue with highest combined failure + retry pressure.

Expected outcome: user identifies top-3 queues requiring immediate attention quickly.

### Flow B: Guided mitigation path

1. User reviews opinionated action queue in insight rail.
2. User compares recommendations against raw matrix columns.
3. User executes/records mitigation action from chosen queue detail.
4. Timeline logs action with actor and timestamp.

Expected outcome: lower decision latency with auditable triage rationale.

### Flow C: Snapshot handoff escalation

1. User triggers `Create snapshot`.
2. Snapshot drawer opens with prefilled incident metadata and selected scope.
3. User chooses recipients (`Engineering`, `Support`, optional custom channel).
4. User reviews generated payload preview.
5. User copies share payload or posts to integrated destination.
6. Timeline records snapshot id and recipients.

Expected outcome: escalation artifact is consistent, concise, and reproducible.

## Screen specifications

### Screen 1: Incident command center (desktop)

Layout:
- Top: incident header across full width
- Left/main: queue incident matrix (70%)
- Right: insight rail (30%)

Behavior:
- Selecting a matrix row updates right-rail recommendation context.
- Insight rail remains sticky while matrix scrolls.
- `Create snapshot` is always visible in header.

### Screen 2: Incident command center (mobile)

Layout:
- Sticky top bar: incident state + `Create` action
- Section tabs: `Queues`, `Insights`, `Timeline`
- Queue matrix transforms to stacked incident cards

Behavior:
- Card tap opens queue detail bottom sheet first, full route optional.
- Snapshot drawer becomes full-screen modal with stepper sections.

### Screen 3: Snapshot drawer/modal

Sections:
1. `Scope`
2. `Summary`
3. `Evidence`
4. `Recipients`
5. `Share preview`

Default included evidence:
- time range
- top impacted queues
- key metrics deltas
- recommended next actions
- direct links to affected queues

## Interaction and state model

### Snapshot creation states

- idle
- drafting
- validation error
- generating
- generated
- shared

Rules:
- `Share` disabled until required fields validate (`summary`, `recipient`).
- Keep unsent draft when user dismisses drawer accidentally in same session.
- Show immutable snapshot id after generation.

### Matrix row states

- default
- hover/focus
- selected
- acknowledged
- escalated (snapshot included)

Rules:
- Selected row persists during filter/time-range changes unless filtered out.
- Escalated rows show non-color badge label (`Included in snapshot`).

### Data reliability states

- loading skeletons (header, matrix, rail)
- stale data warning (age > configured threshold)
- partial failure (one module failed, others available)
- hard error (global fetch failed)

Recovery behavior:
- keep last known good values with stale badge during transient fetch errors
- provide explicit `Retry now` control

## Snapshot payload specification

### Payload format (UI contract)

Snapshot object fields:
- snapshotId
- createdAt
- createdBy
- incidentStatus
- timeRange
- queueSelection[]
- metricsSummary
- actionRecommendations[]
- notes
- links

### Links block requirements

- include command center deep link with current filters/time range
- include direct queue links for impacted queues
- include timestamp in UTC and local timezone display

### Copy variants

- `Engineering handoff`: metric-heavy, includes anomaly tags and recent action log
- `Support handoff`: customer-impact summary first, technical detail collapsed

## Accessibility and focus order

### Keyboard and screen reader requirements

- Command center shell landmarks:
  - header (`role=banner`)
  - main matrix region (`role=main`)
  - insight rail (`role=complementary`)
- Queue matrix uses semantic table on desktop and list semantics on mobile cards.
- Snapshot stepper announces current step and total steps.

### Focus order: command center

1. skip link / page heading
2. incident status and range controls
3. filter controls
4. matrix sorting and rows
5. insight rail recommendations
6. timeline entries
7. create snapshot action

### Focus order: snapshot flow

1. modal title
2. scope selectors
3. summary input
4. evidence toggles
5. recipient selectors
6. share preview
7. primary `Generate` / `Share` action
8. close action

Focus behavior:
- opening drawer moves focus to drawer title
- closing drawer returns focus to triggering `Create snapshot` button
- validation errors move focus to first invalid field with inline error text

### Touch target and contrast

- minimum target size `44x44`
- non-color status encoding required (labels + icons)
- minimum contrast 4.5:1 for text, 3:1 for large text/icons

## Engineering handoff

### Proposed implementation mapping

Primary files:
- `apps/web/src/App.tsx`
- `apps/web/src/styles.css`

Suggested UI structure additions:
1. add `IncidentCommandCenterView` container in `App.tsx`
2. add `IncidentHeader`, `IncidentMatrix`, `InsightRail`, `SnapshotDrawer` components
3. maintain existing hash-route queue detail pattern for continuity
4. store command center UI state (range, filters, selected row, snapshot draft) in view-level reducer

### Data contract additions (frontend expectations)

- extend `/demo/queues` adaptation layer with computed severity score and deltas
- add derived recommendation objects from pattern/opinionated signals
- define local snapshot composer model before backend endpoint exists

### QA acceptance checklist

- command center renders usable triage context on desktop and mobile
- sorting/filtering preserves selected row and user context
- snapshot flow validates required fields and preserves unsent draft
- snapshot payload preview includes queue links and metrics summary
- focus management and keyboard traversal follow defined order
- stale/error states are visible and recoverable without page reload
