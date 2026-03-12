import sql from '@/lib/db'
import PublicNav from '../_components/PublicNav'
import FixturesCalendar from './FixturesCalendar'

export const revalidate = 0

// ─── Block derivation ─────────────────────────────────────────────────────────

type Block = 'Block 1' | 'Block 2' | 'Block 3'

function getBlock(mw: number): Block {
  if (mw <= 5) return 'Block 1'
  if (mw <= 8) return 'Block 2'
  return 'Block 3'
}

const MW_NOTES: Record<number, string> = {
  1: 'Post-Ramadan Launch',
  2: '7-Day Rest',
  3: '7-Day Rest',
  4: '7-Day Rest',
  5: '7-Day Rest',
  6: '14-Day Gap (Post-Holiday)',
  7: '7-Day Rest',
  8: '4-Day Rest (Pre-Eid Push)',
  9: '17-Day Gap (Post-Eid)',
  10: 'Season Finale',
}

// ─── Date helpers ──────────────────────────────────────────────────────────────

/** UTC ISO → DD/MM/YYYY in Maldives Time (MVT, UTC+5) */
function toMVTDateString(iso: string): string {
  const d = new Date(iso)
  const day   = d.toLocaleDateString('en-GB', { timeZone: 'Indian/Maldives', day:   '2-digit' })
  const month = d.toLocaleDateString('en-GB', { timeZone: 'Indian/Maldives', month: '2-digit' })
  const year  = d.toLocaleDateString('en-GB', { timeZone: 'Indian/Maldives', year:  'numeric' })
  return `${day}/${month}/${year}`
}

/** UTC ISO → weekday name in MVT */
function toMVTWeekday(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    timeZone: 'Indian/Maldives',
    weekday: 'long',
  })
}

// ─── DB queries ───────────────────────────────────────────────────────────────

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
  return sql`
    SELECT
      f.match_id::text,
      f.matchweek,
      f.kickoff_time,
      f.status,
      ht.team_name AS home_team_name,
      at.team_name AS away_team_name,
      mr.score_home,
      mr.score_away
    FROM fixtures f
    JOIN teams ht ON ht.team_id = f.home_team_id
    JOIN teams at ON at.team_id = f.away_team_id
    LEFT JOIN match_results mr ON mr.match_id = f.match_id
    WHERE f.season_id = ${seasonId}
    ORDER BY f.kickoff_time ASC
  `
}

async function getTeamNames(seasonId: string): Promise<string[]> {
  const rows = await sql`
    SELECT team_name FROM teams
    WHERE season_id = ${seasonId}
    ORDER BY team_name ASC
  `
  return rows.map((r) => r.team_name as string)
}

async function getHolidays(seasonId: string) {
  return sql`
    SELECT
      start_date::text,
      end_date::text,
      name
    FROM season_holidays
    WHERE season_id = ${seasonId}
    ORDER BY start_date ASC
  `
}

// ─── Types exported for the client component ──────────────────────────────────

export type EnrichedFixture = {
  match_id: string
  matchweek: number
  block: Block
  kickoff_time: string
  date: string       // DD/MM/YYYY in MVT
  day: string        // 'Friday' | 'Tuesday' etc.
  home_team_name: string
  away_team_name: string
  bye_team: string
  note: string
  status: string
  score_home: number | null
  score_away: number | null
}

export type HolidayRow = {
  start_date: string  // YYYY-MM-DD
  end_date: string    // YYYY-MM-DD
  name: string
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function FixturesPage() {
  const season = await getActiveSeason()
  if (!season) {
    return (
      <div className="min-h-screen bg-gray-950 text-white">
        <PublicNav />
        <div className="max-w-lg mx-auto px-4 pt-6 text-gray-400">No active season.</div>
      </div>
    )
  }

  const [rawFixtures, teamNames, rawHolidays] = await Promise.all([
    getAllFixtures(season.season_id as string),
    getTeamNames(season.season_id as string),
    getHolidays(season.season_id as string),
  ])

  // Compute bye team per (matchweek, date) — the team absent from both fixtures that day
  // Group fixtures by matchweek to identify which teams are playing
  const mwTeams = new Map<number, Set<string>>()
  for (const f of rawFixtures) {
    const mw = Number(f.matchweek)
    if (!mwTeams.has(mw)) mwTeams.set(mw, new Set())
    mwTeams.get(mw)!.add(f.home_team_name as string)
    mwTeams.get(mw)!.add(f.away_team_name as string)
  }

  const enrichedFixtures: EnrichedFixture[] = rawFixtures.map((f) => {
    const mw = Number(f.matchweek)
    const playing = mwTeams.get(mw) ?? new Set<string>()
    const bye = teamNames.find((t) => !playing.has(t)) ?? ''
    return {
      match_id:       f.match_id as string,
      matchweek:      mw,
      block:          getBlock(mw),
      kickoff_time:   f.kickoff_time as string,
      date:           toMVTDateString(f.kickoff_time as string),
      day:            toMVTWeekday(f.kickoff_time as string),
      home_team_name: f.home_team_name as string,
      away_team_name: f.away_team_name as string,
      bye_team:       bye,
      note:           MW_NOTES[mw] ?? '',
      status:         f.status as string,
      score_home:     f.score_home != null ? Number(f.score_home) : null,
      score_away:     f.score_away != null ? Number(f.score_away) : null,
    }
  })

  const holidays: HolidayRow[] = rawHolidays.map((h) => ({
    start_date: h.start_date as string,
    end_date:   h.end_date as string,
    name:       h.name as string,
  }))

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <PublicNav />
      <FixturesCalendar
        fixtures={enrichedFixtures}
        teams={teamNames}
        holidays={holidays}
      />
    </div>
  )
}
