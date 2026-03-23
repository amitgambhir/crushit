-- 011_push_token_and_pin.sql
-- Adds push notification token storage and parent PIN lock support.
--
-- Changes:
--   1. Add push_token TEXT column to profiles (nullable, device-specific)
--   2. set_parent_pin(pin TEXT)     — hashes and stores a 4-digit PIN for a parent
--   3. verify_parent_pin(pin TEXT)  — returns true when the supplied PIN matches
--   4. has_parent_pin()             — returns true when a PIN has been set (pin_hash IS NOT NULL)
--
-- pin_hash already exists on profiles from AD-005 but the column may not
-- exist in all environments. We use ADD COLUMN IF NOT EXISTS for safety.

-- ─── push_token ───────────────────────────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS push_token TEXT;

-- ─── pin_hash (ensure exists — originally noted in AD-005 but not in 001) ────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS pin_hash TEXT;

-- ─── set_parent_pin ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_parent_pin(p_pin TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only parents can set a PIN
  IF (SELECT role FROM profiles WHERE id = auth.uid()) != 'parent' THEN
    RAISE EXCEPTION 'Only parents can set a PIN';
  END IF;

  -- Validate: must be 4 digits
  IF p_pin !~ '^\d{4}$' THEN
    RAISE EXCEPTION 'PIN must be exactly 4 digits';
  END IF;

  UPDATE profiles
  SET pin_hash = crypt(p_pin, gen_salt('bf'))
  WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION set_parent_pin(TEXT) TO authenticated;

-- ─── verify_parent_pin ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION verify_parent_pin(p_pin TEXT)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash TEXT;
BEGIN
  SELECT pin_hash INTO v_hash
  FROM profiles
  WHERE id = auth.uid();

  -- No PIN set — return false (caller decides whether to allow or block)
  IF v_hash IS NULL THEN
    RETURN false;
  END IF;

  RETURN (crypt(p_pin, v_hash) = v_hash);
END;
$$;

GRANT EXECUTE ON FUNCTION verify_parent_pin(TEXT) TO authenticated;

-- ─── has_parent_pin ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION has_parent_pin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pin_hash IS NOT NULL
  FROM profiles
  WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION has_parent_pin() TO authenticated;
