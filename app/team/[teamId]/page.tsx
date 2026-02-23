import Link from 'next/link'
import { notFound } from 'next/navigation'
import sql from '@/lib/db'
import PublicNav from '../../_components/PublicNav'

export const revalidate = 0

async function getTeam(teamId: string) {
  const rows = await sql`
    SELECT team_id::text, team_name, season_id::text
    FROM teams
    WHERE team_id = ${teamId}
    LIMIT 1
  `
  return rows[0] ?? null
}

async function getRoster(teamId: string) {
  const rows = await sql`
    SELECT player_id::text, display_name
    FROM players
    WHERE team_id = ${teamId} AND is_active = true
    ORDER BY display_name
  `
  return rows
}

async function getTeamRecord(teamId: string) {
  const rows = await sql`
    WITH results AS (
      SELECT
        f.home_team_id AS tid,
        mr.score_home  AS gf,
        mr.score_away  AS ga,
        CASE WHEN mr.score_home > mr.score_away THEN 3
             WHEN mr.score_home = mr.score_away THEN 1
             ELSE 0 END AS pts,
        CASE WHEN mr.score_home > mr.score_away THEN 1 ELSE 0 END AS won,
        CASE WHEN mr.score_home = mr.score_away THEN 1 ELSE 0 END AS drawn,
        CASE WHEN mr.score_home < mr.score_away THEN 1 ELSE 0 END AS lost
      FROM fixtures f
      JOIN match_results mr ON mr.match_id = f.match_id
      UNION ALL
      SELECT
        f.away_team_id AS tid,
        mr.score_away  AS gf,
        mr.score_home  AS ga,
        CASE WHEN mr.score_away > mr.score_home THEN 3
             WHEN mr.score_away = mr.score_home THEN 1
             ELSE 0 END AS pts,
        CASE WHEN mr.score_away > mr.score_home THEN 1 ELSE 0 END AS won,
        CASE WHEN mr.score_away = mr.score_home THEN 1 ELSE 0 END AS drawn,
        CASE WHEN mr.score_away < mr.score_home THEN 1 ELSE 0 END AS lost
      FROM fixtures f
      JOIN match_results mr ON mr.match_id = f.match_id
    )
    SELECT
      COUNT(tid)::int             AS played,
      COALESCE(SUM(won),   0)::int AS won,
      COALESCE(SUM(drawn), 0)::int AS drawn,
      COALESCE(SUM(lost),  0)::int AS lost,
      COALESCE(SUM(gf),    0)::int AS goals_for,
      COALESCE(SUM(ga),    0)::int AS goals_against,
      COALESCE(SUM(pts),   0)::int AS points
    FROM results
    WHERE tid = ${teamId}
  `
  return rows[0] ?? null
}

async function getRecentFixtures(teamId: string) {
  const rows = await sql`
    SELECT
      f.match_id::text,
      f.matchweek,
      f.kickoff_time,
      f.status,
      ht.team_id::text AS home_team_id,
      ht.team_name     AS home_team_name,
      at.team_id::text AS away_team_id,
      at.team_name     AS away_team_name,
      mr.score_home,
      mr.score_away
    FROM fixtures f
    JOIN  teams ht ON ht.team_id = f.home_team_id
    JOIN  teams at ON at.team_id = f.away_team_id
    LEFT JOIN match_results mr ON mr.match_id = f.match_id
    WHERE (f.home_team_id = ${teamId} OR f.away_team_id = ${teamId})
    ORDER BY f.kickoff_time DESC
    LIMIT 5
  `
  return rows
}

function fmtKickoff(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', {
    timeZone: 'Indian/Maldives',
    weekday: 'short',
    month:   'short',
    day:     'numeric',
  })
}

