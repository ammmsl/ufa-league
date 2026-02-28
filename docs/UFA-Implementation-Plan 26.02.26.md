# UFA League — Phased Implementation Plan
**Season 1 · February–August 2026**
**Target environment:** Claude Code
**Source spec:** UFA Website Improvement Plan (same session)

---

## Sequencing Rationale

Work is organised into two parallel tracks that converge at the end:

- **Track A — Admin rework** (A2–A6 from the spec): database-first, then infrastructure, then tools in dependency order.
- **Track B — Public features** (Features 1–7 from the spec): independent of admin work, sequenced by effort and dependency.

Track A must be completed before Track B's nav changes are finalised, because the admin nav and public nav are both in `PublicNav.tsx` / a new `AdminNav.tsx`. Other than that, the tracks are independent and either can proceed first.

**Critical path within Track A:** `season_holidays` table → Setup Wizard rework → Fixture Wizard. Each step depends on the previous one being complete and verified.

---

## Phase 0 — Database Schema

**Track:** A (prerequisite for everything admin)
**Effort:** Low
**Risk:** Low — additive only, no existing tables modified

### Changes

Create the `season_holidays` table to replace the current localStorage-based holiday storage:

```sql
CREATE TABLE season_holidays (
  holiday_id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id    uuid NOT NULL REFERENCES seasons(season_id) ON DELETE CASCADE,
  start_date   date NOT NULL,
  end_date     date NOT NULL,
  name         text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_range CHECK (end_date >= start_date)
);

CREATE INDEX ON season_holidays (season_id);
```

