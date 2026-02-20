# UFA Pick'em System — Technical Specification

**Version:** 1.2 — Core Model · Vercel + Supabase
**Season:** Season 1 — February to August 2026
**League:** 44 players — 5v5 Ultimate Frisbee — 5 teams
**Timezone:** All times Maldives Time (MVT, UTC+5). IANA identifier: `Indian/Maldives`
**Platform:** Next.js on Vercel · Supabase as plain Postgres database (shared with league tracker)
**Prerequisite:** The league tracker must be fully implemented and its database populated before Pick'em build begins. Read `UFA-League-Tracker-Technical-Specification-v1.1.md` first.

---

## 0. Platform Architecture

Pick'em shares the identical platform as the league tracker — the same Next.js codebase, the same Vercel deployment, and the same Supabase database. No new infrastructure is required.

All platform decisions documented in the tracker spec Section 0 apply here without change:
- Vercel serverless functions — stateless, one connection per instance
- Supabase pooler connection string (port 6543) via `lib/db.ts` with `max: 1`
- JWT in httpOnly cookie via `lib/auth.ts` middleware
- `Indian/Maldives` IANA timezone identifier everywhere
- `postgres` npm package — no `@supabase/supabase-js`

Pick'em adds two tables (`pickem_users`, `predictions`) and one view (`season_mvp_scores`) to the existing Supabase database. It adds public pages under `/pickem/*` and admin API routes under `/api/admin/pickem/*` to the existing Next.js project.

### 0.1 What Pick'em Adds to the Shared Codebase

**New database objects (in Supabase):**
- `pickem_users` table
- `predictions` table
- `season_mvp_scores` view
- `season_resolved_at` column on `seasons` table

**New Next.js routes:**
- `app/pickem/*` — public prediction pages
- `app/api/pickem/*` — unauthenticated write endpoints (sign-up, prediction submission)
- `app/api/admin/pickem/*` — admin-only Pick'em management (protected by existing middleware)

**New library modules:**
- `lib/whatsapp.ts` — phone number normalisation
- `lib/pickem-resolve.ts` — point allocation function (called inside tracker result save transaction)
- `lib/pickem-season-close.ts` — season-long resolution

**No new npm packages required.** All dependencies (`postgres`, `jose`, `bcryptjs`) are already installed from the tracker build.

### 0.2 Point Allocation and the Shared Transaction

The most important architectural decision: Pick'em point allocation runs inside the same `sql.begin()` transaction as the tracker result save. This means:

- If the tracker result save fails, Pick'em points are also rolled back
- If Pick'em allocation fails, the tracker result is also rolled back
- The database never has a result without corresponding Pick'em points, or vice versa

The `resolvePickem(match_id, tx)` function accepts the transaction object from the tracker handler and runs all its queries through it.

---

## 1. System Overview

The Pick'em system is a prediction game that runs as a section of the same website as the UFA league tracker. It shares the same database — the Pick'em tables live alongside the tracker tables and reference them directly via foreign keys. There is no API layer, no data sync, and no separate service. Both systems are administered by the same single admin.

The Pick'em system reads from tracker tables (`fixtures`, `teams`, `players`, `player_match_stats`, `match_results`, `match_absences`, `seasons`) and writes only to its own four tables (`pickem_users`, `predictions`, and the `season_mvp_scores` view). The tracker is never written to by Pick'em logic.

### 1.1 Design Principles

- Pick'em is a section of the existing league site, not a separate product
- All tracker data is available directly — no duplication, no sync
- Player pools for predictions are derived from the tracker's computed match attendance (roster minus absences), which is already maintained by admin during result entry
- Predictions resolve automatically when admin saves match results in the tracker — no second admin action required
- Public-facing — anyone can view predictions, leaderboards, and crowd consensus without signing up
- Engagement driven manually by admin via WhatsApp community announcements

### 1.2 What Pick'em Owns

The Pick'em system owns exactly two tables and one view:

