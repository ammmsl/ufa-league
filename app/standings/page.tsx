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

export default async function StandingsPage() {
  const season = await getActiveSeason()
  const standings = season ? await getStandings(season.season_id as string) : []

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
