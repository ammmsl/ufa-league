import Link from 'next/link'
import sql from '@/lib/db'
import PublicNav from '../_components/PublicNav'

export const revalidate = 0

async function getMvpScores() {
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
  `
  return rows
}

export default async function MvpPage() {
  const rows = await getMvpScores()

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <PublicNav />
      <div className="max-w-lg mx-auto px-4 pb-16 pt-6">
        <h1 className="text-2xl font-bold mb-1">Season MVP</h1>
        <p className="text-gray-500 text-xs mb-6">
          Score = (Goals × 3) + (Assists × 3) + (Blocks × 2) + (MVP wins × 5)
        </p>

        <div className="bg-gray-900 rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="text-gray-500 text-xs border-b border-gray-800">
                <th className="text-left py-3 px-4 font-normal w-8">#</th>
                <th className="text-left py-3 px-2 font-normal">Player</th>
                <th className="text-left py-3 px-2 font-normal">Team</th>
                <th className="text-right py-3 px-2 font-normal text-green-400">Score</th>
                <th className="text-right py-3 px-2 font-normal">G</th>
                <th className="text-right py-3 px-2 font-normal">A</th>
                <th className="text-right py-3 px-2 font-normal">B</th>
                <th className="text-right py-3 px-4 font-normal">MVP</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.player_id as string} className="border-b border-gray-800 last:border-0">
                  <td className="py-3 px-4 text-gray-500 text-xs">{i + 1}</td>
                  <td className="py-3 px-2 font-medium">
                    <Link
                      href={`/player/${row.player_id as string}`}
                      className="hover:text-green-400 transition-colors"
                    >
                      {row.display_name as string}
                    </Link>
                  </td>
                  <td className="py-3 px-2 text-gray-400">
                    <Link
                      href={`/team/${row.team_id as string}`}
                      className="hover:text-white transition-colors"
                    >
                      {row.team_name as string}
                    </Link>
                  </td>
                  <td className="py-3 px-2 text-right font-bold text-green-400">
                    {Number(row.composite_score)}
                  </td>
                  <td className="py-3 px-2 text-right text-gray-400">{Number(row.total_goals)}</td>
                  <td className="py-3 px-2 text-right text-gray-400">{Number(row.total_assists)}</td>
                  <td className="py-3 px-2 text-right text-gray-400">{Number(row.total_blocks)}</td>
                  <td className="py-3 px-4 text-right text-gray-400">{Number(row.match_mvp_wins)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
