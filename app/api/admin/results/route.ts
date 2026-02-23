import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'

interface PlayerStatInput {
  player_id: string
  team_id: string
  goals: number
  assists: number
  blocks: number
}

interface AbsenceInput {
  player_id: string
  team_id: string
}

interface SpiritInput {
  nominating_team_id: string
  nominated_player_id: string
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    match_id,
    score_home,
    score_away,
    mvp_player_id,
    player_stats,
    absences,
    spirit,
  } = body as {
    match_id: string
    score_home: number
    score_away: number
    mvp_player_id: string
    player_stats: PlayerStatInput[]
    absences: AbsenceInput[]
    spirit: SpiritInput[]
  }

  // Validate required fields
  if (!match_id || score_home == null || score_away == null || !mvp_player_id) {
    return NextResponse.json(
      { error: 'match_id, score_home, score_away, and mvp_player_id are required' },
      { status: 400 }
    )
  }

  if (score_home < 0 || score_home > 11 || score_away < 0 || score_away > 11) {
    return NextResponse.json(
      { error: 'Scores must be between 0 and 11' },
      { status: 400 }
    )
  }

  // Season-complete guard — query before entering the transaction
  const guard = await sql`
    SELECT s.status
    FROM fixtures f
    JOIN seasons s ON s.season_id = f.season_id
    WHERE f.match_id = ${match_id}
  `

  if (guard.length === 0) {
    return NextResponse.json({ error: 'Match not found' }, { status: 404 })
  }

  if (guard[0].status === 'complete') {
    return NextResponse.json(
      { error: 'Season is complete — result entry is locked' },
      { status: 403 }
    )
  }

  try {
    await sql.begin(async (tx) => {
      // Cast away the TypeScript limitation where Omit<Sql,...> loses call signatures
      const q = tx as unknown as typeof sql

      // 1. UPSERT match_results
      await q`
        INSERT INTO match_results (match_id, score_home, score_away, mvp_player_id, resolved_at)
        VALUES (${match_id}, ${score_home}, ${score_away}, ${mvp_player_id}, now())
        ON CONFLICT (match_id) DO UPDATE SET
          score_home    = EXCLUDED.score_home,
          score_away    = EXCLUDED.score_away,
          mvp_player_id = EXCLUDED.mvp_player_id,
          resolved_at   = now()
      `

      // 2. DELETE + INSERT player_match_stats
      await q`DELETE FROM player_match_stats WHERE match_id = ${match_id}`
      if (player_stats?.length > 0) {
        const statsRows = player_stats.map((s) => ({
          match_id,
          player_id: s.player_id,
          team_id: s.team_id,
          goals: s.goals,
          assists: s.assists,
          blocks: s.blocks,
        }))
        await q`INSERT INTO player_match_stats ${q(statsRows)}`
      }

      // 3. DELETE + INSERT match_absences
      await q`DELETE FROM match_absences WHERE match_id = ${match_id}`
      if (absences?.length > 0) {
        const absenceRows = absences.map((a) => ({
          match_id,
          player_id: a.player_id,
          team_id: a.team_id,
        }))
        await q`INSERT INTO match_absences ${q(absenceRows)}`
      }

      // 4. DELETE + INSERT spirit_nominations
      await q`DELETE FROM spirit_nominations WHERE match_id = ${match_id}`
      if (spirit?.length > 0) {
        const spiritRows = spirit.map((sn) => ({
          match_id,
          nominating_team_id: sn.nominating_team_id,
          nominated_player_id: sn.nominated_player_id,
        }))
        await q`INSERT INTO spirit_nominations ${q(spiritRows)}`
      }

      // 5. Mark fixture complete
      await q`
        UPDATE fixtures
        SET status = 'complete', updated_at = now()
        WHERE match_id = ${match_id}
      `
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Database error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
