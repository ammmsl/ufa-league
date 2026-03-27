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
import type { MvpRow, MvpHistoryRow, MvpClientProps } from './page'
import { PlayerAvatar } from '../_components/Avatar'

// ─── Constants ────────────────────────────────────────────────────────────────

const LINE_COLORS = [
  '#4ade80', // green-400
  '#60a5fa', // blue-400
  '#f472b6', // pink-400
  '#fb923c', // orange-400
  '#a78bfa', // violet-400
  '#34d399', // emerald-400
]

const TEAM_BAR_COLORS = ['bg-green-500', 'bg-blue-500', 'bg-pink-500', 'bg-orange-400', 'bg-violet-500']

const MEDAL = {
  0: { ring: 'ring-yellow-400', bg: 'bg-yellow-400/10', numColor: 'text-yellow-400', label: '1st' },
  1: { ring: 'ring-gray-400',   bg: 'bg-gray-400/10',   numColor: 'text-gray-300',   label: '2nd' },
  2: { ring: 'ring-amber-600',  bg: 'bg-amber-700/10',  numColor: 'text-amber-500',  label: '3rd' },
} as const

const BREAKDOWN_COLORS = {
  goals:   '#4ade80', // green-400
  assists: '#60a5fa', // blue-400
  blocks:  '#f472b6', // pink-400
  mvp:     '#fbbf24', // amber-400
}

