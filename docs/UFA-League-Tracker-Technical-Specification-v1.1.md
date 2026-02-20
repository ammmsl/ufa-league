# UFA League Tracker — Technical Specification

**Version:** 1.1 — Season 1 · Vercel + Supabase
**Format:** 5v5 Mixed Division Ultimate Frisbee
**League:** 5 teams · 44 players · Vilimale Turf · Malé, Maldives
**Season:** February to August 2026 (approximate) with June break
**Timezone:** All times Maldives Time (MVT, UTC+5). IANA identifier: `Indian/Maldives`
**Platform:** Next.js on Vercel · Supabase as plain Postgres database
**Document type:** Standalone spec — read before the Pick'em spec if building both systems

---

## 0. Platform Architecture

### 0.1 Hosting — Vercel

The application is a Next.js project deployed on Vercel. Vercel runs the application as serverless functions — each API route and server-rendered page is an independent function that spins up on demand, handles a request, and tears down. There is no persistent server process.

Consequences for the build:
- Admin authentication must use stateless JWT stored in an httpOnly cookie, not server-side sessions. Server-side sessions do not persist across serverless function invocations.
- Database connections must go through a connection pooler. Each function invocation opens a new connection — without pooling, concurrent requests exhaust Postgres connection limits.
- No background cron jobs on the free tier. Any logic that would traditionally run on a schedule (e.g. locking predictions at a fixed time) must instead be implemented as a check at request time.
- All business logic lives in Next.js API routes. No logic in database triggers or stored procedures.

### 0.2 Database — Supabase (Option A: Plain Postgres)

Supabase provides a managed Postgres database. It is used exclusively as a plain Postgres database — Supabase's client library (`@supabase/supabase-js`), Row Level Security, and Auth features are not used.

The application connects to Supabase using the `postgres` npm package and a standard connection string from environment variables. All queries are written as explicit SQL in the application code.

**Critical: always use the pooler connection string.** Supabase provides two connection strings:
- **Direct connection** (port 5432) — connects to Postgres directly. Use only for local migrations and SQL editor work.
- **Pooler connection** (port 6543, Transaction mode) — connects through PgBouncer. Use this in all deployed code. Set as `DATABASE_URL` in Vercel environment variables.

### 0.3 Database Client

A single shared module handles all database access:

```typescript
// lib/db.ts
import postgres from 'postgres'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set')
}

const sql = postgres(process.env.DATABASE_URL, {
  max: 1,       // one connection per serverless function instance
  ssl: 'require',
})

export default sql
```

`max: 1` is required for Vercel. Each serverless function instance handles one request — a pool larger than 1 wastes connections without benefit. `ssl: 'require'` is required by Supabase.

This module is imported by every API route and server component that needs database access. The database credentials never reach the browser.

### 0.4 Admin Authentication

Single admin login using JWT stored in an httpOnly cookie. The JWT is signed with `JWT_SECRET` (stored as a Vercel environment variable) and expires after 7 days. Next.js middleware intercepts every request to `/admin/*` and `/api/admin/*` routes and verifies the JWT before the handler runs.

Libraries: `jose` (JWT), `bcryptjs` (password hashing). Do not use the native `bcrypt` package — it requires native compilation and fails on Vercel's build environment.

### 0.5 Timezone Handling

All times are stored as `timestamptz` in Postgres (UTC internally). The IANA timezone identifier for Maldives Time is `Indian/Maldives`. Use this string in all JavaScript `Intl` and `toLocaleString` calls — not `UTC+5` or `MVT`, which are not valid IANA identifiers.

When inserting kickoff times, always include the UTC+5 offset in the ISO string:
```
2026-03-10T20:30:00+05:00
```

When displaying times, convert using `Indian/Maldives`:
```typescript
new Date(kickoff_time).toLocaleString('en-MV', { timeZone: 'Indian/Maldives' })
```

### 0.6 Environment Variables

