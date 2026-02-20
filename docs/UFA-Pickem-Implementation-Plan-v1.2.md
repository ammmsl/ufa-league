# UFA Pick'em System — Phased Implementation Plan

**Version:** 1.2 — Vercel + Supabase (Option A)
**Document type:** Developer prompt and implementation guide
**Companion document:** `UFA-Pickem-Technical-Specification-v1.1.md`
**Platform:** Next.js on Vercel · Supabase as plain Postgres database (shared with league tracker)
**Prerequisite:** The league tracker must be fully built through all its phases — including Phase 0 (infrastructure) — before starting Pick'em. The Supabase project, `lib/db.ts`, middleware pattern, and JWT authentication are all inherited from the tracker build. Do not rebuild them.
**Approach:** Each phase is independently testable. Do not begin a phase until all exit criteria for the previous phase are confirmed passing.

---

## How to Use This Document

This plan assumes the league tracker is live and its infrastructure is in place. Pick'em adds two tables and four public pages to the same Next.js codebase and the same Supabase database. There is no new infrastructure, no new database connection to configure, and no API layer between the two systems.

Everything in the tracker implementation plan v1.2 regarding platform setup — the `lib/db.ts` client, the `middleware.ts` JWT protection, the Vercel environment variables, the Supabase pooler connection — carries over unchanged.

---

## System Constraints (Apply to All Phases)

These carry over from the tracker. Repeating the Pick'em-specific ones:

- Pick'em **never writes to tracker tables**. It reads `fixtures`, `teams`, `players`, `match_results`, `player_match_stats`, `match_absences`, and `seasons`. It writes only to `pickem_users` and `predictions`.
- `whatsapp_number` is a **private field**. Never returned by any public API route or rendered in any public page. Admin panel only.
- All **foreign keys are real database constraints** to tracker tables — not application-level checks.
- **Point allocation runs in the application layer** within the same `sql.begin()` transaction as the tracker result save. It is a function called inside the transaction, not a separate request.
- All timestamps in MVT. Use `Indian/Maldives` as the IANA timezone identifier. Inherited from tracker.
- `revalidate = 0` on all Pick'em public pages — same reasoning as tracker. Fresh data on every request.

---

## Phase 1 — Pick'em Tables and Season MVP View

### Objective

Add the two Pick'em-owned tables and the Season MVP composite view to the existing Supabase database. No application code beyond verifying the view works. The tracker tables are already in place.

### What to Build

**1.1 — Run in Supabase SQL editor**

Open the Supabase dashboard for the existing UFA project. Navigate to SQL Editor. Run:

```sql
-- pickem_users
CREATE TABLE pickem_users (
  user_id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name         varchar(40)  NOT NULL UNIQUE,
  whatsapp_number      varchar(20)  NOT NULL UNIQUE,
  season_mvp_pick      uuid         NOT NULL REFERENCES players(player_id) ON DELETE RESTRICT,
  season_scorer_pick   uuid         NOT NULL REFERENCES players(player_id) ON DELETE RESTRICT,
  season_winner_pick   uuid         NOT NULL REFERENCES teams(team_id)    ON DELETE RESTRICT,
  total_points         integer      NOT NULL DEFAULT 0,
  signup_at            timestamptz  NOT NULL DEFAULT now()
);

-- predictions
CREATE TABLE predictions (
  prediction_id      uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid         NOT NULL REFERENCES pickem_users(user_id),
  match_id           uuid         NOT NULL REFERENCES fixtures(match_id) ON DELETE RESTRICT,
  winner_pick        uuid         NOT NULL REFERENCES teams(team_id)     ON DELETE RESTRICT,
  mvp_pick           uuid         NOT NULL REFERENCES players(player_id) ON DELETE RESTRICT,
  top_scorer_pick    uuid         NOT NULL REFERENCES players(player_id) ON DELETE RESTRICT,
  top_assister_pick  uuid         NOT NULL REFERENCES players(player_id) ON DELETE RESTRICT,
  scoreline_home     integer,
  scoreline_away     integer,
  submitted_at       timestamptz  NOT NULL DEFAULT now(),
  is_locked          boolean      NOT NULL DEFAULT false,
  points_earned      integer      NOT NULL DEFAULT 0,
  UNIQUE (user_id, match_id)
);

-- Season MVP composite view
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

`ON DELETE RESTRICT` on the foreign keys prevents accidentally deleting a player or team that is referenced by an existing Pick'em sign-up. This is the safest default — if a player ever needs to be removed, address the Pick'em references first.

**1.2 — Verify the view in the SQL editor**

```sql
-- Should return all 44 active players with 0 for all stats
-- (assuming no results have been entered yet)
SELECT player_id, display_name, composite_score FROM season_mvp_scores;
```

Confirm 44 rows are returned. If tracker results have already been entered, confirm the composite formula matches: pick one player, note their goals/assists/blocks/mvp_wins from `player_match_stats` and `match_results`, calculate manually, and compare to the view output.

**1.3 — Verify the match player pool query**

Using a real `match_id` from the fixtures table:

```sql
-- Get a match_id to test with
SELECT match_id, home_team_id, away_team_id FROM fixtures LIMIT 1;

