'use client'

import type { HistoricalPosition } from '@/lib/standings'

export type { HistoricalPosition }

interface Props {
  data:      HistoricalPosition[]
  teamOrder: string[]   // team_id[] in current standings order — index determines colour
}

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#a855f7']

const VW = 600, VH = 240
const PT = 16, PB = 40, PL = 32, PR = 16
const PW = VW - PL - PR
const PH = VH - PT - PB

function xFor(mw: number, mws: number[]): number {
  if (mws.length === 1) return PL + PW / 2
  return PL + (mws.indexOf(mw) / (mws.length - 1)) * PW
}

function yFor(pos: number): number {
  return PT + ((pos - 1) / 4) * PH
}

export default function StandingsChart({ data, teamOrder }: Props) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-gray-500 italic text-center py-6">
        No completed matchweeks yet.
      </p>
    )
  }

  const mws = [...new Set(data.map((d) => d.matchweek))].sort((a, b) => a - b)
  const lastMW = mws[mws.length - 1]

  const byTeam = new Map<string, HistoricalPosition[]>()
  for (const pt of data) {
    if (!byTeam.has(pt.team_id)) byTeam.set(pt.team_id, [])
    byTeam.get(pt.team_id)!.push(pt)
  }

  return (
    <div>
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        width="100%"
        style={{ height: '220px' }}
        aria-label="Position history chart"
      >
        {/* Horizontal gridlines + Y-axis position labels */}
        {[1, 2, 3, 4, 5].map((pos) => {
          const y = yFor(pos)
          return (
            <g key={pos}>
              <line
                x1={PL} y1={y} x2={VW - PR} y2={y}
                stroke="#374151" strokeWidth={0.5}
              />
              <text
                x={PL - 6} y={y}
                textAnchor="end" dominantBaseline="middle"
                fontSize={9} fill="#6b7280"
              >
                {pos}
              </text>
            </g>
          )
        })}

        {/* X-axis matchweek labels */}
        {mws.map((mw) => (
          <text
            key={mw}
            x={xFor(mw, mws)}
            y={VH - PB + 14}
            textAnchor="middle"
            fontSize={9}
            fill="#6b7280"
          >
            MW {mw}
          </text>
        ))}

        {/* One polyline + dots per team */}
        {teamOrder.map((teamId, ci) => {
          const pts = byTeam.get(teamId)
          if (!pts) return null
          const sorted = [...pts].sort((a, b) => a.matchweek - b.matchweek)
          const color = COLORS[ci % COLORS.length]
          const pointsAttr = sorted
            .map((p) => `${xFor(p.matchweek, mws)},${yFor(p.position)}`)
            .join(' ')

          return (
            <g key={teamId}>
              <polyline
                points={pointsAttr}
                fill="none"
                stroke={color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {sorted.map((p) => {
                const isLast = p.matchweek === lastMW
                return (
                  <circle
                    key={p.matchweek}
                    cx={xFor(p.matchweek, mws)}
                    cy={yFor(p.position)}
                    r={isLast ? 5 : 3}
                    fill={color}
                    stroke="#111827"
                    strokeWidth={isLast ? 2 : 1}
                  />
                )
              })}
            </g>
          )
        })}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3 justify-center">
        {teamOrder.map((teamId, ci) => {
          const team = data.find((d) => d.team_id === teamId)
          if (!team) return null
          return (
            <div key={teamId} className="flex items-center gap-1.5 text-xs text-gray-300">
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: COLORS[ci % COLORS.length] }}
              />
              {team.team_name}
            </div>
          )
        })}
      </div>
    </div>
  )
}
