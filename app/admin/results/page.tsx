'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'

type Fixture = {
  match_id: string
  matchweek: number
  home_team_id: string
  away_team_id: string
  home_team_name: string
  away_team_name: string
  status: string
  kickoff_time: string
}

type Player = {
  player_id: string
  display_name: string
}

type TeamWithRoster = {
  team_id: string
  team_name: string
  players: Player[]
}

type StatEntry = {
  goals: number
  assists: number
  blocks: number
}

const DEFAULT_STAT: StatEntry = { goals: 0, assists: 0, blocks: 0 }

export default function ResultEntryPage() {
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [allTeams, setAllTeams] = useState<TeamWithRoster[]>([])
  const [selectedMatchId, setSelectedMatchId] = useState('')
  const [absentIds, setAbsentIds] = useState<Set<string>>(new Set())
  const [scoreHome, setScoreHome] = useState(0)
  const [scoreAway, setScoreAway] = useState(0)
  const [stats, setStats] = useState<Record<string, StatEntry>>({})
  const [mvpId, setMvpId] = useState('')
  const [spiritHome, setSpiritHome] = useState('') // home team nominates a player from away
  const [spiritAway, setSpiritAway] = useState('') // away team nominates a player from home
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [loadingResult, setLoadingResult] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/fixtures').then((r) => r.json()),
      fetch('/api/admin/teams').then((r) => r.json()),
    ]).then(([fixturesData, teamsData]) => {
      setFixtures(
        (fixturesData as Fixture[]).filter(
          (f) => f.status === 'scheduled' || f.status === 'complete'
        )
      )
      setAllTeams(teamsData)
    })
  }, [])

  const selectedFixture = useMemo(
    () => fixtures.find((f) => f.match_id === selectedMatchId) ?? null,
    [fixtures, selectedMatchId]
  )

  const homeTeam = useMemo(
    () => allTeams.find((t) => t.team_id === selectedFixture?.home_team_id) ?? null,
    [allTeams, selectedFixture]
  )

  const awayTeam = useMemo(
    () => allTeams.find((t) => t.team_id === selectedFixture?.away_team_id) ?? null,
    [allTeams, selectedFixture]
  )

  const presentHomePlayers = useMemo(
    () => (homeTeam?.players ?? []).filter((p) => !absentIds.has(p.player_id)),
    [homeTeam, absentIds]
  )

  const presentAwayPlayers = useMemo(
    () => (awayTeam?.players ?? []).filter((p) => !absentIds.has(p.player_id)),
    [awayTeam, absentIds]
  )

  const allPresentPlayers = useMemo(() => {
    if (!homeTeam || !awayTeam) return []
    return [
      ...presentHomePlayers.map((p) => ({
        ...p,
        team_id: homeTeam.team_id,
        team_name: homeTeam.team_name,
      })),
      ...presentAwayPlayers.map((p) => ({
        ...p,
        team_id: awayTeam.team_id,
        team_name: awayTeam.team_name,
      })),
    ]
  }, [presentHomePlayers, presentAwayPlayers, homeTeam, awayTeam])

  function resetForm() {
    setAbsentIds(new Set())
    setScoreHome(0)
    setScoreAway(0)
    setStats({})
    setMvpId('')
    setSpiritHome('')
    setSpiritAway('')
    setSaveError('')
    setSaveSuccess(false)
  }

  async function onMatchSelect(matchId: string) {
    setSelectedMatchId(matchId)
    resetForm()
    if (!matchId) return

    const fixture = fixtures.find((f) => f.match_id === matchId)
    setLoadingResult(true)
    try {
      const res = await fetch(`/api/admin/results/${matchId}`)
      if (res.ok) {
        const data = await res.json()
        if (data) {
          setScoreHome(data.score_home)
          setScoreAway(data.score_away)
          setMvpId(data.mvp_player_id)
          setAbsentIds(
            new Set(data.absences.map((a: { player_id: string }) => a.player_id))
          )
          const statsMap: Record<string, StatEntry> = {}
          for (const s of data.player_stats) {
            statsMap[s.player_id] = {
              goals: s.goals,
              assists: s.assists,
              blocks: s.blocks,
            }
          }
          setStats(statsMap)
          const homeSpirit = data.spirit.find(
            (sn: { nominating_team_id: string }) =>
              sn.nominating_team_id === fixture?.home_team_id
          )
          const awaySpirit = data.spirit.find(
            (sn: { nominating_team_id: string }) =>
              sn.nominating_team_id === fixture?.away_team_id
          )
          setSpiritHome(homeSpirit?.nominated_player_id ?? '')
          setSpiritAway(awaySpirit?.nominated_player_id ?? '')
        }
      }
    } finally {
      setLoadingResult(false)
    }
  }

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
        ...(prev[playerId] ?? DEFAULT_STAT),
        [field]: Math.max(0, value),
      },
    }))
  }

  function clampScore(value: number) {
    return Math.min(11, Math.max(0, value))
  }

  async function handleSave() {
    if (!selectedMatchId || !selectedFixture || !homeTeam || !awayTeam) return
    if (!mvpId) {
      setSaveError('Please select an MVP before saving')
      return
    }

    setSaving(true)
    setSaveError('')
    setSaveSuccess(false)

    const playerTeamMap: Record<string, string> = {}
    homeTeam.players.forEach((p) => {
      playerTeamMap[p.player_id] = homeTeam.team_id
    })
    awayTeam.players.forEach((p) => {
      playerTeamMap[p.player_id] = awayTeam.team_id
    })

    const player_stats = allPresentPlayers.map((p) => ({
      player_id: p.player_id,
      team_id: p.team_id,
      goals: stats[p.player_id]?.goals ?? 0,
      assists: stats[p.player_id]?.assists ?? 0,
      blocks: stats[p.player_id]?.blocks ?? 0,
    }))

    const absences = [...absentIds].map((pid) => ({
      player_id: pid,
      team_id: playerTeamMap[pid],
    }))

    const spirit = []
    if (spiritHome) {
      spirit.push({
        nominating_team_id: selectedFixture.home_team_id,
        nominated_player_id: spiritHome,
      })
    }
    if (spiritAway) {
      spirit.push({
        nominating_team_id: selectedFixture.away_team_id,
        nominated_player_id: spiritAway,
      })
    }

    try {
      const res = await fetch('/api/admin/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          match_id: selectedMatchId,
          score_home: scoreHome,
          score_away: scoreAway,
          mvp_player_id: mvpId,
          player_stats,
          absences,
          spirit,
        }),
      })

      if (res.ok) {
        setSaveSuccess(true)
        setFixtures((prev) =>
          prev.map((f) =>
            f.match_id === selectedMatchId ? { ...f, status: 'complete' } : f
          )
        )
      } else {
        const { error } = await res.json()
        setSaveError(error ?? 'Failed to save result')
      }
    } catch {
      setSaveError('Network error — please try again')
    } finally {
      setSaving(false)
    }
  }

  const inputCls =
    'bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500'

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/admin/dashboard" className="text-gray-400 hover:text-white text-sm">
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-bold">Result Entry</h1>
      </div>

      {/* Match Selector */}
      <div className="bg-gray-900 rounded-lg p-5 mb-6">
        <label className="block text-sm font-medium text-gray-400 mb-2">Select Match</label>
        <select
          value={selectedMatchId}
          onChange={(e) => onMatchSelect(e.target.value)}
          className={`w-full ${inputCls}`}
        >
          <option value="">— Choose a fixture —</option>
          {fixtures.map((f) => (
            <option key={f.match_id} value={f.match_id}>
              {`MW${f.matchweek} · ${f.home_team_name} vs ${f.away_team_name}${f.status === 'complete' ? ' ✓' : ''}`}
            </option>
          ))}
        </select>
      </div>

      {loadingResult && (
        <p className="text-gray-400 text-center py-8">Loading match data…</p>
      )}

      {selectedFixture && homeTeam && awayTeam && !loadingResult && (
        <>
          {/* Absent Players */}
          <div className="bg-gray-900 rounded-lg p-5 mb-6">
            <h2 className="font-semibold mb-4">Absent Players</h2>
            <div className="grid grid-cols-2 gap-8">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">
                  {homeTeam.team_name}
                </p>
                <div className="space-y-2">
                  {homeTeam.players.map((p) => (
                    <label
                      key={p.player_id}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={absentIds.has(p.player_id)}
                        onChange={() => toggleAbsent(p.player_id)}
                        className="w-4 h-4 accent-blue-500"
                      />
                      <span
                        className={
                          absentIds.has(p.player_id)
                            ? 'text-gray-500 line-through'
                            : 'text-white'
                        }
                      >
                        {p.display_name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">
                  {awayTeam.team_name}
                </p>
                <div className="space-y-2">
                  {awayTeam.players.map((p) => (
                    <label
                      key={p.player_id}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={absentIds.has(p.player_id)}
                        onChange={() => toggleAbsent(p.player_id)}
                        className="w-4 h-4 accent-blue-500"
                      />
                      <span
                        className={
                          absentIds.has(p.player_id)
                            ? 'text-gray-500 line-through'
                            : 'text-white'
                        }
                      >
                        {p.display_name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Score */}
          <div className="bg-gray-900 rounded-lg p-5 mb-6">
            <h2 className="font-semibold mb-4">Score</h2>
            <div className="flex items-center justify-center gap-8">
              <div className="text-center">
                <p className="text-sm text-gray-400 mb-2">{homeTeam.team_name}</p>
                <input
                  type="number"
                  min={0}
                  max={11}
                  value={scoreHome}
                  onChange={(e) => setScoreHome(clampScore(Number(e.target.value)))}
                  className="w-20 text-center text-3xl font-bold bg-gray-800 border border-gray-700 rounded px-2 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <span className="text-3xl text-gray-500 font-bold mt-6">–</span>
              <div className="text-center">
                <p className="text-sm text-gray-400 mb-2">{awayTeam.team_name}</p>
                <input
                  type="number"
                  min={0}
                  max={11}
                  value={scoreAway}
                  onChange={(e) => setScoreAway(clampScore(Number(e.target.value)))}
                  className="w-20 text-center text-3xl font-bold bg-gray-800 border border-gray-700 rounded px-2 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Player Stats */}
          <div className="bg-gray-900 rounded-lg p-5 mb-6">
            <h2 className="font-semibold mb-4">Player Stats</h2>
            {allPresentPlayers.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">
                All players marked absent
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-800">
                    <th className="text-left py-2 pr-4 font-medium">Player</th>
                    <th className="text-left py-2 pr-4 font-medium text-gray-500">Team</th>
                    <th className="text-center py-2 px-3 w-24 font-medium">Goals</th>
                    <th className="text-center py-2 px-3 w-24 font-medium">Assists</th>
                    <th className="text-center py-2 px-3 w-24 font-medium">Blocks</th>
                  </tr>
                </thead>
                <tbody>
                  {allPresentPlayers.map((p) => (
                    <tr key={p.player_id} className="border-b border-gray-800/40">
                      <td className="py-2 pr-4 font-medium">{p.display_name}</td>
                      <td className="py-2 pr-4 text-gray-500 text-xs">{p.team_name}</td>
                      {(['goals', 'assists', 'blocks'] as const).map((field) => (
                        <td key={field} className="py-1 px-3 text-center">
                          <input
                            type="number"
                            min={0}
                            value={stats[p.player_id]?.[field] ?? 0}
                            onChange={(e) =>
                              setStat(p.player_id, field, Number(e.target.value))
                            }
                            className="w-16 text-center bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white focus:outline-none focus:border-blue-500"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* MVP */}
          <div className="bg-gray-900 rounded-lg p-5 mb-6">
            <h2 className="font-semibold mb-4">MVP</h2>
            <div className="grid grid-cols-2 gap-8">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">
                  {homeTeam.team_name}
                </p>
                <div className="space-y-2">
                  {presentHomePlayers.map((p) => (
                    <label
                      key={p.player_id}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <input
                        type="radio"
                        name="mvp"
                        value={p.player_id}
                        checked={mvpId === p.player_id}
                        onChange={() => setMvpId(p.player_id)}
                        className="w-4 h-4 accent-yellow-400"
                      />
                      <span>{p.display_name}</span>
                    </label>
                  ))}
                  {presentHomePlayers.length === 0 && (
                    <p className="text-gray-600 text-xs">No present players</p>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">
                  {awayTeam.team_name}
                </p>
                <div className="space-y-2">
                  {presentAwayPlayers.map((p) => (
                    <label
                      key={p.player_id}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <input
                        type="radio"
                        name="mvp"
                        value={p.player_id}
                        checked={mvpId === p.player_id}
                        onChange={() => setMvpId(p.player_id)}
                        className="w-4 h-4 accent-yellow-400"
                      />
                      <span>{p.display_name}</span>
                    </label>
                  ))}
                  {presentAwayPlayers.length === 0 && (
                    <p className="text-gray-600 text-xs">No present players</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Spirit Nominations */}
          <div className="bg-gray-900 rounded-lg p-5 mb-6">
            <h2 className="font-semibold mb-4">Spirit Nominations</h2>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-gray-400 mb-2">
                  {homeTeam.team_name} nominates from {awayTeam.team_name}
                </p>
                <select
                  value={spiritHome}
                  onChange={(e) => setSpiritHome(e.target.value)}
                  className={`w-full ${inputCls}`}
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
                <p className="text-sm text-gray-400 mb-2">
                  {awayTeam.team_name} nominates from {homeTeam.team_name}
                </p>
                <select
                  value={spiritAway}
                  onChange={(e) => setSpiritAway(e.target.value)}
                  className={`w-full ${inputCls}`}
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

          {/* Status banners */}
          {saveSuccess && (
            <div className="mb-4 p-3 bg-green-900/50 border border-green-700 rounded-lg text-green-300 text-sm font-medium">
              Saved ✓ — result recorded successfully
            </div>
          )}
          {saveError && (
            <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm">
              {saveError}
            </div>
          )}

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg font-semibold transition-colors"
          >
            {saving ? 'Saving…' : 'Save Result'}
          </button>
        </>
      )}
    </div>
  )
}
