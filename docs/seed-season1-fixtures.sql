-- =============================================================
-- UFA League — Season 1 Fixture Migration
-- Populates the finalized 2026 season schedule.
-- Safe to run on a DB that already has teams + players seeded.
-- Does NOT touch players. Replaces all fixtures and holidays.
--
-- Run each STEP in the Supabase SQL Editor in order.
-- Read the verification output between steps.
-- =============================================================


-- =============================================================
-- STEP 0: Verify current state before running anything
-- Run these queries and confirm before proceeding.
-- =============================================================

-- 0a. Confirm one season exists:
-- SELECT season_id, season_name, status FROM seasons ORDER BY created_at LIMIT 1;

-- 0b. Confirm teams and their current names:
-- SELECT team_name FROM teams WHERE season_id = (SELECT season_id FROM seasons ORDER BY created_at LIMIT 1);

-- 0c. Confirm fixture count (may be 0 or sample data):
-- SELECT COUNT(*) FROM fixtures WHERE season_id = (SELECT season_id FROM seasons ORDER BY created_at LIMIT 1);

-- 0d. Confirm no real match results exist (should be 0):
-- SELECT COUNT(*) FROM match_results mr
-- JOIN fixtures f ON f.match_id = mr.match_id
-- WHERE f.season_id = (SELECT season_id FROM seasons ORDER BY created_at LIMIT 1);


-- =============================================================
-- STEP 1: Update season record with finalized dates
-- =============================================================

UPDATE seasons SET
  start_date  = '2026-03-27',
  end_date    = '2026-06-12',
  break_start = '2026-05-22',
  break_end   = '2026-05-27',
  status      = 'active'
WHERE season_id = (SELECT season_id FROM seasons ORDER BY created_at LIMIT 1);


-- =============================================================
-- STEP 2: Rename teams using player display_name as lookup key.
-- This is robust regardless of current team_name values or
-- insertion order in the database.
-- =============================================================

UPDATE teams SET team_name = 'Discfunctional'
  WHERE team_id = (SELECT team_id FROM players WHERE display_name = 'Azim' LIMIT 1);

UPDATE teams SET team_name = 'Hammerheads'
  WHERE team_id = (SELECT team_id FROM players WHERE display_name = 'Mode' LIMIT 1);

UPDATE teams SET team_name = 'Frisbeyri'
  WHERE team_id = (SELECT team_id FROM players WHERE display_name = 'Philip' LIMIT 1);

UPDATE teams SET team_name = 'Kanmathee FC'
  WHERE team_id = (SELECT team_id FROM players WHERE display_name = 'Rizam' LIMIT 1);

UPDATE teams SET team_name = 'Disc Raiders'
  WHERE team_id = (SELECT team_id FROM players WHERE display_name = 'Zayyan' LIMIT 1);


-- =============================================================
-- STEP 3: Clear all sample match data.
-- Order matters — child tables must be deleted before fixtures.
-- =============================================================

DELETE FROM spirit_nominations;
DELETE FROM match_absences;
DELETE FROM player_match_stats;
DELETE FROM match_results;
DELETE FROM fixtures
  WHERE season_id = (SELECT season_id FROM seasons ORDER BY created_at LIMIT 1);


-- =============================================================
-- STEP 4: Clear and re-insert season holidays
-- =============================================================

DELETE FROM season_holidays
  WHERE season_id = (SELECT season_id FROM seasons ORDER BY created_at LIMIT 1);

INSERT INTO season_holidays (season_id, start_date, end_date, name)
SELECT season_id, '2026-05-01', '2026-05-02', 'Labour Day Weekend'
FROM seasons ORDER BY created_at LIMIT 1;

INSERT INTO season_holidays (season_id, start_date, end_date, name)
SELECT season_id, '2026-05-22', '2026-05-27', 'Hajj / Eid-al-Adha Break'
FROM seasons ORDER BY created_at LIMIT 1;


-- =============================================================
-- STEP 5: Insert 20 finalized fixtures.
-- All kickoffs at 20:30 MVT (UTC+5) = 15:30 UTC.
-- Team IDs resolved dynamically from team_name.
-- Home/away assignment matches League-Calendar source of truth.
-- =============================================================

