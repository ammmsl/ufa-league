-- =============================================================
-- UFA League — Season 1 Seed Data
-- Run each STEP in the Supabase SQL Editor in order.
-- Read the instructions between steps before running the next one.
-- =============================================================


-- =============================================================
-- STEP 1: Insert Season 1
-- Run this block, then read STEP 1 instructions below.
-- =============================================================

INSERT INTO seasons (season_id, season_name, start_date, end_date, break_start, break_end, status)
VALUES (
  gen_random_uuid(),
  'Season 1 — 2026',
  '2026-02-20',
  '2026-08-31',
  '2026-06-01',
  '2026-06-30',
  'setup'
);

-- After running STEP 1, run this query to get the season_id:
-- SELECT season_id FROM seasons WHERE season_name = 'Season 1 — 2026';
-- Copy the UUID shown — you will need it in STEP 2.


-- =============================================================
-- STEP 2: Insert Teams
-- Replace SEASON_ID with the UUID from STEP 1.
-- =============================================================

INSERT INTO teams (team_id, season_id, team_name) VALUES
  (gen_random_uuid(), 'SEASON_ID', 'Untitled 1'),
  (gen_random_uuid(), 'SEASON_ID', 'Untitled 2'),
  (gen_random_uuid(), 'SEASON_ID', 'Untitled 3'),
  (gen_random_uuid(), 'SEASON_ID', 'Untitled 4'),
  (gen_random_uuid(), 'SEASON_ID', 'Untitled 5');

-- After running STEP 2, run this query to get all team UUIDs:
-- SELECT team_id, team_name FROM teams WHERE season_id = 'SEASON_ID' ORDER BY team_name;
-- Copy all five team_id values — you will need them in STEP 3.
-- Note which UUID maps to which team number (Untitled 1 through 5).


-- =============================================================
-- STEP 3: Insert Players
-- Replace SEASON_ID, TEAM_1_ID through TEAM_5_ID with actual UUIDs.
-- Team 1: Azim, Shamin, Miju, Hassan, Maahy, Imma, Jef, Jilaau, Aisha (9 players)
-- Team 2: Mode, Finn, Saam, Kat, Afrah, Nawaz, Yoosuf, Hamko, Shabeen (9 players)
-- Team 3: Philip, Mateo, Piko, Tiana, Lamath, Shaaif, Kaitlinn, Ma'an (8 players)
-- Team 4: Rizam, Jin, Miph, Tanzeem, Aryf, Shazeen, Malaka, Aahil, Maeesh (9 players)
-- Team 5: Zayyan, Fauz, Muky, Uraiba, Moadz, Junayd, Amsal, Babaa, Eijaz (9 players)
-- =============================================================

INSERT INTO players (season_id, team_id, display_name) VALUES
  -- Team 1 (9 players)
  ('SEASON_ID', 'TEAM_1_ID', 'Azim'),
  ('SEASON_ID', 'TEAM_1_ID', 'Shamin'),
  ('SEASON_ID', 'TEAM_1_ID', 'Miju'),
  ('SEASON_ID', 'TEAM_1_ID', 'Hassan'),
  ('SEASON_ID', 'TEAM_1_ID', 'Maahy'),
  ('SEASON_ID', 'TEAM_1_ID', 'Imma'),
  ('SEASON_ID', 'TEAM_1_ID', 'Jef'),
  ('SEASON_ID', 'TEAM_1_ID', 'Jilaau'),
  ('SEASON_ID', 'TEAM_1_ID', 'Aisha'),
  -- Team 2 (9 players)
  ('SEASON_ID', 'TEAM_2_ID', 'Mode'),
  ('SEASON_ID', 'TEAM_2_ID', 'Finn'),
  ('SEASON_ID', 'TEAM_2_ID', 'Saam'),
  ('SEASON_ID', 'TEAM_2_ID', 'Kat'),
  ('SEASON_ID', 'TEAM_2_ID', 'Afrah'),
  ('SEASON_ID', 'TEAM_2_ID', 'Nawaz'),
  ('SEASON_ID', 'TEAM_2_ID', 'Yoosuf'),
  ('SEASON_ID', 'TEAM_2_ID', 'Hamko'),
  ('SEASON_ID', 'TEAM_2_ID', 'Shabeen'),
  -- Team 3 (8 players)
  ('SEASON_ID', 'TEAM_3_ID', 'Philip'),
  ('SEASON_ID', 'TEAM_3_ID', 'Mateo'),
  ('SEASON_ID', 'TEAM_3_ID', 'Piko'),
  ('SEASON_ID', 'TEAM_3_ID', 'Tiana'),
  ('SEASON_ID', 'TEAM_3_ID', 'Lamath'),
  ('SEASON_ID', 'TEAM_3_ID', 'Shaaif'),
  ('SEASON_ID', 'TEAM_3_ID', 'Kaitlinn'),
  ('SEASON_ID', 'TEAM_3_ID', 'Ma''an'),
  -- Team 4 (9 players)
  ('SEASON_ID', 'TEAM_4_ID', 'Rizam'),
  ('SEASON_ID', 'TEAM_4_ID', 'Jin'),
  ('SEASON_ID', 'TEAM_4_ID', 'Miph'),
  ('SEASON_ID', 'TEAM_4_ID', 'Tanzeem'),
  ('SEASON_ID', 'TEAM_4_ID', 'Aryf'),
  ('SEASON_ID', 'TEAM_4_ID', 'Shazeen'),
  ('SEASON_ID', 'TEAM_4_ID', 'Malaka'),
  ('SEASON_ID', 'TEAM_4_ID', 'Aahil'),
  ('SEASON_ID', 'TEAM_4_ID', 'Maeesh'),
  -- Team 5 (9 players)
  ('SEASON_ID', 'TEAM_5_ID', 'Zayyan'),
  ('SEASON_ID', 'TEAM_5_ID', 'Fauz'),
  ('SEASON_ID', 'TEAM_5_ID', 'Muky'),
  ('SEASON_ID', 'TEAM_5_ID', 'Uraiba'),
  ('SEASON_ID', 'TEAM_5_ID', 'Moadz'),
  ('SEASON_ID', 'TEAM_5_ID', 'Junayd'),
  ('SEASON_ID', 'TEAM_5_ID', 'Amsal'),
  ('SEASON_ID', 'TEAM_5_ID', 'Babaa'),
  ('SEASON_ID', 'TEAM_5_ID', 'Eijaz');


-- =============================================================
-- STEP 4: Verify the seed data
-- Run these verification queries after STEP 3.
-- =============================================================

-- 4a. Confirm player counts per team (should be 9, 9, 8, 9, 9):
-- SELECT t.team_name, COUNT(p.player_id) AS player_count
-- FROM teams t
-- LEFT JOIN players p ON p.team_id = t.team_id
-- WHERE t.season_id = 'SEASON_ID'
-- GROUP BY t.team_id, t.team_name
-- ORDER BY t.team_name;

-- 4b. Confirm Ma'an stored correctly:
-- SELECT display_name FROM players WHERE display_name LIKE '%an' AND season_id = 'SEASON_ID';
-- Should return: Ma'an

-- 4c. Confirm total player count is 44:
-- SELECT COUNT(*) FROM players WHERE season_id = 'SEASON_ID';