- `pickem_users` — registered participants, WhatsApp numbers, season-long picks, total points
- `predictions` — per-match prediction rows, one per user per match
- `season_mvp_scores` — computed view over tracker tables, no stored data

Everything else — teams, players, fixtures, results, stats — belongs to the tracker and is read-only from Pick'em's perspective.

### 1.3 Shared Database — What This Simplifies

Because both systems share the same database:

- No API endpoints needed between systems
- No webhooks or polling for result events
- No data duplication or sync errors
- Match result resolution triggers Pick'em point allocation in the same transaction as the tracker result save, or as an immediate post-save step
- Player pool filtering is a direct JOIN on tracker tables — no intermediate data store
- Season close trigger is one database status update that both systems observe

### 1.4 System Context

The Pick'em section sits within the league website alongside the tracker's public pages. The two systems share navigation and visual design but have separate data sections:

- **Tracker pages** — fixtures, standings, match summaries, team pages, player pages, spirit leaderboard
- **Pick'em pages** — prediction cards, Pick'em leaderboard, Season MVP composite leaderboard, crowd consensus history

---

## 2. Participation and Sign-Up

### 2.1 Who Can Participate

The Pick'em game is open to the entire UFA community — active players and non-playing community members. There is no distinction between player-participants and fan-participants. The system is designed on a "wisdom of the crowd" model.

- Target active participants: up to 100 registered accounts
- Expected engagement community: approximately 80 people
- Registration cap set at 100 to allow latecomers across the season
- Late joiners cannot retroactively score points for missed match windows but still contribute to aggregate crowd data

### 2.2 Sign-Up Flow

Sign-up is accessed via a controlled invite link distributed through the WhatsApp community. Capped at 100 registrations. Once the cap is reached the link shows a closed state.

Required sign-up inputs:

| Field | Type | Notes |
|---|---|---|
| Display name | Text | Public — shown on leaderboard. Max 40 characters. Must be unique. |
| WhatsApp number | Tel | Private — admin contact only. Stored as E.164. |
| Season MVP prediction | Player select | All 44 players from `players` table. Locked for full season. |
| Season top scorer prediction | Player select | All 44 players from `players` table. Locked for full season. |
| Predicted league winner | Team select | All 5 teams from `teams` table. Locked for full season. |

Player and team selects are populated directly from the tracker's `players` and `teams` tables. No hardcoded lists.

### 2.3 WhatsApp Number Validation

The WhatsApp number is the unique account identifier. One account per number, enforced at the database level.

- Normalised to E.164 on submission (`+960XXXXXXX` for Maldives)
- Accepted input formats: `7XXXXXXX`, `07XXXXXXX`, `9607XXXXXXX`, `+9607XXXXXXX`, `960-7XXXXXXX` — all normalise correctly
- Duplicate numbers rejected with a clear error message
- Numbers never displayed publicly — all public views show display name only
- Admin can view WhatsApp numbers via the admin panel to contact winners or verify membership

> `whatsapp_number` is a private field. It must never appear in any public-facing page, API response, or query result.

---

## 3. Prediction System — Core Model

### 3.1 Per-Match Prediction Card

Each fixture in the tracker with status `scheduled` automatically generates a Pick'em prediction card. Cards open 24 hours before kickoff and lock 1 hour before kickoff. All times MVT.

| # | Prediction | Type | Max Points |
|---|---|---|---|
| Q1 | Match winner | Team select | 10 |
| Q2 | Match MVP | Player select | 20 |
| Q3 | Top scorer of match | Player select | 15 |
| Q4 | Top assister of match | Player select | 15 |
| Q5 | Scoreline guess (bonus) | Score input | 10 |
| | **Maximum per card** | | **70** |

### 3.2 Player Pool Source

The player pool for Q2, Q3, and Q4 is derived from the tracker's attendance data:

