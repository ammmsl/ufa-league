import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'

interface BulkUpdate {
  match_id: string
  kickoff_time: string
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { updates } = body as { updates: BulkUpdate[] }

  if (!Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json(
      { error: 'updates must be a non-empty array' },
      { status: 400 }
    )
  }

  for (const u of updates) {
    if (!u.match_id || !u.kickoff_time) {
      return NextResponse.json(
        { error: 'Each update must have match_id and kickoff_time' },
        { status: 400 }
      )
    }
  }

  try {
    let updated = 0
    await sql.begin(async (tx) => {
      const q = tx as unknown as typeof sql
      for (const u of updates) {
        await q`
          UPDATE fixtures
          SET kickoff_time = ${u.kickoff_time}, updated_at = now()
          WHERE match_id = ${u.match_id}
        `
        updated++
      }
    })
    return NextResponse.json({ updated })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Database error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
