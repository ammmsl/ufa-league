# UFA League — Site Review Template

> **How to Use**
> Go through each section one at a time while browsing the live site.
> Fill in **Your Observations** freely — stream of consciousness is fine.
> Use **Desired Changes** to get specific about what you want.
> Set a **Priority** so the implementation plan can phase work correctly.
> Leave **Notes for Agent** empty if you have no technical opinion — the LLM will infer from context.
>
> When done, hand this file to an LLM agent with the instruction:
> _"Read SITE-REVIEW-TEMPLATE.md and produce a phased frontend/QOL improvement plan."_

---

## Global / Cross-Cutting

_Observations that apply site-wide — design system, typography, color palette, spacing, navigation behaviour, dark/light mode, branding._

### Theme & Visual Identity

#### Your Observations
> <!-- How does the overall look feel? Brand cohesion? Color palette working? -->

#### Desired Changes
- Color palette / dark mode:
- Typography (font family, sizes, weights):
- Spacing & density:
- Branding / logo / identity:
- Iconography:

#### Notes for Agent
<!-- e.g. "Keep Tailwind v4, no new dependencies unless necessary" -->

---

### Navigation (PublicNav)

**File:** `app/_components/PublicNav.tsx`
**Current Purpose:** Sticky horizontal navbar linking to all 9 public pages (Fixtures, Standings, Teams, Players, Spirit, Stats, MVP, Gallery, Rules).

#### Current Sections
- Site name / logo area (left)
- Nav links: Fixtures · Standings · Teams · Players · Spirit · Stats · MVP · Gallery · Rules
- No active-link highlighting
- No mobile hamburger menu — all links visible at all sizes

#### Your Observations
> <!-- Too many links? Order feel right? Mobile overflow? Active state? -->

#### Desired Changes
- Visual/layout:
- Data/content:
- Interactions/UX:
- Mobile:

#### Priority
[ ] Low  [ ] Medium  [ ] High  [ ] Skip

#### Notes for Agent
<!-- -->

---

### Mobile Experience (Global)

#### Your Observations
> <!-- 390px baseline. What breaks or feels cramped? What works well? -->

#### Desired Changes
- Layout adjustments:
- Touch targets:
- Typography at small size:
- Other:

#### Notes for Agent
<!-- -->

---

---

## Public Pages

---

### `/` — Home

**File:** `app/page.tsx`
**Current Purpose:** Season landing page — shows season banner, next 3 upcoming fixtures, mini standings (top 5), and last completed match result.

#### Current Sections
- Season status banner (season name + status)
- "Next Up" — next 3 fixtures with date, teams, venue
- Mini standings table — top 5 teams (Pos, Team, P, Pts)
- "Last Result" — most recent completed match score + teams

#### Your Observations
> <!-- First impression. Hero feel? Information hierarchy? What's missing above the fold? -->

#### Desired Changes
- Visual/layout:
- Data/content:
- Interactions/UX:
- Mobile:

#### Priority
[ ] Low  [ ] Medium  [ ] High  [ ] Skip

#### Notes for Agent
<!-- e.g. "Hero section should be punchy — league name, matchweek, next game countdown" -->

---

### `/fixtures` — Fixtures

**File:** `app/fixtures/page.tsx`
**Current Purpose:** Full fixture list grouped by matchweek/block, with calendar view, holiday ranges, and bye team per matchweek shown.

#### Current Sections
- Filter tabs or headers by block (pre-break / post-break)
- Matchweek groups — date, home team vs away team, venue, status (scheduled/completed)
- Bye team indicator per matchweek
- Holiday ranges overlaid on calendar
- Calendar view component (`FixturesCalendar.tsx`)

#### Your Observations
> <!-- Does the grouping make sense? Is the calendar useful? Easy to find "my team's next game"? -->

#### Desired Changes
- Visual/layout:
- Data/content:
- Interactions/UX:
- Mobile:

#### Priority
[ ] Low  [ ] Medium  [ ] High  [ ] Skip

#### Notes for Agent
<!-- -->

---

### `/standings` — Standings

**File:** `app/standings/page.tsx`
**Current Purpose:** Full league table with P/W/D/L/GF/GA/GD columns and a recent form guide (last 5 results as coloured circles) on desktop.

#### Current Sections
- Standings table: Pos · Team · P · W · D · L · GF · GA · GD · Pts
- Form guide (last 5): coloured W/D/L circles — desktop only
- No tiebreaker explanation

