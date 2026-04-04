# FLO-59 Alert Center Severity and Incident Triage UX Contract

## Scope

This document defines the design-ready UX contract for QueueView alerting workflows focused on rapid incident triage.

Deliverables included:
- information architecture and visual hierarchy for the alert center list
- alert detail state model and transitions (`new`, `acknowledged`, `muted`, `resolved`, `failed delivery`)
- navigation contract between alert items and queue/job context
- responsive layouts and accessibility requirements for high-signal incident handling
- implementation and QA acceptance criteria with edge-state guidance

Parent ticket: [FLO-53](/FLO/issues/FLO-53)  
Source ticket: [FLO-59](/FLO/issues/FLO-59)  
Dependencies: [FLO-47](/FLO/issues/FLO-47), [FLO-54](/FLO/issues/FLO-54), [FLO-55](/FLO/issues/FLO-55)

## Product outcome

### User outcome

Operators can identify critical alerts in seconds, move to the relevant queue/job context without losing orientation, and close the alert loop with auditable state changes.

### UX principles

- Highest-risk signals must always outrank recency-only ordering.
- Alert status changes must be explicit and reversible where safe.
- Incident context handoff must preserve user orientation through breadcrumb/back behavior.
- Accessibility semantics must remain intact under live refresh and state transitions.

## Information architecture

### Alert center shell

Primary regions:
1. `Alert summary strip` (counts by severity and status)
2. `Alert list` (sortable/filterable triage table on desktop, cards on mobile)
3. `Alert detail panel` (desktop side panel, mobile full-screen route)
4. `Context rail` (linked queue/job references + recent alert actions)

### Alert object model (UI contract)

Required fields per alert item:
- `alertId`
- `severity`: `critical | high | medium | low`
- `status`: `new | acknowledged | muted | resolved | failed_delivery`
- `source`: signal origin (`failure_cluster`, `retry_loop`, `lag_backlog_anomaly`, manual)
- `title`
- `summary`
- `queueName`
- `jobId` (nullable)
- `owner` (nullable)
- `triggeredAt`
- `updatedAt`
- `lastNotificationAt` (nullable)

### List visual hierarchy

Row/cell priority order:
1. Severity chip and status pill
2. Alert title + concise summary
3. Queue/job reference
4. Source and ownership
5. Timestamp group (`triggered`, `updated`)
6. Inline quick actions (`Acknowledge`, `Mute`, `Resolve`)

Sorting defaults:
- Primary: severity rank (`critical > high > medium > low`)
- Secondary: most recently updated

## Alert-detail states and transitions

### Canonical states

- `new`: auto-created, not yet claimed
- `acknowledged`: operator accepted ownership/intent to triage
- `muted`: notifications suppressed for configured window/reason
- `resolved`: condition remediated or no longer active
- `failed_delivery`: outbound notification failed (delivery channel issue)

### Transition contract

Allowed transitions:
- `new -> acknowledged`
- `new -> muted`
- `new -> resolved`
- `acknowledged -> muted`
- `acknowledged -> resolved`
- `muted -> acknowledged` (unmute + resume triage)
- `muted -> resolved`
- `failed_delivery -> acknowledged` (manual recovery)
- `failed_delivery -> muted`
- `failed_delivery -> resolved`

Guardrails:
- `resolved -> new` is disallowed in UI; new occurrences create a new alert id with backlink to prior resolution.
- `muted` requires `muteReason` and `muteUntil`.
- `resolved` requires `resolutionNote` (minimum 8 chars) for audit quality.

### State-specific UI behavior

`new`:
- emphasized row contrast + unread indicator dot
- primary CTA: `Acknowledge`

`acknowledged`:
- owner avatar/label required
- triage timer starts from acknowledge timestamp

`muted`:
- muted badge includes countdown (`Muted 14m left`)
- quick action: `Unmute`

`resolved`:
- row de-emphasized but remains visible under active filters until dismissed/archived window completes
- detail panel shows resolution metadata and author

`failed_delivery`:
- warning tone with explicit channel error summary
- CTA set: `Retry delivery`, `Acknowledge`, `Mute`, `Resolve`

## Navigation contract

### Entry points

- Alert center from primary nav (`Failures` view extension)
- Deep link from queue/job detail activity timeline
- Notification click-through (future integration-safe)

### Breadcrumb/back behavior

Desktop breadcrumb model:
- `Failures > Alert Center > Alert #<id> > Queue <name> > Job <id>`

Rules:
- Opening an alert from list preserves current list scroll anchor and filters.
- `Back to alerts` always returns to prior filtered/sorted list state.
- Navigating to queue detail from alert detail appends route state; browser back returns to the same alert detail, not list root.
- If origin route is unknown (direct deep link), `Back` falls back to `Failures > Alert Center` default query.

