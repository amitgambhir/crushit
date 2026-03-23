import { renderHook, act } from '@testing-library/react-native';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/authStore';
import { mockAuth, mockQueryBuilder, mockFrom, mockRpc, resetSupabaseMocks } from '../mocks/supabase';

jest.mock('@/lib/supabase', () => require('../mocks/supabase'));
jest.mock('expo-apple-authentication', () => ({ signInAsync: jest.fn() }));

const MOCK_SESSION = { access_token: 'tok', user: { id: 'uid-parent' } };
const MOCK_PROFILE = {
  id: 'uid-parent', family_id: 'fam-1', display_name: 'Alex', role: 'parent',
  total_points: 0, lifetime_points: 0, level: 1,
};
const MOCK_FAMILY = { id: 'fam-1', name: 'Test Family', invite_code: 'ABC123' };

beforeEach(() => {
  resetSupabaseMocks();
  act(() => useAuthStore.getState().reset());
});

// ─── signInWithEmail ──────────────────────────────────────────────────────────

describe('signInWithEmail', () => {
  it('calls supabase.auth.signInWithPassword with email and password', async () => {
    mockAuth.signInWithPassword.mockResolvedValueOnce({
      data: { session: MOCK_SESSION },
      error: null,
    });
    mockQueryBuilder.single
      .mockResolvedValueOnce({ data: MOCK_PROFILE, error: null })  // profile fetch
      .mockResolvedValueOnce({ data: MOCK_FAMILY, error: null });   // family fetch

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signInWithEmail('parent@example.com', 'password123');
    });

    expect(mockAuth.signInWithPassword).toHaveBeenCalledWith({
      email: 'parent@example.com',
      password: 'password123',
    });
  });

  it('stores session and profile in authStore on success', async () => {
    mockAuth.signInWithPassword.mockResolvedValueOnce({
      data: { session: MOCK_SESSION },
      error: null,
    });
    mockQueryBuilder.single
      .mockResolvedValueOnce({ data: MOCK_PROFILE, error: null })
      .mockResolvedValueOnce({ data: MOCK_FAMILY, error: null });

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signInWithEmail('parent@example.com', 'pass');
    });

    expect(useAuthStore.getState().session).toEqual(MOCK_SESSION);
    expect(useAuthStore.getState().profile).toEqual(MOCK_PROFILE);
  });

  it('sets error when auth fails', async () => {
    mockAuth.signInWithPassword.mockResolvedValueOnce({
      data: { session: null },
      error: new Error('Invalid login credentials'),
    });

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signInWithEmail('wrong@example.com', 'wrongpass');
    });

    expect(result.current.error).toBe('Invalid login credentials');
    expect(useAuthStore.getState().session).toBeNull();
  });

  it('sets isSubmitting=true during the call and false after', async () => {
    let resolveAuth!: (v: unknown) => void;
    mockAuth.signInWithPassword.mockReturnValueOnce(
      new Promise((res) => { resolveAuth = res; })
    );

    const { result } = renderHook(() => useAuth());
    act(() => { result.current.signInWithEmail('a@b.com', 'p'); });
    expect(result.current.isSubmitting).toBe(true);

    await act(async () => {
      resolveAuth({ data: { session: null }, error: new Error('fail') });
    });
    expect(result.current.isSubmitting).toBe(false);
  });
});

// ─── signUpWithEmail ──────────────────────────────────────────────────────────

describe('signUpWithEmail', () => {
  it('creates a profile with role=parent after sign-up', async () => {
    mockAuth.signUp.mockResolvedValueOnce({
      data: { user: { id: 'new-uid' }, session: MOCK_SESSION },
      error: null,
    });
    mockQueryBuilder.insert.mockResolvedValueOnce({ data: null, error: null });
    mockQueryBuilder.single
      .mockResolvedValueOnce({ data: { ...MOCK_PROFILE, id: 'new-uid' }, error: null })
      .mockResolvedValueOnce({ data: null, error: null });

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signUpWithEmail('new@example.com', 'pass123', 'Alex');
    });

    expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'new-uid', role: 'parent', display_name: 'Alex' })
    );
  });

  it('sets error if supabase.auth.signUp returns an error', async () => {
    mockAuth.signUp.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: new Error('Email already registered'),
    });

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signUpWithEmail('dup@example.com', 'pass', 'Name');
    });

    expect(result.current.error).toBe('Email already registered');
  });
});

// ─── signInAsKid (critical — two-step auth, AD-012) ──────────────────────────

describe('signInAsKid', () => {
  it('looks up family code via get_kid_login_info RPC before signing in', async () => {
    mockRpc.mockResolvedValueOnce({ data: { invite_code: 'FAM001' }, error: null });
    mockAuth.signInWithPassword.mockResolvedValueOnce({
      data: { session: MOCK_SESSION },
      error: null,
    });
    mockQueryBuilder.single
      .mockResolvedValueOnce({ data: { ...MOCK_PROFILE, role: 'kid' }, error: null })
      .mockResolvedValueOnce({ data: MOCK_FAMILY, error: null });

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signInAsKid('Test Family', 'alice', '1234');
    });

    expect(mockRpc).toHaveBeenCalledWith('get_kid_login_info', { p_family_name: 'Test Family', p_username: 'alice' });
  });

  it('constructs internal email from username + invite_code', async () => {
    mockRpc.mockResolvedValueOnce({ data: { invite_code: 'FAM001' }, error: null });
    mockAuth.signInWithPassword.mockResolvedValueOnce({
      data: { session: MOCK_SESSION },
      error: null,
    });
    mockQueryBuilder.single.mockResolvedValue({ data: MOCK_PROFILE, error: null });

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signInAsKid('Test Family', 'Alice', '1234');
    });

    expect(mockAuth.signInWithPassword).toHaveBeenCalledWith({
      email: 'alice@fam001.crushit.internal',
      password: '1234',
    });
  });

  it('returns "Family or username not found" error if RPC returns no data', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null });

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signInAsKid('Test Family', 'ghost', '1234');
    });

    expect(result.current.error).toBe('Family or username not found');
    expect(mockAuth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('returns generic "Incorrect PIN" error when password is wrong — never leaks username existence', async () => {
    // RPC succeeds (username exists), but password fails
    mockRpc.mockResolvedValueOnce({ data: { invite_code: 'FAM001' }, error: null });
    mockAuth.signInWithPassword.mockResolvedValueOnce({
      data: { session: null },
      error: new Error('Invalid login credentials'),
    });

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signInAsKid('Test Family', 'alice', '9999');
    });

    // Must say "Incorrect PIN", NOT the raw Supabase error message
    expect(result.current.error).toBe('Incorrect PIN');
  });

  it('does not sign in if RPC lookup fails', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: new Error('db error') });

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signInAsKid('Test Family', 'alice', '1234');
    });

    expect(mockAuth.signInWithPassword).not.toHaveBeenCalled();
    expect(result.current.error).toBe('Family or username not found');
  });
});

