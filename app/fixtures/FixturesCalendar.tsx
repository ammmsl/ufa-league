'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Calendar as CalendarIcon,
  Users,
  ChevronLeft,
  ChevronRight,
  Info,
  Coffee,
  CalendarDays,
  LayoutGrid,
  List,
} from 'lucide-react'
import type { EnrichedFixture, HolidayRow } from './page'
import { TeamAvatar } from '../_components/Avatar'

// ─── Types ────────────────────────────────────────────────────────────────────

type Block = 'Block 1' | 'Block 2' | 'Block 3'
type StatusFilter = 'upcoming' | 'completed' | 'all'

type BufferEntry = {
  isBuffer: true
  date: string          // DD/MM/YYYY
  jsDate: Date
  originalDate: string  // start of range DD/MM/YYYY
  endDate: string       // end of range DD/MM/YYYY
  name: string
  isExpandedDay: boolean
}

type FixtureEntry = EnrichedFixture & {
  isBuffer: false
  jsDate: Date
  originalDate: string
  restDays?: number
  isPlaying?: boolean
}

type ScheduleEntry = BufferEntry | FixtureEntry

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS_TO_RENDER = [
  new Date(2026, 2, 1), // March
  new Date(2026, 3, 1), // April
  new Date(2026, 4, 1), // May
  new Date(2026, 5, 1), // June
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Parse DD/MM/YYYY string to JS Date */
function parseDate(s: string): Date {
  const [d, m, y] = s.split('/')
  return new Date(Number(y), Number(m) - 1, Number(d))
}

/** Format a YYYY-MM-DD date string to DD/MM/YYYY */
function fmtYMD(ymd: string): string {
  const [y, m, d] = ymd.split('-')
  return `${d}/${m}/${y}`
}

/** Block → Tailwind class for badges / card borders (readable on dark bg) */
function getBlockColors(block: Block | 'BUFFER'): string {
  if (block === 'BUFFER') return 'bg-red-900/60 border-red-700 text-red-300'
  switch (block) {
    case 'Block 1': return 'bg-blue-900/60 border-blue-700 text-blue-300'
    case 'Block 2': return 'bg-emerald-900/60 border-emerald-700 text-emerald-300'
    case 'Block 3': return 'bg-purple-900/60 border-purple-700 text-purple-300'
  }
}

/** Block → dot colour for mini calendar */
function getDotColor(block: Block | 'BUFFER'): string {
  if (block === 'BUFFER') return 'bg-red-500'
  switch (block) {
    case 'Block 1': return 'bg-blue-500'
    case 'Block 2': return 'bg-emerald-500'
    case 'Block 3': return 'bg-purple-500'
  }
}

// ─── Schedule builder ─────────────────────────────────────────────────────────

function buildSchedule(
  fixtures: EnrichedFixture[],
  holidays: HolidayRow[],
): ScheduleEntry[] {
  const entries: ScheduleEntry[] = []

  // Expand each holiday range into per-day buffer entries
  for (const h of holidays) {
    const startDate = parseDate(fmtYMD(h.start_date))
    const endDate   = parseDate(fmtYMD(h.end_date))
    const origFmt   = fmtYMD(h.start_date)
    const endFmt    = fmtYMD(h.end_date)
    let cur = new Date(startDate)
    while (cur <= endDate) {
      const d   = cur.getDate().toString().padStart(2, '0')
      const m   = (cur.getMonth() + 1).toString().padStart(2, '0')
      const y   = cur.getFullYear().toString()
      const fmt = `${d}/${m}/${y}`
      entries.push({
        isBuffer:      true,
        date:          fmt,
        jsDate:        new Date(cur),
        originalDate:  origFmt,
        endDate:       endFmt,
        name:          h.name,
        isExpandedDay: cur.getTime() !== startDate.getTime(),
      })
      cur.setDate(cur.getDate() + 1)
    }
  }

  // Add fixture entries
  for (const f of fixtures) {
    entries.push({
      ...f,
      isBuffer:     false,
      jsDate:       parseDate(f.date),
      originalDate: f.date,
    })
  }

  // Sort by date
  entries.sort((a, b) => a.jsDate.getTime() - b.jsDate.getTime())
  return entries
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FixturesCalendar({
  fixtures,
  teams,
  holidays,
}: {
  fixtures: EnrichedFixture[]
  teams: string[]
  holidays: HolidayRow[]
}) {
  const ALL = 'All Teams'
  const teamOptions = [ALL, ...teams.slice().sort()]

  const [selectedTeam, setSelectedTeam]         = useState(ALL)
  const [statusFilter, setStatusFilter]         = useState<StatusFilter>('upcoming')
  const [gameWeekMode, setGameWeekMode]         = useState(false)
  const [highlightedDate, setHighlightedDate]   = useState<string | null>(null)
  const [activeMobileMonth, setActiveMobileMonth] = useState(0)

  // Build unified schedule (fixtures + holiday buffers)
  const schedule = useMemo(() => buildSchedule(fixtures, holidays), [fixtures, holidays])

  // Filtered list (for selected team)
  const filteredSchedule = useMemo(() => {
    if (selectedTeam === ALL) return schedule
    return schedule.filter(
      (e) =>
        e.isBuffer ||
        e.home_team_name === selectedTeam ||
        e.away_team_name === selectedTeam ||
        e.bye_team === selectedTeam,
    )
  }, [schedule, selectedTeam])

  // Add rest-days annotation for team view
  const teamScheduleWithRest = useMemo(() => {
    if (selectedTeam === ALL) return filteredSchedule
    let lastMatchDate: Date | null = null
    return filteredSchedule.map((item) => {
      if (item.isBuffer) return item
      const isPlaying =
        item.home_team_name === selectedTeam || item.away_team_name === selectedTeam
      let restDays: number | undefined
      if (isPlaying) {
        if (lastMatchDate) {
          const diff = Math.abs(item.jsDate.getTime() - lastMatchDate.getTime())
          restDays = Math.ceil(diff / (1000 * 60 * 60 * 24))
        }
        lastMatchDate = item.jsDate
      }
      return { ...item, restDays, isPlaying }
    })
  }, [filteredSchedule, selectedTeam])

  // Apply status tab filter — only affects fixture entries, holiday buffers always shown
  const displaySchedule = useMemo(() => {
    if (statusFilter === 'all') return teamScheduleWithRest
    return teamScheduleWithRest.filter((item) => {
      if (item.isBuffer) return true
      if (statusFilter === 'upcoming') return item.status === 'scheduled'
      return item.status === 'complete'
    })
  }, [teamScheduleWithRest, statusFilter])

  // Stats: matches per month
  const stats = useMemo(() => {
    const months: Record<string, number> = {
      March: 0, April: 0, May: 0, June: 0,
    }
    for (const f of fixtures) {
      const monthName = parseDate(f.date).toLocaleString('default', { month: 'long' })
      if (monthName in months) months[monthName]++
    }
    return months
  }, [fixtures])

  // ── Click handlers ──────────────────────────────────────────────────────────

  const handleFixtureClick = (dateStr: string) => {
    setHighlightedDate(dateStr)
    // Always do both: update mini calendar month AND scroll desktop calendar
    const parsed = parseDate(dateStr)
    const idx = MONTHS_TO_RENDER.findIndex((m) => m.getMonth() === parsed.getMonth())
    if (idx >= 0) setActiveMobileMonth(idx)
    const allEls = document.querySelectorAll(`[id="cal-date-${dateStr}"]`)
    const visibleEl = Array.from(allEls).find((el) => (el as HTMLElement).offsetParent !== null)
    if (visibleEl) visibleEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setTimeout(() => setHighlightedDate(null), 2500)
  }

  const handleMiniCalendarClick = (dateStr: string) => {
    setHighlightedDate(dateStr)
    const el = document.querySelector(`[data-fixture-date="${dateStr}"]`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setTimeout(() => setHighlightedDate(null), 2500)
  }

  // ── Mini calendar ───────────────────────────────────────────────────────────

  const renderMiniCalendar = () => {
    const monthDate    = MONTHS_TO_RENDER[activeMobileMonth]
    const year         = monthDate.getFullYear()
    const month        = monthDate.getMonth()
    const daysInMonth  = new Date(year, month + 1, 0).getDate()
    const firstDayIdx  = new Date(year, month, 1).getDay()

    const cells: React.ReactNode[] = []
    for (let i = 0; i < firstDayIdx; i++) cells.push(<div key={`e-${i}`} />)

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr  = `${d.toString().padStart(2, '0')}/${(month + 1).toString().padStart(2, '0')}/${year}`
      const dayEvents = schedule.filter((e) => e.date === dateStr)
      const hasEvents = dayEvents.length > 0
      const isBuffer  = dayEvents.some((e) => e.isBuffer)
      const block     = hasEvents ? (isBuffer ? 'BUFFER' : (dayEvents.find((e) => !e.isBuffer) as FixtureEntry)?.block ?? 'BUFFER') : null
      const isHighlight = highlightedDate === dateStr
      const isRelevant  =
        !hasEvents ||
        selectedTeam === ALL ||
        dayEvents.some(
          (e) =>
            e.isBuffer ||
            (!e.isBuffer &&
              (e.home_team_name === selectedTeam || e.away_team_name === selectedTeam)),
        )

      cells.push(
        <div
          key={d}
          onClick={() => hasEvents ? handleMiniCalendarClick(dateStr) : undefined}
          className={`flex flex-col items-center justify-center h-9 rounded-lg transition-all duration-200
            ${hasEvents ? 'cursor-pointer hover:bg-gray-800' : ''}
            ${isHighlight ? 'ring-2 ring-green-500 bg-green-900/20' : ''}
            ${!isRelevant ? 'opacity-30' : ''}
          `}
        >
          <span className={`text-[10px] font-semibold leading-none ${hasEvents ? 'text-white' : 'text-gray-600'}`}>{d}</span>
          {hasEvents && block && (
            <span className={`mt-0.5 w-1.5 h-1.5 rounded-full ${getDotColor(block)} ${isHighlight ? 'animate-pulse' : ''}`} />
          )}
        </div>,
      )
    }
    return cells
  }

  // ── Calendar month renderer ─────────────────────────────────────────────────

  const renderMonth = (monthDate: Date) => {
    const year    = monthDate.getFullYear()
    const month   = monthDate.getMonth()

    if (gameWeekMode) {
      // Collapse buffer expanded days, group by date
      const monthEvents = schedule.filter(
        (e) =>
          e.jsDate.getMonth() === month &&
          e.jsDate.getFullYear() === year &&
          !(e.isBuffer && e.isExpandedDay),
      )
      const datesMap = new Map<string, ScheduleEntry[]>()
      for (const e of monthEvents) {
        if (!datesMap.has(e.date)) datesMap.set(e.date, [])
        datesMap.get(e.date)!.push(e)
      }
      if (datesMap.size === 0)
        return <div className="text-sm text-gray-500 py-2 italic px-2">No fixtures this month.</div>

      const rows: React.ReactNode[] = []
      datesMap.forEach((dayEvents, dateStr) => {
        const isBufferDay = dayEvents.some((e) => e.isBuffer)
        let isHighlighted = false
        if (selectedTeam !== ALL) {
          const playing = dayEvents.some(
            (e) => !e.isBuffer && (e.home_team_name === selectedTeam || e.away_team_name === selectedTeam),
          )
          isHighlighted = playing || isBufferDay
        } else {
          isHighlighted = true
        }
        if (selectedTeam !== ALL && !isHighlighted) return

        const firstNonBuffer = dayEvents.find((e) => !e.isBuffer) as FixtureEntry | undefined
        const block: Block | 'BUFFER' = isBufferDay ? 'BUFFER' : (firstNonBuffer?.block ?? 'Block 1')
        const isHighlightActive = highlightedDate === dateStr
        const firstBuffer = dayEvents.find((e) => e.isBuffer) as BufferEntry | undefined

        rows.push(
          <div
            key={dateStr}
            id={`cal-date-${dateStr}`}
            className={`mb-3 border rounded-xl p-3 bg-gray-900 transition-all duration-500 ${
              isHighlightActive
                ? 'ring-2 ring-green-500 shadow-lg border-green-700 scale-[1.02]'
                : 'border-gray-800 hover:border-gray-700'
            }`}
          >
            <div className="flex justify-between items-center mb-2 border-b border-gray-800 pb-2">
              <div className="font-bold text-sm text-white">
                {isBufferDay && firstBuffer?.endDate
                  ? `${firstBuffer.originalDate} – ${firstBuffer.endDate}`
                  : `${dayEvents[0].date.replace(/(\d+)\/(\d+)\/(\d+)/, (_, d, m, y) => {
                      const date = new Date(Number(y), Number(m) - 1, Number(d))
                      return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                    })}`}
              </div>
              {isBufferDay ? (
                <span className="text-[10px] font-bold text-red-400 bg-red-900/40 px-2 py-1 rounded border border-red-800">Holiday Break</span>
              ) : (
                <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded border ${getBlockColors(block)}`}>
                  {block} · MW{firstNonBuffer?.matchweek}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {dayEvents.map((ev, idx) => {
                if (ev.isBuffer) {
                  return (
                    <div key={idx} className="col-span-1 md:col-span-2 text-xs text-red-400 font-medium flex items-center gap-1">
                      <Coffee size={12} /> {ev.name}
                    </div>
                  )
                }
                if (selectedTeam !== ALL && ev.home_team_name !== selectedTeam && ev.away_team_name !== selectedTeam) return null
                return (
                  <div key={idx} className="flex justify-between items-center text-xs p-2 bg-gray-800 rounded-lg border border-gray-700">
                    <span className={`flex-1 text-right font-semibold truncate ${selectedTeam === ev.home_team_name ? 'text-green-400' : 'text-white'}`}>
                      {ev.home_team_name}
                    </span>
                    <span className="text-[9px] text-gray-500 font-bold px-3">
                      {ev.score_home != null ? `${ev.score_home} – ${ev.score_away}` : 'VS'}
                    </span>
                    <span className={`flex-1 text-left font-semibold truncate ${selectedTeam === ev.away_team_name ? 'text-green-400' : 'text-white'}`}>
                      {ev.away_team_name}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>,
        )
      })
      return rows.length > 0
        ? rows
        : <div className="text-sm text-gray-500 py-2 italic px-2">No matches for selected team this month.</div>
    }

    // Grid view
    const daysInMonth  = new Date(year, month + 1, 0).getDate()
    const firstDayIdx  = new Date(year, month, 1).getDay()
    const days: React.ReactNode[] = []

    for (let i = 0; i < firstDayIdx; i++) {
      days.push(<div key={`empty-${i}`} className="h-20 bg-gray-900/30 rounded-lg border border-transparent" />)
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr  = `${i.toString().padStart(2, '0')}/${(month + 1).toString().padStart(2, '0')}/${year}`
      const dayEvents = schedule.filter((e) => e.date === dateStr)
      const isBufferDay = dayEvents.some((e) => e.isBuffer)
      const firstNonBuffer = dayEvents.find((e) => !e.isBuffer) as FixtureEntry | undefined
      const block: Block | 'BUFFER' = isBufferDay ? 'BUFFER' : (firstNonBuffer?.block ?? 'Block 1')

      let isHighlighted  = false
      let isPlayingToday = false
      const dow = new Date(year, month, i).getDay()
      const isGameDayOfWeek = dow === 2 || dow === 5 // Tue or Fri

      if (dayEvents.length > 0) {
        if (selectedTeam !== ALL) {
          isPlayingToday = dayEvents.some(
            (e) => !e.isBuffer && (e.home_team_name === selectedTeam || e.away_team_name === selectedTeam),
          )
          isHighlighted = isPlayingToday || isBufferDay
        } else {
          isHighlighted = true
        }
      }

      const opacityClass =
        selectedTeam !== ALL && !isHighlighted && dayEvents.length > 0 ? 'opacity-25 grayscale' : ''
      const bgClass = isGameDayOfWeek
        ? 'bg-green-950/20 border-green-900/30'
        : 'bg-gray-900 border-gray-800'
      const isHighlightActive = highlightedDate === dateStr

      days.push(
        <div
          key={i}
          id={`cal-date-${dateStr}`}
          className={`relative h-20 border rounded-lg p-1.5 flex flex-col transition-all duration-500 hover:shadow-sm ${bgClass} ${opacityClass} ${
            isHighlightActive ? 'ring-2 ring-green-500 shadow-lg scale-105 z-10 bg-gray-900' : ''
          }`}
        >
          <span
            className={`absolute top-1 right-1 text-[10px] font-semibold w-5 h-5 flex items-center justify-center rounded-full ${
              dayEvents.length > 0 ? 'bg-gray-200 text-gray-900 shadow-sm' : 'text-gray-600'
            }`}
          >
            {i}
          </span>
          <div className="flex-1 overflow-y-auto mt-5 space-y-1">
            {dayEvents.map((ev, idx) => (
              <div
                key={idx}
                className={`text-[9px] px-1.5 py-0.5 rounded border leading-tight ${getBlockColors(ev.isBuffer ? 'BUFFER' : ev.block)}`}
              >
                {ev.isBuffer ? (
                  <span className="font-bold flex items-center gap-1"><Coffee size={8} /> Holiday</span>
                ) : (
                  <span className="font-semibold">{ev.block} · MW{ev.matchweek}</span>
                )}
              </div>
            ))}
            {isPlayingToday && selectedTeam !== ALL && (
              <div className="text-[8px] bg-green-900 text-green-300 rounded font-bold text-center mt-0.5 border border-green-700 animate-pulse">
                MATCH
              </div>
            )}
          </div>
        </div>,
      )
    }
    return days
  }

  // ── Fixture list panel (shared by mobile + desktop) ─────────────────────────

  const fixtureListTitle =
    statusFilter === 'upcoming' ? 'Upcoming' :
    statusFilter === 'completed' ? 'Results' :
    'All Fixtures'

  const emptyMessage =
    statusFilter === 'upcoming' ? 'No upcoming fixtures.' :
    statusFilter === 'completed' ? 'No completed matches yet.' :
    'No fixtures found.'

  const nonBufferCount = displaySchedule.filter((e) => !e.isBuffer).length

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="pb-12">
      {/* Stats header */}
      <div className="border-b border-gray-800 px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <h1 className="page-heading">Fixtures</h1>
          {/* Matches Per Month — hidden on mobile */}
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Matches Per Month</span>
            <div className="flex gap-2">
              {Object.entries(stats).map(([month, count]) => (
                <div key={month} className="px-3 py-1.5 bg-gray-900 border border-gray-800 rounded-lg text-center min-w-[64px]">
                  <div className="text-[10px] text-gray-500 uppercase font-semibold">{month}</div>
                  <div className="text-lg font-bold text-green-400">{count}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {/* Team selector — dropdown */}
        <div className="mb-5 flex items-center gap-3">
          <Users className="text-green-400 shrink-0" size={18} />
          <select
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value)}
            className="flex-1 max-w-xs bg-gray-900 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600 cursor-pointer"
          >
            {teamOptions.map((team) => (
              <option key={team} value={team}>{team}</option>
            ))}
          </select>
          {selectedTeam !== ALL && (
            <button
              onClick={() => setSelectedTeam(ALL)}
              className="text-xs text-gray-400 hover:text-white transition-colors shrink-0"
            >
              Clear
            </button>
          )}
        </div>

        {/* Status filter tabs */}
        <div className="mb-5 flex items-center gap-1 bg-gray-900 rounded-xl p-1">
          {(['upcoming', 'completed', 'all'] as StatusFilter[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`flex-1 px-4 py-1.5 rounded-lg text-sm font-semibold capitalize transition-all duration-200 ${
                statusFilter === tab
                  ? 'bg-green-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab === 'upcoming' ? 'Upcoming' : tab === 'completed' ? 'Completed' : 'All'}
            </button>
          ))}
        </div>

        {/* Main grid — fixture list LEFT, calendar RIGHT */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* LEFT col: Fixture list — visible on mobile and desktop */}
          <div className={`space-y-4 ${statusFilter === 'completed' ? 'lg:col-span-3' : ''}`}>
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5 sticky top-6 max-h-[85vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-white sticky top-0 bg-gray-900 z-10 py-2 border-b border-gray-800">
                <CalendarIcon className="text-green-400" size={20} />
                {fixtureListTitle}
                {selectedTeam !== ALL && (
                  <span className="text-xs font-normal text-green-400 bg-green-900/30 px-2 py-0.5 rounded-full ml-auto">
                    {selectedTeam}
                  </span>
                )}
              </h3>

              <div className="space-y-3 relative">
                {displaySchedule.map((item, idx) => {
                  if (item.isBuffer && item.isExpandedDay) return null
                  if (selectedTeam !== ALL && !item.isBuffer && !(item as FixtureEntry).isPlaying) return null

                  const isHighlightActive = highlightedDate === item.date

                  // Holiday buffer card
                  if (item.isBuffer) {
                    return (
                      <React.Fragment key={`${item.date}-${idx}`}>
                        <div
                          data-fixture-date={item.originalDate}
                          onClick={() => handleFixtureClick(item.date)}
                          className={`relative z-10 rounded-lg p-3 border transition-all duration-300 cursor-pointer hover:shadow-md bg-red-950/30 border-red-900/60
                            ${isHighlightActive ? 'ring-2 ring-green-500 shadow-lg border-green-700 scale-[1.02]' : 'hover:border-red-800'}
                          `}
                        >
                          <div className="flex items-center gap-3">
                            <div className="bg-red-900/50 p-1.5 rounded text-red-400"><Coffee size={14} /></div>
                            <div>
                              <p className="text-xs font-bold text-red-300">{item.name}</p>
                              <p className="text-[10px] text-red-500">
                                {item.originalDate} – {item.endDate}
                              </p>
                            </div>
                          </div>
                        </div>
                      </React.Fragment>
                    )
                  }

                  // Fixture card — compute result styling
                  const isCompleted = item.score_home != null
                  const homeWins = isCompleted && item.score_home! > item.score_away!
                  const awayWins = isCompleted && item.score_away! > item.score_home!
                  const isDraw = isCompleted && item.score_home === item.score_away

                  const homeChipClass = isCompleted
                    ? homeWins
                      ? 'bg-green-700 text-white ring-1 ring-green-500'
                      : awayWins
                        ? 'bg-gray-800 text-gray-400 opacity-60'
                        : 'bg-gray-700 text-white'
                    : selectedTeam === item.home_team_name
                      ? 'bg-green-700 text-white shadow-sm'
                      : 'bg-gray-700 text-white'

                  const awayChipClass = isCompleted
                    ? awayWins
                      ? 'bg-green-700 text-white ring-1 ring-green-500'
                      : homeWins
                        ? 'bg-gray-800 text-gray-400 opacity-60'
                        : 'bg-gray-700 text-white'
                    : selectedTeam === item.away_team_name
                      ? 'bg-green-700 text-white shadow-sm'
                      : 'bg-gray-700 text-white'

                  return (
                    <React.Fragment key={`${item.date}-${idx}`}>
                      {/* Rest days indicator */}
                      {selectedTeam !== ALL &&
                        (item as FixtureEntry).restDays &&
                        (item as FixtureEntry).isPlaying && (
                          <div className="flex items-center justify-center my-1 relative z-10">
                            <div className="bg-green-900/30 border border-green-800/50 text-green-400 text-[9px] font-bold px-2 py-0.5 rounded-full">
                              {(item as FixtureEntry).restDays} Days Rest
                            </div>
                          </div>
                        )}

                      <Link
                        href={`/match/${item.match_id}`}
                        data-fixture-date={item.originalDate}
                        className={`block relative z-10 rounded-lg p-3 border transition-all duration-300 hover:shadow-md bg-gray-800 border-gray-700
                          ${isHighlightActive ? 'ring-2 ring-green-500 shadow-lg border-green-700 scale-[1.02]' : 'hover:border-gray-600'}
                        `}
                      >
                        <div className="flex justify-between items-center mb-2">
                          <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border ${getBlockColors(item.block)}`}>
                            {item.block} · MW{item.matchweek}
                          </span>
                          <span className="text-[10px] font-semibold text-gray-500 bg-gray-900 px-1.5 py-0.5 rounded">
                            {item.originalDate}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-center gap-1.5 mb-2">
                          <div className={`flex-1 p-1.5 rounded-md font-bold text-xs truncate flex items-center gap-1.5 ${homeChipClass}`}>
                            <TeamAvatar id={item.home_team_id} name={item.home_team_name} size={16} />
                            <span className="truncate">{item.home_team_name}</span>
                          </div>
                          {isCompleted ? (
                            <span className={`font-black text-xl px-2 min-w-[3.5rem] text-center ${isDraw ? 'text-amber-400' : 'text-white'}`}>
                              {item.score_home} – {item.score_away}
                            </span>
                          ) : (
                            <span className="text-gray-500 font-bold text-[9px] uppercase px-1 min-w-[3rem] text-center">vs</span>
                          )}
                          <div className={`flex-1 p-1.5 rounded-md font-bold text-xs truncate flex items-center justify-end gap-1.5 ${awayChipClass}`}>
                            <span className="truncate">{item.away_team_name}</span>
                            <TeamAvatar id={item.away_team_id} name={item.away_team_name} size={16} />
                          </div>
                        </div>

                        <div className="flex justify-end items-center text-[10px] pt-2 border-t border-gray-700">
                          <span className="text-gray-500 flex items-center gap-1 truncate">
                            <Info size={11} className="text-gray-600 shrink-0" /> {item.note}
                          </span>
                        </div>
                      </Link>
                    </React.Fragment>
                  )
                })}

                {nonBufferCount === 0 && (
                  <div className="text-center py-8 text-gray-600">{emptyMessage}</div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT col: Season Calendar — desktop only, hidden on completed tab */}
          {statusFilter !== 'completed' && <div className="hidden lg:block lg:col-span-2 space-y-6">
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 flex flex-col h-[85vh]">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                  <CalendarDays className="text-green-400" />
                  Season Calendar
                </h2>
                <button
                  onClick={() => setGameWeekMode((v) => !v)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-900/30 hover:bg-green-900/50 text-green-400 text-xs font-bold rounded-lg transition-colors"
                >
                  {gameWeekMode ? <LayoutGrid size={14} /> : <List size={14} />}
                  {gameWeekMode ? 'Grid View' : 'Game Week View'}
                </button>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-4 mb-4 text-xs text-gray-400">
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-500" /> Block 1</div>
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500" /> Block 2</div>
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-purple-500" /> Block 3</div>
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500" /> Holiday</div>
              </div>

              {/* Scrollable calendar */}
              <div className="flex-1 overflow-y-auto pr-2 space-y-8 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                {MONTHS_TO_RENDER.map((monthDate) => (
                  <div key={monthDate.getTime()}>
                    <h3 className="text-lg font-bold mb-3 sticky top-0 bg-gray-900/95 backdrop-blur py-2 z-10 text-white border-b border-gray-800">
                      {monthDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </h3>
                    {!gameWeekMode && (
                      <div className="grid grid-cols-7 gap-1 md:gap-2 mb-2">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                          <div key={day} className="text-center text-[10px] font-semibold text-gray-600 py-1 uppercase tracking-wider">
                            {day}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className={gameWeekMode ? 'space-y-2' : 'grid grid-cols-7 gap-1 md:gap-2'}>
                      {renderMonth(monthDate)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>}

        </div>

        {/* Mobile mini calendar — after fixture list, hidden on desktop and on completed tab */}
        {statusFilter !== 'completed' && (
          <div className="lg:hidden mt-6">
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4">
              {/* Month nav */}
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => setActiveMobileMonth((m) => Math.max(0, m - 1))}
                  disabled={activeMobileMonth === 0}
                  className="p-1.5 rounded-lg disabled:opacity-30 hover:bg-gray-800 transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="font-bold text-sm text-white">
                  {MONTHS_TO_RENDER[activeMobileMonth].toLocaleString('default', { month: 'long', year: 'numeric' })}
                </span>
                <button
                  onClick={() => setActiveMobileMonth((m) => Math.min(3, m + 1))}
                  disabled={activeMobileMonth === 3}
                  className="p-1.5 rounded-lg disabled:opacity-30 hover:bg-gray-800 transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* Day-of-week headers */}
              <div className="grid grid-cols-7 gap-1 mb-1">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                  <div key={i} className="text-center text-[9px] font-semibold text-gray-600 uppercase">{d}</div>
                ))}
              </div>

              {/* Mini grid */}
              <div className="grid grid-cols-7 gap-1">{renderMiniCalendar()}</div>

              {/* Legend */}
              <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-gray-800 text-[10px] text-gray-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" /> Block 1</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" /> Block 2</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500 shrink-0" /> Block 3</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 shrink-0" /> Holiday</span>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
