-- ============================================================
-- CrushIt — Family-scoped kid usernames
-- Replaces global username uniqueness with per-family uniqueness.
-- Replaces get_kid_family_code(username) with
-- get_kid_login_info(family_name, username) so kids must also
-- supply their family name to log in — prevents guessing
-- usernames across unrelated families.
-- ============================================================

-- 1. Swap the uniqueness constraint from global username
--    to (username, family_id) so the same username can exist
--    in different families but not twice within one family.
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_username_key;
ALTER TABLE profiles ADD CONSTRAINT profiles_username_family_unique
  UNIQUE (username, family_id);

-- 2. Drop the old single-argument function.
DROP FUNCTION IF EXISTS get_kid_family_code(TEXT);

-- 3. New function: requires both family_name and username.
--    Returns only the invite_code — nothing else from the profile.
--    Uses SECURITY DEFINER so the anon role can call it before
--    the kid has a session. invite_code is already semi-public
--    (used for family joining), so exposing it is acceptable.
CREATE OR REPLACE FUNCTION get_kid_login_info(p_family_name TEXT, p_username TEXT)
RETURNS TABLE (invite_code TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
    SELECT f.invite_code
    FROM profiles p
    JOIN families f ON f.id = p.family_id
    WHERE p.username    = LOWER(p_username)
      AND LOWER(f.name) = LOWER(p_family_name)
      AND p.role        = 'kid'
    LIMIT 1;
END;
$$;

-- 4. Grant unauthenticated access (kid login screen calls this
--    before any session exists).
GRANT EXECUTE ON FUNCTION get_kid_login_info(TEXT, TEXT) TO anon;
