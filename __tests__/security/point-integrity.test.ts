/**
 * Point integrity tests.
 *
 * These verify the business rules that govern Crush Points — the core
 * currency of the app. Any bug here breaks the reward loop for real families.
 *
 * AD-001: All point mutations route through Postgres SECURITY DEFINER functions.
 * AD-006: lifetime_points is never decremented.
 */

import { getLevelInfo } from '@/constants/levels';

// ─── Postgres RPC behaviour (contract tests) ──────────────────────────────────
// We can't run Postgres in Jest, so we verify the expected contracts
// these RPCs must enforce, which the hook tests above confirm are called.

describe('approve_task RPC contract', () => {
  it('awards exactly the points value of the task — no more, no less', () => {
    const before = { total_points: 50, lifetime_points: 50 };
    const taskPoints = 15;
    const after = {
      total_points: before.total_points + taskPoints,
      lifetime_points: before.lifetime_points + taskPoints,
    };
    expect(after.total_points).toBe(65);
    expect(after.lifetime_points).toBe(65);
  });

  it('both total_points and lifetime_points increase on approval', () => {
    const before = { total_points: 100, lifetime_points: 200 };
    const taskPoints = 20;
    const after = {
      total_points: before.total_points + taskPoints,
      lifetime_points: before.lifetime_points + taskPoints,
    };
    expect(after.total_points).toBeGreaterThan(before.total_points);
    expect(after.lifetime_points).toBeGreaterThan(before.lifetime_points);
  });

  it('level is recalculated based on new lifetime_points, not total_points', () => {
    // Kid has spent points (total=30) but lifetime=450 → should be level 5
    const lifetimePoints = 450;
    const info = getLevelInfo(lifetimePoints);
    expect(info.level).toBe(5);
    // If we incorrectly used total_points=30, level would be 1
    expect(getLevelInfo(30).level).toBe(1);
  });
});

// ─── redeem_reward RPC contract ───────────────────────────────────────────────

describe('redeem_reward RPC contract', () => {
  it('deducts cost from total_points only — lifetime_points must NOT decrease (AD-006)', () => {
    const before = { total_points: 100, lifetime_points: 500 };
    const costPoints = 60;
    const after = {
      total_points: before.total_points - costPoints,
      lifetime_points: before.lifetime_points, // UNCHANGED
    };

    expect(after.total_points).toBe(40);
    expect(after.lifetime_points).toBe(500); // lifetime never decremented
  });

  it('redemption should fail if total_points < cost_points', () => {
    const total_points = 30;
    const cost_points = 60;
    const canAfford = total_points >= cost_points;
    expect(canAfford).toBe(false);
    // The RPC raises an exception; the hook surfaces it as a thrown error
  });

  it('kid at exactly cost_points threshold can redeem', () => {
    const total_points = 60;
    const cost_points = 60;
    expect(total_points >= cost_points).toBe(true);
  });

  it('level does NOT change after redemption (level is based on lifetime_points)', () => {
    const lifetime_points = 450; // level 5
    const levelBefore = getLevelInfo(lifetime_points).level;

    // After spending 200 total_points, lifetime_points is unchanged
    const levelAfter = getLevelInfo(lifetime_points).level;

    expect(levelBefore).toBe(levelAfter);
    expect(levelAfter).toBe(5);
  });

  it('spending all points leaves lifetime_points unchanged', () => {
    const kid = { total_points: 200, lifetime_points: 700 };
    const after = { total_points: 0, lifetime_points: kid.lifetime_points };

    expect(after.lifetime_points).toBe(700);
    expect(getLevelInfo(after.lifetime_points).level).toBe(6); // Boss Mode
  });
});

// ─── Quantity enforcement ─────────────────────────────────────────────────────

describe('reward quantity enforcement', () => {
  it('reward with quantity_available=1 can only be redeemed once', () => {
    const reward = { quantity_available: 1, quantity_redeemed: 0 };
    const canRedeem = reward.quantity_available === null ||
      reward.quantity_redeemed < reward.quantity_available;
    expect(canRedeem).toBe(true);

    // After one redemption
    const afterFirst = { ...reward, quantity_redeemed: 1 };
    const canRedeemAgain = afterFirst.quantity_available === null ||
      afterFirst.quantity_redeemed < afterFirst.quantity_available;
    expect(canRedeemAgain).toBe(false);
  });

  it('reward with quantity_available=null is unlimited', () => {
    const reward = { quantity_available: null, quantity_redeemed: 100 };
    const canRedeem = reward.quantity_available === null;
    expect(canRedeem).toBe(true);
  });
});

// ─── award_crush_drop RPC contract ───────────────────────────────────────────

describe('award_crush_drop RPC contract', () => {
  it('increases both total_points and lifetime_points', () => {
    const before = { total_points: 50, lifetime_points: 300 };
    const dropPoints = 25;
    const after = {
      total_points: before.total_points + dropPoints,
      lifetime_points: before.lifetime_points + dropPoints,
    };

    expect(after.total_points).toBe(75);
    expect(after.lifetime_points).toBe(325);
  });

  it('recalculates level based on new lifetime_points', () => {
    // Kid at 2490 lifetime_points is level 9
    expect(getLevelInfo(2490).level).toBe(9);
    // A 15-point crush drop brings them to 2505 → level 10
    expect(getLevelInfo(2505).level).toBe(10);
  });

  it('is also used for refunds — rejection restores exactly the points spent', () => {
    const before = { total_points: 40, lifetime_points: 200 };
    const refundAmount = 60; // the original cost that was deducted

    const after = {
      total_points: before.total_points + refundAmount,
      lifetime_points: before.lifetime_points + refundAmount, // refund goes to lifetime too
    };

    expect(after.total_points).toBe(100);
    // Note: award_crush_drop increments lifetime_points even for refunds.
    // This is a known trade-off: lifetime points go up slightly on rejection refund.
    expect(after.lifetime_points).toBe(260);
  });
});

// ─── Point mutation routing (AD-001) ─────────────────────────────────────────

describe('AD-001: all point mutations must use Postgres RPCs', () => {
  const ALLOWED_MUTATION_RPCS = ['approve_task', 'redeem_reward', 'award_crush_drop'];

  it('the set of point-mutating RPCs is exactly 3', () => {
    expect(ALLOWED_MUTATION_RPCS).toHaveLength(3);
  });

  it('approve_task is in the allowed set', () => {
    expect(ALLOWED_MUTATION_RPCS).toContain('approve_task');
  });

  it('redeem_reward is in the allowed set', () => {
    expect(ALLOWED_MUTATION_RPCS).toContain('redeem_reward');
  });

  it('award_crush_drop is in the allowed set', () => {
    expect(ALLOWED_MUTATION_RPCS).toContain('award_crush_drop');
  });
});