| Variable | Value |
|---|---|
| `DATABASE_URL` | Supabase pooler connection string — port **6543**, Transaction mode |
| `JWT_SECRET` | Random 32-byte base64 string — `openssl rand -base64 32` |
| `ADMIN_PASSWORD_HASH` | bcryptjs hash of the admin password — never the plaintext |

Set all three in Vercel's environment variable dashboard before first deployment. Mirror them in `.env.local` for local development. Never commit `.env.local` to the repository.

### 0.7 NPM Dependencies

| Package | Purpose |
|---|---|
| `postgres` | Postgres client — connects to Supabase via pooler |
| `jose` | JWT signing and verification |
| `bcryptjs` | Password hashing — pure JS, works on Vercel without native compilation |

`@supabase/supabase-js` is explicitly not installed or used.

---

## 1. System Overview

The league tracker is the primary data system for the UFA 5v5 league. It records the season structure, team rosters, match fixtures, results, player statistics, and standings. It is a public-facing website with admin-controlled data entry. No part of the tracker is private — all data is visible to anyone with the URL.

The tracker serves two audiences simultaneously:
- **The community** — players, supporters, and anyone sharing match results on social media
- **Admin** — the single person managing all data entry, scheduling, and season management

A companion Pick'em prediction system will consume data from this tracker. The integration requirements for that system are documented separately in `UFA-Pickem-Technical-Specification-v1.0.md`. This document is written to be self-contained — the tracker must function fully without the Pick'em system.

### 1.1 Design Principles

- Mobile-first — most traffic will come from phones. Every public page must look good enough to screenshot and share directly to WhatsApp or Instagram
- Admin-only writes — all public views are read-only. Data is entered exclusively through the admin panel
- Simple over clever — no automation that cannot be overridden manually. Admin is in full control of the schedule, results, and all state
- Data logged correctly now enables future features — player profiles, historical stats, and Pick'em analytics are all downstream of getting the data structure right in Season 1
- Season 1 is the foundation. Do not build Season 2 features. If the schema supports future seasons without changes, that is sufficient

### 1.2 What the Tracker Manages

- Season definition (dates, break period)
- Team records (name, roster)
- Player records (name, team, attendance per match)
- Match fixtures (schedule, kickoff time, venue, status)
- Match results (score, stats per player, MVP, spirit nominee)
- League standings (computed from results)
- Match summary pages (public, screenshot-friendly)

### 1.3 What the Tracker Does Not Manage

- User accounts or authentication beyond a single admin login
- Pick'em predictions or leaderboards (separate system)
- Payment or registration (already handled externally)
- Draft process (teams are hardcoded from the existing draft result)

---

## 2. Season Structure

### 2.1 Season Definition

Season 1 runs approximately February to August 2026 with a full break in June. The exact end date is flexible. Admin defines the season manually via the setup wizard.

Season fields:
- Season name (e.g. "Season 1 — 2026")
- Season start date (MVT)
- Season end date (MVT — approximate, adjustable)
- Break start date (June 1, 2026)
- Break end date (June 30, 2026)
- Status: `setup` → `active` → `break` → `resuming` → `complete`

Season status transitions are manual — admin triggers each transition. There is no automatic status change based on dates.

### 2.2 Match Frequency

- Game days: Tuesdays and Fridays at 20:30 MVT
- Venue: Vilimale Turf
- Each team plays every other team twice across the full season (pre-break)
- Expected frequency: minimum 2 matches per month per team
- All 5 teams × 4 opponents × 2 fixtures = 20 total pre-break fixtures
- Post-break schedule is determined by admin after the June transfer window

### 2.3 Season Break and Transfer Window

The entire month of June 2026 is a scheduled break. No league matches are played. The transfer window opens during this period.

Transfer window mechanics for Season 1 are not fully defined and are out of scope for this build. The tracker needs to support:
- Adding new players to teams during the break period
- Adjusting rosters (player moves between teams) as an admin action
- Generating new fixtures for the post-break schedule

No automated transfer logic is required. Admin makes roster changes manually.