```sql
-- Present players for a given match_id
SELECT p.player_id, p.display_name, p.team_id
FROM players p
WHERE p.team_id IN (
  SELECT home_team_id FROM fixtures WHERE match_id = :match_id
  UNION
  SELECT away_team_id FROM fixtures WHERE match_id = :match_id
)
AND p.player_id NOT IN (
  SELECT player_id FROM match_absences WHERE match_id = :match_id
)
AND p.is_active = true
```

This query is executed at card render time. No stored player pool. No admin configuration per match. The pool updates automatically if admin edits absences before the window locks.

> The player pool at the time of prediction lock is the pool that counts for resolution. If absences are entered after the lock, the pool used for scoring is the one from the most recent absence data at result entry time.

### 3.3 Q1 — Match Winner

- **Points:** 10 for correct team
- **Input:** Binary select between `home_team_id` and `away_team_id` from the `fixtures` row
- **Resolves from:** `match_results.score_home` vs `match_results.score_away`

### 3.4 Q2 — Match MVP

- **Points:** 20 for exact player
- **Input:** Player select from the computed present player pool
- **Resolves from:** `match_results.mvp_player_id`

### 3.5 Q3 — Top Scorer

- **Points:** 15 for correct player
- **Tie rule:** If multiple players share the top goal count, all users who picked any tied player receive full 15 points
- **Resolves from:** `MAX(goals)` across `player_match_stats` for this `match_id`

### 3.6 Q4 — Top Assister

- **Points:** 15 for correct player
- **Tie rule:** Same as Q3 — all users who picked any tied player receive full 15 points
- **Resolves from:** `MAX(assists)` across `player_match_stats` for this `match_id`

### 3.7 Q5 — Scoreline Guess (Bonus)

Optional. User enters a predicted score (e.g. `11–7`). Points are awarded based on predicted margin closeness, not exact score match. Casual users guess naturally; engaged users realise the game is about predicting the winning margin. Predicting `10–6` scores identically to `11–7` against an actual `11–7` because both have a margin of 4.

#### Scoring Formula

```
margin_error = |(scoreline_home - scoreline_away) - (score_home - score_away)|
points       = max(0, 10 - margin_error × 2)
```

| Predicted | Actual | Pred. Margin | Margin Error | Points |
|---|---|---|---|---|
| 11–7 | 11–7 | 4 | 0 (exact) | 10 |
| 10–6 | 11–7 | 4 | 0 (exact) | 10 |
| 11–6 | 11–7 | 5 | 1 | 8 |
| 11–8 | 11–7 | 3 | 1 | 8 |
| 11–5 | 11–7 | 6 | 2 | 6 |
| 11–9 | 11–7 | 2 | 2 | 6 |
| 7–11 | 11–7 | -4 | 8 (wrong winner) | 0 |

> Predicting the wrong winner does not void the bonus. It produces a large margin error and typically scores 0. Q1 handles the winner call separately.

### 3.8 Season-Long Predictions

Locked at sign-up. Cannot be changed after submission. Resolve at season end.

| Prediction | Points | Resolves from |
|---|---|---|
| Season MVP | 50 | `season_mvp_scores` view — highest composite score |
| Season top scorer | 40 | `SUM(goals)` per player across all `player_match_stats` |
| League winner (team) | 40 | Tracker standings — first position team at season end |
| **Season-long maximum** | **130** | All three correct |

---

## 4. Season MVP Composite Score

### 4.1 Purpose

A season-long composite score aggregating every player's statistical contributions across all matches. Publicly tracked on a live leaderboard throughout the season. Serves as motivation for players to perform consistently and surfaces the gap between community assumptions at sign-up and what the data shows at season end.

### 4.2 Formula

```
Season MVP Score = (goals × 3) + (assists × 3) + (blocks × 2) + (match_mvp_wins × 5)
```

| Stat | Weight | Rationale |
|---|---|---|
| Goals | ×3 | Core offensive contribution |
| Assists | ×3 | Equal to goals — a goal requires the assist that created it |
| Blocks | ×2 | Defensive contribution acknowledged; lower weight accounts for tracking variance |
| Match MVP wins | ×5 | Highest weight — peer-voted signal already aggregating overall match performance |

