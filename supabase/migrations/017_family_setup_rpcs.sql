-- Migration 017: create/join family via SECURITY DEFINER RPCs
-- ============================================================================
-- Bug:
--   Parents with no family_id cannot reliably create or join a family via
--   direct table reads/writes because RLS blocks SELECTs on `families` until
--   the profile is already linked to a family.
--
-- Fix:
--   Move both flows into SECURITY DEFINER functions that:
--   1. Resolve the caller from auth.uid()
--   2. Verify the caller is a parent
--   3. Create or fetch the family
--   4. Link the caller's profile to that family atomically
--   5. Return the family row to the client

CREATE OR REPLACE FUNCTION create_family(p_name TEXT)
RETURNS families
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller      profiles%ROWTYPE;
  v_family      families%ROWTYPE;
  v_invite_code TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_caller
  FROM profiles
  WHERE id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Caller profile not found';
  END IF;

  IF v_caller.role != 'parent' THEN
    RAISE EXCEPTION 'Only parents can create a family';
  END IF;

  IF v_caller.family_id IS NOT NULL THEN
    RAISE EXCEPTION 'Caller is already linked to a family';
  END IF;

  LOOP
    v_invite_code := upper(substr(md5(random()::text), 1, 6));

    BEGIN
      INSERT INTO families (name, invite_code)
      VALUES (p_name, v_invite_code)
      RETURNING * INTO v_family;
      EXIT;
    EXCEPTION
      WHEN unique_violation THEN
        -- Retry on invite code collision.
    END;
  END LOOP;

  UPDATE profiles
  SET family_id = v_family.id
  WHERE id = v_caller.id;

  RETURN v_family;
END;
$$;

GRANT EXECUTE ON FUNCTION create_family(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION join_family(p_invite_code TEXT)
RETURNS families
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller profiles%ROWTYPE;
  v_family families%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_caller
  FROM profiles
  WHERE id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Caller profile not found';
  END IF;

  IF v_caller.role != 'parent' THEN
    RAISE EXCEPTION 'Only parents can join a family';
  END IF;

  IF v_caller.family_id IS NOT NULL THEN
    RAISE EXCEPTION 'Caller is already linked to a family';
  END IF;

  SELECT * INTO v_family
  FROM families
  WHERE invite_code = upper(trim(p_invite_code));

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;

  UPDATE profiles
  SET family_id = v_family.id
  WHERE id = v_caller.id;

  RETURN v_family;
END;
$$;

GRANT EXECUTE ON FUNCTION join_family(TEXT) TO authenticated;
