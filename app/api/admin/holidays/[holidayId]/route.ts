import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ holidayId: string }> }
) {
  const { holidayId } = await params

  const result = await sql`
    DELETE FROM season_holidays
    WHERE holiday_id = ${holidayId}
    RETURNING holiday_id
  `

  if (result.length === 0) {
    return NextResponse.json(
      { error: 'Holiday not found' },
      { status: 404 }
    )
  }

  return NextResponse.json({ deleted: result[0].holiday_id })
}
