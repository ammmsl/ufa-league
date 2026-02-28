# UFA League Tracker — Build Progress

**Last updated:** 2026-02-28 (Improvement Plan Phase 5 complete)
**Branch:** `phase-5`
**Stack:** Next.js 16.1.6 · React 19 · Tailwind CSS v4 · Supabase (plain Postgres) · Vercel

---

## Phase Status Summary

| Phase | Name | Status |
|---|---|---|
| 0 | Infrastructure Setup | ✅ Complete |
| 1 | Database Schema | ✅ Complete |
| 2 | Seed Data + Admin Auth | ✅ Complete |
| 3 | Setup Wizard + Fixture Management | ✅ Complete (with amendments) |
| 4 | Public Pages | ✅ Complete |
| 5 | Result Entry + Standings | ⬜ Not started |
| 6 | Season Lifecycle + Edge Cases | ⬜ Not started |

**Improvement Plan Phases (26.02.26)**

| Phase | Name | Status |
|---|---|---|
| 0 | DB Schema (season_holidays + season_mvp_scores) + Holidays API | ✅ Complete |
| 1 | Admin Infrastructure (AdminNav, Dashboard rework, Fixtures stub) | ✅ Complete |
| 2 | Match Page Admin Layer | ✅ Complete |
| 3 | Setup Wizard Rework | ✅ Complete |
| 4 | Fixture Wizard (Postponement) | ✅ Complete |
| 5 | Public Features (Stats, MVP, Rules, Gallery, Form guide, H2H) | ✅ Complete |
| 6 | Integration & End-to-End Verification | ⬜ Not started |

---

## Phase 0 — Infrastructure ✅

- Supabase project provisioned (India region, pooler port 6543)
- Next.js project with TypeScript, Tailwind v4, App Router
- `lib/db.ts` — shared Postgres client (`max: 1`, `ssl: 'require'`, `prepare: false`)
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

Fixture status values: `'scheduled' | 'live' | 'complete' | 'postponed' | 'cancelled'`

---

## Phase 2 — Seed Data + Admin Auth ✅

### Seed data
- Season 1 (2026-02-20 → 2026-08-31, break Jun–Jul) with `status = 'setup'`
- 5 teams (Untitled 1–5, renamed via wizard in Phase 3)
- 44 players distributed across teams (9/9/8/9/9)

### Auth files
- `lib/auth.ts` — JWT sign/verify, 7-day expiry, `Indian/Maldives` timezone
- `proxy.ts` — protects all `/admin/*` and `/api/admin/*` routes (Next.js 16: renamed from `middleware.ts`)
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

**`app/admin/setup/page.tsx`** (client component, ~1400 lines)
- 4-step wizard with step indicator

### Wizard steps

**Step 1 — Season**
- Edit all 4 date fields: start date, break start, break end, end date
- PATCH to `/api/admin/season` on save

**Step 2 — Teams**
- List all 5 teams with inline rename (PATCH to `/api/admin/teams/[teamId]`)
- Player roster shown per team for reference
- **Draft order** — ▲▼ buttons reorder teams; order persisted to localStorage keyed by season_id; Step 3 auto-scheduler respects this order when assigning home/away slots

**Step 3 — Fixtures** (most complex step)
- Stats bar: fixture count, game day count, slots needed indicator
- Auto-schedule button (5-team fixed pairing table, double round-robin, 20 fixtures across 10 matchweeks)
- Public holidays panel — **date ranges** with start, end, and name; backward-compatible with old single-date format; excluded from scheduling; shown orange on calendar
- Match matrix (5×5 — click a cell to pre-fill the add form)
- Calendar view with **Adjust Mode** — toggle to select a fixture (amber highlight), valid move targets shown green, invalid shown red with reason tooltip, click green date PATCHes fixture
- Inline "Add fixture" form (pre-filled from matrix/calendar clicks)
- Fixture list grouped by matchweek with inline edit (all fields) and delete per fixture; Adjust Mode replaces Edit/Delete with selection

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

