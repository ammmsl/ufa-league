import sql from '@/lib/db'
import PublicNav from '../_components/PublicNav'
import StatsClient from './StatsClient'

export const revalidate = 0

async function getActiveSeason() {
  const rows = await sql`
    SELECT season_id::text, season_name
    FROM seasons
    WHERE status = 'active'
    LIMIT 1
  `
  return rows[0] ?? null
}

export type StatRow = {
  player_id:    string
  display_name: string
  team_name:    string
  team_id:      string
  appearances:  number
  total:        number
  per_game:     number | null
}

export type MatchweekRow = {
  player_id:    string
  display_name: string
  team_name:    string
  matchweek:    number
  cum_goals:    number
  cum_assists:  number
  cum_blocks:   number
  cum_apps:     number
}

export type StatsClientProps = {
  seasonName:  string
  goals:       StatRow[]
  assists:     StatRow[]
  blocks:      StatRow[]
  appearances: StatRow[]
  history:     MatchweekRow[]
}

async function getGoals(seasonId: string): Promise<StatRow[]> {
  const rows = await sql`
    SELECT
      p.player_id::text,
      p.display_name,
      t.team_name,
      t.team_id::text,
      COUNT(pms.match_id)::int AS appearances,
      COALESCE(SUM(pms.goals), 0)::int AS total,
      CASE WHEN COUNT(pms.match_id) = 0 THEN NULL
           ELSE ROUND(COALESCE(SUM(pms.goals), 0)::numeric / COUNT(pms.match_id), 1)
      END AS per_game
    FROM players p
    JOIN teams t ON t.team_id = p.team_id
    LEFT JOIN player_match_stats pms ON pms.player_id = p.player_id
    WHERE p.is_active = true
      AND t.season_id = ${seasonId}
    GROUP BY p.player_id, p.display_name, t.team_name, t.team_id
    ORDER BY total DESC, per_game DESC NULLS LAST, p.display_name ASC
  `
  return rows.map((r) => ({
    player_id:    String(r.player_id),
    display_name: String(r.display_name),
    team_name:    String(r.team_name),
    team_id:      String(r.team_id),
    appearances:  Number(r.appearances),
    total:        Number(r.total),
    per_game:     r.per_game != null ? Number(r.per_game) : null,
  }))
}

async function getAssists(seasonId: string): Promise<StatRow[]> {
  const rows = await sql`
    SELECT
      p.player_id::text,
      p.display_name,
      t.team_name,
      t.team_id::text,
      COUNT(pms.match_id)::int AS appearances,
      COALESCE(SUM(pms.assists), 0)::int AS total,
      CASE WHEN COUNT(pms.match_id) = 0 THEN NULL
           ELSE ROUND(COALESCE(SUM(pms.assists), 0)::numeric / COUNT(pms.match_id), 1)
      END AS per_game
    FROM players p
    JOIN teams t ON t.team_id = p.team_id
    LEFT JOIN player_match_stats pms ON pms.player_id = p.player_id
    WHERE p.is_active = true
      AND t.season_id = ${seasonId}
    GROUP BY p.player_id, p.display_name, t.team_name, t.team_id
    ORDER BY total DESC, per_game DESC NULLS LAST, p.display_name ASC
  `
  return rows.map((r) => ({
    player_id:    String(r.player_id),
    display_name: String(r.display_name),
    team_name:    String(r.team_name),
    team_id:      String(r.team_id),
    appearances:  Number(r.appearances),
    total:        Number(r.total),
    per_game:     r.per_game != null ? Number(r.per_game) : null,
  }))
}

async function getBlocks(seasonId: string): Promise<StatRow[]> {
  const rows = await sql`
    SELECT
      p.player_id::text,
      p.display_name,
      t.team_name,
      t.team_id::text,
      COUNT(pms.match_id)::int AS appearances,
      COALESCE(SUM(pms.blocks), 0)::int AS total,
      CASE WHEN COUNT(pms.match_id) = 0 THEN NULL
           ELSE ROUND(COALESCE(SUM(pms.blocks), 0)::numeric / COUNT(pms.match_id), 1)
      END AS per_game
    FROM players p
    JOIN teams t ON t.team_id = p.team_id
    LEFT JOIN player_match_stats pms ON pms.player_id = p.player_id
    WHERE p.is_active = true
      AND t.season_id = ${seasonId}
    GROUP BY p.player_id, p.display_name, t.team_name, t.team_id
    ORDER BY total DESC, per_game DESC NULLS LAST, p.display_name ASC
  `
  return rows.map((r) => ({
    player_id:    String(r.player_id),
    display_name: String(r.display_name),
    team_name:    String(r.team_name),
    team_id:      String(r.team_id),
    appearances:  Number(r.appearances),
    total:        Number(r.total),
    per_game:     r.per_game != null ? Number(r.per_game) : null,
  }))
}