### 4.3 Database View

The composite score is a computed view over the tracker's `player_match_stats` and `match_results` tables. No Pick'em-owned stats table required.

```sql
CREATE VIEW season_mvp_scores AS
SELECT
  p.player_id,
  p.display_name,
  p.team_id,
  t.team_name,
  COALESCE(SUM(s.goals), 0)             AS total_goals,
  COALESCE(SUM(s.assists), 0)           AS total_assists,
  COALESCE(SUM(s.blocks), 0)            AS total_blocks,
  COUNT(r.match_result_id)              AS match_mvp_wins,
  (COALESCE(SUM(s.goals), 0)   * 3) +
  (COALESCE(SUM(s.assists), 0) * 3) +
  (COALESCE(SUM(s.blocks), 0)  * 2) +
  (COUNT(r.match_result_id)    * 5)     AS composite_score
FROM players p
JOIN teams t ON t.team_id = p.team_id
LEFT JOIN player_match_stats s ON s.player_id = p.player_id
LEFT JOIN match_results r      ON r.mvp_player_id = p.player_id
WHERE p.is_active = true
GROUP BY p.player_id, p.display_name, p.team_id, t.team_name
ORDER BY composite_score DESC;
```

This view auto-updates every time admin enters or corrects a result in the tracker. No Pick'em-side recalculation required.

### 4.4 Leaderboard Display

Public-facing, live throughout the season. Shows all active players ranked by composite score with individual stat breakdowns. Also shows the percentage of Pick'em participants who picked each player as Season MVP at sign-up, computed as:

```sql
SELECT season_mvp_pick AS player_id,
       COUNT(*) * 100.0 / (SELECT COUNT(*) FROM pickem_users) AS community_pct
FROM pickem_users
GROUP BY season_mvp_pick
```

This creates the comparison between expected and actual that is the core design goal.

---

## 5. Prediction Window Rules

### 5.1 Timing

- **Opens:** `kickoff_time - 24 hours` (MVT)
- **Locks:** `kickoff_time - 1 hour` (MVT)
- Users may edit predictions unlimited times between open and lock
- Lock is enforced server-side — the UI disabling the submit button is not sufficient
- All times computed in MVT from the `fixtures.kickoff_time` column

### 5.2 Match Postponement

When admin changes a fixture's `kickoff_time` in the tracker (rescheduling a postponed match):

**If the window has not yet locked** (predictions exist but are pre-lock):
- All `predictions` rows for this `match_id` are deleted
- The window recalculates from the new `kickoff_time`
- Users resubmit when the new window opens

**If the window has already locked** (predictions are locked):
- All `predictions` rows for this `match_id` have `points_earned` set to 0
- `pickem_users.total_points` recalculates for affected users
- The prediction card shows a void message
- A new prediction window opens when the match is rescheduled

### 5.3 Result of Watching Fixture Status

The Pick'em system determines card state by querying `fixtures.status` and `fixtures.kickoff_time` directly:

| `fixtures.status` | Window state | Card state |
|---|---|---|
| `scheduled` | Before open time | Upcoming — countdown shown |
| `scheduled` | Between open and lock | Open — predictions accepted |
| `scheduled` | After lock time | Locked — read-only |
| `complete` | — | Resolved — scores and points shown |
| `postponed` | — | Voided — void message shown |
| `cancelled` | — | Cancelled — not shown on Pick'em |

No separate Pick'em status field on fixtures. Status is always derived from the tracker.

---

## 6. Result Resolution

### 6.1 When Resolution Runs

Pick'em point allocation runs immediately after admin saves a match result in the tracker. Since both systems share the same database, this can be implemented as:

- A database trigger on `match_results INSERT/UPDATE`, or
- A post-save function call in the application layer, executed within the same request as the tracker result save

