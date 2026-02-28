'use client'

import { useState, useMemo } from 'react'

type Player = { player_id: string; display_name: string }
type Team = { team_id: string; team_name: string }
type StatEntry = { goals: number; assists: number; blocks: number }

type ExistingResult = {
  score_home: number
  score_away: number
  mvp_player_id: string
  player_stats: { player_id: string; team_id: string; goals: number; assists: number; blocks: number }[]
  absences: { player_id: string; team_id: string }[]
  spirit: { nominating_team_id: string; nominated_player_id: string }[]
}

interface Props {
  matchId: string
  homeTeam: Team
  awayTeam: Team
  homePlayers: Player[]
  awayPlayers: Player[]
  existingResult?: ExistingResult | null
  onCancel?: () => void
}

export default function AdminResultForm({
  matchId,
  homeTeam,
  awayTeam,
  homePlayers,
  awayPlayers,
  existingResult,
  onCancel,
}: Props) {
  const [scoreHome, setScoreHome] = useState(existingResult?.score_home ?? 0)
  const [scoreAway, setScoreAway] = useState(existingResult?.score_away ?? 0)
  const [absentIds, setAbsentIds] = useState<Set<string>>(
    new Set(existingResult?.absences.map((a) => a.player_id) ?? [])
  )
  const [stats, setStats] = useState<Record<string, StatEntry>>(() => {
    const map: Record<string, StatEntry> = {}
    for (const s of existingResult?.player_stats ?? []) {
      map[s.player_id] = { goals: Number(s.goals), assists: Number(s.assists), blocks: Number(s.blocks) }
    }
    return map
  })
  const [mvpId, setMvpId] = useState(
    existingResult?.mvp_player_id ? String(existingResult.mvp_player_id) : ''
  )
  const [spiritHome, setSpiritHome] = useState(
    existingResult?.spirit.find((s) => String(s.nominating_team_id) === homeTeam.team_id)
      ?.nominated_player_id
      ? String(
          existingResult.spirit.find((s) => String(s.nominating_team_id) === homeTeam.team_id)!
            .nominated_player_id
        )
      : ''
  )
  const [spiritAway, setSpiritAway] = useState(
    existingResult?.spirit.find((s) => String(s.nominating_team_id) === awayTeam.team_id)
      ?.nominated_player_id
      ? String(
          existingResult.spirit.find((s) => String(s.nominating_team_id) === awayTeam.team_id)!
            .nominated_player_id
        )
      : ''
  )
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [goalsWarning, setGoalsWarning] = useState('')

  const presentHomePlayers = useMemo(
    () => homePlayers.filter((p) => !absentIds.has(p.player_id)),
    [homePlayers, absentIds]
  )
  const presentAwayPlayers = useMemo(
    () => awayPlayers.filter((p) => !absentIds.has(p.player_id)),
    [awayPlayers, absentIds]
  )
  const allPresentPlayers = useMemo(
    () => [
      ...presentHomePlayers.map((p) => ({ ...p, team_id: homeTeam.team_id })),
      ...presentAwayPlayers.map((p) => ({ ...p, team_id: awayTeam.team_id })),
    ],
    [presentHomePlayers, presentAwayPlayers, homeTeam, awayTeam]
  )

  function toggleAbsent(playerId: string) {
    const next = new Set(absentIds)
    if (next.has(playerId)) {
      next.delete(playerId)
    } else {
      next.add(playerId)
      if (mvpId === playerId) setMvpId('')
      if (spiritHome === playerId) setSpiritHome('')
      if (spiritAway === playerId) setSpiritAway('')
    }
    setAbsentIds(next)
  }

  function setStat(playerId: string, field: keyof StatEntry, value: number) {
    setStats((prev) => ({
      ...prev,
      [playerId]: {
        ...(prev[playerId] ?? { goals: 0, assists: 0, blocks: 0 }),
        [field]: Math.max(0, value),
      },
    }))
  }

  function clamp(value: number) {
    return Math.min(11, Math.max(0, value))
  }

  async function handleSave() {
    setSaveError('')
    setGoalsWarning('')

    if (!mvpId) {
      setSaveError('Select an MVP before saving.')
      return
    }

    // Goals warning — non-blocking
    const homeGoals = presentHomePlayers.reduce((sum, p) => sum + (stats[p.player_id]?.goals ?? 0), 0)
    const awayGoals = presentAwayPlayers.reduce((sum, p) => sum + (stats[p.player_id]?.goals ?? 0), 0)
    const warnings: string[] = []
    if (homeGoals > scoreHome) {
      warnings.push(
        `Goals entered for ${homeTeam.team_name} (${homeGoals}) exceed the match score (${scoreHome}).`
      )
    }
    if (awayGoals > scoreAway) {
      warnings.push(
        `Goals entered for ${awayTeam.team_name} (${awayGoals}) exceed the match score (${scoreAway}).`
      )
    }
    if (warnings.length > 0) setGoalsWarning(warnings.join(' ') + ' Check before saving.')

    setSaving(true)

    const player_stats = allPresentPlayers.map((p) => ({
      player_id: p.player_id,
      team_id: p.team_id,
      goals: stats[p.player_id]?.goals ?? 0,
      assists: stats[p.player_id]?.assists ?? 0,
      blocks: stats[p.player_id]?.blocks ?? 0,
    }))

    const absences = [...absentIds].map((pid) => ({
      player_id: pid,
      team_id: homePlayers.some((p) => p.player_id === pid) ? homeTeam.team_id : awayTeam.team_id,
    }))

    const spirit: { nominating_team_id: string; nominated_player_id: string }[] = []
    if (spiritHome) spirit.push({ nominating_team_id: homeTeam.team_id, nominated_player_id: spiritHome })
    if (spiritAway) spirit.push({ nominating_team_id: awayTeam.team_id, nominated_player_id: spiritAway })

    try {
      const res = await fetch('/api/admin/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          match_id: matchId,
          score_home: scoreHome,
          score_away: scoreAway,
          mvp_player_id: mvpId,
          player_stats,
          absences,
          spirit,
        }),
      })

      if (res.ok) {
        window.location.reload()
      } else {
        const data = await res.json()
        setSaveError(data.error ?? 'Failed to save result')
      }
    } catch {
      setSaveError('Network error — please try again')
    } finally {
      setSaving(false)
    }
  }

  const inputBase =
    'bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500'

  return (
    <div className="space-y-5">
      {/* 1. Score */}
      <div className="bg-gray-900 rounded-xl p-5">
        <h3 className="text-xs text-gray-400 uppercase tracking-widest mb-4">Score</h3>
        <div className="flex items-center justify-center gap-8">
          <div className="text-center">
            <p className="text-sm text-gray-400 mb-3">{homeTeam.team_name}</p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setScoreHome(clamp(scoreHome - 1))}
                className="w-9 h-9 rounded-full bg-gray-700 hover:bg-gray-600 text-white font-bold text-lg transition-colors"
              >
                −
              </button>
              <span className="text-4xl font-bold tabular-nums w-12 text-center">{scoreHome}</span>
              <button
                onClick={() => setScoreHome(clamp(scoreHome + 1))}
                className="w-9 h-9 rounded-full bg-gray-700 hover:bg-gray-600 text-white font-bold text-lg transition-colors"
              >
                +
              </button>
            </div>
          </div>
          <span className="text-3xl text-gray-600 font-light mt-8">–</span>
          <div className="text-center">
            <p className="text-sm text-gray-400 mb-3">{awayTeam.team_name}</p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setScoreAway(clamp(scoreAway - 1))}
                className="w-9 h-9 rounded-full bg-gray-700 hover:bg-gray-600 text-white font-bold text-lg transition-colors"
              >
                −
              </button>
              <span className="text-4xl font-bold tabular-nums w-12 text-center">{scoreAway}</span>
              <button
                onClick={() => setScoreAway(clamp(scoreAway + 1))}
                className="w-9 h-9 rounded-full bg-gray-700 hover:bg-gray-600 text-white font-bold text-lg transition-colors"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Absent Players */}
      <div className="bg-gray-900 rounded-xl p-5">
        <h3 className="text-xs text-gray-400 uppercase tracking-widest mb-4">Absent Players</h3>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-xs text-gray-500 mb-3">{homeTeam.team_name}</p>
            <div className="space-y-2">
              {homePlayers.map((p) => (
                <label key={p.player_id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={absentIds.has(p.player_id)}
                    onChange={() => toggleAbsent(p.player_id)}
                    className="w-4 h-4 accent-blue-500"
                  />
                  <span
                    className={`text-sm ${absentIds.has(p.player_id) ? 'text-gray-500 line-through' : 'text-gray-200'}`}
                  >
                    {p.display_name}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-3">{awayTeam.team_name}</p>
            <div className="space-y-2">
              {awayPlayers.map((p) => (
                <label key={p.player_id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={absentIds.has(p.player_id)}
                    onChange={() => toggleAbsent(p.player_id)}
                    className="w-4 h-4 accent-blue-500"
                  />
                  <span
                    className={`text-sm ${absentIds.has(p.player_id) ? 'text-gray-500 line-through' : 'text-gray-200'}`}
                  >
                    {p.display_name}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Per-player stats */}
      <div className="bg-gray-900 rounded-xl p-5">
        <h3 className="text-xs text-gray-400 uppercase tracking-widest mb-4">Player Stats</h3>
        {allPresentPlayers.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">All players marked absent</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="text-left py-2 pr-3 font-normal">Player</th>
                <th className="text-center py-2 px-2 font-normal w-16">G</th>
                <th className="text-center py-2 px-2 font-normal w-16">A</th>
                <th className="text-center py-2 px-2 font-normal w-16">B</th>
              </tr>
            </thead>
            <tbody>
              {allPresentPlayers.map((p, i) => {
                const isFirstAway = i === presentHomePlayers.length && presentAwayPlayers.length > 0
                return (
                  <tr
                    key={p.player_id}
                    className={`border-b border-gray-800/40 ${isFirstAway ? 'border-t-2 border-t-gray-700' : ''}`}
                  >
                    <td className="py-1.5 pr-3 text-gray-200">{p.display_name}</td>
                    {(['goals', 'assists', 'blocks'] as const).map((field) => (
                      <td key={field} className="py-1 px-2 text-center">
                        <input
                          type="number"
                          min={0}
                          value={stats[p.player_id]?.[field] ?? 0}
                          onChange={(e) => setStat(p.player_id, field, Number(e.target.value))}
                          className={`w-12 text-center ${inputBase} px-1 py-0.5 text-sm`}
                        />
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 4. MVP */}
      <div className="bg-gray-900 rounded-xl p-5">
        <h3 className="text-xs text-gray-400 uppercase tracking-widest mb-4">MVP</h3>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-xs text-gray-500 mb-3">{homeTeam.team_name}</p>
            <div className="space-y-2">
              {presentHomePlayers.map((p) => (
                <label key={p.player_id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name={`mvp-${matchId}`}
                    value={p.player_id}
                    checked={mvpId === p.player_id}
                    onChange={() => setMvpId(p.player_id)}
                    className="w-4 h-4 accent-yellow-400"
                  />
                  <span className="text-sm text-gray-200">{p.display_name}</span>
                </label>
              ))}
              {presentHomePlayers.length === 0 && (
                <p className="text-xs text-gray-600">No present players</p>
              )}
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-3">{awayTeam.team_name}</p>
            <div className="space-y-2">
              {presentAwayPlayers.map((p) => (
                <label key={p.player_id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name={`mvp-${matchId}`}
                    value={p.player_id}
                    checked={mvpId === p.player_id}
                    onChange={() => setMvpId(p.player_id)}
                    className="w-4 h-4 accent-yellow-400"
                  />
                  <span className="text-sm text-gray-200">{p.display_name}</span>
                </label>
              ))}
              {presentAwayPlayers.length === 0 && (
                <p className="text-xs text-gray-600">No present players</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 5. Spirit Nominations */}
      <div className="bg-gray-900 rounded-xl p-5">
        <h3 className="text-xs text-gray-400 uppercase tracking-widest mb-4">Spirit Nominations</h3>
        <div className="space-y-4">
          <div>
            <p className="text-xs text-gray-500 mb-2">
              {homeTeam.team_name} nominates from {awayTeam.team_name}
            </p>
            <select
              value={spiritHome}
              onChange={(e) => setSpiritHome(e.target.value)}
              className={`w-full ${inputBase} px-3 py-2`}
            >
              <option value="">— No nomination —</option>
              {presentAwayPlayers.map((p) => (
                <option key={p.player_id} value={p.player_id}>
                  {p.display_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-2">
              {awayTeam.team_name} nominates from {homeTeam.team_name}
            </p>
            <select
              value={spiritAway}
              onChange={(e) => setSpiritAway(e.target.value)}
              className={`w-full ${inputBase} px-3 py-2`}
            >
              <option value="">— No nomination —</option>
              {presentHomePlayers.map((p) => (
                <option key={p.player_id} value={p.player_id}>
                  {p.display_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Goals warning */}
      {goalsWarning && (
        <div className="p-3 bg-yellow-900/40 border border-yellow-700 rounded-lg text-yellow-300 text-sm">
          {goalsWarning}
        </div>
      )}

      {/* Save error */}
      {saveError && (
        <div className="p-3 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">
          {saveError}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {onCancel && (
          <button
            onClick={onCancel}
            className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg font-semibold transition-colors"
        >
          {saving ? 'Saving…' : 'Save Result'}
        </button>
      </div>
    </div>
  )
}
