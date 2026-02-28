# UFA League Tracker — Claude Code Context

## Project Overview
Full-stack league management web app for the UFA 5v5 mixed Ultimate Frisbee league in Malé, Maldives. Built with Next.js on Vercel + Supabase (plain Postgres). Companion Pick'em prediction game shares the same codebase and database.

**Repo branch:** `claude/build-league-tracker-FyNCE`
**Live URL:** Vercel deployment (check vercel.com dashboard)
**Database:** Supabase India region, pooler port 6543

---

## Tech Stack
- **Framework:** Next.js 16.1.6, React 19, App Router, TypeScript
- **Styling:** Tailwind CSS v4
- **Database:** Supabase as plain Postgres — `postgres` npm package only, NO `@supabase/supabase-js`
- **Auth:** JWT in httpOnly cookie via `jose` + `bcryptjs`
- **Deployment:** Vercel (serverless functions)

## Hard Rules — Never Break These
1. **Timezone:** All times in MVT (UTC+5). IANA identifier: `Indian/Maldives`. Never use `UTC+5` or `MVT` as identifiers.
2. **DB connection:** Always pooler string port **6543** (Transaction mode). Never port 5432 in deployed code.
3. **DB client:** `max: 1` in `lib/db.ts`. One connection per serverless instance.
4. **SSL:** `ssl: 'require'` always in `lib/db.ts`.
5. **Public pages:** Server-rendered only. Never fetch from Supabase in browser. No client-side DB access.
6. **Admin writes:** All writes through `/api/admin/*` routes protected by JWT middleware.
7. **No Supabase client library:** `@supabase/supabase-js` is not installed and must not be used.
8. **Atomic results:** Result entry uses `sql.begin()` transaction — all 5 tables write together or not at all.
9. **Revalidation:** `export const revalidate = 0` on all public pages. No stale cache.
10. **Next.js 16 async params:** All dynamic routes use `await params` pattern — `const { teamId } = await params`.
11. **Kickoff times:** Always submit as offset-aware ISO: `2026-03-10T20:30:00+05:00`.

---

## Current Build Status

### ✅ Complete
- **Phase 0** — Infrastructure (Supabase India, Vercel, `lib/db.ts`, health check)
- **Phase 1** — Database schema (8 tables: seasons, teams, players, fixtures, match_results, player_match_stats, match_absences, spirit_nominations)
- **Phase 2** — Seed data (Season 1, 5 teams, 44 players) + Admin auth (JWT cookie, bcryptjs, middleware)
- **Phase 3** — Setup Wizard + Fixture Management

### ⬜ Not Started
- **Phase 4** — Public pages (8 routes)
- **Phase 5** — Result entry + standings
- **Phase 6** — Season lifecycle + edge cases
- **Pick'em** — Separate build after tracker is complete

---

## Phase 3 — What Was Built

### API Routes
| Route | Methods | Purpose |
|---|---|---|
| `/api/admin/season` | GET, PATCH | Season dates |
| `/api/admin/season/status` | PATCH | Status transitions |
| `/api/admin/teams` | GET | All teams with rosters via `json_agg` |
| `/api/admin/teams/[teamId]` | PATCH | Rename team |
| `/api/admin/fixtures` | GET, POST, DELETE | List/create/clear fixtures |
| `/api/admin/fixtures/[matchId]` | PATCH, DELETE | Edit/delete single fixture |

### Admin Pages
- `app/admin/dashboard/page.tsx` — server component, season stats, links
- `app/admin/login/page.tsx` — login form
- `app/admin/setup/page.tsx` — 4-step wizard (~1250 lines, client component)

### Setup Wizard Steps
1. Season dates (start, break start, break end, end)
2. Team rename (inline PATCH per team, roster shown)
3. Fixtures — auto-scheduler (circle-method double round-robin, 20 fixtures/10 matchweeks), public holiday panel, 5×5 match matrix, calendar view, add/edit/delete fixture form
4. Launch — "Go Live" → season status `active`

### Schedule Utility (`lib/schedule.ts`)
- `nextGameDay()` — next Tue/Fri at 20:30 MVT
- `toDatetimeLocal(d)` — Date → `"YYYY-MM-DDTHH:mm"`
- `toMVTIso(s)` — datetime-local → `"YYYY-MM-DDTHH:mm:00+05:00"`
- `kickoffToInput(utcIso)` — UTC ISO → MVT datetime-local (add 5h)
- `makeMVTKickoff(y, m, d)` — returns `"YYYY-MM-DDT20:30:00+05:00"`

### Known Bugs Fixed in Phase 3
- Date parsing: Supabase returns full ISO timestamps — use `.slice(0, 10)` before `split('-')`
- Auto-scheduler "0 game days": was parsing bug + wrong threshold (`rounds.length` vs `rounds.length * 2 - 1`)

### Phase 3 Amendments — NOT Yet Implemented
1. **Holiday date ranges** — currently individual date strings, needs start+end+name range input
   ```typescript
   interface HolidayRange { id: string; start: string; end: string; name: string }
   ```
2. **Adjust mode** — drag fixture to new calendar date with rule validation (no back-to-back, no holiday, no same-day team conflict)

---

## Phase 4 — What To Build Next

### 8 Public Routes
```
/                     Home (standings summary, next fixture, last result)
/fixtures             Fixture list (Upcoming / Completed / All filter)
/match/[matchId]      Match summary — pre/post result states, mobile-first, OG tags
/standings            Full standings table
/teams                Five team cards
/team/[teamId]        Team page (roster, record, recent results)
/player/[playerId]    Player page (season stats, match-by-match)
/spirit               Spirit nominations leaderboard
```

