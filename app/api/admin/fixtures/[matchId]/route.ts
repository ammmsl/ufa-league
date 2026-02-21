import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const { matchId } = await params
  const { home_team_id, away_team_id, kickoff_time, venue, matchweek } = await req.json()

  if (!home_team_id || !away_team_id || !kickoff_time || !matchweek) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
  }

  if (home_team_id === away_team_id) {
    return NextResponse.json({ error: 'Teams must be different' }, { status: 400 })
  }

  const result = await sql`
    UPDATE fixtures
    SET
      home_team_id = ${home_team_id},
      away_team_id = ${away_team_id},
      kickoff_time = ${kickoff_time},
      venue        = ${venue ?? 'Vilimale Turf'},
      matchweek    = ${matchweek}
    WHERE match_id = ${matchId}
    RETURNING *
  `

  if (result.length === 0) {
    return NextResponse.json({ error: 'Fixture not found' }, { status: 404 })
  }

  return NextResponse.json(result[0])
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const { matchId } = await params

  const result = await sql`
    DELETE FROM fixtures WHERE match_id = ${matchId} RETURNING match_id
  `

  if (result.length === 0) {
    return NextResponse.json({ error: 'Fixture not found' }, { status: 404 })
  }

  return NextResponse.json({ deleted: matchId })
}
