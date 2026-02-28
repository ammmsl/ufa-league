import Link from 'next/link'
import sql from '@/lib/db'
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

type StatRow = {
  player_id: string
  display_name: string
  team_name: string
  team_id: string
  appearances: number
  total: number
  per_game: number | null
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

function StatTable({
  rows,
  label,
  showPerGame,
}: {
  rows: StatRow[]
  label: string
  showPerGame: boolean
}) {
  return (
    <div className="bg-gray-900 rounded-xl overflow-x-auto">
      <div className="px-4 py-3 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-white uppercase tracking-widest">{label}</h2>
      </div>
      <table className="w-full text-sm min-w-[480px]">
        <thead>
          <tr className="text-gray-500 text-xs border-b border-gray-800">
            <th className="text-left py-2 px-4 font-normal w-8">#</th>
            <th className="text-left py-2 px-2 font-normal">Player</th>
            <th className="text-left py-2 px-2 font-normal">Team</th>
            <th className="text-right py-2 px-2 font-normal">Total</th>
            <th className="text-right py-2 px-2 font-normal">Apps</th>
            {showPerGame && (
              <th className="text-right py-2 px-4 font-normal">Per Game</th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.player_id} className="border-b border-gray-800 last:border-0">
              <td className="py-2 px-4 text-gray-500 text-xs">{i + 1}</td>
              <td className="py-2 px-2">
                <Link
                  href={`/player/${row.player_id}`}
                  className="hover:text-green-400 transition-colors font-medium"
                >
                  {row.display_name}
                </Link>
              </td>
              <td className="py-2 px-2 text-gray-400">
                <Link href={`/team/${row.team_id}`} className="hover:text-white transition-colors">
                  {row.team_name}
                </Link>
              </td>
              <td className="py-2 px-2 text-right">{row.total}</td>
              <td className="py-2 px-2 text-right text-gray-400">{row.appearances}</td>
              {showPerGame && (
                <td className="py-2 px-4 text-right text-gray-400">
                  {row.per_game != null ? row.per_game.toFixed(1) : '—'}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
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

  const [goals, assists, blocks, appearances] = await Promise.all([
    getGoals(season.season_id as string),
    getAssists(season.season_id as string),
    getBlocks(season.season_id as string),
    getAppearances(season.season_id as string),
  ])

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <PublicNav />
      <div className="max-w-lg mx-auto px-4 pb-16 pt-6 space-y-8">
        <div>
          <h1 className="text-2xl font-bold mb-1">Stats</h1>
          <p className="text-gray-400 text-sm">{season.season_name as string}</p>
        </div>

        <StatTable rows={goals}       label="Goals"       showPerGame={true} />
        <StatTable rows={assists}     label="Assists"     showPerGame={true} />
        <StatTable rows={blocks}      label="Blocks"      showPerGame={true} />
        <StatTable rows={appearances} label="Appearances" showPerGame={false} />
      </div>
    </div>
  )
}
