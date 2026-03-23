// lib/photoHelpers.ts
// Pure helpers for photo proof upload (AD-010).
// Imported by hooks/usePhotoUpload.ts and Jest tests.
// No native or Supabase imports — safe to import in any environment.

/**
 * Builds the Supabase Storage path for a task proof photo.
 * Path: <kidId>/<taskId>.jpg
 * — scoped to kid so RLS can restrict to `storage.objects.name like kidId || '/%'`
 * — upsert-friendly: same task always maps to the same key, so re-uploads replace the file
 */
export function taskProofPath(kidId: string, taskId: string): string {
  return `${kidId}/${taskId}.jpg`;
}

/**
 * Returns true when a URI looks like a valid image source.
 * Accepts:  file://  (iOS/Android local files)
 *           content://  (Android content providers)
 *           http:// / https://  (remote images, signed Supabase URLs)
 * Rejects:  null, undefined, empty string, bare paths, data: URIs
 */
export function isValidImageUri(uri: string | null | undefined): boolean {
  if (!uri) return false;
  return uri.startsWith('file://') || uri.startsWith('content://') || uri.startsWith('http');
}
