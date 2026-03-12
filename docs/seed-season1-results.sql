-- =============================================================
-- UFA League — Season 1 Demo Results Seed
-- Populates 15 of 20 fixtures (75%) with match results,
-- player stats, absences, and spirit nominations.
-- Intended to show an in-progress mid-season state.
--
-- Safe to re-run: match_results uses ON CONFLICT DO UPDATE,
-- all child tables use DELETE + INSERT per match.
--
-- Run in the Supabase SQL Editor (single block).
-- =============================================================


-- =============================================================
-- STEP 0: Verify pre-conditions before running
-- =============================================================

-- 0a. Confirm 20 fixtures exist and all are 'scheduled':
-- SELECT COUNT(*) FROM fixtures
-- WHERE season_id = (SELECT season_id FROM seasons ORDER BY created_at LIMIT 1)
--   AND status = 'scheduled';
-- Expected: 20

-- 0b. Confirm 0 existing match results:
-- SELECT COUNT(*) FROM match_results mr
-- JOIN fixtures f ON f.match_id = mr.match_id
-- WHERE f.season_id = (SELECT season_id FROM seasons ORDER BY created_at LIMIT 1);
-- Expected: 0 (if running fresh)


-- =============================================================
-- STEP 1: Insert all 15 match results
-- =============================================================

DO $$
DECLARE
  s_id uuid;

  -- Team IDs
  t_frisbeyri       uuid;
  t_hammerheads     uuid;
  t_disc_raiders    uuid;
  t_kfc             uuid;
  t_discfunctional  uuid;

  -- Frisbeyri players
  p_philip    uuid; p_mateo    uuid; p_piko     uuid; p_tiana    uuid;
  p_lamath    uuid; p_shaaif   uuid; p_kaitlinn uuid; p_maan     uuid;

  -- Hammerheads players
  p_mode    uuid; p_finn   uuid; p_saam   uuid; p_kat    uuid;
  p_afrah   uuid; p_nawaz  uuid; p_yoosuf uuid; p_hamko  uuid; p_shabeen uuid;

  -- Disc Raiders players
  p_zayyan uuid; p_fauz  uuid; p_muky   uuid; p_uraiba uuid;
  p_moadz  uuid; p_junayd uuid; p_amsal uuid; p_babaa  uuid; p_eijaz  uuid;

  -- Kanmathee FC players
  p_rizam   uuid; p_jin     uuid; p_miph    uuid; p_tanzeem uuid;
  p_aryf    uuid; p_shazeen uuid; p_malaka  uuid; p_aahil   uuid; p_maeesh uuid;

  -- Discfunctional players
  p_azim   uuid; p_shamin uuid; p_miju  uuid; p_hassan uuid;
  p_maahy  uuid; p_imma   uuid; p_jef   uuid; p_jilaau uuid; p_aisha  uuid;

  -- Fixture IDs (m1..m15 = the 15 completed matches)
  m1  uuid; m2  uuid; m3  uuid; m4  uuid; m5  uuid;
  m6  uuid; m7  uuid; m8  uuid; m9  uuid; m10 uuid;
  m11 uuid; m12 uuid; m13 uuid; m14 uuid; m15 uuid;