The second approach (application layer) is recommended — it is easier to debug and test than database triggers.

### 6.2 Point Allocation Logic

Run for every `predictions` row where `match_id` matches the saved result and `is_locked = true`:

```
Q1 — Match winner (10 pts)
  winning_team = IF score_home > score_away THEN home_team_id
                 ELSE IF score_away > score_home THEN away_team_id
                 ELSE NULL  -- draw: no winner, Q1 scores 0
  IF predictions.winner_pick == winning_team → award 10

Q2 — Match MVP (20 pts)
  IF predictions.mvp_pick == match_results.mvp_player_id → award 20

Q3 — Top scorer (15 pts)
  max_goals    = SELECT MAX(goals) FROM player_match_stats WHERE match_id = :id
  top_scorers  = SELECT player_id FROM player_match_stats
                 WHERE match_id = :id AND goals = max_goals
  IF predictions.top_scorer_pick IN top_scorers → award 15

Q4 — Top assister (15 pts)
  max_assists  = SELECT MAX(assists) FROM player_match_stats WHERE match_id = :id
  top_assisters = SELECT player_id FROM player_match_stats
                  WHERE match_id = :id AND assists = max_assists
  IF predictions.top_assister_pick IN top_assisters → award 15

Q5 — Scoreline bonus (up to 10 pts)
  IF predictions.scoreline_home IS NULL → award 0
  predicted_margin = scoreline_home - scoreline_away
  actual_margin    = score_home - score_away
  margin_error     = ABS(predicted_margin - actual_margin)
  award MAX(0, 10 - margin_error * 2)

predictions.points_earned = sum of all awarded points
```

### 6.3 User Total Recalculation

After point allocation:

```sql
UPDATE pickem_users
SET total_points = (
  SELECT COALESCE(SUM(points_earned), 0)
  FROM predictions
  WHERE user_id = pickem_users.user_id
)
WHERE user_id IN (
  SELECT DISTINCT user_id
  FROM predictions
  WHERE match_id = :resolved_match_id
);
```

### 6.4 Re-entry

If admin corrects a result in the tracker, the Pick'em point allocation re-runs automatically for that match. The delete-and-rewrite approach:

1. Set `points_earned = 0` on all `predictions` for this `match_id`
2. Re-run the full allocation logic with the corrected result
3. Recalculate `pickem_users.total_points` for all affected users

### 6.5 Season-Long Resolution

Triggered when admin marks the season complete in the tracker (`seasons.status = 'complete'`). Runs once:

```
Season top scorer:
  SELECT player_id FROM player_match_stats
  GROUP BY player_id
  HAVING SUM(goals) = (SELECT MAX(total) FROM (
    SELECT SUM(goals) AS total FROM player_match_stats GROUP BY player_id
  ))
  → winners set
  For each pickem_user where season_scorer_pick IN winners → award 40 pts

Season MVP:
  SELECT player_id FROM season_mvp_scores
  WHERE composite_score = (SELECT MAX(composite_score) FROM season_mvp_scores)
  → winners set
  For each pickem_user where season_mvp_pick IN winners → award 50 pts

League winner:
  winning_team = top team from computed standings (same logic as tracker standings page)
  For each pickem_user where season_winner_pick == winning_team → award 40 pts

Recalculate all pickem_users.total_points
```

Ties pay full points to all qualifying picks. Wrap in an idempotency check — store a `season_resolved_at` timestamp on the season record and refuse to run if already set.

---

## 7. Scoring Reference

### 7.1 Per-Match Points

| Prediction | Max Points | Resolution |
|---|---|---|
| Match winner | 10 | Correct team — 0 if draw |
| Match MVP | 20 | Exact player match |
| Top scorer | 15 | Exact player — ties pay full to all |
| Top assister | 15 | Exact player — ties pay full to all |
| Scoreline bonus | 10 | Margin formula: `max(0, 10 - error × 2)` |
| **Per-match maximum** | **70** | All five correct |

