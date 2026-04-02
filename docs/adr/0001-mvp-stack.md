# ADR 0001: TypeScript Monorepo with Fastify + React

## Status
Accepted

## Context
Queuview needs a low-friction baseline that enables parallel backend/frontend delivery with typed contracts and straightforward local setup.

## Decision
Use an npm workspaces monorepo with:

- Fastify for API (`apps/api`)
- React + Vite for web (`apps/web`)
- Shared TypeScript package for domain contracts (`packages/shared`)

## Consequences

### Positive

- Single install and consistent tooling for all MVP workstreams.
- Strong type sharing across frontend and backend.
- Fast local iteration and simple CI integration.

### Negative

- npm workspace script ergonomics are less advanced than dedicated monorepo orchestrators.
- Shared package boundaries require discipline to avoid cross-layer coupling.

## Follow-up
Re-evaluate task runner/build caching after FLO-9 and FLO-10 based on CI runtime and developer throughput.
