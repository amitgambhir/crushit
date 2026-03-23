-- Migration 008: Add refund_redemption_points RPC
-- ============================================================
-- When a parent rejects a reward request, we refund only
-- total_points (the spendable balance). We must NOT touch
-- lifetime_points, xp, or level — those are monotonically
-- increasing and represent earned work, not spending power.
-- (See AD-006 and README §Points model)

CREATE OR REPLACE FUNCTION refund_redemption_points(
  p_redemption_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_redemption redemptions%ROWTYPE;
BEGIN
  SELECT * INTO v_redemption
  FROM redemptions
  WHERE id = p_redemption_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Redemption not found: %', p_redemption_id;
  END IF;

  IF v_redemption.status <> 'pending' THEN
    RAISE EXCEPTION 'Cannot refund a redemption that is not pending (status: %)', v_redemption.status;
  END IF;

  -- Restore only the spendable balance — lifetime_points stays unchanged
  UPDATE profiles
  SET total_points = total_points + v_redemption.points_spent,
      last_active  = now()
  WHERE id = v_redemption.kid_id;

  -- Mark as rejected
  UPDATE redemptions
  SET status     = 'rejected'
  WHERE id = p_redemption_id;
END;
$$;

-- Parents call this via the service-role client (or via the hook with RLS)
GRANT EXECUTE ON FUNCTION refund_redemption_points(UUID) TO authenticated;
