# FLO-33 Layered Experience and Incident Triage UX Spec (v1)

## Scope

This document defines production-ready UX specifications for QueueView's layered product model:
- `Raw` layer for queue-level operational truth
- `Pattern` layer for trend and anomaly detection
- `Opinionated` layer for guided triage actions

Deliverables in this spec:
- IA and user flows for switching layers
- screen definitions for each layer
- interaction and state behavior at component level
- responsive behavior and engineering handoff package

Parent ticket: [FLO-32](/FLO/issues/FLO-32)

## IA

### Primary navigation

1. `Overview`
2. `Queues`
3. `Failures`

### Secondary context controls

- Global layer switcher: `Raw | Pattern | Opinionated`
- Time window filter: `15m | 1h | 6h | 24h`
- Queue filter and search (shared across all layers)

### IA map

- QueueView shell
- Overview
- KPI summary row
- Queue health table / cards
- Layered insights panel (depends on selected layer)
- Queues
- queue cards
- queue detail drill-in
- queue detail tabs (latest, active, completed, failed, waiting, retry)
- Failures
- failure-first queue list
- incident triage lane
- triage recommendation panel (only in Opinionated)

## Layer model behavior

### Raw layer intent

- Show current queue state with minimal interpretation.
- Prioritize direct inspection of jobs, status buckets, and retry pressure.

### Pattern layer intent

- Surface trends and anomalies from the same underlying queue data.
- Highlight movement over selected time windows, including hot queues.

### Opinionated layer intent

- Provide recommended triage order and suggested actions.
- Explain recommendation rationale so operators can validate and override.

### Layer switching rules

- Switching layers preserves:
- selected nav section
- queue search/filter
- selected time window
- active queue detail route
- The selected layer updates the data presentation in place (no full route transition).
- Use optimistic UI: update selected state immediately, then render loading placeholders for layer-specific modules.

## User flows

### Flow A: monitor all queues (Raw -> Pattern)

1. User lands on `Overview` with `Raw` selected.
2. User scans KPI row and queue health table for current backlog/failure pressure.
3. User switches to `Pattern` to view trend cards and anomaly indicators.
4. User identifies a queue with rising failures and opens queue detail.

Expected outcome: faster detection of movement, not just current absolute values.

### Flow B: incident triage (Pattern -> Opinionated)

1. User enters `Failures` view in `Pattern`.
2. User identifies top failed queues sorted by weighted severity.
3. User switches to `Opinionated` to view recommended triage order.
4. User executes top recommendation (`retry subset`, `pause intake`, or `open failed jobs`).

Expected outcome: reduced decision time during active incidents.

### Flow C: deep inspection and return

1. User opens queue detail in any layer.
2. User inspects jobs via status tabs and payload sections (`data`, `config`, `error`, `replies`).
3. User returns to list context while preserving queue search and selected layer.

Expected outcome: no context loss between broad triage and deep inspection.

## Screen specs

### Screen 1: Overview (Raw)

Core modules:
- KPI summary: queues, waiting, active, failed, retry, updated timestamp
- queue health table with sort by failed/waiting/active
- quick filters: `has failures`, `high waiting`, `retrying`

Actions:
- open queue detail
- jump to failures lane

### Screen 2: Overview (Pattern)

Core modules:
- trend strip for waiting/failed/throughput over selected window
- anomaly card list (spikes, stuck processing, rising retries)
- queue movement table (delta vs previous window)

Actions:
- open queue detail anchored to pattern signal
- pin queue for cross-layer comparison

### Screen 3: Failures (Opinionated)

Core modules:
- triage queue ranked by incident score
- recommendation cards with reason, confidence, and blast radius
- action rail: `retry failed batch`, `inspect latest error`, `defer and monitor`

Actions:
- execute suggested triage action
- dismiss recommendation with reason
- open queue detail with context panel pinned

### Screen 4: Queue detail (all layers)

Shared modules:
- queue header and runtime metadata
- status tabs and job rows
- payload detail sections

Layer-specific modules:
- Raw: status distribution and immediate retry pressure
- Pattern: queue trend mini-chart and anomaly tags
- Opinionated: queue-specific next-best actions and rationale

## Component-level states

### Layer switcher

States:
- default
- hover/focus
- selected
- loading (pending layer data)
- disabled (if feature-gated)

Behavior:
- keyboard support with arrow keys and enter/space
- `aria-selected` and roving tab index for accessibility

### Insight/recommendation cards

States:
- default
- expanded
- acknowledged
- dismissed
- error (failed to load recommendation details)

Behavior:
- preserve expanded state per queue while user remains on same route

### Queue table/cards

States:
- default
- hover
- selected
- filtered-out
- empty-state

Behavior:
- support sort toggles and maintain sort order across layer switches

### Global data states

- loading skeletons for all layer-specific modules
- stale data badge when refresh age exceeds threshold
- empty-state copy with recovery action
- inline error state with retry control

## Responsive behavior

### Desktop (>= 1200px)

- 3-column overview rhythm: KPI row, main list/table, side insight rail
- failures lane shows ranked triage list and recommendation details side-by-side

### Tablet (768px-1199px)

- side rails collapse under primary list
- trend strip remains horizontal scrollable if needed
- queue detail header wraps metadata into two rows

### Mobile (< 768px)

- layer switcher becomes sticky segmented control at top of content
- queue table switches to stacked queue cards
- recommendation cards become single-column with progressive disclosure
- preserve one-tap access to queue detail and back navigation

## Engineering handoff

### Mapping to current implementation

Target files for implementation:
- `apps/web/src/App.tsx`: add layer state model and render branching
- `apps/web/src/styles.css`: add layer switcher, pattern, and opinionated component styles
- keep current hash queue detail route (`#/queues/:name`) intact

Data model guidance:
- Raw layer consumes existing `/demo/queues` shape directly
- Pattern and Opinionated should start with deterministic client-side derivations
- keep adapters pure and isolated to enable backend replacement later

Interaction contract:
- preserve existing queue detail tab behavior
- preserve existing 5-second refresh cadence
- layer switch must not reset queue search/filter or route context

### Acceptance checklist

- layer switch works in Overview, Queues, and Failures views
- shared filters persist across layer changes
- pattern signals update when time window changes
- opinionated recommendations include visible rationale text
- queue detail remains stable across layer toggles
- mobile flow keeps triage actions reachable within two taps

## Open implementation notes

- `Pattern` and `Opinionated` are v1 heuristic layers and should be clearly labeled as such.
- Recommendation confidence should start with static thresholds and be reviewed post-launch.
- If backend signals are added later, retain current UI contract and swap derivation source only.
