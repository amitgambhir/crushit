import { renderHook, act } from '@testing-library/react-native';
import { useCreateKid, useUpdateKid, useUpdateMyProfile } from '@/hooks/useFamily';
import { useAuthStore } from '@/store/authStore';
import { mockFunctions, mockQueryBuilder, mockFrom, resetSupabaseMocks } from '../mocks/supabase';
import { makeWrapper } from '../mocks/query-client';

jest.mock('@/lib/supabase', () => require('../mocks/supabase'));

const FAMILY_ID = 'fam-1';
const PARENT_ID = 'parent-1';

beforeEach(() => {
  resetSupabaseMocks();
  act(() => {
    useAuthStore.setState({
      session: null, isLoading: false,
      profile: {
        id: PARENT_ID, family_id: FAMILY_ID, display_name: 'Parent', role: 'parent',
        username: null, avatar_url: null, avatar_emoji: '⭐',
        total_points: 0, lifetime_points: 0, level: 1, xp: 0,
        date_of_birth: null, color_theme: '#FF5722', created_at: '', last_active: '',
      },
      family: { id: FAMILY_ID, name: 'Test Family', invite_code: 'ABC123', created_at: '' },
    });
  });
});

// ─── useCreateKid ─────────────────────────────────────────────────────────────

describe('useCreateKid', () => {
  it('invokes the create-kid Edge Function (not a direct Supabase insert)', async () => {
    mockFunctions.invoke.mockResolvedValueOnce({ data: { userId: 'new-kid-id' }, error: null });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateKid(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        displayName: 'Alice',
        username: 'alice',
        pin: '1234',
        avatarEmoji: '🌟',
        colorTheme: '#FF5722',
      });
    });

    expect(mockFunctions.invoke).toHaveBeenCalledWith('create-kid', expect.objectContaining({
      body: expect.objectContaining({
        displayName: 'Alice',
        username: 'alice',
        pin: '1234',
        familyId: FAMILY_ID,
      }),
    }));
  });

  it('passes familyId from authStore to the Edge Function', async () => {
    mockFunctions.invoke.mockResolvedValueOnce({ data: { userId: 'x' }, error: null });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateKid(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        displayName: 'Bob', username: 'bob', pin: '5678', avatarEmoji: '⭐', colorTheme: '#000',
      });
    });

    const invokeBody = mockFunctions.invoke.mock.calls[0][1].body as Record<string, unknown>;
    expect(invokeBody.familyId).toBe(FAMILY_ID);
  });

  it('throws when the Edge Function returns an error', async () => {
    mockFunctions.invoke.mockResolvedValueOnce({
      data: null,
      error: new Error('Username already taken in this family'),
    });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateKid(), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          displayName: 'Alice', username: 'alice', pin: '1234',
          avatarEmoji: '⭐', colorTheme: '#FF5722',
        })
      ).rejects.toThrow('Username already taken in this family');
    });
  });

  it('prefers the function response body error when a non-2xx invoke returns JSON', async () => {
    mockFunctions.invoke.mockResolvedValueOnce({
      data: null,
      error: new Error('Edge Function returned a non-2xx status code'),
      response: {
        json: jest.fn().mockResolvedValue({ error: 'Family not found' }),
      },
    });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateKid(), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          displayName: 'Alice',
          username: 'alice',
          pin: '1234',
          avatarEmoji: '⭐',
          colorTheme: '#FF5722',
        })
      ).rejects.toThrow('Family not found');
    });
  });

  it('does NOT insert directly into auth.users or profiles — that is the Edge Function\'s job', async () => {
    mockFunctions.invoke.mockResolvedValueOnce({ data: { userId: 'x' }, error: null });
    const { mockFrom } = jest.requireMock('@/lib/supabase') as { mockFrom: jest.Mock };

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateKid(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        displayName: 'Alice', username: 'alice', pin: '1234', avatarEmoji: '⭐', colorTheme: '#FF5722',
      });
    });

    // Hook must not touch profiles or auth directly
    const fromCalls = mockFrom.mock.calls.map(([t]: [string]) => t);
    expect(fromCalls).not.toContain('profiles');
  });
});

describe('useUpdateMyProfile', () => {
  it('updates the signed-in kid profile and refreshes authStore from Supabase', async () => {
    const refreshedProfile = {
      id: PARENT_ID,
      family_id: FAMILY_ID,
      display_name: 'Parent',
      role: 'parent',
      username: null,
      avatar_url: null,
      avatar_emoji: '🦁',
      total_points: 0,
      lifetime_points: 0,
      level: 1,
      xp: 0,
      date_of_birth: null,
      color_theme: '#00BCD4',
      created_at: '',
      last_active: '',
    };

    mockQueryBuilder.update.mockReturnThis();
    mockQueryBuilder.eq
      .mockResolvedValueOnce({ data: null, error: null })
      .mockReturnThis();
    mockQueryBuilder.single.mockResolvedValueOnce({ data: refreshedProfile, error: null });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useUpdateMyProfile(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ avatar_emoji: '🦁', color_theme: '#00BCD4' });
    });

    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(mockQueryBuilder.update).toHaveBeenCalledWith({
      avatar_emoji: '🦁',
      color_theme: '#00BCD4',
    });
    expect(useAuthStore.getState().profile?.avatar_emoji).toBe('🦁');
    expect(useAuthStore.getState().profile?.color_theme).toBe('#00BCD4');
  });

  it('surfaces update errors without replacing the local profile', async () => {
    const originalProfile = useAuthStore.getState().profile;

    mockQueryBuilder.update.mockReturnThis();
    mockQueryBuilder.eq.mockResolvedValueOnce({ data: null, error: new Error('update failed') });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useUpdateMyProfile(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync({ avatar_emoji: '🚀' })).rejects.toThrow('update failed');
    });

    expect(useAuthStore.getState().profile).toEqual(originalProfile);
  });
});

describe('useUpdateKid', () => {
  it('updates the requested kid and scopes the write by kid id', async () => {
    mockQueryBuilder.update.mockReturnThis();
    mockQueryBuilder.eq.mockResolvedValueOnce({ data: null, error: null });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useUpdateKid(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        kidId: 'kid-123',
        updates: { display_name: 'Updated Kid', color_theme: '#8BC34A' },
      });
    });

    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(mockQueryBuilder.update).toHaveBeenCalledWith({
      display_name: 'Updated Kid',
      color_theme: '#8BC34A',
    });
    expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'kid-123');
  });

  it('surfaces update errors from Supabase', async () => {
    mockQueryBuilder.update.mockReturnThis();
    mockQueryBuilder.eq.mockResolvedValueOnce({ data: null, error: new Error('kid update failed') });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useUpdateKid(), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ kidId: 'kid-123', updates: { display_name: 'x' } })
      ).rejects.toThrow('kid update failed');
    });
  });
});
