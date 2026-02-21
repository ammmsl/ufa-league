import { NextResponse } from 'next/server'
import sql from '@/lib/db'

export async function GET() {
  const teams = await sql`
    SELECT
      t.team_id,
      t.team_name,
      t.season_id,
      COALESCE(
        json_agg(
          json_build_object('player_id', p.player_id, 'display_name', p.display_name)
          ORDER BY p.display_name
        ) FILTER (WHERE p.player_id IS NOT NULL),
        '[]'
      ) AS players
    FROM teams t
    LEFT JOIN players p ON p.team_id = t.team_id AND p.is_active = true
    GROUP BY t.team_id, t.team_name, t.season_id
    ORDER BY t.team_name
  `
  return NextResponse.json(teams)
}
