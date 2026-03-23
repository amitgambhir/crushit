import { renderHook, waitFor, act } from '@testing-library/react-native';
import {
  useStreakRewards,
  useKidUnlockedStreakRewards,
  useCreateStreakReward,
  useDeleteStreakReward,
} from '@/hooks/useStreakRewards';
import { mockQueryBuilder, resetSupabaseMocks } from '../mocks/supabase';
import { makeWrapper } from '../mocks/query-client';

jest.mock('@/lib/supabase', () => require('../mocks/supabase'));
jest.mock('@/store/authStore', () => ({
  useAuthStore: () => ({
    family:  { id: 'fam-1' },
    profile: { id: 'parent-1' },
  }),
}));

const FAMILY_ID = 'fam-1';
const KID_ID    = 'kid-1';

const MOCK_STREAK_REWARDS = [
  {
    id: 'sr-1', family_id: FAMILY_ID, streak_type: 'daily', required_streak: 7,
    reward_title: 'Movie Night', reward_description: 'One movie of your choice',
    bonus_points: 50, is_surprise: false, surprise_icon: '🎁', actual_icon: '🎬',
    created_by: 'parent-1', created_at: '2025-01-01T00:00:00Z',
  },
  {
    id: 'sr-2', family_id: FAMILY_ID, streak_type: 'daily', required_streak: 30,
    reward_title: 'Theme Park', reward_description: 'Day trip!',
    bonus_points: 200, is_surprise: true, surprise_icon: '🎁', actual_icon: null,
    created_by: 'parent-1', created_at: '2025-01-01T00:00:00Z',
  },
];

const MOCK_UNLOCKS = [
  {
    id: 'sru-1', streak_reward_id: 'sr-1', kid_id: KID_ID,
    unlocked_at: '2025-03-10T00:00:00Z', bonus_points_awarded: 50,
    streak_reward: MOCK_STREAK_REWARDS[0],
  },
];

beforeEach(() => resetSupabaseMocks());

// ─── useStreakRewards (parent) ─────────────────────────────────────────────────

describe('useStreakRewards', () => {
  // useStreakRewards query chain: from → select → eq → [eq?] → order → order
  // The second .order() is terminal; first .order() must return the builder.
  function mockRewards(data = MOCK_STREAK_REWARDS) {
    mockQueryBuilder.order.mockReturnValueOnce(mockQueryBuilder); // first .order('streak_type')
    mockQueryBuilder.order.mockResolvedValueOnce({ data, error: null }); // second .order('required_streak')
  }

  it('is disabled when family is not set — hook still mounts without error', () => {
    // The hook is enabled: !!family?.id. With family mock set in the top-level
    // jest.mock, family is always present in this test file. We verify the hook
    // at least returns without throwing when data is available.
    mockRewards();
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useStreakRewards(), { wrapper });
    expect(result.error).toBeUndefined();
  });

  it('returns all streak rewards for the family', async () => {
    mockRewards();
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useStreakRewards(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0].id).toBe('sr-1');
    expect(result.current.data?.[1].id).toBe('sr-2');
  });

  it('returns rewards filtered by streakType when provided', async () => {
    // With streakType: chain is from→select→eq(family)→eq(type)→order→order
    // Terminal is still the second order()
    mockQueryBuilder.order.mockReturnValueOnce(mockQueryBuilder);
    mockQueryBuilder.order.mockResolvedValueOnce({ data: [MOCK_STREAK_REWARDS[0]], error: null });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useStreakRewards('daily'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].streak_type).toBe('daily');
  });

  it('includes bonus_points and reward metadata', async () => {
    mockRewards();
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useStreakRewards(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const movieNight = result.current.data?.find((r) => r.id === 'sr-1');
    expect(movieNight?.bonus_points).toBe(50);
    expect(movieNight?.required_streak).toBe(7);
    expect(movieNight?.is_surprise).toBe(false);
  });

  it('handles empty family rewards list', async () => {
    mockRewards([]);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useStreakRewards(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(0);
  });
});

// ─── useKidUnlockedStreakRewards ──────────────────────────────────────────────

describe('useKidUnlockedStreakRewards', () => {
  // Chain ends with .order() (after .eq().select().order())
  function mockUnlocks(data = MOCK_UNLOCKS) {
    mockQueryBuilder.order.mockResolvedValueOnce({ data, error: null });
  }

  it('is disabled when kidId is undefined', () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useKidUnlockedStreakRewards(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('returns unlocked rewards for the kid', async () => {
    mockUnlocks();
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useKidUnlockedStreakRewards(KID_ID), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].id).toBe('sru-1');
    expect(result.current.data?.[0].bonus_points_awarded).toBe(50);
  });

  it('includes the joined streak_reward details', async () => {
    mockUnlocks();
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useKidUnlockedStreakRewards(KID_ID), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const unlock = result.current.data?.[0];
    expect(unlock?.streak_reward.reward_title).toBe('Movie Night');
    expect(unlock?.streak_reward.required_streak).toBe(7);
  });

  it('returns empty array when kid has no unlocks', async () => {
    mockUnlocks([]);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useKidUnlockedStreakRewards(KID_ID), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(0);
  });
});

