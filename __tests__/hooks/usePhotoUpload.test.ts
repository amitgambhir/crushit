// __tests__/hooks/usePhotoUpload.test.ts
// Tests for hooks/usePhotoUpload.ts.
// Covers: permission denied, user cancels, upload success, upload error,
// invalid URI, clear(), and state transitions.

import { renderHook, act } from '@testing-library/react-native';
import { usePhotoUpload } from '@/hooks/usePhotoUpload';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockRequestPermissions = jest.fn();
const mockLaunchImageLibrary  = jest.fn();
const mockUpload              = jest.fn();
const mockCreateSignedUrl     = jest.fn();
const mockFetch               = jest.fn();

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: (...a: unknown[]) => mockRequestPermissions(...a),
  launchImageLibraryAsync: (...a: unknown[]) => mockLaunchImageLibrary(...a),
  MediaTypeOptions: { Images: 'Images' },
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: (...a: unknown[]) => mockUpload(...a),
        createSignedUrl: (...a: unknown[]) => mockCreateSignedUrl(...a),
      }),
    },
  },
  kidEmail: jest.fn(),
}));

jest.mock('@/lib/photoHelpers', () => ({
  taskProofPath: (kidId: string, taskId: string) => `${kidId}/${taskId}.jpg`,
  isValidImageUri: (uri: string) => uri.startsWith('file://') || uri.startsWith('ph://'),
}));

// Mock global fetch for blob reading
global.fetch = mockFetch as unknown as typeof fetch;

const VALID_URI  = 'file:///var/mobile/Containers/tmp/photo.jpg';
const SIGNED_URL = 'https://storage.supabase.io/signed?token=abc';

function setupSuccess() {
  mockRequestPermissions.mockResolvedValue({ status: 'granted' });
  mockLaunchImageLibrary.mockResolvedValue({
    canceled: false,
    assets: [{ uri: VALID_URI, width: 400, height: 300 }],
  });
  mockFetch.mockResolvedValue({ blob: () => Promise.resolve(new Blob()) });
  mockUpload.mockResolvedValue({ error: null });
  mockCreateSignedUrl.mockResolvedValue({ data: { signedUrl: SIGNED_URL }, error: null });
}

beforeEach(() => {
  mockRequestPermissions.mockReset();
  mockLaunchImageLibrary.mockReset();
  mockUpload.mockReset();
  mockCreateSignedUrl.mockReset();
  mockFetch.mockReset();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('usePhotoUpload — initial state', () => {
  it('starts with null localUri, not uploading, no error', () => {
    const { result } = renderHook(() => usePhotoUpload());
    expect(result.current.localUri).toBeNull();
    expect(result.current.isUploading).toBe(false);
    expect(result.current.error).toBeNull();
  });
});

describe('usePhotoUpload — permission denied', () => {
  it('sets error and returns null when permission is not granted', async () => {
    mockRequestPermissions.mockResolvedValue({ status: 'denied' });
    const { result } = renderHook(() => usePhotoUpload());

    let uploaded: unknown;
    await act(async () => {
      uploaded = await result.current.pickAndUpload('kid-1', 'task-1');
    });

    expect(uploaded).toBeNull();
    expect(result.current.error).toMatch(/access is required/i);
    expect(result.current.isUploading).toBe(false);
  });
});

describe('usePhotoUpload — user cancels picker', () => {
  it('returns null without setting error when user cancels', async () => {
    mockRequestPermissions.mockResolvedValue({ status: 'granted' });
    mockLaunchImageLibrary.mockResolvedValue({ canceled: true, assets: [] });
    const { result } = renderHook(() => usePhotoUpload());

    let uploaded: unknown;
    await act(async () => {
      uploaded = await result.current.pickAndUpload('kid-1', 'task-1');
    });

    expect(uploaded).toBeNull();
    expect(result.current.error).toBeNull();
  });
});

describe('usePhotoUpload — invalid URI', () => {
  it('sets error and returns null for an invalid image URI', async () => {
    mockRequestPermissions.mockResolvedValue({ status: 'granted' });
    mockLaunchImageLibrary.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'data:image/jpeg;base64,abc' }], // invalid — not file:// or ph://
    });
    const { result } = renderHook(() => usePhotoUpload());

    let uploaded: unknown;
    await act(async () => {
      uploaded = await result.current.pickAndUpload('kid-1', 'task-1');
    });

    expect(uploaded).toBeNull();
    expect(result.current.error).toMatch(/could not read/i);
  });
});

