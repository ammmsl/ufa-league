'use client'

import { useState, useEffect } from 'react'
import { kickoffToInput, toMVTIso } from '@/lib/schedule'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Season {
  season_id: string
  season_name: string
  start_date: string
  end_date: string
  break_start: string | null
  break_end: string | null
  status: string
}

export interface Player {
  player_id: string
  display_name: string
}

export interface Team {
  team_id: string
  team_name: string
  season_id: string
  players: Player[]
}

export interface Fixture {
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

export interface HolidayRange {
  id: string
  start: string  // YYYY-MM-DD
  end: string    // YYYY-MM-DD
  name: string
}

export interface GameDay {
  year: number
  month: number
  day: number
}

export interface DayCell {
  dateStr: string
  day: number
  dow: number
  inSeason: boolean
  inBreak: boolean
  isGameDay: boolean
  isHoliday: boolean
  fixtures: Fixture[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// ─── Schedule helpers ─────────────────────────────────────────────────────────

/**
 * Expands an array of holiday ranges into a flat Set of YYYY-MM-DD strings.
 */
export function buildHolidaySet(holidays: HolidayRange[]): Set<string> {
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
export function getSeasonGameDays(
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

// ─── Display helpers ──────────────────────────────────────────────────────────

export function abbrev(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 3)
}

export function fmtDate(utcIso: string): string {
  return new Date(new Date(utcIso).getTime() + 5 * 3600_000).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

export function fmtKickoff(utcIso: string): string {
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
export function getFixtureMVTDate(utcIso: string): string {
  const mvt = new Date(new Date(utcIso).getTime() + 5 * 3600_000)
  return `${mvt.getUTCFullYear()}-${String(mvt.getUTCMonth() + 1).padStart(2, '0')}-${String(mvt.getUTCDate()).padStart(2, '0')}`
}

/**
 * Returns true if moving `fixture` to `dateStr` would create a back-to-back
 * (adjacent game day, i.e. Tue↔Fri — always 3 or 4 calendar days apart) for
 * either of the fixture's teams.
 */
export function isBackToBack(dateStr: string, fixture: Fixture, allFixtures: Fixture[]): boolean {
  const parse = (s: string) => {
    const [y, m, d] = s.slice(0, 10).split('-').map(Number)
    return Date.UTC(y, m - 1, d)
  }
  const targetMs = parse(dateStr)
  const FOUR_DAYS_MS = 4 * 86_400_000
  for (const f of allFixtures) {
    if (f.match_id === fixture.match_id) continue
    if (
      f.home_team_id !== fixture.home_team_id &&
      f.home_team_id !== fixture.away_team_id &&
      f.away_team_id !== fixture.home_team_id &&
      f.away_team_id !== fixture.away_team_id
    ) continue
    const fMs = parse(getFixtureMVTDate(f.kickoff_time))
    const diff = Math.abs(fMs - targetMs)
    if (diff > 0 && diff <= FOUR_DAYS_MS) return true
  }
  return false
}

// ─── Calendar helpers ─────────────────────────────────────────────────────────

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

// ─── Calendar view ────────────────────────────────────────────────────────────

export function CalendarView({
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

                  const clickable =
                    adjustMode && selectedFixture
                      ? moveValidity === 'valid'
                      : cell.inSeason && !blocked && cell.isGameDay

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

// ─── Edit fixture inline form (used inside FixtureList) ───────────────────────

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

export function FixtureList({
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
