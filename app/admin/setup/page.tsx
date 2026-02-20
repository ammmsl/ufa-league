'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { nextGameDay, toDatetimeLocal, toMVTIso } from '@/lib/schedule'

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

interface Pairing {
  teamA: Team
  teamB: Team
  count: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computePairings(teams: Team[], fixtures: Fixture[]): Pairing[] {
  const pairings: Pairing[] = []
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      const teamA = teams[i]
      const teamB = teams[j]
      const count = fixtures.filter(
        (f) =>
          (f.home_team_id === teamA.team_id && f.away_team_id === teamB.team_id) ||
          (f.home_team_id === teamB.team_id && f.away_team_id === teamA.team_id)
      ).length
      pairings.push({ teamA, teamB, count })
    }
  }
  return pairings
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatKickoff(iso: string) {
  return new Date(iso).toLocaleString('en-MV', {
    timeZone: 'Indian/Maldives',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
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
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                  ${done ? 'bg-green-600 text-white' : active ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'}`}
              >
                {done ? '✓' : n}
              </div>
              <span className={`text-xs mt-1 ${active ? 'text-white' : 'text-gray-500'}`}>
                {label}
              </span>
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

// ─── Step 1: Season review ────────────────────────────────────────────────────

function Step1Season({ onNext }: { onNext: () => void }) {
  const [season, setSeason] = useState<Season | null>(null)
  const [endDate, setEndDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/admin/season')
      .then((r) => r.json())
      .then((data) => {
        setSeason(data)
        setEndDate(data.end_date?.slice(0, 10) ?? '')
      })
      .catch(() => setError('Failed to load season'))
  }, [])

  async function handleSave() {
    if (!endDate) return
    setSaving(true)
    setError('')
    const res = await fetch('/api/admin/season', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ end_date: endDate }),
    })
    setSaving(false)
    if (!res.ok) {
      setError('Failed to save end date')
      return
    }
    const updated = await res.json()
    setSeason(updated)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!season) {
    return <p className="text-gray-400">{error || 'Loading season…'}</p>
  }

  return (
    <div className="max-w-lg">
      <h2 className="text-xl font-semibold mb-1">Step 1 — Season Review</h2>
      <p className="text-gray-400 text-sm mb-6">Confirm season details before proceeding.</p>

      <div className="space-y-4 bg-gray-900 rounded-lg p-5 mb-6">
        <Row label="Season">{season.season_name}</Row>
        <Row label="Status">
          <span
            className={
              season.status === 'active'
                ? 'text-green-400'
                : season.status === 'complete'
                  ? 'text-blue-400'
                  : 'text-yellow-400'
            }
          >
            {season.status}
          </span>
        </Row>
        <Row label="Start date">{formatDate(season.start_date)}</Row>
        {season.break_start && (
          <Row label="Break">
            {formatDate(season.break_start)} – {formatDate(season.break_end!)}
          </Row>
        )}
        <Row label="End date">
          <div className="flex items-center gap-3">
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white"
            />
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-sm px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded"
            >
              {saving ? 'Saving…' : saved ? 'Saved!' : 'Save'}
            </button>
          </div>
        </Row>
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      <div className="flex justify-end">
        <button onClick={onNext} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 rounded font-medium">
          Next: Teams →
        </button>
      </div>
    </div>
  )
}

// ─── Step 2: Team naming ──────────────────────────────────────────────────────

