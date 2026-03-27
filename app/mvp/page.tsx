import sql from '@/lib/db'
import PublicNav from '../_components/PublicNav'
import MvpClient from './MvpClient'

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

export type MvpRow = {
  player_id:       string
  display_name:    string
  team_id:         string
  team_name:       string
  total_goals:     number
  total_assists:   number
  total_blocks:    number
  match_mvp_wins:  number
  composite_score: number
}

export type MvpHistoryRow = {
  player_id:     string
  display_name:  string
  team_name:     string
  matchweek:     number
  cum_composite: number
}

export type MvpClientProps = {
  seasonName: string
  rows:       MvpRow[]
  history:    MvpHistoryRow[]
}

async function getMvpScores(seasonId: string): Promise<MvpRow[]> {
  const rows = await sql`
    SELECT
      player_id::text,
      display_name,
      team_id::text,
      team_name,
      total_goals::int,
      total_assists::int,
      total_blocks::int,
      match_mvp_wins::int,
      composite_score::int
    FROM season_mvp_scores
    WHERE season_id = ${seasonId}::uuid
  `
  return rows.map((r) => ({
    player_id:       String(r.player_id),
    display_name:    String(r.display_name),
    team_id:         String(r.team_id),
    team_name:       String(r.team_name),
    total_goals:     Number(r.total_goals),
    total_assists:   Number(r.total_assists),
    total_blocks:    Number(r.total_blocks),
    match_mvp_wins:  Number(r.match_mvp_wins),
    composite_score: Number(r.composite_score),
  }))
}

async function getMvpHistory(seasonId: string): Promise<MvpHistoryRow[]> {
  const rows = await sql`
    WITH matchweek_totals AS (
      SELECT
        pms.player_id::text,
        p.display_name,
        t.team_name,
        f.matchweek,
        SUM(pms.goals)::int   AS goals,
        SUM(pms.assists)::int AS assists,
        SUM(pms.blocks)::int  AS blocks,
        COUNT(mr.match_result_id)::int AS mvp_wins
      FROM player_match_stats pms
      JOIN players  p  ON p.player_id  = pms.player_id
      JOIN teams    t  ON t.team_id    = p.team_id
      JOIN fixtures f  ON f.match_id   = pms.match_id
      LEFT JOIN match_results mr
             ON mr.match_id        = pms.match_id
            AND mr.mvp_player_id   = pms.player_id
      WHERE t.season_id = ${seasonId}
      GROUP BY pms.player_id, p.display_name, t.team_name, f.matchweek
    )
    SELECT
      player_id,
      display_name,
      team_name,
      matchweek,
      SUM(goals * 3 + assists * 3 + blocks * 2 + mvp_wins * 5)
        OVER (PARTITION BY player_id ORDER BY matchweek)::int AS cum_composite
    FROM matchweek_totals
    ORDER BY player_id, matchweek
  `
  return rows.map((r) => ({
    player_id:     String(r.player_id),
    display_name:  String(r.display_name),
    team_name:     String(r.team_name),
    matchweek:     Number(r.matchweek),
    cum_composite: Number(r.cum_composite),
  }))
}

export default async function MvpPage() {
  const season = await getActiveSeason()

  if (!season) {
    return (
      <div className="min-h-screen bg-gray-950 text-white">
        <PublicNav />
        <div className="max-w-lg mx-auto px-4 pb-16 pt-6">
          <h1 className="text-2xl font-bold mb-1">MVP Race</h1>
          <p className="text-gray-400 text-sm">No active season.</p>
        </div>
      </div>
    )
  }

  const seasonId = season.season_id as string

  const [rows, history] = await Promise.all([
    getMvpScores(seasonId),
    getMvpHistory(seasonId),
  ])

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <PublicNav />
      <MvpClient
        seasonName={season.season_name as string}
        rows={rows}
        history={history}
      />
    </div>
  )
}