function abbrevTeam(name: string): string {
  if (name.length > 15 && name.includes(' ')) {
    return name.split(' ').map(w => w[0].toUpperCase()).join('')
  }
  return name
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function LeaderCard({ row }: { row: MvpRow }) {
  return (
    <div className="flex flex-col justify-center bg-gradient-to-br from-green-900/30 to-gray-900 rounded-xl p-5 border border-green-800/40 h-full">
      <p className="text-[10px] font-bold uppercase tracking-widest text-green-400 mb-3">
        Season MVP Leader
      </p>
      <div className="flex items-center gap-3 mb-1">
        <PlayerAvatar id={row.player_id} name={row.display_name} size={48} />
        <div>
          <Link href={`/player/${row.player_id}`} className="hover:text-green-400 transition-colors">
            <p className="text-xl font-black text-white leading-tight">{row.display_name}</p>
          </Link>
          <p className="text-xs text-gray-400 mt-0.5">{row.team_name}</p>
        </div>
      </div>
      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-5xl font-black text-green-400 tabular-nums">{row.composite_score}</span>
        <span className="text-sm text-gray-400">pts</span>
      </div>
      <p className="text-[10px] text-gray-500 mt-2 font-mono">G×3 + A×3 + B×2 + MVP×5</p>
      <div className="mt-3 grid grid-cols-4 gap-1 text-center">
        {[
          { label: 'Goals', val: row.total_goals,    color: 'text-green-400' },
          { label: 'Asst',  val: row.total_assists,  color: 'text-blue-400'  },
          { label: 'Blks',  val: row.total_blocks,   color: 'text-pink-400'  },
          { label: 'MVP',   val: row.match_mvp_wins, color: 'text-amber-400' },
        ].map(({ label, val, color }) => (
          <div key={label} className="bg-gray-800/60 rounded-lg py-1.5">
            <p className={`text-base font-bold tabular-nums ${color}`}>{val}</p>
            <p className="text-[9px] text-gray-500 uppercase tracking-wider">{label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function Podium({ rows }: { rows: MvpRow[] }) {
  const top3 = rows.slice(0, 3)
  if (top3.length === 0 || top3[0].composite_score === 0) return null

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
            <PlayerAvatar id={row.player_id} name={row.display_name} size={i === 0 ? 44 : 36} />
            <span className={`text-3xl font-black tabular-nums ${medal.numColor}`}>
              {row.composite_score}
            </span>
            <span className="text-[10px] text-gray-400 uppercase tracking-widest">pts</span>
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

// ─── Trend Chart ──────────────────────────────────────────────────────────────

type ChartPoint  = { matchweek: number; value: number }
type ChartSeries = { player_id: string; display_name: string; data: ChartPoint[] }

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

function TrendChart({ series }: { series: ChartSeries[] }) {
  if (series.length === 0) {
    return (
      <div className="bg-gray-900 rounded-xl p-4">
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-3">Score Progression</p>
        <div className="h-40 flex items-center justify-center text-gray-500 text-sm">
          No match data yet.
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-900 rounded-xl p-4">
      <p className="text-xs text-gray-400 uppercase tracking-widest mb-3">
        Score Progression (top 6)
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

// ─── Score Breakdown Panel ────────────────────────────────────────────────────

type BreakdownItem = {
  name:      string
  player_id: string
  goals_pts: number
  asst_pts:  number
  blks_pts:  number
  mvp_pts:   number
}

function BreakdownTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div style={{
      background: '#111827', border: '1px solid #374151',
      borderRadius: 8, padding: '8px 12px', fontSize: 11, minWidth: 150,
    }}>
      <p style={{ color: '#9ca3af', marginBottom: 6 }}>{label}</p>
      {[...payload].reverse().map((entry) => (
        <div key={entry.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 3 }}>
          <span style={{ color: entry.color }}>{entry.name}</span>
          <span style={{ color: '#e5e7eb', fontWeight: 700 }}>{entry.value}</span>
        </div>
      ))}
      <div style={{ borderTop: '1px solid #374151', marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: '#9ca3af' }}>Total</span>
        <span style={{ color: '#4ade80', fontWeight: 700 }}>
          {payload.reduce((s, e) => s + e.value, 0)}
        </span>
      </div>
    </div>
  )
}

function ScoreBreakdownPanel({ rows }: { rows: MvpRow[] }) {
  const data: BreakdownItem[] = rows
    .filter(r => r.composite_score > 0)
    .slice(0, 8)
    .map(r => ({
      name:      r.display_name.split(' ')[0],
      player_id: r.player_id,
      goals_pts: r.total_goals    * 3,
      asst_pts:  r.total_assists  * 3,
      blks_pts:  r.total_blocks   * 2,
      mvp_pts:   r.match_mvp_wins * 5,
    }))

  if (data.length === 0) {
    return (
      <div className="bg-gray-900 rounded-xl p-4">
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-3">Score Breakdown</p>
        <div className="h-40 flex items-center justify-center text-gray-500 text-sm">No data yet.</div>
      </div>
    )
  }

  return (
    <div className="bg-gray-900 rounded-xl p-4">
      <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Score Breakdown (top 8)</p>
      <p className="text-[10px] text-gray-500 mb-3">How each player's points are earned</p>
      <ResponsiveContainer width="100%" height={data.length * 36 + 16}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
          barSize={12}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
          <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 10 }} />
          <YAxis type="category" dataKey="name" width={52} tick={{ fill: '#9ca3af', fontSize: 10 }} />
          <Tooltip content={<BreakdownTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <Bar dataKey="goals_pts" name="Goals"    stackId="a" fill={BREAKDOWN_COLORS.goals}   radius={[0,0,0,0]} />
          <Bar dataKey="asst_pts"  name="Assists"  stackId="a" fill={BREAKDOWN_COLORS.assists}  radius={[0,0,0,0]} />
          <Bar dataKey="blks_pts"  name="Blocks"   stackId="a" fill={BREAKDOWN_COLORS.blocks}   radius={[0,0,0,0]} />
          <Bar dataKey="mvp_pts"   name="MVP wins" stackId="a" fill={BREAKDOWN_COLORS.mvp}      radius={[0,4,4,0]} />
        </BarChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
        {[
          { label: 'Goals ×3',    color: BREAKDOWN_COLORS.goals   },
          { label: 'Assists ×3',  color: BREAKDOWN_COLORS.assists  },
          { label: 'Blocks ×2',   color: BREAKDOWN_COLORS.blocks   },
          { label: 'MVP wins ×5', color: BREAKDOWN_COLORS.mvp      },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="w-3 h-2.5 rounded-sm inline-block" style={{ background: color }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Team Contribution Panel ──────────────────────────────────────────────────

function TeamContributionPanel({ rows }: { rows: MvpRow[] }) {
  const teamMap = new Map<string, number>()
  for (const row of rows) {
    if (row.composite_score > 0) {
      teamMap.set(row.team_name, (teamMap.get(row.team_name) ?? 0) + row.composite_score)
    }
  }
  const teams = Array.from(teamMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  if (teams.length === 0) return null
  const grand = teams.reduce((s, t) => s + t.value, 0)
  if (grand === 0) return null

  return (
    <div className="bg-gray-900 rounded-xl p-4">
      <p className="text-xs text-gray-400 uppercase tracking-widest mb-3">
        Team Score Contribution
      </p>
      <div className="space-y-3">
        {teams.map((t, i) => (
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

// ─── Full Rankings Table ──────────────────────────────────────────────────────

function RankingsTable({ rows }: { rows: MvpRow[] }) {
  return (
    <div className="bg-gray-900 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <h2 className="text-xs font-semibold text-white uppercase tracking-widest">
          Full Rankings
        </h2>
        <span className="text-xs text-gray-400">{rows.length} players</span>
      </div>
      <div className="max-h-80 overflow-y-auto overflow-x-auto">
        <table className="w-full text-sm min-w-[480px]">
          <thead className="sticky top-0 bg-gray-900 z-10">
            <tr className="text-gray-500 text-xs border-b border-gray-800">
              <th className="text-left py-2 px-4 font-normal w-8">#</th>
              <th className="text-left py-2 px-2 font-normal">Player</th>
              <th className="text-left py-2 px-2 font-normal">Team</th>
              <th className="text-right py-2 px-2 font-normal text-green-400">Score</th>
              <th className="text-right py-2 px-2 font-normal">G</th>
              <th className="text-right py-2 px-2 font-normal">A</th>
              <th className="text-right py-2 px-2 font-normal">B</th>
              <th className="text-right py-2 px-4 font-normal">MVP</th>
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
                  <div className="flex items-center gap-2">
                    <PlayerAvatar id={row.player_id} name={row.display_name} size={22} />
                    <Link
                      href={`/player/${row.player_id}`}
                      className="hover:text-green-400 transition-colors font-medium"
                    >
                      {row.display_name}
                    </Link>
                  </div>
                </td>
                <td className="py-2 px-2 text-gray-400">
                  <Link
                    href={`/team/${row.team_id}`}
                    className="hover:text-white transition-colors"
                    title={row.team_name}
                  >
                    {abbrevTeam(row.team_name)}
                  </Link>
                </td>
                <td className="py-2 px-2 text-right font-bold text-green-400 tabular-nums">
                  {row.composite_score}
                </td>
                <td className="py-2 px-2 text-right text-gray-400 tabular-nums">{row.total_goals}</td>
                <td className="py-2 px-2 text-right text-gray-400 tabular-nums">{row.total_assists}</td>
                <td className="py-2 px-2 text-right text-gray-400 tabular-nums">{row.total_blocks}</td>
                <td className="py-2 px-4 text-right text-gray-400 tabular-nums">{row.match_mvp_wins}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Main Client Component ────────────────────────────────────────────────────

export default function MvpClient({ seasonName, rows, history }: MvpClientProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const trendSeries = useMemo((): ChartSeries[] => {
    const playerMap = new Map<string, { display_name: string; data: Map<number, number> }>()
    for (const row of history) {
      if (!playerMap.has(row.player_id)) {
        playerMap.set(row.player_id, { display_name: row.display_name, data: new Map() })
      }
      playerMap.get(row.player_id)!.data.set(row.matchweek, row.cum_composite)
    }

    const allMW = [...new Set(history.map(r => r.matchweek))].sort((a, b) => a - b)

    return Array.from(playerMap.entries())
      .map(([pid, d]) => ({
        player_id:    pid,
        display_name: d.display_name,
        max: d.data.size > 0 ? Math.max(...Array.from(d.data.values())) : 0,
        data: d.data,
      }))
      .filter(p => p.max > 0)
      .sort((a, b) => b.max - a.max)
      .slice(0, 6)
      .map(p => ({
        player_id:    p.player_id,
        display_name: p.display_name,
        data: allMW.map(mw => {
          if (p.data.has(mw)) return { matchweek: mw, value: p.data.get(mw)! }
          const prevMWs = allMW.filter(m => m < mw && p.data.has(m))
          const value = prevMWs.length > 0 ? p.data.get(prevMWs[prevMWs.length - 1])! : 0
          return { matchweek: mw, value }
        }),
      }))
  }, [history])

  const leader = rows[0]

  return (
    <>
      {/* ── Mobile — all panels stacked ───────────────────────────────────── */}
      <div className="md:hidden max-w-lg mx-auto px-4 pb-16 pt-6 space-y-5">
        <div>
          <h1 className="text-2xl font-bold mb-0.5">MVP Race</h1>
          <p className="text-gray-400 text-sm">{seasonName}</p>
        </div>
        {leader && leader.composite_score > 0 && <LeaderCard row={leader} />}
        <Podium rows={rows} />
        {mounted && <TrendChart series={trendSeries} />}
        <TeamContributionPanel rows={rows} />
        {mounted && <ScoreBreakdownPanel rows={rows} />}
        <RankingsTable rows={rows} />
      </div>

      {/* ── Desktop — dashboard grid ───────────────────────────────────────── */}
      <div className="hidden md:block max-w-6xl mx-auto px-6 pb-16 pt-6 space-y-6">
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-bold">MVP Race</h1>
          <p className="text-gray-400 text-sm">{seasonName}</p>
        </div>

        <div className="grid grid-cols-3 gap-6 items-stretch">
          {leader && leader.composite_score > 0 ? (
            <LeaderCard row={leader} />
          ) : (
            <div className="bg-gray-900 rounded-xl p-5 flex items-center justify-center text-gray-500 text-sm">
              No data yet
            </div>
          )}
          <div className="col-span-2 flex items-end">
            <div className="w-full">
              <Podium rows={rows} />
            </div>
          </div>
        </div>

        {mounted && <TrendChart series={trendSeries} />}

        <div className="grid grid-cols-2 gap-6">
          <TeamContributionPanel rows={rows} />
          {mounted && <ScoreBreakdownPanel rows={rows} />}
        </div>

        <RankingsTable rows={rows} />
      </div>
    </>
  )
}
