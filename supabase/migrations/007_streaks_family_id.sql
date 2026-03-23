-- Migration 007: Add family_id to streaks
-- ============================================================
-- The create-kid and delete-family Edge Functions reference
-- streaks.family_id, but the original schema omitted that column.
-- This migration adds it, backfills from profiles, and adds an index.

ALTER TABLE streaks
  ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES families(id);

-- Backfill from the kid's profile
UPDATE streaks s
SET    family_id = p.family_id
FROM   profiles p
WHERE  s.kid_id = p.id
  AND  s.family_id IS NULL;

-- Make NOT NULL now that it is populated
ALTER TABLE streaks
  ALTER COLUMN family_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_streaks_family_id ON streaks(family_id);
