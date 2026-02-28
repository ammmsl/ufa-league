import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'

export async function GET(req: NextRequest) {
  const seasonId = req.nextUrl.searchParams.get('seasonId')

  if (!seasonId) {
    return NextResponse.json(
      { error: 'seasonId query parameter is required' },
      { status: 400 }
    )
  }

  const rows = await sql`
    SELECT *
    FROM season_holidays
    WHERE season_id = ${seasonId}
    ORDER BY start_date ASC
  `

  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const { season_id, start_date, end_date, name } = await req.json()

  if (!season_id || !start_date || !end_date || !name) {
    return NextResponse.json(
      { error: 'season_id, start_date, end_date, and name are required' },
      { status: 400 }
    )
  }

  if (end_date < start_date) {
    return NextResponse.json(
      { error: 'end_date must not be before start_date' },
      { status: 400 }
    )
  }

  const result = await sql`
    INSERT INTO season_holidays (season_id, start_date, end_date, name)
    VALUES (${season_id}, ${start_date}, ${end_date}, ${name})
    RETURNING *
  `

  return NextResponse.json(result[0], { status: 201 })
}
