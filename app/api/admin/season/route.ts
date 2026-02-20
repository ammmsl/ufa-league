import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'

export async function GET() {
  const rows = await sql`
    SELECT * FROM seasons ORDER BY created_at DESC LIMIT 1
  `
  if (rows.length === 0) {
    return NextResponse.json({ error: 'No season found' }, { status: 404 })
  }
  return NextResponse.json(rows[0])
}

export async function PATCH(req: NextRequest) {
  const { end_date } = await req.json()

  if (!end_date) {
    return NextResponse.json({ error: 'end_date is required' }, { status: 400 })
  }

  const result = await sql`
    UPDATE seasons
    SET end_date = ${end_date}
    WHERE season_id = (SELECT season_id FROM seasons ORDER BY created_at DESC LIMIT 1)
    RETURNING *
  `

  if (result.length === 0) {
    return NextResponse.json({ error: 'No season found' }, { status: 404 })
  }

  return NextResponse.json(result[0])
}