---

## 3. Teams

### 3.1 Team Records

Five teams are pre-defined from the draft. Teams are not created by admin during setup — they are hardcoded from the Season 1 draft result and loaded via the setup wizard.

Each team record:

| Field | Type | Notes |
|---|---|---|
| team_id | uuid | Primary key |
| team_name | string | Editable — names TBD, currently "Untitled 1–5" |
| season_id | uuid | References season |
| created_at | timestamp (MVT) | |

Team names must be editable at any time by admin. There is no constraint preventing two teams from having the same name (admin responsibility to avoid this).

### 3.2 Season 1 Rosters (Hardcoded from Draft)

These rosters are the authoritative result of the Season 1 draft. They are entered once during setup and treated as the starting state.

**Team 1 (9 players):** Azim, Shamin, Miju, Hassan, Maahy, Imma, Jef, Jilaau, Aisha

**Team 2 (9 players):** Mode, Finn, Saam, Kat, Afrah, Nawaz, Yoosuf, Hamko, Shabeen

**Team 3 (8 players):** Philip, Mateo, Piko, Tiana, Lamath, Shaaif, Kaitlinn, Ma'an

**Team 4 (9 players):** Rizam, Jin, Miph, Tanzeem, Aryf, Shazeen, Malaka, Aahil, Maeesh

**Team 5 (9 players):** Zayyan, Fauz, Muky, Uraiba, Moadz, Junayd, Amsal, Babaa, Eijaz

Total: 44 players across 5 teams.

> Team 3 has 8 players. All others have 9. This reflects the final draft outcome and additional players added for injury redundancy. Rosters are locked until the June transfer window.

---

## 4. Players

### 4.1 Player Records

Each player record:

| Field | Type | Notes |
|---|---|---|
| player_id | uuid | Primary key |
| display_name | string | Single name as used in the league (e.g. "Azim") |
| team_id | uuid | Current team assignment |
| season_id | uuid | Season they belong to |
| is_active | boolean | True unless removed from league |
| created_at | timestamp (MVT) | |

### 4.2 Player Management

For Season 1, player management is minimal:
- Players are hardcoded from the draft roster during setup
- Admin can edit a player's display name if there is a naming error
- Admin can mark a player inactive if they leave the league
- Admin can add new players during the transfer window (June)
- No player profile images or extended profiles in Season 1 — the data structure must support adding these later without schema changes

> Player profile pictures, bios, and extended stats pages are a stretch goal for Season 2. Ensure `player_id` is stable and referenceable so these can be added as columns or a linked table later.

### 4.3 Match Attendance

Admin records which players did not attend each match. This is entered in the admin result entry panel per match.

| Field | Type | Notes |
|---|---|---|
| attendance_id | uuid | Primary key |
| match_id | uuid | References match |
| player_id | uuid | Player who was absent |
| team_id | uuid | Their team |

A player not in the `match_absences` table for a given match is assumed present. Admin marks absences, not attendances — it is faster to mark the few who are absent than to confirm all who attended.

The match player pool used by the Pick'em system is derived from: team roster minus players marked absent for that match.

---

## 5. Match Fixtures

### 5.1 Fixture Fields

| Field | Type | Notes |
|---|---|---|
| match_id | uuid | Primary key |
| season_id | uuid | |
| home_team_id | uuid | |
| away_team_id | uuid | |
| kickoff_time | timestamp (MVT) | Date and time of the match |
| venue | string | Default: "Vilimale Turf" — editable |
| status | enum | `scheduled` · `live` · `complete` · `postponed` · `cancelled` |
| matchweek | integer | Which round of fixtures this belongs to |
| created_at | timestamp (MVT) | |
| updated_at | timestamp (MVT) | |

There is no `home` or `away` advantage — the field labels are used only to distinguish the two teams in the scoreline display (left score vs right score).

### 5.2 Fixture Generation

