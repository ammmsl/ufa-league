import Link from 'next/link'
import sql from '@/lib/db'
import PublicNav from '../_components/PublicNav'

export const revalidate = 0

async function getAllPlayers() {
  const rows = await sql`
    SELECT
      p.player_id::text,
      p.display_name,
      t.team_id::text,
      t.team_name
    FROM players p
    JOIN teams t ON t.team_id = p.team_id
    JOIN seasons s ON s.season_id = t.season_id
    WHERE p.is_active = true
      AND s.status = 'active'
    ORDER BY t.team_name, p.display_name
  `
  return rows
}

interface PlayerRow {
  player_id:    string
  display_name: string
  team_id:      string
  team_name:    string
}

export default async function PlayersPage() {
  const players = await getAllPlayers()

  // Group by team using a plain typed record
  const teamMap: Record<string, { team_name: string; players: PlayerRow[] }> = {}
  for (const p of players) {
    const tid  = p.team_id  as string
    const name = p.team_name as string
    if (!teamMap[tid]) teamMap[tid] = { team_name: name, players: [] }
    teamMap[tid].players.push({
      player_id:    p.player_id    as string,
      display_name: p.display_name as string,
      team_id:      tid,
      team_name:    name,
    })
  }
  const teams = Object.entries(teamMap)

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <PublicNav />
      <div className="max-w-lg mx-auto px-4 pb-16 pt-6 space-y-6">

        <div className="flex items-baseline justify-between">
          <h1 className="text-xl font-bold">Players</h1>
          <span className="text-xs text-gray-500">{players.length} total</span>
        </div>

        {teams.map(([teamId, { team_name, players: teamPlayers }]) => (
          <div key={teamId}>
            <div className="flex items-baseline justify-between mb-2">
              <Link
                href={`/team/${teamId}`}
                className="text-xs text-gray-400 uppercase tracking-widest hover:text-green-400 transition-colors"
              >
                {team_name}
              </Link>
              <span className="text-xs text-gray-600">{teamPlayers.length}</span>
            </div>
            <div className="bg-gray-900 rounded-xl overflow-hidden divide-y divide-gray-800">
              {teamPlayers.map((p) => (
                <Link
                  key={p.player_id}
                  href={`/player/${p.player_id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-800 transition-colors"
                >
                  <span className="text-sm">{p.display_name}</span>
                  <span className="text-gray-600">›</span>
                </Link>
              ))}
            </div>
          </div>
        ))}

        {players.length === 0 && (
          <p className="text-gray-400 text-sm">No players found.</p>
        )}

      </div>
    </div>
  )
}
