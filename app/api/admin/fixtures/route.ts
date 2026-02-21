import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'

export async function GET() {
  const rows = await sql`
    SELECT
      f.match_id,
      f.season_id,
      f.home_team_id,
      f.away_team_id,
      f.kickoff_time,
      f.venue,
      f.status,
      f.matchweek,
      ht.team_name AS home_team_name,
      at.team_name  AS away_team_name
    FROM fixtures f
    JOIN teams ht ON ht.team_id = f.home_team_id
    JOIN teams at ON at.team_id = f.away_team_id
    ORDER BY f.kickoff_time
  `
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const { season_id, home_team_id, away_team_id, kickoff_time, venue, matchweek } =
    await req.json()

  if (!season_id || !home_team_id || !away_team_id || !kickoff_time || !matchweek) {
    return NextResponse.json(
      { error: 'season_id, home_team_id, away_team_id, kickoff_time, and matchweek are required' },
      { status: 400 }
    )
  }

  if (home_team_id === away_team_id) {
    return NextResponse.json(
      { error: 'home_team_id and away_team_id must be different' },
      { status: 400 }
    )
  }

  const result = await sql`
    INSERT INTO fixtures
      (season_id, home_team_id, away_team_id, kickoff_time, venue, matchweek)
    VALUES
      (${season_id}, ${home_team_id}, ${away_team_id},
       ${kickoff_time}, ${venue ?? 'Vilimale Turf'}, ${matchweek})
    RETURNING *
  `

  return NextResponse.json(result[0], { status: 201 })
}

/** Delete all fixtures for the current season (used by auto-schedule reset). */
export async function DELETE() {
  const season = await sql`
    SELECT season_id FROM seasons ORDER BY created_at DESC LIMIT 1
  `
  if (season.length === 0) {
    return NextResponse.json({ error: 'No season found' }, { status: 404 })
  }

  const result = await sql`
    DELETE FROM fixtures WHERE season_id = ${season[0].season_id} RETURNING match_id
  `
  return NextResponse.json({ deleted: result.length })
}