Admin generates fixtures from the admin panel. The system provides guided fixture creation — it does not auto-generate a full round-robin automatically, but it assists admin with:

- A fixture grid showing which pairings have 0, 1, or 2 matches scheduled (so admin can see what still needs to be created)
- Default kickoff time pre-filled as the next available Tuesday or Friday at 20:30 MVT
- Warning if two matches are being scheduled on the same date at the same venue

Admin creates each fixture individually using a form:
- Select Team A (home)
- Select Team B (away)  
- Set date and time (MVT)
- Set venue (pre-filled as Vilimale Turf)
- Set matchweek number

After saving, the fixture appears in the public schedule and triggers the Pick'em prediction window (24h before kickoff).

### 5.3 Fixture Management

Admin can edit or reschedule any fixture at any time. Editable fields: kickoff time, venue, matchweek, status.

Changing a fixture's `kickoff_time` while status is `scheduled` automatically cascades to the Pick'em system (resets prediction window). This cascade is documented in the Pick'em spec.

Changing status to `postponed` voids Pick'em predictions if the window has already locked. See Pick'em spec Section 5.

Changing status to `cancelled` is a permanent removal — use only for matches that will not be replayed. For matches that will be rescheduled, use `postponed` and then update `kickoff_time` when the new date is known.

### 5.4 Pre-Break Fixture Template

For reference, the pre-break schedule covers all 10 home-and-away pairings across 5 teams. Admin should create these fixtures during setup week. The fixture grid assistant (5.2) shows remaining pairings to guide creation.

| Pairing | Fixture 1 | Fixture 2 |
|---|---|---|
| T1 vs T2 | TBD | TBD |
| T1 vs T3 | TBD | TBD |
| T1 vs T4 | TBD | TBD |
| T1 vs T5 | TBD | TBD |
| T2 vs T3 | TBD | TBD |
| T2 vs T4 | TBD | TBD |
| T2 vs T5 | TBD | TBD |
| T3 vs T4 | TBD | TBD |
| T3 vs T5 | TBD | TBD |
| T4 vs T5 | TBD | TBD |

20 total fixtures pre-break. Post-break fixtures created after the June transfer window.

---

## 6. Match Results

### 6.1 Result Entry

Admin enters results from the admin panel after each match. Result entry is a single-page form for the match showing all players from both teams.

Fields:

**Score**
- Home team score (integer, 0–11)
- Away team score (integer, 0–11)
- Match status set to `complete` on save

**Per-player stats** (for each of the players present in the match):
- Goals (integer, default 0)
- Assists (integer, default 0)
- Blocks (integer, default 0)

**Match MVP**
- Player select — filtered to players present in this match
- Single selection — one MVP per match
- Source: post-match team vote

**Spirit nominee**
- Two selections — one per team
- Each team nominates one player from the opposing team
- Source: spirit captain nomination, collected at end of match and passed to admin
- Labelled: "Team 1's spirit nominee from Team 2" and "Team 2's spirit nominee from Team 1"

**Absent players**
- Multi-select checklist of all rostered players for both teams
- Admin checks off who did not attend
- Absent players are excluded from stats entry and from the Pick'em player pool

On save:
1. Write `match_results` row
2. Write `player_match_stats` rows for all present players
3. Write `match_absences` rows for all absent players
4. Write `spirit_nominations` rows (two per match)
5. Recalculate league standings
6. Mark match status as `complete`

All six steps are atomic — all succeed or none are committed.

### 6.2 Result Correction

Admin can re-enter results for any completed match. Re-entry overwrites all existing data for that match and recalculates standings. There is no approval or audit trail required — last save is authoritative.

### 6.3 Match Results Schema

**match_results**

| Field | Type | Notes |
|---|---|---|
| match_result_id | uuid | Primary key |
| match_id | uuid | References fixtures |
| score_home | integer | |
| score_away | integer | |
| mvp_player_id | uuid | Player voted MVP |
| resolved_at | timestamp (MVT) | When admin saved the result |

**player_match_stats**

