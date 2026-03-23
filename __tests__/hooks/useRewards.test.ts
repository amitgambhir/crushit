import { renderHook, act } from '@testing-library/react-native';
import {
  useRedeemReward, useRejectRedemption, useCreateReward, useFulfillRedemption, useApproveRedemption,
} from '@/hooks/useRewards';
import { useAuthStore } from '@/store/authStore';
import { mockRpc, mockQueryBuilder, mockFrom, resetSupabaseMocks } from '../mocks/supabase';
import { makeWrapper } from '../mocks/query-client';

jest.mock('@/lib/supabase', () => require('../mocks/supabase'));

const FAMILY_ID = 'fam-1';
const KID_ID = 'kid-1';
const PARENT_ID = 'parent-1';
const REWARD_ID = 'reward-abc';
const REDEMPTION_ID = 'redemption-xyz';

beforeEach(() => {
  resetSupabaseMocks();
  act(() => {
    useAuthStore.setState({
      session: null,
      isLoading: false,
      profile: {
        id: KID_ID, family_id: FAMILY_ID, display_name: 'Kid', role: 'kid',
        username: 'kid1', avatar_url: null, avatar_emoji: '🌟',
        total_points: 100, lifetime_points: 250, level: 3, xp: 250,
        date_of_birth: null, color_theme: '#FF5722', created_at: '', last_active: '',
      },
      family: { id: FAMILY_ID, name: 'Test Family', invite_code: 'ABC123', created_at: '' },
    });
  });
});

// ─── useRedeemReward (AD-001: must use RPC) ───────────────────────────────────

describe('useRedeemReward', () => {
  it('calls redeem_reward RPC with reward ID only — kid identity from auth.uid() (migration 014)', async () => {
    mockRpc.mockResolvedValueOnce({ data: 'redemption-new', error: null });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useRedeemReward(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(REWARD_ID);
    });

    expect(mockRpc).toHaveBeenCalledWith('redeem_reward', { p_reward_id: REWARD_ID });
  });

  it('NEVER directly deducts from profiles.total_points — must use RPC', async () => {
    mockRpc.mockResolvedValueOnce({ data: 'r-id', error: null });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useRedeemReward(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(REWARD_ID);
    });

    const profileUpdates = mockFrom.mock.calls.filter(([t]) => t === 'profiles');
    expect(profileUpdates).toHaveLength(0);
  });

  it('throws and surfaces RPC error (e.g., insufficient points)', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: new Error('Insufficient points') });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useRedeemReward(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync(REWARD_ID)).rejects.toThrow('Insufficient points');
    });
  });

  it('throws when reward is out of stock', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: new Error('Reward no longer available') });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useRedeemReward(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync(REWARD_ID)).rejects.toThrow('Reward no longer available');
    });
  });
});

// ─── useRejectRedemption (refund flow) ────────────────────────────────────────
// useRejectRedemption now routes through reject_redemption() RPC (migration 013)
// so the refund and the redemption_rejected activity_log row are written
// atomically — a raw table update + refund_redemption_points never logged the event.

describe('useRejectRedemption', () => {
  it('calls reject_redemption RPC with redemption ID and note only — no caller-identity param', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useRejectRedemption(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ redemptionId: REDEMPTION_ID, note: 'Not available' });
    });

    expect(mockRpc).toHaveBeenCalledWith('reject_redemption', {
      p_redemption_id: REDEMPTION_ID,
      p_note:          'Not available',
    });
  });

  it('NEVER directly updates the redemptions table — RPC handles it atomically', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useRejectRedemption(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ redemptionId: REDEMPTION_ID, note: 'No' });
    });

    expect(mockQueryBuilder.update).not.toHaveBeenCalled();
  });

  it('NEVER directly writes to profiles — RPC owns the refund (AD-001)', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useRejectRedemption(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ redemptionId: REDEMPTION_ID, note: 'No' });
    });

    const profilesWrites = mockFrom.mock.calls.filter(([t]: [string]) => t === 'profiles');
    expect(profilesWrites.length).toBe(0);
  });

  it('throws and surfaces error when RPC returns an error', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: new Error('redemption not found') });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useRejectRedemption(), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ redemptionId: REDEMPTION_ID, note: 'x' })
      ).rejects.toThrow('redemption not found');
    });
  });
});

