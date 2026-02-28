# Phase 5 — New Conversation Prompt

Copy everything below this line into a new Claude Code conversation.

---

We're continuing work on the UFA League Tracker (Next.js 16.1.6 / React 19 / Tailwind v4 / Supabase plain Postgres / Vercel). Please read CLAUDE.md for full context before starting.

**Current state:**
- Phases 0–4 fully complete. Season is `active`. 20 fixtures scheduled across 10 matchweeks. All 8 public pages live.
- `lib/standings.ts` already exists with `getStandings(seasonId)` — do NOT recreate it.
- `lib/db.ts` has `max: 1`, `ssl: 'require'`, `prepare: false` — DO NOT change these.
- `app/admin/setup/page.tsx` is ~1400 lines — DO NOT touch it.

**Task: Build Phase 5 — Admin result entry.**

### Files to create

1. `app/api/admin/results/route.ts` — POST handler (atomic transaction)
2. `app/api/admin/results/[matchId]/route.ts` — GET handler (fetch existing result for pre-fill)
3. `app/admin/results/page.tsx` — result entry UI (client component)

---

### `POST /api/admin/results` — Atomic transaction

Accepts JSON body:
```typescript
{
  match_id:       string
  score_home:     number      // 0–11
  score_away:     number      // 0–11
  mvp_player_id:  string
  player_stats:   { player_id: string; team_id: string; goals: number; assists: number; blocks: number }[]
  absences:       { player_id: string; team_id: string }[]
  spirit:         { nominating_team_id: string; nominated_player_id: string }[]
}
```

Transaction steps (all inside `sql.begin()`):
1. **Season-complete guard** — query season status via the match_id before entering the transaction; return 403 if `status = 'complete'`
2. UPSERT `match_results` (ON CONFLICT match_id DO UPDATE — supports re-entry)
3. DELETE + INSERT `player_match_stats` (use `tx(array)` bulk insert; skip INSERT if array empty)
4. DELETE + INSERT `match_absences`
5. DELETE + INSERT `spirit_nominations`
6. `UPDATE fixtures SET status = 'complete', updated_at = now() WHERE match_id = $1`

Return `{ ok: true }` on success. Return 400 with `{ error }` for validation failures (missing fields, score > 11). Auth is handled by middleware — no JWT check needed inside the handler.

---

### `GET /api/admin/results/[matchId]`

Returns existing result data for pre-filling the form on re-entry. Single query joining all 5 tables. Returns `null` (404) if no result exists yet.

Response shape:
```typescript
{
  match_id: string
  score_home: number
  score_away: number
  mvp_player_id: string
  player_stats: { player_id: string; team_id: string; goals: number; assists: number; blocks: number }[]
  absences: { player_id: string; team_id: string }[]
  spirit: { nominating_team_id: string; nominated_player_id: string }[]
}
```

---

### `app/admin/results/page.tsx` — Result entry UI

**`'use client'`** — this is a client component.

**Step flow (single page, conditional sections — not a wizard):**

1. **Match selector** — `<select>` populated from `GET /api/admin/fixtures?status=scheduled,complete`. Show as `MW{n} · TeamA vs TeamB`. Selecting a match loads rosters + any existing result.

2. **Absent players** — two columns (home team / away team). Checkboxes for each player. Checking a player removes them from the stats section below.

3. **Score** — two number inputs side by side (`score_home` / `score_away`). Min 0, max 11.

4. **Per-player stats** — one row per present player (not in absences). Columns: Player name | Goals | Assists | Blocks. All inputs default 0, min 0.

5. **MVP** — radio buttons listing all present players from both teams.

6. **Spirit nominations** — two dropdowns: one for home team (lists present players from away team), one for away team (lists present players from home team).

7. **Save button** — POST to `/api/admin/results`. Show loading state. On success show green "Saved ✓" banner. On error show red error message.

**Pre-fill on re-entry:** after loading a match, if `GET /api/admin/results/[matchId]` returns data, pre-populate all fields.

**Styling:** match admin dashboard style (`bg-gray-950`, `bg-gray-900 rounded-lg`, dark theme). Not mobile-first — admin panel is desktop use.

**Link from dashboard:** add a "Result Entry" link to `app/admin/dashboard/page.tsx` alongside the existing Setup Wizard link.

---

### Hard rules (same as always)

- `await params` in dynamic routes (Next.js 16)
- Port 6543, `max: 1`, `ssl: 'require'`, `prepare: false` in `lib/db.ts` — already correct, don't touch
- `sql.begin()` for the multi-table write — never sequential awaits without a transaction
- `tx(array)` for bulk inserts via postgres npm package
- Validate `score_home` and `score_away` ≤ 11 at the API layer
- Season-complete check at the API layer (not just UI)
- No `@supabase/supabase-js`

---

### Fixture status values (schema)

`'scheduled' | 'live' | 'complete' | 'postponed' | 'cancelled'`

Note: the value is `'complete'` (not `'completed'`).

---

### Database schema reminder

```
fixtures           — match_id, season_id, home_team_id, away_team_id, kickoff_time, status, matchweek
match_results      — match_result_id, match_id (UNIQUE), score_home, score_away, mvp_player_id, resolved_at
player_match_stats — stat_id, match_id, player_id, team_id, goals, assists, blocks; UNIQUE(player_id, match_id)
match_absences     — absence_id, match_id, player_id, team_id; UNIQUE(player_id, match_id)
spirit_nominations — nomination_id, match_id, nominating_team_id, nominated_player_id; UNIQUE(match_id, nominating_team_id)
players            — player_id, season_id, team_id, display_name, is_active
teams              — team_id, season_id, team_name
seasons            — season_id, season_name, start_date, end_date, break_start, break_end, status
```

Build in this order: API route (POST) → GET pre-fill route → admin UI page → dashboard link. Run `npm run build` and verify no TypeScript errors after all files are created.
