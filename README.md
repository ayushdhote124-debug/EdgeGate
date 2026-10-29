# EdgeGate

An API gateway that sits between clients and backend services: API key authentication, tenant quotas, distributed rate limiting, circuit breakers, load balancing, request analytics and alerts.

**Stack:** Node.js, Express, Redis, MongoDB, OpenTelemetry, Next.js

> Status: **Phase 2 of 8 complete** (proxy core). See [Roadmap](#roadmap).

## Prerequisites

- Node.js 20.12+ (22 or 24 recommended)
- Docker Desktop (for Redis)
- A MongoDB database: MongoDB Atlas (free tier) or local via Docker

## Quick start (Windows PowerShell)

```powershell
npm install
Copy-Item .env.example .env     # then set MONGO_URL (add /edgegate before the "?")
npm run infra:up:redis          # Redis in Docker
npm run seed                    # admin, tenants, API keys, services
npm run mocks                   # fake backends (keep this terminal open)
npm run doctor                  # in a new terminal: checks everything
npm test
```
npm run gateway                # in another terminal: EdgeGate on port 8080
Invoke-RestMethod http://localhost:8080/orders/42

On macOS/Linux use `cp .env.example .env`. To run MongoDB in Docker as well, use `npm run infra:up`.

## Project structure

```
edgegate/
  apps/
    gateway/        Express data plane, port 8080        (Phase 2-4)
    admin-api/      Express control plane, port 4000     (Phase 5)
    worker/         Rollups, usage, alert evaluator      (Phase 6, 8)
    dashboard/      Next.js dashboard, port 3000         (Phase 7)
  packages/shared/  Config, logger, errors, API keys, plans, Mongoose models
  mock-services/    Fake orders, payments, users services with slow/fail modes
  scripts/          seed.js, doctor.js
  infra/            docker-compose.yml
  load-tests/       k6 scripts                           (Phase 8)
```

## Security decisions

- API keys are stored only as SHA-256 hashes; the raw key is shown once.
- The admin password is stored as a bcrypt hash.
- Secrets (API keys, auth headers, passwords) are redacted from logs.
- Unknown errors never expose internal details to clients.
- Configuration is validated at startup; a bad value stops the app with a clear message.

## Mock services

| Service | Port(s) | Endpoints |
| --- | --- | --- |
| orders | 4001, 4002 | `GET /orders`, `GET /orders/:id`, `POST /orders` |
| payments | 5001 | `POST /payments`, `GET /payments/:id` |
| users | 6001 | `GET /users/:id` |

Switch an instance's behaviour (`normal`, `slow`, `fail`, `flaky`):

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:5001/__mock/mode -ContentType "application/json" -Body '{"mode":"slow"}'
```

## Roadmap

- [x] **Phase 1: Foundation** (monorepo, shared package, models, Docker Compose, mocks, seed, doctor)
- [x] **Phase 2: Proxy core** (routing, streaming proxy, timeouts, request ids, access logs)
- [ ] Phase 3: Auth and limits (API keys, token bucket rate limiter, quotas)
- [ ] Phase 4: Resilience (circuit breaker, load balancing, health checks)
- [ ] Phase 5: Admin API and hot reload
- [ ] Phase 6: Observability (OpenTelemetry, Jaeger, Prometheus, analytics)
- [ ] Phase 7: Dashboard (Next.js)
- [ ] Phase 8: Alerts, load tests, documentation