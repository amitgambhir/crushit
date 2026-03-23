-- Migration 015: allow users to read their own profile before joining a family
-- ============================================================================
-- Bug:
--   New parent accounts are created with profiles.family_id = NULL until they
--   complete family setup. The original SELECT policy on profiles only allowed
--   reads when family_id = get_my_family_id(), which fails for NULL values
--   (NULL = NULL is not true in Postgres). As a result, loadProfile() returned
--   no row immediately after sign-up, and the auth guard could not route the
--   user to /(auth)/family-setup.
--
-- Fix:
--   Allow each authenticated user to read their own profile directly, while
--   preserving family-wide reads for members of the same family.

DROP POLICY IF EXISTS "family_members_can_read_profiles" ON profiles;

CREATE POLICY "users_and_family_members_can_read_profiles"
  ON profiles FOR SELECT
  USING (
    id = auth.uid()
    OR family_id = get_my_family_id()
  );
