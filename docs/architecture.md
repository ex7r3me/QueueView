# Queuview MVP Architecture

## Goals

- Keep queue monitoring core simple and observable for rapid iteration.
- Preserve clear seams between API, web, and shared domain package.
- Ship vertical slices quickly with automated quality gates.

## System Layout

- `apps/api`: Fastify service exposing health and demo queue snapshot APIs.
- `apps/web`: React SPA focused on live queue visibility.
- `packages/shared`: Domain types and validation helpers shared across services.

## Runtime Topology

- Browser client calls API over HTTPS/JSON.
- API runs in-memory demo queue simulators and serves snapshots at `/demo/queues`.
- Default runtime is ephemeral by design to maximize iteration speed for UI + operational workflows.

## Delivery Strategy

- FLO-8: baseline scaffolding + architecture + CI.
- FLO-9: backend queue simulator primitives and snapshot contract.
- FLO-10: queue board frontend wired to FLO-9 API.
- FLO-11: launch readiness hardening (docs, smoke tests, deployment checklist).

## Tradeoffs

- Simulated queues first to maximize delivery speed; production queue adapters follow as a bounded upgrade.
- Monorepo workspace for lowest setup overhead; revisit build graph tooling when CI time demands it.
- Shared package kept thin to avoid premature abstraction.
