# FLO-54 Queue State Persistence and Recovery UX Contract

## Scope

This document defines the UX contract for preserving operator context (queue, filters, selected item, and triage layer) across navigation and full page reload in QueueView.

Deliverables included:
- persistence model across `Raw`, `Pattern`, and `Opinionated` triage flows
- reload and re-entry wireframes for list and queue detail routes
- deep-link and back/forward history behavior contract
- degraded-state behavior when saved context cannot be restored
- implementation and QA acceptance criteria with explicit testable outcomes

Parent ticket: [FLO-53](/FLO/issues/FLO-53)  
Source ticket: [FLO-54](/FLO/issues/FLO-54)  
Context: [FLO-46](/FLO/issues/FLO-46), [FLO-48](/FLO/issues/FLO-48), [FLO-51](/FLO/issues/FLO-51)

## Product outcome

### User outcome

After refresh, reconnect, or return navigation, operators should resume exactly where they were without rebuilding context manually.

### UX principles

- Restore the most recent valid context first, then explain any gaps.
- Prefer deterministic restore behavior over implicit heuristics.
- Never silently drop context; show what was recovered and what was not.

## Persistence contract

### Persisted state model

State is scoped by user + workspace and saved for both list and detail contexts.

Required persisted keys:
- `viewMode`: `raw | pattern | opinionated`
- `activeSection`: `overview | queues | failures`
- `queueSelection`: currently open queue id/name (if in detail)
- `jobTab`: `latest | active | completed | failed | waiting | retry`
- `filters`: search text, status chips, queue tags
- `sort`: table sort key + direction
- `pagination`: page index / page size (if list view paginated)
- `timeWindow`: if pattern/opinionated panels are time-scoped
- `scrollAnchor`: last focused row/card id for restore-focus behavior
- `savedAt`: UTC timestamp of snapshot creation

### Layer-specific rules

1. Raw layer
- Preserve exact list controls (query, sort, selected tab, selected queue row).
- If row no longer exists, restore list controls and show missing-row notice.

2. Pattern layer
- Preserve selected pattern category, time window, and queue focus.
- If selected pattern signal expired, restore to nearest available signal and show fallback notice.

3. Opinionated layer
- Preserve recommendation panel state and active recommendation id.
- If recommendation is no longer valid, keep layer active but default to top-ranked current recommendation.

### Freshness and expiry

- Snapshot is considered fresh for 24 hours.
- 24h to 72h: restore with warning badge (`Context may be outdated`).
- >72h: do not auto-apply queue/job selection; restore only safe global controls (view, section, filters) and require user confirmation to re-open stale deep detail context.

## Navigation and reload wireframes

### Flow A: Full reload while in queue detail

```text
Before reload
[Queues > payments] [Tab: Failed] [Search: timeout] [Layer: Pattern]

After reload
1. App shell renders with loading skeleton.
2. Restore snapshot for view/section/queue/tab/filter.
3. Validate queue + tab existence against latest data.
4. Land user back on payments > Failed with prior search and layer.
5. Show non-blocking toast: "Restored your previous triage context."
```

### Flow B: Deep-link open with existing saved context

```text
URL entered: #/queues/refunds?tab=retry
Saved snapshot: queue=payments, tab=failed, layer=opinionated

Resolution order:
1. URL route + explicit URL params win.
2. Missing fields are filled from saved snapshot.
3. If conflict exists, show subtle banner: "Opened from shared link; some saved context was overridden."
```

### Flow C: Back/forward transitions

```text
User path:
Overview (pattern) -> Queue detail (payments/failed) -> Queue detail (refunds/retry) -> Back

Expected:
- browser Back restores prior route and route-owned UI state
- persisted snapshot updates at each stable route transition
- focus returns to previously activated row/action on list re-entry
```

## Restore precedence rules

Context sources are applied in this order:
1. Hard URL state (path/query/hash)
2. In-memory route state (same session back/forward)
3. Persisted snapshot (local/session storage contract)
4. Product defaults

Conflict handling rules:
- Never overwrite explicit URL fields with persisted values.
- When persisted values are invalid, keep valid subset and mark partial restore.
- On partial restore, render inline notice with `Review context` action.

## Degraded-state and recovery UX

### State 1: Persisted context missing

Trigger:
- first visit, cleared storage, or privacy/session policy removal

Behavior:
- load defaults without error styling
- show helper copy once: `No saved triage context found. Starting fresh.`

### State 2: Persisted context invalid

Trigger:
- queue removed, tab unsupported, or malformed saved payload

Behavior:
- apply valid subset
- fallback to safe defaults for invalid fields
- show warning banner with resolved fallback details

Banner copy:
`We restored most of your context, but some items are no longer available.`

### State 3: Data fetch/reconnect failure during restore

Trigger:
- API timeout/offline while validating saved context

Behavior:
- keep last-known shell and controls visible
- enter stale mode with explicit retry control
- preserve snapshot; retry restore validation on reconnect

Banner copy:
`Connection lost while restoring context. Showing last known state.`

### State 4: Expired context

Trigger:
- saved snapshot older than TTL threshold

Behavior:
- apply safe global controls only
- require user confirmation for old queue/job-level context
- show timestamped expiry notice

Banner copy:
`Saved context from 3+ days ago was partially applied to avoid stale detail data.`

## Engineering handoff

Primary implementation files:
- `apps/web/src/App.tsx`
- `apps/web/src/styles.css`

Implementation requirements:
1. Add a typed persisted-state adapter with schema versioning and migration guard.
2. Persist snapshot at stable points only:
   - route transitions
   - filter/tab changes
   - layer switches
3. Apply restore precedence exactly as defined in this contract.
4. Emit UI notices for partial/failed restores with dismiss + retry actions.
5. Keep restore logic side-effect-safe (no duplicate network fetch loops on mount).
6. Ensure mobile and desktop parity for restore behaviors.

## QA acceptance criteria (testable)

1. Full reload restore
- Given user is on `#/queues/payments` tab `failed` with search/filter applied
- When browser hard refresh occurs
- Then queue, tab, filters, and layer are restored with success toast.

2. Deep-link precedence
- Given saved context conflicts with incoming URL queue/tab
- When opening the deep link directly
- Then URL queue/tab is respected and missing fields are backfilled from persisted state.

3. Partial restore
- Given saved queue no longer exists
- When app restores state
- Then list-level controls restore, queue selection falls back safely, and warning banner appears.

4. Offline during restore
- Given restore starts and network drops
- When validation calls fail
- Then stale mode banner + retry action appear, and user can retry to complete restore.

5. Expired snapshot behavior
- Given snapshot age exceeds 72h
- When app launches
- Then only safe global context applies and user is prompted before deep detail restore.

6. Back/forward focus continuity
- Given user navigates list -> detail -> list via browser back
- When list view reappears
- Then focus returns to previously activated row action.

7. Accessibility checks
- Restore banners are screen-reader announced.
- Keyboard focus does not jump unexpectedly during restore.
- Dismiss/retry controls are reachable and labeled.

## Out of scope

- Cross-device context sync through backend user profiles.
- Multi-tab conflict resolution beyond last-write-wins local policy.
- New queue data model changes in API.