### Requirements
- Server-rendered (async React Server Components, `sql` from `lib/db.ts`)
- `export const revalidate = 0` on every page
- Mobile-first at **390px width** — must look good as a phone screenshot
- OG tags on `/match/[matchId]` for WhatsApp/Instagram sharing
- Match summary: score is most prominent element (`text-6xl`+), team names large/bold, top stats below score, absent players greyed/italic
- `Indian/Maldives` timezone on all time displays — kickoff shows 20:30 MVT

---

## Phase 5 — What Comes After

- `POST /api/admin/results` — atomic transaction across 5 tables (match_results, player_match_stats, match_absences, spirit_nominations, fixture status update)
- `lib/standings.ts` — computed standings query (W×3 + D, tiebreakers: GD → H2H → GF)
- Admin result entry UI (match select → absent players → scores → per-player stats → MVP → spirit nominees → save)
- Season complete blocks result entry at API level

---

## Database Schema (Quick Reference)

```
seasons       — season_id, season_name, start_date, end_date, break_start, break_end, status
teams         — team_id, season_id, team_name
players       — player_id, season_id, team_id, display_name, is_active
fixtures      — match_id, season_id, home_team_id, away_team_id, kickoff_time (timestamptz), venue, status, matchweek
match_results — match_result_id, match_id (UNIQUE), score_home, score_away, mvp_player_id, resolved_at
player_match_stats — stat_id, match_id, player_id, team_id, goals, assists, blocks; UNIQUE(player_id, match_id)
match_absences     — absence_id, match_id, player_id, team_id
spirit_nominations — nomination_id, match_id, nominating_team_id, nominated_player_id; UNIQUE(match_id, nominating_team_id)
```

Season 1 status: `active` (already launched via wizard)
Teams: 5 teams (renamed from "Untitled 1-5" via wizard)
Players: 44 players (9/9/8/9/9 across teams)

---

## File Structure
```
app/
  admin/
    dashboard/page.tsx    — server component
    login/page.tsx
    setup/page.tsx        — 4-step wizard (client, ~1250 lines)
  api/
    admin/
      fixtures/route.ts + [matchId]/route.ts
      login/route.ts
      season/route.ts + status/route.ts
      teams/route.ts + [teamId]/route.ts
    health/route.ts
  globals.css
  layout.tsx
  page.tsx               — placeholder home
lib/
  auth.ts               — JWT sign/verify, getAdminSession, COOKIE_NAME_EXPORT
  db.ts                 — postgres client (max:1, ssl:require)
  schedule.ts           — game day helpers, auto-scheduler
middleware.ts           — JWT guard for /admin/* and /api/admin/*
docs/
  BUILD-PROGRESS.md
  UFA-League-Tracker-Implementation-Plan-v1.2.md
  UFA-League-Tracker-Technical-Specification-v1.1.md
  UFA-Pickem-Implementation-Plan-v1.2.md
  UFA-Pickem-Technical-Specification-v1.2.md
  seed-season1.sql
```

---

## Season 1 Rosters (Reference)
| Team | Players |
|---|---|
| Frisbeyri | Azim, Shamin, Miju, Hassan, Maahy, Imma, Jef, Jilaau, Aisha |
| Disc Raiders | Mode, Finn, Saam, Kat, Afrah, Nawaz, Yoosuf, Hamko, Shabeen |
| Kanmathee Frisbee Club | Philip, Mateo, Piko, Tiana, Lamath, Shaaif, Kaitlinn, Ma'an |
| Hammerheads | Rizam, Jin, Miph, Tanzeem, Aryf, Shazeen, Malaka, Aahil, Maeesh |
| Disc-functional | Zayyan, Fauz, Muky, Uraiba, Moadz, Junayd, Amsal, Babaa, Eijaz |

Game days: **Tuesday and Friday at 20:30 MVT** — Vilimale Turf

---

## League Rules (for standings/display logic)
- Win: 3pts, Draw: 1pt, Loss: 0pts
- Tiebreaker order: Goal difference → Head-to-head → Goals scored
- Win condition: First to 11 OR leading at 30 minutes
- Format: 5v5 mixed
- Pre-break: 20 fixtures (each team vs each opponent twice)
- Season break: entire June 2026 — transfer window opens

---

## Environment Variables (Vercel + .env.local)
```
DATABASE_URL        — Supabase pooler, port 6543, Transaction mode
JWT_SECRET          — 32-byte base64 random string
ADMIN_PASSWORD_HASH — bcryptjs hash, never plaintext
```

---

## Common Pitfalls to Avoid
- `Indian/Maldives` not `UTC+5` or `MVT` as timezone identifier
- Port 6543 not 5432 for DATABASE_URL
- `await params` in dynamic routes (Next.js 16)
- Date strings from Supabase are full ISO — always `.slice(0, 10)` before date math
- No `@supabase/supabase-js` — use `postgres` npm package only
- `sql.begin()` for any multi-table write — never sequential awaits without transaction
- `kickoff_time` inserts need `+05:00` offset or Postgres stores 5h behind
- `.env.local` values containing `$` must escape as `\$` — Next.js uses `dotenv-expand` which performs `$VAR` interpolation on all values (even single-quoted ones). The `\$` escape survives interpolation and is resolved to `$` afterward. Affects bcrypt hashes and any secret with `$`.