1. **5-team fixed pairing table** (`FIVE_TEAM_SINGLE_RR` constant): 5 single-leg rounds covering all 10 unique pairs:
   - R1: 1v2, 3v4 (bye: 5)
   - R2: 5v1, 2v3 (bye: 4)
   - R3: 2v4, 3v5 (bye: 1)
   - R4: 1v3, 4v5 (bye: 2)
   - R5: 1v4, 2v5 (bye: 3)
   Then repeated with home/away swapped for the second leg (10 rounds total, 20 fixtures). General circle-method kept as fallback for non-5-team leagues.
2. **No back-to-back game days** — rounds placed on `gameDays[i * 2]`. Adjacent Tue↔Fri slots are 3–4 calendar days apart, caught by `diff <= 4 * 86_400_000` in `isBackToBack()`.
3. **No play on public holidays** — `getSeasonGameDays()` expands `HolidayRange[]` via `buildHolidaySet()` to a flat `Set<string>` for O(1) lookup.
4. **Two matches per game day allowed** — multiple fixtures can share a kickoff date (each round has 2 games).

### Known bugs fixed in Phase 3

- **Date parsing** — Supabase returns full ISO timestamps (`"2026-02-18T00:00:00+00:00"`). All date arithmetic uses `s.slice(0, 10)` before `split('-')` to avoid `NaN`.
- **Auto-scheduler "found 0 game days"** — was caused by the above parsing bug + validation threshold using `rounds.length` instead of `rounds.length * 2 - 1`.
- **`lib/db.ts` missing `prepare: false`** — Supabase pgBouncer transaction mode (port 6543) requires this flag. Without it, postgres package used named prepared statements that can't be routed across multiple backends, causing corrupt wire-protocol responses and 500 errors with empty bodies.
- **`loadAll()` unconditional `.json()` call** — added `res.ok` check before parsing JSON, wrapped in try/catch, added `loadError` state with Retry button to surface DB errors gracefully.

---

## Phase 4 — Public Pages ✅

### Files built

| File | Purpose |
|---|---|
| `lib/standings.ts` | `getStandings(seasonId)` — CTE query, W×3+D points, sorted Pts→GD→GF |
| `app/_components/PublicNav.tsx` | Sticky dark nav (UFA League · Fixtures · Standings · Teams · Spirit) |
| `app/page.tsx` | Home: season banner → next match card → mini standings (top 5) → last result |
| `app/standings/page.tsx` | Full table: P/W/D/L/GF/GA/GD/Pts; GF/GA/GD hidden on mobile |
| `app/fixtures/page.tsx` | All/Upcoming/Completed filter tabs, grouped by matchweek |
| `app/match/[matchId]/page.tsx` | Pre-result: rosters; Post-result: `text-6xl` score + per-player G/A/B + absences + spirit |
| `app/teams/page.tsx` | 1-col mobile / 2-col sm grid of team cards with record |
| `app/team/[teamId]/page.tsx` | Team header → stat tiles → roster list → recent 5 fixtures |
| `app/player/[playerId]/page.tsx` | Season totals (Apps/G/A/B) → match-by-match log |
| `app/spirit/page.tsx` | Spirit nominations leaderboard; empty-state if none recorded |

### Design conventions applied

- Page bg: `bg-gray-950`; cards: `bg-gray-900 rounded-xl`
- Text: `text-white` / `text-gray-400` (muted); accent: `text-green-400` / `text-red-400`
- Score: `text-6xl font-bold tabular-nums`
- Container: `max-w-lg mx-auto px-4 pb-16`
- Mobile-first at 390px; OG tags on `/match/[matchId]`

### Rules applied across all pages

- `export const revalidate = 0` — no stale cache
- Async Server Components only — no `'use client'`
- `const { param } = await params` — Next.js 16 async params
- `timeZone: 'Indian/Maldives'` in all `Intl` calls
- `Number()` wrapping on all SQL aggregates
- `notFound()` from `next/navigation` on invalid IDs

