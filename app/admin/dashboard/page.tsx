import sql from '@/lib/db'
import Link from 'next/link'
import AdminNav from '@/app/_components/AdminNav'

export const revalidate = 0

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-MV', {
    timeZone: 'Indian/Maldives',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export default async function AdminDashboard() {
  const seasons = await sql`SELECT * FROM seasons ORDER BY created_at DESC LIMIT 1`
  const season = seasons[0] ?? null

  if (!season) {
    return (
      <div className="min-h-screen bg-gray-950 text-white">
        <AdminNav />
        <div className="max-w-lg mx-auto px-4 py-8">
          <p className="text-gray-500">No season found in database.</p>
        </div>
      </div>
    )
  }

  const sid = season.season_id

  // Section 1 — Pending results (past kickoff, no result row)
  const pending = await sql`
    SELECT
      f.match_id,
      f.matchweek,
      f.kickoff_time,
      ht.team_name AS home_team_name,
      at.team_name AS away_team_name
    FROM fixtures f
    JOIN teams ht ON ht.team_id = f.home_team_id
    JOIN teams at ON at.team_id = f.away_team_id
    LEFT JOIN match_results mr ON mr.match_id = f.match_id
    WHERE f.season_id = ${sid}
      AND f.kickoff_time < now()
      AND mr.match_id IS NULL
    ORDER BY f.kickoff_time ASC
  `

  // Section 2 — Next match
  const nextMatches = await sql`
    SELECT
      f.match_id,
      f.matchweek,
      f.kickoff_time,
      ht.team_name AS home_team_name,
      at.team_name AS away_team_name
    FROM fixtures f
    JOIN teams ht ON ht.team_id = f.home_team_id
    JOIN teams at ON at.team_id = f.away_team_id
    WHERE f.season_id = ${sid}
      AND f.kickoff_time > now()
    ORDER BY f.kickoff_time ASC
    LIMIT 1
  `
  const nextMatch = nextMatches[0] ?? null

  // Section 3 — Recent activity
  const recentResults = await sql`
    SELECT
      mr.match_result_id,
      mr.score_home,
      mr.score_away,
      mr.resolved_at,
      f.match_id,
      f.matchweek,
      ht.team_name AS home_team_name,
      at.team_name AS away_team_name
    FROM match_results mr
    JOIN fixtures f ON f.match_id = mr.match_id
    JOIN teams ht ON ht.team_id = f.home_team_id
    JOIN teams at ON at.team_id = f.away_team_id
    WHERE f.season_id = ${sid}
    ORDER BY mr.resolved_at DESC
    LIMIT 1
  `
  const recentResult = recentResults[0] ?? null

  // Section 4 — Season at a glance
  const [totalFixtures, completedFixtures] = await Promise.all([
    sql`SELECT COUNT(*) AS n FROM fixtures WHERE season_id = ${sid}`,
    sql`SELECT COUNT(*) AS n FROM fixtures WHERE season_id = ${sid} AND status = 'complete'`,
  ])
  const total = Number(totalFixtures[0].n)
  const completed = Number(completedFixtures[0].n)
  const remaining = total - completed

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <AdminNav />
      <div className="max-w-lg mx-auto px-4 py-6 pb-16 space-y-6">

        {/* Section 1 — Pending Results */}
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Pending Results
          </h2>
          {pending.length === 0 ? (
            <div className="bg-gray-900 rounded-xl px-4 py-3 flex items-center gap-2">
              <span className="text-green-400 text-sm font-medium">✓ All results up to date</span>
            </div>
          ) : (
            <ul className="space-y-2">
              {pending.map((f: any) => (
                <li key={f.match_id}>
                  <Link
                    href={`/match/${f.match_id}`}
                    className="block bg-gray-900 hover:bg-gray-800 rounded-xl px-4 py-3 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">
                          {f.home_team_name} vs {f.away_team_name}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          MW{f.matchweek} · {fmtDate(f.kickoff_time)}
                        </p>
                      </div>
                      <span className="text-xs text-yellow-400 font-medium">Enter result →</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Section 2 — Next Match */}
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Next Match
          </h2>
          {nextMatch ? (
            <Link
              href={`/match/${nextMatch.match_id}`}
              className="block bg-gray-900 hover:bg-gray-800 rounded-xl px-4 py-3 transition-colors"
            >
              <p className="text-sm font-medium">
                {nextMatch.home_team_name} vs {nextMatch.away_team_name}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                MW{nextMatch.matchweek} · {fmtDate(nextMatch.kickoff_time)}
              </p>
            </Link>
          ) : (
            <div className="bg-gray-900 rounded-xl px-4 py-3">
              <p className="text-sm text-gray-500">No upcoming matches scheduled.</p>
            </div>
          )}
        </section>

        {/* Section 3 — Recent Activity */}
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Recent Activity
          </h2>
          {recentResult ? (
            <Link
              href={`/match/${recentResult.match_id}`}
              className="block bg-gray-900 hover:bg-gray-800 rounded-xl px-4 py-3 transition-colors"
            >
              <p className="text-sm font-medium">
                {recentResult.home_team_name}{' '}
                <span className="text-white font-bold tabular-nums">
                  {recentResult.score_home}–{recentResult.score_away}
                </span>{' '}
                {recentResult.away_team_name}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                MW{recentResult.matchweek} · {fmtDate(recentResult.resolved_at)}
              </p>
            </Link>
          ) : (
            <div className="bg-gray-900 rounded-xl px-4 py-3">
              <p className="text-sm text-gray-500">No results entered yet.</p>
            </div>
          )}
        </section>

        {/* Section 4 — Season at a Glance */}
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Season at a Glance — {season.season_name}
          </h2>
          <div className="bg-gray-900 rounded-xl px-4 py-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">{total}</p>
                <p className="text-xs text-gray-400 mt-0.5">Total Fixtures</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-400">{completed}</p>
                <p className="text-xs text-gray-400 mt-0.5">Completed</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-400">{remaining}</p>
                <p className="text-xs text-gray-400 mt-0.5">Remaining</p>
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  )
}
