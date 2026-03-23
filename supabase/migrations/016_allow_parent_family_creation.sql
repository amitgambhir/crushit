-- Migration 016: allow signed-in parents without a family to create one
-- ============================================================================
-- Bug:
--   The app creates a new family by inserting directly into `families`, but
--   the schema only had SELECT and UPDATE policies on that table. With RLS
--   enabled, parent users could sign in successfully and reach Family Setup,
--   but pressing "Create Family" failed because there was no INSERT policy.
--
-- Fix:
--   Allow authenticated parent profiles to insert a family row. The follow-up
--   profile update that links the parent to the new family is already allowed
--   by the existing "users_can_update_own_profile" policy.

CREATE POLICY "parents_can_create_family"
  ON families FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM profiles
      WHERE id = auth.uid()
        AND role = 'parent'
    )
  );