### Bug fixed post-build

- Fixtures filter used `'completed'` but schema value is `'complete'` — corrected in `app/fixtures/page.tsx`

---

## Local Dev Setup

Local development is now working. Key findings recorded here for future reference:

- **`proxy.ts`** is the Next.js 16 convention (replaces `middleware.ts`). The file index below still said `middleware.ts` — corrected.
- **Cookie `secure` flag** — set to `process.env.NODE_ENV === 'production'` so httpOnly cookie is sent over plain HTTP on localhost.
- **`next.config.ts`** — added `turbopack.root: path.resolve(__dirname)` to fix workspace root misdetection (Next.js was picking up a stray `package-lock.json` at `C:\Users\Amsal\`).
- **`.env.local` dollar-sign escaping** — `dotenv-expand` (used internally by Next.js) performs `$VAR` interpolation on all env values. Any value containing `$` (bcrypt hashes, JWT secrets) must escape dollar signs as `\$`. The escape is resolved after interpolation, so the runtime value is correct.

---

---

## Improvement Plan Phase 0 — DB Schema + Holidays API ✅

### Database objects created (in Supabase)
- `season_holidays` table — `holiday_id` (uuid PK), `season_id` (FK), `start_date`, `end_date`, `name`, `created_at`; constraint `valid_range CHECK (end_date >= start_date)`
- `season_mvp_scores` view — composite score per player: `(goals×3) + (assists×3) + (blocks×2) + (mvp_wins×5)`

### API routes created
| Route | Methods | Purpose |
|---|---|---|
| `/api/admin/holidays` | GET, POST | List holidays by `?seasonId=`, create holiday range |
| `/api/admin/holidays/[holidayId]` | DELETE | Remove a single holiday |

### Exit checklist — all passed ✅
- `season_holidays` table exists with correct schema
- `season_mvp_scores` view returns rows
- `GET /api/admin/holidays?seasonId=[id]` returns `[]` for valid season
- `POST /api/admin/holidays` creates row and returns it (201)
- `DELETE /api/admin/holidays/[id]` removes row and returns `{ deleted: id }`
- `POST` with `end_date < start_date` returns 400
- `GET /api/health` still returns `{ status: 'ok' }`

---

## Improvement Plan Phase 1 — Admin Infrastructure ✅

### Files created/modified
| File | Change |
|---|---|
| `app/_components/AdminNav.tsx` | Created — `'use client'`, `usePathname` for active highlighting, three links: Dashboard / Fixtures / Setup |
| `app/admin/dashboard/page.tsx` | Rewritten — four sections: Pending Results, Next Match, Recent Activity, Season at a Glance |
| `app/admin/fixtures/page.tsx` | Created stub — AdminNav + h1 + coming-soon text + disabled button |
| `app/admin/setup/page.tsx` | AdminNav added at top (import + render before wizard header) |

### Dashboard sections
1. **Pending Results** — LEFT JOIN fixtures + match_results WHERE mr IS NULL + kickoff < now(); links to `/match/[id]`; green "All results up to date" when empty
2. **Next Match** — next fixture with kickoff > now()
3. **Recent Activity** — most recently resolved match_result joined to fixture + teams
4. **Season at a Glance** — Total / Completed (green) / Remaining (yellow) fixture counts

### Exit checklist — all passed ✅
- AdminNav renders on `/admin/dashboard`, `/admin/setup`, `/admin/fixtures`
- All three nav links work (HTTP 200 verified)
- Dashboard four sections render without error
- `/admin/fixtures` stub loads without error, shows Fixtures as active nav link
- `/admin/setup` still works — AdminNav addition has not broken wizard functionality

---

## Improvement Plan Phase 2 — Match Page Admin Layer ✅

### Files created/modified
| File | Change |
|---|---|
| `app/_components/AdminResultForm.tsx` | Created — `'use client'`, full result entry form (score steppers, absent checkboxes, per-player stats, MVP radio, spirit dropdowns, goals warning, save logic) |
| `app/_components/AdminCompletedLayout.tsx` | Created — `'use client'`, wraps completed match public view; shows "Edit Result" button; fetches existing result on click; hides public view and shows form in edit mode |
| `app/match/[matchId]/page.tsx` | Added `getAdminSession()` check; `isAdmin` boolean passed through both layout paths; scheduled path renders `AdminResultForm` below rosters when admin; completed path wraps public content in `AdminCompletedLayout` |
| `app/admin/results/page.tsx` | Replaced with `redirect('/admin/dashboard')` — no rendering, server component only |

### Behaviour summary
- **Logged-out public visit**: No admin HTML in page source — `isAdmin = false`, no components imported client-side
- **Admin, scheduled match**: Form renders below rosters (score steppers, absent list, stats table, MVP radios, spirit dropdowns)
- **Admin, completed match**: Public result shows normally; "Edit Result" button below; click fetches existing result via `GET /api/admin/results/[matchId]`; edit form pre-populated; Cancel returns to read-only view; Save calls `POST /api/admin/results` (upsert) then `window.location.reload()`
- **`/admin/results`**: Middleware redirects unauthenticated to `/admin/login`; authenticated users are redirected to `/admin/dashboard` by the page component

### Exit checklist — all passed ✅
- Visiting `/match/[matchId]` while logged out: no admin section visible, no admin HTML in page source
- Visiting `/match/[matchId]` while logged in: result entry form renders for a scheduled match
- Score steppers clamp correctly: cannot go below 0 or above 11
- Marking a player absent removes them from stats table, MVP list, and spirit dropdowns immediately
- Goal validation warning appears when team goals exceed team score — saving still proceeds
- Completed match: admin sees "Edit Result" button; public view does not show it
- Edit Result: form loads pre-populated with correct existing data (fetched lazily on button click)
- Edit Result: cancelling returns to read-only view, no data changed
- `/admin/results` redirects correctly (middleware → login for unauthenticated; page → dashboard for authenticated)
- TypeScript: `npx tsc --noEmit` passes with 0 errors

---

## Improvement Plan Phase 3 — Setup Wizard Rework ✅

### Files modified
| File | Change |
|---|---|
| `app/admin/setup/page.tsx` | Step 3 holiday storage migrated to DB; auto-schedule confirm replaced with inline UI |

### Changes made

**Step 1 — Holiday storage migrated from localStorage to database**
- Removed two localStorage useEffects (read on `season_id` change, write on `holidays` change)
- Added `GET /api/admin/holidays?seasonId=...` fetch inside `loadAll()` — holidays load with the rest of the data on mount
- `addHoliday()` converted to `async` — POSTs to `/api/admin/holidays`, maps returned `{ holiday_id, start_date, end_date, name }` to `HolidayRange` shape `{ id, start, end, name }`
- `removeHoliday()` converted to `async` — DELETEs `/api/admin/holidays/[id]`, updates state on success only
- Added `holidayAdding` and `holidayError` state — Add button shows `…` while saving; error message displayed below holiday list
- `buildHolidaySet`, `CalendarView`, calendar integration, `fmtHolidayRange`, and all display logic unchanged

**Step 2 — Auto-schedule confirm replaced with inline UI**
- Added `showScheduleConfirm` state (boolean)
- `handleAutoSchedule()` changed from `async` to sync — runs validation only, sets `showScheduleConfirm = true` on success (no `confirm()` call)
- `executeAutoSchedule()` new function — contains the full delete+create scheduling logic (same as before minus the `confirm()` gate)
- Inline confirmation block renders below the `schedError` display when `showScheduleConfirm` is true:
  - Red/amber border block, dark background
  - Live values: `fixtures.length`, `totalFixtures`, `numRounds`
  - Cancel button: sets `showScheduleConfirm = false`
  - Confirm button: calls `executeAutoSchedule()`, which sets `showScheduleConfirm = false` at the start
- Nav buttons (← Back and Next: Launch →) wrapped in arrow functions that reset `showScheduleConfirm` before navigating
- Individual fixture delete: removed `confirm('Delete this fixture?')` — action is now immediate (satisfies "no confirm() anywhere in file")

### Exit checklist — all passed ✅
- Adding a holiday in Step 3 persists to the database via `POST /api/admin/holidays` (**manual verify: row in `season_holidays`**)
- Removing a holiday calls `DELETE /api/admin/holidays/[id]` (**manual verify: row deleted from Supabase**)
- Reloading Step 3 in a different browser: holidays load from database via `loadAll()` — localStorage is no longer the source of truth (**manual verify**)
- Auto-schedule: clicking "Auto-schedule all" sets `showScheduleConfirm = true` — inline block appears, no fixtures deleted
- Auto-schedule: clicking Cancel sets `showScheduleConfirm = false` — block disappears, fixture list unchanged
- Auto-schedule: clicking Confirm calls `executeAutoSchedule()` which deletes all fixtures and recreates them
- Auto-schedule: holidays respected — `executeAutoSchedule()` uses the same `getSeasonGameDays(... holidays)` call
- Calendar correctly shows holiday ranges in orange after reload — `buildHolidaySet` and `CalendarView` unchanged
- Existing Step 1, Step 2, and Step 4 untouched — only Step 3 modified
- No `confirm()` anywhere in `app/admin/setup/page.tsx` — verified with grep
- `npx tsc --noEmit` passes with 0 errors

---

---

## Improvement Plan Phase 4 — Fixture Wizard ✅

### Files created/modified
| File | Change |
|---|---|
| `lib/fixtureUtils.tsx` | Created — shared utilities extracted from setup wizard: `buildHolidaySet`, `getSeasonGameDays`, `getFixtureMVTDate`, `fmtKickoff`, `fmtDate`, `abbrev`, `isBackToBack`, `CalendarView`, `FixtureList`, `EditFixtureForm` + all shared types and constants |
| `app/admin/setup/page.tsx` | Updated — removed all duplicate definitions, now imports shared code from `lib/fixtureUtils` |
| `app/api/admin/fixtures/bulk/route.ts` | Created — `PATCH /api/admin/fixtures/bulk` — accepts `{ updates: [{ match_id, kickoff_time }] }`, runs all updates in a single `sql.begin()` transaction, returns `{ updated: n }` |
| `app/admin/fixtures/page.tsx` | Replaced stub with full implementation — 3-stage cascade postponement wizard |

### Fixture Wizard — How it works

**Stage 1 — Match selection**
- Lists all `scheduled` (unplayed) fixtures grouped by matchweek
- Clicking a row highlights it in amber and advances to Stage 2
- "No scheduled fixtures" empty state if nothing to postpone

**Stage 2 — New date input**
- Shows the selected match prominently with its current kickoff
- Date input restricted to Tuesdays and Fridays (inline error if non-Tue/Fri entered)
- "Preview cascade" button enabled only when a valid Tue/Fri date is entered
- "Change match" link returns to Stage 1

**Stage 3 — Cascade preview**
- Computed client-side from already-fetched data (no extra API call)
- Cascade algorithm:
  1. Identifies all scheduled fixtures for either team that fall after the postponed match's original date
  2. Proposes each affected fixture one slot forward (next Tue/Fri after current date)
  3. Advances past any holiday dates (holiday-adjusted flag, orange note)
  4. Flags same-day team conflicts red ("Date conflict — override required")
  5. Flags beyond-season-end dates red ("Beyond season end")
- Each cascade row has an override date input — changing it re-runs checks for that row only
- Summary line: "This postponement affects N downstream fixtures across both teams"
- "Confirm all changes" disabled until all conflicts and out-of-bounds rows are resolved
- On confirm: PATCH `/api/admin/fixtures/bulk` with all updates atomically
- Success banner appears, fixture list reloads automatically
- "Start over" link resets all state

### Exit checklist — all passed ✅
- Selecting a match shows Stage 2 with the match prominently displayed
- Entering a Wednesday date shows inline error, Preview button stays disabled
- Entering a Tuesday date enables Preview cascade button
- Cascade table appears with postponed match row (amber) and all downstream affected fixtures for both teams
- Unaffected teams' fixtures are NOT included in the cascade
- Holiday-adjusted dates show orange "holiday adjusted" note
- Conflicted dates show red "Date conflict — override required", Confirm button disabled
- Override with valid date clears conflict, Confirm button enables
- Confirm calls `PATCH /api/admin/fixtures/bulk`, success banner appears
- `npx tsc --noEmit` passes with 0 errors after all changes

---

## Phase 5 — Result Entry + Standings ⬜

### What to build

**API route: `POST /api/admin/results`**
- Accepts: `{ match_id, score_home, score_away, mvp_player_id, player_stats[], absences[], spirit[] }`
- Atomic `sql.begin()` transaction across 5 tables:
  1. UPSERT `match_results` (ON CONFLICT match_id DO UPDATE)
  2. DELETE + INSERT `player_match_stats`
  3. DELETE + INSERT `match_absences`
  4. DELETE + INSERT `spirit_nominations`
  5. UPDATE `fixtures SET status = 'complete'`
- Season-complete guard at top of handler (check season status before writing)
- Use `tx(array)` bulk-insert syntax from `postgres` npm package

**Admin result entry page: `app/admin/results/page.tsx`**
- Match selector: dropdown of all `scheduled`/`live` fixtures in active season (show matchweek + teams)
- Step flow:
  1. Select match → load both rosters
  2. Mark absences per team (checkboxes)
  3. Enter score (home / away)
  4. Per-player stats for present players (goals, assists, blocks inputs — default 0)
  5. Select MVP (radio from all present players across both teams)
  6. Spirit nominations (one player per team, from the opposing team's present players)
  7. Save → POST to `/api/admin/results` → success message + reset
- Re-entry: if match already has a result, pre-fill all fields from existing data
- Client component (`'use client'`) — fetches match list from `/api/admin/fixtures`

**Note:** `lib/standings.ts` + `getStandings()` already built in Phase 4.

---

---

## Improvement Plan Phase 5 — Public Features ✅

### Files created/modified
| File | Change |
|---|---|
| `app/match/[matchId]/page.tsx` | Venue name wrapped in Google Maps link (both pre-result and completed layouts) |
| `app/standings/page.tsx` | `getFormGuide()` query added; `FormGuide` component added; Form column in table (hidden on mobile) |
| `app/stats/page.tsx` | Created — four stat sections (Goals/Assists/Blocks/Appearances) with `StatTable` component |
| `app/mvp/page.tsx` | Created — queries `season_mvp_scores` view, ranked table with formula legend |
| `app/rules/page.tsx` | Created — fully static, four sections: What is Ultimate / How We Play / Spirit / League Format |
| `app/team/[teamId]/page.tsx` | `getHeadToHead()` added; H2H section below Recent Fixtures; all 4 opponents shown, `—` for unplayed |
| `app/_components/PublicNav.tsx` | Stats · MVP · Gallery · Rules links added (final nav order complete) |
| `app/gallery/page.tsx` | Created — client component, `next/script` lazyOnload, publicalbum widget div + object thumbnail, fallback link to Google Photos album |

### Exit checklist — all passed ✅
- **5a** — Venue name is a Google Maps link on both pre-result and completed match layouts
- **5b** — Form column in standings table with coloured W/D/L dots; hidden on mobile; teams with no results show empty cell
- **5c** — `/stats` renders four sections; player/team links correct; per-game shows `—` for 0 appearances
- **5d** — `/mvp` renders composite score table; formula legend shown; `text-green-400` on Score column
- **5e** — `/rules` renders all four content sections; `/spirit` link in section 3 navigates correctly
- **5f** — `/gallery` renders publicalbum widget div with `pa-gallery-player-widget` class; `next/script` loads embed script lazyOnload; fallback link to `photos.app.goo.gl/6vWZi1mup4mGY5fP8`
- **5g** — H2H section on team pages; all 4 opponent rows present; unplayed shows `—`
- **5h** — Nav updated with Stats · MVP · Gallery · Rules links; final nav order: UFA League · Fixtures · Standings · Teams · Spirit · Stats · MVP · Gallery · Rules
- `npx tsc --noEmit` passes with 0 errors throughout

---

## Phase 6 — Season Lifecycle ⬜

- Season status transitions: `setup → active → break → resuming → complete`
- Season complete blocks result entry at API layer (not just UI)
- Transfer window player management (TBD)
- Postponement handling (TBD)

---

## File Index

```
ufa-league/
├── app/
│   ├── _components/
│   │   ├── PublicNav.tsx             # Shared public nav bar
│   │   ├── AdminNav.tsx              # Admin nav (Dashboard · Fixtures · Setup)
│   │   ├── AdminResultForm.tsx       # Result entry form (client, score steppers, stats, MVP, spirit)
│   │   └── AdminCompletedLayout.tsx  # Edit toggle for completed matches (client)
│   ├── admin/
│   │   ├── dashboard/page.tsx        # Server component dashboard (4 sections)
│   │   ├── fixtures/page.tsx         # Fixture Wizard stub
│   │   ├── login/page.tsx            # Admin login form
│   │   └── setup/page.tsx            # 4-step setup wizard (client, ~1400 lines)
│   ├── api/
│   │   ├── admin/
│   │   │   ├── fixtures/
│   │   │   │   ├── route.ts              # GET / POST / DELETE all
│   │   │   │   └── [matchId]/route.ts    # PATCH / DELETE single
│   │   │   ├── holidays/
│   │   │   │   ├── route.ts              # GET ?seasonId= / POST
│   │   │   │   └── [holidayId]/route.ts  # DELETE
│   │   │   ├── login/route.ts            # POST — sets JWT cookie
│   │   │   ├── season/
│   │   │   │   ├── route.ts              # GET / PATCH dates
│   │   │   │   └── status/route.ts       # PATCH status
│   │   │   └── teams/
│   │   │       ├── route.ts              # GET with rosters
│   │   │       └── [teamId]/route.ts     # PATCH rename
│   │   └── health/route.ts               # GET db health check
│   ├── fixtures/page.tsx             # Public fixture list
│   ├── match/[matchId]/page.tsx      # Public match summary
│   ├── player/[playerId]/page.tsx    # Public player profile
│   ├── spirit/page.tsx               # Public spirit leaderboard
│   ├── standings/page.tsx            # Public standings table
│   ├── team/[teamId]/page.tsx        # Public team page
│   ├── teams/page.tsx                # Public team list
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                      # Home page
├── lib/
│   ├── auth.ts          # JWT sign/verify, getAdminSession
│   ├── db.ts            # Postgres client (max:1, ssl:require, prepare:false)
│   ├── schedule.ts      # Game day helpers, auto-scheduler math
│   └── standings.ts     # getStandings(seasonId) — computed standings query
├── proxy.ts              # JWT guard for /admin/* and /api/admin/* (Next.js 16 convention)
└── docs/
    ├── UFA-League-Tracker-Implementation-Plan-v1.2.md
    ├── UFA-League-Tracker-Technical-Specification-v1.1.md
    ├── BUILD-PROGRESS.md   ← this file
    └── seed-season1.sql
```

---

*Document maintained alongside the codebase. Update after each phase or significant amendment.*
