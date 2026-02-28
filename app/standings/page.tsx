import Link from 'next/link'
import sql from '@/lib/db'
import { getStandings } from '@/lib/standings'
import PublicNav from '../_components/PublicNav'

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
  // Reverse each team's array so oldest is leftmost
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
  const [standings, formGuide] = season
    ? await Promise.all([
        getStandings(season.season_id as string),
        getFormGuide(season.season_id as string),
      ])
    : [[], new Map<string, ('W' | 'D' | 'L')[]>()]

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <PublicNav />
      <div className="max-w-lg mx-auto px-4 pb-16 pt-6">
        <h1 className="text-2xl font-bold mb-1">Standings</h1>
        {season && (
          <p className="text-gray-400 text-sm mb-6">{season.season_name as string}</p>
        )}

        <div className="bg-gray-900 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs border-b border-gray-800">
                <th className="text-left py-3 px-4 font-normal w-6">#</th>
                <th className="text-left py-3 px-4 font-normal">Team</th>
                <th className="text-right py-3 px-2 font-normal">P</th>
                <th className="text-right py-3 px-2 font-normal">W</th>
                <th className="text-right py-3 px-2 font-normal">D</th>
                <th className="text-right py-3 px-2 font-normal">L</th>
                <th className="text-right py-3 px-2 font-normal hidden sm:table-cell">GF</th>
                <th className="text-right py-3 px-2 font-normal hidden sm:table-cell">GA</th>
                <th className="text-right py-3 px-2 font-normal hidden sm:table-cell">GD</th>
                <th className="py-3 px-2 font-normal hidden sm:table-cell">Form</th>
                <th className="text-right py-3 px-4 font-normal">Pts</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((row, i) => (
                <tr key={row.team_id} className="border-b border-gray-800 last:border-0">
                  <td className="py-3 px-4 text-gray-500 text-xs">{i + 1}</td>
                  <td className="py-3 px-4 font-medium">
                    <Link href={`/team/${row.team_id}`} className="hover:text-green-400 transition-colors">
                      {row.team_name}
                    </Link>
                  </td>
                  <td className="py-3 px-2 text-right text-gray-400">{row.played}</td>
                  <td className="py-3 px-2 text-right">{row.won}</td>
                  <td className="py-3 px-2 text-right text-gray-400">{row.drawn}</td>
                  <td className="py-3 px-2 text-right">{row.lost}</td>
                  <td className="py-3 px-2 text-right text-gray-400 hidden sm:table-cell">{row.goals_for}</td>
                  <td className="py-3 px-2 text-right text-gray-400 hidden sm:table-cell">{row.goals_against}</td>
                  <td className="py-3 px-2 text-right hidden sm:table-cell">
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
                  <td className="py-3 px-2 hidden sm:table-cell">
                    <FormGuide form={formGuide.get(row.team_id) ?? []} />
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-green-400">{row.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-gray-600 mt-4">
          Tiebreaker order: Goal difference → Head-to-head → Goals scored
        </p>
      </div>
    </div>
  )
}