function Step2Teams({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const [teams, setTeams] = useState<Team[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadTeams = useCallback(() => {
    fetch('/api/admin/teams')
      .then((r) => r.json())
      .then(setTeams)
      .catch(() => setError('Failed to load teams'))
  }, [])

  useEffect(() => { loadTeams() }, [loadTeams])

  function startEdit(team: Team) {
    setEditingId(team.team_id)
    setEditValue(team.team_name)
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
    if (!res.ok) {
      setError('Failed to save team name')
      return
    }
    const updated = await res.json()
    setTeams((prev) =>
      prev.map((t) => (t.team_id === teamId ? { ...t, team_name: updated.team_name } : t))
    )
    setEditingId(null)
  }

  function handleKeyDown(e: React.KeyboardEvent, teamId: string) {
    if (e.key === 'Enter') saveEdit(teamId)
    if (e.key === 'Escape') setEditingId(null)
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-semibold mb-1">Step 2 — Team Naming</h2>
      <p className="text-gray-400 text-sm mb-6">
        Click a team name to rename it. Rosters are shown for reference.
      </p>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      <div className="space-y-4 mb-6">
        {teams.map((team) => (
          <div key={team.team_id} className="bg-gray-900 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              {editingId === team.team_id ? (
                <>
                  <input
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, team.team_id)}
                    onBlur={() => saveEdit(team.team_id)}
                    className="bg-gray-800 border border-blue-500 rounded px-2 py-1 text-white font-semibold flex-1"
                  />
                  <button
                    onClick={() => saveEdit(team.team_id)}
                    disabled={saving}
                    className="text-sm px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded"
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="text-sm px-2 py-1 text-gray-400 hover:text-white"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <span className="font-semibold text-lg flex-1">{team.team_name}</span>
                  <button
                    onClick={() => startEdit(team)}
                    className="text-sm text-blue-400 hover:text-blue-300"
                  >
                    Rename
                  </button>
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              {team.players.map((p) => (
                <span
                  key={p.player_id}
                  className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded-full"
                >
                  {p.display_name}
                </span>
              ))}
              {team.players.length === 0 && (
                <span className="text-xs text-gray-600">No players</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-between">
        <button onClick={onBack} className="px-5 py-2 bg-gray-700 hover:bg-gray-600 rounded font-medium">
          ← Back
        </button>
        <button onClick={onNext} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 rounded font-medium">
          Next: Fixtures →
        </button>
      </div>
    </div>
  )
}

// ─── Step 3: Fixture creation ─────────────────────────────────────────────────

const DEFAULT_VENUE = 'Vilimale Turf'

function Step3Fixtures({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const [teams, setTeams] = useState<Team[]>([])
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [season, setSeason] = useState<Season | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Form state
  const defaultKickoff = toDatetimeLocal(nextGameDay())
  const [homeTeamId, setHomeTeamId] = useState('')
  const [awayTeamId, setAwayTeamId] = useState('')
  const [kickoff, setKickoff] = useState(defaultKickoff)
  const [venue, setVenue] = useState(DEFAULT_VENUE)
  const [matchweek, setMatchweek] = useState(1)
  const [formError, setFormError] = useState('')
  const [lastCreated, setLastCreated] = useState<Fixture | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    const [teamsRes, fixturesRes, seasonRes] = await Promise.all([
      fetch('/api/admin/teams'),
      fetch('/api/admin/fixtures'),
      fetch('/api/admin/season'),
    ])
    const [teamsData, fixturesData, seasonData] = await Promise.all([
      teamsRes.json(),
      fixturesRes.json(),
      seasonRes.json(),
    ])
    setTeams(teamsData)
    setFixtures(fixturesData)
    setSeason(seasonData)

    // Seed home/away defaults
    if (teamsData.length >= 2 && !homeTeamId) {
      setHomeTeamId(teamsData[0].team_id)
      setAwayTeamId(teamsData[1].team_id)
    }
    // Suggest next matchweek
    if (fixturesData.length > 0) {
      setMatchweek(Math.max(...fixturesData.map((f: Fixture) => f.matchweek)) + 1)
    }
    setLoading(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadData() }, [loadData])

  const pairings = computePairings(teams, fixtures)
  const pairingCount = pairings.filter((p) => p.count >= 2).length

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')

    if (!homeTeamId || !awayTeamId) {
      setFormError('Select both teams')
      return
    }
    if (homeTeamId === awayTeamId) {
      setFormError('Home and away teams must be different')
      return
    }

    // Warn if pairing already has 2 fixtures
    const existing = pairings.find(
      (p) =>
        (p.teamA.team_id === homeTeamId && p.teamB.team_id === awayTeamId) ||
        (p.teamA.team_id === awayTeamId && p.teamB.team_id === homeTeamId)
    )
    if (existing && existing.count >= 2) {
      const ok = confirm(
        `${existing.teamA.team_name} vs ${existing.teamB.team_name} already has 2 fixtures scheduled. Add another?`
      )
      if (!ok) return
    }

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

    if (!res.ok) {
      const data = await res.json()
      setFormError(data.error ?? 'Failed to create fixture')
      return
    }

    const created = await res.json()
    setLastCreated(created)
    // Refresh fixtures for the pairing grid
    const updated = await fetch('/api/admin/fixtures').then((r) => r.json())
    setFixtures(updated)
    // Advance matchweek suggestion
    setMatchweek((w) => w + 1)
    // Reset teams to first pair
    if (teams.length >= 2) {
      setHomeTeamId(teams[0].team_id)
      setAwayTeamId(teams[1].team_id)
    }
  }

  if (loading) return <p className="text-gray-400">Loading…</p>

  return (
    <div className="max-w-3xl">
      <h2 className="text-xl font-semibold mb-1">Step 3 — Fixture Creation</h2>
      <p className="text-gray-400 text-sm mb-6">
        Create fixtures one at a time. The grid shows how many fixtures each pairing has (target: 2 each).
      </p>

      {/* Pairing grid */}
      <div className="bg-gray-900 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm text-gray-300">Pairing Grid</h3>
          <span className="text-xs text-gray-500">
            {pairingCount}/10 pairings complete · {fixtures.length} fixtures total
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {pairings.map((p) => (
            <div
              key={`${p.teamA.team_id}-${p.teamB.team_id}`}
              className="flex items-center justify-between bg-gray-800 rounded px-3 py-2"
            >
              <span className="text-sm text-gray-300">
                {p.teamA.team_name} <span className="text-gray-600">vs</span> {p.teamB.team_name}
              </span>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-full ml-2 ${
                  p.count >= 2
                    ? 'bg-green-900 text-green-300'
                    : p.count === 1
                      ? 'bg-yellow-900 text-yellow-300'
                      : 'bg-red-900 text-red-400'
                }`}
              >
                {p.count}/2
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Create fixture form */}
      <form onSubmit={handleCreate} className="bg-gray-900 rounded-lg p-5 mb-6 space-y-4">
        <h3 className="font-semibold">New Fixture</h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Home Team</label>
            <select
              value={homeTeamId}
              onChange={(e) => setHomeTeamId(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
            >
              {teams.map((t) => (
                <option key={t.team_id} value={t.team_id}>
                  {t.team_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Away Team</label>
            <select
              value={awayTeamId}
              onChange={(e) => setAwayTeamId(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
            >
              {teams.map((t) => (
                <option key={t.team_id} value={t.team_id}>
                  {t.team_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Kickoff time (MVT)</label>
            <input
              type="datetime-local"
              value={kickoff}
              onChange={(e) => setKickoff(e.target.value)}
              required
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Matchweek</label>
            <input
              type="number"
              min={1}
              value={matchweek}
              onChange={(e) => setMatchweek(Number(e.target.value))}
              required
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Venue</label>
          <input
            type="text"
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
          />
        </div>

        {formError && <p className="text-red-400 text-sm">{formError}</p>}
        {lastCreated && (
          <p className="text-green-400 text-sm">
            Created: {lastCreated.home_team_name ?? 'Fixture'} vs {lastCreated.away_team_name ?? ''}{' '}
            — {formatKickoff(lastCreated.kickoff_time)}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded font-medium"
        >
          {submitting ? 'Creating…' : 'Create Fixture'}
        </button>
      </form>

      <div className="flex justify-between">
        <button onClick={onBack} className="px-5 py-2 bg-gray-700 hover:bg-gray-600 rounded font-medium">
          ← Back
        </button>
        <button onClick={onNext} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 rounded font-medium">
          Next: Launch →
        </button>
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
    if (!res.ok) {
      setError('Failed to go live')
      return
    }
    const updated = await res.json()
    setSeason(updated)
    setLaunched(true)
  }

  return (
    <div className="max-w-lg">
      <h2 className="text-xl font-semibold mb-1">Step 4 — Launch</h2>
      <p className="text-gray-400 text-sm mb-6">Review the summary and go live when ready.</p>

      <div className="bg-gray-900 rounded-lg p-5 mb-6 space-y-3">
        {season && <Row label="Season">{season.season_name}</Row>}
        <Row label="Status">
          <span
            className={
              season?.status === 'active'
                ? 'text-green-400 font-semibold'
                : 'text-yellow-400'
            }
          >
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
          <p className="text-2xl mb-2">🎉</p>
          <p className="text-green-400 font-semibold text-lg mb-4">League is live!</p>
          <Link
            href="/admin/dashboard"
            className="inline-block px-5 py-2 bg-blue-600 hover:bg-blue-700 rounded font-medium"
          >
            Go to Dashboard
          </Link>
        </div>
      ) : (
        <div className="flex justify-between">
          <button
            onClick={onBack}
            className="px-5 py-2 bg-gray-700 hover:bg-gray-600 rounded font-medium"
          >
            ← Back
          </button>
          <button
            onClick={handleGoLive}
            disabled={launching}
            className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded font-semibold"
          >
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
        <Link href="/admin/dashboard" className="text-gray-400 hover:text-white text-sm">
          ← Dashboard
        </Link>
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
