# UFA League Tracker — Phased Implementation Plan

**Version:** 1.2 — Vercel + Supabase (Option A)
**Document type:** Developer prompt and implementation guide
**Companion document:** `UFA-League-Tracker-Technical-Specification-v1.1.md`
**Timeline constraint:** Admin needs the tracker live within approximately one week of starting
**Platform:** Next.js deployed on Vercel · Supabase as plain Postgres database
**Approach:** Each phase produces something usable. Do not begin a phase until all exit criteria for the previous phase are confirmed passing.

---

## How to Use This Document

This plan is structured to be used as a prompt for an LLM-assisted development session or handed directly to a developer. Each phase:

- States exactly what to build
- States what not to build yet
- Provides explicit test cases to run before moving on
- Flags the most likely failure points
- Is ordered by launch priority — Phases 1–4 are the minimum needed before the first match

The technical specification (`UFA-League-Tracker-Technical-Specification-v1.1.md`) is the authoritative source for all field definitions, business rules, and data relationships. This document tells you the order to build things and how to verify each step. When in doubt, the spec takes precedence.

The Pick'em system is a separate build. The league tracker must be fully functional without it. Integration points for Pick'em are called out explicitly and can be ignored until the tracker is stable.

---

## Platform Architecture

**Next.js on Vercel** handles both the frontend and backend in a single codebase. Public pages are server-rendered Next.js pages. All write operations and protected reads go through Next.js API routes (`/app/api/...` or `/pages/api/...`), which Vercel deploys as individual serverless functions.

**Supabase** provides a managed Postgres database. The application connects to it as a plain Postgres database using a standard connection string. Supabase's client library, Row Level Security, and Auth features are not used — all logic lives in Next.js API routes.

This means:
- The database credentials never reach the browser
- All business logic is in Next.js, not in database policies
- Supabase is purely the data store — it could be swapped for any other Postgres host without changing application code

---

## System Constraints (Apply to All Phases)

These rules apply throughout the entire build. Never violate them regardless of phase:

- All timestamps stored and displayed in **Maldives Time (MVT, UTC+5)**. No timezone conversion anywhere.
- **All public pages are server-rendered.** Never fetch directly from Supabase in the browser. All database access goes through Next.js server components or API routes.
- **All public pages are read-only.** No data can be written by a visitor. All writes go through admin API routes protected by JWT middleware.
- **Single admin login.** JWT stored in an httpOnly cookie. No server-side sessions — Vercel's serverless functions are stateless between invocations.
- **Mobile-first on all public pages.** Every page must render correctly at 390px width and look good as a phone screenshot.
- **Atomic result entry.** All result data commits together or not at all — use explicit Postgres transactions.
- **Last save is authoritative.** Admin can overwrite any result at any time.
- **Serverless connection pooling.** Always use the Supabase pooler connection string (port 6543, Transaction mode), never the direct connection string (port 5432). Every serverless function invocation opens a new connection — the pooler prevents exhausting Postgres connection limits.

---

##  Path for Launch

The minimum viable state before the first match is played:

1. Supabase project provisioned and schema created
2. Teams and players seeded
3. Vercel project created and connected to the repository
4. Environment variables set in Vercel
5. Admin can log in and create a fixture
6. Public can view the fixture list and match pages

**Phases 0–4 cover the critical path. Phases 5–6 complete the system.**

---

## Phase 0 — Infrastructure Setup

### Objective

Provision all external services, create the project skeleton, and verify the full deployment pipeline works end-to-end before writing any application logic. Nothing ships to users in this phase — the goal is a deployed "Hello World" connected to a live database.

### What to Build

**0.1 — Supabase project**

1. Create a Supabase account at supabase.com
2. Create a new project
   - Name: "ufa-league"
   - Region: India — closest available region to Maldives
   - Password: generate a strong password and save it in a password manager
3. Wait for the project to finish provisioning (2–3 minutes)
4. Navigate to **Project Settings → Database → Connection string**
   - Select **URI** format
   - Select **Transaction** mode (this is the pooler)
   - Copy the connection string — it will look like:
     `postgresql://postgres.xxxx:PASSWORD@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`
   - This is your `DATABASE_URL`. The port **must be 6543** — if it shows 5432 you have the wrong string.
5. Also note the **direct connection string** (port 5432) — you will use this only for running migrations locally, never in deployed code

**0.2 — Next.js project**

```bash
npx create-next-app@latest ufa-league --typescript --tailwind --app --no-src-dir
cd ufa-league
```

Use the App Router (`--app` flag). TypeScript and Tailwind are both recommended. Do not select any additional options during setup.

Install the database client:

```bash
npm install postgres
```

The `postgres` npm package (`import postgres from 'postgres'`) is the recommended client. It is lightweight, has excellent TypeScript support, and handles the connection correctly with Vercel's serverless model.

Do not install `@supabase/supabase-js` — that is the Supabase client library for Option B. It is not needed and would add unnecessary complexity.

**0.3 — Database client module**

Create a single shared database client file. This file is imported by every API route that needs database access.

```typescript
// lib/db.ts
import postgres from 'postgres'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set')
}

// 'max: 1' is critical for serverless — each function instance
// should hold at most one connection to avoid overwhelming the pooler
const sql = postgres(process.env.DATABASE_URL, {
  max: 1,
  ssl: 'require',
})

export default sql
```

`max: 1` is the critical setting for Vercel. Each serverless function instance handles one request at a time anyway — a pool of more than 1 per instance wastes connections without any benefit.

**0.4 — Environment variables**

Create a `.env.local` file in the project root for local development:

```
DATABASE_URL=postgresql://postgres.xxxx:PASSWORD@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
ADMIN_PASSWORD_HASH=  # fill in after Phase 2
JWT_SECRET=           # generate: openssl rand -base64 32
```

**Never commit `.env.local` to the repository.** Confirm `.env.local` is in `.gitignore` before the first commit.

**0.5 — Vercel project**

