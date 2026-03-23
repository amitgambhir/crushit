import { renderHook, waitFor } from '@testing-library/react-native';
import { useKidAchievements } from '@/hooks/useAchievements';
import { mockQueryBuilder, resetSupabaseMocks } from '../mocks/supabase';
import { makeWrapper } from '../mocks/query-client';

jest.mock('@/lib/supabase', () => require('../mocks/supabase'));

const KID_ID = 'kid-1';

const MOCK_ACHIEVEMENTS = [
  { id: 'ach-1', key: 'first_task',  title: 'First Steps', description: 'First!', icon: '🌟', badge_color: '#FFD600', category: 'milestone', condition_type: 'tasks_completed', condition_value: 1 },
  { id: 'ach-2', key: 'task_5',      title: 'On a Roll',   description: '5 tasks', icon: '🎯', badge_color: '#FF9800', category: 'tasks',     condition_type: 'tasks_completed', condition_value: 5 },
  { id: 'ach-3', key: 'points_100',  title: 'Collector',   description: '100 pts', icon: '💎', badge_color: '#0097A7', category: 'milestone', condition_type: 'points_earned',   condition_value: 100 },
];

const MOCK_KID_ACHIEVEMENTS = [
  { achievement_id: 'ach-1', unlocked_at: '2025-01-01T00:00:00Z' },
];

// useKidAchievements runs two queries in Promise.all:
//   1. achievements catalogue — ends with .order()   → mock order
//   2. kid_achievements earned — ends with .eq()     → mock eq
function mockAchievementQueries(
  catalogue = MOCK_ACHIEVEMENTS,
  earned = MOCK_KID_ACHIEVEMENTS
) {
  mockQueryBuilder.order.mockResolvedValueOnce({ data: catalogue, error: null });
  mockQueryBuilder.eq.mockResolvedValueOnce({ data: earned, error: null });
}

beforeEach(() => resetSupabaseMocks());

// ─── useKidAchievements ───────────────────────────────────────────────────────

describe('useKidAchievements', () => {
  it('is disabled when kidId is undefined', () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useKidAchievements(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('marks only kid_achievements rows as earned', async () => {
    mockAchievementQueries();
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useKidAchievements(KID_ID), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const first = result.current.data?.find((a) => a.id === 'ach-1');
    const second = result.current.data?.find((a) => a.id === 'ach-2');
    expect(first?.earned).toBe(true);
    expect(second?.earned).toBe(false);
  });

  it('includes unlocked_at for earned achievements', async () => {
    mockAchievementQueries();
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useKidAchievements(KID_ID), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const first = result.current.data?.find((a) => a.id === 'ach-1');
    expect(first?.unlocked_at).toBe('2025-01-01T00:00:00Z');
  });

  it('sets unlocked_at=null for locked achievements', async () => {
    mockAchievementQueries();
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useKidAchievements(KID_ID), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const locked = result.current.data?.find((a) => a.id === 'ach-2');
    expect(locked?.unlocked_at).toBeNull();
  });

  it('handles empty kid_achievements — all locked', async () => {
    mockAchievementQueries(MOCK_ACHIEVEMENTS, []);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useKidAchievements(KID_ID), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.every((a) => !a.earned)).toBe(true);
  });

  it('handles all earned — all locked list is empty', async () => {
    const allEarned = MOCK_ACHIEVEMENTS.map((a) => ({
      achievement_id: a.id,
      unlocked_at: '2025-01-01T00:00:00Z',
    }));
    mockAchievementQueries(MOCK_ACHIEVEMENTS, allEarned);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useKidAchievements(KID_ID), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.every((a) => a.earned)).toBe(true);
  });
});

// ─── Invariants ───────────────────────────────────────────────────────────────

describe('achievement data invariants', () => {
  it('earned + locked always equals the full catalogue', async () => {
    mockAchievementQueries();
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useKidAchievements(KID_ID), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data ?? [];
    const earned = data.filter((a) => a.earned).length;
    const locked = data.filter((a) => !a.earned).length;
    expect(earned + locked).toBe(MOCK_ACHIEVEMENTS.length);
  });

  it('no achievement ID appears twice in the result', async () => {
    mockAchievementQueries();
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useKidAchievements(KID_ID), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const ids = result.current.data?.map((a) => a.id) ?? [];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('kid_achievements rows that reference unknown achievement IDs are ignored', async () => {
    // A ghost achievement_id not in the catalogue should not appear in results
    mockAchievementQueries(MOCK_ACHIEVEMENTS, [
      { achievement_id: 'ach-1', unlocked_at: '2025-01-01T00:00:00Z' },
      { achievement_id: 'ghost-id', unlocked_at: '2025-01-02T00:00:00Z' },
    ]);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useKidAchievements(KID_ID), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const ids = result.current.data?.map((a) => a.id) ?? [];
    expect(ids).not.toContain('ghost-id');
    expect(ids.length).toBe(MOCK_ACHIEVEMENTS.length);
  });
});
