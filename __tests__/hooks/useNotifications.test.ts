// __tests__/hooks/useNotifications.test.ts
// Tests for hooks/useNotifications.ts.
// Verifies: token registration on mount, token persisted to DB,
// skips registration when no profile, runs only once per session.

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useNotifications } from '@/hooks/useNotifications';
import { mockFrom, mockQueryBuilder, resetSupabaseMocks } from '../mocks/supabase';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockRegister = jest.fn();

jest.mock('@/lib/notifications', () => ({
  registerForPushNotifications: (...args: unknown[]) => mockRegister(...args),
  buildNotificationPayload: jest.fn(),
  Notifications: { setNotificationHandler: jest.fn() },
}));

jest.mock('@/lib/supabase', () => require('../mocks/supabase'));

const mockUseAuthStore = jest.fn();
jest.mock('@/store/authStore', () => ({
  useAuthStore: () => mockUseAuthStore(),
}));

beforeEach(() => {
  resetSupabaseMocks();
  mockRegister.mockReset();
  mockUseAuthStore.mockReturnValue({ profile: { id: 'profile-1' } });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useNotifications', () => {
  it('returns null pushToken initially', () => {
    mockRegister.mockResolvedValue(null);
    const { result } = renderHook(() => useNotifications());
    expect(result.current.pushToken).toBeNull();
  });

  it('calls registerForPushNotifications on mount when profile is present', async () => {
    const token = 'ExponentPushToken[test-123]';
    mockRegister.mockResolvedValue(token);

    const { result } = renderHook(() => useNotifications());

    await waitFor(() => expect(mockRegister).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.pushToken).toBe(token));
  });

  it('persists token to profiles table on successful registration', async () => {
    const token = 'ExponentPushToken[abc]';
    mockRegister.mockResolvedValue(token);

    renderHook(() => useNotifications());

    await waitFor(() => expect(mockQueryBuilder.update).toHaveBeenCalledWith({ push_token: token }));
    expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'profile-1');
  });

  it('does not call update when registerForPushNotifications returns null', async () => {
    mockRegister.mockResolvedValue(null);

    renderHook(() => useNotifications());

    await waitFor(() => expect(mockRegister).toHaveBeenCalled());
    expect(mockQueryBuilder.update).not.toHaveBeenCalled();
  });

  it('skips registration when profile is not yet loaded', async () => {
    mockUseAuthStore.mockReturnValue({ profile: null });
    mockRegister.mockResolvedValue('ExponentPushToken[x]');

    renderHook(() => useNotifications());

    // Give the effect time to run (it should not)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('registers only once — does not re-register if profile.id changes', async () => {
    const token = 'ExponentPushToken[once]';
    mockRegister.mockResolvedValue(token);

    const { rerender } = renderHook(() => useNotifications());
    await waitFor(() => expect(mockRegister).toHaveBeenCalledTimes(1));

    // Simulate a profile id change (e.g. session refresh)
    mockUseAuthStore.mockReturnValue({ profile: { id: 'profile-2' } });
    rerender({});

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // registeredRef.current = true prevents a second call
    expect(mockRegister).toHaveBeenCalledTimes(1);
  });
});
