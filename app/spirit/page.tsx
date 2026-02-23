import Link from 'next/link'
import sql from '@/lib/db'
import PublicNav from '../_components/PublicNav'

export const revalidate = 0

async function getSpiritLeaderboard() {
  const rows = await sql`
    SELECT
      p.player_id::text,
      p.display_name,
      t.team_id::text,
      t.team_name,
      COUNT(sn.nomination_id)::int AS nominations
    FROM spirit_nominations sn
    JOIN players p ON p.player_id = sn.nominated_player_id
    JOIN teams   t ON t.team_id   = p.team_id
    GROUP BY p.player_id, p.display_name, t.team_id, t.team_name
    ORDER BY nominations DESC, p.display_name
  `
  return rows
}

export default async function SpiritPage() {
  const leaderboard = await getSpiritLeaderboard()

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <PublicNav />
      <div className="max-w-lg mx-auto px-4 pb-16 pt-6">
        <h1 className="text-2xl font-bold mb-1">Spirit</h1>
        <p className="text-gray-400 text-sm mb-6">Season spirit nominations leaderboard</p>

        {leaderboard.length === 0 ? (
          <div className="bg-gray-900 rounded-xl p-8 text-center">
            <p className="text-gray-400">No spirit nominations recorded yet.</p>
          </div>
        ) : (
          <div className="bg-gray-900 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs border-b border-gray-800">
                  <th className="text-left py-3 px-4 font-normal w-8">#</th>
                  <th className="text-left py-3 px-4 font-normal">Player</th>
                  <th className="text-left py-3 px-4 font-normal">Team</th>
                  <th className="text-right py-3 px-4 font-normal">Nominations</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((row, i) => (
                  <tr key={row.player_id as string} className="border-b border-gray-800 last:border-0">
                    <td className="py-3 px-4 text-gray-500 text-xs">{i + 1}</td>
                    <td className="py-3 px-4 font-medium">
                      <Link
                        href={`/player/${row.player_id as string}`}
                        className="hover:text-green-400 transition-colors"
                      >
                        {row.display_name as string}
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-gray-400">
                      <Link
                        href={`/team/${row.team_id as string}`}
                        className="hover:text-white transition-colors"
                      >
                        {row.team_name as string}
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-green-400">
                      {Number(row.nominations)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