| Field | Type | Notes |
|---|---|---|
| stat_id | uuid | Primary key |
| match_id | uuid | |
| player_id | uuid | |
| team_id | uuid | Team they played for in this match |
| goals | integer | Default 0 |
| assists | integer | Default 0 |
| blocks | integer | Default 0 |
| UNIQUE | (player_id, match_id) | One stat row per player per match |

**match_absences**

| Field | Type | Notes |
|---|---|---|
| absence_id | uuid | Primary key |
| match_id | uuid | |
| player_id | uuid | |
| team_id | uuid | |

**spirit_nominations**

| Field | Type | Notes |
|---|---|---|
| nomination_id | uuid | Primary key |
| match_id | uuid | |
| nominating_team_id | uuid | Team making the nomination |
| nominated_player_id | uuid | Player from the opposing team |

---

## 7. League Standings

### 7.1 Standings Calculation

Standings are computed from all matches with status `complete`. They are recalculated automatically whenever a result is entered or corrected.

**Points system:**
- Win: 3 points
- Draw: 1 point
- Loss: 0 points

> Draws are technically possible if both teams reach the time limit at the same score. They are rare given the format but must be handled.

**Tiebreaker order (applied in sequence if teams are level on points):**
1. Goal difference (goals scored minus goals conceded across all matches)
2. Head-to-head record between the tied teams
3. Goals scored (higher total goals scored ranks higher)

**Standings table columns:**

| Column | Notes |
|---|---|
| Rank | Position based on points and tiebreakers |
| Team name | Linked to team page |
| Played (P) | Matches completed |
| Won (W) | |
| Drawn (D) | |
| Lost (L) | |
| Goals For (GF) | Total goals scored |
| Goals Against (GA) | Total goals conceded |
| Goal Difference (GD) | GF minus GA |
| Points (Pts) | 3×W + 1×D |

### 7.2 Season Winner

The team ranked first in the standings at the end of the season is the league winner. No playoffs. The Pick'em season winner prediction resolves against this final standings position.

If the season ends with tied teams that cannot be separated by the three tiebreaker criteria, admin breaks the tie manually (this is an edge case that is unlikely but must be handled gracefully — admin can override the final ranking).

---

## 8. Spirit Tracking

### 8.1 How It Works

After each match, each team's spirit captain nominates one player from the opposing team. This is collected by the scorekeeper or admin at the pitch and entered during result entry.

Spirit nominations are tracked across the season as a cumulative count. A player who receives the most nominations across the season is the Season Spirit Award winner.

### 8.2 Spirit Leaderboard

Public-facing season spirit leaderboard:

| Column | Notes |
|---|---|
| Rank | By nomination count |
| Player | Name |
| Team | Current team |
| Nominations | Total spirit nominations received across the season |

The spirit leaderboard is separate from the league standings and the Pick'em MVP leaderboard. It reflects community recognition of spirit of the game, not on-field performance statistics.

### 8.3 Spirit Data Structure

Covered in Section 6.3 (`spirit_nominations` table). Each match generates exactly two nominations — one from each team for a player on the opposing side.

---

## 9. Public Pages

### 9.1 Page Structure

All pages are public. No login required to view anything. The site structure:

```
/                          Home — season overview, standings summary, next fixtures
/standings                 Full league standings table
/fixtures                  Full fixture list with filters (upcoming / completed / all)
/match/:match_id           Match summary page (primary shareable page)
/teams                     All five teams
/team/:team_id             Team page — roster, results, stats
/players                   All players
/player/:player_id         Player page — stats across the season
/spirit                    Spirit nominations leaderboard
```

### 9.2 Home Page

- Current standings (compact — top 3 or full table)
- Next 2–3 upcoming fixtures with date, teams, and kickoff time
- Most recent result with scoreline
- Link to full fixture list

### 9.3 Fixture List Page

- Filterable by: Upcoming / Completed / All
- Each fixture shows: date, Team A vs Team B, kickoff time, status
- Completed fixtures show the final score
- Clicking any fixture goes to the match summary page

