// __tests__/unit/photoUpload.test.ts
// Tests for the pure helpers in hooks/usePhotoUpload.ts.
// The hook itself relies on expo-image-picker and fetch (native) so we test
// only the pure decision functions.

import { taskProofPath, isValidImageUri } from '@/lib/photoHelpers';

// ─── taskProofPath ────────────────────────────────────────────────────────────

describe('taskProofPath', () => {
  it('builds a path from kidId and taskId', () => {
    const path = taskProofPath('kid-123', 'task-456');
    expect(path).toBe('kid-123/task-456.jpg');
  });

  it('always ends with .jpg', () => {
    const path = taskProofPath('k', 't');
    expect(path.endsWith('.jpg')).toBe(true);
  });

  it('is deterministic — same inputs always produce the same path', () => {
    const p1 = taskProofPath('kid-abc', 'task-xyz');
    const p2 = taskProofPath('kid-abc', 'task-xyz');
    expect(p1).toBe(p2);
  });

  it('different kids produce different paths for the same task', () => {
    const p1 = taskProofPath('kid-1', 'task-1');
    const p2 = taskProofPath('kid-2', 'task-1');
    expect(p1).not.toBe(p2);
  });

  it('different tasks produce different paths for the same kid', () => {
    const p1 = taskProofPath('kid-1', 'task-1');
    const p2 = taskProofPath('kid-1', 'task-2');
    expect(p1).not.toBe(p2);
  });

  it('path structure is <kidId>/<taskId>.jpg', () => {
    const kidId  = 'kid-uuid-123';
    const taskId = 'task-uuid-456';
    expect(taskProofPath(kidId, taskId)).toBe(`${kidId}/${taskId}.jpg`);
  });
});

// ─── isValidImageUri ──────────────────────────────────────────────────────────

describe('isValidImageUri', () => {
  it('accepts file:// URIs (iOS/Android local files)', () => {
    expect(isValidImageUri('file:///var/mobile/photo.jpg')).toBe(true);
  });

  it('accepts content:// URIs (Android content providers)', () => {
    expect(isValidImageUri('content://media/external/images/1')).toBe(true);
  });

  it('accepts http:// URIs (remote images)', () => {
    expect(isValidImageUri('http://example.com/photo.jpg')).toBe(true);
  });

  it('accepts https:// URIs (signed URLs from Supabase Storage)', () => {
    expect(isValidImageUri('https://project.supabase.co/storage/v1/sign/task-proofs/kid-1/task-1.jpg?token=abc')).toBe(true);
  });

  it('rejects null', () => {
    expect(isValidImageUri(null)).toBe(false);
  });

  it('rejects undefined', () => {
    expect(isValidImageUri(undefined)).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidImageUri('')).toBe(false);
  });

  it('rejects bare filenames without a scheme', () => {
    expect(isValidImageUri('photo.jpg')).toBe(false);
    expect(isValidImageUri('/var/mobile/photo.jpg')).toBe(false);
  });

  it('rejects data: URIs (not supported — too large for memory)', () => {
    expect(isValidImageUri('data:image/jpeg;base64,/9j/4AAQ...')).toBe(false);
  });
});

// ─── AD-010 spec compliance ───────────────────────────────────────────────────

describe('AD-010: photo proof storage conventions', () => {
  it('storage path is scoped to kid so each kid can only overwrite their own proofs', () => {
    const path = taskProofPath('kid-alice', 'task-homework');
    expect(path.startsWith('kid-alice/')).toBe(true);
  });

  it('upsert path per (kidId, taskId) means re-uploads replace the previous photo', () => {
    // Same kid + same task always yields the same path → upsert replaces the file
    const path1 = taskProofPath('kid-1', 'task-1');
    const path2 = taskProofPath('kid-1', 'task-1');
    expect(path1).toBe(path2);
  });

  it('different tasks get different storage keys so proofs do not collide', () => {
    const pathA = taskProofPath('kid-1', 'task-a');
    const pathB = taskProofPath('kid-1', 'task-b');
    expect(pathA).not.toBe(pathB);
  });
});