1. Push the Next.js project to a GitHub repository (public or private)
2. Go to vercel.com, create an account, and click "Add New Project"
3. Import the GitHub repository
4. Vercel will auto-detect Next.js — accept all defaults
5. Before clicking Deploy, go to **Environment Variables** and add:
   - `DATABASE_URL` — the pooler connection string from Supabase (port 6543)
   - `JWT_SECRET` — the same value as in your local `.env.local`
   - `ADMIN_PASSWORD_HASH` — leave blank for now, add in Phase 2
6. Deploy

**0.6 — Verify the pipeline**

Create a test API route to confirm the database connection works in production:

```typescript
// app/api/health/route.ts
import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const result = await sql`SELECT 1 AS ok`
    return NextResponse.json({ status: 'ok', db: result[0].ok })
  } catch (error) {
    return NextResponse.json({ status: 'error', message: String(error) }, { status: 500 })
  }
}
```

After deploying, visit `https://your-project.vercel.app/api/health`. It must return `{"status":"ok","db":1}`. If it returns an error, the database connection is broken — fix before proceeding.

Remove or protect this route before launch (it confirms the database is reachable, which is minor information disclosure).

### What NOT to Build Yet

- No schema
- No admin panel
- No public pages

### Exit Criteria

Before moving to Phase 1, confirm all of the following:

- [ ] Supabase project created in India region
- [ ] Pooler connection string confirmed as port 6543, Transaction mode
- [ ] Next.js project created with TypeScript, Tailwind, App Router
- [ ] `postgres` npm package installed
- [ ] `lib/db.ts` created with `max: 1` and `ssl: 'require'`
- [ ] `.env.local` created with `DATABASE_URL` — confirmed not committed to git
- [ ] Vercel project created and connected to GitHub repository
- [ ] `DATABASE_URL` and `JWT_SECRET` set in Vercel environment variables
- [ ] Health check endpoint returns `{"status":"ok","db":1}` on the deployed Vercel URL
- [ ] Health check returns the same on localhost (`npm run dev`)

### Likely Failure Points

- Using the direct connection string (port 5432) instead of the pooler (port 6543) — the health check will pass locally but fail under any concurrent load on Vercel. Verify the port in the connection string explicitly.
- `ssl: 'require'` missing in `lib/db.ts` — Supabase requires SSL. Connections without it will be rejected in production. Local development may work without it depending on your machine's configuration, masking the issue.
- `DATABASE_URL` not set in Vercel environment variables — the deployment will succeed but every API route will throw "DATABASE_URL environment variable is not set" at runtime.
- Committing `.env.local` — check `.gitignore` includes `.env.local` before the first push. If credentials are committed, rotate the Supabase database password immediately.

---

## Phase 1 — Database Schema

### Objective

Create the complete database schema in Supabase. No application code changes yet — this phase is entirely in the Supabase SQL editor. The goal is a verified, correctly structured database.

### What to Build

**1.1 — Run schema SQL in Supabase SQL editor**

Navigate to your Supabase project → **SQL Editor** → **New query**. Run the following in order:

```sql
-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. seasons
CREATE TABLE seasons (
  season_id    uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  season_name  varchar      NOT NULL,
  start_date   date         NOT NULL,
  end_date     date         NOT NULL,
  break_start  date,
  break_end    date,
  status       varchar      NOT NULL DEFAULT 'setup'
               CHECK (status IN ('setup','active','break','resuming','complete')),
  created_at   timestamptz  NOT NULL DEFAULT now()
);

-- 2. teams
CREATE TABLE teams (
  team_id     uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id   uuid         NOT NULL REFERENCES seasons(season_id),
  team_name   varchar      NOT NULL,
  created_at  timestamptz  NOT NULL DEFAULT now()
);

-- 3. players
CREATE TABLE players (
  player_id     uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id     uuid         NOT NULL REFERENCES seasons(season_id),
  team_id       uuid         NOT NULL REFERENCES teams(team_id),
  display_name  varchar      NOT NULL,
  is_active     boolean      NOT NULL DEFAULT true,
  created_at    timestamptz  NOT NULL DEFAULT now()
);

-- 4. fixtures
CREATE TABLE fixtures (
  match_id       uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id      uuid         NOT NULL REFERENCES seasons(season_id),
  home_team_id   uuid         NOT NULL REFERENCES teams(team_id),
  away_team_id   uuid         NOT NULL REFERENCES teams(team_id),
  kickoff_time   timestamptz  NOT NULL,
  venue          varchar      NOT NULL DEFAULT 'Vilimale Turf',
  status         varchar      NOT NULL DEFAULT 'scheduled'
                 CHECK (status IN ('scheduled','live','complete','postponed','cancelled')),
  matchweek      integer      NOT NULL,
  created_at     timestamptz  NOT NULL DEFAULT now(),
  updated_at     timestamptz  NOT NULL DEFAULT now(),
  CHECK (home_team_id != away_team_id)
);

-- 5. match_results
CREATE TABLE match_results (
  match_result_id  uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id         uuid         NOT NULL UNIQUE REFERENCES fixtures(match_id),
  score_home       integer      NOT NULL CHECK (score_home >= 0 AND score_home <= 11),
  score_away       integer      NOT NULL CHECK (score_away >= 0 AND score_away <= 11),
  mvp_player_id    uuid         NOT NULL REFERENCES players(player_id),
  resolved_at      timestamptz  NOT NULL DEFAULT now()
);

-- 6. player_match_stats
CREATE TABLE player_match_stats (
  stat_id    uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id   uuid         NOT NULL REFERENCES fixtures(match_id),
  player_id  uuid         NOT NULL REFERENCES players(player_id),
  team_id    uuid         NOT NULL REFERENCES teams(team_id),
  goals      integer      NOT NULL DEFAULT 0 CHECK (goals >= 0),
  assists    integer      NOT NULL DEFAULT 0 CHECK (assists >= 0),
  blocks     integer      NOT NULL DEFAULT 0 CHECK (blocks >= 0),
  UNIQUE (player_id, match_id)
);

-- 7. match_absences
CREATE TABLE match_absences (
  absence_id  uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id    uuid  NOT NULL REFERENCES fixtures(match_id),
  player_id   uuid  NOT NULL REFERENCES players(player_id),
  team_id     uuid  NOT NULL REFERENCES teams(team_id),
  UNIQUE (player_id, match_id)
);

-- 8. spirit_nominations
CREATE TABLE spirit_nominations (
  nomination_id        uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id             uuid  NOT NULL REFERENCES fixtures(match_id),
  nominating_team_id   uuid  NOT NULL REFERENCES teams(team_id),
  nominated_player_id  uuid  NOT NULL REFERENCES players(player_id),
  UNIQUE (match_id, nominating_team_id)
);
```