BEGIN

  -- --------------------------------------------------------
  -- Resolve season
  -- --------------------------------------------------------
  SELECT season_id INTO s_id FROM seasons ORDER BY created_at LIMIT 1;

  -- --------------------------------------------------------
  -- Resolve team IDs via a known player on each team.
  -- Mirrors the pattern in seed-season1-fixtures.sql and is
  -- immune to team name variations in the database.
  -- --------------------------------------------------------
  SELECT team_id INTO t_frisbeyri      FROM players WHERE season_id = s_id AND display_name = 'Philip'  LIMIT 1;
  SELECT team_id INTO t_hammerheads    FROM players WHERE season_id = s_id AND display_name = 'Mode'    LIMIT 1;
  SELECT team_id INTO t_disc_raiders   FROM players WHERE season_id = s_id AND display_name = 'Zayyan'  LIMIT 1;
  SELECT team_id INTO t_kfc            FROM players WHERE season_id = s_id AND display_name = 'Rizam'   LIMIT 1;
  SELECT team_id INTO t_discfunctional FROM players WHERE season_id = s_id AND display_name = 'Azim'    LIMIT 1;

  -- --------------------------------------------------------
  -- Resolve player IDs by display_name (scoped to season)
  -- --------------------------------------------------------

  -- Frisbeyri
  SELECT player_id INTO p_philip    FROM players WHERE season_id = s_id AND display_name = 'Philip';
  SELECT player_id INTO p_mateo     FROM players WHERE season_id = s_id AND display_name = 'Mateo';
  SELECT player_id INTO p_piko      FROM players WHERE season_id = s_id AND display_name = 'Piko';
  SELECT player_id INTO p_tiana     FROM players WHERE season_id = s_id AND display_name = 'Tiana';
  SELECT player_id INTO p_lamath    FROM players WHERE season_id = s_id AND display_name = 'Lamath';
  SELECT player_id INTO p_shaaif    FROM players WHERE season_id = s_id AND display_name = 'Shaaif';
  SELECT player_id INTO p_kaitlinn  FROM players WHERE season_id = s_id AND display_name = 'Kaitlinn';
  SELECT player_id INTO p_maan      FROM players WHERE season_id = s_id AND display_name = 'Ma''an';

  -- Hammerheads
  SELECT player_id INTO p_mode    FROM players WHERE season_id = s_id AND display_name = 'Mode';
  SELECT player_id INTO p_finn    FROM players WHERE season_id = s_id AND display_name = 'Finn';
  SELECT player_id INTO p_saam    FROM players WHERE season_id = s_id AND display_name = 'Saam';
  SELECT player_id INTO p_kat     FROM players WHERE season_id = s_id AND display_name = 'Kat';
  SELECT player_id INTO p_afrah   FROM players WHERE season_id = s_id AND display_name = 'Afrah';
  SELECT player_id INTO p_nawaz   FROM players WHERE season_id = s_id AND display_name = 'Nawaz';
  SELECT player_id INTO p_yoosuf  FROM players WHERE season_id = s_id AND display_name = 'Yoosuf';
  SELECT player_id INTO p_hamko   FROM players WHERE season_id = s_id AND display_name = 'Hamko';
  SELECT player_id INTO p_shabeen FROM players WHERE season_id = s_id AND display_name = 'Shabeen';

  -- Disc Raiders
  SELECT player_id INTO p_zayyan FROM players WHERE season_id = s_id AND display_name = 'Zayyan';
  SELECT player_id INTO p_fauz   FROM players WHERE season_id = s_id AND display_name = 'Fauz';
  SELECT player_id INTO p_muky   FROM players WHERE season_id = s_id AND display_name = 'Muky';
  SELECT player_id INTO p_uraiba FROM players WHERE season_id = s_id AND display_name = 'Uraiba';
  SELECT player_id INTO p_moadz  FROM players WHERE season_id = s_id AND display_name = 'Moadz';
  SELECT player_id INTO p_junayd FROM players WHERE season_id = s_id AND display_name = 'Junayd';
  SELECT player_id INTO p_amsal  FROM players WHERE season_id = s_id AND display_name = 'Amsal';
  SELECT player_id INTO p_babaa  FROM players WHERE season_id = s_id AND display_name = 'Babaa';
  SELECT player_id INTO p_eijaz  FROM players WHERE season_id = s_id AND display_name = 'Eijaz';

  -- Kanmathee FC
  SELECT player_id INTO p_rizam   FROM players WHERE season_id = s_id AND display_name = 'Rizam';
  SELECT player_id INTO p_jin     FROM players WHERE season_id = s_id AND display_name = 'Jin';
  SELECT player_id INTO p_miph    FROM players WHERE season_id = s_id AND display_name = 'Miph';
  SELECT player_id INTO p_tanzeem FROM players WHERE season_id = s_id AND display_name = 'Tanzeem';
  SELECT player_id INTO p_aryf    FROM players WHERE season_id = s_id AND display_name = 'Aryf';
  SELECT player_id INTO p_shazeen FROM players WHERE season_id = s_id AND display_name = 'Shazeen';
  SELECT player_id INTO p_malaka  FROM players WHERE season_id = s_id AND display_name = 'Malaka';
  SELECT player_id INTO p_aahil   FROM players WHERE season_id = s_id AND display_name = 'Aahil';
  SELECT player_id INTO p_maeesh  FROM players WHERE season_id = s_id AND display_name = 'Maeesh';

  -- Discfunctional
  SELECT player_id INTO p_azim   FROM players WHERE season_id = s_id AND display_name = 'Azim';
  SELECT player_id INTO p_shamin FROM players WHERE season_id = s_id AND display_name = 'Shamin';
  SELECT player_id INTO p_miju   FROM players WHERE season_id = s_id AND display_name = 'Miju';
  SELECT player_id INTO p_hassan FROM players WHERE season_id = s_id AND display_name = 'Hassan';
  SELECT player_id INTO p_maahy  FROM players WHERE season_id = s_id AND display_name = 'Maahy';
  SELECT player_id INTO p_imma   FROM players WHERE season_id = s_id AND display_name = 'Imma';
  SELECT player_id INTO p_jef    FROM players WHERE season_id = s_id AND display_name = 'Jef';
  SELECT player_id INTO p_jilaau FROM players WHERE season_id = s_id AND display_name = 'Jilaau';
  SELECT player_id INTO p_aisha  FROM players WHERE season_id = s_id AND display_name = 'Aisha';

  -- --------------------------------------------------------
  -- Resolve fixture IDs by matchweek + home team
  -- --------------------------------------------------------

  -- MW1
  SELECT match_id INTO m1  FROM fixtures WHERE season_id = s_id AND matchweek = 1 AND home_team_id = t_frisbeyri;
  SELECT match_id INTO m2  FROM fixtures WHERE season_id = s_id AND matchweek = 1 AND home_team_id = t_hammerheads;
  -- MW2
  SELECT match_id INTO m3  FROM fixtures WHERE season_id = s_id AND matchweek = 2 AND home_team_id = t_disc_raiders;
  SELECT match_id INTO m4  FROM fixtures WHERE season_id = s_id AND matchweek = 2 AND home_team_id = t_frisbeyri;
  -- MW3
  SELECT match_id INTO m5  FROM fixtures WHERE season_id = s_id AND matchweek = 3 AND home_team_id = t_disc_raiders;
  SELECT match_id INTO m6  FROM fixtures WHERE season_id = s_id AND matchweek = 3 AND home_team_id = t_hammerheads;
  -- MW4
  SELECT match_id INTO m7  FROM fixtures WHERE season_id = s_id AND matchweek = 4 AND home_team_id = t_disc_raiders;
  SELECT match_id INTO m8  FROM fixtures WHERE season_id = s_id AND matchweek = 4 AND home_team_id = t_discfunctional;
  -- MW5
  SELECT match_id INTO m9  FROM fixtures WHERE season_id = s_id AND matchweek = 5 AND home_team_id = t_hammerheads;
  SELECT match_id INTO m10 FROM fixtures WHERE season_id = s_id AND matchweek = 5 AND home_team_id = t_kfc;
  -- MW6
  SELECT match_id INTO m11 FROM fixtures WHERE season_id = s_id AND matchweek = 6 AND home_team_id = t_kfc;
  SELECT match_id INTO m12 FROM fixtures WHERE season_id = s_id AND matchweek = 6 AND home_team_id = t_discfunctional;
  -- MW7
  SELECT match_id INTO m13 FROM fixtures WHERE season_id = s_id AND matchweek = 7 AND home_team_id = t_discfunctional;
  SELECT match_id INTO m14 FROM fixtures WHERE season_id = s_id AND matchweek = 7 AND home_team_id = t_hammerheads;
  -- MW8 (first match only — 75% cutoff)
  SELECT match_id INTO m15 FROM fixtures WHERE season_id = s_id AND matchweek = 8 AND home_team_id = t_frisbeyri;


  -- ============================================================
  -- M1 | MW1 | 2026-03-27 | Frisbeyri 8 – Kanmathee FC 11
  -- MVP: Rizam (4g 3a) | Absent: Kaitlinn (FR), Maeesh (KFC)
  -- ============================================================

  INSERT INTO match_results (match_id, score_home, score_away, mvp_player_id, resolved_at)
  VALUES (m1, 8, 11, p_rizam, '2026-03-27T15:30:00+00:00')
  ON CONFLICT (match_id) DO UPDATE SET
    score_home = EXCLUDED.score_home, score_away = EXCLUDED.score_away,
    mvp_player_id = EXCLUDED.mvp_player_id, resolved_at = EXCLUDED.resolved_at;

  DELETE FROM player_match_stats WHERE match_id = m1;
  INSERT INTO player_match_stats (match_id, player_id, team_id, goals, assists, blocks) VALUES
    -- Frisbeyri (8g 8a)
    (m1, p_philip,  t_frisbeyri, 3, 2, 1),
    (m1, p_mateo,   t_frisbeyri, 2, 3, 0),
    (m1, p_piko,    t_frisbeyri, 1, 1, 2),
    (m1, p_tiana,   t_frisbeyri, 1, 1, 0),
    (m1, p_lamath,  t_frisbeyri, 1, 1, 0),
    (m1, p_shaaif,  t_frisbeyri, 0, 0, 2),
    -- Kanmathee FC (11g 11a)
    (m1, p_rizam,   t_kfc, 4, 3, 1),
    (m1, p_jin,     t_kfc, 3, 3, 0),
    (m1, p_miph,    t_kfc, 2, 2, 1),
    (m1, p_tanzeem, t_kfc, 1, 1, 0),
    (m1, p_aryf,    t_kfc, 1, 1, 2),
    (m1, p_shazeen, t_kfc, 0, 1, 1);

  DELETE FROM match_absences WHERE match_id = m1;
  INSERT INTO match_absences (match_id, player_id, team_id) VALUES
    (m1, p_kaitlinn, t_frisbeyri),
    (m1, p_maeesh,   t_kfc);

  DELETE FROM spirit_nominations WHERE match_id = m1;
  INSERT INTO spirit_nominations (match_id, nominating_team_id, nominated_player_id) VALUES
    (m1, t_frisbeyri, p_rizam),   -- Frisbeyri nominates KFC's Rizam
    (m1, t_kfc,       p_philip);  -- KFC nominates Frisbeyri's Philip


  -- ============================================================
  -- M2 | MW1 | 2026-03-27 | Hammerheads 11 – Discfunctional 7
  -- MVP: Mode (4g 3a) | Absent: Shabeen (HH), Miju (DF)
  -- ============================================================

  INSERT INTO match_results (match_id, score_home, score_away, mvp_player_id, resolved_at)
  VALUES (m2, 11, 7, p_mode, '2026-03-27T15:30:00+00:00')
  ON CONFLICT (match_id) DO UPDATE SET
    score_home = EXCLUDED.score_home, score_away = EXCLUDED.score_away,
    mvp_player_id = EXCLUDED.mvp_player_id, resolved_at = EXCLUDED.resolved_at;

  DELETE FROM player_match_stats WHERE match_id = m2;
  INSERT INTO player_match_stats (match_id, player_id, team_id, goals, assists, blocks) VALUES
    -- Hammerheads (11g 11a)
    (m2, p_mode,  t_hammerheads, 4, 3, 1),
    (m2, p_finn,  t_hammerheads, 3, 2, 3),
    (m2, p_saam,  t_hammerheads, 2, 3, 0),
    (m2, p_kat,   t_hammerheads, 1, 1, 0),
    (m2, p_afrah, t_hammerheads, 1, 2, 1),
    -- Discfunctional (7g 7a)
    (m2, p_azim,   t_discfunctional, 3, 2, 0),
    (m2, p_imma,   t_discfunctional, 2, 2, 1),
    (m2, p_jef,    t_discfunctional, 1, 1, 0),
    (m2, p_hassan, t_discfunctional, 1, 1, 0),
    (m2, p_shamin, t_discfunctional, 0, 1, 2);

  DELETE FROM match_absences WHERE match_id = m2;
  INSERT INTO match_absences (match_id, player_id, team_id) VALUES
    (m2, p_shabeen, t_hammerheads),
    (m2, p_miju,    t_discfunctional);

  DELETE FROM spirit_nominations WHERE match_id = m2;
  INSERT INTO spirit_nominations (match_id, nominating_team_id, nominated_player_id) VALUES
    (m2, t_hammerheads,    p_azim),  -- HH nominates DF's Azim
    (m2, t_discfunctional, p_finn);  -- DF nominates HH's Finn


  -- ============================================================
  -- M3 | MW2 | 2026-04-03 | Disc Raiders 11 – Discfunctional 9
  -- MVP: Zayyan (4g 3a) | Absent: Babaa (DR), Aisha (DF)
  -- ============================================================

  INSERT INTO match_results (match_id, score_home, score_away, mvp_player_id, resolved_at)
  VALUES (m3, 11, 9, p_zayyan, '2026-04-03T15:30:00+00:00')
  ON CONFLICT (match_id) DO UPDATE SET
    score_home = EXCLUDED.score_home, score_away = EXCLUDED.score_away,
    mvp_player_id = EXCLUDED.mvp_player_id, resolved_at = EXCLUDED.resolved_at;

  DELETE FROM player_match_stats WHERE match_id = m3;
  INSERT INTO player_match_stats (match_id, player_id, team_id, goals, assists, blocks) VALUES
    -- Disc Raiders (11g 11a)
    (m3, p_zayyan, t_disc_raiders, 4, 3, 1),
    (m3, p_amsal,  t_disc_raiders, 3, 3, 0),
    (m3, p_fauz,   t_disc_raiders, 2, 2, 1),
    (m3, p_muky,   t_disc_raiders, 1, 2, 2),
    (m3, p_uraiba, t_disc_raiders, 1, 1, 0),
    -- Discfunctional (9g 9a)
    (m3, p_azim,   t_discfunctional, 3, 2, 0),
    (m3, p_imma,   t_discfunctional, 2, 2, 1),
    (m3, p_jef,    t_discfunctional, 2, 2, 0),
    (m3, p_jilaau, t_discfunctional, 1, 1, 1),
    (m3, p_shamin, t_discfunctional, 1, 1, 0),
    (m3, p_maahy,  t_discfunctional, 0, 1, 0);

  DELETE FROM match_absences WHERE match_id = m3;
  INSERT INTO match_absences (match_id, player_id, team_id) VALUES
    (m3, p_babaa, t_disc_raiders),
    (m3, p_aisha, t_discfunctional);

  DELETE FROM spirit_nominations WHERE match_id = m3;
  INSERT INTO spirit_nominations (match_id, nominating_team_id, nominated_player_id) VALUES
    (m3, t_disc_raiders,   p_azim),    -- DR nominates DF's Azim
    (m3, t_discfunctional, p_zayyan);  -- DF nominates DR's Zayyan


  -- ============================================================
  -- M4 | MW2 | 2026-04-03 | Frisbeyri 11 – Hammerheads 8
  -- MVP: Philip (4g 3a) | Absent: Shaaif (FR), Yoosuf (HH)
  -- ============================================================

  INSERT INTO match_results (match_id, score_home, score_away, mvp_player_id, resolved_at)
  VALUES (m4, 11, 8, p_philip, '2026-04-03T15:30:00+00:00')
  ON CONFLICT (match_id) DO UPDATE SET
    score_home = EXCLUDED.score_home, score_away = EXCLUDED.score_away,
    mvp_player_id = EXCLUDED.mvp_player_id, resolved_at = EXCLUDED.resolved_at;

  DELETE FROM player_match_stats WHERE match_id = m4;
  INSERT INTO player_match_stats (match_id, player_id, team_id, goals, assists, blocks) VALUES
    -- Frisbeyri (11g 11a)
    (m4, p_philip, t_frisbeyri, 4, 3, 1),
    (m4, p_mateo,  t_frisbeyri, 3, 4, 0),
    (m4, p_piko,   t_frisbeyri, 2, 2, 1),
    (m4, p_tiana,  t_frisbeyri, 1, 1, 0),
    (m4, p_lamath, t_frisbeyri, 1, 1, 0),
    -- Hammerheads (8g 8a)
    (m4, p_mode,  t_hammerheads, 3, 2, 1),
    (m4, p_finn,  t_hammerheads, 2, 2, 3),
    (m4, p_saam,  t_hammerheads, 1, 2, 0),
    (m4, p_kat,   t_hammerheads, 1, 1, 0),
    (m4, p_afrah, t_hammerheads, 1, 1, 0),
    (m4, p_nawaz, t_hammerheads, 0, 0, 1);

  DELETE FROM match_absences WHERE match_id = m4;
  INSERT INTO match_absences (match_id, player_id, team_id) VALUES
    (m4, p_shaaif, t_frisbeyri),
    (m4, p_yoosuf, t_hammerheads);

  DELETE FROM spirit_nominations WHERE match_id = m4;
  INSERT INTO spirit_nominations (match_id, nominating_team_id, nominated_player_id) VALUES
    (m4, t_frisbeyri,   p_finn),    -- FR nominates HH's Finn
    (m4, t_hammerheads, p_philip);  -- HH nominates FR's Philip


  -- ============================================================
  -- M5 | MW3 | 2026-04-10 | Disc Raiders 9 – Frisbeyri 11
  -- MVP: Philip (3g 3a) | Absent: Moadz (DR), Tiana (FR)
  -- ============================================================

  INSERT INTO match_results (match_id, score_home, score_away, mvp_player_id, resolved_at)
  VALUES (m5, 9, 11, p_philip, '2026-04-10T15:30:00+00:00')
  ON CONFLICT (match_id) DO UPDATE SET
    score_home = EXCLUDED.score_home, score_away = EXCLUDED.score_away,
    mvp_player_id = EXCLUDED.mvp_player_id, resolved_at = EXCLUDED.resolved_at;

  DELETE FROM player_match_stats WHERE match_id = m5;
  INSERT INTO player_match_stats (match_id, player_id, team_id, goals, assists, blocks) VALUES
    -- Disc Raiders (9g 9a)
    (m5, p_zayyan, t_disc_raiders, 3, 3, 1),
    (m5, p_amsal,  t_disc_raiders, 3, 2, 0),
    (m5, p_fauz,   t_disc_raiders, 2, 2, 1),
    (m5, p_muky,   t_disc_raiders, 1, 1, 2),
    (m5, p_junayd, t_disc_raiders, 0, 1, 0),
    -- Frisbeyri (11g 11a)
    (m5, p_philip,  t_frisbeyri, 3, 3, 0),
    (m5, p_mateo,   t_frisbeyri, 3, 4, 1),
    (m5, p_piko,    t_frisbeyri, 2, 2, 1),
    (m5, p_lamath,  t_frisbeyri, 1, 1, 0),
    (m5, p_maan,    t_frisbeyri, 2, 1, 1);

  DELETE FROM match_absences WHERE match_id = m5;
  INSERT INTO match_absences (match_id, player_id, team_id) VALUES
    (m5, p_moadz, t_disc_raiders),
    (m5, p_tiana, t_frisbeyri);

  DELETE FROM spirit_nominations WHERE match_id = m5;
  INSERT INTO spirit_nominations (match_id, nominating_team_id, nominated_player_id) VALUES
    (m5, t_disc_raiders, p_philip),  -- DR nominates FR's Philip
    (m5, t_frisbeyri,    p_amsal);   -- FR nominates DR's Amsal


  -- ============================================================
  -- M6 | MW3 | 2026-04-10 | Hammerheads 11 – Kanmathee FC 6
  -- MVP: Mode (4g 3a) | Absent: Hamko (HH), Malaka (KFC)
  -- ============================================================

  INSERT INTO match_results (match_id, score_home, score_away, mvp_player_id, resolved_at)
  VALUES (m6, 11, 6, p_mode, '2026-04-10T15:30:00+00:00')
  ON CONFLICT (match_id) DO UPDATE SET
    score_home = EXCLUDED.score_home, score_away = EXCLUDED.score_away,
    mvp_player_id = EXCLUDED.mvp_player_id, resolved_at = EXCLUDED.resolved_at;

  DELETE FROM player_match_stats WHERE match_id = m6;
  INSERT INTO player_match_stats (match_id, player_id, team_id, goals, assists, blocks) VALUES
    -- Hammerheads (11g 11a)
    (m6, p_mode,  t_hammerheads, 4, 3, 1),
    (m6, p_finn,  t_hammerheads, 3, 2, 4),
    (m6, p_saam,  t_hammerheads, 2, 2, 0),
    (m6, p_kat,   t_hammerheads, 1, 2, 0),
    (m6, p_nawaz, t_hammerheads, 1, 2, 0),
    -- Kanmathee FC (6g 6a)
    (m6, p_rizam,   t_kfc, 2, 2, 0),
    (m6, p_jin,     t_kfc, 2, 2, 1),
    (m6, p_miph,    t_kfc, 1, 1, 1),
    (m6, p_tanzeem, t_kfc, 1, 1, 0);

  DELETE FROM match_absences WHERE match_id = m6;
  INSERT INTO match_absences (match_id, player_id, team_id) VALUES
    (m6, p_hamko,  t_hammerheads),
    (m6, p_malaka, t_kfc);

  DELETE FROM spirit_nominations WHERE match_id = m6;
  INSERT INTO spirit_nominations (match_id, nominating_team_id, nominated_player_id) VALUES
    (m6, t_hammerheads, p_rizam),  -- HH nominates KFC's Rizam
    (m6, t_kfc,         p_finn);   -- KFC nominates HH's Finn


  -- ============================================================
  -- M7 | MW4 | 2026-04-17 | Disc Raiders 11 – Kanmathee FC 7
  -- MVP: Zayyan (4g 3a) | Absent: Uraiba (DR), Aahil (KFC)
  -- ============================================================

  INSERT INTO match_results (match_id, score_home, score_away, mvp_player_id, resolved_at)
  VALUES (m7, 11, 7, p_zayyan, '2026-04-17T15:30:00+00:00')
  ON CONFLICT (match_id) DO UPDATE SET
    score_home = EXCLUDED.score_home, score_away = EXCLUDED.score_away,
    mvp_player_id = EXCLUDED.mvp_player_id, resolved_at = EXCLUDED.resolved_at;

  DELETE FROM player_match_stats WHERE match_id = m7;
  INSERT INTO player_match_stats (match_id, player_id, team_id, goals, assists, blocks) VALUES
    -- Disc Raiders (11g 11a)
    (m7, p_zayyan, t_disc_raiders, 4, 3, 0),
    (m7, p_amsal,  t_disc_raiders, 3, 3, 1),
    (m7, p_fauz,   t_disc_raiders, 2, 3, 0),
    (m7, p_muky,   t_disc_raiders, 1, 1, 2),
    (m7, p_junayd, t_disc_raiders, 1, 1, 1),
    -- Kanmathee FC (7g 7a)
    (m7, p_rizam,   t_kfc, 3, 2, 1),
    (m7, p_jin,     t_kfc, 2, 2, 0),
    (m7, p_miph,    t_kfc, 1, 1, 1),
    (m7, p_tanzeem, t_kfc, 1, 2, 0);

  DELETE FROM match_absences WHERE match_id = m7;
  INSERT INTO match_absences (match_id, player_id, team_id) VALUES
    (m7, p_uraiba, t_disc_raiders),
    (m7, p_aahil,  t_kfc);

  DELETE FROM spirit_nominations WHERE match_id = m7;
  INSERT INTO spirit_nominations (match_id, nominating_team_id, nominated_player_id) VALUES
    (m7, t_disc_raiders, p_rizam),  -- DR nominates KFC's Rizam
    (m7, t_kfc,          p_amsal);  -- KFC nominates DR's Amsal


  -- ============================================================
  -- M8 | MW4 | 2026-04-17 | Discfunctional 9 – Frisbeyri 11
  -- MVP: Philip (4g 3a) | Absent: Hassan (DF), Kaitlinn (FR)
  -- ============================================================

  INSERT INTO match_results (match_id, score_home, score_away, mvp_player_id, resolved_at)
  VALUES (m8, 9, 11, p_philip, '2026-04-17T15:30:00+00:00')
  ON CONFLICT (match_id) DO UPDATE SET
    score_home = EXCLUDED.score_home, score_away = EXCLUDED.score_away,
    mvp_player_id = EXCLUDED.mvp_player_id, resolved_at = EXCLUDED.resolved_at;

  DELETE FROM player_match_stats WHERE match_id = m8;
  INSERT INTO player_match_stats (match_id, player_id, team_id, goals, assists, blocks) VALUES
    -- Discfunctional (9g 9a)
    (m8, p_azim,   t_discfunctional, 4, 3, 0),
    (m8, p_imma,   t_discfunctional, 2, 2, 1),
    (m8, p_jef,    t_discfunctional, 2, 2, 0),
    (m8, p_shamin, t_discfunctional, 1, 1, 1),
    (m8, p_jilaau, t_discfunctional, 0, 1, 2),
    -- Frisbeyri (11g 11a)
    (m8, p_philip, t_frisbeyri, 4, 3, 1),
    (m8, p_mateo,  t_frisbeyri, 3, 4, 0),
    (m8, p_piko,   t_frisbeyri, 2, 2, 0),
    (m8, p_tiana,  t_frisbeyri, 1, 1, 1),
    (m8, p_lamath, t_frisbeyri, 1, 1, 0);

  DELETE FROM match_absences WHERE match_id = m8;
  INSERT INTO match_absences (match_id, player_id, team_id) VALUES
    (m8, p_hassan,   t_discfunctional),
    (m8, p_kaitlinn, t_frisbeyri);

  DELETE FROM spirit_nominations WHERE match_id = m8;
  INSERT INTO spirit_nominations (match_id, nominating_team_id, nominated_player_id) VALUES
    (m8, t_discfunctional, p_philip),  -- DF nominates FR's Philip
    (m8, t_frisbeyri,      p_azim);    -- FR nominates DF's Azim


  -- ============================================================
  -- M9 | MW5 | 2026-04-24 | Hammerheads 8 – Disc Raiders 11
  -- MVP: Zayyan (4g 3a) | Absent: Kat (HH), Eijaz (DR)
  -- ============================================================

  INSERT INTO match_results (match_id, score_home, score_away, mvp_player_id, resolved_at)
  VALUES (m9, 8, 11, p_zayyan, '2026-04-24T15:30:00+00:00')
  ON CONFLICT (match_id) DO UPDATE SET
    score_home = EXCLUDED.score_home, score_away = EXCLUDED.score_away,
    mvp_player_id = EXCLUDED.mvp_player_id, resolved_at = EXCLUDED.resolved_at;

  DELETE FROM player_match_stats WHERE match_id = m9;
  INSERT INTO player_match_stats (match_id, player_id, team_id, goals, assists, blocks) VALUES
    -- Hammerheads (8g 8a)
    (m9, p_mode,  t_hammerheads, 3, 2, 1),
    (m9, p_finn,  t_hammerheads, 2, 2, 3),
    (m9, p_saam,  t_hammerheads, 2, 2, 0),
    (m9, p_afrah, t_hammerheads, 1, 2, 0),
    -- Disc Raiders (11g 11a)
    (m9, p_zayyan, t_disc_raiders, 4, 3, 1),
    (m9, p_amsal,  t_disc_raiders, 3, 3, 0),
    (m9, p_fauz,   t_disc_raiders, 2, 2, 1),
    (m9, p_muky,   t_disc_raiders, 1, 2, 1),
    (m9, p_moadz,  t_disc_raiders, 1, 1, 0);

  DELETE FROM match_absences WHERE match_id = m9;
  INSERT INTO match_absences (match_id, player_id, team_id) VALUES
    (m9, p_kat,   t_hammerheads),
    (m9, p_eijaz, t_disc_raiders);

  DELETE FROM spirit_nominations WHERE match_id = m9;
  INSERT INTO spirit_nominations (match_id, nominating_team_id, nominated_player_id) VALUES
    (m9, t_hammerheads,  p_amsal),  -- HH nominates DR's Amsal
    (m9, t_disc_raiders, p_mode);   -- DR nominates HH's Mode


  -- ============================================================
  -- M10 | MW5 | 2026-04-24 | Kanmathee FC 11 – Discfunctional 8
  -- MVP: Rizam (4g 3a) | Absent: Shazeen (KFC), Maahy (DF)
  -- ============================================================

  INSERT INTO match_results (match_id, score_home, score_away, mvp_player_id, resolved_at)
  VALUES (m10, 11, 8, p_rizam, '2026-04-24T15:30:00+00:00')
  ON CONFLICT (match_id) DO UPDATE SET
    score_home = EXCLUDED.score_home, score_away = EXCLUDED.score_away,
    mvp_player_id = EXCLUDED.mvp_player_id, resolved_at = EXCLUDED.resolved_at;

  DELETE FROM player_match_stats WHERE match_id = m10;
  INSERT INTO player_match_stats (match_id, player_id, team_id, goals, assists, blocks) VALUES
    -- Kanmathee FC (11g 11a)
    (m10, p_rizam,   t_kfc, 4, 3, 0),
    (m10, p_jin,     t_kfc, 3, 3, 1),
    (m10, p_miph,    t_kfc, 2, 2, 1),
    (m10, p_tanzeem, t_kfc, 1, 1, 0),
    (m10, p_aryf,    t_kfc, 1, 2, 0),
    -- Discfunctional (8g 8a)
    (m10, p_azim,   t_discfunctional, 3, 2, 0),
    (m10, p_imma,   t_discfunctional, 2, 2, 1),
    (m10, p_jef,    t_discfunctional, 1, 2, 0),
    (m10, p_jilaau, t_discfunctional, 1, 1, 1),
    (m10, p_shamin, t_discfunctional, 1, 1, 0);

  DELETE FROM match_absences WHERE match_id = m10;
  INSERT INTO match_absences (match_id, player_id, team_id) VALUES
    (m10, p_shazeen, t_kfc),
    (m10, p_maahy,   t_discfunctional);

  DELETE FROM spirit_nominations WHERE match_id = m10;
  INSERT INTO spirit_nominations (match_id, nominating_team_id, nominated_player_id) VALUES
    (m10, t_kfc,            p_azim),   -- KFC nominates DF's Azim
    (m10, t_discfunctional, p_rizam);  -- DF nominates KFC's Rizam


  -- ============================================================
  -- M11 | MW6 | 2026-05-08 | Kanmathee FC 9 – Frisbeyri 11
  -- MVP: Philip (4g 3a) | Absent: Maeesh (KFC), Shaaif (FR)
  -- ============================================================

  INSERT INTO match_results (match_id, score_home, score_away, mvp_player_id, resolved_at)
  VALUES (m11, 9, 11, p_philip, '2026-05-08T15:30:00+00:00')
  ON CONFLICT (match_id) DO UPDATE SET
    score_home = EXCLUDED.score_home, score_away = EXCLUDED.score_away,
    mvp_player_id = EXCLUDED.mvp_player_id, resolved_at = EXCLUDED.resolved_at;

  DELETE FROM player_match_stats WHERE match_id = m11;
  INSERT INTO player_match_stats (match_id, player_id, team_id, goals, assists, blocks) VALUES
    -- Kanmathee FC (9g 9a)
    (m11, p_rizam,   t_kfc, 3, 3, 1),
    (m11, p_jin,     t_kfc, 3, 2, 0),
    (m11, p_miph,    t_kfc, 2, 2, 1),
    (m11, p_tanzeem, t_kfc, 1, 1, 0),
    (m11, p_aryf,    t_kfc, 0, 1, 1),
    -- Frisbeyri (11g 11a)
    (m11, p_philip, t_frisbeyri, 4, 3, 0),
    (m11, p_mateo,  t_frisbeyri, 3, 4, 1),
    (m11, p_piko,   t_frisbeyri, 2, 2, 0),
    (m11, p_tiana,  t_frisbeyri, 1, 1, 1),
    (m11, p_lamath, t_frisbeyri, 1, 1, 0);

  DELETE FROM match_absences WHERE match_id = m11;
  INSERT INTO match_absences (match_id, player_id, team_id) VALUES
    (m11, p_maeesh, t_kfc),
    (m11, p_shaaif, t_frisbeyri);

  DELETE FROM spirit_nominations WHERE match_id = m11;
  INSERT INTO spirit_nominations (match_id, nominating_team_id, nominated_player_id) VALUES
    (m11, t_kfc,        p_philip),  -- KFC nominates FR's Philip
    (m11, t_frisbeyri,  p_rizam);   -- FR nominates KFC's Rizam


  -- ============================================================
  -- M12 | MW6 | 2026-05-08 | Discfunctional 11 – Hammerheads 10
  -- MVP: Azim (4g 3a) | Absent: Jilaau (DF), Nawaz (HH)
  -- ============================================================

  INSERT INTO match_results (match_id, score_home, score_away, mvp_player_id, resolved_at)
  VALUES (m12, 11, 10, p_azim, '2026-05-08T15:30:00+00:00')
  ON CONFLICT (match_id) DO UPDATE SET
    score_home = EXCLUDED.score_home, score_away = EXCLUDED.score_away,
    mvp_player_id = EXCLUDED.mvp_player_id, resolved_at = EXCLUDED.resolved_at;

  DELETE FROM player_match_stats WHERE match_id = m12;
  INSERT INTO player_match_stats (match_id, player_id, team_id, goals, assists, blocks) VALUES
    -- Discfunctional (11g 11a)
    (m12, p_azim,   t_discfunctional, 4, 3, 0),
    (m12, p_imma,   t_discfunctional, 3, 3, 1),
    (m12, p_jef,    t_discfunctional, 2, 2, 0),
    (m12, p_shamin, t_discfunctional, 1, 2, 1),
    (m12, p_hassan, t_discfunctional, 1, 1, 0),
    -- Hammerheads (10g 10a)
    (m12, p_mode,  t_hammerheads, 4, 3, 1),
    (m12, p_finn,  t_hammerheads, 3, 2, 3),
    (m12, p_saam,  t_hammerheads, 2, 2, 0),
    (m12, p_kat,   t_hammerheads, 1, 2, 0),
    (m12, p_afrah, t_hammerheads, 0, 1, 1);

  DELETE FROM match_absences WHERE match_id = m12;
  INSERT INTO match_absences (match_id, player_id, team_id) VALUES
    (m12, p_jilaau, t_discfunctional),
    (m12, p_nawaz,  t_hammerheads);

  DELETE FROM spirit_nominations WHERE match_id = m12;
  INSERT INTO spirit_nominations (match_id, nominating_team_id, nominated_player_id) VALUES
    (m12, t_discfunctional, p_mode),  -- DF nominates HH's Mode
    (m12, t_hammerheads,    p_azim);  -- HH nominates DF's Azim


  -- ============================================================
  -- M13 | MW7 | 2026-05-15 | Discfunctional 7 – Disc Raiders 11
  -- MVP: Zayyan (4g 3a) | Absent: Miju (DF), Junayd (DR)
  -- ============================================================

  INSERT INTO match_results (match_id, score_home, score_away, mvp_player_id, resolved_at)
  VALUES (m13, 7, 11, p_zayyan, '2026-05-15T15:30:00+00:00')
  ON CONFLICT (match_id) DO UPDATE SET
    score_home = EXCLUDED.score_home, score_away = EXCLUDED.score_away,
    mvp_player_id = EXCLUDED.mvp_player_id, resolved_at = EXCLUDED.resolved_at;

  DELETE FROM player_match_stats WHERE match_id = m13;
  INSERT INTO player_match_stats (match_id, player_id, team_id, goals, assists, blocks) VALUES
    -- Discfunctional (7g 7a)
    (m13, p_azim,   t_discfunctional, 3, 2, 0),
    (m13, p_imma,   t_discfunctional, 2, 2, 0),
    (m13, p_jef,    t_discfunctional, 1, 1, 1),
    (m13, p_shamin, t_discfunctional, 1, 2, 0),
    -- Disc Raiders (11g 11a)
    (m13, p_zayyan, t_disc_raiders, 4, 3, 1),
    (m13, p_amsal,  t_disc_raiders, 3, 3, 0),
    (m13, p_fauz,   t_disc_raiders, 2, 2, 1),
    (m13, p_muky,   t_disc_raiders, 1, 2, 2),
    (m13, p_moadz,  t_disc_raiders, 1, 1, 0);

  DELETE FROM match_absences WHERE match_id = m13;
  INSERT INTO match_absences (match_id, player_id, team_id) VALUES
    (m13, p_miju,  t_discfunctional),
    (m13, p_junayd, t_disc_raiders);

  DELETE FROM spirit_nominations WHERE match_id = m13;
  INSERT INTO spirit_nominations (match_id, nominating_team_id, nominated_player_id) VALUES
    (m13, t_discfunctional, p_zayyan),  -- DF nominates DR's Zayyan
    (m13, t_disc_raiders,   p_azim);    -- DR nominates DF's Azim


  -- ============================================================
  -- M14 | MW7 | 2026-05-15 | Hammerheads 11 – Frisbeyri 9
  -- MVP: Mode (4g 3a) | Absent: Afrah (HH), Lamath (FR)
  -- ============================================================

  INSERT INTO match_results (match_id, score_home, score_away, mvp_player_id, resolved_at)
  VALUES (m14, 11, 9, p_mode, '2026-05-15T15:30:00+00:00')
  ON CONFLICT (match_id) DO UPDATE SET
    score_home = EXCLUDED.score_home, score_away = EXCLUDED.score_away,
    mvp_player_id = EXCLUDED.mvp_player_id, resolved_at = EXCLUDED.resolved_at;

  DELETE FROM player_match_stats WHERE match_id = m14;
  INSERT INTO player_match_stats (match_id, player_id, team_id, goals, assists, blocks) VALUES
    -- Hammerheads (11g 11a)
    (m14, p_mode,   t_hammerheads, 4, 3, 1),
    (m14, p_finn,   t_hammerheads, 3, 2, 4),
    (m14, p_saam,   t_hammerheads, 2, 3, 0),
    (m14, p_kat,    t_hammerheads, 1, 1, 0),
    (m14, p_yoosuf, t_hammerheads, 1, 2, 0),
    -- Frisbeyri (9g 9a)
    (m14, p_philip, t_frisbeyri, 3, 3, 0),
    (m14, p_mateo,  t_frisbeyri, 3, 3, 1),
    (m14, p_piko,   t_frisbeyri, 2, 2, 0),
    (m14, p_tiana,  t_frisbeyri, 1, 1, 1);

  DELETE FROM match_absences WHERE match_id = m14;
  INSERT INTO match_absences (match_id, player_id, team_id) VALUES
    (m14, p_afrah,  t_hammerheads),
    (m14, p_lamath, t_frisbeyri);

  DELETE FROM spirit_nominations WHERE match_id = m14;
  INSERT INTO spirit_nominations (match_id, nominating_team_id, nominated_player_id) VALUES
    (m14, t_hammerheads, p_philip),  -- HH nominates FR's Philip
    (m14, t_frisbeyri,   p_mode);    -- FR nominates HH's Mode


  -- ============================================================
  -- M15 | MW8 | 2026-05-19 | Frisbeyri 11 – Disc Raiders 8
  -- MVP: Philip (4g 3a) | Absent: Piko (FR), Fauz (DR)
  -- ============================================================

  INSERT INTO match_results (match_id, score_home, score_away, mvp_player_id, resolved_at)
  VALUES (m15, 11, 8, p_philip, '2026-05-19T15:30:00+00:00')
  ON CONFLICT (match_id) DO UPDATE SET
    score_home = EXCLUDED.score_home, score_away = EXCLUDED.score_away,
    mvp_player_id = EXCLUDED.mvp_player_id, resolved_at = EXCLUDED.resolved_at;

  DELETE FROM player_match_stats WHERE match_id = m15;
  INSERT INTO player_match_stats (match_id, player_id, team_id, goals, assists, blocks) VALUES
    -- Frisbeyri (11g 11a)
    (m15, p_philip, t_frisbeyri, 4, 3, 1),
    (m15, p_mateo,  t_frisbeyri, 3, 3, 0),
    (m15, p_tiana,  t_frisbeyri, 2, 2, 1),
    (m15, p_lamath, t_frisbeyri, 1, 1, 0),
    (m15, p_shaaif, t_frisbeyri, 1, 2, 1),
    -- Disc Raiders (8g 8a)
    (m15, p_zayyan, t_disc_raiders, 3, 2, 1),
    (m15, p_amsal,  t_disc_raiders, 2, 3, 0),
    (m15, p_muky,   t_disc_raiders, 2, 2, 1),
    (m15, p_uraiba, t_disc_raiders, 1, 1, 0);

  DELETE FROM match_absences WHERE match_id = m15;
  INSERT INTO match_absences (match_id, player_id, team_id) VALUES
    (m15, p_piko, t_frisbeyri),
    (m15, p_fauz, t_disc_raiders);

  DELETE FROM spirit_nominations WHERE match_id = m15;
  INSERT INTO spirit_nominations (match_id, nominating_team_id, nominated_player_id) VALUES
    (m15, t_frisbeyri,   p_amsal),   -- FR nominates DR's Amsal
    (m15, t_disc_raiders, p_philip); -- DR nominates FR's Philip


  -- ============================================================
  -- Mark all 15 fixtures as complete
  -- ============================================================

  UPDATE fixtures SET status = 'complete', updated_at = now()
  WHERE match_id IN (m1, m2, m3, m4, m5, m6, m7, m8, m9, m10, m11, m12, m13, m14, m15);

  RAISE NOTICE 'Seed complete: 15 fixtures marked complete, results + stats inserted.';