describe('usePhotoUpload — successful upload', () => {
  it('returns signedUrl and path on success', async () => {
    setupSuccess();
    const { result } = renderHook(() => usePhotoUpload());

    let uploaded: unknown;
    await act(async () => {
      uploaded = await result.current.pickAndUpload('kid-1', 'task-1');
    });

    expect(uploaded).toEqual({ signedUrl: SIGNED_URL, path: 'kid-1/task-1.jpg' });
  });

  it('sets localUri to the picked file URI', async () => {
    setupSuccess();
    const { result } = renderHook(() => usePhotoUpload());

    await act(async () => {
      await result.current.pickAndUpload('kid-1', 'task-1');
    });

    expect(result.current.localUri).toBe(VALID_URI);
  });

  it('isUploading is false after upload completes', async () => {
    setupSuccess();
    const { result } = renderHook(() => usePhotoUpload());

    await act(async () => {
      await result.current.pickAndUpload('kid-1', 'task-1');
    });

    expect(result.current.isUploading).toBe(false);
  });

  it('passes upsert: true so re-uploads overwrite the previous proof', async () => {
    setupSuccess();
    const { result } = renderHook(() => usePhotoUpload());

    await act(async () => {
      await result.current.pickAndUpload('kid-1', 'task-1');
    });

    expect(mockUpload).toHaveBeenCalledWith(
      'kid-1/task-1.jpg',
      expect.anything(),
      expect.objectContaining({ upsert: true }),
    );
  });

  it('requests a 24-hour signed URL (86400 seconds)', async () => {
    setupSuccess();
    const { result } = renderHook(() => usePhotoUpload());

    await act(async () => {
      await result.current.pickAndUpload('kid-1', 'task-1');
    });

    expect(mockCreateSignedUrl).toHaveBeenCalledWith('kid-1/task-1.jpg', 86_400);
  });
});

describe('usePhotoUpload — upload error', () => {
  it('sets error and returns null when Storage upload fails', async () => {
    mockRequestPermissions.mockResolvedValue({ status: 'granted' });
    mockLaunchImageLibrary.mockResolvedValue({
      canceled: false,
      assets: [{ uri: VALID_URI }],
    });
    mockFetch.mockResolvedValue({ blob: () => Promise.resolve(new Blob()) });
    mockUpload.mockResolvedValue({ error: new Error('Storage quota exceeded') });

    const { result } = renderHook(() => usePhotoUpload());

    let uploaded: unknown;
    await act(async () => {
      uploaded = await result.current.pickAndUpload('kid-1', 'task-1');
    });

    expect(uploaded).toBeNull();
    expect(result.current.error).toMatch(/Storage quota exceeded/);
    expect(result.current.isUploading).toBe(false);
  });

  it('sets error when signed URL generation fails', async () => {
    mockRequestPermissions.mockResolvedValue({ status: 'granted' });
    mockLaunchImageLibrary.mockResolvedValue({
      canceled: false,
      assets: [{ uri: VALID_URI }],
    });
    mockFetch.mockResolvedValue({ blob: () => Promise.resolve(new Blob()) });
    mockUpload.mockResolvedValue({ error: null });
    mockCreateSignedUrl.mockResolvedValue({ data: null, error: new Error('Signed URL error') });

    const { result } = renderHook(() => usePhotoUpload());

    let uploaded: unknown;
    await act(async () => {
      uploaded = await result.current.pickAndUpload('kid-1', 'task-1');
    });

    expect(uploaded).toBeNull();
    expect(result.current.error).toBeTruthy();
  });
});

describe('usePhotoUpload — clear()', () => {
  it('resets localUri and error after clear()', async () => {
    mockRequestPermissions.mockResolvedValue({ status: 'denied' });
    const { result } = renderHook(() => usePhotoUpload());

    await act(async () => {
      await result.current.pickAndUpload('kid-1', 'task-1');
    });
    expect(result.current.error).toBeTruthy();

    act(() => {
      result.current.clear();
    });

    expect(result.current.localUri).toBeNull();
    expect(result.current.error).toBeNull();
  });
});