#### Your Observations
> <!-- Table legible on mobile? Form guide visible enough? Anything missing (xG, spirit, etc.)? -->

#### Desired Changes
- Visual/layout:
- Data/content:
- Interactions/UX:
- Mobile:

#### Priority
[ ] Low  [ ] Medium  [ ] High  [ ] Skip

#### Notes for Agent
<!-- Tiebreaker order: GD → H2H → GF. Points formula: W×3 + D. -->

---

### `/teams` — Teams

**File:** `app/teams/page.tsx`
**Current Purpose:** Grid of 5 team cards, each showing player count, total points, and W-D-L record.

#### Current Sections
- 5 team cards in a grid
- Each card: team name, player count, points, W-D-L record
- Links to `/team/[teamId]`

#### Your Observations
> <!-- Cards feel alive or boring? Should there be more info at a glance (position, form)? -->

#### Desired Changes
- Visual/layout:
- Data/content:
- Interactions/UX:
- Mobile:

#### Priority
[ ] Low  [ ] Medium  [ ] High  [ ] Skip

#### Notes for Agent
<!-- -->

---

### `/team/[teamId]` — Team Detail

**File:** `app/team/[teamId]/page.tsx`
**Current Purpose:** Team profile — league position header, full roster with season stats (G/A/B per player), recent 5 results, next 2 fixtures, head-to-head records vs all opponents.

#### Current Sections
- Header: team name, league position, W-D-L-Pts
- Roster table: player name · G · A · B (sorted by contribution)
- Recent form: last 5 results
- Upcoming fixtures: next 2
- Head-to-head table vs each of the other 4 teams

#### Your Observations
> <!-- Does the H2H add value here? Is the roster table the right focus? Team identity? -->

#### Desired Changes
- Visual/layout:
- Data/content:
- Interactions/UX:
- Mobile:

#### Priority
[ ] Low  [ ] Medium  [ ] High  [ ] Skip

#### Notes for Agent
<!-- -->

---

### `/players` — Players

**File:** `app/players/page.tsx`
**Current Purpose:** All 44 active players grouped by team; shows player count per team and a total count.

#### Current Sections
- Team groupings (5 sections)
- Player names listed within each team
- Player count per team + total count
- Links to `/player/[playerId]`

#### Your Observations
> <!-- Is this a directory or a stats page? Should stats show inline? Search/filter? -->

#### Desired Changes
- Visual/layout:
- Data/content:
- Interactions/UX:
- Mobile:

#### Priority
[ ] Low  [ ] Medium  [ ] High  [ ] Skip

#### Notes for Agent
<!-- -->

---

### `/player/[playerId]` — Player Detail

**File:** `app/player/[playerId]/page.tsx`
**Current Purpose:** Player profile — season totals (appearances/goals/assists/blocks), spirit nomination count, match-by-match stat log.

#### Current Sections
- Header: player name, team name
- Season totals: Apps · G · A · B · Spirit nominations
- Match log table: Date · Opponent · Result · G · A · B

#### Your Observations
> <!-- Is the match log useful? Any missing stats? How does it feel vs a real sports player card? -->

#### Desired Changes
- Visual/layout:
- Data/content:
- Interactions/UX:
- Mobile:

#### Priority
[ ] Low  [ ] Medium  [ ] High  [ ] Skip

#### Notes for Agent
<!-- -->

---

### `/match/[matchId]` — Match Summary

**File:** `app/match/[matchId]/page.tsx`
**Current Purpose:** Pre-match: shows rosters in 2-column grid. Post-match: score (text-6xl), top scorer/assister/MVP highlights, full per-player stats by team, spirit nominations. Includes OG image tags for WhatsApp/Instagram sharing.

#### Current Sections
- **Pre-result:** home team roster · away team roster (2-col)
- **Post-result:**
  - Score block (very large text, team names)
  - Top stats highlights (top scorer, assister, MVP)
  - Per-team player stat tables (G/A/B per player)
  - Absent players (greyed/italic)
  - Spirit nominations
- OG meta tags for social sharing

#### Your Observations
> <!-- Is the score the hero it should be? Share-worthy? What would you screenshot and send to the group chat? -->

#### Desired Changes
- Visual/layout:
- Data/content:
- Interactions/UX:
- Mobile:

#### Priority
[ ] Low  [ ] Medium  [ ] High  [ ] Skip

