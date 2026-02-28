import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import sql from '@/lib/db'
import { getAdminSession } from '@/lib/auth'
import PublicNav from '../../_components/PublicNav'
import AdminResultForm from '../../_components/AdminResultForm'
import AdminCompletedLayout from '../../_components/AdminCompletedLayout'

export const revalidate = 0

async function getMatch(matchId: string) {
  const rows = await sql`
    SELECT
      f.match_id::text,
      f.matchweek,
      f.kickoff_time,
      f.status,
      f.venue,
      ht.team_id::text AS home_team_id,
      ht.team_name     AS home_team_name,
      at.team_id::text AS away_team_id,
      at.team_name     AS away_team_name,
      mr.score_home,
      mr.score_away,
      mvp.display_name AS mvp_name,
      mvp.player_id::text AS mvp_id
    FROM fixtures f
    JOIN  teams ht ON ht.team_id = f.home_team_id
    JOIN  teams at ON at.team_id = f.away_team_id
    LEFT JOIN match_results mr  ON mr.match_id  = f.match_id
    LEFT JOIN players mvp       ON mvp.player_id = mr.mvp_player_id
    WHERE f.match_id = ${matchId}
    LIMIT 1
  `
  return rows[0] ?? null
}

async function getPlayerStats(matchId: string) {
  const rows = await sql`
    SELECT
      pms.player_id::text,
      p.display_name,
      pms.team_id::text,
      pms.goals,
      pms.assists,
      pms.blocks
    FROM player_match_stats pms
    JOIN players p ON p.player_id = pms.player_id
    WHERE pms.match_id = ${matchId}
    ORDER BY p.display_name
  `
  return rows
}

async function getAbsences(matchId: string) {
  const rows = await sql`
    SELECT
      ma.player_id::text,
      p.display_name,
      ma.team_id::text
    FROM match_absences ma
    JOIN players p ON p.player_id = ma.player_id
    WHERE ma.match_id = ${matchId}
    ORDER BY p.display_name
  `
  return rows
}

async function getSpiritNominations(matchId: string) {
  const rows = await sql`
    SELECT
      sn.nominating_team_id::text,
      nt.team_name          AS nominating_team_name,
      sn.nominated_player_id::text,
      p.display_name        AS nominated_player_name
    FROM spirit_nominations sn
    JOIN teams   nt ON nt.team_id   = sn.nominating_team_id
    JOIN players p  ON p.player_id  = sn.nominated_player_id
    WHERE sn.match_id = ${matchId}
  `
  return rows
}

async function getTeamRoster(teamId: string) {
  const rows = await sql`
    SELECT player_id::text, display_name
    FROM players
    WHERE team_id = ${teamId} AND is_active = true
    ORDER BY display_name
  `
  return rows
}

