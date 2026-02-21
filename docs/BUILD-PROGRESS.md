# UFA League Tracker — Build Progress

**Last updated:** 2026-02-21
**Branch:** `claude/build-league-tracker-FyNCE`
**Stack:** Next.js 16.1.6 · React 19 · Tailwind CSS v4 · Supabase (plain Postgres) · Vercel

---

## Phase Status Summary

| Phase | Name | Status |
|---|---|---|
| 0 | Infrastructure Setup | ✅ Complete |
| 1 | Database Schema | ✅ Complete |
| 2 | Seed Data + Admin Auth | ✅ Complete |
| 3 | Setup Wizard + Fixture Management | ✅ Complete (with amendments) |
| 4 | Public Pages | ⬜ Not started |
| 5 | Result Entry + Standings | ⬜ Not started |
| 6 | Season Lifecycle + Edge Cases | ⬜ Not started |

---

## Phase 0 — Infrastructure ✅

- Supabase project provisioned (India region, pooler port 6543)
- Next.js project with TypeScript, Tailwind v4, App Router
- `lib/db.ts` — shared Postgres client (`max: 1`, `ssl: 'require'`)
- `.env.local` in place, not committed
- Vercel project connected to GitHub, environment variables set
- Health check: `GET /api/health` returns `{"status":"ok","db":1}`

---

## Phase 1 — Database Schema ✅

All 8 tables created in Supabase:

| Table | Purpose |
|---|---|
| `seasons` | Season metadata, dates, status |
| `teams` | 5 teams per season |
| `players` | 44 players across 5 teams |
| `fixtures` | Scheduled matches with `kickoff_time` as `timestamptz` |
| `match_results` | Final score + MVP per match |
| `player_match_stats` | Goals, assists, blocks per player per match |
| `match_absences` | Players who did not play |
| `spirit_nominations` | One nomination per team per match |

---

## Phase 2 — Seed Data + Admin Auth ✅

### Seed data
- Season 1 (2026-02-20 → 2026-08-31, break Jun–Jul) with `status = 'setup'`
- 5 teams (Untitled 1–5, renamed via wizard in Phase 3)
- 44 players distributed across teams (9/9/8/9/9)

### Auth files
- `lib/auth.ts` — JWT sign/verify, 7-day expiry, `Indian/Maldives` timezone
- `middleware.ts` — protects all `/admin/*` and `/api/admin/*` routes
- `app/api/admin/login/route.ts` — POST, bcryptjs comparison, sets httpOnly cookie
- `app/admin/login/page.tsx` — login form

---

## Phase 3 — Setup Wizard + Fixture Management ✅

### API routes built

| Route | Methods | Purpose |
|---|---|---|
| `/api/admin/season` | GET, PATCH | Fetch/update season dates (start, end, break_start, break_end) |
| `/api/admin/season/status` | PATCH | Transition season status (`draft` → `active` → `complete`) |
| `/api/admin/teams` | GET | All teams with full player rosters via `json_agg` |
| `/api/admin/teams/[teamId]` | PATCH | Rename a team |
| `/api/admin/fixtures` | GET, POST, DELETE | List / create / clear all fixtures |
| `/api/admin/fixtures/[matchId]` | PATCH, DELETE | Edit / delete a single fixture |

All `[dynamic]` routes use `await params` pattern for Next.js 16 async params.

### Admin pages built

**`app/admin/dashboard/page.tsx`** (server component)
- Shows season status, team/player/fixture counts
- Link to setup wizard

**`app/admin/setup/page.tsx`** (client component, ~1250 lines)
- 4-step wizard with step indicator

### Wizard steps

**Step 1 — Season**
- Edit all 4 date fields: start date, break start, break end, end date
- PATCH to `/api/admin/season` on save

**Step 2 — Teams**
- List all 5 teams with inline rename (PATCH to `/api/admin/teams/[teamId]`)
- Player roster shown per team for reference

**Step 3 — Fixtures** (most complex step)
- Stats bar: fixture count, game day count, slots needed indicator
- Auto-schedule button (circle-method double round-robin, 20 fixtures across 10 matchweeks)
- Public holidays panel (add/remove date ranges; excluded from scheduling; shown orange on calendar)
- Match matrix (5×5 — click a cell to pre-fill the add form)
- Calendar view (all season months; Tue/Fri highlighted blue; breaks dimmed; holidays orange)
- Inline "Add fixture" form (pre-filled from matrix/calendar clicks)
- Fixture list grouped by matchweek with inline edit (all fields) and delete per fixture

**Step 4 — Launch**
- Summary: season name, status, team/player/fixture counts
- "Go Live" button — PATCH to `/api/admin/season/status` → `active`

### Schedule utility — `lib/schedule.ts`