### 9.4 Match Summary Page

The match summary page is the primary shareable content unit. It must look good as a phone screenshot — clean layout, clear typography, no cluttered sidebars.

**Match summary page layout (mobile-first):**

```
┌─────────────────────────────────────┐
│  [Matchweek N]   [Date]             │
│                                     │
│  TEAM NAME A        TEAM NAME B     │
│     [7]         –       [4]         │
│                                     │
│  ─────────────────────────────────  │
│  TOP STATS                          │
│  ⚽ Top Scorer    PlayerName  (N)   │
│  🎯 Top Assister  PlayerName  (N)   │
│  🏆 Match MVP     PlayerName        │
│  ✨ Spirit        PlayerName        │
│  ✨ Spirit        PlayerName        │
│  ─────────────────────────────────  │
│  TEAM A STATS                       │
│  Player       G   A   B            │
│  ...                                │
│  ─────────────────────────────────  │
│  TEAM B STATS                       │
│  Player       G   A   B            │
│  ...                                │
└─────────────────────────────────────┘
```

Rules for the screenshot layout:
- Team names displayed in full, large and bold
- Score is the most prominent element on the page
- Top stats section highlights the headline numbers — a viewer who screenshots just that block gets the story
- Both team stat tables below for people who want the detail
- Absent players shown as greyed out with "Did not play" label — they appear in the roster section but with no stats
- No ads, no sidebars, no navigation cluttering the screenshot area on mobile

### 9.5 Team Page

- Team name (large, prominent)
- Current league position
- Season record: W–D–L
- Full roster with season stats per player (goals, assists, blocks across all matches)
- Recent results (last 3 matches with score)
- Upcoming fixtures (next 2 matches)

### 9.6 Player Page

- Player display name
- Team name and current position in league
- Season stats: total goals, assists, blocks across all matches played
- Matches played count
- Spirit nominations received
- Match-by-match stat breakdown (table: date, opponent, G, A, B)

> Player profile pictures are not in scope for Season 1. The `player_id` is stable — images can be added as a linked asset in Season 2 without schema changes.

### 9.7 Standings Page

Full standings table as defined in Section 7.1. Updates live from the database after each result entry.

---

## 10. Admin Panel

### 10.1 Access Control

Single admin login. Username and password. No multi-admin support in Season 1. All write operations require admin authentication. Read operations (all public pages) require no authentication.

### 10.2 Setup Wizard

A guided setup flow that admin runs once at the start of the season. Designed to get the league live within a week. Steps in order:

**Step 1 — Create Season**
- Enter season name, approximate start and end dates, break start and break end dates
- Confirm and proceed

**Step 2 — Review Teams and Rosters**
- Pre-populated from the hardcoded Season 1 draft result
- Admin can edit team names (currently "Untitled 1–5" — names to be confirmed)
- Admin can edit player display names if any are misspelled
- Admin confirms roster is correct before proceeding
- No adding or removing players in the wizard — use player management after setup

**Step 3 — Generate Fixtures**
- Shows the fixture pairing grid (all 10 pre-break pairings)
- Admin creates fixtures one at a time using the fixture form
- UI shows which pairings are complete (2 fixtures), partial (1 fixture), or empty (0 fixtures)
- Admin can skip this step and create fixtures later from the fixture management section
- Recommended: create all 20 pre-break fixtures during setup week

**Step 4 — Confirm and Launch**
- Summary of what has been created: season, 5 teams, 44 players, N fixtures
- Admin confirms → season status moves from `setup` to `active`
- League is now live and publicly visible

### 10.3 Admin Panel Sections

After setup, the admin panel has five sections:

**Dashboard**
- Quick view: next upcoming match, last entered result, standings summary
- Quick links to common actions: enter result, create fixture, edit team name