### 7.2 Season-Long Points

| Prediction | Points | Resolution |
|---|---|---|
| Season MVP | 50 | Highest composite score at season end |
| Season top scorer | 40 | Highest total goals at season end |
| League winner | 40 | First in final standings |
| **Season-long maximum** | **130** | All three correct |

### 7.3 Tie Policy

All ties pay full points to all qualifying predictions. No splitting. Applies to: top scorer, top assister, season top scorer, Season MVP.

---

## 8. Data Schema

### 8.1 Overview

Pick'em owns two tables. Everything else is read directly from tracker tables in the same database.

```
pickem_users    — participant accounts, season-long picks, total points
predictions     — per-match prediction rows

Read from tracker (no duplication):
  fixtures            — match schedule, kickoff times, status
  teams               — team names and IDs
  players             — player names, team assignments, active status
  match_results       — final scores, MVP
  player_match_stats  — goals, assists, blocks per player per match
  match_absences      — who was absent per match (drives player pool)
  seasons             — status, used for season-close detection
```

### 8.2 `pickem_users`

| Field | Type | Visibility | Notes |
|---|---|---|---|
| user_id | uuid | Internal | Primary key |
| display_name | varchar | Public | Unique, max 40 chars |
| whatsapp_number | varchar (E.164) | Admin only | Unique constraint |
| season_mvp_pick | uuid → players.player_id | Public aggregate only | Locked at sign-up |
| season_scorer_pick | uuid → players.player_id | Public aggregate only | Locked at sign-up |
| season_winner_pick | uuid → teams.team_id | Public aggregate only | Locked at sign-up |
| total_points | integer | Public | Recomputed after each result |
| signup_at | timestamptz (MVT) | Internal | |

Foreign keys to `players` and `teams` are real database foreign keys — not text strings. This enforces referential integrity and enables direct JOINs.

### 8.3 `predictions`

| Field | Type | Notes |
|---|---|---|
| prediction_id | uuid | Primary key |
| user_id | uuid → pickem_users | |
| match_id | uuid → fixtures | Direct FK to tracker fixtures table |
| winner_pick | uuid → teams | |
| mvp_pick | uuid → players | |
| top_scorer_pick | uuid → players | |
| top_assister_pick | uuid → players | |
| scoreline_home | integer | Nullable — bonus question |
| scoreline_away | integer | Nullable — bonus question |
| submitted_at | timestamptz (MVT) | Last edit before lock |
| is_locked | boolean | Default false |
| points_earned | integer | Default 0. Set on result resolution. |
| UNIQUE | (user_id, match_id) | One prediction row per user per match |

All `uuid → players` and `uuid → teams` fields are real foreign keys to the tracker's tables. Attempting to pick a player_id that does not exist in `players` will be rejected at the database level.

---

## 9. Public Pages

### 9.1 Pick'em Section Pages

```
/pickem                         Overview — leaderboard summary, next open card
/pickem/match/:match_id         Prediction card (open, locked, or resolved state)
/pickem/leaderboard             Full Pick'em participant leaderboard
/pickem/mvp                     Season MVP composite leaderboard
/pickem/history                 All resolved match cards with crowd consensus
```

All pages are public. No login required to view. WhatsApp numbers never appear.

### 9.2 Prediction Card States

| State | Condition | User sees |
|---|---|---|
| Upcoming | Now < open time | Match details, countdown to open |
| Open (not submitted) | Open ≤ now < lock, no submission | Full prediction form |
| Open (submitted) | Open ≤ now < lock, submitted | Pre-filled editable form |
| Locked (submitted) | Now ≥ lock, submitted | Read-only picks |
| Locked (not submitted) | Now ≥ lock, no submission | "You did not submit predictions for this match" |
| Resolved | Match complete | Picks, correct answers, points earned, crowd consensus |
| Voided | Match postponed post-lock | Void message, no points shown |

### 9.3 Crowd Consensus

