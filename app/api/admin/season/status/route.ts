import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'

const VALID_STATUSES = ['draft', 'active', 'complete']

export async function PATCH(req: NextRequest) {
  const { status } = await req.json()

  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: `status must be one of: ${VALID_STATUSES.join(', ')}` },
      { status: 400 }
    )
  }

  const result = await sql`
    UPDATE seasons
    SET status = ${status}
    WHERE season_id = (SELECT season_id FROM seasons ORDER BY created_at DESC LIMIT 1)
    RETURNING *
  `

  if (result.length === 0) {
    return NextResponse.json({ error: 'No season found' }, { status: 404 })
  }

  return NextResponse.json(result[0])
}