**Fixtures**
- Full fixture list with edit and delete controls
- "Create fixture" button — opens fixture form
- Fixture form fields: Team A, Team B, date/time (MVT), venue, matchweek
- UI helper: fixture pairing grid showing coverage of all 10 pairings
- Warning on save if the same pairing already has 2 fixtures scheduled

**Results**
- List of all `complete` matches with edit controls
- "Enter result" button on any `scheduled` or `postponed` match
- Result entry form (see Section 6.1 for all fields)
- Absent player checklist shown first — admin marks who is missing before entering stats
- Player stat rows only shown for players who are present (absent players collapsed)

**Teams and Players**
- Edit team name for any of the 5 teams
- View full roster per team
- Edit player display name
- Mark player inactive
- Add player (for transfer window use)

**Season**
- View current season status
- Manually transition season status: active → break → resuming → complete
- "Mark season complete" button with confirmation dialog — triggers Pick'em season-long resolution

### 10.4 Result Entry Workflow

The result entry form is the most-used admin action. Optimised for speed on mobile since admin may be entering results at the pitch:

1. Select match from the results section (or click "Enter result" from the dashboard)
2. **Absent players** — checklist of all players from both teams. Mark who did not attend. Save absences first.
3. **Scores** — enter home score and away score
4. **Player stats** — grid of all present players with goals, assists, blocks columns. Defaults to 0. Admin only needs to fill in non-zero values.
5. **Match MVP** — dropdown filtered to present players from both teams
6. **Spirit nominees** — two dropdowns: one for each team, filtered to present players from the opposing team
7. Save — atomic write of all data. Standings recalculate automatically.

---

## 11. Match Format Reference

### 11.1 Game Rules

- Format: 5v5
- Win condition: First team to 11 points OR the leading team when 30 minutes elapses, whichever comes first
- Draws: Possible if time expires with both teams on equal score
- Gender ratio: ABBA rule — alternating gender requirements every two points (subject to gender distribution of attending players)
- Rules: Standard Ultimate Frisbee rules — Spirit of the Game applies at all times

### 11.2 Scoring

- A goal is scored when a player catches the disc in the opposing end zone
- The throwing player is credited with an assist
- A block is recorded when a defensive player deflects or intercepts a thrown disc
- Scorekeeper tracks goals, assists, and blocks per player on a paper match sheet during the game
- Stats are passed to admin after the match for entry into the tracker

### 11.3 Postponements

- Captains from both teams must agree to postpone a match
- Postponed matches must be rescheduled on an available Tuesday or Friday at 20:30 MVT
- Teams must maintain a minimum of 2 matches per month — admin monitors compliance
- Admin updates the fixture's `kickoff_time` and status in the admin panel when a new date is agreed
- There is no match that is permanently removed from the season — all postponed matches are rescheduled

---

## 12. Data Schema Summary

All tables for reference. The Pick'em system references `match_id`, `player_id`, and `team_id` from this schema.

```
seasons
  season_id, season_name, start_date, end_date,
  break_start, break_end, status, created_at

teams
  team_id, season_id, team_name, created_at

players
  player_id, season_id, team_id, display_name,
  is_active, created_at

fixtures
  match_id, season_id, home_team_id, away_team_id,
  kickoff_time, venue, status, matchweek,
  created_at, updated_at

match_results
  match_result_id, match_id, score_home, score_away,
  mvp_player_id, resolved_at

player_match_stats
  stat_id, match_id, player_id, team_id,
  goals, assists, blocks
  UNIQUE (player_id, match_id)

match_absences
  absence_id, match_id, player_id, team_id

spirit_nominations
  nomination_id, match_id, nominating_team_id,
  nominated_player_id

match_players [computed — not a stored table]
  Derived from: team rosters minus match_absences for a given match_id
  Used by: Pick'em system to filter player pools per match
```

> `match_players` is not stored — it is computed on demand. For any given `match_id`, the present players are all `players` where `team_id` is either `home_team_id` or `away_team_id` AND `player_id` is NOT in `match_absences` for that `match_id`.

---

## 13. Integration with Pick'em System

