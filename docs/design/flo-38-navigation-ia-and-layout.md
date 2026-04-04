# FLO-38 Navigation IA and Page Layout Redesign

## Scope

This document defines a production-ready navigation and page layout system for QueueView that separates global app context from queue-level context.

Deliverables included:
- global navigation IA
- queue-level navigation IA
- annotated layout guidance for key screens
- desktop and mobile behavior
- accessibility requirements
- implementation-ready handoff notes

Parent ticket: [FLO-37](/FLO/issues/FLO-37)
Source ticket: [FLO-38](/FLO/issues/FLO-38)

## Information architecture

### Global navigation (app scope)

Top-level destinations:
1. `Overview`
2. `Queues`
3. `Failures`

Rules:
- Global navigation is always visible on non-detail screens.
- Global navigation is hidden inside queue detail and replaced by queue-level context header.
- Switching between global sections preserves search query and active layer/filter controls.

### Queue-level navigation (queue scope)

Queue detail header pattern:
- Primary escape action at top-left: `Back to all queues`
- Queue identity block: queue name + concurrency pill + runtime metadata
- Last-updated timestamp at top-right

Queue detail local tabs:
1. `Latest`
2. `Active`
3. `Completed`
4. `Failed`
5. `Waiting`
6. `Retry`

Rules:
- Queue-level tabs never replace the global back path.
- Returning from queue detail should restore the user to the last global section and scroll position.

## Key screen layouts

### Screen A: Home/List (`Overview`)

Layout (desktop):
- Row 1: page title and short operational status summary
- Row 2: primary nav chip group (`Overview`, `Queues`, `Failures`)
- Row 3: KPI summary cards (queues, waiting, active, failed, updated)
- Row 4: queue search/filter controls
- Row 5: queue health table with explicit `Open queue` action per row

Annotations:
- Queue rows are the main entry to detail context.
- `Open queue` CTA must be labeled (not icon-only) for screen readers and clarity.

### Screen B: Queue Detail (`#/queues/:name`)

Layout (desktop):
- Row 1: back action + updated timestamp
- Row 2: queue title, concurrency, runtime metadata
- Row 3: queue stats strip (waiting, active, retry, done, failed, processed)
- Row 4: job-state tabs
- Row 5: jobs list with structured metadata and actions
- Row 6: recent manual actions log

Annotations:
- Back action is pinned at top of detail page and remains visible when content grows.
- Manual action controls (`requeue`, `mark completed`, `mark failed`) must be visually secondary to navigation controls.

### Screen C: Queue Actions and Failure Triage (`Failures` + detail actions)

Layout (desktop):
- Failures view: card list sorted by failed count with queue health context and `Open queue`
- Queue detail actions: action buttons placed near each job row; operation history grouped in a separate panel

Annotations:
- Failure contexts use danger color accents only for problem signals, not for navigation.
- Queue actions require clear verb labels and disabled/loading states to prevent accidental repeat operations.

## Responsive behavior

### Desktop (`>= 1200px`)

- Multi-column layouts may be used for KPI + table support panels.
- Queue detail keeps meta and timestamp on the same row.

### Tablet (`768px - 1199px`)

- Global nav wraps to two lines if needed.
- Queue detail metadata wraps under title; back action remains top-left.

### Mobile (`< 768px`)

- Global nav becomes horizontally scrollable segmented chips.
- Queue health table shifts to stacked cards.
- Queue detail keeps a sticky top bar with:
  - `Back to all queues`
  - shortened queue name
  - optional overflow menu for secondary actions
- Queue tabs become horizontally scrollable and preserve visible focus state.

## Accessibility requirements

### Navigation and focus order

- Logical focus sequence:
  1. global skip target / page title
  2. global navigation
  3. search/filter controls
  4. list/table content
  5. row actions
- Queue detail focus sequence:
  1. back action
  2. queue title/meta
  3. tablist
  4. jobs and actions
- On route transition to queue detail, focus lands on queue heading.
- On back navigation, focus returns to previously activated `Open queue` trigger.

### Labels and semantics

- Global and queue tabs use semantic `nav` + `button` or anchor patterns with `aria-current`/`aria-selected` where applicable.
- `Open queue` controls include queue name in accessible label (example: `Open queue notifications`).
- Action buttons include action + job id label context.

### Touch targets and contrast

- Minimum touch target: `44x44` px for all nav/action controls.
- Maintain minimum text contrast of 4.5:1 for normal text and 3:1 for large text/iconography.
- Do not encode status by color alone; include text labels and badges.

## Engineering handoff

Implementation focus files:
- `apps/web/src/App.tsx`
- `apps/web/src/styles.css`

Required behavior updates:
- Keep global nav scoped to list-level screens.
- Keep queue-detail back action persistent and visually dominant in detail context.
- Preserve queue detail hash routing (`#/queues/:name`).
- Preserve selected global view and filter/search state when entering/leaving detail view.
- Keep existing 5-second refresh behavior.

Suggested implementation steps:
1. Introduce explicit layout wrappers for `global-shell` and `queue-detail-shell` in `App.tsx`.
2. Add a sticky queue-detail top bar style in `styles.css` for mobile and long pages.
3. Ensure `Open queue` and `Back` actions restore prior list context (view + search).
4. Validate tab overflow behavior and keyboard navigation for mobile/desktop.

## Acceptance checklist

- Global and queue-level navigation are visually and behaviorally distinct.
- Queue detail always includes an obvious back/exit path.
- Home/list, queue detail, and queue actions layouts are annotated and implementation-ready.
- Accessibility checks pass for focus order, labels, touch targets, and contrast.
- Engineering handoff maps directly to existing code structure.
