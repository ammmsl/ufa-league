import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params
  const { team_name } = await req.json()

  if (!team_name?.trim()) {
    return NextResponse.json({ error: 'team_name is required' }, { status: 400 })
  }

  const result = await sql`
    UPDATE teams
    SET team_name = ${team_name.trim()}
    WHERE team_id = ${teamId}
    RETURNING team_id, team_name
  `

  if (result.length === 0) {
    return NextResponse.json({ error: 'Team not found' }, { status: 404 })
  }

  return NextResponse.json(result[0])
}