| Function | Purpose |
|---|---|
| `nextGameDay()` | Returns next Tue/Fri at 20:30 MVT |
| `toDatetimeLocal(d)` | Date → `"YYYY-MM-DDTHH:mm"` for datetime-local inputs |
| `toMVTIso(s)` | `"YYYY-MM-DDTHH:mm"` → `"YYYY-MM-DDTHH:mm:00+05:00"` |
| `kickoffToInput(utcIso)` | UTC ISO → MVT datetime-local string (add 5h) |
| `makeMVTKickoff(y, m, d)` | Returns `"YYYY-MM-DDT20:30:00+05:00"` for auto-scheduler |

### Auto-scheduler rules (as implemented)

1. **Circle-method double round-robin** — generates all 10 unique pairings first (single rounds), then reverses for second legs. Guarantees no rematch until every first leg is played.
2. **No back-to-back game days** — with 5 teams every two consecutive rounds share ≥3 players, so rounds are placed on `gameDays[i * 2]` (skipping a rest day between each matchweek). Requires `2n − 1` game-day slots for `n` rounds (10 rounds → 19 slots needed).
3. **No play on public holidays** — `getSeasonGameDays()` filters out any dates in the holiday list.
4. **Two matches per game day allowed** — multiple fixtures can share a kickoff date (each round has 2 games).

### Known bugs fixed in Phase 3

- **Date parsing** — Supabase returns full ISO timestamps (`"2026-02-18T00:00:00+00:00"`). All date arithmetic uses `s.slice(0, 10)` before `split('-')` to avoid `NaN`.
- **Auto-scheduler "found 0 game days"** — was caused by the above parsing bug + validation threshold using `rounds.length` instead of `rounds.length * 2 - 1`.

---

## Pending Work

### Phase 3 amendments not yet implemented

#### 1. Holiday date ranges
Currently holidays are stored as individual `YYYY-MM-DD` strings. Requested change: input a start + end date range with optional name (to block long weekends). Planned interface:
```typescript
interface HolidayRange { id: string; start: string; end: string; name: string }
```
Affects: `getSeasonGameDays`, `buildMonth`, `CalendarView`, `Step3Fixtures` UI, localStorage persistence.

#### 2. Adjust mode
Requested: a toggle in the fixture list that enables dragging/moving fixtures by clicking a destination date on the calendar. Rules:
- Auto-scheduler rules apply (no back-to-back, no holiday, no same-day team conflict)
- Valid target dates highlighted green, invalid dimmed/red, current date amber
- If a move would break rules, user must use the "Edit" button instead (direct edit bypasses rule checking)

---

## Phases 4–6 — Not Started

### Phase 4 — Public pages
All 8 routes to build:
- `/` — Home (standings summary, next fixture, last result)
- `/fixtures` — Fixture list with Upcoming / Completed / All filter
- `/match/[matchId]` — Match summary (pre/post result states, mobile-first, OG tags)
- `/standings` — Full standings table
- `/teams` — Five team cards
- `/team/[teamId]` — Team page (roster, record, recent results)
- `/player/[playerId]` — Player page (season stats, match-by-match)
- `/spirit` — Spirit nominations leaderboard

Requirements: server-rendered, `revalidate = 0`, mobile-first at 390px, `Indian/Maldives` timezone throughout.

### Phase 5 — Result entry + standings
- `POST /api/admin/results` — atomic Postgres transaction across 5 tables
- `lib/standings.ts` — standings computed query (points = W×3 + D)
- Admin result entry UI (not yet designed)

### Phase 6 — Season lifecycle
- Season status transitions (setup → active → break → resuming → complete)
- Season complete blocks result entry at API layer
- Transfer window player management (TBD)
- Postponement handling (TBD)

---

## File Index

```
ufa-league/
├── app/
│   ├── admin/
│   │   ├── dashboard/page.tsx    # Server component dashboard
│   │   ├── login/page.tsx        # Admin login form
│   │   └── setup/page.tsx        # 4-step setup wizard (client)
│   ├── api/
│   │   ├── admin/
│   │   │   ├── fixtures/
│   │   │   │   ├── route.ts              # GET / POST / DELETE all
│   │   │   │   └── [matchId]/route.ts    # PATCH / DELETE single
│   │   │   ├── login/route.ts            # POST — sets JWT cookie
│   │   │   ├── season/
│   │   │   │   ├── route.ts              # GET / PATCH dates
│   │   │   │   └── status/route.ts       # PATCH status
│   │   │   └── teams/
│   │   │       ├── route.ts              # GET with rosters
│   │   │       └── [teamId]/route.ts     # PATCH rename
│   │   └── health/route.ts               # GET db health check
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                          # (placeholder home)
├── lib/
│   ├── auth.ts        # JWT sign/verify, getAdminSession
│   ├── db.ts          # Postgres client (max:1, ssl:require)
│   └── schedule.ts    # Game day helpers, auto-scheduler math
├── middleware.ts       # JWT guard for /admin/* and /api/admin/*
└── docs/
    ├── UFA-League-Tracker-Implementation-Plan-v1.2.md
    ├── UFA-League-Tracker-Technical-Specification-v1.1.md
    ├── BUILD-PROGRESS.md   ← this file
    └── seed-season1.sql
```

---

*Document maintained alongside the codebase. Update after each phase or significant amendment.*