async function getAppearances(seasonId: string): Promise<StatRow[]> {
  const rows = await sql`
    SELECT
      p.player_id::text,
      p.display_name,
      t.team_name,
      t.team_id::text,
      COUNT(pms.match_id)::int AS appearances,
      COUNT(pms.match_id)::int AS total,
      NULL::numeric AS per_game
    FROM players p
    JOIN teams t ON t.team_id = p.team_id
    LEFT JOIN player_match_stats pms ON pms.player_id = p.player_id
    WHERE p.is_active = true
      AND t.season_id = ${seasonId}
    GROUP BY p.player_id, p.display_name, t.team_name, t.team_id
    ORDER BY total DESC, p.display_name ASC
  `
  return rows.map((r) => ({
    player_id:    String(r.player_id),
    display_name: String(r.display_name),
    team_name:    String(r.team_name),
    team_id:      String(r.team_id),
    appearances:  Number(r.appearances),
    total:        Number(r.total),
    per_game:     null,
  }))
}

async function getMatchweekHistory(seasonId: string): Promise<MatchweekRow[]> {
  const rows = await sql`
    WITH matchweek_totals AS (
      SELECT
        pms.player_id::text,
        p.display_name,
        t.team_name,
        f.matchweek,
        SUM(pms.goals)::int    AS goals,
        SUM(pms.assists)::int  AS assists,
        SUM(pms.blocks)::int   AS blocks,
        COUNT(pms.match_id)::int AS apps
      FROM player_match_stats pms
      JOIN players  p ON p.player_id = pms.player_id
      JOIN teams    t ON t.team_id   = p.team_id
      JOIN fixtures f ON f.match_id  = pms.match_id
      WHERE t.season_id = ${seasonId}
      GROUP BY pms.player_id, p.display_name, t.team_name, f.matchweek
    )
    SELECT
      player_id,
      display_name,
      team_name,
      matchweek,
      SUM(goals)   OVER (PARTITION BY player_id ORDER BY matchweek)::int AS cum_goals,
      SUM(assists) OVER (PARTITION BY player_id ORDER BY matchweek)::int AS cum_assists,
      SUM(blocks)  OVER (PARTITION BY player_id ORDER BY matchweek)::int AS cum_blocks,
      SUM(apps)    OVER (PARTITION BY player_id ORDER BY matchweek)::int AS cum_apps
    FROM matchweek_totals
    ORDER BY player_id, matchweek
  `
  return rows.map((r) => ({
    player_id:    String(r.player_id),
    display_name: String(r.display_name),
    team_name:    String(r.team_name),
    matchweek:    Number(r.matchweek),
    cum_goals:    Number(r.cum_goals),
    cum_assists:  Number(r.cum_assists),
    cum_blocks:   Number(r.cum_blocks),
    cum_apps:     Number(r.cum_apps),
  }))
}

export default async function StatsPage() {
  const season = await getActiveSeason()

  if (!season) {
    return (
      <div className="min-h-screen bg-gray-950 text-white">
        <PublicNav />
        <div className="max-w-lg mx-auto px-4 pb-16 pt-6">
          <h1 className="text-2xl font-bold mb-1">Stats</h1>
          <p className="text-gray-400 text-sm">No active season.</p>
        </div>
      </div>
    )
  }

  const seasonId = season.season_id as string

  const [goals, assists, blocks, appearances, history] = await Promise.all([
    getGoals(seasonId),
    getAssists(seasonId),
    getBlocks(seasonId),
    getAppearances(seasonId),
    getMatchweekHistory(seasonId),
  ])

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <PublicNav />
      <StatsClient
        seasonName={season.season_name as string}
        goals={goals}
        assists={assists}
        blocks={blocks}
        appearances={appearances}
        history={history}
      />
    </div>
  )
}