END $$;


-- =============================================================
-- STEP 2: Verify the seed
-- =============================================================

-- 2a. Fixture status counts (expect: complete=15, scheduled=5):
SELECT
  status,
  COUNT(*) AS fixture_count
FROM fixtures
WHERE season_id = (SELECT season_id FROM seasons ORDER BY created_at LIMIT 1)
GROUP BY status
ORDER BY status;

-- 2b. Match results count (expect 15):
SELECT COUNT(*) AS result_count
FROM match_results mr
JOIN fixtures f ON f.match_id = mr.match_id
WHERE f.season_id = (SELECT season_id FROM seasons ORDER BY created_at LIMIT 1);

-- 2c. Spirit nomination count (expect 30 = 2 per match × 15):
SELECT COUNT(*) AS spirit_count
FROM spirit_nominations sn
JOIN fixtures f ON f.match_id = sn.match_id
WHERE f.season_id = (SELECT season_id FROM seasons ORDER BY created_at LIMIT 1);

-- 2d. Standings preview (points, GD):
WITH results AS (
  SELECT
    f.home_team_id AS team_id,
    mr.score_home  AS gf,
    mr.score_away  AS ga
  FROM fixtures f
  JOIN match_results mr ON mr.match_id = f.match_id
  WHERE f.season_id = (SELECT season_id FROM seasons ORDER BY created_at LIMIT 1)
  UNION ALL
  SELECT
    f.away_team_id AS team_id,
    mr.score_away  AS gf,
    mr.score_home  AS ga
  FROM fixtures f
  JOIN match_results mr ON mr.match_id = f.match_id
  WHERE f.season_id = (SELECT season_id FROM seasons ORDER BY created_at LIMIT 1)
)
SELECT
  t.team_name,
  COUNT(*)                                                  AS played,
  COUNT(*) FILTER (WHERE r.gf > r.ga)                      AS won,
  COUNT(*) FILTER (WHERE r.gf = r.ga)                      AS drawn,
  COUNT(*) FILTER (WHERE r.gf < r.ga)                      AS lost,
  SUM(r.gf)                                                AS gf,
  SUM(r.ga)                                                AS ga,
  SUM(r.gf) - SUM(r.ga)                                   AS gd,
  SUM(CASE WHEN r.gf > r.ga THEN 3 WHEN r.gf = r.ga THEN 1 ELSE 0 END) AS pts
FROM results r
JOIN teams t ON t.team_id = r.team_id
GROUP BY t.team_name
ORDER BY pts DESC, (SUM(r.gf) - SUM(r.ga)) DESC;

-- 2e. Top 5 goal scorers:
SELECT
  p.display_name,
  t.team_name,
  SUM(pms.goals)   AS goals,
  SUM(pms.assists) AS assists,
  SUM(pms.blocks)  AS blocks
FROM player_match_stats pms
JOIN players p ON p.player_id = pms.player_id
JOIN teams   t ON t.team_id   = pms.team_id
WHERE t.season_id = (SELECT season_id FROM seasons ORDER BY created_at LIMIT 1)
GROUP BY p.display_name, t.team_name
ORDER BY goals DESC, assists DESC
LIMIT 5;
