'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  nextGameDay,
  toDatetimeLocal,
  toMVTIso,
  kickoffToInput,
  makeMVTKickoff,
} from '@/lib/schedule'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Season {
  season_id: string
  season_name: string
  start_date: string
  end_date: string
  break_start: string | null
  break_end: string | null
  status: string
}

interface Player {
  player_id: string
  display_name: string
}

interface Team {
  team_id: string
  team_name: string
  season_id: string
  players: Player[]
}

interface Fixture {
  match_id: string
  season_id: string
  home_team_id: string
  away_team_id: string
  kickoff_time: string
  venue: string
  status: string
  matchweek: number
  home_team_name: string
  away_team_name: string
}

interface GameDay {
  year: number
  month: number
  day: number
}

interface HolidayRange {
  id: string
  start: string  // YYYY-MM-DD
  end: string    // YYYY-MM-DD
  name: string
}

// ─── Schedule helpers ─────────────────────────────────────────────────────────

/**
 * Expands an array of holiday ranges into a flat Set of YYYY-MM-DD strings.
 */
function buildHolidaySet(holidays: HolidayRange[]): Set<string> {
  const parse = (s: string) => {
    const [y, m, d] = s.slice(0, 10).split('-').map(Number)
    return Date.UTC(y, m - 1, d)
  }
  const set = new Set<string>()
  for (const h of holidays) {
    let curr = parse(h.start)
    const end = parse(h.end)
    while (curr <= end) {
      const d = new Date(curr)
      set.add(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`)
      curr += 86_400_000
    }
  }
  return set
}

/**
 * Returns all Tue/Fri dates within the season range, excluding the break period
 * and any public holiday ranges.
 * Uses UTC date arithmetic to avoid timezone shifts on bare date strings.
 */
function getSeasonGameDays(
  startDate: string,
  endDate: string,
  breakStart: string | null,
  breakEnd: string | null,
  holidays: HolidayRange[] = []
): GameDay[] {
  const parse = (s: string) => {
    const [y, m, d] = s.slice(0, 10).split('-').map(Number)
    return Date.UTC(y, m - 1, d)
  }
  const startMs = parse(startDate)
  const endMs = parse(endDate)
  const bStartMs = breakStart ? parse(breakStart) : null
  const bEndMs = breakEnd ? parse(breakEnd) : null
  const holidaySet = buildHolidaySet(holidays)

  const days: GameDay[] = []
  let curr = startMs
  while (curr <= endMs) {
    const d = new Date(curr)
    const dow = d.getUTCDay()
    if (dow === 2 || dow === 5) {
      const dateStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
      const inBreak = bStartMs !== null && bEndMs !== null && curr >= bStartMs && curr <= bEndMs
      if (!inBreak && !holidaySet.has(dateStr)) {
        days.push({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() })
      }
    }
    curr += 86_400_000
  }
  return days
}

/**
 * Fixed pairing table for 5 teams (0-indexed draft positions).
 * Gives: R1 1v2 3v4, R2 5v1 2v3, R3 2v4 3v5, R4 1v3 4v5, R5 1v4 2v5.
 * Every unique pair appears exactly once across the 5 rounds.
 */
const FIVE_TEAM_SINGLE_RR: [number, number][][] = [
  [[0, 1], [2, 3]], // R1: 1v2, 3v4  (bye: 5)
  [[4, 0], [1, 2]], // R2: 5v1, 2v3  (bye: 4)
  [[1, 3], [2, 4]], // R3: 2v4, 3v5  (bye: 1)
  [[0, 2], [3, 4]], // R4: 1v3, 4v5  (bye: 2)
  [[0, 3], [1, 4]], // R5: 1v4, 2v5  (bye: 3)
]

/**
 * Returns a double round-robin schedule as an array of rounds, where each
 * round is an array of [home, away] team pairs.
 *
 * For 5 teams: uses the fixed pairing table above so the first game is always
 * the top two draft picks, then seeds 3&4, then seed 5 plays seed 1, etc.
 * Second half swaps home/away (rematches only after all first legs are done).
 *
 * For other team counts: falls back to the circle method.
 */
function generateSchedule(teams: Team[]): Array<[Team, Team][]> {
  if (teams.length === 5) {
    const singleRounds: Array<[Team, Team][]> = FIVE_TEAM_SINGLE_RR.map((round) =>
      round.map(([hi, ai]) => [teams[hi], teams[ai]] as [Team, Team])
    )
    return [
      ...singleRounds,
      ...singleRounds.map((r) => r.map(([h, a]) => [a, h] as [Team, Team])),
    ]
  }

  // General circle-method for other team counts (odd → add dummy bye)
  const list: (Team | null)[] = [...teams, null]
  const n = list.length

  const singleRounds: Array<[Team, Team][]> = []
  for (let r = 0; r < n - 1; r++) {
    const games: [Team, Team][] = []
    for (let i = 0; i < n / 2; i++) {
      const home = list[i]
      const away = list[n - 1 - i]
      if (home !== null && away !== null) games.push([home, away])
    }
    singleRounds.push(games)
    // Rotate: fix list[0], rotate list[1..n-1]
    const last = list[n - 1]
    for (let i = n - 1; i > 1; i--) list[i] = list[i - 1]
    list[1] = last
  }

  return [...singleRounds, ...singleRounds.map((r) => r.map(([h, a]) => [a, h] as [Team, Team]))]
}

// ─── Display helpers ──────────────────────────────────────────────────────────

function abbrev(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 3)
}

function fmtDate(utcIso: string): string {
  return new Date(new Date(utcIso).getTime() + 5 * 3600_000).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

function fmtKickoff(utcIso: string): string {
  return new Date(utcIso).toLocaleString('en-MV', {
    timeZone: 'Indian/Maldives',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Returns the MVT calendar date (YYYY-MM-DD) for a UTC ISO kickoff string. */
function getFixtureMVTDate(utcIso: string): string {
  const mvt = new Date(new Date(utcIso).getTime() + 5 * 3600_000)
  return `${mvt.getUTCFullYear()}-${String(mvt.getUTCMonth() + 1).padStart(2, '0')}-${String(mvt.getUTCDate()).padStart(2, '0')}`
}

/**
 * Returns true if moving `fixture` to `dateStr` would create a back-to-back
 * (adjacent game day, i.e. Tue↔Fri — always 3 or 4 calendar days apart) for
 * either of the fixture's teams.
 */
function isBackToBack(dateStr: string, fixture: Fixture, allFixtures: Fixture[]): boolean {
  const parse = (s: string) => {
    const [y, m, d] = s.slice(0, 10).split('-').map(Number)
    return Date.UTC(y, m - 1, d)
  }
  const targetMs = parse(dateStr)
  const FOUR_DAYS_MS = 4 * 86_400_000
  for (const f of allFixtures) {
    if (f.match_id === fixture.match_id) continue
    // Only care about fixtures that share at least one team
    if (
      f.home_team_id !== fixture.home_team_id &&
      f.home_team_id !== fixture.away_team_id &&
      f.away_team_id !== fixture.home_team_id &&
      f.away_team_id !== fixture.away_team_id
    ) continue
    const fMs = parse(getFixtureMVTDate(f.kickoff_time))
    const diff = Math.abs(fMs - targetMs)
    // Adjacent game days (Tue↔Fri) are always 3 or 4 days apart
    if (diff > 0 && diff <= FOUR_DAYS_MS) return true
  }
  return false
}

// ─── Calendar view ────────────────────────────────────────────────────────────

interface DayCell {
  dateStr: string
  day: number
  dow: number
  inSeason: boolean
  inBreak: boolean
  isGameDay: boolean
  isHoliday: boolean
  fixtures: Fixture[]
}

function buildMonth(
  year: number,
  month: number,
  season: Season,
  fixtures: Fixture[],
  holidays: HolidayRange[] = []
): (DayCell | null)[][] {
  const parse = (s: string) => { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return Date.UTC(y, m - 1, d) }
  const startMs = parse(season.start_date)
  const endMs = parse(season.end_date)
  const bStartMs = season.break_start ? parse(season.break_start) : null
  const bEndMs = season.break_end ? parse(season.break_end) : null
  const holidaySet = buildHolidaySet(holidays)

  // Index fixtures by MVT date
  const byDate: Record<string, Fixture[]> = {}
  for (const f of fixtures) {
    const k = getFixtureMVTDate(f.kickoff_time)
    if (!byDate[k]) byDate[k] = []
    byDate[k].push(f)
  }

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()

  const cells: (DayCell | null)[] = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const ms = Date.UTC(year, month - 1, d)
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const dow = new Date(ms).getUTCDay()
    cells.push({
      dateStr,
      day: d,
      dow,
      inSeason: ms >= startMs && ms <= endMs,
      inBreak: bStartMs !== null && bEndMs !== null && ms >= bStartMs && ms <= bEndMs,
      isGameDay: dow === 2 || dow === 5,
      isHoliday: holidaySet.has(dateStr),
      fixtures: byDate[dateStr] ?? [],
    })
  }
  while (cells.length % 7 !== 0) cells.push(null)

  const weeks: (DayCell | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function CalendarView({
  season,
  fixtures,
  holidays,
  onDateClick,
  adjustMode = false,
  selectedFixture = null,
}: {
  season: Season
  fixtures: Fixture[]
  holidays: HolidayRange[]
  onDateClick: (dateStr: string) => void
  adjustMode?: boolean
  selectedFixture?: Fixture | null
}) {
  const [sy, sm] = season.start_date.slice(0, 10).split('-').map(Number)
  const [ey, em] = season.end_date.slice(0, 10).split('-').map(Number)

  const months: { year: number; month: number }[] = []
  let cy = sy, cm = sm
  while (cy < ey || (cy === ey && cm <= em)) {
    months.push({ year: cy, month: cm })
    cm++
    if (cm > 12) { cm = 1; cy++ }
  }

  // The current date of the selected fixture (used for "current" highlight)
  const selectedFixtureDate = selectedFixture ? getFixtureMVTDate(selectedFixture.kickoff_time) : null

  return (
    <div className="space-y-5">
      {months.map(({ year, month }) => {
        const weeks = buildMonth(year, month, season, fixtures, holidays)
        return (
          <div key={`${year}-${month}`}>
            <p className="text-xs font-semibold text-gray-400 mb-1">
              {MONTH_NAMES[month - 1]} {year}
            </p>
            <div className="grid grid-cols-7 gap-px">
              {DOW_LABELS.map((d) => (
                <div key={d} className="text-center text-[10px] text-gray-600 pb-1">{d}</div>
              ))}
              {weeks.map((week, wi) =>
                week.map((cell, di) => {
                  if (!cell) return <div key={`${wi}-${di}`} className="h-14 rounded" />
                  const blocked = cell.inBreak || cell.isHoliday

                  // ── Adjust-mode validity ──────────────────────────────────
                  let moveValidity: 'valid' | 'invalid' | 'current' | null = null
                  if (adjustMode && selectedFixture && cell.isGameDay && cell.inSeason && !blocked) {
                    if (cell.dateStr === selectedFixtureDate) {
                      moveValidity = 'current'
                    } else {
                      const sameDayConflict = fixtures.some(
                        (f) =>
                          f.match_id !== selectedFixture.match_id &&
                          getFixtureMVTDate(f.kickoff_time) === cell.dateStr &&
                          (f.home_team_id === selectedFixture.home_team_id ||
                            f.home_team_id === selectedFixture.away_team_id ||
                            f.away_team_id === selectedFixture.home_team_id ||
                            f.away_team_id === selectedFixture.away_team_id)
                      )
                      if (sameDayConflict || isBackToBack(cell.dateStr, selectedFixture, fixtures)) {
                        moveValidity = 'invalid'
                      } else {
                        moveValidity = 'valid'
                      }
                    }
                  }

                  // ── Click eligibility ────────────────────────────────────
                  const clickable =
                    adjustMode && selectedFixture
                      ? moveValidity === 'valid'
                      : cell.inSeason && !blocked && cell.isGameDay

                  // ── Cell background / ring ───────────────────────────────
                  let cellClass = 'bg-gray-900'
                  if (adjustMode && selectedFixture && moveValidity) {
                    if (moveValidity === 'valid')
                      cellClass = 'bg-green-900/40 ring-1 ring-inset ring-green-700 cursor-pointer hover:bg-green-800/60'
                    else if (moveValidity === 'current')
                      cellClass = 'bg-amber-900/50 ring-1 ring-inset ring-amber-600'
                    else if (moveValidity === 'invalid')
                      cellClass = 'bg-red-900/30 ring-1 ring-inset ring-red-900'
                  } else if (!adjustMode && clickable) {
                    cellClass = 'cursor-pointer hover:bg-gray-700 ring-1 ring-inset ring-blue-800'
                  }

                  // ── Day number colour ────────────────────────────────────
                  const dayNumClass =
                    moveValidity === 'current'
                      ? 'text-amber-400'
                      : moveValidity === 'valid'
                      ? 'text-green-400'
                      : moveValidity === 'invalid'
                      ? 'text-red-500'
                      : cell.isHoliday && cell.inSeason
                      ? 'text-orange-400'
                      : cell.isGameDay && cell.inSeason && !blocked
                      ? 'text-blue-400'
                      : 'text-gray-600'

                  return (
                    <div
                      key={cell.dateStr}
                      onClick={clickable ? () => onDateClick(cell.dateStr) : undefined}
                      title={
                        moveValidity === 'invalid'
                          ? 'Invalid: same-day team conflict or back-to-back game days'
                          : moveValidity === 'current'
                          ? 'Current fixture date'
                          : undefined
                      }
                      className={[
                        'h-14 rounded p-1 text-[10px] overflow-hidden',
                        cellClass,
                        !cell.inSeason ? 'opacity-20' : '',
                        blocked && !adjustMode ? 'opacity-50' : '',
                      ].join(' ')}
                    >
                      <div className={`font-medium mb-px ${dayNumClass}`}>
                        {cell.day}
                      </div>
                      {cell.fixtures.slice(0, 2).map((f, i) => (
                        <div
                          key={i}
                          className={[
                            'rounded px-0.5 mb-px leading-3 truncate',
                            adjustMode && selectedFixture && f.match_id === selectedFixture.match_id
                              ? 'bg-amber-700 text-amber-100'
                              : 'bg-blue-900 text-blue-100',
                          ].join(' ')}
                        >
                          {abbrev(f.home_team_name)}v{abbrev(f.away_team_name)}
                        </div>
                      ))}
                      {cell.inBreak && <div className="text-gray-600 leading-3">break</div>}
                      {cell.isHoliday && cell.inSeason && (
                        <div className="text-orange-500 leading-3">holiday</div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Match matrix ─────────────────────────────────────────────────────────────

function MatchMatrix({
  teams,
  fixtures,
  onCellClick,
}: {
  teams: Team[]
  fixtures: Fixture[]
  onCellClick: (homeTeam: Team, awayTeam: Team) => void
}) {
  function getDates(aId: string, bId: string): string[] {
    return fixtures
      .filter(
        (f) =>
          (f.home_team_id === aId && f.away_team_id === bId) ||
          (f.home_team_id === bId && f.away_team_id === aId)
      )
      .sort((a, b) => new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime())
      .map((f) => fmtDate(f.kickoff_time))
  }

  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-collapse">
        <thead>
          <tr>
            <th className="p-1.5 text-gray-600 font-normal" />
            {teams.map((t) => (
              <th key={t.team_id} className="p-1.5 text-center text-gray-400 font-semibold whitespace-nowrap">
                {t.team_name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {teams.map((rowTeam) => (
            <tr key={rowTeam.team_id}>
              <td className="p-1.5 text-right text-gray-400 font-semibold whitespace-nowrap pr-3">
                {rowTeam.team_name}
              </td>
              {teams.map((colTeam) => {
                if (rowTeam.team_id === colTeam.team_id) {
                  return (
                    <td key={colTeam.team_id} className="p-1.5 text-center text-gray-700 bg-gray-900/40">
                      —
                    </td>
                  )
                }
                const dates = getDates(rowTeam.team_id, colTeam.team_id)
                return (
                  <td
                    key={colTeam.team_id}
                    title={`${rowTeam.team_name} (H) vs ${colTeam.team_name} (A) — click to pre-fill`}
                    onClick={() => onCellClick(rowTeam, colTeam)}
                    className={[
                      'p-1.5 text-center cursor-pointer hover:bg-gray-800 rounded transition-colors whitespace-nowrap',
                      dates.length === 2 ? 'text-green-300' : dates.length === 1 ? 'text-yellow-300' : 'text-gray-600',
                    ].join(' ')}
                  >
                    {dates.length > 0 ? dates.join(', ') : '—'}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Edit fixture inline form ─────────────────────────────────────────────────

function EditFixtureForm({
  fixture,
  teams,
  onSave,
  onCancel,
}: {
  fixture: Fixture
  teams: Team[]
  onSave: (updated: Fixture) => void
  onCancel: () => void
}) {
  const [homeTeamId, setHomeTeamId] = useState(fixture.home_team_id)
  const [awayTeamId, setAwayTeamId] = useState(fixture.away_team_id)
  const [kickoff, setKickoff] = useState(kickoffToInput(fixture.kickoff_time))
  const [venue, setVenue] = useState(fixture.venue)
  const [matchweek, setMatchweek] = useState(fixture.matchweek)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (homeTeamId === awayTeamId) { setError('Teams must be different'); return }
    setSaving(true)
    setError('')
    const res = await fetch(`/api/admin/fixtures/${fixture.match_id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        kickoff_time: toMVTIso(kickoff),
        venue,
        matchweek,
      }),
    })
    setSaving(false)
    if (!res.ok) { setError('Failed to save'); return }
    const raw = await res.json()
    const home = teams.find((t) => t.team_id === homeTeamId)
    const away = teams.find((t) => t.team_id === awayTeamId)
    onSave({ ...raw, home_team_name: home?.team_name ?? '', away_team_name: away?.team_name ?? '' })
  }

  return (
    <div className="bg-gray-800 rounded-lg p-3 space-y-2.5">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] text-gray-500 mb-0.5">Home</label>
          <select value={homeTeamId} onChange={(e) => setHomeTeamId(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white">
            {teams.map((t) => <option key={t.team_id} value={t.team_id}>{t.team_name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-gray-500 mb-0.5">Away</label>
          <select value={awayTeamId} onChange={(e) => setAwayTeamId(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white">
            {teams.map((t) => <option key={t.team_id} value={t.team_id}>{t.team_name}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2">
          <label className="block text-[10px] text-gray-500 mb-0.5">Kickoff (MVT)</label>
          <input type="datetime-local" value={kickoff} onChange={(e) => setKickoff(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white" />
        </div>
        <div>
          <label className="block text-[10px] text-gray-500 mb-0.5">MW</label>
          <input type="number" min={1} value={matchweek} onChange={(e) => setMatchweek(Number(e.target.value))}
            className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white" />
        </div>
      </div>
      <div>
        <label className="block text-[10px] text-gray-500 mb-0.5">Venue</label>
        <input type="text" value={venue} onChange={(e) => setVenue(e.target.value)}
          className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white" />
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <div className="flex gap-2">
        <button onClick={handleSave} disabled={saving}
          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-xs font-medium">
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button onClick={onCancel} className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded text-xs">
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─── Fixture list ─────────────────────────────────────────────────────────────

function FixtureList({
  fixtures,
  teams,
  onFixtureUpdated,
  onFixtureDeleted,
  adjustMode = false,
  selectedFixtureId = null,
  onFixtureSelect,
}: {
  fixtures: Fixture[]
  teams: Team[]
  onFixtureUpdated: (f: Fixture) => void
  onFixtureDeleted: (matchId: string) => void
  adjustMode?: boolean
  selectedFixtureId?: string | null
  onFixtureSelect?: (matchId: string) => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  // Exit any open edit when adjust mode activates
  useEffect(() => {
    if (adjustMode) setEditingId(null)
  }, [adjustMode])

  const sorted = [...fixtures].sort((a, b) => {
    if (a.matchweek !== b.matchweek) return a.matchweek - b.matchweek
    return new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime()
  })

  const byMW = new Map<number, Fixture[]>()
  for (const f of sorted) {
    if (!byMW.has(f.matchweek)) byMW.set(f.matchweek, [])
    byMW.get(f.matchweek)!.push(f)
  }

  async function handleDelete(matchId: string) {
    if (!confirm('Delete this fixture?')) return
    setDeleting(matchId)
    const res = await fetch(`/api/admin/fixtures/${matchId}`, { method: 'DELETE' })
    setDeleting(null)
    if (res.ok) onFixtureDeleted(matchId)
  }

  if (fixtures.length === 0) {
    return <p className="text-gray-600 text-sm italic py-2">No fixtures scheduled yet.</p>
  }

  return (
    <div className="space-y-4">
      {[...byMW.entries()].sort(([a], [b]) => a - b).map(([mw, mwFixtures]) => (
        <div key={mw}>
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
            Matchweek {mw}
          </p>
          <div className="space-y-1">
            {mwFixtures.map((f) => (
              <div key={f.match_id}>
                {editingId === f.match_id && !adjustMode ? (
                  <EditFixtureForm
                    fixture={f}
                    teams={teams}
                    onSave={(updated) => { onFixtureUpdated(updated); setEditingId(null) }}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <div
                    onClick={adjustMode ? () => onFixtureSelect?.(f.match_id) : undefined}
                    className={[
                      'flex items-center gap-2 rounded px-3 py-2 text-sm transition-colors',
                      adjustMode
                        ? selectedFixtureId === f.match_id
                          ? 'bg-amber-900/50 ring-1 ring-inset ring-amber-600 cursor-pointer'
                          : 'bg-gray-900 hover:bg-gray-800 cursor-pointer'
                        : 'bg-gray-900',
                    ].join(' ')}
                  >
                    <span className="text-xs text-gray-500 w-32 shrink-0">{fmtKickoff(f.kickoff_time)}</span>
                    <span className="flex-1 min-w-0 truncate">
                      <span className="font-medium">{f.home_team_name}</span>
                      <span className="text-gray-600 mx-1.5">vs</span>
                      <span>{f.away_team_name}</span>
                    </span>
                    <span className="text-xs text-gray-600 hidden sm:block shrink-0">{f.venue}</span>
                    {!adjustMode && (
                      <>
                        <button onClick={() => setEditingId(f.match_id)}
                          className="text-xs text-blue-400 hover:text-blue-300 shrink-0">Edit</button>
                        <button onClick={() => handleDelete(f.match_id)} disabled={deleting === f.match_id}
                          className="text-xs text-red-500 hover:text-red-400 disabled:opacity-50 shrink-0">
                          {deleting === f.match_id ? '…' : 'Del'}
                        </button>
                      </>
                    )}
                    {adjustMode && selectedFixtureId === f.match_id && (
                      <span className="text-xs text-amber-400 shrink-0">selected</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEPS = ['Season', 'Teams', 'Fixtures', 'Launch']

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((label, idx) => {
        const n = idx + 1
        const active = n === current
        const done = n < current
        return (
          <div key={n} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                ${done ? 'bg-green-600 text-white' : active ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'}`}>
                {done ? '✓' : n}
              </div>
              <span className={`text-xs mt-1 ${active ? 'text-white' : 'text-gray-500'}`}>{label}</span>
            </div>
            {idx < STEPS.length - 1 && (
              <div className={`h-px w-12 mx-1 mb-4 ${n < current ? 'bg-green-600' : 'bg-gray-700'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Step 1: Season ───────────────────────────────────────────────────────────

function Step1Season({ onNext }: { onNext: () => void }) {
  const [season, setSeason] = useState<Season | null>(null)
  const [form, setForm] = useState({ start_date: '', end_date: '', break_start: '', break_end: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/admin/season')
      .then((r) => r.json())
      .then((data: Season) => {
        setSeason(data)
        setForm({
          start_date: data.start_date?.slice(0, 10) ?? '',
          end_date: data.end_date?.slice(0, 10) ?? '',
          break_start: data.break_start?.slice(0, 10) ?? '',
          break_end: data.break_end?.slice(0, 10) ?? '',
        })
      })
      .catch(() => setError('Failed to load season'))
  }, [])

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  async function handleSave() {
    if (!form.end_date) { setError('End date is required'); return }
    setSaving(true)
    setError('')
    const res = await fetch('/api/admin/season', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        start_date: form.start_date || null,
        end_date: form.end_date,
        break_start: form.break_start || null,
        break_end: form.break_end || null,
      }),
    })
    setSaving(false)
    if (!res.ok) { setError('Failed to save'); return }
    setSeason(await res.json())
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (!season) return <p className="text-gray-400">{error || 'Loading…'}</p>

  return (
    <div className="max-w-md">
      <h2 className="text-xl font-semibold mb-1">Step 1 — Season</h2>
      <p className="text-gray-400 text-sm mb-6">Edit the season dates. These drive the calendar and auto-schedule.</p>

      <div className="bg-gray-900 rounded-lg p-5 space-y-4 mb-6">
        <Row label="Season">{season.season_name}</Row>
        <Row label="Status">
          <span className={season.status === 'active' ? 'text-green-400' : season.status === 'complete' ? 'text-blue-400' : 'text-yellow-400'}>
            {season.status}
          </span>
        </Row>
        <div className="border-t border-gray-800 pt-4 space-y-3">
          <DateField label="Start date" value={form.start_date} onChange={set('start_date')} />
          <DateField label="Break start" value={form.break_start} onChange={set('break_start')} optional />
          <DateField label="Break end" value={form.break_end} onChange={set('break_end')} optional />
          <DateField label="End date" value={form.end_date} onChange={set('end_date')} />
        </div>
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      <div className="flex justify-between">
        <button onClick={handleSave} disabled={saving}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded font-medium text-sm">
          {saving ? 'Saving…' : saved ? 'Saved!' : 'Save dates'}
        </button>
        <button onClick={onNext} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 rounded font-medium">
          Next: Teams →
        </button>
      </div>
    </div>
  )
}

function DateField({
  label, value, onChange, optional,
}: {
  label: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  optional?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-gray-400 text-sm shrink-0">
        {label} {optional && <span className="text-gray-600 text-xs">(optional)</span>}
      </span>
      <input
        type="date"
        value={value}
        onChange={onChange}
        className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white"
      />
    </div>
  )
}

// ─── Step 2: Team naming + draft order ───────────────────────────────────────

const TEAM_ORDER_KEY = (seasonId: string) => `ufa_team_order_${seasonId}`

function Step2Teams({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const [teams, setTeams] = useState<Team[]>([])
  // orderedIds drives display order and is the value persisted to localStorage
  const [orderedIds, setOrderedIds] = useState<string[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadTeams = useCallback(() => {
    fetch('/api/admin/teams')
      .then((r) => r.json())
      .then((data: Team[]) => {
        setTeams(data)
        if (data.length === 0) return
        const seasonId = data[0].season_id
        try {
          const stored = localStorage.getItem(TEAM_ORDER_KEY(seasonId))
          if (stored) {
            const order: string[] = JSON.parse(stored)
            // Only use stored order if every team_id is still present
            const valid = data.every((t) => order.includes(t.team_id)) && order.length === data.length
            setOrderedIds(valid ? order : data.map((t) => t.team_id))
          } else {
            setOrderedIds(data.map((t) => t.team_id))
          }
        } catch {
          setOrderedIds(data.map((t) => t.team_id))
        }
      })
      .catch(() => setError('Failed to load teams'))
  }, [])

  useEffect(() => { loadTeams() }, [loadTeams])

  // Sorted view — derived from orderedIds
  const sortedTeams = orderedIds
    .map((id) => teams.find((t) => t.team_id === id))
    .filter((t): t is Team => !!t)

  function moveTeam(idx: number, dir: -1 | 1) {
    const swap = idx + dir
    if (swap < 0 || swap >= orderedIds.length) return
    const next = [...orderedIds]
    ;[next[idx], next[swap]] = [next[swap], next[idx]]
    setOrderedIds(next)
    const seasonId = teams[0]?.season_id
    if (seasonId) localStorage.setItem(TEAM_ORDER_KEY(seasonId), JSON.stringify(next))
  }

  async function saveEdit(teamId: string) {
    if (!editValue.trim()) return
    setSaving(true)
    setError('')
    const res = await fetch(`/api/admin/teams/${teamId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team_name: editValue.trim() }),
    })
    setSaving(false)
    if (!res.ok) { setError('Failed to save'); return }
    const updated = await res.json()
    setTeams((prev) => prev.map((t) => (t.team_id === teamId ? { ...t, team_name: updated.team_name } : t)))
    setEditingId(null)
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-semibold mb-1">Step 2 — Teams</h2>
      <p className="text-gray-400 text-sm mb-1">Rename teams and set the draft order. The auto-scheduler uses this order to assign home/away pairings.</p>
      <p className="text-gray-600 text-xs mb-6">Use the ▲ ▼ arrows to reorder. Order is saved automatically.</p>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      <div className="space-y-3 mb-6">
        {sortedTeams.map((team, idx) => (
          <div key={team.team_id} className="bg-gray-900 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              {/* Draft position + reorder buttons */}
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-gray-600 text-xs font-mono w-4 text-right">{idx + 1}</span>
                <div className="flex flex-col">
                  <button
                    onClick={() => moveTeam(idx, -1)}
                    disabled={idx === 0}
                    className="text-gray-500 hover:text-white disabled:opacity-20 leading-none px-0.5"
                    title="Move up"
                  >▲</button>
                  <button
                    onClick={() => moveTeam(idx, 1)}
                    disabled={idx === sortedTeams.length - 1}
                    className="text-gray-500 hover:text-white disabled:opacity-20 leading-none px-0.5"
                    title="Move down"
                  >▼</button>
                </div>
              </div>

              {/* Team name / rename */}
              {editingId === team.team_id ? (
                <>
                  <input autoFocus value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(team.team_id); if (e.key === 'Escape') setEditingId(null) }}
                    onBlur={() => saveEdit(team.team_id)}
                    className="bg-gray-800 border border-blue-500 rounded px-2 py-1 text-white font-semibold flex-1" />
                  <button onClick={() => saveEdit(team.team_id)} disabled={saving}
                    className="text-sm px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded">
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={() => setEditingId(null)} className="text-sm px-2 py-1 text-gray-400 hover:text-white">
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <span className="font-semibold flex-1">{team.team_name}</span>
                  <button onClick={() => { setEditingId(team.team_id); setEditValue(team.team_name) }}
                    className="text-sm text-blue-400 hover:text-blue-300">Rename</button>
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-1 pl-10">
              {team.players.map((p) => (
                <span key={p.player_id} className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded-full">
                  {p.display_name}
                </span>
              ))}
              {team.players.length === 0 && <span className="text-xs text-gray-600">No players</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-between">
        <button onClick={onBack} className="px-5 py-2 bg-gray-700 hover:bg-gray-600 rounded font-medium">← Back</button>
        <button onClick={onNext} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 rounded font-medium">Next: Fixtures →</button>
      </div>
    </div>
  )
}

// ─── Step 3: Fixture management ───────────────────────────────────────────────

const DEFAULT_VENUE = 'Vilimale Turf'

function Step3Fixtures({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const [teams, setTeams] = useState<Team[]>([])
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [season, setSeason] = useState<Season | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  // New fixture form
  const [homeTeamId, setHomeTeamId] = useState('')
  const [awayTeamId, setAwayTeamId] = useState('')
  const [kickoff, setKickoff] = useState(toDatetimeLocal(nextGameDay()))
  const [venue, setVenue] = useState(DEFAULT_VENUE)
  const [matchweek, setMatchweek] = useState(1)
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [lastCreated, setLastCreated] = useState('')

  // Public holiday ranges (persisted in localStorage keyed by season)
  const [holidays, setHolidays] = useState<HolidayRange[]>([])
  const [holidayForm, setHolidayForm] = useState({ start: '', end: '', name: '' })

  // Auto-schedule
  const [scheduling, setScheduling] = useState(false)
  const [schedProgress, setSchedProgress] = useState<{ n: number; total: number } | null>(null)
  const [schedError, setSchedError] = useState('')

  // Adjust mode
  const [adjustMode, setAdjustMode] = useState(false)
  const [selectedFixtureId, setSelectedFixtureId] = useState<string | null>(null)
  const [moving, setMoving] = useState(false)
  const [moveError, setMoveError] = useState('')

  const formRef = useRef<HTMLDivElement>(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const [tr, fr, sr] = await Promise.all([
        fetch('/api/admin/teams'),
        fetch('/api/admin/fixtures'),
        fetch('/api/admin/season'),
      ])
      if (!tr.ok || !fr.ok || !sr.ok) {
        const failed = [
          !tr.ok && 'teams',
          !fr.ok && 'fixtures',
          !sr.ok && 'season',
        ].filter(Boolean).join(', ')
        setLoadError(`Failed to load ${failed} — check DB connection and try again.`)
        setLoading(false)
        return
      }
      const [teamsData, fixturesData, seasonData]: [Team[], Fixture[], Season] = await Promise.all([
        tr.json(), fr.json(), sr.json(),
      ])
      // Apply draft order saved in Step 2
      try {
        const stored = localStorage.getItem(TEAM_ORDER_KEY(seasonData.season_id))
        if (stored) {
          const order: string[] = JSON.parse(stored)
          teamsData.sort((a, b) => {
            const ai = order.indexOf(a.team_id)
            const bi = order.indexOf(b.team_id)
            if (ai === -1) return 1
            if (bi === -1) return -1
            return ai - bi
          })
        }
      } catch { /* ignore */ }
      setTeams(teamsData)
      setFixtures(fixturesData)
      setSeason(seasonData)
      if (teamsData.length >= 2) {
        setHomeTeamId((prev) => prev || teamsData[0].team_id)
        setAwayTeamId((prev) => prev || teamsData[1].team_id)
      }
      if (fixturesData.length > 0) {
        setMatchweek(Math.max(...fixturesData.map((f) => f.matchweek)) + 1)
      }
    } catch (err) {
      setLoadError(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`)
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // Load/save holiday ranges from localStorage, keyed by season_id
  useEffect(() => {
    if (!season?.season_id) return
    try {
      const stored = localStorage.getItem(`ufa_holidays_${season.season_id}`)
      if (stored) {
        const parsed = JSON.parse(stored)
        // Backward compat: old format was string[]
        if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'string') {
          setHolidays(
            (parsed as string[]).map((d) => ({
              id: `legacy-${d}`,
              start: d,
              end: d,
              name: d,
            }))
          )
        } else {
          setHolidays(parsed as HolidayRange[])
        }
      }
    } catch { /* ignore corrupt localStorage */ }
  }, [season?.season_id])

  useEffect(() => {
    if (!season?.season_id) return
    localStorage.setItem(`ufa_holidays_${season.season_id}`, JSON.stringify(holidays))
  }, [holidays, season?.season_id])

  function addHoliday() {
    const { start, end, name } = holidayForm
    if (!start || !end || !name.trim()) return
    if (end < start) return // silently ignore invalid range
    const newRange: HolidayRange = { id: `${start}-${end}-${Date.now()}`, start, end, name: name.trim() }
    setHolidays((prev) => [...prev, newRange].sort((a, b) => a.start.localeCompare(b.start)))
    setHolidayForm({ start: '', end: '', name: '' })
  }

  function removeHoliday(id: string) {
    setHolidays((prev) => prev.filter((h) => h.id !== id))
  }

  function fmtShortDate(dateStr: string): string {
    const [y, m, d] = dateStr.split('-').map(Number)
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
    })
  }

  function fmtHolidayRange(h: HolidayRange): string {
    if (h.start === h.end) return `${h.name} · ${fmtShortDate(h.start)}`
    return `${h.name} · ${fmtShortDate(h.start)} – ${fmtShortDate(h.end)}`
  }

  // ── Adjust mode ─────────────────────────────────────────────────────────────

  function toggleAdjustMode() {
    setAdjustMode((p) => !p)
    setSelectedFixtureId(null)
    setMoveError('')
  }

  function selectFixtureForAdjust(matchId: string) {
    setSelectedFixtureId((prev) => (prev === matchId ? null : matchId))
    setMoveError('')
  }

  async function handleMoveFixture(dateStr: string) {
    if (!selectedFixtureId) return
    const f = fixtures.find((fx) => fx.match_id === selectedFixtureId)
    if (!f) return
    setMoving(true)
    setMoveError('')
    const [y, m, d] = dateStr.split('-').map(Number)
    const res = await fetch(`/api/admin/fixtures/${selectedFixtureId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        home_team_id: f.home_team_id,
        away_team_id: f.away_team_id,
        kickoff_time: makeMVTKickoff(y, m, d),
        venue: f.venue,
        matchweek: f.matchweek,
      }),
    })
    setMoving(false)
    if (!res.ok) { setMoveError('Failed to move fixture'); return }
    const updated: Fixture[] = await fetch('/api/admin/fixtures').then((r) => r.json())
    setFixtures(updated)
    setSelectedFixtureId(null)
  }

  // ── Calendar date click — routes to form pre-fill or fixture move ────────────

  function handleCalendarDateClick(dateStr: string) {
    if (adjustMode && selectedFixtureId) {
      handleMoveFixture(dateStr)
    } else {
      setKickoff(`${dateStr}T20:30`)
      setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
    }
  }

  function preSelectPairing(homeTeam: Team, awayTeam: Team) {
    setHomeTeamId(homeTeam.team_id)
    setAwayTeamId(awayTeam.team_id)
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFormError('')
    if (homeTeamId === awayTeamId) { setFormError('Home and away teams must be different'); return }

    setSubmitting(true)
    const res = await fetch('/api/admin/fixtures', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        season_id: season?.season_id,
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        kickoff_time: toMVTIso(kickoff),
        venue,
        matchweek,
      }),
    })
    setSubmitting(false)
    if (!res.ok) { const d = await res.json(); setFormError(d.error ?? 'Failed to create'); return }

    const created: Fixture = await res.json()
    const home = teams.find((t) => t.team_id === homeTeamId)
    const away = teams.find((t) => t.team_id === awayTeamId)
    setLastCreated(`${home?.team_name ?? ''} vs ${away?.team_name ?? ''} — ${fmtKickoff(created.kickoff_time)}`)
    const updated: Fixture[] = await fetch('/api/admin/fixtures').then((r) => r.json())
    setFixtures(updated)
    setMatchweek((w) => w + 1)
  }

  async function handleAutoSchedule() {
    if (!season?.start_date || !season?.end_date) {
      setSchedError('Set season start and end dates in Step 1 first.')
      return
    }
    const gameDays = getSeasonGameDays(season.start_date, season.end_date, season.break_start, season.break_end, holidays)
    const rounds = generateSchedule(teams)

    const slotsNeeded = rounds.length * 2 - 1
    if (gameDays.length < slotsNeeded) {
      setSchedError(`Not enough game days: need ${slotsNeeded} Tue/Fri slots (1 rest between each matchweek), found ${gameDays.length}.`)
      return
    }

    const total = rounds.reduce((n, r) => n + r.length, 0)
    const confirmed = confirm(
      `This will delete all ${fixtures.length} existing fixtures and auto-schedule ${total} games across ${rounds.length} matchweeks. Continue?`
    )
    if (!confirmed) return

    setScheduling(true)
    setSchedError('')
    setSchedProgress({ n: 0, total })

    const delRes = await fetch('/api/admin/fixtures', { method: 'DELETE' })
    if (!delRes.ok) { setSchedError('Failed to clear fixtures'); setScheduling(false); return }

    let n = 0
    for (let i = 0; i < rounds.length; i++) {
      const gd = gameDays[i * 2]
      const mw = i + 1
      for (const [home, away] of rounds[i]) {
        const res = await fetch('/api/admin/fixtures', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            season_id: season.season_id,
            home_team_id: home.team_id,
            away_team_id: away.team_id,
            kickoff_time: makeMVTKickoff(gd.year, gd.month, gd.day),
            venue: DEFAULT_VENUE,
            matchweek: mw,
          }),
        })
        if (!res.ok) { setSchedError(`Error creating fixture ${n + 1}`); setScheduling(false); return }
        n++
        setSchedProgress({ n, total })
      }
    }

    const updated: Fixture[] = await fetch('/api/admin/fixtures').then((r) => r.json())
    setFixtures(updated)
    setMatchweek(rounds.length + 1)
    setScheduling(false)
    setSchedProgress(null)
  }

  if (loading) return <p className="text-gray-400">Loading…</p>
  if (loadError) return (
    <div className="space-y-3">
      <p className="text-red-400 text-sm">{loadError}</p>
      <button onClick={loadAll} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm font-medium">
        Retry
      </button>
    </div>
  )

  const gameDayCount = season?.start_date && season?.end_date
    ? getSeasonGameDays(season.start_date, season.end_date, season.break_start, season.break_end, holidays).length
    : 0
  const numRounds = teams.length > 0 ? generateSchedule(teams).length : 0
  const slotsNeeded = numRounds > 0 ? numRounds * 2 - 1 : 0
  const totalFixtures = numRounds * 2

  const selectedFixture = selectedFixtureId ? fixtures.find((f) => f.match_id === selectedFixtureId) ?? null : null

  return (
    <div className="max-w-5xl">
      <h2 className="text-xl font-semibold mb-1">Step 3 — Fixtures</h2>
      <p className="text-gray-400 text-sm mb-5">
        Auto-schedule all {totalFixtures} games across {numRounds} matchweeks, or add them individually. Click the matrix or calendar to pre-fill the form.
      </p>

      {/* Stats + auto-schedule */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex gap-4 text-sm text-gray-400">
          <span><span className="text-white font-semibold">{fixtures.length}</span> / {totalFixtures} fixtures</span>
          <span><span className="text-white font-semibold">{gameDayCount}</span> game days</span>
          <span>
            <span className={gameDayCount >= slotsNeeded ? 'text-green-400' : 'text-red-400'}>
              {gameDayCount >= slotsNeeded ? '✓' : '✗'}
            </span>
            {' '}{slotsNeeded} slots needed
          </span>
        </div>
        <button
          onClick={handleAutoSchedule}
          disabled={scheduling || teams.length === 0}
          className="ml-auto px-4 py-2 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 rounded font-medium text-sm"
        >
          {scheduling
            ? schedProgress ? `Creating ${schedProgress.n}/${schedProgress.total}…` : 'Clearing…'
            : 'Auto-schedule all'}
        </button>
      </div>
      {schedError && <p className="text-red-400 text-sm mb-4">{schedError}</p>}

      {/* Public holiday ranges */}
      <div className="bg-gray-900 rounded-lg p-4 mb-6">
        <p className="text-xs font-semibold text-gray-400 mb-3">
          Public Holidays{' '}
          <span className="text-gray-600 font-normal">(excluded from scheduling, shown in orange on calendar)</span>
        </p>
        {/* Add holiday range form */}
        <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end mb-3">
          <div>
            <label className="block text-[10px] text-gray-500 mb-0.5">Start date</label>
            <input
              type="date"
              value={holidayForm.start}
              onChange={(e) => setHolidayForm((f) => ({ ...f, start: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 mb-0.5">End date</label>
            <input
              type="date"
              value={holidayForm.end}
              min={holidayForm.start || undefined}
              onChange={(e) => setHolidayForm((f) => ({ ...f, end: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 mb-0.5">Name</label>
            <input
              type="text"
              placeholder="e.g. Eid al-Fitr"
              value={holidayForm.name}
              onChange={(e) => setHolidayForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white placeholder-gray-600"
            />
          </div>
          <button
            onClick={addHoliday}
            disabled={!holidayForm.start || !holidayForm.end || !holidayForm.name.trim() || holidayForm.end < holidayForm.start}
            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 rounded text-sm h-[30px]"
          >
            Add
          </button>
        </div>
        {holidays.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {holidays.map((h) => (
              <span
                key={h.id}
                className="flex items-center gap-1 bg-orange-950 border border-orange-800 text-orange-300 rounded-full px-2.5 py-0.5 text-xs"
              >
                {fmtHolidayRange(h)}
                <button onClick={() => removeHoliday(h.id)} className="hover:text-white ml-0.5" title="Remove">✕</button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-600 italic">No holidays added — all Tue/Fri slots within the season will be used.</p>
        )}
      </div>

      {/* Match matrix */}
      <div className="bg-gray-900 rounded-lg p-4 mb-6">
        <p className="text-xs font-semibold text-gray-400 mb-3">
          Match Matrix — click a cell to pre-fill the form below
        </p>
        {teams.length > 0
          ? <MatchMatrix teams={teams} fixtures={fixtures} onCellClick={preSelectPairing} />
          : <p className="text-gray-600 text-sm">No teams found.</p>
        }
      </div>

      {/* Calendar + new fixture form side by side */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Calendar */}
        <div className="bg-gray-900 rounded-lg p-4">
          <p className="text-xs font-semibold text-gray-400 mb-3">
            {adjustMode && selectedFixture
              ? 'Calendar — green dates are valid move targets'
              : 'Calendar — click a Tue/Fri to set that date in the form'}
          </p>
          {moving && <p className="text-amber-400 text-xs mb-2">Moving fixture…</p>}
          {moveError && <p className="text-red-400 text-xs mb-2">{moveError}</p>}
          {season?.start_date && season?.end_date
            ? (
              <CalendarView
                season={season}
                fixtures={fixtures}
                holidays={holidays}
                onDateClick={handleCalendarDateClick}
                adjustMode={adjustMode}
                selectedFixture={selectedFixture}
              />
            )
            : <p className="text-gray-600 text-sm">Set season dates in Step 1 to see the calendar.</p>
          }
        </div>

        {/* New fixture form */}
        <div ref={formRef} className="bg-gray-900 rounded-lg p-4">
          <p className="text-xs font-semibold text-gray-400 mb-3">New Fixture</p>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Home</label>
                <select value={homeTeamId} onChange={(e) => setHomeTeamId(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white">
                  {teams.map((t) => <option key={t.team_id} value={t.team_id}>{t.team_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Away</label>
                <select value={awayTeamId} onChange={(e) => setAwayTeamId(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white">
                  {teams.map((t) => <option key={t.team_id} value={t.team_id}>{t.team_name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Kickoff (MVT)</label>
              <input type="datetime-local" value={kickoff} onChange={(e) => setKickoff(e.target.value)} required
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Matchweek</label>
                <input type="number" min={1} value={matchweek} onChange={(e) => setMatchweek(Number(e.target.value))} required
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Venue</label>
                <input type="text" value={venue} onChange={(e) => setVenue(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white" />
              </div>
            </div>
            {formError && <p className="text-red-400 text-xs">{formError}</p>}
            {lastCreated && <p className="text-green-400 text-xs">Created: {lastCreated}</p>}
            <button type="submit" disabled={submitting}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded font-medium text-sm">
              {submitting ? 'Creating…' : 'Create Fixture'}
            </button>
          </form>
        </div>
      </div>

      {/* Fixture list */}
      <div className="bg-gray-900 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-400">
            Scheduled Fixtures ({fixtures.length})
          </p>
          <button
            onClick={toggleAdjustMode}
            className={[
              'px-3 py-1 text-xs rounded font-medium transition-colors',
              adjustMode
                ? 'bg-amber-600 hover:bg-amber-700 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300',
            ].join(' ')}
          >
            {adjustMode ? 'Exit Adjust Mode' : 'Adjust Mode'}
          </button>
        </div>
        {adjustMode && (
          <p className="text-xs text-amber-400 mb-3">
            {selectedFixture
              ? `Selected: ${selectedFixture.home_team_name} vs ${selectedFixture.away_team_name} — click a green date on the calendar to move it, or click the fixture again to deselect.`
              : 'Click a fixture to select it, then click a valid (green) date on the calendar to move it.'}
          </p>
        )}
        <FixtureList
          fixtures={fixtures}
          teams={teams}
          onFixtureUpdated={(updated) =>
            setFixtures((prev) => prev.map((f) => (f.match_id === updated.match_id ? updated : f)))
          }
          onFixtureDeleted={(id) => setFixtures((prev) => prev.filter((f) => f.match_id !== id))}
          adjustMode={adjustMode}
          selectedFixtureId={selectedFixtureId}
          onFixtureSelect={selectFixtureForAdjust}
        />
      </div>

      <div className="flex justify-between">
        <button onClick={onBack} className="px-5 py-2 bg-gray-700 hover:bg-gray-600 rounded font-medium">← Back</button>
        <button onClick={onNext} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 rounded font-medium">Next: Launch →</button>
      </div>
    </div>
  )
}

// ─── Step 4: Launch ───────────────────────────────────────────────────────────

function Step4Launch({ onBack }: { onBack: () => void }) {
  const [season, setSeason] = useState<Season | null>(null)
  const [teamCount, setTeamCount] = useState(0)
  const [playerCount, setPlayerCount] = useState(0)
  const [fixtureCount, setFixtureCount] = useState(0)
  const [launching, setLaunching] = useState(false)
  const [launched, setLaunched] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/season').then((r) => r.json()),
      fetch('/api/admin/teams').then((r) => r.json()),
      fetch('/api/admin/fixtures').then((r) => r.json()),
    ]).then(([s, teams, fixtures]) => {
      setSeason(s)
      setTeamCount(teams.length)
      setPlayerCount(teams.reduce((n: number, t: Team) => n + t.players.length, 0))
      setFixtureCount(fixtures.length)
      if (s.status === 'active') setLaunched(true)
    })
  }, [])

  async function handleGoLive() {
    setLaunching(true)
    setError('')
    const res = await fetch('/api/admin/season/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    })
    setLaunching(false)
    if (!res.ok) { setError('Failed to go live'); return }
    setSeason(await res.json())
    setLaunched(true)
  }

  return (
    <div className="max-w-lg">
      <h2 className="text-xl font-semibold mb-1">Step 4 — Launch</h2>
      <p className="text-gray-400 text-sm mb-6">Review the summary and go live when ready.</p>

      <div className="bg-gray-900 rounded-lg p-5 mb-6 space-y-3">
        {season && <Row label="Season">{season.season_name}</Row>}
        <Row label="Status">
          <span className={season?.status === 'active' ? 'text-green-400 font-semibold' : 'text-yellow-400'}>
            {season?.status ?? '…'}
          </span>
        </Row>
        <Row label="Teams">{teamCount}</Row>
        <Row label="Players">{playerCount}</Row>
        <Row label="Fixtures scheduled">{fixtureCount}</Row>
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {launched ? (
        <div className="text-center py-6">
          <p className="text-green-400 font-semibold text-lg mb-4">League is live!</p>
          <Link href="/admin/dashboard" className="inline-block px-5 py-2 bg-blue-600 hover:bg-blue-700 rounded font-medium">
            Go to Dashboard
          </Link>
        </div>
      ) : (
        <div className="flex justify-between">
          <button onClick={onBack} className="px-5 py-2 bg-gray-700 hover:bg-gray-600 rounded font-medium">← Back</button>
          <button onClick={handleGoLive} disabled={launching}
            className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded font-semibold">
            {launching ? 'Going live…' : 'Go Live'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Shared ───────────────────────────────────────────────────────────────────

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-gray-400 text-sm shrink-0">{label}</span>
      <span className="text-sm text-right">{children}</span>
    </div>
  )
}

// ─── Wizard ───────────────────────────────────────────────────────────────────

export default function SetupPage() {
  const [step, setStep] = useState(1)

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="border-b border-gray-800 px-8 py-5 flex items-center justify-between">
        <Link href="/admin/dashboard" className="text-gray-400 hover:text-white text-sm">← Dashboard</Link>
        <h1 className="text-lg font-bold">Season Setup Wizard</h1>
        <span className="text-sm text-gray-500">Step {step} of 4</span>
      </div>
      <div className="px-8 pt-8 pb-4">
        <StepIndicator current={step} />
      </div>
      <div className="px-8 pb-16">
        {step === 1 && <Step1Season onNext={() => setStep(2)} />}
        {step === 2 && <Step2Teams onNext={() => setStep(3)} onBack={() => setStep(1)} />}
        {step === 3 && <Step3Fixtures onNext={() => setStep(4)} onBack={() => setStep(2)} />}
        {step === 4 && <Step4Launch onBack={() => setStep(3)} />}
      </div>
    </div>
  )
}