-- Test the player pool query
SELECT p.player_id, p.display_name, p.team_id
FROM players p
WHERE p.team_id IN (
  SELECT home_team_id FROM fixtures WHERE match_id = 'PASTE_MATCH_ID_HERE'
  UNION
  SELECT away_team_id FROM fixtures WHERE match_id = 'PASTE_MATCH_ID_HERE'
)
AND p.player_id NOT IN (
  SELECT player_id FROM match_absences WHERE match_id = 'PASTE_MATCH_ID_HERE'
)
AND p.is_active = true;
```

Should return the rostered players for both teams. If no absences have been entered for this match, it returns all players on both teams.

### What NOT to Build Yet

- No sign-up form
- No prediction cards
- No leaderboards
- No point allocation

### Exit Criteria

Before moving to Phase 2, confirm all of the following:

- [ ] `pickem_users` table visible in Supabase table editor with all columns
- [ ] `predictions` table visible with all columns
- [ ] `season_mvp_scores` view visible under Views in Supabase
- [ ] Foreign key from `predictions.match_id` to `fixtures.match_id` confirmed — attempt insert with non-existent match_id and confirm rejection
- [ ] Foreign key from `pickem_users.season_mvp_pick` to `players.player_id` confirmed — attempt insert with non-existent player_id and confirm rejection
- [ ] `UNIQUE (user_id, match_id)` on `predictions` confirmed — attempt duplicate insert and confirm rejection
- [ ] `UNIQUE` on `whatsapp_number` confirmed — attempt duplicate and confirm rejection
- [ ] `season_mvp_scores` view returns 44 rows
- [ ] Composite formula spot-checked against a player's actual stats if tracker results exist
- [ ] Match player pool query returns correct players for a real fixture

### Likely Failure Points

- Running the SQL in the wrong Supabase project — if you have multiple projects, confirm you are in the UFA project before running. The foreign key references to `players`, `teams`, and `fixtures` will fail if those tables do not exist.
- View not appearing — Supabase's table editor shows views separately from tables. Look under the "Views" section in the schema sidebar, not the "Tables" section.
- `ON DELETE RESTRICT` causing confusion — if you try to delete a player in the tracker admin and they have Pick'em sign-up data, the delete will be rejected. This is intentional. Mark players inactive (`is_active = false`) rather than deleting them.

---

## Phase 2 — Sign-Up System

### Objective

Build the Pick'em registration system as new pages and API routes in the existing Next.js codebase. The invite link, sign-up form, and admin registrant view.

### What to Build

**2.1 — Sign-up API route**

```typescript
// app/api/pickem/signup/route.ts
import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'

export async function POST(req: NextRequest) {
  const { display_name, whatsapp_number, season_mvp_pick, season_scorer_pick, season_winner_pick }
    = await req.json()

  // Normalise WhatsApp number to E.164
  const normalised = normaliseWhatsApp(whatsapp_number)
  if (!normalised) {
    return NextResponse.json({ error: 'Invalid WhatsApp number' }, { status: 400 })
  }

  // Check cap inside a transaction to prevent race conditions
  try {
    const result = await sql.begin(async (tx) => {
      const [{ count }] = await tx`SELECT COUNT(*)::int AS count FROM pickem_users`
      if (count >= 100) {
        throw new Error('CAP_REACHED')
      }

      return await tx`
        INSERT INTO pickem_users
          (display_name, whatsapp_number, season_mvp_pick, season_scorer_pick, season_winner_pick)
        VALUES
          (${display_name.trim()}, ${normalised},
           ${season_mvp_pick}, ${season_scorer_pick}, ${season_winner_pick})
        RETURNING user_id, display_name
      `
    })

    return NextResponse.json(result[0], { status: 201 })
  } catch (err: any) {
    if (err.message === 'CAP_REACHED') {
      return NextResponse.json({ error: 'Registration is full' }, { status: 409 })
    }
    // Handle unique constraint violations
    if (err.code === '23505') {
      if (err.constraint_name?.includes('whatsapp')) {
        return NextResponse.json({ error: 'This WhatsApp number is already registered' }, { status: 409 })
      }
      if (err.constraint_name?.includes('display_name')) {
        return NextResponse.json({ error: 'This display name is already taken' }, { status: 409 })
      }
    }
    throw err
  }
}
```

**2.2 — WhatsApp normalisation**

```typescript
// lib/whatsapp.ts
export function normaliseWhatsApp(input: string): string | null {
  // Strip everything except digits
  const digits = input.replace(/\D/g, '')

  let normalised: string

  if (digits.length === 7) {
    // 7654321 → +9607654321
    normalised = `+960${digits}`
  } else if (digits.length === 8 && digits.startsWith('0')) {
    // 07654321 → +9607654321
    normalised = `+960${digits.slice(1)}`
  } else if (digits.length === 10 && digits.startsWith('960')) {
    // 9607654321 → +9607654321
    normalised = `+${digits}`
  } else if (digits.length === 11 && digits.startsWith('9607')) {
    // Already has country code, just needs +
    normalised = `+${digits}`
  } else {
    return null
  }

  // Final validation: must match +9607XXXXXX (7 digits after 9607)
  if (!/^\+9607\d{6}$/.test(normalised)) return null

  return normalised
}
```

**2.3 — Sign-up page**

```typescript
// app/pickem/signup/page.tsx
import sql from '@/lib/db'

