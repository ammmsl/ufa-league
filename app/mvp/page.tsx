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
    <div className="page-shell">
      <PublicNav />
      <div className="page-container">
        <h1 className="page-heading">Season MVP</h1>
        <p className="page-subheading">
          Score = (Goals × 3) + (Assists × 3) + (Blocks × 2) + (MVP wins × 5)
        </p>

        <div className="card-list overflow-x-auto">
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="table-th table-th-l text-left w-8">#</th>
                <th className="table-th table-th-sm text-left">Player</th>
                <th className="table-th table-th-sm text-left">Team</th>
                <th className="table-th table-th-sm text-right text-green-400">Score</th>
                <th className="table-th table-th-sm text-right">G</th>
                <th className="table-th table-th-sm text-right">A</th>
                <th className="table-th table-th-sm text-right">B</th>
                <th className="table-th table-th-r text-right">MVP</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.player_id as string} className="table-row">
                  <td className="table-td table-td-l text-gray-500 text-xs">{i + 1}</td>
                  <td className="table-td table-td-sm font-medium">
                    <Link
                      href={`/player/${row.player_id as string}`}
                      className="link-accent"
                    >
                      {row.display_name as string}
                    </Link>
                  </td>
                  <td className="table-td table-td-sm text-gray-400">
                    <Link
                      href={`/team/${row.team_id as string}`}
                      className="link-muted"
                    >
                      {row.team_name as string}
                    </Link>
                  </td>
                  <td className="table-td table-td-sm text-right font-bold text-green-400">
                    {Number(row.composite_score)}
                  </td>
                  <td className="table-td table-td-sm text-right text-gray-400">{Number(row.total_goals)}</td>
                  <td className="table-td table-td-sm text-right text-gray-400">{Number(row.total_assists)}</td>
                  <td className="table-td table-td-sm text-right text-gray-400">{Number(row.total_blocks)}</td>
                  <td className="table-td table-td-r text-right text-gray-400">{Number(row.match_mvp_wins)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
