import Link from 'next/link'
import sql from '@/lib/db'
import { getStandings } from '@/lib/standings'
import PublicNav from './_components/PublicNav'
import { TeamAvatar } from './_components/Avatar'

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

async function getNextFixtures(seasonId: string) {
  const rows = await sql`
    SELECT
      f.match_id::text,
      f.kickoff_time,
      f.matchweek,
      ht.team_id::text AS home_team_id,
      ht.team_name AS home_team_name,
      at.team_id::text AS away_team_id,
      at.team_name AS away_team_name
    FROM fixtures f
    JOIN teams ht ON ht.team_id = f.home_team_id
    JOIN teams at ON at.team_id = f.away_team_id
    WHERE f.season_id = ${seasonId}
      AND f.status = 'scheduled'
      AND f.kickoff_time > NOW()
    ORDER BY f.kickoff_time ASC
    LIMIT 3
  `
  return rows
}

async function getLastResult(seasonId: string) {
  const rows = await sql`
    SELECT
      f.match_id::text,
      f.kickoff_time,
      f.matchweek,
      ht.team_id::text AS home_team_id,
      ht.team_name AS home_team_name,
      at.team_id::text AS away_team_id,
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
      <div className="page-shell">
        <PublicNav />
        <div className="page-container pt-16 text-center text-gray-400">
          No active season.
        </div>
      </div>
    )
  }

  const [standings, nextFixtures, lastResult] = await Promise.all([
    getStandings(season.season_id as string),
    getNextFixtures(season.season_id as string),
    getLastResult(season.season_id as string),
  ])

  return (
    <div className="page-shell">
      <PublicNav />
      <div className="page-container space-y-6">

        {/* Season banner */}
        <div className="card">
          <p className="section-label">Season</p>
          <h1 className="text-xl font-bold">{season.season_name as string}</h1>
          <span className="badge badge-green mt-1 capitalize">
            {season.status as string}
          </span>
        </div>

        {/* Upcoming matches */}
        {nextFixtures.length > 0 && (
          <div>
            <h2 className="section-label">
              {nextFixtures.length === 1 ? 'Next Match' : 'Upcoming'}
            </h2>
            <div className="card-list divide-y divide-gray-800">
              {nextFixtures.map((f) => (
                <Link
                  key={f.match_id as string}
                  href={`/match/${f.match_id as string}`}
                  className="block p-4 hover:bg-gray-800 transition-colors"
                >
                  <p className="text-xs text-gray-400 mb-2">
                    Matchweek {Number(f.matchweek)} · {fmtKickoff(f.kickoff_time as string)}
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 flex-1">
                      <TeamAvatar id={f.home_team_id as string} name={f.home_team_name as string} size={24} />
                      <span className="text-white font-semibold text-sm">{f.home_team_name as string}</span>
                    </div>
                    <span className="text-gray-500 text-xs shrink-0">vs</span>
                    <div className="flex items-center justify-end gap-2 flex-1">
                      <span className="text-white font-semibold text-sm">{f.away_team_name as string}</span>
                      <TeamAvatar id={f.away_team_id as string} name={f.away_team_name as string} size={24} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Mini standings */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="section-label mb-0">Standings</h2>
            <Link href="/standings" className="text-xs link-accent">
              View all →
            </Link>
          </div>
          <div className="card-list">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="table-th table-th-l text-left w-6">#</th>
                  <th className="table-th table-th-l text-left">Team</th>
                  <th className="table-th table-th-r text-right w-10">Pts</th>
                  <th className="table-th table-th-r text-right w-10">GD</th>
                </tr>
              </thead>
              <tbody>
                {standings.slice(0, 5).map((row, i) => (
                  <tr key={row.team_id} className="table-row">
                    <td className="table-td table-td-l text-gray-500 text-xs">{i + 1}</td>
                    <td className="table-td table-td-l font-medium">
                      <div className="flex items-center gap-2">
                        <TeamAvatar id={row.team_id} name={row.team_name} size={20} />
                        <Link href={`/team/${row.team_id}`} className="link-accent">
                          {row.team_name}
                        </Link>
                      </div>
                    </td>
                    <td className="table-td table-td-r text-right font-bold text-green-400">{row.points}</td>
                    <td className="table-td table-td-r text-right text-gray-400">
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
            <h2 className="section-label">Last Result</h2>
            <Link
              href={`/match/${lastResult.match_id as string}`}
              className="card-link"
            >
              <p className="text-xs text-gray-400 mb-2">
                Matchweek {Number(lastResult.matchweek)} · {fmtKickoff(lastResult.kickoff_time as string)}
              </p>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 flex-1">
                  <TeamAvatar id={lastResult.home_team_id as string} name={lastResult.home_team_name as string} size={24} />
                  <span className="text-white font-semibold text-sm">{lastResult.home_team_name as string}</span>
                </div>
                <span className="text-white font-bold text-lg tabular-nums shrink-0">
                  {Number(lastResult.score_home)} – {Number(lastResult.score_away)}
                </span>
                <div className="flex items-center justify-end gap-2 flex-1">
                  <span className="text-white font-semibold text-sm">{lastResult.away_team_name as string}</span>
                  <TeamAvatar id={lastResult.away_team_id as string} name={lastResult.away_team_name as string} size={24} />
                </div>
              </div>
            </Link>
          </div>
        )}

      </div>
    </div>
  )
}
