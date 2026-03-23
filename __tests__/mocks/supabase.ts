/**
 * Chainable Supabase mock.
 *
 * Usage in a test file:
 *   jest.mock('@/lib/supabase', () => require('../mocks/supabase'));
 *
 * Then in individual tests:
 *   import { mockFrom, mockRpc, mockFunctions, mockAuth } from '../mocks/supabase';
 *   mockFrom.select.mockResolvedValueOnce({ data: [...], error: null });
 */

// Chainable query builder — every method returns `this` so callers can chain
export const mockQueryBuilder = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  neq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  or: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: null, error: null }),
  maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  // Terminal methods for update/delete chains
  then: undefined as unknown, // forces awaitable
};
// Allow the builder itself to be awaited (for insert/delete without .single())
(mockQueryBuilder as unknown as Promise<unknown>).then = (resolve: (v: unknown) => unknown) =>
  Promise.resolve({ data: null, error: null }).then(resolve);

export const mockAuth = {
  signInWithPassword: jest.fn(),
  signUp: jest.fn(),
  signOut: jest.fn(),
  getUser: jest.fn(),
  onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
  signInWithIdToken: jest.fn(),
};

export const mockRpc = jest.fn().mockResolvedValue({ data: null, error: null });

export const mockFunctions = {
  invoke: jest.fn().mockResolvedValue({ data: null, error: null }),
};

export const mockFrom = jest.fn(() => mockQueryBuilder);

export const supabase = {
  from: mockFrom,
  auth: mockAuth,
  rpc: mockRpc,
  functions: mockFunctions,
};

export function kidEmail(username: string, inviteCode: string): string {
  return `${username.toLowerCase()}@${inviteCode.toLowerCase()}.crushit.internal`;
}

// Helper: reset all mocks to clean state between tests
export function resetSupabaseMocks() {
  mockFrom.mockClear();
  // mockReset (not mockClear) clears the mockResolvedValueOnce queue so once-values
  // don't leak between tests.
  mockRpc.mockReset().mockResolvedValue({ data: null, error: null });
  mockFunctions.invoke.mockClear().mockResolvedValue({ data: null, error: null });
  mockAuth.signInWithPassword.mockClear();
  mockAuth.signUp.mockClear();
  mockAuth.signOut.mockClear();
  mockAuth.getUser.mockClear();

  Object.values(mockQueryBuilder).forEach((v) => {
    if (typeof v === 'function' && 'mockReset' in v) {
      (v as jest.Mock).mockReset();
      if (v !== mockQueryBuilder.single && v !== mockQueryBuilder.maybeSingle) {
        (v as jest.Mock).mockReturnThis();
      }
    }
  });
  mockQueryBuilder.single.mockResolvedValue({ data: null, error: null });
  mockQueryBuilder.maybeSingle.mockResolvedValue({ data: null, error: null });
}