**1.2 — Verify in Supabase table editor**

After running the SQL, navigate to **Table Editor** in Supabase. All eight tables should be visible. Click each one and confirm the columns match the schema above.

**1.3 — Verify the match_players computed query**

Run this in the SQL editor to confirm the attendance query works. You will need a real `match_id` after seeding in Phase 2 — for now, confirm the query parses without error:

```sql
-- Template — replace :match_id with a real UUID after seeding
SELECT p.player_id, p.display_name, p.team_id
FROM players p
WHERE p.team_id IN (
  SELECT home_team_id FROM fixtures WHERE match_id = 'REPLACE_WITH_MATCH_ID'
  UNION
  SELECT away_team_id FROM fixtures WHERE match_id = 'REPLACE_WITH_MATCH_ID'
)
AND p.player_id NOT IN (
  SELECT player_id FROM match_absences WHERE match_id = 'REPLACE_WITH_MATCH_ID'
)
AND p.is_active = true;
```

### What NOT to Build Yet

- No seed data
- No application code beyond `lib/db.ts`
- No API routes

### Exit Criteria

Before moving to Phase 2, confirm all of the following:

- [ ] All eight tables visible in Supabase table editor
- [ ] Foreign key constraint test: attempt `INSERT INTO players (season_id, team_id, display_name) VALUES ('00000000-0000-0000-0000-000000000000', ...)` with a non-existent team_id — confirm error
- [ ] CHECK constraint test: attempt `INSERT INTO fixtures (..., home_team_id, away_team_id, ...) VALUES (..., 'same-uuid', 'same-uuid', ...)` — confirm error
- [ ] Status CHECK test: attempt `INSERT INTO seasons (season_name, start_date, end_date, status) VALUES ('test', '2026-01-01', '2026-12-31', 'invalid')` — confirm error
- [ ] UNIQUE constraint test on player_match_stats — attempt two inserts with same player_id and match_id — confirm error
- [ ] UNIQUE on spirit_nominations — attempt two nominations from the same team in the same match — confirm error
- [ ] Score range test — attempt `score_home = 12` — confirm error
- [ ] From the application side: write a test API route that runs `SELECT COUNT(*) FROM seasons` via `lib/db.ts` and returns the result — confirm it works on the deployed Vercel URL

### Likely Failure Points

- `gen_random_uuid()` not available — resolved by `CREATE EXTENSION IF NOT EXISTS "pgcrypto"` which must run first. Supabase projects have this available but the explicit extension creation ensures it.
- Running table creation in the wrong order — foreign key references require the referenced table to exist first. The numbered order above is correct. Running out of order will produce "relation does not exist" errors.
- Schema visible in table editor but application cannot query it — confirm the application is using the same Supabase project as the SQL editor session. It is easy to accidentally create the schema in a different project if you have multiple Supabase projects.

---

## Phase 2 — Seed Data and Admin Authentication

### Objective

Load all Season 1 teams and players into the database and create the admin login. Uses JWT stored in an httpOnly cookie — required for Vercel's stateless serverless model.

### What to Build

**2.1 — Seed via SQL editor**

Run this in the Supabase SQL editor. This is a one-time operation.

```sql
-- Step 1: Insert Season 1
INSERT INTO seasons (season_id, season_name, start_date, end_date, break_start, break_end, status)
VALUES (
  gen_random_uuid(),
  'Season 1 — 2026',
  '2026-02-20',
  '2026-08-31',
  '2026-06-01',
  '2026-06-30',
  'setup'
);

-- Copy the season_id from the result before running the next steps
-- SELECT season_id FROM seasons WHERE season_name = 'Season 1 — 2026';
```

After getting the `season_id`, insert the five teams:

```sql
-- Step 2: Insert teams (replace SEASON_ID with the actual UUID)
INSERT INTO teams (team_id, season_id, team_name) VALUES
  (gen_random_uuid(), 'SEASON_ID', 'Untitled 1'),
  (gen_random_uuid(), 'SEASON_ID', 'Untitled 2'),
  (gen_random_uuid(), 'SEASON_ID', 'Untitled 3'),
  (gen_random_uuid(), 'SEASON_ID', 'Untitled 4'),
  (gen_random_uuid(), 'SEASON_ID', 'Untitled 5');

-- Copy each team_id before inserting players
-- SELECT team_id, team_name FROM teams WHERE season_id = 'SEASON_ID';
```

Insert all 44 players using the team UUIDs from the previous step:

```sql
-- Step 3: Insert players (replace TEAM_N_ID with actual UUIDs)
INSERT INTO players (season_id, team_id, display_name) VALUES
  -- Team 1
  ('SEASON_ID', 'TEAM_1_ID', 'Azim'),
  ('SEASON_ID', 'TEAM_1_ID', 'Shamin'),
  ('SEASON_ID', 'TEAM_1_ID', 'Miju'),
  ('SEASON_ID', 'TEAM_1_ID', 'Hassan'),
  ('SEASON_ID', 'TEAM_1_ID', 'Maahy'),
  ('SEASON_ID', 'TEAM_1_ID', 'Imma'),
  ('SEASON_ID', 'TEAM_1_ID', 'Jef'),
  ('SEASON_ID', 'TEAM_1_ID', 'Jilaau'),
  ('SEASON_ID', 'TEAM_1_ID', 'Aisha'),
  -- Team 2
  ('SEASON_ID', 'TEAM_2_ID', 'Mode'),
  ('SEASON_ID', 'TEAM_2_ID', 'Finn'),
  ('SEASON_ID', 'TEAM_2_ID', 'Saam'),
  ('SEASON_ID', 'TEAM_2_ID', 'Kat'),
  ('SEASON_ID', 'TEAM_2_ID', 'Afrah'),
  ('SEASON_ID', 'TEAM_2_ID', 'Nawaz'),
  ('SEASON_ID', 'TEAM_2_ID', 'Yoosuf'),
  ('SEASON_ID', 'TEAM_2_ID', 'Hamko'),
  ('SEASON_ID', 'TEAM_2_ID', 'Shabeen'),
  -- Team 3
  ('SEASON_ID', 'TEAM_3_ID', 'Philip'),
  ('SEASON_ID', 'TEAM_3_ID', 'Mateo'),
  ('SEASON_ID', 'TEAM_3_ID', 'Piko'),
  ('SEASON_ID', 'TEAM_3_ID', 'Tiana'),
  ('SEASON_ID', 'TEAM_3_ID', 'Lamath'),
  ('SEASON_ID', 'TEAM_3_ID', 'Shaaif'),
  ('SEASON_ID', 'TEAM_3_ID', 'Kaitlinn'),
  ('SEASON_ID', 'TEAM_3_ID', 'Ma''an'),
  -- Team 4
  ('SEASON_ID', 'TEAM_4_ID', 'Rizam'),
  ('SEASON_ID', 'TEAM_4_ID', 'Jin'),
  ('SEASON_ID', 'TEAM_4_ID', 'Miph'),
  ('SEASON_ID', 'TEAM_4_ID', 'Tanzeem'),
  ('SEASON_ID', 'TEAM_4_ID', 'Aryf'),
  ('SEASON_ID', 'TEAM_4_ID', 'Shazeen'),
  ('SEASON_ID', 'TEAM_4_ID', 'Malaka'),
  ('SEASON_ID', 'TEAM_4_ID', 'Aahil'),
  ('SEASON_ID', 'TEAM_4_ID', 'Maeesh'),
  -- Team 5
  ('SEASON_ID', 'TEAM_5_ID', 'Zayyan'),
  ('SEASON_ID', 'TEAM_5_ID', 'Fauz'),
  ('SEASON_ID', 'TEAM_5_ID', 'Muky'),
  ('SEASON_ID', 'TEAM_5_ID', 'Uraiba'),
  ('SEASON_ID', 'TEAM_5_ID', 'Moadz'),
  ('SEASON_ID', 'TEAM_5_ID', 'Junayd'),
  ('SEASON_ID', 'TEAM_5_ID', 'Amsal'),
  ('SEASON_ID', 'TEAM_5_ID', 'Babaa'),
  ('SEASON_ID', 'TEAM_5_ID', 'Eijaz');
```

> Note: `Ma'an` contains an apostrophe. In SQL it is escaped as `Ma''an` (two single quotes). Confirm this inserts correctly by querying the row back.

**2.2 — Admin authentication with JWT**

Vercel serverless functions are stateless — no in-memory session survives between invocations. Admin authentication must use JWT stored in an httpOnly cookie.

Install dependencies:

```bash
npm install jose bcryptjs
npm install --save-dev @types/bcryptjs
```

`jose` is a lightweight JWT library that works in both Node.js and Vercel's Edge Runtime. `bcryptjs` handles password hashing.

**Generate the admin password hash.** Run this once locally:

```bash
node -e "const b = require('bcryptjs'); b.hash('YOUR_ADMIN_PASSWORD', 12).then(h => console.log(h))"
```

Copy the output hash and add it to Vercel environment variables as `ADMIN_PASSWORD_HASH`. Also add it to `.env.local`.

**JWT utility module:**

```typescript
// lib/auth.ts
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const secret = new TextEncoder().encode(process.env.JWT_SECRET)
const COOKIE_NAME = 'ufa_admin_session'
const EXPIRY = '7d'

export async function signAdminToken() {
  return new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(EXPIRY)
    .setIssuedAt()
    .sign(secret)
}

export async function verifyAdminToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret)
    return payload.role === 'admin'
  } catch {
    return false
  }
}

export async function getAdminSession(): Promise<boolean> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return false
  return verifyAdminToken(token)
}

export const COOKIE_NAME_EXPORT = COOKIE_NAME
```

**Login API route:**

```typescript
// app/api/admin/login/route.ts
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { signAdminToken, COOKIE_NAME_EXPORT } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { password } = await req.json()

  const valid = await bcrypt.compare(
    password,
    process.env.ADMIN_PASSWORD_HASH!
  )

  if (!valid) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const token = await signAdminToken()

  const response = NextResponse.json({ ok: true })
  response.cookies.set(COOKIE_NAME_EXPORT, token, {
    httpOnly: true,      // not accessible from JavaScript
    secure: true,        // HTTPS only
    sameSite: 'strict',  // CSRF protection
    maxAge: 60 * 60 * 24 * 7,  // 7 days in seconds
    path: '/',
  })

  return response
}
```

**Admin middleware — protect all `/admin` routes:**

```typescript
// middleware.ts (at project root, not inside app/)
import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const secret = new TextEncoder().encode(process.env.JWT_SECRET)

export async function middleware(req: NextRequest) {
  const isAdminRoute = req.nextUrl.pathname.startsWith('/admin') ||
                       req.nextUrl.pathname.startsWith('/api/admin')
  const isLoginRoute = req.nextUrl.pathname === '/admin/login' ||
                       req.nextUrl.pathname === '/api/admin/login'

  if (!isAdminRoute || isLoginRoute) return NextResponse.next()

  const token = req.cookies.get('ufa_admin_session')?.value

  if (!token) {
    return NextResponse.redirect(new URL('/admin/login', req.url))
  }

  try {
    const { payload } = await jwtVerify(token, secret)
    if (payload.role !== 'admin') throw new Error('Not admin')
    return NextResponse.next()
  } catch {
    return NextResponse.redirect(new URL('/admin/login', req.url))
  }
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
}
```