function fmtKickoffShort(iso: string) {
  const d = new Date(iso)
  const date = d.toLocaleDateString('en-US', {
    timeZone: 'Indian/Maldives',
    weekday: 'short',
    month:   'short',
    day:     'numeric',
    year:    'numeric',
  })
  const time = d.toLocaleTimeString('en-US', {
    timeZone: 'Indian/Maldives',
    hour:   '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  return `${date} · ${time} MVT`
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ matchId: string }>
}): Promise<Metadata> {
  const { matchId } = await params
  const match = await getMatch(matchId)
  if (!match) return { title: 'Match | UFA League' }

  const title = `${match.home_team_name as string} vs ${match.away_team_name as string} | UFA League`
  const description =
    match.score_home != null
      ? `${match.home_team_name as string} ${Number(match.score_home)} – ${Number(match.score_away)} ${match.away_team_name as string} · Matchweek ${Number(match.matchweek)}`
      : `Matchweek ${Number(match.matchweek)} · ${match.home_team_name as string} vs ${match.away_team_name as string}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
    },
  }
}

export default async function MatchPage({
  params,
}: {
  params: Promise<{ matchId: string }>
}) {
  const { matchId } = await params
  const match = await getMatch(matchId)
  if (!match) notFound()

  const isAdmin = await getAdminSession()
  const isPlayed = match.score_home != null

  if (isPlayed) {
    const [stats, absences, nominations, homeRoster, awayRoster] = await Promise.all([
      getPlayerStats(matchId),
      getAbsences(matchId),
      getSpiritNominations(matchId),
      getTeamRoster(match.home_team_id as string),
      getTeamRoster(match.away_team_id as string),
    ])

    const homeStats    = stats.filter((s) => s.team_id === match.home_team_id)
    const awayStats    = stats.filter((s) => s.team_id === match.away_team_id)
    const homeAbsences = absences.filter((a) => a.team_id === match.home_team_id)
    const awayAbsences = absences.filter((a) => a.team_id === match.away_team_id)
    const homeWon      = Number(match.score_home) > Number(match.score_away)
    const awayWon      = Number(match.score_away) > Number(match.score_home)

    const publicContent = (
      <>
        <p className="text-xs text-gray-400 text-center mb-0.5">
          Matchweek {Number(match.matchweek)}
        </p>
        <p className="text-xs text-gray-400 text-center mb-1">
          {fmtKickoffShort(match.kickoff_time as string)}
        </p>
        {match.venue && (
          <p className="text-xs text-gray-400 text-center mb-6">
            <a
              href="https://maps.app.goo.gl/BcCYS36FRZcQmoBB8"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-gray-200 transition-colors"
            >
              {match.venue as string} ↗
            </a>
          </p>
        )}

        {/* Score card */}
        <div className="bg-gray-900 rounded-xl p-6 text-center mb-6">
          <div className="flex items-center justify-between gap-2 mb-3">
            <Link
              href={`/team/${match.home_team_id as string}`}
              className={`text-base font-bold flex-1 text-left leading-tight hover:text-green-400 transition-colors ${homeWon ? 'text-white' : 'text-gray-400'}`}
            >
              {match.home_team_name as string}
            </Link>
            <div className="text-6xl font-bold tabular-nums text-white shrink-0">
              {Number(match.score_home)}&nbsp;–&nbsp;{Number(match.score_away)}
            </div>
            <Link
              href={`/team/${match.away_team_id as string}`}
              className={`text-base font-bold flex-1 text-right leading-tight hover:text-green-400 transition-colors ${awayWon ? 'text-white' : 'text-gray-400'}`}
            >
              {match.away_team_name as string}
            </Link>
          </div>
          {match.mvp_name && (
            <p className="text-sm text-gray-400 mt-2">
              MVP:{' '}
              <Link
                href={`/player/${match.mvp_id as string}`}
                className="text-green-400 hover:text-green-300 font-medium transition-colors"
              >
                {match.mvp_name as string}
              </Link>
            </p>
          )}
        </div>

        {/* Per-player stats */}
        {(homeStats.length > 0 || awayStats.length > 0 || homeAbsences.length > 0 || awayAbsences.length > 0) && (
          <div className="bg-gray-900 rounded-xl overflow-hidden mb-4">
            <div className="grid grid-cols-2 divide-x divide-gray-800">

              {/* Home */}
              <div>
                <p className="text-xs text-gray-400 px-3 py-2 border-b border-gray-800 font-medium truncate">
                  {match.home_team_name as string}
                </p>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-800">
                      <th className="text-left py-1.5 px-3 font-normal">Player</th>
                      <th className="text-right py-1.5 px-1 font-normal">G</th>
                      <th className="text-right py-1.5 px-1 font-normal">A</th>
                      <th className="text-right py-1.5 px-2 font-normal">B</th>
                    </tr>
                  </thead>
                  <tbody>
                    {homeStats.map((s) => (
                      <tr key={s.player_id as string} className="border-b border-gray-800 last:border-0">
                        <td className="py-1.5 px-3">
                          <Link href={`/player/${s.player_id as string}`} className="hover:text-green-400 transition-colors">
                            {s.display_name as string}
                          </Link>
                        </td>
                        <td className="py-1.5 px-1 text-right">{Number(s.goals)}</td>
                        <td className="py-1.5 px-1 text-right">{Number(s.assists)}</td>
                        <td className="py-1.5 px-2 text-right">{Number(s.blocks)}</td>
                      </tr>
                    ))}
                    {homeAbsences.map((a) => (
                      <tr key={a.player_id as string} className="border-b border-gray-800 last:border-0">
                        <td className="py-1.5 px-3 text-gray-500 italic" colSpan={4}>
                          {a.display_name as string}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Away */}
              <div>
                <p className="text-xs text-gray-400 px-3 py-2 border-b border-gray-800 font-medium truncate">
                  {match.away_team_name as string}
                </p>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-800">
                      <th className="text-left py-1.5 px-3 font-normal">Player</th>
                      <th className="text-right py-1.5 px-1 font-normal">G</th>
                      <th className="text-right py-1.5 px-1 font-normal">A</th>
                      <th className="text-right py-1.5 px-2 font-normal">B</th>
                    </tr>
                  </thead>
                  <tbody>
                    {awayStats.map((s) => (
                      <tr key={s.player_id as string} className="border-b border-gray-800 last:border-0">
                        <td className="py-1.5 px-3">
                          <Link href={`/player/${s.player_id as string}`} className="hover:text-green-400 transition-colors">
                            {s.display_name as string}
                          </Link>
                        </td>
                        <td className="py-1.5 px-1 text-right">{Number(s.goals)}</td>
                        <td className="py-1.5 px-1 text-right">{Number(s.assists)}</td>
                        <td className="py-1.5 px-2 text-right">{Number(s.blocks)}</td>
                      </tr>
                    ))}
                    {awayAbsences.map((a) => (
                      <tr key={a.player_id as string} className="border-b border-gray-800 last:border-0">
                        <td className="py-1.5 px-3 text-gray-500 italic" colSpan={4}>
                          {a.display_name as string}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>
          </div>
        )}

        {/* Spirit nominations */}
        {nominations.length > 0 && (
          <div className="bg-gray-900 rounded-xl p-4">
            <h3 className="text-xs text-gray-400 uppercase tracking-widest mb-3">Spirit Nominations</h3>
            <div className="space-y-2">
              {nominations.map((n) => (
                <div key={n.nominating_team_id as string} className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">{n.nominating_team_name as string}</span>
                  <Link
                    href={`/player/${n.nominated_player_id as string}`}
                    className="text-green-400 hover:text-green-300 transition-colors"
                  >
                    {n.nominated_player_name as string}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}
      </>
    )

    return (
      <div className="min-h-screen bg-gray-950 text-white">
        <PublicNav />
        <div className="max-w-lg mx-auto px-4 pb-16 pt-6">
          <AdminCompletedLayout
            isAdmin={isAdmin}
            matchId={matchId}
            homeTeam={{ team_id: match.home_team_id as string, team_name: match.home_team_name as string }}
            awayTeam={{ team_id: match.away_team_id as string, team_name: match.away_team_name as string }}
            homePlayers={homeRoster.map((p) => ({ player_id: p.player_id as string, display_name: p.display_name as string }))}
            awayPlayers={awayRoster.map((p) => ({ player_id: p.player_id as string, display_name: p.display_name as string }))}
          >
            {publicContent}
          </AdminCompletedLayout>
        </div>
      </div>
    )
  }

  // Pre-result layout
  const [homeRoster, awayRoster] = await Promise.all([
    getTeamRoster(match.home_team_id as string),
    getTeamRoster(match.away_team_id as string),
  ])

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <PublicNav />
      <div className="max-w-lg mx-auto px-4 pb-16 pt-6">

        <p className="text-xs text-gray-400 text-center mb-0.5">
          Matchweek {Number(match.matchweek)}
        </p>
        <p className="text-xs text-gray-400 text-center mb-6">
          {fmtKickoffShort(match.kickoff_time as string)}
        </p>

        <div className="bg-gray-900 rounded-xl p-6 text-center mb-6">
          <div className="flex items-center justify-between gap-4">
            <Link
              href={`/team/${match.home_team_id as string}`}
              className="text-xl font-bold flex-1 text-left leading-tight hover:text-green-400 transition-colors"
            >
              {match.home_team_name as string}
            </Link>
            <span className="text-2xl text-gray-500 font-light shrink-0">vs</span>
            <Link
              href={`/team/${match.away_team_id as string}`}
              className="text-xl font-bold flex-1 text-right leading-tight hover:text-green-400 transition-colors"
            >
              {match.away_team_name as string}
            </Link>
          </div>
          {match.venue && (
            <p className="text-xs text-gray-400 mt-3">
              <a
                href="https://maps.app.goo.gl/BcCYS36FRZcQmoBB8"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-gray-200 transition-colors"
              >
                {match.venue as string} ↗
              </a>
            </p>
          )}
        </div>

        {/* Rosters */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-900 rounded-xl p-4">
            <h3 className="text-xs text-gray-400 uppercase tracking-widest mb-3 truncate">
              {match.home_team_name as string}
            </h3>
            <ul className="space-y-1.5">
              {homeRoster.map((p) => (
                <li key={p.player_id as string}>
                  <Link
                    href={`/player/${p.player_id as string}`}
                    className="text-sm text-gray-300 hover:text-white transition-colors"
                  >
                    {p.display_name as string}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-gray-900 rounded-xl p-4">
            <h3 className="text-xs text-gray-400 uppercase tracking-widest mb-3 truncate">
              {match.away_team_name as string}
            </h3>
            <ul className="space-y-1.5">
              {awayRoster.map((p) => (
                <li key={p.player_id as string}>
                  <Link
                    href={`/player/${p.player_id as string}`}
                    className="text-sm text-gray-300 hover:text-white transition-colors"
                  >
                    {p.display_name as string}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Admin result entry form — only visible when logged in */}
        {isAdmin && (
          <div className="mt-8 border-t border-gray-800 pt-8">
            <h2 className="text-base font-semibold text-white mb-5">Enter Result</h2>
            <AdminResultForm
              matchId={matchId}
              homeTeam={{ team_id: match.home_team_id as string, team_name: match.home_team_name as string }}
              awayTeam={{ team_id: match.away_team_id as string, team_name: match.away_team_name as string }}
              homePlayers={homeRoster.map((p) => ({ player_id: p.player_id as string, display_name: p.display_name as string }))}
              awayPlayers={awayRoster.map((p) => ({ player_id: p.player_id as string, display_name: p.display_name as string }))}
            />
          </div>
        )}

      </div>
    </div>
  )
}
