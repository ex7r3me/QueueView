# Queuview MVP Launch Readiness

This runbook is the source of truth for MVP launch checks and first-day operations.

## 1. Pre-Launch Quality Gate

Run the full gate from repo root:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Run targeted API smoke:

```bash
npm run smoke
```

Launch is blocked if any command above fails.

## 2. Deployment

1. Build API and web artifacts.
2. Set environment variables from [env-contract.md](./env-contract.md).
3. Start API (`npm run start -w @queuview/api`) and host web static assets from `apps/web/dist`.
4. Validate `/health` returns `200`.
5. Execute `npm run smoke` against the deployed API before traffic cutover.

## 3. Rollback

Use rollback immediately when smoke checks fail after deploy or error rate spikes.

1. Route traffic back to the previous release.
2. Restart API with prior artifact and previous env configuration.
3. Validate `/health` and run `npm run smoke`.
4. Keep new release disabled until root cause is identified.

## 4. Instrumentation Baseline

Current instrumentation for launch:

- HTTP request logs via Fastify logger.
- Domain event logs for:
  - `session.created`
  - `session.state.updated`
  - `queue.entry.joined`
  - `queue.entry.state.updated`
- Health endpoint: `GET /health`.

Minimum launch dashboards/alerts:

- API availability from `/health`.
- 4xx/5xx rate.
- Session creation rate.
- Queue transition failure rate (409 responses).

## 5. Post-Launch Feedback Loop (First 7 Days)

1. Daily triage of user issues and queue/session failures.
2. Summarize top 3 friction points from support and logs.
3. Convert each friction point into a scoped issue with owner + ETA.
4. Ship at least one high-impact fix per day during week one.