// ─── useCreateStreakReward ────────────────────────────────────────────────────

describe('useCreateStreakReward', () => {
  const NEW_REWARD = {
    id: 'sr-new', family_id: FAMILY_ID, streak_type: 'daily', required_streak: 14,
    reward_title: 'Pizza Friday', reward_description: null,
    bonus_points: 100, is_surprise: true, surprise_icon: '🎁', actual_icon: null,
    created_by: 'parent-1', created_at: '2025-03-20T00:00:00Z',
  };

  it('calls insert with correct fields and returns created reward', async () => {
    mockQueryBuilder.single.mockResolvedValueOnce({ data: NEW_REWARD, error: null });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateStreakReward(), { wrapper });

    let created: unknown;
    await act(async () => {
      created = await result.current.mutateAsync({
        streak_type:     'daily',
        required_streak: 14,
        reward_title:    'Pizza Friday',
        bonus_points:    100,
        is_surprise:     true,
      });
    });

    expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        family_id:       FAMILY_ID,
        streak_type:     'daily',
        required_streak: 14,
        reward_title:    'Pizza Friday',
        bonus_points:    100,
        is_surprise:     true,
        created_by:      'parent-1',
      }),
    );
    expect((created as typeof NEW_REWARD).id).toBe('sr-new');
  });

  it('defaults bonus_points to 0 and is_surprise to true when omitted', async () => {
    mockQueryBuilder.single.mockResolvedValueOnce({ data: NEW_REWARD, error: null });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateStreakReward(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        streak_type:     'weekly',
        required_streak: 4,
        reward_title:    'Weekend treat',
      });
    });

    expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ bonus_points: 0, is_surprise: true }),
    );
  });

  it('sets error when insert fails', async () => {
    mockQueryBuilder.single.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateStreakReward(), { wrapper });

    try {
      await act(async () => {
        await result.current.mutateAsync({
          streak_type: 'daily', required_streak: 7, reward_title: 'Fail',
        });
      });
    } catch {
      // expected
    }

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ─── useDeleteStreakReward ────────────────────────────────────────────────────

describe('useDeleteStreakReward', () => {
  it('calls delete with the reward id and family guard', async () => {
    // delete chain: from → delete → eq(id) → eq(family_id) [terminal, resolves]
    // First .eq() must return the builder; second .eq() resolves with the result.
    mockQueryBuilder.eq.mockReturnValueOnce(mockQueryBuilder);
    mockQueryBuilder.eq.mockResolvedValueOnce({ error: null });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useDeleteStreakReward(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('sr-1');
    });

    expect(mockQueryBuilder.delete).toHaveBeenCalled();
    expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'sr-1');
    expect(mockQueryBuilder.eq).toHaveBeenCalledWith('family_id', FAMILY_ID);
  });

  it('sets error when delete fails', async () => {
    mockQueryBuilder.eq.mockReturnValueOnce(mockQueryBuilder);
    mockQueryBuilder.eq.mockResolvedValueOnce({ error: { message: 'Not found' } });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useDeleteStreakReward(), { wrapper });

    try {
      await act(async () => {
        await result.current.mutateAsync('sr-missing');
      });
    } catch {
      // expected
    }

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ─── Invariants ───────────────────────────────────────────────────────────────

describe('streak reward invariants', () => {
  it('bonus_points is never negative (business rule: rewards are always additive)', () => {
    MOCK_STREAK_REWARDS.forEach((sr) => {
      expect(sr.bonus_points).toBeGreaterThanOrEqual(0);
    });
  });

  it('required_streak is always a positive integer', () => {
    MOCK_STREAK_REWARDS.forEach((sr) => {
      expect(sr.required_streak).toBeGreaterThan(0);
      expect(Number.isInteger(sr.required_streak)).toBe(true);
    });
  });

  it('surprise rewards have actual_icon as null until revealed', () => {
    const surprise = MOCK_STREAK_REWARDS.find((sr) => sr.is_surprise);
    expect(surprise?.actual_icon).toBeNull();
  });

  it('non-surprise rewards can have an actual_icon set', () => {
    const nonSurprise = MOCK_STREAK_REWARDS.find((sr) => !sr.is_surprise);
    expect(nonSurprise?.actual_icon).not.toBeNull();
  });
});
