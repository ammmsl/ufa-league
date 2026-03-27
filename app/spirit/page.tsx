import Link from 'next/link'
import sql from '@/lib/db'
import PublicNav from '../_components/PublicNav'

export const revalidate = 0

async function getSpiritLeaderboard(seasonId: string) {
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
    WHERE p.season_id = ${seasonId}::uuid
    GROUP BY p.player_id, p.display_name, t.team_id, t.team_name
    ORDER BY nominations DESC, p.display_name
  `
  return rows
}

export default async function SpiritPage() {
  const seasons = await sql`SELECT season_id::text FROM seasons WHERE status = 'active' LIMIT 1`
  const seasonId = (seasons[0]?.season_id as string) ?? ''
  const leaderboard = seasonId ? await getSpiritLeaderboard(seasonId) : []

  return (
    <div className="page-shell">
      <PublicNav />
      <div className="page-container">
        <h1 className="page-heading">Spirit</h1>
        <p className="page-subheading">Season spirit nominations leaderboard</p>

        {leaderboard.length === 0 ? (
          <div className="empty-state">
            <p>No spirit nominations recorded yet.</p>
          </div>
        ) : (
          <div className="card-list">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="table-th table-th-l text-left w-8">#</th>
                  <th className="table-th table-th-l text-left">Player</th>
                  <th className="table-th table-th-l text-left">Team</th>
                  <th className="table-th table-th-r text-right">Nominations</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((row, i) => (
                  <tr key={row.player_id as string} className="table-row">
                    <td className="table-td table-td-l text-gray-500 text-xs">{i + 1}</td>
                    <td className="table-td table-td-l font-medium">
                      <Link
                        href={`/player/${row.player_id as string}`}
                        className="link-accent"
                      >
                        {row.display_name as string}
                      </Link>
                    </td>
                    <td className="table-td table-td-l text-gray-400">
                      <Link
                        href={`/team/${row.team_id as string}`}
                        className="link-muted"
                      >
                        {row.team_name as string}
                      </Link>
                    </td>
                    <td className="table-td table-td-r text-right font-bold text-green-400">
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