> The middleware runs on every request matching the pattern before the route handler executes. No admin route can be reached without a valid JWT — even direct API calls are blocked.

**Admin login page:**

```typescript
// app/admin/login/page.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminLogin() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (res.ok) {
      router.push('/admin/dashboard')
    } else {
      setError('Invalid password')
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        placeholder="Admin password"
      />
      {error && <p>{error}</p>}
      <button type="submit">Log in</button>
    </form>
  )
}
```

### What NOT to Build Yet

- No public-facing pages
- No fixture creation UI
- No result entry

### Exit Criteria

Before moving to Phase 3, confirm all of the following:

- [ ] Season 1 record exists in Supabase — verify in table editor
- [ ] All 5 teams exist, linked to Season 1
- [ ] All 44 players exist on the correct teams — run `SELECT team_id, COUNT(*) FROM players GROUP BY team_id` and confirm 9, 9, 8, 9, 9
- [ ] `Ma'an` stored correctly — query `SELECT display_name FROM players WHERE display_name LIKE '%an'` and confirm it returns `Ma'an`
- [ ] `ADMIN_PASSWORD_HASH` set in Vercel environment variables (not the plaintext password)
- [ ] Admin login at `/admin/login` succeeds with the correct password
- [ ] Admin login sets an httpOnly cookie — open browser DevTools → Application → Cookies and confirm `ufa_admin_session` is present and `httpOnly` is checked
- [ ] Visiting `/admin/dashboard` without the cookie redirects to `/admin/login`
- [ ] Visiting `/api/admin/anything` without the cookie returns a redirect, not data
- [ ] Wrong password returns 401 and does not set a cookie
- [ ] Session persists across page refreshes (cookie is still present)
- [ ] JWT expiry is 7 days — decode the token at jwt.io and confirm the `exp` claim

### Likely Failure Points

- Using `localStorage` or `sessionStorage` for the JWT instead of an httpOnly cookie — these are accessible from JavaScript and cannot be used securely. Always use httpOnly cookies.
- `JWT_SECRET` not matching between local and Vercel — if tokens signed locally cannot be verified on Vercel, the secrets differ. Copy the exact same value to both places.
- Middleware not protecting API routes — the `matcher` pattern must include `/api/admin/:path*`. Test by sending a direct `curl` or Postman request to an admin API route without a cookie.
- `bcryptjs` vs `bcrypt` — use `bcryptjs`, not `bcrypt`. The native `bcrypt` package requires compilation and can fail on Vercel's build environment. `bcryptjs` is pure JavaScript and always works.

---

## Phase 3 — Setup Wizard and Fixture Management

### Objective

Build the admin setup wizard and fixture management tools. At the end of this phase, admin can rename teams, create fixtures, and launch the league as live. This is the critical path to the first match.

### What to Build

**3.1 — API route pattern for admin writes**

All admin write operations follow this pattern. Establish it in Phase 3 and reuse throughout:

```typescript
// app/api/admin/teams/[teamId]/route.ts — example: rename a team
import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { teamId: string } }
) {
  // Auth is handled by middleware — no check needed here
  const { team_name } = await req.json()

  if (!team_name?.trim()) {
    return NextResponse.json({ error: 'team_name is required' }, { status: 400 })
  }

  const result = await sql`
    UPDATE teams
    SET team_name = ${team_name.trim()}
    WHERE team_id = ${params.teamId}
    RETURNING team_id, team_name
  `

  if (result.length === 0) {
    return NextResponse.json({ error: 'Team not found' }, { status: 404 })
  }

  return NextResponse.json(result[0])
}
```

Note: middleware has already verified the JWT before this handler runs. No auth check is needed inside the handler itself.

**3.2 — Setup wizard pages**

Four-step wizard at `/admin/setup`. Each step is a client component that calls admin API routes. Data flows from the database — never hardcoded in the frontend.

Step 1 — season review: fetch from `/api/admin/season`, display fields, allow editing end date.

Step 2 — team naming: fetch from `/api/admin/teams`, display each team with roster, inline name editing via PATCH to `/api/admin/teams/[teamId]`.

Step 3 — fixture creation: fixture form with pairing grid. Fixture creation via POST to `/api/admin/fixtures`.

Step 4 — launch: summary count, "Go live" button calls PATCH to `/api/admin/season/status` with `{ status: 'active' }`.

**3.3 — Fixture creation API route**

```typescript
// app/api/admin/fixtures/route.ts
import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'

export async function POST(req: NextRequest) {
  const { season_id, home_team_id, away_team_id, kickoff_time, venue, matchweek } =
    await req.json()

  // kickoff_time arrives as an ISO string from the form
  // Store directly — Postgres will handle the timestamptz correctly
  // The form must submit times in MVT (UTC+5) as an offset-aware ISO string
  // e.g. "2026-03-10T20:30:00+05:00"

  const result = await sql`
    INSERT INTO fixtures
      (season_id, home_team_id, away_team_id, kickoff_time, venue, matchweek)
    VALUES
      (${season_id}, ${home_team_id}, ${away_team_id},
       ${kickoff_time}, ${venue ?? 'Vilimale Turf'}, ${matchweek})
    RETURNING *
  `

  return NextResponse.json(result[0], { status: 201 })
}
```

**Kickoff time and MVT — important detail:**

Postgres stores `timestamptz` in UTC internally and converts on retrieval. To keep all times in MVT as specified, always submit kickoff times as offset-aware ISO strings with `+05:00`:

```
2026-03-10T20:30:00+05:00
```

When reading back, convert to MVT for display:

```typescript
const mvtTime = new Date(kickoff_time).toLocaleString('en-MV', {
  timeZone: 'Indian/Maldives',
  // Indian/Maldives is the IANA timezone identifier for MVT (UTC+5)
})
```

The IANA timezone for Maldives is `Indian/Maldives`. Use this string everywhere a timezone identifier is needed — not `UTC+5` or `MVT`.

**3.4 — Next available Tuesday/Friday helper**

