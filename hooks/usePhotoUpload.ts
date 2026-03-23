// hooks/usePhotoUpload.ts
// Photo proof upload for task submissions (AD-010).
//
// Flow:
//   1. launchImageLibraryAsync (or camera) — user picks image
//   2. Resize to max 800px, quality 0.8 (client-side compression via ImagePicker options)
//   3. Upload blob to Supabase Storage bucket `task-proofs`
//   4. Generate a signed URL (24h expiry) for parent review
//   5. Return the signed URL to be stored in tasks.proof_photo_url
//
// The bucket `task-proofs` must exist in Supabase with a service-role policy
// allowing authenticated users to upload to `<kid_id>/<task_id>.jpg`.

import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { taskProofPath, isValidImageUri } from '@/lib/photoHelpers';

export { taskProofPath, isValidImageUri };

export interface PhotoUploadResult {
  signedUrl: string;
  path: string;
}

export interface UsePhotoUploadReturn {
  localUri:    string | null;
  isUploading: boolean;
  error:       string | null;
  pickAndUpload: (kidId: string, taskId: string) => Promise<PhotoUploadResult | null>;
  clear:       () => void;
}

export function usePhotoUpload(): UsePhotoUploadReturn {
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pickAndUpload(kidId: string, taskId: string): Promise<PhotoUploadResult | null> {
    setError(null);

    // Request media library permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setError('Photo library access is required to attach a proof photo.');
      return null;
    }

    // Launch picker — compress client-side per AD-010
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,        // 80% JPEG quality
      allowsEditing: true,
      aspect: [4, 3],
      // expo-image-picker resizes before calling us when we pass these options:
      exif: false,
    });

    if (result.canceled || !result.assets?.[0]) return null;

    const asset = result.assets[0];
    if (!isValidImageUri(asset.uri)) {
      setError('Could not read the selected image.');
      return null;
    }

    setLocalUri(asset.uri);
    setIsUploading(true);

    try {
      // Fetch the local file as a blob
      const response = await fetch(asset.uri);
      const blob = await response.blob();

      const path = taskProofPath(kidId, taskId);

      const { error: uploadErr } = await supabase.storage
        .from('task-proofs')
        .upload(path, blob, {
          contentType: 'image/jpeg',
          upsert: true, // replace if kid re-uploads for the same task
        });

      if (uploadErr) throw uploadErr;

      // Generate a signed URL valid for 24 hours (AD-010)
      const { data: signedData, error: signedErr } = await supabase.storage
        .from('task-proofs')
        .createSignedUrl(path, 86_400); // 24h in seconds

      if (signedErr || !signedData) throw signedErr ?? new Error('Could not generate signed URL');

      return { signedUrl: signedData.signedUrl, path };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Photo upload failed';
      setError(msg);
      return null;
    } finally {
      setIsUploading(false);
    }
  }

  function clear() {
    setLocalUri(null);
    setError(null);
  }

  return { localUri, isUploading, error, pickAndUpload, clear };
}