#### Notes for Agent
<!-- This page is the most share-worthy — should look like a real sports result card on mobile. OG image already wired up. -->

---

### `/spirit` — Spirit Leaderboard

**File:** `app/spirit/page.tsx`
**Current Purpose:** Ranked leaderboard of spirit nominations — player name, team, nomination count.

#### Current Sections
- Ranked table: Rank · Player · Team · Nominations

#### Your Observations
> <!-- Does spirit feel celebrated enough? Is a plain table the right format? -->

#### Desired Changes
- Visual/layout:
- Data/content:
- Interactions/UX:
- Mobile:

#### Priority
[ ] Low  [ ] Medium  [ ] High  [ ] Skip

#### Notes for Agent
<!-- One spirit nomination per team per match — max 2 per match (home + away team each nominate). -->

---

### `/stats` — Stats Leaderboard

**File:** `app/stats/page.tsx`
**Current Purpose:** Four ranked tables: Goals (with per-game avg), Assists (per-game), Blocks (per-game), Appearances — all sorted by total.

#### Current Sections
- Goals table: Rank · Player · Team · Total · Per Game
- Assists table: same columns
- Blocks table: same columns
- Appearances table: Rank · Player · Team · Apps

#### Your Observations
> <!-- Four separate tables feel right or would a unified "top scorers" panel work better? -->

#### Desired Changes
- Visual/layout:
- Data/content:
- Interactions/UX:
- Mobile:

#### Priority
[ ] Low  [ ] Medium  [ ] High  [ ] Skip

#### Notes for Agent
<!-- -->

---

### `/mvp` — MVP Leaderboard

**File:** `app/mvp/page.tsx`
**Current Purpose:** Season MVP ranking using formula: (Goals × 3) + (Assists × 3) + (Blocks × 2) + (MVP wins × 5). Shows G/A/B/MVP columns alongside score.

#### Current Sections
- Ranked table: Rank · Player · Team · G · A · B · MVP wins · Score

#### Your Observations
> <!-- Is the formula visible/explained? Should the top 3 be highlighted differently? -->

#### Desired Changes
- Visual/layout:
- Data/content:
- Interactions/UX:
- Mobile:

#### Priority
[ ] Low  [ ] Medium  [ ] High  [ ] Skip

#### Notes for Agent
<!-- Formula: (G×3) + (A×3) + (B×2) + (MVP wins×5) -->

---

### `/gallery` — Gallery

**File:** `app/gallery/page.tsx`
**Current Purpose:** Embeds a Google Photos album using a PublicAlbum widget; links to the shared album.

#### Current Sections
- Embedded Google Photos album widget
- Link to full album

#### Your Observations
> <!-- Does the embed feel integrated or like a bolt-on? Any issues on mobile? -->

#### Desired Changes
- Visual/layout:
- Data/content:
- Interactions/UX:
- Mobile:

#### Priority
[ ] Low  [ ] Medium  [ ] High  [ ] Skip

#### Notes for Agent
<!-- External embed — limited control over styling. May need iframe wrapper or link-out approach instead. -->

---

### `/rules` — Rules

**File:** `app/rules/page.tsx`
**Current Purpose:** Static informational page covering Ultimate Frisbee basics, 5v5 mixed rules, Spirit of the Game, league format, and tiebreaker order.

#### Current Sections
- Section: Ultimate Frisbee basics
- Section: 5v5 mixed rules
- Section: Spirit of the Game
- Section: League format (scoring, match length)
- Section: Tiebreaker order (GD → H2H → GF)

#### Your Observations
> <!-- Readable? Feels like a proper rulebook or a wall of text? Good for new players? -->

#### Desired Changes
- Visual/layout:
- Data/content:
- Interactions/UX:
- Mobile:

#### Priority
[ ] Low  [ ] Medium  [ ] High  [ ] Skip

#### Notes for Agent
<!-- Static content — no DB queries. Changes are purely presentational. -->

---

---

## Admin Pages

---

### `/admin/login` — Login

**File:** `app/admin/login/page.tsx`
**Current Purpose:** Single password field form; authenticates via POST to `/api/admin/login`, sets httpOnly JWT cookie.

#### Current Sections
- Password input
- Submit button
- Error state (wrong password)

#### Your Observations
> <!-- Functional but plain? Any QOL missing (e.g. show/hide password, loading state)? -->

