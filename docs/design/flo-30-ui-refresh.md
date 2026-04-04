# FLO-30 Design Refresh: IA, Navigation, and Baseline Design System

## Scope

This refresh defines a practical operations-focused UI direction for QueueView with:
- updated information architecture and primary navigation
- baseline design-system tokens + reusable UI component patterns
- core flow wireframes for monitor and inspect workflows
- engineering handoff notes mapped to current React implementation

## Updated IA

### Primary navigation

1. `Overview`
2. `Queues`
3. `Failures`

### Navigation intent

- `Overview`: fast system health read and queue-level triage table
- `Queues`: card-based scanning and queue-by-queue drill-in
- `Failures`: dedicated error triage lane sorted by highest failed volume

### IA map

- QueueView shell
- Overview
- KPI summary (queues, waiting, active, failed, updated)
- Queue health table
- Queue search/filter
- Queues
- Queue cards
- queue stats and runtime settings summary
- queue detail entry point
- Failures
- failed queue cards
- retry/active context for incident triage
- queue detail entry point
- Queue detail (hash route)
- status tabs: latest, active, completed, failed, waiting, retry
- job detail block: data, config, error, replies

## Baseline design system

### Tokens (implemented in `apps/web/src/styles.css`)

- Typography:
- Font stack: `"Sora", "Avenir Next", "Segoe UI", sans-serif`
- Sizes via clamp and fixed role-based scale (`h1`, `h2`, body/meta)
- Color tokens:
- `--ink`, `--ink-muted`
- `--surface-card`, `--surface-highlight`
- `--accent`, `--accent-strong`
- `--danger`, `--danger-soft`
- `--stroke-soft`, `--stroke-strong`
- Spacing and radius tokens:
- `--space-1` through `--space-5`
- `--radius-sm`, `--radius-md`, `--radius-lg`

### Components

- Buttons:
- primary `button`
- secondary `button.ghost`
- nav chip `button.nav-chip`
- state tab `button.tab`
- Form controls:
- queue search input with explicit focus styling
- Cards/Panels:
- `.panel`, `.queue-card`, `.failure-card`
- Data display:
- KPI cards in `.overview-grid`
- queue health table `.queue-table`
- status pills `.pill`

## Core flow wireframes

### Flow A: monitor all queues

```text
+--------------------------------------------------------------+
| QueueView / Live Queue Monitor                               |
| [Overview] [Queues] [Failures]                               |
+--------------------------------------------------------------+
| KPI row: Queues | Waiting | Active | Failed | Updated        |
+--------------------------------------------------------------+
| Queue search: [ notifications...                           ]  |
+--------------------------------------------------------------+
| Queue Health Table                                            |
| Queue | Waiting | Active | Failed | Retry | Processed | Open |
| notif |   2     |   1    |   0    |   1   |    42     | [>]  |
+--------------------------------------------------------------+
```

### Flow B: inspect one queue

```text
+--------------------------------------------------------------+
| [Back to all queues]                         Updated 10:00 AM |
+--------------------------------------------------------------+
| notifications                                [c4]            |
| every 500ms | proc 100-600ms | fail 10% | retries 2          |
+--------------------------------------------------------------+
| waiting:2 | active:1 | retry:1 | done:4 | failed:0 | ...     |
+--------------------------------------------------------------+
| [Latest] [Active] [Completed] [Failed] [Waiting] [Retry]     |
+--------------------------------------------------------------+
| Job row                                                       |
| job-1 active (1/2)                                            |
| Data / Config / Error / Replies                               |
+--------------------------------------------------------------+
```

### Flow C: incident triage

```text
+--------------------------------------------------------------+
| Nav: Failures selected                                        |
+--------------------------------------------------------------+
| failed queue card                                              |
| queue name, failed count, retry + active context              |
| [Open queue]                                                   |
+--------------------------------------------------------------+
```

## Visual direction

- Atmosphere: operational but warm, with layered gradients and glass-card surfaces.
- Density: compact without being cramped; optimized for scanning queue health quickly.
- Emphasis model:
- blue accent for active controls and selected states
- red-tinted treatment reserved for failure contexts
- Interaction:
- lightweight hover lift on buttons
- chip-based nav states for clear section orientation

## Engineering handoff notes

- Updated UI in:
- `apps/web/src/App.tsx`
- `apps/web/src/styles.css`
- Hash routing stays unchanged for queue drill-down (`#/queues/:name`) to avoid backend/API changes.
- Existing auto-refresh behavior stays at 5 seconds.
- Existing queue detail tabs and payload rendering are preserved to prevent behavior regressions.
- New table and search are client-side transforms over existing `/demo/queues` payload.
- Responsive behavior:
- queue table horizontally scrolls on small screens
- hero and detail headers stack in narrow viewports

## QA checklist

- verify nav section toggles without changing API call shape
- verify queue search filters all list/table/failure views consistently
- verify open/back hash navigation still works
- verify tab switching still updates detail jobs
- verify mobile view keeps table accessible via horizontal scroll
