import { renderHook, waitFor, act } from '@testing-library/react-native';
import { useHasParentPIN, useSetParentPIN, useVerifyParentPIN } from '@/hooks/useParentPIN';
import { mockRpc, resetSupabaseMocks } from '../mocks/supabase';
import { makeWrapper } from '../mocks/query-client';

jest.mock('@/lib/supabase', () => require('../mocks/supabase'));

// Mock authStore — parent profile with id 'parent-1'
jest.mock('@/store/authStore', () => ({
  useAuthStore: () => ({
    profile: { id: 'parent-1', role: 'parent' },
  }),
}));

beforeEach(() => resetSupabaseMocks());

// ─── useHasParentPIN ──────────────────────────────────────────────────────────

describe('useHasParentPIN', () => {
  it('returns false when no PIN is set', async () => {
    mockRpc.mockResolvedValueOnce({ data: false, error: null });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useHasParentPIN(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(false);
  });

  it('returns true when a PIN is set', async () => {
    mockRpc.mockResolvedValueOnce({ data: true, error: null });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useHasParentPIN(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(true);
  });

  it('calls has_parent_pin RPC', async () => {
    mockRpc.mockResolvedValueOnce({ data: false, error: null });
    const { wrapper } = makeWrapper();
    renderHook(() => useHasParentPIN(), { wrapper });

    await waitFor(() => expect(mockRpc).toHaveBeenCalled());
    expect(mockRpc).toHaveBeenCalledWith('has_parent_pin');
  });

  it('surfaces errors from the RPC', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: new Error('DB error') });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useHasParentPIN(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ─── useSetParentPIN ──────────────────────────────────────────────────────────

describe('useSetParentPIN', () => {
  it('calls set_parent_pin RPC with the PIN', async () => {
    // useSetParentPIN is a mutation-only hook; one mock for the mutation call
    mockRpc.mockResolvedValueOnce({ data: null, error: null });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSetParentPIN(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('1234');
    });

    expect(mockRpc).toHaveBeenCalledWith('set_parent_pin', { p_pin: '1234' });
  });

  it('throws when the RPC returns an error', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: new Error('PIN must be 4 digits') });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSetParentPIN(), { wrapper });

    let caught: Error | null = null;
    await act(async () => {
      try {
        await result.current.mutateAsync('bad');
      } catch (err) {
        caught = err as Error;
      }
    });

    expect(caught).not.toBeNull();
    expect(caught?.message).toBe('PIN must be 4 digits');
  });
});

// ─── useVerifyParentPIN ───────────────────────────────────────────────────────

describe('useVerifyParentPIN', () => {
  it('returns true on correct PIN', async () => {
    mockRpc.mockResolvedValueOnce({ data: true, error: null });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useVerifyParentPIN(), { wrapper });

    let verified: boolean | undefined;
    await act(async () => {
      verified = await result.current.mutateAsync('1234');
    });

    expect(verified).toBe(true);
    expect(mockRpc).toHaveBeenCalledWith('verify_parent_pin', { p_pin: '1234' });
  });

  it('returns false on wrong PIN', async () => {
    mockRpc.mockResolvedValueOnce({ data: false, error: null });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useVerifyParentPIN(), { wrapper });

    let verified: boolean | undefined;
    await act(async () => {
      verified = await result.current.mutateAsync('0000');
    });

    expect(verified).toBe(false);
  });

  it('throws on RPC error', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: new Error('DB failure') });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useVerifyParentPIN(), { wrapper });

    let caught: Error | null = null;
    await act(async () => {
      try {
        await result.current.mutateAsync('1234');
      } catch (err) {
        caught = err as Error;
      }
    });

    expect(caught).not.toBeNull();
    expect(caught?.message).toBe('DB failure');
  });
});