WITH
  sid AS (
    SELECT season_id FROM seasons ORDER BY created_at LIMIT 1
  ),
  tms AS (
    SELECT team_id, team_name FROM teams
    WHERE season_id = (SELECT season_id FROM sid)
  ),
  fixture_rows (home_name, away_name, kickoff, matchweek) AS (
    VALUES
      -- Block 1: MW1–MW5
      ('Frisbeyri',      'Kanmathee FC',   '2026-03-27T15:30:00+00:00'::timestamptz, 1),
      ('Hammerheads',    'Discfunctional',  '2026-03-27T15:30:00+00:00'::timestamptz, 1),
      ('Disc Raiders',   'Discfunctional',  '2026-04-03T15:30:00+00:00'::timestamptz, 2),
      ('Frisbeyri',      'Hammerheads',    '2026-04-03T15:30:00+00:00'::timestamptz, 2),
      ('Disc Raiders',   'Frisbeyri',      '2026-04-10T15:30:00+00:00'::timestamptz, 3),
      ('Hammerheads',    'Kanmathee FC',   '2026-04-10T15:30:00+00:00'::timestamptz, 3),
      ('Disc Raiders',   'Kanmathee FC',   '2026-04-17T15:30:00+00:00'::timestamptz, 4),
      ('Discfunctional', 'Frisbeyri',      '2026-04-17T15:30:00+00:00'::timestamptz, 4),
      ('Hammerheads',    'Disc Raiders',   '2026-04-24T15:30:00+00:00'::timestamptz, 5),
      ('Kanmathee FC',   'Discfunctional', '2026-04-24T15:30:00+00:00'::timestamptz, 5),
      -- Block 2: MW6–MW8
      ('Kanmathee FC',   'Frisbeyri',      '2026-05-08T15:30:00+00:00'::timestamptz, 6),
      ('Discfunctional', 'Hammerheads',    '2026-05-08T15:30:00+00:00'::timestamptz, 6),
      ('Discfunctional', 'Disc Raiders',   '2026-05-15T15:30:00+00:00'::timestamptz, 7),
      ('Hammerheads',    'Frisbeyri',      '2026-05-15T15:30:00+00:00'::timestamptz, 7),
      ('Frisbeyri',      'Disc Raiders',   '2026-05-19T15:30:00+00:00'::timestamptz, 8),
      ('Kanmathee FC',   'Hammerheads',    '2026-05-19T15:30:00+00:00'::timestamptz, 8),
      -- Block 3: MW9–MW10
      ('Kanmathee FC',   'Disc Raiders',   '2026-06-05T15:30:00+00:00'::timestamptz, 9),
      ('Frisbeyri',      'Discfunctional', '2026-06-05T15:30:00+00:00'::timestamptz, 9),
      ('Disc Raiders',   'Hammerheads',    '2026-06-12T15:30:00+00:00'::timestamptz, 10),
      ('Discfunctional', 'Kanmathee FC',   '2026-06-12T15:30:00+00:00'::timestamptz, 10)
  )
INSERT INTO fixtures (season_id, home_team_id, away_team_id, kickoff_time, venue, matchweek)
SELECT
  (SELECT season_id FROM sid),
  (SELECT team_id FROM tms WHERE team_name = fr.home_name),
  (SELECT team_id FROM tms WHERE team_name = fr.away_name),
  fr.kickoff,
  'Villingili Football Turf',
  fr.matchweek
FROM fixture_rows fr;


-- =============================================================
-- STEP 6: Verify the migration
-- Run each query and confirm expected results.
-- =============================================================

-- 6a. Total fixtures (expect 20):
SELECT COUNT(*) AS total_fixtures FROM fixtures
WHERE season_id = (SELECT season_id FROM seasons ORDER BY created_at LIMIT 1);

-- 6b. Two fixtures per matchweek:
SELECT matchweek, COUNT(*) AS fixture_count
FROM fixtures
WHERE season_id = (SELECT season_id FROM seasons ORDER BY created_at LIMIT 1)
GROUP BY matchweek
ORDER BY matchweek;

-- 6c. Correct team names:
SELECT team_name FROM teams
WHERE season_id = (SELECT season_id FROM seasons ORDER BY created_at LIMIT 1)
ORDER BY team_name;

-- 6d. Season status = 'active':
SELECT season_name, start_date, end_date, break_start, break_end, status
FROM seasons ORDER BY created_at LIMIT 1;

-- 6e. Two holidays:
SELECT name, start_date, end_date FROM season_holidays
WHERE season_id = (SELECT season_id FROM seasons ORDER BY created_at LIMIT 1)
ORDER BY start_date;

-- 6f. Spot-check: MW1 fixtures (should show Frisbeyri vs Kanmathee FC, Hammerheads vs Discfunctional):
SELECT
  ht.team_name AS home,
  at.team_name AS away,
  f.kickoff_time,
  f.matchweek
FROM fixtures f
JOIN teams ht ON ht.team_id = f.home_team_id
JOIN teams at ON at.team_id = f.away_team_id
WHERE f.season_id = (SELECT season_id FROM seasons ORDER BY created_at LIMIT 1)
  AND f.matchweek = 1
ORDER BY f.kickoff_time;