```typescript
// lib/schedule.ts
export function nextGameDay(): Date {
  const now = new Date()
  // Convert to MVT for calculation
  const mvt = new Date(now.toLocaleString('en-US', { timeZone: 'Indian/Maldives' }))
  const day = mvt.getDay() // 0=Sun, 2=Tue, 5=Fri

  let daysUntilNext = 0
  if (day === 2 && mvt.getHours() < 20) daysUntilNext = 0  // today is Tuesday, before 20:30
  else if (day === 5 && mvt.getHours() < 20) daysUntilNext = 0  // today is Friday, before 20:30
  else if (day < 2) daysUntilNext = 2 - day
  else if (day < 5) daysUntilNext = 5 - day
  else daysUntilNext = 7 - day + 2  // next Tuesday

  const next = new Date(mvt)
  next.setDate(mvt.getDate() + daysUntilNext)
  next.setHours(20, 30, 0, 0)
  return next
}
```

### What NOT to Build Yet

- No public-facing pages
- No result entry
- No standings

### Exit Criteria

Before moving to Phase 4, confirm all of the following:

- [ ] Team rename works via PATCH and persists in Supabase — confirm in table editor after renaming
- [ ] Fixture creation via POST creates a row in `fixtures` — confirm in table editor
- [ ] Fixture with same team on both sides is rejected (database CHECK constraint fires)
- [ ] `kickoff_time` stored in Supabase is offset-aware — query `SELECT kickoff_time AT TIME ZONE 'Indian/Maldives' FROM fixtures` and confirm it shows 20:30
- [ ] Wizard "Go live" transitions season status to `active` — confirm in table editor
- [ ] Pairing grid counts update immediately after creating a fixture
- [ ] Next Tuesday/Friday helper returns a future date in MVT when called on different days of the week

### Likely Failure Points

- Kickoff time submitted as a naive datetime string without timezone offset (`2026-03-10T20:30:00` without `+05:00`) — Postgres will interpret this as UTC, storing it 5 hours behind MVT. Always include the offset when inserting.
- `Indian/Maldives` vs `MVT` — `MVT` is not a valid IANA timezone identifier and will throw in `Intl` APIs. Always use `Indian/Maldives`.
- Middleware not running on the setup wizard pages — confirm the `matcher` in `middleware.ts` covers `/admin/:path*` which includes `/admin/setup`.

---

## Phase 4 — Public Pages

### Objective

Build all public-facing pages. Server-rendered with Next.js App Router. Mobile-first. Screenshot-worthy match summary page.

### What to Build

**4.1 — Server-side data fetching pattern**

All public pages fetch data server-side using async React Server Components. No client-side fetching for initial page content — this ensures good performance on mobile and correct Open Graph tags for social sharing.

```typescript
// app/fixtures/page.tsx — example server component
import sql from '@/lib/db'

export default async function FixturesPage() {
  const fixtures = await sql`
    SELECT f.match_id, f.kickoff_time, f.status, f.matchweek,
           ht.team_name AS home_team_name,
           at.team_name AS away_team_name,
           mr.score_home, mr.score_away
    FROM fixtures f
    JOIN teams ht ON ht.team_id = f.home_team_id
    JOIN teams at ON at.team_id = f.away_team_id
    LEFT JOIN match_results mr ON mr.match_id = f.match_id
    ORDER BY f.kickoff_time ASC
  `

  return (
    <div>
      {fixtures.map(f => (
        <a key={f.match_id} href={`/match/${f.match_id}`}>
          {f.home_team_name} vs {f.away_team_name}
        </a>
      ))}
    </div>
  )
}
```

Server components run on Vercel's serverless infrastructure — `sql` from `lib/db.ts` works identically here as in API routes.

**4.2 — Open Graph tags for social sharing**

Every match page must have Open Graph metadata so it previews correctly when shared on WhatsApp and Instagram. In Next.js App Router:

```typescript
// app/match/[matchId]/page.tsx
import type { Metadata } from 'next'
import sql from '@/lib/db'

export async function generateMetadata(
  { params }: { params: { matchId: string } }
): Promise<Metadata> {
  const [match] = await sql`
    SELECT ht.team_name AS home, at.team_name AS away,
           mr.score_home, mr.score_away, f.kickoff_time
    FROM fixtures f
    JOIN teams ht ON ht.team_id = f.home_team_id
    JOIN teams at ON at.team_id = f.away_team_id
    LEFT JOIN match_results mr ON mr.match_id = f.match_id
    WHERE f.match_id = ${params.matchId}
  `

  const title = match.score_home != null
    ? `${match.home} ${match.score_home}–${match.score_away} ${match.away}`
    : `${match.home} vs ${match.away}`

  return {
    title,
    openGraph: {
      title,
      description: 'UFA League 2026 — Season 1',
      siteName: 'UFA League',
    },
  }
}

export default async function MatchPage({ params }: { params: { matchId: string } }) {
  // page content
}
```

**4.3 — Revalidation strategy**

By default, Next.js App Router server components cache aggressively. For a site where data changes when admin enters results, configure revalidation:

```typescript
// app/layout.tsx or per-page
export const revalidate = 0  // always fetch fresh — appropriate for Season 1 traffic
```

`revalidate = 0` disables caching entirely and fetches fresh data on every request. This is correct for Season 1 — your traffic volume is small enough that this causes no performance issues and it ensures standings and match results are always current. If you later need caching, increment to a time in seconds (e.g. `revalidate = 30`).

Alternatively, use `export const dynamic = 'force-dynamic'` for the same effect.

**4.4 — Match summary page mobile layout**

The match page must render well as a phone screenshot. Use Tailwind classes designed for a single-column mobile layout. Key layout requirements from the spec:

- Score is the most visually prominent element — use large text (`text-6xl` or similar)
- Team names full and bold above the score (`text-2xl font-bold`)
- Top stats section immediately below score, before stat tables
- Absent players styled differently (`text-gray-400 italic`)
- Avoid any navigation or sidebar elements that appear in the screenshot zone on mobile — use a sticky header that scrolls out of view, or a minimal header that is small enough not to dominate the screenshot

