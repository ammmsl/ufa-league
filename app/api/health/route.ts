import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const result = await sql`SELECT 1 AS ok`
    return NextResponse.json({ status: 'ok', db: result[0].ok })
  } catch (error) {
    return NextResponse.json(
      { status: 'error', message: String(error) },
      { status: 500 }
    )
  }
}
