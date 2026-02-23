import sql from '@/lib/db'

export interface StandingRow {
  team_id: string
  team_name: string
  played: number
  won: number
  drawn: number
  lost: number
  goals_for: number
  goals_against: number
  goal_diff: number
  points: number
}

export async function getStandings(seasonId: string): Promise<StandingRow[]> {
  const rows = await sql`
    WITH results AS (
      SELECT
        f.home_team_id AS team_id,
        mr.score_home  AS gf,
        mr.score_away  AS ga,
        CASE WHEN mr.score_home > mr.score_away THEN 3
             WHEN mr.score_home = mr.score_away THEN 1
             ELSE 0 END AS pts,
        CASE WHEN mr.score_home > mr.score_away THEN 1 ELSE 0 END AS won,
        CASE WHEN mr.score_home = mr.score_away THEN 1 ELSE 0 END AS drawn,
        CASE WHEN mr.score_home < mr.score_away THEN 1 ELSE 0 END AS lost
      FROM fixtures f
      JOIN match_results mr ON mr.match_id = f.match_id
      WHERE f.season_id = ${seasonId}
      UNION ALL
      SELECT
        f.away_team_id AS team_id,
        mr.score_away  AS gf,
        mr.score_home  AS ga,
        CASE WHEN mr.score_away > mr.score_home THEN 3
             WHEN mr.score_away = mr.score_home THEN 1
             ELSE 0 END AS pts,
        CASE WHEN mr.score_away > mr.score_home THEN 1 ELSE 0 END AS won,
        CASE WHEN mr.score_away = mr.score_home THEN 1 ELSE 0 END AS drawn,
        CASE WHEN mr.score_away < mr.score_home THEN 1 ELSE 0 END AS lost
      FROM fixtures f
      JOIN match_results mr ON mr.match_id = f.match_id
      WHERE f.season_id = ${seasonId}
    )
    SELECT
      t.team_id::text,
      t.team_name,
      COUNT(r.team_id)::int                                          AS played,
      COALESCE(SUM(r.won),  0)::int                                  AS won,
      COALESCE(SUM(r.drawn),0)::int                                  AS drawn,
      COALESCE(SUM(r.lost), 0)::int                                  AS lost,
      COALESCE(SUM(r.gf),   0)::int                                  AS goals_for,
      COALESCE(SUM(r.ga),   0)::int                                  AS goals_against,
      (COALESCE(SUM(r.gf),  0) - COALESCE(SUM(r.ga), 0))::int       AS goal_diff,
      COALESCE(SUM(r.pts),  0)::int                                  AS points
    FROM teams t
    LEFT JOIN results r ON r.team_id = t.team_id
    WHERE t.season_id = ${seasonId}
    GROUP BY t.team_id, t.team_name
    ORDER BY points DESC, goal_diff DESC, goals_for DESC
  `

  return rows.map((r) => ({
    team_id:       String(r.team_id),
    team_name:     String(r.team_name),
    played:        Number(r.played),
    won:           Number(r.won),
    drawn:         Number(r.drawn),
    lost:          Number(r.lost),
    goals_for:     Number(r.goals_for),
    goals_against: Number(r.goals_against),
    goal_diff:     Number(r.goal_diff),
    points:        Number(r.points),
  }))
}