export default async function TeamPage({
  params,
}: {
  params: Promise<{ teamId: string }>
}) {
  const { teamId } = await params
  const team = await getTeam(teamId)
  if (!team) notFound()

  const [roster, record, recent] = await Promise.all([
    getRoster(teamId),
    getTeamRecord(teamId),
    getRecentFixtures(teamId),
  ])

  const won    = record ? Number(record.won)    : 0
  const drawn  = record ? Number(record.drawn)  : 0
  const lost   = record ? Number(record.lost)   : 0
  const played = record ? Number(record.played) : 0
  const pts    = record ? Number(record.points) : 0
  const gf     = record ? Number(record.goals_for)    : 0
  const ga     = record ? Number(record.goals_against) : 0

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <PublicNav />
      <div className="max-w-lg mx-auto px-4 pb-16 pt-6 space-y-6">

        {/* Team header */}
        <div className="bg-gray-900 rounded-xl p-5">
          <h1 className="text-2xl font-bold mb-3">{team.team_name as string}</h1>
          {played > 0 ? (
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { label: 'Pts', value: pts,   highlight: true },
                { label: 'W',   value: won,   highlight: false },
                { label: 'D',   value: drawn, highlight: false },
                { label: 'L',   value: lost,  highlight: false },
              ].map(({ label, value, highlight }) => (
                <div key={label} className="bg-gray-800 rounded-lg py-2">
                  <p className={`text-xl font-bold ${highlight ? 'text-green-400' : ''}`}>{value}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No results yet · {roster.length} players</p>
          )}
          {played > 0 && (
            <p className="text-xs text-gray-500 mt-3 text-center">
              {played} played · {gf} GF · {ga} GA · GD {gf - ga > 0 ? `+${gf - ga}` : gf - ga}
            </p>
          )}
        </div>

        {/* Roster */}
        <div>
          <h2 className="text-xs text-gray-400 uppercase tracking-widest mb-2">
            Roster ({roster.length})
          </h2>
          <div className="bg-gray-900 rounded-xl overflow-hidden divide-y divide-gray-800">
            {roster.map((p) => (
              <Link
                key={p.player_id as string}
                href={`/player/${p.player_id as string}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-800 transition-colors"
              >
                <span className="text-sm">{p.display_name as string}</span>
                <span className="text-gray-600">›</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent fixtures */}
        {recent.length > 0 && (
          <div>
            <h2 className="text-xs text-gray-400 uppercase tracking-widest mb-2">Recent Fixtures</h2>
            <div className="bg-gray-900 rounded-xl overflow-hidden divide-y divide-gray-800">
              {recent.map((f) => {
                const isHome   = (f.home_team_id as string) === teamId
                const opponent = isHome
                  ? (f.away_team_name as string)
                  : (f.home_team_name as string)
                const played   = f.score_home != null
                let result: { label: string; cls: string } | null = null
                if (played) {
                  const myScore  = isHome ? Number(f.score_home)  : Number(f.score_away)
                  const oppScore = isHome ? Number(f.score_away)  : Number(f.score_home)
                  if (myScore > oppScore)      result = { label: 'W', cls: 'text-green-400' }
                  else if (myScore < oppScore) result = { label: 'L', cls: 'text-red-400'   }
                  else                         result = { label: 'D', cls: 'text-gray-400'  }
                }
                return (
                  <Link
                    key={f.match_id as string}
                    href={`/match/${f.match_id as string}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-800 transition-colors"
                  >
                    <span className="text-xs text-gray-500 w-16 shrink-0">
                      {fmtKickoff(f.kickoff_time as string)}
                    </span>
                    <span className="text-sm flex-1 truncate">{opponent}</span>
                    {played && result ? (
                      <span className={`text-sm font-bold tabular-nums shrink-0 ${result.cls}`}>
                        {result.label}&nbsp;
                        {isHome
                          ? `${Number(f.score_home)}–${Number(f.score_away)}`
                          : `${Number(f.score_away)}–${Number(f.score_home)}`}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-500 shrink-0">
                        MW{Number(f.matchweek)}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
