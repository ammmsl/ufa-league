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

async function getAllFixtures(seasonId: string) {
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
    JOIN teams ht ON ht.team_id = f.home_team_id
    JOIN teams at ON at.team_id = f.away_team_id
    LEFT JOIN match_results mr ON mr.match_id = f.match_id
    WHERE f.season_id = ${seasonId}
    ORDER BY f.kickoff_time ASC
  `
  return rows
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

export default async function FixturesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  const { filter = 'all' } = await searchParams

  const season = await getActiveSeason()
  if (!season) {
    return (
      <div className="min-h-screen bg-gray-950 text-white">
        <PublicNav />
        <div className="max-w-lg mx-auto px-4 pt-6 text-gray-400">No active season.</div>
      </div>
    )
  }

  const allFixtures = await getAllFixtures(season.season_id as string)

  const filtered = allFixtures.filter((f) => {
    if (filter === 'upcoming')  return f.status === 'scheduled'
    if (filter === 'completed') return f.status === 'complete'
    return true
  })

  // Group by matchweek
  type FixtureRow = (typeof allFixtures)[number]
  const grouped = new Map<number, FixtureRow[]>()
  for (const f of filtered) {
    const mw = Number(f.matchweek)
    if (!grouped.has(mw)) grouped.set(mw, [])
    grouped.get(mw)!.push(f)
  }
  const matchweeks = Array.from(grouped.entries()).sort((a, b) => a[0] - b[0])

  const tabs = [
    { label: 'All',       value: 'all' },
    { label: 'Upcoming',  value: 'upcoming' },
    { label: 'Completed', value: 'completed' },
  ]

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <PublicNav />
      <div className="max-w-lg mx-auto px-4 pb-16 pt-6">
        <h1 className="text-2xl font-bold mb-4">Fixtures</h1>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6">
          {tabs.map((tab) => (
            <Link
              key={tab.value}
              href={`/fixtures?filter=${tab.value}`}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === tab.value
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        {matchweeks.length === 0 && (
          <p className="text-gray-400">No fixtures found.</p>
        )}

        <div className="space-y-6">
          {matchweeks.map(([mw, fixtures]) => (
            <div key={mw}>
              <h2 className="text-xs text-gray-400 uppercase tracking-widest mb-2">
                Matchweek {mw}
              </h2>
              <div className="bg-gray-900 rounded-xl overflow-hidden divide-y divide-gray-800">
                {fixtures.map((f) => (
                  <Link
                    key={f.match_id as string}
                    href={`/match/${f.match_id as string}`}
                    className="flex items-center px-4 py-3 hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-400 mb-1">
                        {fmtKickoff(f.kickoff_time as string)}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-white text-sm font-medium truncate flex-1">
                          {f.home_team_name as string}
                        </span>
                        <span className="text-sm font-bold tabular-nums text-center min-w-[3.5rem]">
                          {f.score_home != null
                            ? `${Number(f.score_home)} – ${Number(f.score_away)}`
                            : 'vs'}
                        </span>
                        <span className="text-white text-sm font-medium truncate flex-1 text-right">
                          {f.away_team_name as string}
                        </span>
                      </div>
                    </div>
                    <span className="text-gray-600 ml-3">›</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