### Context linking

From alert detail:
- `Open queue detail` routes to `#/queues/:name` with suggested tab by source signal.
- `Open job detail` (when job exists) routes to queue detail with job focus anchor.
- Returning from queue/job context restores alert detail focus to header title.

## Responsive layout

### Desktop (`>= 1200px`)

- Two-pane triage layout: alert list (65%) + detail/context rail (35%)
- Sticky detail action bar for state transitions

### Tablet (`768px - 1199px`)

- Alert list full width
- Detail panel opens as right-side overlay drawer

### Mobile (`< 768px`)

- Alert list in card format with severity-first stacking
- Detail opens as full-screen route with sticky top bar (`Back`, severity/status, actions)
- Quick actions collapse into bottom action sheet while keeping 44px minimum targets

## Accessibility requirements

### Semantics and announcements

- Alert list uses semantic table on desktop and list semantics on mobile cards.
- Severity and status are conveyed by text labels, not color alone.
- State transition success/failure messages are announced through an ARIA live region.
- Failed-delivery alerts include explicit error text reachable by screen readers.

### Focus behavior

- Entering alert detail moves focus to detail heading.
- Triggering state change keeps focus in action area and announces result.
- Returning to list restores focus to originating alert row action.
- Overlay/drawer close returns focus to the invoking control.

### Input and contrast

- Minimum target size: `44x44`.
- Minimum text contrast: 4.5:1 (normal text), 3:1 (large text/icons).
- Keyboard path must support triage flow end-to-end without pointer input.

## Edge-state guidance

### Empty state

Trigger:
- no active alerts under current filter set

Behavior:
- show clear empty copy and `Clear filters` action
- maintain summary strip context so users understand global alert volume

### Partial data state

Trigger:
- alert list loads but linked queue/job context fails

Behavior:
- keep alert detail interactive for status changes
- show inline warning for unavailable linked context with retry action

### Concurrent-update conflict

Trigger:
- alert status changed by another operator during local session

Behavior:
- optimistic update rolls back with message: `Alert changed by another operator. View refreshed.`
- detail refreshes to server truth and keeps user on same alert id

### Failed transition request

Trigger:
- action API rejects due to policy or validation issue

Behavior:
- preserve current form input
- show field-level and banner error guidance
- do not silently change status

## Engineering handoff

Primary implementation files:
- `apps/web/src/App.tsx`
- `apps/web/src/styles.css`

Implementation requirements:
1. Add a typed alert state machine guard for allowed transitions.
2. Add alert list sorting/filtering by severity, status, source, ownership, and time.
3. Implement breadcrumb and back-state preservation contract for alert->queue/job navigation.
4. Add failed-delivery treatment including retry-delivery action affordance and error surfaces.
5. Ensure responsive behavior parity for desktop/tablet/mobile layouts.
6. Implement ARIA live announcements and deterministic focus restoration on transitions.

## QA acceptance criteria (testable)

1. Severity-first triage ordering
- Given mixed-severity alerts
- When alert center opens
- Then `critical` alerts render first, then `high`, `medium`, and `low`, with recency used within same severity.

2. New to acknowledged transition
- Given an alert in `new`
- When operator selects `Acknowledge`
- Then alert enters `acknowledged`, owner metadata appears, and transition is announced accessibly.

3. Mute validation
- Given operator chooses `Mute`
- When mute reason or mute duration is missing
- Then submit is blocked with clear validation guidance and no status change.

4. Resolve audit requirement
- Given an `acknowledged` alert
- When operator resolves without required note
- Then resolve is prevented until a valid `resolutionNote` is provided.

5. Failed-delivery recovery path
- Given alert status is `failed_delivery`
- When operator selects `Retry delivery`
- Then retry feedback is shown and alert remains actionable for acknowledge/mute/resolve.

6. Navigation preservation
- Given user opens an alert from a filtered list
- When user navigates alert->queue detail->back
- Then user returns to the same alert detail and then same filtered list position.

7. Concurrent change handling
- Given two operators view same alert
- When one resolves and the other attempts mute
- Then second operator receives conflict feedback and UI refreshes to current server status.

8. Responsive parity
- Given desktop/tablet/mobile layouts
- When triaging alerts and moving between detail and linked queue context
- Then required actions and key metadata remain available in all breakpoints.

9. Accessibility checks
- All transition results are screen-reader announced.
- Keyboard-only flow supports list selection, status changes, and navigation.
- Focus return behavior matches contract for detail open/close and back navigation.

## Out of scope

- Backend alert correlation or deduplication algorithm changes.
- Notification channel configuration UI.
- Cross-product incident timeline federation outside QueueView.
