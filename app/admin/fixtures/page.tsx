'use client'

import { useState, useEffect, useCallback } from 'react'
import AdminNav from '@/app/_components/AdminNav'
import { makeMVTKickoff } from '@/lib/schedule'
import {
  type Season,
  type Fixture,
  type HolidayRange,
  buildHolidaySet,
  getFixtureMVTDate,
  fmtKickoff,
} from '@/lib/fixtureUtils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CascadeRow {
  match_id: string
  home_team_name: string
  away_team_name: string
  original_date: string   // YYYY-MM-DD
  proposed_date: string   // YYYY-MM-DD
  flag: 'ok' | 'holiday-adjusted' | 'conflict' | 'out-of-bounds'
  override?: string       // YYYY-MM-DD if admin overrode
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

/** Parse a YYYY-MM-DD string to UTC epoch ms. */
function parseDate(s: string): number {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

/** Format epoch ms as YYYY-MM-DD. */
function msToDateStr(ms: number): string {
  const d = new Date(ms)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

/** Day-of-week (UTC) for a YYYY-MM-DD string: 0=Sun,1=Mon,2=Tue,5=Fri */
function dow(dateStr: string): number {
  return new Date(parseDate(dateStr)).getUTCDay()
}

/** Returns true if dateStr is a Tuesday (2) or Friday (5). */
function isTueFri(dateStr: string): boolean {
  const d = dow(dateStr)
  return d === 2 || d === 5
}

/**
 * Returns the next Tuesday or Friday on or after startMs (UTC epoch ms).
 * If startMs itself is Tue/Fri, returns it.
 */
function nextTueFriOnOrAfter(startMs: number): number {
  let ms = startMs
  while (true) {
    const d = new Date(ms).getUTCDay()
    if (d === 2 || d === 5) return ms
    ms += 86_400_000
  }
}

/**
 * Returns the next Tuesday or Friday STRICTLY AFTER startMs (UTC epoch ms).
 */
function nextTueFriAfter(startMs: number): number {
  return nextTueFriOnOrAfter(startMs + 86_400_000)
}

/**
 * Advance a proposed date past any holidays, returning the first Tue/Fri
 * that is not in the holidaySet. Advances one slot (nextTueFriAfter) each time.
 */
function advancePastHolidays(dateStr: string, holidaySet: Set<string>): { date: string; adjusted: boolean } {
  let ms = parseDate(dateStr)
  let adjusted = false
  while (holidaySet.has(msToDateStr(ms))) {
    ms = nextTueFriAfter(ms)
    adjusted = true
  }
  return { date: msToDateStr(ms), adjusted }
}

/**
 * Check if placing a fixture on proposedDate creates a same-day conflict
 * for either team, given the rest of the schedule (all fixtures with their
 * FINAL dates, keyed by team_id → Set<dateStr>).
 */
function hasConflict(
  proposedDate: string,
  homeTeamId: string,
  awayTeamId: string,
  matchId: string,
  teamSchedule: Map<string, Map<string, string>>  // teamId → matchId → dateStr
): boolean {
  for (const teamId of [homeTeamId, awayTeamId]) {
    const schedule = teamSchedule.get(teamId)
    if (!schedule) continue
    for (const [mid, dateStr] of schedule.entries()) {
      if (mid === matchId) continue
      if (dateStr === proposedDate) return true
    }
  }
  return false
}

/** Format a YYYY-MM-DD date string for display: e.g. "Tue 10 Mar" */
function fmtShortDate(dateStr: string): string {
  const ms = parseDate(dateStr)
  return new Date(ms).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

// ─── Cascade computation ──────────────────────────────────────────────────────

function computeCascade(
  postponedFixture: Fixture,
  newDate: string,
  allFixtures: Fixture[],
  holidays: HolidayRange[],
  season: Season
): CascadeRow[] {
  const holidaySet = buildHolidaySet(holidays)
  const endDate = season.end_date.slice(0, 10)

  // Build the postponed match's original date
  const postponedOriginalDate = getFixtureMVTDate(postponedFixture.kickoff_time)

  // Identify affected fixtures: fixtures for either team that are AFTER the
  // postponed match's original kickoff time, and are still scheduled.
  const affected = allFixtures
    .filter((f) =>
      f.match_id !== postponedFixture.match_id &&
      f.status === 'scheduled' &&
      (f.home_team_id === postponedFixture.home_team_id ||
        f.home_team_id === postponedFixture.away_team_id ||
        f.away_team_id === postponedFixture.home_team_id ||
        f.away_team_id === postponedFixture.away_team_id) &&
      getFixtureMVTDate(f.kickoff_time) > postponedOriginalDate
    )
    .sort((a, b) => a.kickoff_time.localeCompare(b.kickoff_time))

  // Build a live schedule for tracking final dates per team per match.
  // Initialise with all scheduled fixtures at their CURRENT dates, excluding
  // those we will recompute.
  const affectedIds = new Set(affected.map((f) => f.match_id))
  affectedIds.add(postponedFixture.match_id)

  // teamSchedule: teamId → Map<matchId, dateStr>
  const teamSchedule = new Map<string, Map<string, string>>()

  function registerDate(teamId: string, matchId: string, dateStr: string) {
    if (!teamSchedule.has(teamId)) teamSchedule.set(teamId, new Map())
    teamSchedule.get(teamId)!.set(matchId, dateStr)
  }

  // Add all non-affected fixtures
  for (const f of allFixtures) {
    if (affectedIds.has(f.match_id)) continue
    const d = getFixtureMVTDate(f.kickoff_time)
    registerDate(f.home_team_id, f.match_id, d)
    registerDate(f.away_team_id, f.match_id, d)
  }

  // Add the postponed match at its new date
  registerDate(postponedFixture.home_team_id, postponedFixture.match_id, newDate)
  registerDate(postponedFixture.away_team_id, postponedFixture.match_id, newDate)

  // Compute proposed dates for affected fixtures in order
  const rows: CascadeRow[] = []

  for (const f of affected) {
    const currentDate = getFixtureMVTDate(f.kickoff_time)
    // Proposed: next Tue/Fri AFTER the current date (one slot forward)
    const currentMs = parseDate(currentDate)
    const rawProposedMs = nextTueFriAfter(currentMs)

    // Holiday check
    let { date: proposedDate, adjusted } = advancePastHolidays(msToDateStr(rawProposedMs), holidaySet)

    // Out-of-bounds check
    let flag: CascadeRow['flag'] = 'ok'
    if (proposedDate > endDate) {
      flag = 'out-of-bounds'
    } else if (hasConflict(proposedDate, f.home_team_id, f.away_team_id, f.match_id, teamSchedule)) {
      flag = 'conflict'
    } else if (adjusted) {
      flag = 'holiday-adjusted'
    }

    // Register in schedule for subsequent conflict checks
    registerDate(f.home_team_id, f.match_id, proposedDate)
    registerDate(f.away_team_id, f.match_id, proposedDate)

    rows.push({
      match_id: f.match_id,
      home_team_name: f.home_team_name,
      away_team_name: f.away_team_name,
      original_date: currentDate,
      proposed_date: proposedDate,
      flag,
    })
  }

  return rows
}

// ─── Re-check a single row ────────────────────────────────────────────────────

function recheckRow(
  row: CascadeRow,
  fixture: Fixture,
  proposedDate: string,
  allRows: CascadeRow[],
  allFixtures: Fixture[],
  holidays: HolidayRange[],
  season: Season,
  postponedFixture: Fixture,
  newDateForPostponed: string
): CascadeRow {
  const holidaySet = buildHolidaySet(holidays)
  const endDate = season.end_date.slice(0, 10)

  // Build team schedule from allFixtures + already-determined rows (excluding this row)
  const teamSchedule = new Map<string, Map<string, string>>()

  function reg(teamId: string, matchId: string, dateStr: string) {
    if (!teamSchedule.has(teamId)) teamSchedule.set(teamId, new Map())
    teamSchedule.get(teamId)!.set(matchId, dateStr)
  }

  // Affected match IDs: rows + postponed fixture
  const affectedIds = new Set(allRows.map((r) => r.match_id))
  affectedIds.add(postponedFixture.match_id)

  // Non-affected fixtures at their original dates
  for (const f of allFixtures) {
    if (affectedIds.has(f.match_id)) continue
    reg(f.home_team_id, f.match_id, getFixtureMVTDate(f.kickoff_time))
    reg(f.away_team_id, f.match_id, getFixtureMVTDate(f.kickoff_time))
  }

  // Add postponed fixture at its new date
  reg(postponedFixture.home_team_id, postponedFixture.match_id, newDateForPostponed)
  reg(postponedFixture.away_team_id, postponedFixture.match_id, newDateForPostponed)

  // Add OTHER cascade rows at their current proposed/override dates (not this row)
  for (const r of allRows) {
    if (r.match_id === row.match_id) continue
    const fx = allFixtures.find((f) => f.match_id === r.match_id)!
    const d = r.override ?? r.proposed_date
    reg(fx.home_team_id, r.match_id, d)
    reg(fx.away_team_id, r.match_id, d)
  }

  let flag: CascadeRow['flag'] = 'ok'

  if (proposedDate > endDate) {
    flag = 'out-of-bounds'
  } else if (hasConflict(proposedDate, fixture.home_team_id, fixture.away_team_id, fixture.match_id, teamSchedule)) {
    flag = 'conflict'
  } else if (holidaySet.has(proposedDate)) {
    flag = 'holiday-adjusted'
  }

  return { ...row, proposed_date: proposedDate, flag, override: proposedDate }
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function FixturesPage() {
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [season, setSeason] = useState<Season | null>(null)
  const [holidays, setHolidays] = useState<HolidayRange[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  // Stage 1: selected fixture
  const [selectedFixture, setSelectedFixture] = useState<Fixture | null>(null)

  // Stage 2: new date input
  const [newDate, setNewDate] = useState('')
  const [dateError, setDateError] = useState('')

  // Stage 3: cascade
  const [cascadeRows, setCascadeRows] = useState<CascadeRow[] | null>(null)

  // Confirm state
  const [confirming, setConfirming] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [confirmError, setConfirmError] = useState('')

  const loadAll = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const [fr, sr] = await Promise.all([
        fetch('/api/admin/fixtures'),
        fetch('/api/admin/season'),
      ])
      if (!fr.ok || !sr.ok) {
        setLoadError('Failed to load fixtures or season data.')
        setLoading(false)
        return
      }
      const [fixturesData, seasonData]: [Fixture[], Season] = await Promise.all([
        fr.json(), sr.json(),
      ])
      // Load holidays
      const hrRes = await fetch(`/api/admin/holidays?seasonId=${seasonData.season_id}`)
      if (hrRes.ok) {
        const hrData = await hrRes.json()
        setHolidays(hrData.map((h: { holiday_id: string; start_date: string; end_date: string; name: string }) => ({
          id: h.holiday_id,
          start: h.start_date,
          end: h.end_date,
          name: h.name,
        })))
      }
      setFixtures(fixturesData)
      setSeason(seasonData)
    } catch (err) {
      setLoadError(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`)
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // Scheduled (unplayed) fixtures only
  const scheduledFixtures = fixtures.filter((f) => f.status === 'scheduled')

  // Group by matchweek
  const byMW = new Map<number, Fixture[]>()
  for (const f of [...scheduledFixtures].sort((a, b) => {
    if (a.matchweek !== b.matchweek) return a.matchweek - b.matchweek
    return a.kickoff_time.localeCompare(b.kickoff_time)
  })) {
    if (!byMW.has(f.matchweek)) byMW.set(f.matchweek, [])
    byMW.get(f.matchweek)!.push(f)
  }

  function handleSelectFixture(f: Fixture) {
    setSelectedFixture(f)
    setNewDate('')
    setDateError('')
    setCascadeRows(null)
    setSuccessMsg('')
    setConfirmError('')
  }

  function handleChangeMatch() {
    setSelectedFixture(null)
    setNewDate('')
    setDateError('')
    setCascadeRows(null)
  }

  function handleStartOver() {
    setSelectedFixture(null)
    setNewDate('')
    setDateError('')
    setCascadeRows(null)
    setSuccessMsg('')
    setConfirmError('')
  }

  function handleDateChange(value: string) {
    setNewDate(value)
    if (!value) { setDateError(''); setCascadeRows(null); return }
    if (!isTueFri(value)) {
      setDateError('Game days are Tuesdays and Fridays only')
      setCascadeRows(null)
    } else {
      setDateError('')
      if (selectedFixture && season) {
        setCascadeRows(computeCascade(selectedFixture, value, fixtures, holidays, season))
      }
    }
  }

  function handleRowOverride(rowIdx: number, value: string) {
    if (!cascadeRows || !selectedFixture || !season) return
    const row = cascadeRows[rowIdx]
    const fixture = fixtures.find((f) => f.match_id === row.match_id)
    if (!fixture) return

    const updated = [...cascadeRows]
    if (!value) {
      // Clear override — revert to computed proposed_date
      updated[rowIdx] = { ...row, override: undefined }
      setCascadeRows(updated)
      return
    }

    // Auto-correct non-game-days to next Tue/Fri
    const corrected = isTueFri(value)
      ? value
      : msToDateStr(nextTueFriOnOrAfter(parseDate(value)))

    const reChecked = recheckRow(
      row,
      fixture,
      corrected,
      updated,
      fixtures,
      holidays,
      season,
      selectedFixture,
      newDate
    )
    updated[rowIdx] = reChecked
    setCascadeRows(updated)
  }

  async function handleConfirm() {
    if (!selectedFixture || !cascadeRows || !newDate) return
    setConfirming(true)
    setConfirmError('')

    // Build updates array: postponed match + cascade rows
    const [y, m, d] = newDate.split('-').map(Number)
    const postponedKickoff = makeMVTKickoff(y, m, d)

    const updates: { match_id: string; kickoff_time: string }[] = [
      { match_id: selectedFixture.match_id, kickoff_time: postponedKickoff },
      ...cascadeRows.map((row) => {
        const finalDate = row.override ?? row.proposed_date
        const [ry, rm, rd] = finalDate.split('-').map(Number)
        return { match_id: row.match_id, kickoff_time: makeMVTKickoff(ry, rm, rd) }
      }),
    ]

    const res = await fetch('/api/admin/fixtures/bulk', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates }),
    })

    setConfirming(false)
    if (!res.ok) {
      const err = await res.json()
      setConfirmError(err.error ?? 'Failed to update fixtures')
      return
    }

    const { updated } = await res.json()
    setSuccessMsg(`Schedule updated — ${updated} fixture${updated === 1 ? '' : 's'} rescheduled.`)
    // Reset and reload
    setSelectedFixture(null)
    setNewDate('')
    setDateError('')
    setCascadeRows(null)
    await loadAll()
  }

  const canConfirmSimple =
    cascadeRows !== null &&
    cascadeRows.every((row) => row.flag !== 'conflict' && row.flag !== 'out-of-bounds')

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <AdminNav />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-1">Fixture Wizard</h1>
        <p className="text-gray-400 text-sm mb-6">
          Postpone a match and cascade-reschedule all affected downstream fixtures for both teams.
        </p>

        {successMsg && (
          <div className="mb-6 rounded-lg bg-green-900/40 border border-green-700 px-4 py-3 text-green-300 text-sm">
            {successMsg}
          </div>
        )}

        {loading && <p className="text-gray-400">Loading…</p>}
        {loadError && (
          <div className="space-y-3">
            <p className="text-red-400 text-sm">{loadError}</p>
            <button onClick={loadAll} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm">
              Retry
            </button>
          </div>
        )}

        {!loading && !loadError && (
          <>
            {/* ── Stage 1: Match selection ── */}
            <div className="bg-gray-900 rounded-xl p-5 mb-5">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
                1 · Select match to postpone
              </h2>

              {scheduledFixtures.length === 0 ? (
                <p className="text-gray-500 text-sm italic">
                  No scheduled fixtures — nothing to postpone.
                </p>
              ) : (
                <div className="space-y-4">
                  {[...byMW.entries()].sort(([a], [b]) => a - b).map(([mw, mwFixtures]) => (
                    <div key={mw}>
                      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                        Matchweek {mw}
                      </p>
                      <div className="space-y-1">
                        {mwFixtures.map((f) => (
                          <div
                            key={f.match_id}
                            onClick={() => handleSelectFixture(f)}
                            className={[
                              'flex items-center gap-2 rounded px-3 py-2.5 text-sm cursor-pointer transition-colors',
                              selectedFixture?.match_id === f.match_id
                                ? 'bg-amber-900/50 ring-1 ring-inset ring-amber-600'
                                : 'bg-gray-800 hover:bg-gray-700',
                            ].join(' ')}
                          >
                            <span className="text-xs text-gray-500 w-32 shrink-0">
                              {fmtKickoff(f.kickoff_time)}
                            </span>
                            <span className="flex-1 min-w-0 truncate">
                              <span className="font-medium">{f.home_team_name}</span>
                              <span className="text-gray-500 mx-1.5">vs</span>
                              <span>{f.away_team_name}</span>
                            </span>
                            {selectedFixture?.match_id === f.match_id && (
                              <span className="text-xs text-amber-400 shrink-0">selected</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Stage 2: New date input ── */}
            {selectedFixture && (
              <div className="bg-gray-900 rounded-xl p-5 mb-5">
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
                  2 · Choose new date
                </h2>

                <div className="mb-4 p-3 bg-gray-800 rounded-lg">
                  <p className="text-xs text-gray-500 mb-0.5">Postponing</p>
                  <p className="font-semibold">
                    {selectedFixture.home_team_name} vs {selectedFixture.away_team_name}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    currently {fmtKickoff(selectedFixture.kickoff_time)}
                  </p>
                </div>

                <div className="mb-3">
                  <label className="block text-xs text-gray-400 mb-1">
                    New date (agreed by both captains)
                  </label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => handleDateChange(e.target.value)}
                    className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white w-full max-w-xs"
                  />
                  {dateError && (
                    <p className="text-red-400 text-xs mt-1">{dateError}</p>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  <button
                    onClick={handleChangeMatch}
                    className="text-sm text-gray-400 hover:text-white"
                  >
                    Change match
                  </button>
                </div>
              </div>
            )}

            {/* ── Stage 3: Cascade preview ── */}
            {cascadeRows !== null && selectedFixture && season && (
              <div className="bg-gray-900 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
                  3 · Cascade preview
                </h2>

                <p className="text-sm text-gray-300 mb-4">
                  This postponement affects{' '}
                  <span className="font-semibold text-white">{cascadeRows.length}</span>{' '}
                  downstream fixture{cascadeRows.length === 1 ? '' : 's'} across both teams.
                </p>

                <div className="overflow-x-auto mb-6">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="text-[10px] text-gray-500 uppercase tracking-wider">
                        <th className="text-left pb-2 pr-3">Match</th>
                        <th className="text-left pb-2 pr-3">Original date</th>
                        <th className="text-left pb-2 pr-3">New date</th>
                        <th className="text-left pb-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="space-y-1">
                      {/* Postponed match row */}
                      <tr className="bg-amber-900/30 rounded">
                        <td className="py-2 pr-3 pl-2 rounded-l">
                          <span className="font-medium">{selectedFixture.home_team_name}</span>
                          <span className="text-gray-500 mx-1">vs</span>
                          <span>{selectedFixture.away_team_name}</span>
                        </td>
                        <td className="py-2 pr-3 text-gray-400 text-xs">
                          {fmtShortDate(getFixtureMVTDate(selectedFixture.kickoff_time))}
                        </td>
                        <td className="py-2 pr-3 text-amber-300 text-xs font-medium">
                          {fmtShortDate(newDate)}
                        </td>
                        <td className="py-2 rounded-r">
                          <span className="text-xs text-amber-400">postponed</span>
                        </td>
                      </tr>

                      {/* Cascade rows */}
                      {cascadeRows.map((row, idx) => {
                        const effectiveDate = row.override ?? row.proposed_date
                        const isConflict = row.flag === 'conflict'
                        const isOutOfBounds = row.flag === 'out-of-bounds'
                        const isHolidayAdj = row.flag === 'holiday-adjusted'

                        return (
                          <tr
                            key={row.match_id}
                            className={[
                              'rounded',
                              isConflict || isOutOfBounds ? 'bg-red-900/40' : 'bg-gray-800/60',
                            ].join(' ')}
                          >
                            <td className="py-2 pr-3 pl-2 rounded-l">
                              <span className="font-medium">{row.home_team_name}</span>
                              <span className="text-gray-500 mx-1">vs</span>
                              <span>{row.away_team_name}</span>
                            </td>
                            <td className="py-2 pr-3 text-gray-400 text-xs">
                              {fmtShortDate(row.original_date)}
                            </td>
                            <td className="py-2 pr-3">
                              <input
                                type="date"
                                value={row.override ?? row.proposed_date}
                                onChange={(e) => handleRowOverride(idx, e.target.value)}
                                className={[
                                  'bg-gray-700 border rounded px-2 py-0.5 text-xs text-white w-36',
                                  isConflict || isOutOfBounds ? 'border-red-600' : 'border-gray-600',
                                ].join(' ')}
                              />
                            </td>
                            <td className="py-2 rounded-r text-xs">
                              {isConflict && (
                                <span className="text-red-400">
                                  Date conflict — override required
                                </span>
                              )}
                              {isOutOfBounds && (
                                <span className="text-red-400">
                                  Beyond season end
                                </span>
                              )}
                              {isHolidayAdj && !row.override && (
                                <span className="text-orange-400">
                                  holiday adjusted
                                </span>
                              )}
                              {row.flag === 'ok' && (
                                <span className="text-gray-600">—</span>
                              )}
                              {row.override && row.flag !== 'conflict' && row.flag !== 'out-of-bounds' && (
                                <span className="text-blue-400">overridden</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {confirmError && (
                  <p className="text-red-400 text-sm mb-4">{confirmError}</p>
                )}

                <div className="flex items-center gap-4">
                  <button
                    onClick={handleConfirm}
                    disabled={!canConfirmSimple || confirming}
                    className="px-5 py-2 bg-green-700 hover:bg-green-600 disabled:opacity-40 rounded font-medium text-sm"
                  >
                    {confirming ? 'Saving…' : 'Confirm all changes'}
                  </button>
                  <button
                    onClick={handleStartOver}
                    className="text-sm text-gray-400 hover:text-white"
                  >
                    Start over
                  </button>
                </div>

                {!canConfirmSimple && (
                  <p className="text-xs text-red-400 mt-2">
                    Resolve all conflicts and out-of-bounds rows before confirming.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
