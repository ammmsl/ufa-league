import Link from 'next/link'
import sql from '@/lib/db'
import { getStandings } from '@/lib/standings'
import PublicNav from './_components/PublicNav'

export const revalidate = 0

async function getActiveSeason() {
  const rows = await sql`
    SELECT season_id::text, season_name, status
    FROM seasons
    WHERE status = 'active'
    LIMIT 1
  `
  return rows[0] ?? null
}

async function getNextFixture(seasonId: string) {
  const rows = await sql`
    SELECT
      f.match_id::text,
      f.kickoff_time,
      f.matchweek,
      ht.team_name AS home_team_name,
      at.team_name AS away_team_name
    FROM fixtures f
    JOIN teams ht ON ht.team_id = f.home_team_id
    JOIN teams at ON at.team_id = f.away_team_id
    WHERE f.season_id = ${seasonId}
      AND f.status = 'scheduled'
      AND f.kickoff_time > NOW()
    ORDER BY f.kickoff_time ASC
    LIMIT 1
  `
  return rows[0] ?? null
}

async function getLastResult(seasonId: string) {
  const rows = await sql`
    SELECT
      f.match_id::text,
      f.kickoff_time,
      f.matchweek,
      ht.team_name AS home_team_name,
      at.team_name AS away_team_name,
      mr.score_home,
      mr.score_away
    FROM fixtures f
    JOIN teams ht ON ht.team_id = f.home_team_id
    JOIN teams at ON at.team_id = f.away_team_id
    JOIN match_results mr ON mr.match_id = f.match_id
    WHERE f.season_id = ${seasonId}
    ORDER BY f.kickoff_time DESC
    LIMIT 1
  `
  return rows[0] ?? null
}

function fmtKickoff(iso: string) {
  const d = new Date(iso)
  const date = d.toLocaleDateString('en-US', {
    timeZone: 'Indian/Maldives',
    weekday: 'short',
    month:   'short',
    day:     'numeric',
  })
  const time = d.toLocaleTimeString('en-US', {
    timeZone: 'Indian/Maldives',
    hour:   '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  return `${date} · ${time} MVT`
}

export default async function HomePage() {
  const season = await getActiveSeason()

  if (!season) {
    return (
      <div className="min-h-screen bg-gray-950 text-white">
        <PublicNav />
        <div className="max-w-lg mx-auto px-4 pt-16 text-center text-gray-400">
          No active season.
        </div>
      </div>
    )
  }

  const [standings, nextFixture, lastResult] = await Promise.all([
    getStandings(season.season_id as string),
    getNextFixture(season.season_id as string),
    getLastResult(season.season_id as string),
  ])

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <PublicNav />
      <div className="max-w-lg mx-auto px-4 pb-16 pt-6 space-y-6">

        {/* Season banner */}
        <div className="bg-gray-900 rounded-xl p-4">
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Season</p>
          <h1 className="text-xl font-bold">{season.season_name as string}</h1>
          <span className="inline-block mt-1 text-xs bg-green-900/60 text-green-400 px-2 py-0.5 rounded-full capitalize">
            {season.status as string}
          </span>
        </div>

        {/* Next match */}
        {nextFixture && (
          <div>
            <h2 className="text-xs text-gray-400 uppercase tracking-widest mb-2">Next Match</h2>
            <Link
              href={`/match/${nextFixture.match_id as string}`}
              className="block bg-gray-900 rounded-xl p-4 hover:bg-gray-800 transition-colors"
            >
              <p className="text-xs text-gray-400 mb-2">
                Matchweek {Number(nextFixture.matchweek)} · {fmtKickoff(nextFixture.kickoff_time as string)}
              </p>
              <div className="flex items-center gap-3">
                <span className="text-white font-semibold text-sm flex-1">
                  {nextFixture.home_team_name as string}
                </span>
                <span className="text-gray-500 text-xs">vs</span>
                <span className="text-white font-semibold text-sm flex-1 text-right">
                  {nextFixture.away_team_name as string}
                </span>
              </div>
            </Link>
          </div>
        )}

        {/* Mini standings */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs text-gray-400 uppercase tracking-widest">Standings</h2>
            <Link href="/standings" className="text-xs text-green-400 hover:text-green-300 transition-colors">
              View all →
            </Link>
          </div>
          <div className="bg-gray-900 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs border-b border-gray-800">
                  <th className="text-left py-2 px-4 w-6 font-normal">#</th>
                  <th className="text-left py-2 px-4 font-normal">Team</th>
                  <th className="text-right py-2 px-4 font-normal w-10">Pts</th>
                  <th className="text-right py-2 px-4 font-normal w-10">GD</th>
                </tr>
              </thead>
              <tbody>
                {standings.slice(0, 5).map((row, i) => (
                  <tr key={row.team_id} className="border-b border-gray-800 last:border-0">
                    <td className="py-2 px-4 text-gray-500 text-xs">{i + 1}</td>
                    <td className="py-2 px-4 font-medium">
                      <Link href={`/team/${row.team_id}`} className="hover:text-green-400 transition-colors">
                        {row.team_name}
                      </Link>
                    </td>
                    <td className="py-2 px-4 text-right font-bold text-green-400">{row.points}</td>
                    <td className="py-2 px-4 text-right text-gray-400">
                      {row.goal_diff > 0 ? `+${row.goal_diff}` : row.goal_diff}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Last result */}
        {lastResult && (
          <div>
            <h2 className="text-xs text-gray-400 uppercase tracking-widest mb-2">Last Result</h2>
            <Link
              href={`/match/${lastResult.match_id as string}`}
              className="block bg-gray-900 rounded-xl p-4 hover:bg-gray-800 transition-colors"
            >
              <p className="text-xs text-gray-400 mb-2">
                Matchweek {Number(lastResult.matchweek)} · {fmtKickoff(lastResult.kickoff_time as string)}
              </p>
              <div className="flex items-center gap-3">
                <span className="text-white font-semibold text-sm flex-1">
                  {lastResult.home_team_name as string}
                </span>
                <span className="text-white font-bold text-lg tabular-nums">
                  {Number(lastResult.score_home)} – {Number(lastResult.score_away)}
                </span>
                <span className="text-white font-semibold text-sm flex-1 text-right">
                  {lastResult.away_team_name as string}
                </span>
              </div>
            </Link>
          </div>
        )}

      </div>
    </div>
  )
}
