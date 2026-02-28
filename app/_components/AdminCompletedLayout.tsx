'use client'

import { useState } from 'react'
import AdminResultForm from './AdminResultForm'

type Player = { player_id: string; display_name: string }
type Team = { team_id: string; team_name: string }

type ExistingResult = {
  score_home: number
  score_away: number
  mvp_player_id: string
  player_stats: { player_id: string; team_id: string; goals: number; assists: number; blocks: number }[]
  absences: { player_id: string; team_id: string }[]
  spirit: { nominating_team_id: string; nominated_player_id: string }[]
}

interface Props {
  children: React.ReactNode
  isAdmin: boolean
  matchId: string
  homeTeam: Team
  awayTeam: Team
  homePlayers: Player[]
  awayPlayers: Player[]
}

export default function AdminCompletedLayout({
  children,
  isAdmin,
  matchId,
  homeTeam,
  awayTeam,
  homePlayers,
  awayPlayers,
}: Props) {
  const [editMode, setEditMode] = useState(false)
  const [loading, setLoading] = useState(false)
  const [existingResult, setExistingResult] = useState<ExistingResult | null>(null)

  async function enterEdit() {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/results/${matchId}`)
      if (res.ok) {
        const data = await res.json()
        setExistingResult(data)
      }
    } finally {
      setLoading(false)
      setEditMode(true)
    }
  }

  function cancelEdit() {
    setEditMode(false)
    setExistingResult(null)
  }

  if (editMode) {
    return (
      <>
        <div className="mb-4">
          <button
            onClick={cancelEdit}
            className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            ← Back to result
          </button>
        </div>
        <h2 className="text-base font-semibold text-white mb-5">Edit Result</h2>
        <AdminResultForm
          matchId={matchId}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          homePlayers={homePlayers}
          awayPlayers={awayPlayers}
          existingResult={existingResult}
          onCancel={cancelEdit}
        />
      </>
    )
  }

  return (
    <>
      {children}
      {isAdmin && (
        <div className="mt-6 pt-6 border-t border-gray-800">
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-2">Loading…</p>
          ) : (
            <button
              onClick={enterEdit}
              className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-300 rounded-lg text-sm transition-colors"
            >
              Edit Result
            </button>
          )}
        </div>
      )}
    </>
  )
}
