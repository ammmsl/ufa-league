import sql from '@/lib/db'
import Link from 'next/link'

export default async function AdminDashboard() {
  const seasons = await sql`SELECT * FROM seasons ORDER BY created_at DESC LIMIT 1`
  const season = seasons[0] ?? null

  let teamCount = 0
  let playerCount = 0
  let fixtureCount = 0

  if (season) {
    const [tc, pc, fc] = await Promise.all([
      sql`SELECT COUNT(*) AS n FROM teams WHERE season_id = ${season.season_id}`,
      sql`SELECT COUNT(*) AS n FROM players WHERE season_id = ${season.season_id} AND is_active = true`,
      sql`SELECT COUNT(*) AS n FROM fixtures WHERE season_id = ${season.season_id}`,
    ])
    teamCount = Number(tc[0].n)
    playerCount = Number(pc[0].n)
    fixtureCount = Number(fc[0].n)
  }

  const statusColor =
    season?.status === 'active'
      ? 'text-green-400'
      : season?.status === 'complete'
        ? 'text-blue-400'
        : 'text-yellow-400'

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <h1 className="text-2xl font-bold mb-6">UFA League Admin</h1>

      {season ? (
        <div className="bg-gray-900 rounded-lg p-5 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">{season.season_name}</h2>
            <span className={`text-sm font-medium ${statusColor}`}>{season.status}</span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">{teamCount}</p>
              <p className="text-xs text-gray-400 mt-0.5">Teams</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{playerCount}</p>
              <p className="text-xs text-gray-400 mt-0.5">Players</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{fixtureCount}</p>
              <p className="text-xs text-gray-400 mt-0.5">Fixtures</p>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-gray-500 mb-8">No season found in database.</p>
      )}

      <div className="grid gap-3">
        <Link
          href="/admin/setup"
          className="block p-4 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
        >
          <p className="font-semibold">Setup Wizard</p>
          <p className="text-sm text-gray-400 mt-0.5">Configure season, rename teams, create fixtures, go live</p>
        </Link>
        <Link
          href="/admin/results"
          className="block p-4 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
        >
          <p className="font-semibold">Result Entry</p>
          <p className="text-sm text-gray-400 mt-0.5">Record match scores, player stats, MVP, and spirit nominations</p>
        </Link>
      </div>
    </div>
  )
}