**4.5 — Page list**

Build all pages from the spec Section 9:

```
/                     Home — standings summary, next fixtures, last result
/fixtures             Fixture list with Upcoming / Completed / All filter
/match/[matchId]      Match summary (pre-result and post-result states)
/standings            Full standings table
/teams                Five team cards
/team/[teamId]        Team page — roster, record, recent results
/player/[playerId]    Player page — season stats, match-by-match breakdown
/spirit               Spirit nominations leaderboard
```

### Exit Criteria

Before moving to Phase 5, confirm all of the following:

- [ ] All eight pages render without error on localhost and on the Vercel deployment
- [ ] All pages render correctly at 390px width — test on an actual phone
- [ ] Match summary post-result layout screenshot looks clean — take an actual phone screenshot and review
- [ ] Open Graph tags verified — paste the deployed match page URL into `https://opengraph.xyz` and confirm title and description appear correctly
- [ ] Server-rendered — view page source on a public page and confirm the content (team names, scores) is in the HTML, not loaded by JavaScript after render
- [ ] `revalidate = 0` or `force-dynamic` set — edit a team name in Supabase directly and confirm it appears on the public team page within 1 request (no stale cache)
- [ ] Admin navigation link visible but small — does not dominate the screenshot area
- [ ] `Indian/Maldives` timezone used in all time displays — confirm kickoff times show 20:30 MVT on the fixtures page

### Likely Failure Points

- Caching serving stale data — if `revalidate` is not set, Next.js may cache the first render indefinitely. An admin entering a result would not see it on the public page. Set `revalidate = 0` globally during development and testing.
- `sql` used in a client component — the `postgres` client is a Node.js library and cannot run in the browser. Any component with `'use client'` at the top cannot import `lib/db.ts`. If you need dynamic updates on the client, fetch from an API route instead.
- Open Graph image not rendering on WhatsApp — WhatsApp scrapes `og:image` for previews. Without an image URL in the OG tags, WhatsApp shows only text. For Season 1 this is acceptable — add `og:image` if rich previews become important.

---

## Phase 5 — Result Entry and Standings

### Objective

Build the admin result entry panel and standings calculation. Result entry runs as an atomic Postgres transaction. Pick'em resolution (if Pick'em is built) runs in the same transaction.

### What to Build

**5.1 — Atomic result entry API route**

```typescript
// app/api/admin/results/route.ts
import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'

export async function POST(req: NextRequest) {
  const {
    match_id,
    score_home,
    score_away,
    mvp_player_id,
    player_stats,   // array of { player_id, team_id, goals, assists, blocks }
    absences,       // array of { player_id, team_id }
    spirit,         // array of { nominating_team_id, nominated_player_id }
  } = await req.json()

  await sql.begin(async (tx) => {
    // 1. Write match result
    await tx`
      INSERT INTO match_results (match_id, score_home, score_away, mvp_player_id)
      VALUES (${match_id}, ${score_home}, ${score_away}, ${mvp_player_id})
      ON CONFLICT (match_id) DO UPDATE
        SET score_home = EXCLUDED.score_home,
            score_away = EXCLUDED.score_away,
            mvp_player_id = EXCLUDED.mvp_player_id,
            resolved_at = now()
    `

    // 2. Delete and rewrite player stats (handles re-entry cleanly)
    await tx`DELETE FROM player_match_stats WHERE match_id = ${match_id}`
    if (player_stats.length > 0) {
      await tx`
        INSERT INTO player_match_stats ${tx(
          player_stats.map((s: any) => ({
            match_id,
            player_id: s.player_id,
            team_id: s.team_id,
            goals: s.goals ?? 0,
            assists: s.assists ?? 0,
            blocks: s.blocks ?? 0,
          }))
        )}
      `
    }

    // 3. Delete and rewrite absences
    await tx`DELETE FROM match_absences WHERE match_id = ${match_id}`
    if (absences.length > 0) {
      await tx`
        INSERT INTO match_absences ${tx(
          absences.map((a: any) => ({ match_id, player_id: a.player_id, team_id: a.team_id }))
        )}
      `
    }

    // 4. Delete and rewrite spirit nominations
    await tx`DELETE FROM spirit_nominations WHERE match_id = ${match_id}`
    if (spirit.length > 0) {
      await tx`
        INSERT INTO spirit_nominations ${tx(
          spirit.map((s: any) => ({
            match_id,
            nominating_team_id: s.nominating_team_id,
            nominated_player_id: s.nominated_player_id,
          }))
        )}
      `
    }

    // 5. Set fixture status to complete
    await tx`
      UPDATE fixtures SET status = 'complete', updated_at = now()
      WHERE match_id = ${match_id}
    `

    // 6. Pick'em point allocation runs here if Pick'em is built
    // await resolvePickem(match_id, tx)
  })

  return NextResponse.json({ ok: true })
}
```

`sql.begin()` from the `postgres` package creates an explicit transaction. If any step throws, the entire transaction rolls back. No partial state is possible.

**5.2 — Standings query**

Standings are computed on every request. No stored standings table:

