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
  const body = await req.json()

  const start_date: string | null = body.start_date || null
  const end_date: string | null = body.end_date || null
  // Allow explicitly clearing break dates by sending empty string or null
  const break_start: string | null = body.break_start || null
  const break_end: string | null = body.break_end || null

  if (!end_date) {
    return NextResponse.json({ error: 'end_date is required' }, { status: 400 })
  }

  const result = await sql`
    UPDATE seasons
    SET
      start_date  = COALESCE(${start_date}, start_date),
      end_date    = ${end_date},
      break_start = ${break_start},
      break_end   = ${break_end}
    WHERE season_id = (SELECT season_id FROM seasons ORDER BY created_at DESC LIMIT 1)
    RETURNING *
  `

  if (result.length === 0) {
    return NextResponse.json({ error: 'No season found' }, { status: 404 })
  }

  return NextResponse.json(result[0])
}
