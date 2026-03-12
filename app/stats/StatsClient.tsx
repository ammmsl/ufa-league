'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from 'recharts'
import type { StatRow, MatchweekRow, StatsClientProps } from './page'

// ─── Constants ────────────────────────────────────────────────────────────────

type StatTab = 'goals' | 'assists' | 'blocks' | 'apps'

const TABS: { key: StatTab; label: string }[] = [
  { key: 'goals',   label: 'Goals'   },
  { key: 'assists', label: 'Assists' },
  { key: 'blocks',  label: 'Blocks'  },
  { key: 'apps',    label: 'Apps'    },
]

const LINE_COLORS = [
  '#4ade80', // green-400
  '#60a5fa', // blue-400
  '#f472b6', // pink-400
  '#fb923c', // orange-400
  '#a78bfa', // violet-400
  '#34d399', // emerald-400
]

const TEAM_BAR_COLORS = ['bg-green-500', 'bg-blue-500', 'bg-pink-500', 'bg-orange-400', 'bg-violet-500']

function abbrevTeam(name: string): string {
  if (name.length > 15 && name.includes(' ')) {
    return name.split(' ').map(w => w[0].toUpperCase()).join('')
  }
  return name
}

const MEDAL = {
  0: { ring: 'ring-yellow-400', bg: 'bg-yellow-400/10', numColor: 'text-yellow-400', label: '1st' },
  1: { ring: 'ring-gray-400',   bg: 'bg-gray-400/10',   numColor: 'text-gray-300',   label: '2nd' },
  2: { ring: 'ring-amber-600',  bg: 'bg-amber-700/10',  numColor: 'text-amber-500',  label: '3rd' },
} as const

// ─── Sub-components ───────────────────────────────────────────────────────────

