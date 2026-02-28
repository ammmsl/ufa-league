import Link from 'next/link'
import { notFound } from 'next/navigation'
import sql from '@/lib/db'
import { getStandings } from '@/lib/standings'
import PublicNav from '../../_components/PublicNav'

export const revalidate = 0

async function getPlayer(playerId: string) {
  const rows = await sql`
    SELECT
      p.player_id::text,
      p.display_name,
      p.team_id::text,
      t.team_name,
      t.season_id::text
    FROM players p
    JOIN teams t ON t.team_id = p.team_id
    WHERE p.player_id = ${playerId}
    LIMIT 1
  `
  return rows[0] ?? null
}

async function getSpiritNominationsReceived(playerId: string) {
  const rows = await sql`
    SELECT COUNT(*)::int AS total
    FROM spirit_nominations
    WHERE nominated_player_id = ${playerId}
  `
  return rows[0] ? Number(rows[0].total) : 0
}

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

async function getSeasonTotals(playerId: string) {
  const rows = await sql`
    SELECT
      COUNT(*)::int          AS appearances,
      COALESCE(SUM(goals),   0)::int AS total_goals,
      COALESCE(SUM(assists), 0)::int AS total_assists,
      COALESCE(SUM(blocks),  0)::int AS total_blocks
    FROM player_match_stats
    WHERE player_id = ${playerId}
  `
  return rows[0] ?? null
}

async function getMatchLog(playerId: string, teamId: string) {
  const rows = await sql`
    SELECT
      f.match_id::text,
      f.kickoff_time,
      ht.team_id::text AS home_team_id,
      ht.team_name     AS home_team_name,
      at.team_id::text AS away_team_id,
      at.team_name     AS away_team_name,
      mr.score_home,
      mr.score_away,
      pms.goals,
      pms.assists,
      pms.blocks
    FROM player_match_stats pms
    JOIN fixtures f     ON f.match_id  = pms.match_id
    JOIN teams ht       ON ht.team_id  = f.home_team_id
    JOIN teams at       ON at.team_id  = f.away_team_id
    JOIN match_results mr ON mr.match_id = f.match_id
    WHERE pms.player_id = ${playerId}
    ORDER BY f.kickoff_time DESC
  `
  return rows.map((r) => {
    const isHome   = (r.home_team_id as string) === teamId
    const opponent = isHome ? (r.away_team_name as string) : (r.home_team_name as string)
    const oppId    = isHome ? (r.away_team_id as string)   : (r.home_team_id as string)
    const myScore  = isHome ? Number(r.score_home) : Number(r.score_away)
    const oppScore = isHome ? Number(r.score_away) : Number(r.score_home)
    const result   = myScore > oppScore ? 'W' : myScore < oppScore ? 'L' : 'D'
    return {
      match_id: r.match_id as string,
      kickoff_time: r.kickoff_time as string,
      opponent,
      oppId,
      myScore,
      oppScore,
      result,
      goals:   Number(r.goals),
      assists: Number(r.assists),
      blocks:  Number(r.blocks),
    }
  })
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    timeZone: 'Indian/Maldives',
    month: 'short',
    day:   'numeric',
  })
}

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ playerId: string }>
}) {
  const { playerId } = await params
  const player = await getPlayer(playerId)
  if (!player) notFound()

  const [totals, matchLog, spiritTotal, standings] = await Promise.all([
    getSeasonTotals(playerId),
    getMatchLog(playerId, player.team_id as string),
    getSpiritNominationsReceived(playerId),
    getStandings(player.season_id as string),
  ])

  const leaguePosition = standings.findIndex((s) => s.team_id === (player.team_id as string)) + 1

  const appearances  = totals ? Number(totals.appearances)   : 0
  const totalGoals   = totals ? Number(totals.total_goals)   : 0
  const totalAssists = totals ? Number(totals.total_assists)  : 0
  const totalBlocks  = totals ? Number(totals.total_blocks)   : 0

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <PublicNav />
      <div className="max-w-lg mx-auto px-4 pb-16 pt-6 space-y-6">

        {/* Header */}
        <div className="bg-gray-900 rounded-xl p-5">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold">{player.display_name as string}</h1>
              <Link
                href={`/team/${player.team_id as string}`}
                className="text-sm text-green-400 hover:text-green-300 transition-colors mt-1 inline-block"
              >
                {player.team_name as string}
                {leaguePosition > 0 && (
                  <span className="text-gray-500 ml-1">· {ordinal(leaguePosition)}</span>
                )}
              </Link>
            </div>
            {spiritTotal > 0 && (
              <div className="text-center shrink-0 ml-4">
                <p className="text-xl font-bold text-green-400">{spiritTotal}</p>
                <p className="text-xs text-gray-400 mt-0.5">✨ Spirit</p>
              </div>
            )}
          </div>
        </div>

        {/* Season totals */}
        <div>
          <h2 className="text-xs text-gray-400 uppercase tracking-widest mb-2">Season Totals</h2>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Apps',    value: appearances  },
              { label: 'Goals',   value: totalGoals   },
              { label: 'Assists', value: totalAssists },
              { label: 'Blocks',  value: totalBlocks  },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-900 rounded-xl py-4 text-center">
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Match log */}
        {matchLog.length > 0 && (
          <div>
            <h2 className="text-xs text-gray-400 uppercase tracking-widest mb-2">Match Log</h2>
            <div className="bg-gray-900 rounded-xl overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-xs border-b border-gray-800">
                    <th className="text-left py-2 px-4 font-normal">Date</th>
                    <th className="text-left py-2 px-3 font-normal">Opponent</th>
                    <th className="text-right py-2 px-2 font-normal">Res</th>
                    <th className="text-right py-2 px-2 font-normal">G</th>
                    <th className="text-right py-2 px-2 font-normal">A</th>
                    <th className="text-right py-2 px-4 font-normal">B</th>
                  </tr>
                </thead>
                <tbody>
                  {matchLog.map((m) => (
                    <tr key={m.match_id} className="border-b border-gray-800 last:border-0">
                      <td className="py-2 px-4 text-gray-400 text-xs whitespace-nowrap">
                        {fmtDate(m.kickoff_time)}
                      </td>
                      <td className="py-2 px-3 truncate max-w-[7rem]">
                        <Link
                          href={`/team/${m.oppId}`}
                          className="hover:text-green-400 transition-colors"
                        >
                          {m.opponent}
                        </Link>
                      </td>
                      <td className="py-2 px-2 text-right">
                        <span
                          className={
                            m.result === 'W'
                              ? 'text-green-400 font-bold'
                              : m.result === 'L'
                              ? 'text-red-400 font-bold'
                              : 'text-gray-400'
                          }
                        >
                          {m.result} {m.myScore}–{m.oppScore}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums">{m.goals}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{m.assists}</td>
                      <td className="py-2 px-4 text-right tabular-nums">{m.blocks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {matchLog.length === 0 && (
          <p className="text-gray-400 text-sm">No match appearances yet.</p>
        )}

      </div>
    </div>
  )
}
