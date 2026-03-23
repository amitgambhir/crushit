-- ============================================================
-- CrushIt — Kid auth helpers
-- Added in Session 2 to support username-based kid login.
-- ============================================================

-- Returns the family invite_code for a given kid username.
-- Called unauthenticated (before kid has a session) so it uses SECURITY DEFINER
-- and only returns the invite_code — never exposes the full profile.
CREATE OR REPLACE FUNCTION get_kid_family_code(p_username TEXT)
RETURNS TABLE (invite_code TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
    SELECT f.invite_code
    FROM profiles p
    JOIN families f ON f.id = p.family_id
    WHERE p.username = LOWER(p_username)
      AND p.role = 'kid'
    LIMIT 1;
END;
$$;

-- Grant unauthenticated (anon role) access so the kid login screen can call it
-- before the kid has a session.
GRANT EXECUTE ON FUNCTION get_kid_family_code(TEXT) TO anon;
