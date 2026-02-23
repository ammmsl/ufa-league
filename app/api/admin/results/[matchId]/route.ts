import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const { matchId } = await params

  // Check if a result exists for this match
  const existing = await sql`
    SELECT match_result_id FROM match_results WHERE match_id = ${matchId}
  `
  if (existing.length === 0) {
    return NextResponse.json(null, { status: 404 })
  }

  const [mr, stats, absences, spirit] = await Promise.all([
    sql`
      SELECT score_home, score_away, mvp_player_id
      FROM match_results
      WHERE match_id = ${matchId}
    `,
    sql`
      SELECT player_id, team_id, goals, assists, blocks
      FROM player_match_stats
      WHERE match_id = ${matchId}
    `,
    sql`
      SELECT player_id, team_id
      FROM match_absences
      WHERE match_id = ${matchId}
    `,
    sql`
      SELECT nominating_team_id, nominated_player_id
      FROM spirit_nominations
      WHERE match_id = ${matchId}
    `,
  ])

  return NextResponse.json({
    match_id: matchId,
    score_home: mr[0].score_home,
    score_away: mr[0].score_away,
    mvp_player_id: mr[0].mvp_player_id,
    player_stats: stats,
    absences,
    spirit,
  })
}