// ─── useFulfillRedemption ─────────────────────────────────────────────────────
// useFulfillRedemption now routes through fulfill_redemption() RPC (migration 013)
// so the redemption_fulfilled activity_log row is written atomically.

describe('useFulfillRedemption', () => {
  it('calls fulfill_redemption RPC with redemption ID only — no caller-identity param', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useFulfillRedemption(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(REDEMPTION_ID);
    });

    expect(mockRpc).toHaveBeenCalledWith('fulfill_redemption', { p_redemption_id: REDEMPTION_ID });
  });

  it('NEVER directly updates the redemptions table — RPC handles it atomically', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useFulfillRedemption(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(REDEMPTION_ID);
    });

    expect(mockQueryBuilder.update).not.toHaveBeenCalled();
  });

  it('throws and surfaces error when RPC returns an error', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: new Error('not in approved state') });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useFulfillRedemption(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync(REDEMPTION_ID)).rejects.toThrow('not in approved state');
    });
  });
});

// ─── useApproveRedemption ────────────────────────────────────────────────────

describe('useApproveRedemption', () => {
  beforeEach(() => {
    act(() => {
      useAuthStore.setState({
        profile: {
          id: PARENT_ID, family_id: FAMILY_ID, display_name: 'Parent', role: 'parent',
          username: null, avatar_url: null, avatar_emoji: '⭐',
          total_points: 0, lifetime_points: 0, level: 1, xp: 0,
          date_of_birth: null, color_theme: '#FF5722', created_at: '', last_active: '',
        },
        family: { id: FAMILY_ID, name: 'Test Family', invite_code: 'ABC123', created_at: '' },
        session: null, isLoading: false,
      });
    });
  });

  it('updates the redemption status to approved', async () => {
    mockQueryBuilder.update.mockReturnThis();
    mockQueryBuilder.eq.mockResolvedValueOnce({ data: null, error: null });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useApproveRedemption(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(REDEMPTION_ID);
    });

    expect(mockFrom).toHaveBeenCalledWith('redemptions');
    expect(mockQueryBuilder.update).toHaveBeenCalledWith({ status: 'approved' });
    expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', REDEMPTION_ID);
  });

  it('surfaces update errors', async () => {
    mockQueryBuilder.update.mockReturnThis();
    mockQueryBuilder.eq.mockResolvedValueOnce({ data: null, error: new Error('could not approve') });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useApproveRedemption(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync(REDEMPTION_ID)).rejects.toThrow('could not approve');
    });
  });
});

// ─── useCreateReward ──────────────────────────────────────────────────────────

describe('useCreateReward', () => {
  beforeEach(() => {
    // Set profile to parent for this suite
    act(() => {
      useAuthStore.setState({
        profile: {
          id: PARENT_ID, family_id: FAMILY_ID, display_name: 'Parent', role: 'parent',
          username: null, avatar_url: null, avatar_emoji: '⭐',
          total_points: 0, lifetime_points: 0, level: 1, xp: 0,
          date_of_birth: null, color_theme: '#FF5722', created_at: '', last_active: '',
        },
        family: { id: FAMILY_ID, name: 'Test Family', invite_code: 'ABC123', created_at: '' },
        session: null, isLoading: false,
      });
    });
  });

  it('inserts reward with family_id, created_by, and is_active=true', async () => {
    mockQueryBuilder.insert.mockResolvedValueOnce({ data: null, error: null });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateReward(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        title: 'Ice Cream Trip',
        category: 'food',
        icon: '🍦',
        costPoints: 60,
      });
    });

    expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        family_id: FAMILY_ID,
        created_by: PARENT_ID,
        is_active: true,
        title: 'Ice Cream Trip',
        cost_points: 60,
      })
    );
  });
});