Create the `season_mvp_scores` view (Feature 3, also required by Pick'em spec Section 4.3):

```sql
CREATE VIEW season_mvp_scores AS
SELECT
  p.player_id,
  p.display_name,
  p.team_id,
  t.team_name,
  COALESCE(SUM(s.goals), 0)              AS total_goals,
  COALESCE(SUM(s.assists), 0)            AS total_assists,
  COALESCE(SUM(s.blocks), 0)             AS total_blocks,
  COUNT(r.match_result_id)               AS match_mvp_wins,
  (COALESCE(SUM(s.goals), 0)   * 3) +
  (COALESCE(SUM(s.assists), 0) * 3) +
  (COALESCE(SUM(s.blocks), 0)  * 2) +
  (COUNT(r.match_result_id)    * 5)      AS composite_score
FROM players p
JOIN teams t ON t.team_id = p.team_id
LEFT JOIN player_match_stats s ON s.player_id = p.player_id
LEFT JOIN match_results r      ON r.mvp_player_id = p.player_id
WHERE p.is_active = true
GROUP BY p.player_id, p.display_name, p.team_id, t.team_name
ORDER BY composite_score DESC;
```

### API routes to create

- `GET /api/admin/holidays?seasonId=` — return all holiday ranges for a season
- `POST /api/admin/holidays` — create a holiday range `{ season_id, start_date, end_date, name }`
- `DELETE /api/admin/holidays/[holidayId]` — remove a holiday range

### Exit checklist — Phase 0

- [x] `season_holidays` table exists in Supabase with correct schema
- [x] `season_mvp_scores` view returns rows (verify in Supabase SQL editor with `SELECT * FROM season_mvp_scores LIMIT 5`)
- [ ] `GET /api/admin/holidays?seasonId=[id]` returns `[]` for a valid season ID
- [ ] `POST /api/admin/holidays` creates a row and returns it
- [ ] `DELETE /api/admin/holidays/[id]` removes the row and returns `{ deleted: id }`
- [ ] Health check endpoint still returns `{ status: 'ok' }` — confirm DB connectivity unaffected

---

## Phase 1 — Admin Infrastructure

**Track:** A
**Effort:** Low–Medium
**Depends on:** Phase 0 (holiday API must exist before nav links to `/admin/fixtures`)

### Changes

**1. Admin nav component** — create `app/_components/AdminNav.tsx`

Persistent nav bar rendered on all admin pages. Links: Dashboard · Fixtures · Setup. Replaces the current back-link-only navigation. Applied to `/admin/dashboard`, `/admin/setup`, and the new `/admin/fixtures` (stubbed in this phase).

**2. Admin dashboard rework** — rewrite `app/admin/dashboard/page.tsx`

Replace the static count summary with an action-oriented layout:
- **Pending results** — query for fixtures where `kickoff_time < now()` AND no matching row in `match_results`. List each with match name, date, and a link to `/match/[matchId]`.
- **Next match** — next fixture with `status = 'scheduled'` and `kickoff_time > now()`.
- **Recent activity** — most recently resolved match result.
- **Season at a glance** — matchweeks played vs total, fixtures remaining.

Pending results query:
```sql
SELECT
  f.match_id, f.matchweek, f.kickoff_time,
  ht.team_name AS home_team_name,
  at.team_name AS away_team_name
FROM fixtures f
JOIN teams ht ON ht.team_id = f.home_team_id
JOIN teams at ON at.team_id = f.away_team_id
LEFT JOIN match_results mr ON mr.match_id = f.match_id
WHERE f.season_id = $1
  AND f.kickoff_time < now()
  AND mr.match_id IS NULL
ORDER BY f.kickoff_time ASC
```

**3. Fixture Wizard stub** — create `app/admin/fixtures/page.tsx` as a placeholder

Empty page with AdminNav and a "Coming soon" message. This ensures the nav link doesn't 404 before Phase 3 is complete.

### Exit checklist — Phase 1

- [ ] AdminNav renders on `/admin/dashboard`, `/admin/setup`, `/admin/fixtures` — all three links work
- [ ] Dashboard shows "No pending results" when all matches are entered (or season hasn't started)
- [ ] Dashboard shows correct pending result when a fixture's kickoff time is in the past and has no result
- [ ] Pending result links navigate correctly to `/match/[matchId]`
- [ ] Next match and recent activity sections render without error when data is absent (no crashes on empty state)
- [ ] `/admin/fixtures` stub loads without error
- [ ] Existing `/admin/setup` still works — AdminNav addition has not broken any setup wizard functionality

---

## Phase 2 — Match Page Admin Layer

**Track:** A
**Effort:** Medium
**Depends on:** Phase 1 (AdminNav, dashboard links to match pages)

This phase retires `/admin/results` and moves all result entry to the match page.

### Changes

**1. Auth check in match page** — `app/match/[matchId]/page.tsx`

Add server-side auth check. Import the existing auth utility (`lib/auth.ts`). If the request has a valid admin cookie, pass `isAdmin: true` as a prop to the page. The admin section is conditionally rendered — not present in HTML for unauthenticated users.

**2. Result entry form — new state (scheduled match, admin view)**

When `isAdmin && !isPlayed`, render the result entry form below the fixture info and rosters. Sections in order:
1. Score (stepper ± buttons, not raw number inputs, clamped 0–11)
2. Absent players (two-column checkbox list, home/away)
3. Per-player stats (table, only present players, goals/assists/blocks per row)
4. MVP (radio list, two columns, only present players)
5. Spirit nominations (two dropdowns — each team nominates from the opponent)

Score validation: before save, check that sum of goals per team does not exceed the team's score. Surface a warning banner if violated. Do not block save.

**3. Result display — completed match, admin view**

When `isAdmin && isPlayed`, render the existing public result view, then below it a grey "Edit Result" button. Clicking it transitions to an edit form pre-populated with the existing data (same form as above, same API route — the existing `POST /api/admin/results` uses upsert and handles both create and update).

The edit form has a "Cancel" action that returns to read-only view without saving.

**4. Retire `/admin/results`**

Remove `app/admin/results/page.tsx`. Add a redirect: `app/admin/results/page.tsx` → 301 to `/admin/dashboard`. This handles any bookmarked URLs gracefully.

### API changes

No new API routes needed. The existing `POST /api/admin/results` route is already an upsert. The existing `GET /api/admin/results/[matchId]` route is used to pre-populate the edit form.

### Exit checklist — Phase 2

- [ ] Visiting `/match/[matchId]` while logged out: no admin section visible, no admin HTML in page source
- [ ] Visiting `/match/[matchId]` while logged in: result entry form renders for a scheduled (unplayed) match
- [ ] Score steppers clamp correctly: cannot go below 0 or above 11
- [ ] Marking a player absent removes them from the stats table, MVP list, and spirit dropdowns immediately
- [ ] Saving a result: fixture shows as complete, stats appear correctly on the public view
- [ ] Goal validation warning appears when team goals entered exceed team score — saving still proceeds
- [ ] Completed match: admin sees "Edit Result" button, public view does not show it
- [ ] Edit Result: form loads pre-populated with correct existing data
- [ ] Edit Result: cancelling returns to read-only view, no data changed
- [ ] Edit Result: saving a correction updates the result correctly
- [ ] `/admin/results` redirects to `/admin/dashboard` — no 404
- [ ] Dashboard pending results list updates after a result is entered (match no longer appears)

---

## Phase 3 — Setup Wizard Rework

**Track:** A
**Effort:** Medium
**Depends on:** Phase 0 (season_holidays table and API), Phase 1 (AdminNav)

### Changes

**1. Holiday management — migrate from localStorage to database**

In Step 3 (Fixtures), replace the localStorage holiday read/write with API calls to `GET /api/admin/holidays` and `POST/DELETE /api/admin/holidays/[id]`. The holiday state is now fetched on load and written on each add/remove action. The localStorage holiday keys can remain briefly for backward compatibility but are no longer the source of truth.

**2. Auto-schedule confirmation — replace browser confirm() with inline UI**

When admin clicks "Auto-schedule all", instead of immediately showing a `confirm()` dialog, render an inline confirmation block below the button:

```
⚠ This will delete all [n] existing fixtures and create [total] new ones 
  across [rounds] matchweeks. This cannot be undone.

  [Cancel]  [Confirm — delete and reschedule]
```

The destructive action only proceeds after the inline confirm button is clicked. Cancelling dismisses the block without action.

**3. AdminNav** — apply to setup wizard (already done in Phase 1, just verify it doesn't conflict with the existing wizard header)

### Exit checklist — Phase 3

- [ ] Adding a holiday in Step 3 persists to the database — verify in Supabase that a row appears in `season_holidays`
- [ ] Removing a holiday deletes the row from the database
- [ ] Reloading Step 3 in a different browser: holidays are still present (database source of truth confirmed)
- [ ] Auto-schedule: clicking "Auto-schedule all" shows inline confirmation block, does not immediately act
- [ ] Auto-schedule: clicking Cancel dismisses the confirmation block, no fixtures are deleted
- [ ] Auto-schedule: clicking Confirm deletes existing fixtures and creates new ones correctly
- [ ] Auto-schedule: holidays are respected — no fixtures land on holiday dates
- [ ] Calendar correctly shows holiday ranges in orange after reload
- [ ] Existing Step 1 (season dates), Step 2 (team naming), and Step 4 (go live) still function correctly

---

## Phase 4 — Fixture Wizard

**Track:** A
**Effort:** High
**Depends on:** Phase 0 (season_holidays), Phase 1 (AdminNav), Phase 3 (holidays in DB for conflict flagging)

This is the most complex phase. The Fixture Wizard handles in-season postponements with full-season cascade.

### Changes

**1. Replace the fixture wizard stub** with the full implementation at `app/admin/fixtures/page.tsx`

**2. Match selection**

List all scheduled (unplayed) fixtures for the active season, grouped by matchweek. Admin selects the match to postpone.

**3. New date input**

After selecting a match, admin inputs the new date. This is a date picker. The chosen date is the agreed-upon date from the two captains.

**4. Cascade computation (client-side preview)**

When a new date is entered, compute the cascade immediately and show a preview. The cascade algorithm:

1. Identify all fixtures for Team A and Team B that come *after* the postponed match in the original schedule (ordered by `kickoff_time`).
2. For each affected fixture, compute the next available game slot (Tue or Fri) after its current date. "Next slot" = add 3 or 4 days to land on the next Tue or Fri, whichever comes first.
3. Holiday check: if the proposed new date lands on a date in `season_holidays`, advance to the next Tue/Fri that is not a holiday.
4. Conflict check: if the proposed new date would place two matches for the same team on the same day, flag it in red.
5. Produce a flat list of all affected fixtures: `{ match_id, home, away, original_date, proposed_date, flag: 'ok' | 'holiday' | 'conflict' }`.

This computation runs entirely client-side from data already fetched (fixtures list + holidays). No API call needed for preview.

**5. Override**

Each row in the preview list has a date input allowing admin to change the proposed date for that individual fixture. Overriding a date re-runs the conflict and holiday checks for that row only.

**6. Commit**

A "Confirm changes" button at the bottom of the preview submits all changes in a single PATCH request to a new endpoint:

```
PATCH /api/admin/fixtures/bulk
Body: { updates: [{ match_id, kickoff_time }] }
```

The API route updates all fixtures in a single transaction.

**7. New API route** — `app/api/admin/fixtures/bulk/route.ts`

```ts
// PATCH — bulk update kickoff times
// Body: { updates: [{ match_id: string, kickoff_time: string }] }
// Runs all updates in a single transaction
// Returns: { updated: number }
```

### Exit checklist — Phase 4

- [ ] Selecting a match populates the new date input correctly
- [ ] Entering a new date immediately shows the cascade preview — no page navigation required
- [ ] Preview lists all downstream fixtures for both teams, with original and proposed dates
- [ ] A proposed date landing on a holiday is flagged orange
- [ ] A proposed date creating a same-day team conflict is flagged red
- [ ] Overriding a single row date updates only that row's flag, not the whole cascade
- [ ] A proposed date on a non-game-day (Mon/Wed/Thu/Sat/Sun) is rejected or auto-corrected to next Tue/Fri
- [ ] Confirming writes all changes in one transaction — verify in Supabase that kickoff_times updated atomically
- [ ] Confirming then visiting the public `/fixtures` page shows the updated dates
- [ ] Cancelling at any point makes no database changes
- [ ] The postponed match itself shows its new date correctly on the match page
- [ ] Public fixtures page correctly reflects all rescheduled matches after a cascade

---

## Phase 5 — Public Features (Track B)

**Track:** B
**Effort:** Low–Medium total
**Depends on:** Nothing from Track A (fully independent). Can be done in any sub-order.

All seven public features are implemented in this phase. They are ordered by ascending risk: trivial changes first, new pages after, nav updated once at the end.

### 5a — Venue map link (Feature 4)

In `app/match/[matchId]/page.tsx`, wrap the venue name in an anchor to `https://maps.app.goo.gl/BcCYS36FRZcQmoBB8`. Open in new tab. Apply to both the scheduled and completed match layouts.

**Exit check:** Visit any match page. Venue name is a tappable link. Tapping opens Google Maps in a new tab to Vilimale Turf.

### 5b — Form guide on Standings (Feature 2)

In `app/standings/page.tsx`, add a second query to get the last 5 results per team. Add a `Form` column to the standings table rendering coloured W/D/L dots. Component is inline, no new file needed.

**Exit check:** Visit `/standings`. Each team row shows up to 5 coloured dots. Teams with fewer than 5 results show fewer dots, left-aligned. Teams with no results show no dots and the column is empty — no error.

### 5c — Statistics Leaderboard (Feature 1)

Create `app/stats/page.tsx`. Server component, `revalidate = 0`. Four sections (Goals, Assists, Blocks, Appearances). Each section is a table: Rank · Player · Team · Total · Apps · Per Game. All rostered players included. Per-game shows `—` for zero appearances.

**Exit check:** Visit `/stats`. All four sections render. Player names link to `/player/[id]`. Team names link to `/team/[id]`. A player with 0 appearances shows `—` in the per-game column and 0 in the total column.

### 5d — Season MVP page (Feature 3)

Create `app/mvp/page.tsx`. Server component, `revalidate = 0`. Queries `season_mvp_scores` view (created in Phase 0). Table: Rank · Player · Team · Score · Goals · Assists · Blocks · MVP Wins. Formula legend below the table.

**Exit check:** Visit `/mvp`. Table renders with correct composite scores. Verify one row manually: find a player in Supabase, calculate `(goals×3) + (assists×3) + (blocks×2) + (mvp_wins×5)` and confirm it matches what the page shows.

### 5e — Rules / About page (Feature 7)

Create `app/rules/page.tsx`. Fully static, no database. Content: What is Ultimate Frisbee, 5v5 rules TLDR, Spirit system, League format. No `revalidate` needed.

**Exit check:** Visit `/rules`. Page loads. All four sections render. No console errors.

### 5f — Gallery page (Feature 6)

Create `app/gallery/page.tsx`. iframe embed from publicalbum.org URL (must be generated manually before this step — see setup instructions in the spec). Include a fallback direct link to the Google Photos album.

**Pre-requisite manual step:** Generate the publicalbum.org embed URL from the shared Google Photos album link before coding this page. The iframe src cannot be hardcoded until that URL exists.

**Exit check:** Visit `/gallery`. iframe loads and displays photos. On a mobile viewport, the iframe is not clipped. The fallback link below the iframe navigates to the Google Photos album in a new tab.

### 5g — Head-to-head on Team pages (Feature 5)

In `app/team/[teamId]/page.tsx`, add a `getHeadToHead(teamId)` function and render an H2H table below the Recent Fixtures section. Show `—` for opponents not yet played.

**Exit check:** Visit a team page. H2H section appears below Recent Fixtures. All 4 opponent rows are present. A team with no results shows `—` for all opponents. A team with some results shows correct W/D/L counts and goal tallies — verify one row manually against the raw fixtures data.

### 5h — Public nav update (all features)

Add all new nav links to `PublicNav.tsx` in a single commit: Stats · MVP · Gallery · Rules. Final nav order: `UFA League | Fixtures | Standings | Teams | Stats | MVP | Spirit | Gallery | Rules`.

Do this last within Phase 5 so the nav links don't point to pages that don't exist yet during development.

**Exit check:** On every public page, the nav renders all 8 links. On mobile (narrow viewport), the nav scrolls horizontally and all links are reachable. Each link navigates to the correct page.

---

## Phase 6 — Integration and End-to-End Verification

**Track:** Both
**Effort:** Low (testing only, no new code)
**Depends on:** All previous phases complete

This phase has no code changes. It is a structured manual walkthrough of the full admin and public user journeys.

### Admin journey

- [ ] Log in at `/admin/login` — cookie set, redirect to dashboard
- [ ] Dashboard shows correct pending results count
- [ ] Click a pending result link — lands on the correct match page with result entry form
- [ ] Enter a full result (score, absences, stats, MVP, spirit) — save succeeds
- [ ] Dashboard no longer shows that match as pending after save
- [ ] Visit the same match page while logged out — no admin section in page, no admin HTML in source
- [ ] Edit Result flow: completed match → click Edit Result → form pre-populated → make a change → save → result updated correctly
- [ ] Navigate to `/admin/fixtures` — Fixture Wizard loads
- [ ] Select a match, enter a new date — cascade preview renders with correct affected matches
- [ ] Override one row date — only that row updates
- [ ] Confirm cascade — verify updated kickoff_times in Supabase match the preview
- [ ] Navigate to `/admin/setup` — Setup Wizard loads, AdminNav present
- [ ] Add a holiday in Step 3 — row appears in Supabase `season_holidays`
- [ ] Remove the holiday — row deleted from Supabase
- [ ] Auto-schedule confirmation block appears before any action — confirm then cancel — no fixtures changed

### Public journey

- [ ] Home page — next match and last result show correctly
- [ ] Fixtures page — all matchweeks render, dates reflect any cascade changes from above
- [ ] Standings page — form guide dots appear for each team
- [ ] A team page — H2H section present, recent fixtures present
- [ ] A player page — match log and totals correct
- [ ] Stats page — four sections render, player links and team links work
- [ ] MVP page — composite scores match manual calculation for one player
- [ ] Spirit page — leaderboard renders
- [ ] Gallery page — photos load in iframe
- [ ] Rules page — all content sections render
- [ ] Match page (scheduled) — venue link opens Google Maps in new tab
- [ ] Match page (completed) — full result, stats, spirit nominations visible
- [ ] Nav on mobile — all links accessible via horizontal scroll

### Data integrity checks

- [ ] Sum of goals in player_match_stats for a completed match equals score in match_results (spot check 2 matches)
- [ ] Spirit nominations reference only players who were present (not in match_absences) for that match
- [ ] season_mvp_scores view composite scores match manual calculation for 2 players

---

## File Change Summary

| File | Phase | Change type |
|------|-------|-------------|
| Supabase — `season_holidays` table | 0 | Create |
| Supabase — `season_mvp_scores` view | 0 | Create |
| `app/api/admin/holidays/route.ts` | 0 | Create |
| `app/api/admin/holidays/[holidayId]/route.ts` | 0 | Create |
| `app/_components/AdminNav.tsx` | 1 | Create |
| `app/admin/dashboard/page.tsx` | 1 | Rewrite |
| `app/admin/fixtures/page.tsx` | 1 (stub) → 4 (full) | Create → Replace |
| `app/match/[matchId]/page.tsx` | 2 | Major edit |
| `app/admin/results/page.tsx` | 2 | Delete (redirect) |
| `app/admin/setup/page.tsx` | 3 | Edit |
| `app/api/admin/fixtures/bulk/route.ts` | 4 | Create |
| `app/stats/page.tsx` | 5c | Create |
| `app/mvp/page.tsx` | 5d | Create |
| `app/rules/page.tsx` | 5e | Create |
| `app/gallery/page.tsx` | 5f | Create |
| `app/standings/page.tsx` | 5b | Edit |
| `app/team/[teamId]/page.tsx` | 5g | Edit |
| `app/_components/PublicNav.tsx` | 5h | Edit |

---

## Pre-Development Checklist

Before starting Phase 0, confirm:

- [ ] Claude Code has access to the repository and can read/write all files
- [ ] Supabase project credentials are available (connection string for schema changes)
- [ ] The health check endpoint `/api/health` returns `{ status: 'ok' }` — baseline DB connectivity confirmed
- [ ] A test season with at least some fixture and result data exists in the database — needed to verify queries in Phases 1–5
- [ ] The Google Photos shared album link is available (needed before Phase 5f)
- [ ] publicalbum.org embed URL has been generated from the album link (needed before Phase 5f can be coded)
