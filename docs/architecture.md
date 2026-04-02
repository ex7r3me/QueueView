# Queuview MVP Architecture

## Goals

- Keep queue/session core simple and observable for rapid iteration.
- Preserve clear seams between API, web, and shared domain package.
- Ship vertical slices quickly with automated quality gates.

## System Layout

- `apps/api`: Fastify service exposing MVP queue and session HTTP APIs.
- `apps/web`: React SPA for host and participant workflows.
- `packages/shared`: Domain types and validation helpers shared across services.

## Runtime Topology

- Browser client calls API over HTTPS/JSON.
- API manages queue/session lifecycle through a storage abstraction.
- Default runtime keeps state in-memory; `SESSION_STORE_FILE` enables JSON persistence without API contract changes.

## Delivery Strategy

- FLO-8: baseline scaffolding + architecture + CI.
- FLO-9: backend queue/session primitives and API contracts.
- FLO-10: host/participant frontend flows wired to FLO-9 APIs.
- FLO-11: launch readiness hardening (docs, smoke tests, deployment checklist).

## Tradeoffs

- In-memory state first to maximize delivery speed; persistence follows as a bounded upgrade.
- Monorepo workspace for lowest setup overhead; revisit build graph tooling when CI time demands it.
- Shared package kept thin to avoid premature abstraction.
