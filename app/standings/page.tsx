import Link from 'next/link'
import sql from '@/lib/db'
import { getStandings, getHistoricalStandings } from '@/lib/standings'
import PublicNav from '../_components/PublicNav'
import StandingsChart from './StandingsChart'

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

async function getFormGuide(seasonId: string): Promise<Map<string, ('W' | 'D' | 'L')[]>> {
  const rows = await sql`
    SELECT
      team_id::text,
      result,
      kickoff_time
    FROM (
      SELECT
        f.home_team_id AS team_id,
        CASE WHEN mr.score_home > mr.score_away THEN 'W'
             WHEN mr.score_home = mr.score_away THEN 'D'
             ELSE 'L' END AS result,
        f.kickoff_time
      FROM fixtures f
      JOIN match_results mr ON mr.match_id = f.match_id
      WHERE f.season_id = ${seasonId}
      UNION ALL
      SELECT
        f.away_team_id AS team_id,
        CASE WHEN mr.score_away > mr.score_home THEN 'W'
             WHEN mr.score_away = mr.score_home THEN 'D'
             ELSE 'L' END AS result,
        f.kickoff_time
      FROM fixtures f
      JOIN match_results mr ON mr.match_id = f.match_id
      WHERE f.season_id = ${seasonId}
    ) sub
    ORDER BY team_id, kickoff_time DESC
  `

  const map = new Map<string, ('W' | 'D' | 'L')[]>()
  for (const row of rows) {
    const tid = row.team_id as string
    if (!map.has(tid)) map.set(tid, [])
    const arr = map.get(tid)!
    if (arr.length < 5) arr.push(row.result as 'W' | 'D' | 'L')
  }
  for (const [tid, arr] of map) {
    map.set(tid, arr.reverse())
  }
  return map
}

function FormGuide({ form }: { form: ('W' | 'D' | 'L')[] }) {
  const colours = { W: 'bg-green-500', D: 'bg-gray-500', L: 'bg-red-500' }
  return (
    <div className="flex gap-1">
      {form.map((r, i) => (
        <span
          key={i}
          className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${colours[r]}`}
        >
          {r}
        </span>
      ))}
    </div>
  )
}

export default async function StandingsPage() {
  const season = await getActiveSeason()
  const [standings, formGuide, historicalData] = season
    ? await Promise.all([
        getStandings(season.season_id as string),
        getFormGuide(season.season_id as string),
        getHistoricalStandings(season.season_id as string),
      ])
    : [[], new Map<string, ('W' | 'D' | 'L')[]>(), []]

  const teamOrder = standings.map((row) => row.team_id)

  return (
    <div className="page-shell">
      <PublicNav />
      <div className="page-container-wide">
        <h1 className="page-heading">Standings</h1>
        {season && (
          <p className="page-subheading">{season.season_name as string}</p>
        )}

        <div className="space-y-6">
          {/* Standings table */}
          <div className="card-list overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="table-th table-th-l text-left w-6">#</th>
                  <th className="table-th table-th-l text-left">Team</th>
                  <th className="table-th table-th-sm text-right">P</th>
                  <th className="table-th table-th-sm text-right">W</th>
                  <th className="table-th table-th-sm text-right">D</th>
                  <th className="table-th table-th-sm text-right">L</th>
                  <th className="table-th table-th-sm text-right hidden md:table-cell">GS</th>
                  <th className="table-th table-th-sm text-right hidden md:table-cell">GA</th>
                  <th className="table-th table-th-sm text-right hidden md:table-cell">GD</th>
                  <th className="table-th table-th-sm hidden md:table-cell">Form</th>
                  <th className="table-th table-th-r text-right">Pts</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((row, i) => (
                  <tr key={row.team_id} className="table-row">
                    <td className="table-td table-td-l text-gray-500 text-xs">{i + 1}</td>
                    <td className="table-td table-td-l font-medium">
                      <Link href={`/team/${row.team_id}`} className="link-accent">
                        {row.team_name}
                      </Link>
                    </td>
                    <td className="table-td table-td-sm text-right text-gray-400">{row.played}</td>
                    <td className="table-td table-td-sm text-right">{row.won}</td>
                    <td className="table-td table-td-sm text-right text-gray-400">{row.drawn}</td>
                    <td className="table-td table-td-sm text-right">{row.lost}</td>
                    <td className="table-td table-td-sm text-right text-gray-400 hidden md:table-cell">{row.goals_for}</td>
                    <td className="table-td table-td-sm text-right text-gray-400 hidden md:table-cell">{row.goals_against}</td>
                    <td className="table-td table-td-sm text-right hidden md:table-cell">
                      <span
                        className={
                          row.goal_diff > 0
                            ? 'text-green-400'
                            : row.goal_diff < 0
                            ? 'text-red-400'
                            : 'text-gray-400'
                        }
                      >
                        {row.goal_diff > 0 ? `+${row.goal_diff}` : row.goal_diff}
                      </span>
                    </td>
                    <td className="table-td table-td-sm hidden md:table-cell">
                      <FormGuide form={formGuide.get(row.team_id) ?? []} />
                    </td>
                    <td className="table-td table-td-r text-right font-bold text-green-400">{row.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-gray-600 -mt-2">
            Tiebreaker order: Goal difference (GD) → Head-to-head → Goals scored (GS)
          </p>

          {/* Position history chart */}
          <div className="card">
            <h2 className="section-label mb-4">Position History</h2>
            <StandingsChart data={historicalData} teamOrder={teamOrder} />
          </div>
        </div>
      </div>
    </div>
  )
}
