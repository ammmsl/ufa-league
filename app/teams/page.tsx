import Link from 'next/link'
import sql from '@/lib/db'
import PublicNav from '../_components/PublicNav'

export const revalidate = 0

async function getActiveSeason() {
  const rows = await sql`
    SELECT season_id::text
    FROM seasons
    WHERE status = 'active'
    LIMIT 1
  `
  return rows[0] ?? null
}

async function getTeamsWithStats(seasonId: string) {
  const rows = await sql`
    WITH results AS (
      SELECT
        f.home_team_id AS team_id,
        CASE WHEN mr.score_home > mr.score_away THEN 3
             WHEN mr.score_home = mr.score_away THEN 1
             ELSE 0 END AS pts,
        CASE WHEN mr.score_home > mr.score_away THEN 1 ELSE 0 END AS won,
        CASE WHEN mr.score_home = mr.score_away THEN 1 ELSE 0 END AS drawn,
        CASE WHEN mr.score_home < mr.score_away THEN 1 ELSE 0 END AS lost
      FROM fixtures f
      JOIN match_results mr ON mr.match_id = f.match_id
      WHERE f.season_id = ${seasonId}
      UNION ALL
      SELECT
        f.away_team_id AS team_id,
        CASE WHEN mr.score_away > mr.score_home THEN 3
             WHEN mr.score_away = mr.score_home THEN 1
             ELSE 0 END AS pts,
        CASE WHEN mr.score_away > mr.score_home THEN 1 ELSE 0 END AS won,
        CASE WHEN mr.score_away = mr.score_home THEN 1 ELSE 0 END AS drawn,
        CASE WHEN mr.score_away < mr.score_home THEN 1 ELSE 0 END AS lost
      FROM fixtures f
      JOIN match_results mr ON mr.match_id = f.match_id
      WHERE f.season_id = ${seasonId}
    )
    SELECT
      t.team_id::text,
      t.team_name,
      COUNT(DISTINCT p.player_id)::int AS player_count,
      COALESCE(SUM(r.pts),   0)::int   AS points,
      COALESCE(SUM(r.won),   0)::int   AS won,
      COALESCE(SUM(r.drawn), 0)::int   AS drawn,
      COALESCE(SUM(r.lost),  0)::int   AS lost
    FROM teams t
    LEFT JOIN players p ON p.team_id = t.team_id AND p.season_id = ${seasonId} AND p.is_active = true
    LEFT JOIN results  r ON r.team_id = t.team_id
    WHERE t.season_id = ${seasonId}
    GROUP BY t.team_id, t.team_name
    ORDER BY t.team_name
  `
  return rows
}

export default async function TeamsPage() {
  const season = await getActiveSeason()
  if (!season) {
    return (
      <div className="min-h-screen bg-gray-950 text-white">
        <PublicNav />
        <div className="max-w-lg mx-auto px-4 pt-6 text-gray-400">No active season.</div>
      </div>
    )
  }

  const teams = await getTeamsWithStats(season.season_id as string)

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <PublicNav />
      <div className="max-w-lg mx-auto px-4 pb-16 pt-6">
        <h1 className="text-2xl font-bold mb-6">Teams</h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {teams.map((t) => {
            const won   = Number(t.won)
            const drawn = Number(t.drawn)
            const lost  = Number(t.lost)
            const pts   = Number(t.points)
            const played = won + drawn + lost
            return (
              <Link
                key={t.team_id as string}
                href={`/team/${t.team_id as string}`}
                className="block bg-gray-900 rounded-xl p-5 hover:bg-gray-800 transition-colors"
              >
                <h2 className="text-lg font-bold mb-1">{t.team_name as string}</h2>
                <p className="text-sm text-gray-400">
                  {Number(t.player_count)} players
                  {played > 0 && (
                    <> · <span className="text-green-400 font-medium">{pts} pts</span> ({won}W {drawn}D {lost}L)</>
                  )}
                </p>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