function TabBar({ tab, onChange }: { tab: StatTab; onChange: (t: StatTab) => void }) {
  return (
    <div className="flex gap-1 bg-gray-900 rounded-xl p-1">
      {TABS.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-150 ${
            tab === key
              ? 'bg-green-600 text-white shadow'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function Podium({ rows, tab }: { rows: StatRow[]; tab: StatTab }) {
  const top3 = rows.slice(0, 3)
  if (top3.length === 0 || top3[0].total === 0) return null
  const unit = tab === 'goals' ? 'G' : tab === 'assists' ? 'A' : tab === 'blocks' ? 'B' : 'Apps'

  return (
    <div className="grid grid-cols-3 gap-2 items-end">
      {top3.map((row, i) => {
        const medal = MEDAL[i as 0 | 1 | 2]
        return (
          <Link
            key={row.player_id}
            href={`/player/${row.player_id}`}
            className={`flex flex-col items-center justify-center gap-1 rounded-xl p-3 ring-1 ${medal.ring} ${medal.bg}
              transition-transform hover:scale-[1.02] text-center
              ${i === 0 ? 'md:order-2 md:py-8' : i === 1 ? 'md:order-1' : 'md:order-3'}
            `}
          >
            <span className={`text-[10px] font-bold uppercase tracking-widest ${medal.numColor}`}>
              {medal.label}
            </span>
            <span className={`text-3xl font-black tabular-nums ${medal.numColor}`}>
              {row.total}
            </span>
            <span className="text-[10px] text-gray-400 uppercase tracking-widest">{unit}</span>
            <span className="text-xs font-bold text-white leading-tight mt-1">
              {row.display_name}
            </span>
            <span className="text-[10px] text-gray-500 truncate max-w-full">
              {row.team_name}
            </span>
          </Link>
        )
      })}
    </div>
  )
}

function LeaderCard({ row, tab }: { row: StatRow; tab: StatTab }) {
  const statLabel = tab === 'goals' ? 'Goals' : tab === 'assists' ? 'Assists' :
                    tab === 'blocks' ? 'Blocks' : 'Appearances'
  return (
    <div className="flex flex-col justify-center bg-gradient-to-br from-green-900/30 to-gray-900 rounded-xl p-5 border border-green-800/40 h-full">
      <p className="text-[10px] font-bold uppercase tracking-widest text-green-400 mb-2">
        Season Leader
      </p>
      <Link href={`/player/${row.player_id}`} className="hover:text-green-400 transition-colors">
        <p className="text-xl font-black text-white leading-tight">{row.display_name}</p>
      </Link>
      <p className="text-xs text-gray-400 mt-0.5">{row.team_name}</p>
      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-5xl font-black text-green-400 tabular-nums">{row.total}</span>
        <span className="text-sm text-gray-400">{statLabel}</span>
      </div>
      {row.per_game != null && (
        <p className="text-xs text-gray-500 mt-2">
          {row.per_game.toFixed(1)} per game · {row.appearances} apps
        </p>
      )}
      {row.per_game == null && (
        <p className="text-xs text-gray-500 mt-2">{row.appearances} appearances</p>
      )}
    </div>
  )
}

type ChartPoint = { matchweek: number; value: number }
type ChartSeries = { player_id: string; display_name: string; data: ChartPoint[] }

// Tooltip that re-sorts players by their value at the hovered matchweek
function TrendTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: number
}) {
  if (!active || !payload || payload.length === 0) return null
  const sorted = [...payload].sort((a, b) => b.value - a.value)
  return (
    <div style={{
      background: '#111827', border: '1px solid #374151',
      borderRadius: 8, padding: '8px 12px', minWidth: 160,
    }}>
      <p style={{ color: '#9ca3af', marginBottom: 6, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Matchweek {label}
      </p>
      {sorted.map((entry, i) => (
        <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <span style={{ color: '#6b7280', fontSize: 10, width: 14, textAlign: 'right' }}>{i + 1}</span>
          <span style={{ width: 10, height: 2, background: entry.color, borderRadius: 2, display: 'inline-block', flexShrink: 0 }} />
          <span style={{ color: '#e5e7eb', flex: 1, fontSize: 12 }}>{entry.name}</span>
          <span style={{ color: entry.color, fontWeight: 700, paddingLeft: 8, fontSize: 12 }}>{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

function TrendChart({ series, tab }: { series: ChartSeries[]; tab: StatTab }) {
  const label = tab === 'goals' ? 'Goals' : tab === 'assists' ? 'Assists' :
                tab === 'blocks' ? 'Blocks' : 'Appearances'

  if (series.length === 0) {
    return (
      <div className="bg-gray-900 rounded-xl p-4">
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-3">Season Progression — {label}</p>
        <div className="h-40 flex items-center justify-center text-gray-500 text-sm">
          No match data yet.
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-900 rounded-xl p-4">
      <p className="text-xs text-gray-400 uppercase tracking-widest mb-3">
        Season Progression — {label} (top 6)
      </p>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart margin={{ top: 8, right: 24, left: -10, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis
            dataKey="matchweek"
            type="number"
            domain={['dataMin', 'dataMax']}
            allowDuplicatedCategory={false}
            tick={{ fill: '#6b7280', fontSize: 10 }}
            label={{ value: 'MW', position: 'insideBottomRight', fill: '#6b7280', fontSize: 10, offset: -4 }}
          />
          <YAxis width={32} allowDecimals={false} tick={{ fill: '#6b7280', fontSize: 10 }} />
          <Tooltip content={<TrendTooltip />} />
          {series.map((s, i) => (
            <Line
              key={s.player_id}
              data={s.data}
              dataKey="value"
              name={s.display_name}
              stroke={LINE_COLORS[i % LINE_COLORS.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              type="monotone"
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
        {series.map((s, i) => (
          <div key={s.player_id} className="flex items-center gap-1.5 text-xs text-gray-400">
            <span
              className="w-3 h-0.5 rounded-full inline-block"
              style={{ background: LINE_COLORS[i % LINE_COLORS.length] }}
            />
            {s.display_name}
          </div>
        ))}
      </div>
    </div>
  )
}

type EffItem = { name: string; per_game: number; total: number; player_id: string }

function BarTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div style={{
      background: '#111827', border: '1px solid #374151',
      borderRadius: 8, padding: '8px 12px', fontSize: 11,
    }}>
      <p style={{ color: '#9ca3af', marginBottom: 4 }}>{label}</p>
      <p style={{ color: '#4ade80', fontWeight: 700 }}>
        {payload[0].value.toFixed(2)}{' '}
        <span style={{ color: '#9ca3af', fontWeight: 400 }}>per game</span>
      </p>
    </div>
  )
}

function EfficiencyPanel({ data, tab }: { data: EffItem[]; tab: StatTab }) {
  if (tab === 'apps' || data.length === 0) return null
  const label = tab === 'goals' ? 'Goals' : tab === 'assists' ? 'Assists' : 'Blocks'

  return (
    <div className="bg-gray-900 rounded-xl p-4">
      <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">
        Per-Game Efficiency — {label}
      </p>
      <p className="text-[10px] text-gray-500 mb-3">Min. 3 appearances</p>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 4, right: 12, left: -10, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} interval={0} />
          <YAxis width={32} tick={{ fill: '#9ca3af', fontSize: 10 }} />
          <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <Bar dataKey="per_game" name="Per Game" radius={[4, 4, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={i === 0 ? '#4ade80' : '#374151'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

type TeamTotal = { name: string; value: number }

function TeamBreakdownPanel({ teamTotals, tab }: { teamTotals: TeamTotal[]; tab: StatTab }) {
  if (teamTotals.length === 0) return null
  const grand = teamTotals.reduce((s, t) => s + t.value, 0)
  if (grand === 0) return null
  const statLabel = tab === 'goals' ? 'Goals' : tab === 'assists' ? 'Assists' :
                    tab === 'blocks' ? 'Blocks' : 'Appearances'

  return (
    <div className="bg-gray-900 rounded-xl p-4">
      <p className="text-xs text-gray-400 uppercase tracking-widest mb-3">
        Team {statLabel} Contribution
      </p>
      <div className="space-y-3">
        {teamTotals.map((t, i) => (
          <div key={t.name}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-300 font-medium">{abbrevTeam(t.name)}</span>
              <span className="text-gray-500 tabular-nums">
                {t.value} ({Math.round((t.value / grand) * 100)}%)
              </span>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${TEAM_BAR_COLORS[i % TEAM_BAR_COLORS.length]}`}
                style={{ width: `${(t.value / grand) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function StatTable({ rows, tab }: { rows: StatRow[]; tab: StatTab }) {
  const showPerGame = tab !== 'apps'
  const label = TABS.find(t => t.key === tab)!.label

  return (
    <div className="bg-gray-900 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <h2 className="text-xs font-semibold text-white uppercase tracking-widest">
          {label} — Full Rankings
        </h2>
        <span className="text-xs text-gray-400">{rows.length} players</span>
      </div>
      <div className="max-h-80 overflow-y-auto overflow-x-auto">
        <table className="w-full text-sm min-w-[420px]">
          <thead className="sticky top-0 bg-gray-900 z-10">
            <tr className="text-gray-500 text-xs border-b border-gray-800">
              <th className="text-left py-2 px-4 font-normal w-8">#</th>
              <th className="text-left py-2 px-2 font-normal">Player</th>
              <th className="text-left py-2 px-2 font-normal">Team</th>
              <th className="text-right py-2 px-2 font-normal">Total</th>
              <th className="text-right py-2 px-2 font-normal">Apps</th>
              {showPerGame && (
                <th className="text-right py-2 px-4 font-normal">Per Game</th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.player_id}
                className={`border-b border-gray-800 last:border-0 ${i < 3 ? 'bg-gray-800/40' : ''}`}
              >
                <td className="py-2 px-4 text-gray-500 text-xs w-8">
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                </td>
                <td className="py-2 px-2">
                  <Link
                    href={`/player/${row.player_id}`}
                    className="hover:text-green-400 transition-colors font-medium"
                  >
                    {row.display_name}
                  </Link>
                </td>
                <td className="py-2 px-2 text-gray-400">
                  <Link href={`/team/${row.team_id}`} className="hover:text-white transition-colors" title={row.team_name}>
                    {abbrevTeam(row.team_name)}
                  </Link>
                </td>
                <td className="py-2 px-2 text-right font-semibold">{row.total}</td>
                <td className="py-2 px-2 text-right text-gray-400">{row.appearances}</td>
                {showPerGame && (
                  <td className="py-2 px-4 text-right text-gray-400">
                    {row.per_game != null ? row.per_game.toFixed(1) : '—'}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Main Client Component ────────────────────────────────────────────────────

export default function StatsClient({
  seasonName, goals, assists, blocks, appearances, history,
}: StatsClientProps) {
  const [tab, setTab] = useState<StatTab>('goals')
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const { activeRows, histSeries, teamTotals, efficiencyData } = useMemo(() => {
    const activeRows =
      tab === 'goals'   ? goals   :
      tab === 'assists' ? assists :
      tab === 'blocks'  ? blocks  :
      appearances

    // Build cumulative chart series for top 6 players
    const cumKey = (
      tab === 'goals'   ? 'cum_goals'   :
      tab === 'assists' ? 'cum_assists'  :
      tab === 'blocks'  ? 'cum_blocks'   :
      'cum_apps'
    ) as keyof MatchweekRow

    const playerMap = new Map<string, { display_name: string; data: Map<number, number> }>()
    for (const row of history) {
      if (!playerMap.has(row.player_id)) {
        playerMap.set(row.player_id, { display_name: row.display_name, data: new Map() })
      }
      playerMap.get(row.player_id)!.data.set(row.matchweek, row[cumKey] as number)
    }

    const allMW = [...new Set(history.map(r => r.matchweek))].sort((a, b) => a - b)

    const ranked = Array.from(playerMap.entries())
      .map(([pid, d]) => ({
        player_id:    pid,
        display_name: d.display_name,
        max: d.data.size > 0 ? Math.max(...Array.from(d.data.values())) : 0,
        data: d.data,
      }))
      .filter(p => p.max > 0)
      .sort((a, b) => b.max - a.max)
      .slice(0, 6)

    const histSeries: ChartSeries[] = ranked.map((p) => ({
      player_id:    p.player_id,
      display_name: p.display_name,
      data: allMW.map(mw => {
        if (p.data.has(mw)) return { matchweek: mw, value: p.data.get(mw)! }
        // forward-fill from last known value
        const prevMWs = allMW.filter(m => m < mw && p.data.has(m))
        const value = prevMWs.length > 0 ? p.data.get(prevMWs[prevMWs.length - 1])! : 0
        return { matchweek: mw, value }
      }),
    }))

    // Team totals
    const teamTotalsMap = new Map<string, number>()
    for (const row of activeRows) {
      if (row.total > 0) {
        teamTotalsMap.set(row.team_name, (teamTotalsMap.get(row.team_name) ?? 0) + row.total)
      }
    }
    const teamTotals: TeamTotal[] = Array.from(teamTotalsMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)

    // Efficiency data (per-game bar chart)
    const efficiencyData: EffItem[] = activeRows
      .filter(r => r.appearances >= 3 && r.per_game != null && r.total > 0)
      .slice(0, 8)
      .map(r => ({
        name:      r.display_name.split(' ')[0],
        per_game:  r.per_game!,
        total:     r.total,
        player_id: r.player_id,
      }))

    return { activeRows, histSeries, teamTotals, efficiencyData }
  }, [tab, goals, assists, blocks, appearances, history])

  const leader = activeRows[0]

  return (
    <>
      {/* ── Mobile — all panels stacked ───────────────────────────────────── */}
      <div className="md:hidden max-w-lg mx-auto px-4 pb-16 pt-6 space-y-5">
        <div>
          <h1 className="text-2xl font-bold mb-0.5">Stats</h1>
          <p className="text-gray-400 text-sm">{seasonName}</p>
        </div>
        <TabBar tab={tab} onChange={setTab} />
        {leader && leader.total > 0 && <LeaderCard row={leader} tab={tab} />}
        <Podium rows={activeRows} tab={tab} />
        {mounted && <TrendChart series={histSeries} tab={tab} />}
        <TeamBreakdownPanel teamTotals={teamTotals} tab={tab} />
        {mounted && <EfficiencyPanel data={efficiencyData} tab={tab} />}
        <StatTable rows={activeRows} tab={tab} />
      </div>

      {/* ── Desktop — dashboard grid ───────────────────────────────────────── */}
      <div className="hidden md:block max-w-6xl mx-auto px-6 pb-16 pt-6 space-y-6">
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-bold">Stats</h1>
          <p className="text-gray-400 text-sm">{seasonName}</p>
        </div>

        <TabBar tab={tab} onChange={setTab} />

        <div className="grid grid-cols-3 gap-6 items-stretch">
          {leader && leader.total > 0 ? (
            <LeaderCard row={leader} tab={tab} />
          ) : (
            <div className="bg-gray-900 rounded-xl p-5 flex items-center justify-center text-gray-500 text-sm">
              No data yet
            </div>
          )}
          <div className="col-span-2 flex items-end">
            <div className="w-full">
              <Podium rows={activeRows} tab={tab} />
            </div>
          </div>
        </div>

        {mounted && <TrendChart series={histSeries} tab={tab} />}

        <div className="grid grid-cols-2 gap-6">
          <TeamBreakdownPanel teamTotals={teamTotals} tab={tab} />
          {mounted && <EfficiencyPanel data={efficiencyData} tab={tab} />}
        </div>

        <StatTable rows={activeRows} tab={tab} />
      </div>
    </>
  )
}