// ─── createFamily ─────────────────────────────────────────────────────────────

describe('createFamily', () => {
  it('calls create_family RPC and refreshes the profile', async () => {
    const newFamily = { id: 'fam-new', name: 'My Family', invite_code: 'XXXXXX' };
    mockRpc.mockReturnValueOnce({
      single: jest.fn().mockResolvedValue({ data: newFamily, error: null }),
    });
    mockQueryBuilder.single
      .mockResolvedValueOnce({ data: { ...MOCK_PROFILE, family_id: 'fam-new' }, error: null }) // loadProfile profiles fetch
      .mockResolvedValueOnce({ data: newFamily, error: null });                               // loadProfile families fetch

    const { result } = renderHook(() => useAuth());
    act(() => {
      useAuthStore.getState().setSession(MOCK_SESSION as unknown as import('@supabase/supabase-js').Session);
    });

    await act(async () => {
      await result.current.createFamily('My Family');
    });

    expect(mockRpc).toHaveBeenCalledWith('create_family', { p_name: 'My Family' });
    expect(useAuthStore.getState().family).toEqual(newFamily);
  });

  it('returns the created family from the RPC', async () => {
    const newFamily = { id: 'fam-new', name: 'Family', invite_code: 'CODE01' };
    mockRpc.mockReturnValueOnce({
      single: jest.fn().mockResolvedValue({ data: newFamily, error: null }),
    });
    mockQueryBuilder.single
      .mockResolvedValueOnce({ data: { ...MOCK_PROFILE, family_id: 'fam-new' }, error: null })
      .mockResolvedValueOnce({ data: newFamily, error: null });

    const { result } = renderHook(() => useAuth());
    act(() => {
      useAuthStore.getState().setSession(MOCK_SESSION as unknown as import('@supabase/supabase-js').Session);
    });

    let returned: unknown;
    await act(async () => {
      returned = await result.current.createFamily('Family');
    });

    expect(returned).toEqual(newFamily);
  });

  it('sets error and returns null if family insert fails', async () => {
    mockRpc.mockReturnValueOnce({
      single: jest.fn().mockResolvedValue({ data: null, error: new Error('conflict') }),
    });

    const { result } = renderHook(() => useAuth());
    let returned: unknown;
    await act(async () => {
      returned = await result.current.createFamily('Family');
    });

    expect(returned).toBeNull();
    expect(result.current.error).toBe('conflict');
  });
});

// ─── joinFamily ───────────────────────────────────────────────────────────────

describe('joinFamily', () => {
  it('calls join_family RPC and refreshes the profile', async () => {
    mockRpc.mockReturnValueOnce({
      single: jest.fn().mockResolvedValue({ data: MOCK_FAMILY, error: null }),
    });
    mockQueryBuilder.single
      .mockResolvedValueOnce({ data: MOCK_PROFILE, error: null })
      .mockResolvedValueOnce({ data: MOCK_FAMILY, error: null });

    const { result } = renderHook(() => useAuth());
    act(() => {
      useAuthStore.getState().setSession(MOCK_SESSION as unknown as import('@supabase/supabase-js').Session);
    });

    await act(async () => {
      await result.current.joinFamily('abc123');
    });

    expect(mockRpc).toHaveBeenCalledWith('join_family', { p_invite_code: 'abc123' });
    expect(useAuthStore.getState().family).toEqual(MOCK_FAMILY);
  });

  it('returns null and sets error for an invalid invite code', async () => {
    mockRpc.mockReturnValueOnce({
      single: jest.fn().mockResolvedValue({ data: null, error: new Error('not found') }),
    });

    const { result } = renderHook(() => useAuth());
    let returned: unknown;
    await act(async () => {
      returned = await result.current.joinFamily('BADCOD');
    });

    expect(returned).toBeNull();
    expect(result.current.error).toBe('Invalid invite code');
  });
});

// ─── signOut ──────────────────────────────────────────────────────────────────

describe('signOut', () => {
  it('calls supabase.auth.signOut', async () => {
    mockAuth.signOut.mockResolvedValueOnce({});
    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signOut(); });
    expect(mockAuth.signOut).toHaveBeenCalled();
  });

  it('resets authStore after sign out', async () => {
    mockAuth.signOut.mockResolvedValueOnce({});
    act(() => useAuthStore.getState().setSession(MOCK_SESSION as unknown as import('@supabase/supabase-js').Session));

    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signOut(); });

    expect(useAuthStore.getState().session).toBeNull();
    expect(useAuthStore.getState().profile).toBeNull();
  });
});