Crowd consensus — the percentage of participants who picked each option — is shown on prediction cards once at least 5 predictions exist for that match (to avoid revealing a single person's picks before a critical mass). After resolution, crowd consensus is permanently visible on the resolved card.

### 9.4 Pick'em Leaderboard

All registered participants ranked by `total_points` descending. Columns: Rank · Display name · Points · Predictions submitted. Updates live after each result save.

---

## 10. Admin Workflow

### 10.1 Pick'em Admin Responsibilities

The league tracker admin is the same person as the Pick'em admin. No additional admin accounts. Pick'em admin tasks are:

- Monitor sign-up registrations (view from admin panel — whatsapp_number visible here only)
- Post pre-match and post-match announcements to WhatsApp community
- Contact season winners via WhatsApp using the number from the admin panel
- No result entry — Pick'em resolution runs automatically when tracker results are saved

### 10.2 Result Entry Drives Pick'em Automatically

When admin saves a match result in the tracker:
1. Tracker writes `match_results`, `player_match_stats`, `match_absences`, and sets fixture status to `complete`
2. Pick'em point allocation runs immediately (same request, post-save)
3. `predictions.points_earned` updates for all affected rows
4. `pickem_users.total_points` recalculates
5. Leaderboard reflects updated totals

Admin does not interact with the Pick'em system to resolve predictions. It is fully automatic.

### 10.3 WhatsApp Engagement Cadence

- **24 hours before kickoff** — prediction window open announcement with match details and Pick'em link
- **1–2 hours before kickoff** — last chance reminder
- **After result entry** — result and Pick'em points reveal
- **Weekly** — leaderboard update to maintain interest

---

## 11. Future Considerations

### 11.1 Full Feature Model (Phase 2)

Deferred to post-Season 1. Requires community familiarity with the core Pick'em format before adding complexity:

- **Block prop** — binary yes/no prediction on whether a nominated player records a block
- **Spirit award predictions** — predict which player wins spirit each match, using `spirit_nominations` data already collected by the tracker
- **Featured player props** — goals/assist threshold for an admin-nominated player per match
- **Exchange window event** — mid-season bonus prediction tied to the June transfer window

Spirit predictions are particularly well-positioned for Phase 2 — the `spirit_nominations` data is already being collected by the tracker in Season 1.

### 11.2 Analytics and Historical Tracking

The shared database already captures everything needed for future analytics without schema changes:

- Per-user prediction accuracy over time
- Crowd consensus history — how community prediction splits trended across the season
- Most predicted MVP and scorer per match
- Season-over-season composite score comparison (when Season 2 data exists)
- Upset tracking — matches where crowd consensus was wrong

---

## Appendix: Scoring and Rules Quick Reference

```
Per-match maximum:      70 points
Season-long maximum:   130 points
Theoretical season max: 1,880 points  (70 × 25 matches) + 130

Scoreline formula:      max(0, 10 - |predicted_margin - actual_margin| × 2)
Season MVP formula:     (goals × 3) + (assists × 3) + (blocks × 2) + (mvp_wins × 5)

Tie policy:             Full points to all qualifying picks — no splitting
Postponement pre-lock:  Delete predictions, window resets to new kickoff time
Postponement post-lock: Zero points, void card, new window on reschedule
Result resolution:      Automatic post-save — no separate admin action
Re-entry:               Re-runs allocation with corrected result
Season close:           One-time, idempotent — runs when seasons.status = 'complete'

Registration cap:       100 accounts
WhatsApp format:        E.164 (+960XXXXXXX) — private, admin-only field
Window opens:           kickoff_time - 24 hours (MVT)
Window locks:           kickoff_time - 1 hour (MVT)
Lock enforcement:       Server-side — UI button state is not sufficient
```

---

*UFA Pick'em System — Technical Specification v1.2*
*Season 1 — Core Model — Vercel + Supabase (Option A)*
*Read alongside: UFA-League-Tracker-Technical-Specification-v1.1.md*