#### Desired Changes
- Visual/layout:
- Data/content:
- Interactions/UX:
- Mobile:

#### Priority
[ ] Low  [ ] Medium  [ ] High  [ ] Skip

#### Notes for Agent
<!-- Auth is JWT in httpOnly cookie via jose + bcryptjs. No changes to auth logic needed — UI only. -->

---

### `/admin/dashboard` — Dashboard

**File:** `app/admin/dashboard/page.tsx`
**Current Purpose:** Server-rendered overview — pending results (past kickoff, no result entered), next scheduled match, recent activity, and season-at-a-glance stats (total / completed / remaining fixtures).

#### Current Sections
- Pending results list (fixtures past kickoff without a result)
- Next match card
- Recent activity log
- Season stats: Total fixtures · Completed · Remaining

#### Your Observations
> <!-- Is this the right "command centre" feel? Anything that should surface here that doesn't? -->

#### Desired Changes
- Visual/layout:
- Data/content:
- Interactions/UX:
- Mobile:

#### Priority
[ ] Low  [ ] Medium  [ ] High  [ ] Skip

#### Notes for Agent
<!-- Server component — reads DB directly. Any new data shown here needs a SQL query added. -->

---

### `/admin/fixtures` — Fixture Postponement

**File:** `app/admin/fixtures/page.tsx`
**Current Purpose:** 3-stage postponement wizard: (1) select fixture, (2) pick new date, (3) cascade preview with conflict/holiday detection and per-row manual override; bulk PATCH to update multiple fixtures.

#### Current Sections
- Stage 1: Fixture selector (dropdown or list)
- Stage 2: Date picker for new kickoff
- Stage 3: Cascade preview table — affected fixtures, detected conflicts, manual override toggles
- Confirm / submit bulk update

#### Your Observations
> <!-- Wizard flow clear? Cascade preview understandable? Any friction points? -->

#### Desired Changes
- Visual/layout:
- Data/content:
- Interactions/UX:
- Mobile:

#### Priority
[ ] Low  [ ] Medium  [ ] High  [ ] Skip

#### Notes for Agent
<!-- Client component ~725 lines. Uses /api/admin/fixtures/bulk PATCH. Holiday data from /api/admin/holidays. -->

---

### Result Entry Flow — `AdminResultForm`

**File:** `app/_components/AdminResultForm.tsx`
**Current Purpose:** 5-step result entry form accessible from the match page (admin only): (1) score entry with +/- buttons, (2) absent players checkboxes, (3) per-player stats table (G/A/B), (4) MVP radio selection, (5) spirit nominee dropdowns per team.

#### Current Sections
- Step 1: Score — home and away +/- counters
- Step 2: Absent players — checkbox list per team
- Step 3: Player stats — table with G/A/B inputs per active player
- Step 4: MVP — radio buttons from player list
- Step 5: Spirit nominees — one dropdown per team
- Goals total warning (non-blocking)
- Submit button

#### Your Observations
> <!-- Multi-step flow or single long form? Any step that feels painful to fill in quickly? -->

#### Desired Changes
- Visual/layout:
- Data/content:
- Interactions/UX:
- Mobile:

#### Priority
[ ] Low  [ ] Medium  [ ] High  [ ] Skip

#### Notes for Agent
<!-- Atomic write via /api/admin/results POST — sql.begin() transaction. All 5 tables must write together. -->

---

---

## Shared Components

---

### `AdminNav`

**File:** `app/_components/AdminNav.tsx`
**Current Purpose:** Sticky admin navigation with Dashboard and Fixtures links; highlights current page.

#### Your Observations
> <!-- Sufficient for current admin scope? Anything missing as admin features grow? -->

#### Desired Changes
- Visual/layout:
- Data/content:
- Interactions/UX:

#### Priority
[ ] Low  [ ] Medium  [ ] High  [ ] Skip

#### Notes for Agent
<!-- -->

---

---

## Implementation Plan Scaffold

> _This section is filled in by the LLM agent after reading your completed observations above._
> _Leave it blank — it will be generated._

### Phase 1 — Quick Wins
<!-- High priority, low effort changes -->

### Phase 2 — Core UX Improvements
<!-- Medium complexity, high impact -->

### Phase 3 — Visual Polish
<!-- Design system, branding, animations -->

### Phase 4 — Feature Additions
<!-- New data, new interactions -->

### Deferred / Out of Scope
<!-- Low priority or requires backend work not in scope -->
