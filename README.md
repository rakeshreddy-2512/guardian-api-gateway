# Guardian - API Gateway

A backend API gateway built with **Next.js API routes** that handles
authentication, rate limiting, and response caching - all backed by a
single Supabase Postgres database. No frontend; this is a pure backend
service meant to be called by other applications, scripts, or tools like
Postman/curl.

## What it does

- **Real user authentication** - signup and login against actual user
  records in Supabase, passwords hashed with bcrypt, JWTs issued only
  after a real credential check (not a "name yourself any role" token
  mill)
- **Rate limiting** - per-user request counters stored in Postgres,
  20 requests per 60-second window, returns `429` once exceeded
- **Response caching** - repeated reads are served from a cache table
  instead of hitting the database again; writes correctly invalidate
  the relevant cache entry
- **Protected resource CRUD** - list, create, and fetch individual
  resources, all gated behind a valid JWT

## Tech stack

- **Next.js 15** (App Router, API routes only - no frontend)
- **Supabase** (Postgres) - users, resources, rate limits, and cache
  all live in one database
- **jsonwebtoken** - JWT signing/verification
- **bcryptjs** - password hashing

Only one external service (Supabase) is required - no Redis, no
MongoDB, no Docker. Kept deliberately simple: one database doing
everything a small gateway needs.

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up Supabase

Create a free project at https://supabase.com, then run this in the
**SQL Editor**:

```sql
create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  role text not null default 'consumer',
  created_at timestamptz not null default now()
);

create table resources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now()
);

create table rate_limits (
  identifier text primary key,
  count int not null default 1,
  window_start timestamptz not null default now()
);

create table cache_entries (
  key text primary key,
  value jsonb not null,
  expires_at timestamptz not null
);

grant select, insert, update, delete on public.users to service_role;
grant select, insert, update, delete on public.resources to service_role;
grant select, insert, update, delete on public.rate_limits to service_role;
grant select, insert, update, delete on public.cache_entries to service_role;
```

From **Project Settings -> API**, copy your **Project URL** and
**service_role** secret key (legacy API keys tab).

### 3. Environment variables

```bash
cp .env.example .env.local
```

Fill in:

NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
JWT_SECRET=any_long_random_string


`NEXT_PUBLIC_SUPABASE_URL` must be the bare project URL - no `/rest/v1/`
suffix, the Supabase client library adds that internally.

### 4. Run it

```bash
npm run dev
```

Server runs at `http://localhost:3000`. There is no page to visit in a
browser - every route is an API endpoint, tested with curl, Postman, or
`Invoke-RestMethod` (PowerShell).

## API reference

### `POST /api/auth/signup`

```json
{ "email": "user@example.com", "password": "at-least-8-chars" }
```

Creates a user, hashes the password, returns the created user record
(no password).

### `POST /api/auth/login`

```json
{ "email": "user@example.com", "password": "at-least-8-chars" }
```

Verifies credentials, returns a JWT:

```json
{ "token": "...", "tokenType": "Bearer", "expiresIn": 3600 }
```

### `GET /api/resource`

Requires `Authorization: Bearer <token>`. Returns up to 50 resources,
most recent first. Response includes `"source": "database"` or
`"source": "cache"` depending on whether it was served fresh or cached.

### `POST /api/resource`

Requires `Authorization: Bearer <token>`.

```json
{ "title": "...", "itemBody": "..." }
```

Creates a resource, invalidates the list cache.

### `GET /api/resource/:id`

Requires `Authorization: Bearer <token>`. Returns a single resource by
id.

## Example flow (PowerShell)

```powershell
# Sign up
$body = @{ email = "test@example.com"; password = "testpass123" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3000/api/auth/signup" -Method Post -ContentType "application/json" -Body $body

# Log in
$login = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" -Method Post -ContentType "application/json" -Body $body
$token = $login.token

# Access protected resource
Invoke-RestMethod -Uri "http://localhost:3000/api/resource" -Method Get -Headers @{ Authorization = "Bearer $token" }

# Create a resource
$new = @{ title = "First resource"; itemBody = "Some content" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3000/api/resource" -Method Post -Headers @{ Authorization = "Bearer $token" } -ContentType "application/json" -Body $new
```

## Known limitations

- Rate limiting and caching are implemented directly in Postgres rather
  than a dedicated cache layer (e.g. Redis). This keeps the project to a
  single external service, at the cost of being somewhat slower under
  very high request volume than an in-memory cache would be.
- No automated cleanup job for expired `cache_entries` or stale
  `rate_limits` rows - they're checked and treated as expired on read,
  but old rows accumulate over time. A scheduled cleanup query would be
  a natural next addition.
- No tests included yet.
- This is a backend-only project with no UI. All interaction is via
  HTTP requests (curl, Postman, or another application).

## Deployment

Deploys cleanly to Vercel:

```bash
npx vercel --prod
```

Add `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and
`JWT_SECRET` as environment variables in your Vercel project settings.
