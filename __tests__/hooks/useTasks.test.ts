import { renderHook, act } from '@testing-library/react-native';
import {
  useApproveTask, useRejectTask, useSubmitTask, useCreateTask, useAwardCrushDrop,
} from '@/hooks/useTasks';
import { useAuthStore } from '@/store/authStore';
import { mockRpc, mockQueryBuilder, mockFrom, resetSupabaseMocks } from '../mocks/supabase';
import { makeWrapper } from '../mocks/query-client';

jest.mock('@/lib/supabase', () => require('../mocks/supabase'));

const FAMILY_ID = 'fam-1';
const PARENT_ID = 'parent-1';
const KID_ID = 'kid-1';
const TASK_ID = 'task-abc';

beforeEach(() => {
  resetSupabaseMocks();
  act(() => {
    useAuthStore.setState({
      session: null,
      isLoading: false,
      profile: {
        id: PARENT_ID, family_id: FAMILY_ID, display_name: 'Parent',
        role: 'parent', username: null, avatar_url: null, avatar_emoji: '⭐',
        total_points: 0, lifetime_points: 0, level: 1, xp: 0,
        date_of_birth: null, color_theme: '#FF5722', created_at: '', last_active: '',
      },
      family: { id: FAMILY_ID, name: 'Test Family', invite_code: 'ABC123', created_at: '' },
    });
  });
});

// ─── useApproveTask (AD-001: must call RPC, never direct table write) ─────────
// Caller identity resolved from auth.uid() server-side (migration 014) —
// no p_parent_id in the RPC signature.

describe('useApproveTask', () => {
  it('calls approve_task RPC with task ID only — no caller-identity param', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useApproveTask(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(TASK_ID);
    });

    expect(mockRpc).toHaveBeenCalledWith('approve_task', { p_task_id: TASK_ID });
  });

  it('NEVER calls supabase.from("tasks") to directly update status — must use RPC', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useApproveTask(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(TASK_ID);
    });

    const tasksUpdateCalls = mockFrom.mock.calls.filter(([table]) => table === 'tasks');
    expect(tasksUpdateCalls).toHaveLength(0);
  });

  it('throws and surfaces error when RPC returns an error', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: new Error('task not found') });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useApproveTask(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync(TASK_ID)).rejects.toThrow('task not found');
    });
  });
});

// ─── useRejectTask ────────────────────────────────────────────────────────────
// useRejectTask now routes through the reject_task() RPC (migration 013) so
// the task_rejected activity_log row is written atomically — symmetric with
// approve_task(). A raw tasks.update() would never emit the notification.

describe('useRejectTask', () => {
  it('calls reject_task RPC with task ID and reason only — no caller-identity param', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useRejectTask(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ taskId: TASK_ID, reason: 'Not done properly' });
    });

    expect(mockRpc).toHaveBeenCalledWith('reject_task', {
      p_task_id: TASK_ID,
      p_reason:  'Not done properly',
    });
  });

  it('NEVER directly updates the tasks table — RPC handles it atomically', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useRejectTask(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ taskId: TASK_ID, reason: 'Not done' });
    });

    const tasksUpdateCalls = mockFrom.mock.calls.filter(([table]) => table === 'tasks');
    expect(tasksUpdateCalls).toHaveLength(0);
  });

  it('throws and surfaces error when RPC returns an error', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: new Error('task not found') });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useRejectTask(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync({ taskId: TASK_ID, reason: 'bad' })).rejects.toThrow('task not found');
    });
  });
});

// ─── useSubmitTask (kid submitting for approval) ──────────────────────────────

describe('useSubmitTask', () => {
  // useSubmitTask now routes through submit_task() RPC (migration 012) so that
  // the status update, completed_at, proof fields, and the task_submitted
  // activity_log row are written atomically — symmetric with approve_task().

  it('calls submit_task RPC with the task id', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSubmitTask(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ taskId: TASK_ID });
    });

    expect(mockRpc).toHaveBeenCalledWith('submit_task', {
      p_task_id:         TASK_ID,
      p_proof_note:      null,
      p_proof_photo_url: null,
    });
  });

  it('passes proof_note and proof_photo_url to the RPC', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSubmitTask(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        taskId: TASK_ID,
        proofNote: 'All done!',
        proofPhotoUrl: 'https://storage.example.com/proof.jpg',
      });
    });

    expect(mockRpc).toHaveBeenCalledWith('submit_task', {
      p_task_id:         TASK_ID,
      p_proof_note:      'All done!',
      p_proof_photo_url: 'https://storage.example.com/proof.jpg',
    });
  });

  it('does NOT directly update the tasks table — RPC handles it atomically', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSubmitTask(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ taskId: TASK_ID });
    });

    expect(mockQueryBuilder.update).not.toHaveBeenCalled();
  });

  it('does NOT touch the profiles table — no point mutation on submission', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSubmitTask(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ taskId: TASK_ID });
    });

    const profileAccesses = mockFrom.mock.calls.filter(([t]: [string]) => t === 'profiles');
    expect(profileAccesses).toHaveLength(0);
  });
});

// ─── useCreateTask ────────────────────────────────────────────────────────────

describe('useCreateTask', () => {
  it('inserts a task with status="pending" by default', async () => {
    mockQueryBuilder.insert.mockResolvedValueOnce({ data: null, error: null });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateTask(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        title: 'Clean room',
        category: 'chores',
        icon: '🧹',
        points: 15,
      });
    });

    expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending', family_id: FAMILY_ID })
    );
  });

  it('includes assigned_to as null when no kid is specified', async () => {
    mockQueryBuilder.insert.mockResolvedValueOnce({ data: null, error: null });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateTask(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ title: 'Task', category: 'chores', icon: '🏠', points: 10 });
    });

    expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ assigned_to: null })
    );
  });
});

// ─── useAwardCrushDrop (AD-001: must use RPC) ─────────────────────────────────

describe('useAwardCrushDrop', () => {
  it('calls award_crush_drop RPC with kid ID, points, and reason — no caller-identity param', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useAwardCrushDrop(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ kidId: KID_ID, points: 20, reason: 'Great attitude!' });
    });

    expect(mockRpc).toHaveBeenCalledWith('award_crush_drop', {
      p_kid_id: KID_ID,
      p_points: 20,
      p_reason: 'Great attitude!',
    });
  });

  it('NEVER directly writes to profiles.total_points', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useAwardCrushDrop(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ kidId: KID_ID, points: 10, reason: 'Bonus' });
    });

    const profileCalls = mockFrom.mock.calls.filter(([t]) => t === 'profiles');
    expect(profileCalls).toHaveLength(0);
  });

  it('throws when RPC returns an error', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: new Error('kid not found') });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useAwardCrushDrop(), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ kidId: 'bad-id', points: 10, reason: 'test' })
      ).rejects.toThrow('kid not found');
    });
  });
});