export const revalidate = 0

export default async function SignupPage() {
  // Check cap server-side before rendering form
  const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM pickem_users`
  if (count >= 100) {
    return <div>Pick'em registration is full for Season 1.</div>
  }

  // Fetch players and teams for the select fields — from tracker tables
  const players = await sql`
    SELECT player_id, display_name
    FROM players
    WHERE is_active = true
    ORDER BY display_name
  `
  const teams = await sql`
    SELECT team_id, team_name
    FROM teams
    JOIN seasons ON seasons.season_id = teams.season_id
    WHERE seasons.status != 'complete'
    ORDER BY team_name
  `

  return <SignupForm players={players} teams={teams} />
  // SignupForm is a 'use client' component that POSTs to /api/pickem/signup
}
```

The player and team selects are always populated from the tracker's live `players` and `teams` tables. No hardcoded lists. If the transfer window adds a new player during the season break, they will automatically appear in the select for any new registrations.

**2.4 — Admin registrant view**

Add to the existing admin panel. This is the only place `whatsapp_number` is exposed:

```typescript
// app/api/admin/pickem/users/route.ts
import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'

export async function GET(req: NextRequest) {
  // middleware handles auth — no check needed here

  const users = await sql`
    SELECT
      u.user_id,
      u.display_name,
      u.whatsapp_number,
      u.total_points,
      u.signup_at,
      mvp.display_name  AS mvp_pick_name,
      scorer.display_name AS scorer_pick_name,
      t.team_name       AS winner_pick_name
    FROM pickem_users u
    JOIN players mvp    ON mvp.player_id    = u.season_mvp_pick
    JOIN players scorer ON scorer.player_id = u.season_scorer_pick
    JOIN teams t        ON t.team_id        = u.season_winner_pick
    ORDER BY u.signup_at ASC
  `

  return NextResponse.json(users)
}
```

The CSV export can be a simple client-side transformation of this JSON response — no separate API endpoint needed.

> This endpoint is under `/api/admin/pickem/users` which matches the middleware `matcher` pattern `/api/admin/:path*`. It is protected without any additional code.

### Exit Criteria

Before moving to Phase 3, confirm all of the following:

- [ ] Sign-up form submits successfully and creates a row in `pickem_users` — verify in Supabase table editor
- [ ] `whatsapp_number` stored as E.164 — query `SELECT whatsapp_number FROM pickem_users` and confirm format
- [ ] `season_mvp_pick`, `season_scorer_pick`, `season_winner_pick` stored as UUIDs — confirm with `SELECT season_mvp_pick FROM pickem_users` — it must be a UUID, not a name string
- [ ] Duplicate number rejected — attempt to sign up twice with the same number and confirm error message
- [ ] Duplicate display name rejected — confirm error message
- [ ] All 7 phone format variants normalise correctly (test each in the `normaliseWhatsApp` function with a unit test)
- [ ] Player select shows all 44 active players in alphabetical order
- [ ] Team select shows all 5 teams
- [ ] Cap of 100 enforced — temporarily set `count >= 2` in the API to test the closed state, then restore
- [ ] Sign-up confirmation does not display `whatsapp_number`
- [ ] Admin registrant view at `/api/admin/pickem/users` returns `whatsapp_number` correctly
- [ ] Admin registrant view is not accessible without the admin JWT cookie — test with a direct browser request

### Likely Failure Points

- Postgres unique constraint error code — `err.code === '23505'` is the Postgres error code for unique violations. The `postgres` npm package preserves this code. Confirm by logging `err.code` on a test duplicate submission.
- Race condition on cap — the count check and insert must be inside `sql.begin()`. Two simultaneous requests at count 99 that both read 99 before either inserts will both proceed. The transaction serialises this correctly.
- `whatsapp_number` leaking through the sign-up confirmation response — the API returns `user_id` and `display_name` only. Confirm the response does not include `whatsapp_number` by inspecting the network response in browser DevTools after a successful sign-up.

---

## Phase 3 — Prediction Cards

### Objective

Build prediction card pages and submission API. Cards derive their state from tracker fixture data. Player pools computed live from tracker attendance data. Lock enforced server-side.

### What to Build

**3.1 — Prediction card page**

```typescript
// app/pickem/match/[matchId]/page.tsx
import sql from '@/lib/db'

export const revalidate = 0

export default async function PickemMatchPage({ params }: { params: { matchId: string } }) {
  const { matchId } = params

  // Fetch fixture from tracker
  const [fixture] = await sql`
    SELECT f.match_id, f.kickoff_time, f.status,
           ht.team_id AS home_team_id, ht.team_name AS home_team_name,
           at.team_id AS away_team_id, at.team_name AS away_team_name
    FROM fixtures f
    JOIN teams ht ON ht.team_id = f.home_team_id
    JOIN teams at ON at.team_id = f.away_team_id
    WHERE f.match_id = ${matchId}
  `

  if (!fixture) return <div>Match not found</div>

  const now = new Date()
  const kickoff = new Date(fixture.kickoff_time)
  const openTime  = new Date(kickoff.getTime() - 24 * 60 * 60 * 1000)
  const lockTime  = new Date(kickoff.getTime() -      60 * 60 * 1000)

  const windowOpen   = now >= openTime && now < lockTime
  const windowLocked = now >= lockTime
  const isComplete   = fixture.status === 'complete'
  const isPostponed  = fixture.status === 'postponed'

  // Fetch present player pool from tracker
  const players = await sql`
    SELECT p.player_id, p.display_name, p.team_id
    FROM players p
    WHERE p.team_id IN (${fixture.home_team_id}, ${fixture.away_team_id})
    AND p.player_id NOT IN (
      SELECT player_id FROM match_absences WHERE match_id = ${matchId}
    )
    AND p.is_active = true
    ORDER BY p.display_name
  `

  // Fetch crowd consensus if 5+ predictions exist
  const [{ count: predCount }] = await sql`
    SELECT COUNT(*)::int AS count FROM predictions WHERE match_id = ${matchId}
  `
  const consensus = predCount >= 5 ? await sql`
    SELECT winner_pick, COUNT(*) * 100.0 / ${predCount} AS pct
    FROM predictions WHERE match_id = ${matchId}
    GROUP BY winner_pick
  ` : null

  // If complete, fetch result for resolved card display
  const result = isComplete ? await sql`
    SELECT mr.score_home, mr.score_away, mr.mvp_player_id,
           p.display_name AS mvp_name
    FROM match_results mr
    JOIN players p ON p.player_id = mr.mvp_player_id
    WHERE mr.match_id = ${matchId}
  ` : null

  return (
    <PredictionCard
      fixture={fixture}
      players={players}
      windowOpen={windowOpen}
      windowLocked={windowLocked}
      isComplete={isComplete}
      isPostponed={isPostponed}
      consensus={consensus}
      result={result?.[0]}
    />
    // PredictionCard is a 'use client' component that handles form state
    // and calls POST /api/pickem/predict
  )
}
```

**3.2 — Prediction submission API route**

```typescript
// app/api/pickem/predict/route.ts
import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'

export async function POST(req: NextRequest) {
  const { user_id, match_id, winner_pick, mvp_pick,
          top_scorer_pick, top_assister_pick, scoreline_home, scoreline_away }
    = await req.json()

  // Server-side lock check
  const [fixture] = await sql`
    SELECT kickoff_time FROM fixtures WHERE match_id = ${match_id}
  `
  if (!fixture) {
    return NextResponse.json({ error: 'Match not found' }, { status: 404 })
  }

  const lockTime = new Date(new Date(fixture.kickoff_time).getTime() - 60 * 60 * 1000)
  if (new Date() >= lockTime) {
    return NextResponse.json({ error: 'Predictions for this match are locked' }, { status: 403 })
  }

  // Validate scoreline — both or neither
  if ((scoreline_home == null) !== (scoreline_away == null)) {
    return NextResponse.json({ error: 'Provide both scoreline values or neither' }, { status: 400 })
  }

  // Upsert — one row per user per match
  const result = await sql`
    INSERT INTO predictions
      (user_id, match_id, winner_pick, mvp_pick, top_scorer_pick, top_assister_pick,
       scoreline_home, scoreline_away, submitted_at)
    VALUES
      (${user_id}, ${match_id}, ${winner_pick}, ${mvp_pick},
       ${top_scorer_pick}, ${top_assister_pick},
       ${scoreline_home ?? null}, ${scoreline_away ?? null}, now())
    ON CONFLICT (user_id, match_id) DO UPDATE SET
      winner_pick       = EXCLUDED.winner_pick,
      mvp_pick          = EXCLUDED.mvp_pick,
      top_scorer_pick   = EXCLUDED.top_scorer_pick,
      top_assister_pick = EXCLUDED.top_assister_pick,
      scoreline_home    = EXCLUDED.scoreline_home,
      scoreline_away    = EXCLUDED.scoreline_away,
      submitted_at      = now()
    WHERE predictions.is_locked = false
    RETURNING prediction_id, submitted_at
  `

  if (result.length === 0) {
    return NextResponse.json({ error: 'Predictions for this match are locked' }, { status: 403 })
  }

  return NextResponse.json(result[0], { status: 201 })
}
```

The `WHERE predictions.is_locked = false` clause in the `ON CONFLICT DO UPDATE` means if `is_locked` was set to true between the lock time check and the upsert, the update is silently skipped and 0 rows are returned. This is the correct behaviour — the earlier check catches most cases, this handles the race condition.

**3.3 — Bulk lock job**

Rather than a scheduled background job (which would require Vercel Cron on a paid plan), bulk-lock predictions as a pre-step in the result entry handler:

```typescript
// Called at the start of the result entry transaction
await tx`
  UPDATE predictions
  SET is_locked = true
  WHERE match_id = ${match_id}
  AND is_locked = false
`
```

This ensures all predictions for a match are locked before points are allocated, even if some users submitted right at the boundary. Add this as step 0 inside the `sql.begin()` transaction in the result entry handler.

### Exit Criteria

Before moving to Phase 4, confirm all of the following:

- [ ] Prediction card renders correctly in all states: upcoming, open, locked, resolved, voided
- [ ] Q2/Q3/Q4 player selects show only present players — add a test absence to `match_absences`, render the card, confirm that player is excluded
- [ ] Q5 scoreline accepts both null (no submission), both integers, and rejects one without the other
- [ ] Submitting twice creates one row in `predictions` — confirm with `SELECT COUNT(*) FROM predictions WHERE user_id = X AND match_id = Y`
- [ ] `submitted_at` updates on re-submission — compare timestamps before and after a second submission
- [ ] Server-side lock: set a fixture's kickoff time to 30 minutes from now in Supabase, wait for lock, send a direct POST to `/api/pickem/predict` and confirm 403 response
- [ ] Crowd consensus only shows after 5+ predictions — test with 4 (no consensus) and 5 (consensus shown)
- [ ] Crowd consensus percentages sum to 100% — test with a known distribution
- [ ] Public (unauthenticated) user can view the card but cannot see individual user picks by name

### Likely Failure Points

- Lock time calculation in UTC vs MVT — the lock check uses `new Date()` (UTC) compared against `kickoff_time` minus 1 hour. Both sides of the comparison are UTC internally, which is correct. The `Indian/Maldives` timezone is only needed for display. Confirm the boundary is correct by testing a fixture with kickoff_time set to a known MVT time.
- The `ON CONFLICT DO UPDATE WHERE is_locked = false` returning 0 rows silently — the application must check the returned row count and return a 403 if it is 0 after what should be a successful upsert. The code above handles this.
- Player pool not updating after absences change — `revalidate = 0` ensures fresh data on each page load. Confirm by adding an absence in Supabase and refreshing the card page — the absent player must disappear from the select immediately.

---

## Phase 4 — Result Resolution, Leaderboards, and Season Close

### Objective

Wire Pick'em point allocation into the tracker's result save, build leaderboard pages, and implement season-close resolution. After this phase the system is complete.

### What to Build

**4.1 — Pick'em resolution function**

This is called inside the tracker's `sql.begin()` transaction in the result entry API route. It receives the transaction object (`tx`) so it runs inside the same atomic commit:

```typescript
// lib/pickem-resolve.ts
import { TransactionSql } from 'postgres'

export async function resolvePickem(match_id: string, tx: TransactionSql) {

  // Step 0 — bulk lock all predictions for this match
  await tx`
    UPDATE predictions SET is_locked = true
    WHERE match_id = ${match_id} AND is_locked = false
  `

  // Fetch result
  const [result] = await tx`
    SELECT score_home, score_away, mvp_player_id,
           home_team_id, away_team_id
    FROM match_results
    JOIN fixtures USING (match_id)
    WHERE match_results.match_id = ${match_id}
  `

  const winning_team_id =
    result.score_home > result.score_away ? result.home_team_id :
    result.score_away > result.score_home ? result.away_team_id :
    null  // draw

  // Top scorers set (handles ties)
  const top_scorers = await tx`
    SELECT player_id FROM player_match_stats
    WHERE match_id = ${match_id}
    AND goals = (SELECT MAX(goals) FROM player_match_stats WHERE match_id = ${match_id})
  `
  const topScorerIds = new Set(top_scorers.map(r => r.player_id))

  // Top assisters set (handles ties)
  const top_assisters = await tx`
    SELECT player_id FROM player_match_stats
    WHERE match_id = ${match_id}
    AND assists = (SELECT MAX(assists) FROM player_match_stats WHERE match_id = ${match_id})
  `
  const topAssisterIds = new Set(top_assisters.map(r => r.player_id))

  // Fetch all locked predictions for this match
  const preds = await tx`
    SELECT prediction_id, user_id,
           winner_pick, mvp_pick, top_scorer_pick, top_assister_pick,
           scoreline_home, scoreline_away
    FROM predictions
    WHERE match_id = ${match_id} AND is_locked = true
  `

  // Allocate points per prediction
  for (const pred of preds) {
    let points = 0

    // Q1 — match winner
    if (winning_team_id && pred.winner_pick === winning_team_id) points += 10

    // Q2 — MVP
    if (pred.mvp_pick === result.mvp_player_id) points += 20

    // Q3 — top scorer
    if (topScorerIds.has(pred.top_scorer_pick)) points += 15

    // Q4 — top assister
    if (topAssisterIds.has(pred.top_assister_pick)) points += 15

    // Q5 — scoreline margin
    if (pred.scoreline_home != null && pred.scoreline_away != null) {
      const predicted_margin = pred.scoreline_home - pred.scoreline_away
      const actual_margin    = result.score_home    - result.score_away
      const margin_error     = Math.abs(predicted_margin - actual_margin)
      points += Math.max(0, 10 - margin_error * 2)
    }

    await tx`
      UPDATE predictions SET points_earned = ${points}
      WHERE prediction_id = ${pred.prediction_id}
    `
  }

  // Recalculate total_points for all affected users
  await tx`
    UPDATE pickem_users
    SET total_points = (
      SELECT COALESCE(SUM(points_earned), 0)
      FROM predictions
      WHERE user_id = pickem_users.user_id
    )
    WHERE user_id IN (
      SELECT DISTINCT user_id FROM predictions WHERE match_id = ${match_id}
    )
  `
}
```

**4.2 — Wire into tracker result entry**

In the tracker's result entry API route (`app/api/admin/results/route.ts`), import and call `resolvePickem` as the final step inside `sql.begin()`:

```typescript
import { resolvePickem } from '@/lib/pickem-resolve'

await sql.begin(async (tx) => {
  // ... existing tracker steps 1-5 ...

  // Step 6 — Pick'em resolution (runs inside the same transaction)
  await resolvePickem(match_id, tx)
})
```

Because `resolvePickem` runs inside the same `sql.begin()`, if anything in the resolution fails, the entire transaction rolls back — including the tracker result. This ensures the database never has a result without corresponding Pick'em points, or vice versa.

**4.3 — Postponement handling**

Add to the fixture update API route. When `kickoff_time` changes on a postponed fixture, check for locked predictions and void them:

```typescript
// In app/api/admin/fixtures/[matchId]/route.ts PATCH handler
await sql.begin(async (tx) => {
  // Check for locked predictions before updating
  const locked = await tx`
    SELECT COUNT(*)::int AS count FROM predictions
    WHERE match_id = ${matchId} AND is_locked = true
  `

  if (locked[0].count > 0) {
    // Post-lock void — zero points, predictions remain for history
    await tx`
      UPDATE predictions SET points_earned = 0
      WHERE match_id = ${matchId} AND is_locked = true
    `
    await tx`
      UPDATE pickem_users
      SET total_points = (
        SELECT COALESCE(SUM(points_earned), 0)
        FROM predictions WHERE user_id = pickem_users.user_id
      )
      WHERE user_id IN (
        SELECT DISTINCT user_id FROM predictions WHERE match_id = ${matchId}
      )
    `
  } else {
    // Pre-lock void — delete predictions, they can resubmit
    await tx`DELETE FROM predictions WHERE match_id = ${matchId} AND is_locked = false`
  }

  // Update fixture kickoff time and reset to scheduled
  await tx`
    UPDATE fixtures
    SET kickoff_time = ${new_kickoff_time}, status = 'scheduled', updated_at = now()
    WHERE match_id = ${matchId}
  `
})
```

**4.4 — Season close**

Add a `season_resolved_at` column to track idempotency:

```sql
-- Run in Supabase SQL editor
ALTER TABLE seasons ADD COLUMN season_resolved_at timestamptz;
```

Season close function, called when admin marks season complete:

```typescript
// lib/pickem-season-close.ts
import sql from '@/lib/db'

export async function resolvePickemSeason(season_id: string) {
  // Idempotency check
  const [season] = await sql`
    SELECT season_resolved_at FROM seasons WHERE season_id = ${season_id}
  `
  if (season.season_resolved_at) return { alreadyResolved: true }

  await sql.begin(async (tx) => {
    // Season top scorer
    const topScorerGoals = await tx`
      SELECT MAX(total_goals) AS max FROM (
        SELECT SUM(goals) AS total_goals FROM player_match_stats
        JOIN fixtures ON fixtures.match_id = player_match_stats.match_id
        WHERE fixtures.season_id = ${season_id}
        GROUP BY player_id
      ) sub
    `
    const scorerWinners = await tx`
      SELECT player_id FROM (
        SELECT player_id, SUM(goals) AS total_goals FROM player_match_stats
        JOIN fixtures ON fixtures.match_id = player_match_stats.match_id
        WHERE fixtures.season_id = ${season_id}
        GROUP BY player_id
      ) sub
      WHERE total_goals = ${topScorerGoals[0].max}
    `
    const scorerWinnerIds = new Set(scorerWinners.map(r => r.player_id))

    await tx`
      UPDATE pickem_users
      SET total_points = total_points + 40
      WHERE season_scorer_pick = ANY(${[...scorerWinnerIds]})
    `

    // Season MVP composite
    const mvpWinners = await tx`
      SELECT player_id FROM season_mvp_scores
      WHERE composite_score = (SELECT MAX(composite_score) FROM season_mvp_scores)
    `
    const mvpWinnerIds = new Set(mvpWinners.map(r => r.player_id))

    await tx`
      UPDATE pickem_users
      SET total_points = total_points + 50
      WHERE season_mvp_pick = ANY(${[...mvpWinnerIds]})
    `

    // League winner — first team in standings
    // Use the same standings query from the tracker
    const standings = await getStandings(season_id) // imported from lib/standings.ts
    const winning_team_id = standings[0].team_id

    await tx`
      UPDATE pickem_users
      SET total_points = total_points + 40
      WHERE season_winner_pick = ${winning_team_id}
    `

    // Mark resolved
    await tx`
      UPDATE seasons SET season_resolved_at = now()
      WHERE season_id = ${season_id}
    `
  })

  return { alreadyResolved: false }
}
```

**4.5 — Pick'em leaderboard page (`/pickem/leaderboard`)**

```typescript
// app/pickem/leaderboard/page.tsx
import sql from '@/lib/db'

export const revalidate = 0

export default async function PickemLeaderboard() {
  const users = await sql`
    SELECT
      u.display_name,
      u.total_points,
      COUNT(p.prediction_id)::int AS predictions_submitted
    FROM pickem_users u
    LEFT JOIN predictions p ON p.user_id = u.user_id
    GROUP BY u.user_id, u.display_name, u.total_points
    ORDER BY u.total_points DESC, u.display_name ASC
  `
  // Render leaderboard table
}
```

Note `u.display_name` only — `whatsapp_number` is not selected and never appears in this query or its response.

**4.6 — Season MVP leaderboard page (`/pickem/mvp`)**

```typescript
// app/pickem/mvp/page.tsx
import sql from '@/lib/db'

export const revalidate = 0

export default async function MvpLeaderboard() {
  const scores = await sql`SELECT * FROM season_mvp_scores`

  const totalUsers = (await sql`SELECT COUNT(*)::int AS count FROM pickem_users`)[0].count

  const communityPicks = await sql`
    SELECT season_mvp_pick AS player_id,
           COUNT(*) * 100.0 / ${totalUsers} AS community_pct
    FROM pickem_users
    GROUP BY season_mvp_pick
  `
  const picksMap = Object.fromEntries(communityPicks.map(r => [r.player_id, r.community_pct]))

  // Merge and render
}
```

### Exit Criteria

Before marking Pick'em production-ready, confirm all of the following:

**Point allocation — use Appendix A test data:**

- [ ] Q1 correct → 10 pts, incorrect → 0, draw → 0
- [ ] Q2 correct → 20 pts, incorrect → 0
- [ ] Q3 correct → 15 pts. Tie scenario: both pickers receive 15 pts
- [ ] Q4 correct → 15 pts. Tie scenario: both pickers receive 15 pts
- [ ] Q5 exact margin (10–6 vs actual 11–7, same margin 4) → 10 pts
- [ ] Q5 margin error 1 → 8 pts, error 2 → 6 pts, error 5+ → 0 pts
- [ ] Q5 null → 0 pts, no error thrown
- [ ] `predictions.points_earned` correct for each row — query after result save
- [ ] `pickem_users.total_points` correct — query after result save
- [ ] Re-entry: correct a result, confirm points change correctly and are not doubled

**Transaction integrity:**

- [ ] Pick'em resolution and tracker result save commit together — cause the resolution to fail (temporarily use an invalid SQL statement) and confirm the tracker result is also rolled back

**Postponement:**

- [ ] Pre-lock postponement deletes prediction rows — confirm count = 0 after
- [ ] Post-lock postponement zeros `points_earned` — confirm and verify `total_points` updates
- [ ] New window opens on rescheduled `kickoff_time`

**Season close:**

- [ ] Season top scorer resolves correctly
- [ ] Tie scenario: two players equal goals → both pickers +40
- [ ] Season MVP resolves correctly from `season_mvp_scores`
- [ ] `season_resolved_at` set after first run
- [ ] Second call to `resolvePickemSeason` returns `{ alreadyResolved: true }` and changes no points
- [ ] Final `total_points` includes both match points and season-long awards

**Leaderboards:**

- [ ] Pick'em leaderboard ranks correctly — verify with 3 test users
- [ ] `whatsapp_number` absent from leaderboard response — inspect network response in DevTools
- [ ] MVP leaderboard composite scores match manual calculation
- [ ] Community pick percentage accurate

**Privacy audit:**

- [ ] GET `/pickem/leaderboard` — `whatsapp_number` absent
- [ ] GET `/pickem/mvp` — `whatsapp_number` absent
- [ ] GET `/pickem/match/[id]` — `whatsapp_number` absent
- [ ] GET `/api/admin/pickem/users` — requires admin JWT, returns `whatsapp_number` only to authenticated admin

### Likely Failure Points

- `resolvePickem` not receiving the transaction object — if called with `sql` instead of `tx`, the resolution runs outside the transaction. A failure after the tracker result commits but before Pick'em finishes will leave inconsistent state. Always pass `tx`.
- Season close adding to `total_points` with `total_points + 40` — if season close is called twice (before the idempotency check is working), users receive double awards. Test the idempotency check explicitly before deploying.
- `ANY(${[...Set]})` syntax — the `postgres` npm package supports passing arrays to `ANY()`. Confirm this syntax works in your version by testing a simple `SELECT ... WHERE id = ANY(${['id1','id2']})`.
- `season_mvp_scores` view queried inside a transaction (`tx`) — views are queryable inside transactions in Postgres. No special handling needed.

---

## Cross-Phase Checklist

Run only after all four phases are complete and all exit criteria pass:

- [ ] `pickem_users` and `predictions` tables exist in Supabase alongside tracker tables — visible in table editor
- [ ] All foreign keys from Pick'em tables to tracker tables confirmed as real constraints
- [ ] `whatsapp_number` absent from every public endpoint — confirm via DevTools network inspection
- [ ] `season_mvp_pick`, `season_scorer_pick`, `season_winner_pick` stored as UUIDs — confirm in Supabase
- [ ] `resolvePickem` called inside `sql.begin()` transaction in result entry handler
- [ ] `season_resolved_at` idempotency works
- [ ] Registration cap enforced inside transaction — race condition test passes
- [ ] All Pick'em public pages have `revalidate = 0`
- [ ] Admin registrant view behind JWT middleware
- [ ] No Supabase client library imported anywhere — grep for `@supabase/supabase-js` and confirm zero results

---

## Appendix A: Test Data and Expected Points

*(Unchanged from v1.1)*

**Corrected expected totals:**

| User | Q1 | Q2 | Q3 | Q4 | Q5 | Total |
|---|---|---|---|---|---|---|
| User Alpha | 10 | 0 | 15 | 15 | 8 | **48** |
| User Beta | 10 | 20 | 15 | 0 | 8 | **53** |
| User Gamma | 0 | 0 | 0 | 0 | 6 | **6** |

---

## Appendix B: Key Rules Summary

*(All business rules unchanged from v1.1)*

---

## Appendix C: Pick'em Environment Variables

No new environment variables are required for Pick'em. All variables (`DATABASE_URL`, `JWT_SECRET`, `ADMIN_PASSWORD_HASH`) were set during tracker Phase 0. Pick'em shares them.

The one addition to the database (not environment variables) is the `season_resolved_at` column on `seasons`, added via SQL editor in Phase 4.

---

## Appendix D: NPM Dependencies

No new packages required for Pick'em. All dependencies (`postgres`, `jose`, `bcryptjs`) were installed during the tracker build. Pick'em uses the same `lib/db.ts`, the same middleware, and the same Next.js project.

---

*UFA Pick'em System — Phased Implementation Plan v1.2*
*Vercel + Supabase (Option A — Plain Postgres) · Shared database with league tracker*
*Read alongside: UFA-Pickem-Technical-Specification-v1.1.md and UFA-League-Tracker-Implementation-Plan-v1.2.md*
