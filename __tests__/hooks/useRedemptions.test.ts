import { renderHook, waitFor } from '@testing-library/react-native';
import { useKidRedemptions, redemptionStatusMeta } from '@/hooks/useRedemptions';
import { mockQueryBuilder, resetSupabaseMocks } from '../mocks/supabase';
import { makeWrapper } from '../mocks/query-client';

jest.mock('@/lib/supabase', () => require('../mocks/supabase'));

const KID_ID = 'kid-1';

const MOCK_REDEMPTIONS = [
  {
    id: 'red-1', reward_id: 'rew-1', kid_id: KID_ID,
    points_spent: 100, status: 'fulfilled', parent_note: null,
    fulfilled_at: '2025-03-10T00:00:00Z', created_at: '2025-03-08T00:00:00Z',
    reward: { id: 'rew-1', title: 'Movie Night', icon: '🎬', cost_points: 100, category: 'experience' },
    kid: { id: KID_ID, display_name: 'Alice', avatar_emoji: '⭐', color_theme: '#FF5722' },
  },
  {
    id: 'red-2', reward_id: 'rew-2', kid_id: KID_ID,
    points_spent: 50, status: 'pending', parent_note: null,
    fulfilled_at: null, created_at: '2025-03-15T00:00:00Z',
    reward: { id: 'rew-2', title: 'Extra Screen Time', icon: '📱', cost_points: 50, category: 'screen_time' },
    kid: { id: KID_ID, display_name: 'Alice', avatar_emoji: '⭐', color_theme: '#FF5722' },
  },
  {
    id: 'red-3', reward_id: 'rew-3', kid_id: KID_ID,
    points_spent: 200, status: 'rejected', parent_note: 'Not this week, sorry!',
    fulfilled_at: null, created_at: '2025-03-01T00:00:00Z',
    reward: { id: 'rew-3', title: 'Theme Park', icon: '🎢', cost_points: 200, category: 'outing' },
    kid: { id: KID_ID, display_name: 'Alice', avatar_emoji: '⭐', color_theme: '#FF5722' },
  },
];

// useKidRedemptions chain ends with .order()
function mockRedemptions(data = MOCK_REDEMPTIONS) {
  mockQueryBuilder.order.mockResolvedValueOnce({ data, error: null });
}

beforeEach(() => resetSupabaseMocks());

// ─── useKidRedemptions ────────────────────────────────────────────────────────

describe('useKidRedemptions', () => {
  it('is disabled when kidId is undefined', () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useKidRedemptions(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('returns all redemptions for the kid', async () => {
    mockRedemptions();
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useKidRedemptions(KID_ID), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(3);
  });

  it('includes joined reward details', async () => {
    mockRedemptions();
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useKidRedemptions(KID_ID), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const first = result.current.data?.[0];
    expect(first?.reward.title).toBe('Movie Night');
    expect(first?.reward.icon).toBe('🎬');
  });

  it('includes parent_note on rejected redemptions', async () => {
    mockRedemptions();
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useKidRedemptions(KID_ID), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const rejected = result.current.data?.find((r) => r.status === 'rejected');
    expect(rejected?.parent_note).toBe('Not this week, sorry!');
  });

  it('returns empty array when kid has no redemptions', async () => {
    mockRedemptions([]);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useKidRedemptions(KID_ID), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(0);
  });

  it('can filter pending redemptions client-side', async () => {
    mockRedemptions();
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useKidRedemptions(KID_ID), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const pending = result.current.data?.filter((r) => r.status === 'pending') ?? [];
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe('red-2');
  });
});

// ─── redemptionStatusMeta ─────────────────────────────────────────────────────

describe('redemptionStatusMeta', () => {
  it('returns correct meta for pending', () => {
    const meta = redemptionStatusMeta('pending');
    expect(meta.label).toBe('Waiting');
    expect(meta.icon).toBe('⏳');
    expect(meta.color).toBeTruthy();
  });

  it('returns correct meta for approved', () => {
    const meta = redemptionStatusMeta('approved');
    expect(meta.label).toBe('Approved');
    expect(meta.icon).toBe('✅');
  });

  it('returns correct meta for fulfilled', () => {
    const meta = redemptionStatusMeta('fulfilled');
    expect(meta.label).toBe('Delivered');
    expect(meta.icon).toBe('🎁');
  });

  it('returns correct meta for rejected', () => {
    const meta = redemptionStatusMeta('rejected');
    expect(meta.label).toBe('Not this time');
    expect(meta.icon).toBe('❌');
  });

  it('returns a fallback for unknown statuses', () => {
    const meta = redemptionStatusMeta('unknown-status');
    expect(meta.label).toBe('unknown-status');
    expect(meta.color).toBeTruthy();
  });

  it('all statuses have non-empty color, label, and icon', () => {
    ['pending', 'approved', 'fulfilled', 'rejected'].forEach((status) => {
      const meta = redemptionStatusMeta(status);
      expect(meta.color.length).toBeGreaterThan(0);
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.icon.length).toBeGreaterThan(0);
    });
  });
});

// ─── Invariants ───────────────────────────────────────────────────────────────

describe('redemption data invariants', () => {
  it('points_spent is always positive', () => {
    MOCK_REDEMPTIONS.forEach((r) => {
      expect(r.points_spent).toBeGreaterThan(0);
    });
  });

  it('fulfilled_at is null unless status is fulfilled', () => {
    MOCK_REDEMPTIONS.filter((r) => r.status !== 'fulfilled').forEach((r) => {
      expect(r.fulfilled_at).toBeNull();
    });
  });

  it('fulfilled redemption has a fulfilled_at timestamp', () => {
    const fulfilled = MOCK_REDEMPTIONS.find((r) => r.status === 'fulfilled');
    expect(fulfilled?.fulfilled_at).not.toBeNull();
  });
});
