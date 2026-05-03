# Scalable API Gateway (Backend-Only)

A production-oriented backend API Gateway built with **Node.js + Express** that provides:

- JWT authentication
- Request rate limiting
- Redis-based response caching
- Centralized structured logging
- API monitoring with Prometheus metrics
- Docker and Docker Compose support

## Tech Stack

- Node.js 20
- Express 4
- Redis (ioredis)
- JWT (jsonwebtoken)
- Rate limiting (express-rate-limit)
- Logging (morgan + winston)
- Metrics/monitoring (prom-client)
- Docker / Docker Compose

---

## Architecture Overview

```text
Client
  -> API Gateway (Express)
      -> Security Middleware (Helmet, CORS)
      -> Global Rate Limiter
      -> JWT Auth Middleware
      -> Cache Middleware (Redis)
      -> Upstream Service Proxy (Axios)
      -> Metrics + Structured Logs
```

---

## Project Structure

```bash
.
├── src
│   ├── config
│   │   ├── logger.js
│   │   └── redis.js
│   ├── middleware
│   │   ├── auth.js
│   │   ├── cache.js
│   │   ├── metrics.js
│   │   └── rateLimit.js
│   └── server.js
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Environment Variables

Copy `.env.example` to `.env` and update values.

| Variable | Description | Default |
|---|---|---|
| `PORT` | HTTP port for gateway | `8080` |
| `NODE_ENV` | Runtime environment | `development` |
| `JWT_SECRET` | Secret for signing/verifying JWT tokens | _required_ |
| `REDIS_URL` | Redis connection string | `redis://redis:6379` |
| `RATE_LIMIT_WINDOW_MS` | Rate-limit window in milliseconds | `60000` |
| `RATE_LIMIT_MAX` | Max requests per window per IP | `120` |
| `CACHE_TTL_SECONDS` | Response cache TTL | `60` |
| `UPSTREAM_SERVICE_URL` | Upstream service base URL | `https://jsonplaceholder.typicode.com` |

---

## Run Locally

```bash
npm install
cp .env.example .env
npm run dev
```

Server runs at: `http://localhost:8080`

---

## Run with Docker

```bash
cp .env.example .env
docker compose up --build
```

Services:
- Gateway: `http://localhost:8080`
- Redis: `localhost:6379`

---

## API Documentation

### 1) Health Check

**GET** `/health`

Returns application uptime and Redis connection status.

**Sample response**

```json
{
  "status": "ok",
  "redis": "ready",
  "uptimeSeconds": 1234.56
}
```

---

### 2) Prometheus Metrics

**GET** `/metrics`

Returns Prometheus-compatible metrics including default process metrics and HTTP request counters.

---

### 3) Generate JWT Token

**POST** `/auth/token`

Creates a short-lived JWT for testing/protected endpoints.

**Request body**

```json
{
  "sub": "my-service-client",
  "role": "consumer"
}
```

**Sample response**

```json
{
  "token": "<JWT_TOKEN>",
  "tokenType": "Bearer",
  "expiresIn": 3600
}
```

---

### 4) Get Posts (Protected + Cached)

**GET** `/api/posts`

Headers:

```http
Authorization: Bearer <JWT_TOKEN>
```

Behavior:
- Enforces JWT auth
- Rate-limited globally
- Uses Redis cache
- Calls upstream service on cache miss

**Sample response**

```json
{
  "source": "upstream",
  "data": [
    { "id": 1, "title": "..." }
  ]
}
```

If cached:

```json
{
  "source": "cache",
  "data": [
    { "id": 1, "title": "..." }
  ]
}
```

---

### 5) Get Post by ID (Protected + Cached)

**GET** `/api/posts/:id`

Headers:

```http
Authorization: Bearer <JWT_TOKEN>
```

---

## Example cURL Flow

```bash
# 1) Get token
TOKEN=$(curl -s -X POST http://localhost:8080/auth/token \
  -H 'Content-Type: application/json' \
  -d '{"sub":"demo-client","role":"consumer"}' | jq -r .token)

# 2) Access protected endpoint
curl -s http://localhost:8080/api/posts \
  -H "Authorization: Bearer $TOKEN"

# 3) Scrape metrics
curl -s http://localhost:8080/metrics
```

---

## Production Hardening Recommendations

- Rotate and manage `JWT_SECRET` in a secure vault.
- Move to asymmetric JWT signing (RS256) for multi-service verification.
- Use Redis-backed distributed rate limiting for multi-instance deployments.
- Add request/response tracing (`X-Request-ID`, OpenTelemetry).
- Protect `/metrics` with network policy or auth in production.
- Add circuit breaker + retries for unstable upstreams.

---

## License

MIT
