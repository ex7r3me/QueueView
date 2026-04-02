# Queuview MVP Baseline

This repository contains the initial technical baseline for Queuview MVP delivery.

## Architecture at a Glance

- `apps/api`: Fastify API service with typed routes and test harness.
- `apps/web`: React + Vite client shell for host/participant flows.
- `packages/shared`: Shared domain types/utilities consumed by API and web.
- `docs/`: Architecture, ADRs, and environment contract.

See [docs/architecture.md](docs/architecture.md) for detailed system design.
Launch execution details are in [docs/launch-readiness.md](docs/launch-readiness.md).

## Local Setup

1. Install Node.js 20+.
2. Install dependencies:

```bash
npm install
```

3. Start API:

```bash
npm run dev -w @queuview/api
```

4. Start Web:

```bash
npm run dev -w @queuview/web
```

## CI Quality Gates

CI runs these checks on every push and pull request:

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`

For launch verification, run:

- `npm run smoke`

## Environment Variables

Copy `.env.example` to `.env` and set values per environment. Full contract is in [docs/env-contract.md](docs/env-contract.md).