The Pick'em system reads the following from this tracker. These endpoints or queries must be available:

| Data needed | Source | Notes |
|---|---|---|
| Match schedule | `fixtures` table | `match_id`, `kickoff_time`, `home_team_id`, `away_team_id`, `status` |
| Match players | Computed from rosters minus absences | Must be available after admin saves absences |
| Team names | `teams` table | |
| Player names | `players` table | |
| Match results | `match_results` + `player_match_stats` | Triggers Pick'em point resolution |
| Season complete | `seasons.status = complete` | Triggers Pick'em season-long resolution |
| Final standings | Computed standings | Used to resolve Pick'em league winner prediction |

The Pick'em system must be treated as a read-only consumer of this data. It does not write to any table owned by the league tracker.

---

## 14. Future Considerations (Out of Scope for Season 1)

The following are explicitly out of scope for the Season 1 build. They are documented here so the schema and architecture do not accidentally block them.

**Player profiles** — profile pictures, bios, social handles. The `player_id` is stable. Images can be stored as a linked asset table without modifying the core schema.

**Advanced stats tracking** — turnovers, completion percentage, drops. These would add columns to `player_match_stats`. Not collected in Season 1.

**Season 2 and historical data** — all tables include `season_id`. Season 2 data is new rows in the same tables. No schema changes required.

**Spirit score system** — a numerical spirit scoring system (SOTG scoring rubric) rather than simple nominations. This would add a `spirit_scores` table. Nominations table already exists and does not conflict.

**Automated schedule generation** — full round-robin auto-generation from team list. The fixture form and pairing grid cover Season 1 needs manually.

**Transfer window management** — negotiation tracking, waiting list drafting, approval flows. Season 1 transfers are manual admin actions. A structured transfer system is a Season 2 feature.

**Public match announcements** — pre-match pages that function as announcement graphics before results are entered. Currently the match page only shows meaningful content after result entry.

---

## Appendix A: Season 1 Roster Reference

| Team | Players | Size |
|---|---|---|
| Untitled 1 | Azim, Shamin, Miju, Hassan, Maahy, Imma, Jef, Jilaau, Aisha | 9 |
| Untitled 2 | Mode, Finn, Saam, Kat, Afrah, Nawaz, Yoosuf, Hamko, Shabeen | 9 |
| Untitled 3 | Philip, Mateo, Piko, Tiana, Lamath, Shaaif, Kaitlinn, Ma'an | 8 |
| Untitled 4 | Rizam, Jin, Miph, Tanzeem, Aryf, Shazeen, Malaka, Aahil, Maeesh | 9 |
| Untitled 5 | Zayyan, Fauz, Muky, Uraiba, Moadz, Junayd, Amsal, Babaa, Eijaz | 9 |
| **Total** | | **44** |

---

## Appendix B: Key Rules Summary

| Rule | Value |
|---|---|
| Teams | 5 |
| Players | 44 total (9–9–8–9–9) |
| Format | 5v5 mixed division |
| Win condition | First to 11 points OR leading at 30 minutes |
| Game days | Tuesday and Friday, 20:30 MVT |
| Venue | Vilimale Turf |
| Pre-break fixtures | 20 (each team plays each opponent twice) |
| Points — Win | 3 |
| Points — Draw | 1 |
| Points — Loss | 0 |
| Tiebreaker 1 | Goal difference |
| Tiebreaker 2 | Head-to-head |
| Tiebreaker 3 | Goals scored |
| Season break | Entire month of June 2026 |
| Transfer window | During June break |
| Roster lock | Mid-February through May |
| Admin | Single admin, full write control |
| Public access | All pages — no login required to view |
| Timezone | MVT (UTC+5) — all times |
| Spirit system | One nomination per team per match — opposing team player |

---

*UFA League Tracker — Technical Specification v1.1*
*Season 1 · Vercel + Supabase (Option A)*
*Read alongside: UFA-Pickem-Technical-Specification-v1.1.md*