```typescript
// lib/standings.ts
import sql from '@/lib/db'

export async function getStandings(season_id: string) {
  return await sql`
    WITH results AS (
      SELECT
        f.match_id,
        f.home_team_id,
        f.away_team_id,
        mr.score_home,
        mr.score_away
      FROM fixtures f
      JOIN match_results mr ON mr.match_id = f.match_id
      WHERE f.season_id = ${season_id}
    ),
    team_stats AS (
      SELECT
        t.team_id,
        t.team_name,
        COUNT(*) AS played,
        COUNT(*) FILTER (WHERE
          (r.home_team_id = t.team_id AND r.score_home > r.score_away) OR
          (r.away_team_id = t.team_id AND r.score_away > r.score_home)
        ) AS wins,
        COUNT(*) FILTER (WHERE r.score_home = r.score_away) AS draws,
        COUNT(*) FILTER (WHERE
          (r.home_team_id = t.team_id AND r.score_home < r.score_away) OR
          (r.away_team_id = t.team_id AND r.score_away < r.score_home)
        ) AS losses,
        COALESCE(SUM(
          CASE WHEN r.home_team_id = t.team_id THEN r.score_home ELSE r.score_away END
        ), 0) AS goals_for,
        COALESCE(SUM(
          CASE WHEN r.home_team_id = t.team_id THEN r.score_away ELSE r.score_home END
        ), 0) AS goals_against
      FROM teams t
      LEFT JOIN results r ON r.home_team_id = t.team_id OR r.away_team_id = t.team_id
      WHERE t.season_id = ${season_id}
      GROUP BY t.team_id, t.team_name
    )
    SELECT
      team_id,
      team_name,
      played,
      wins,
      draws,
      losses,
      goals_for,
      goals_against,
      goals_for - goals_against AS goal_diff,
      (wins * 3 + draws) AS points
    FROM team_stats
    ORDER BY
      points DESC,
      (goals_for - goals_against) DESC,
      goals_for DESC
  `
}
```

> Head-to-head tiebreaker is not implemented in this query — it requires a subquery comparing only results between the tied teams. Apply it in the application layer after retrieving standings if two teams are level on points and goal difference. For Season 1 this edge case is unlikely; implement it if it arises.

### Exit Criteria

Run these tests using the Appendix A test data:

- [ ] Result entry API accepts the full payload and writes all five data sets atomically
- [ ] Re-entry with a corrected score overwrites correctly — confirm in Supabase table editor
- [ ] Partial failure test: temporarily make one insert fail (e.g. invalid player_id) and confirm no data was written from any step
- [ ] Standings query returns correct points for Team 1 (3) and Team 2 (0) after the Appendix A result
- [ ] GF, GA, GD correct after Appendix A result
- [ ] Top assister tie (Miju, Imma, Kat — all 2 assists) shows all three on match summary page
- [ ] Match summary page shows "Did not play: Hassan" under Team 1 and "Did not play: Nawaz" under Team 2
- [ ] Season complete blocks result entry server-side — send a POST to `/api/admin/results` after marking the season complete and confirm it is rejected

### Likely Failure Points

- `sql.begin()` transaction not used — if the five steps are sequential `await sql` calls without a transaction, a failure on step 3 will leave partial data (result and stats written, absences missing). Always use `sql.begin()`.
- Standing query joining on wrong condition — the LEFT JOIN on results must match on `home_team_id = t.team_id OR away_team_id = t.team_id`. A missing OR clause will exclude half the matches for each team.
- Standings caching — if the standings page has `revalidate` set to a non-zero value, it may show stale standings after result entry. Keep `revalidate = 0` on the standings page.

---

## Phase 6 — Season Lifecycle and Edge Cases

No changes from v1.0. The season status transitions, transfer window player management, and postponement handling are all application logic that works identically on Vercel. The only platform-specific note:

**Season complete blocking result entry** — this check must happen in the API route handler, not just in the UI. The middleware only checks for a valid admin JWT — it does not check season status. Add an explicit check at the start of the result entry handler:

```typescript
const [season] = await sql`
  SELECT status FROM seasons
  JOIN fixtures ON fixtures.season_id = seasons.season_id
  WHERE fixtures.match_id = ${match_id}
`
if (season.status === 'complete') {
  return NextResponse.json({ error: 'Season is complete — result entry is closed' }, { status: 403 })
}
```

---

## Cross-Phase Checklist

Run only after all phases are complete and all exit criteria pass:

- [ ] All timestamps display in MVT — `Indian/Maldives` timezone used consistently, no UTC times visible in the UI
- [ ] Pooler connection string in use (port 6543) — check `DATABASE_URL` in Vercel environment variables
- [ ] No database credentials in source code or committed `.env` files — check git history
- [ ] `max: 1` set in `lib/db.ts` — confirm by reviewing the file
- [ ] All admin routes protected — test every `/admin/*` and `/api/admin/*` route with no cookie and confirm redirect or 401
- [ ] Result entry is atomic — partial failure test passes
- [ ] Open Graph tags on match page — confirmed via opengraph.xyz
- [ ] Mobile screenshots clean — taken on an actual phone, not browser emulator
- [ ] `Indian/Maldives` timezone used everywhere — grep for `UTC+5` and `MVT` in code and replace any instances used as timezone identifiers
- [ ] Season complete blocks result entry at API layer, not just UI

---

## Appendix A: Test Data

*(Unchanged from v1.0 — see previous version)*

---

## Appendix B: Key Rules Summary

*(All business rules unchanged from v1.0)*

---

## Appendix C: Environment Variables Reference

| Variable | Where set | Value |
|---|---|---|
| `DATABASE_URL` | Vercel + `.env.local` | Supabase pooler connection string — port **6543**, Transaction mode |
| `JWT_SECRET` | Vercel + `.env.local` | Random 32-byte base64 string — `openssl rand -base64 32` |
| `ADMIN_PASSWORD_HASH` | Vercel + `.env.local` | bcryptjs hash of admin password — generated locally, never the plaintext |

Never commit any of these values to the repository. If any value is accidentally committed, rotate it immediately: generate a new JWT secret (all existing admin sessions invalidate), change the Supabase database password (update `DATABASE_URL`), and change the admin password (regenerate hash).

---

## Appendix D: NPM Dependencies Reference

| Package | Purpose |
|---|---|
| `postgres` | Postgres client — connects to Supabase via pooler |
| `jose` | JWT signing and verification — stateless admin sessions |
| `bcryptjs` | Password hashing — pure JS, works on Vercel without native compilation |
| `next` | Framework — handles routing, server components, API routes, middleware |
| `tailwindcss` | Styling — included in Next.js setup |

No Supabase packages are required. `@supabase/supabase-js` is explicitly not used.

---

*UFA League Tracker — Phased Implementation Plan v1.2*
*Vercel + Supabase (Option A — Plain Postgres)*
*Read alongside: UFA-League-Tracker-Technical-Specification-v1.1.md*
