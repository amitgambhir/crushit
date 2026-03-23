import React, { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, TextInput, Alert, Image, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTaskDetail, useSubmitTask } from '@/hooks/useTasks';
import { usePhotoUpload } from '@/hooks/usePhotoUpload';
import { PointsBadge } from '@/components/ui/PointsBadge';
import { Button } from '@/components/ui/Button';
import { Emoji } from '@/components/ui/Emoji';
import { Colors, Fonts, FontSize, Spacing, Radius } from '@/constants/theme';

export default function KidTaskDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: task } = useTaskDetail(id);
  const submitTask = useSubmitTask();
  const photoUpload = usePhotoUpload();

  const [proofNote, setProofNote] = useState('');
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [proofPhotoUrl, setProofPhotoUrl] = useState<string | null>(null);

  if (!task) return null;

  const canSubmit   = task.status === 'pending';
  const isSubmitted = task.status === 'submitted';
  const isApproved  = task.status === 'approved';
  const isRejected  = task.status === 'rejected';

  async function handlePickPhoto() {
    if (!task) return;
    const result = await photoUpload.pickAndUpload(
      task.assigned_to ?? 'unknown',
      task.id,
    );
    if (result) {
      setProofPhotoUrl(result.signedUrl);
    }
  }

  async function handleSubmit() {
    if (task!.requires_photo_proof && !proofPhotoUrl) {
      Alert.alert('Photo required', 'This task needs a photo as proof. Please attach one before submitting.');
      return;
    }

    await submitTask.mutateAsync({
      taskId:        task!.id,
      proofNote:     proofNote.trim() || undefined,
      proofPhotoUrl: proofPhotoUrl ?? undefined,
    });
    Alert.alert('Submitted! 🎉', "Your task is waiting for approval. You'll earn your points once approved!");
    router.back();
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>

        {/* Task header */}
        <View style={styles.taskHeader}>
          <View style={styles.iconWrap}>
            <Emoji size={32}>{task.icon}</Emoji>
          </View>
          <View style={styles.taskInfo}>
            <Text style={styles.taskTitle}>{task.title}</Text>
            <PointsBadge points={task.points} variant="earn" size="sm" />
          </View>
        </View>

        {/* Status banners */}
        {isSubmitted && (
          <View style={[styles.banner, { backgroundColor: Colors.warning + '22', borderColor: Colors.warning + '55' }]}>
            <Text style={[styles.bannerText, { color: Colors.warning }]}>
              ⏳ Waiting for your parent to approve this
            </Text>
          </View>
        )}
        {isApproved && (
          <View style={[styles.banner, { backgroundColor: Colors.success + '22', borderColor: Colors.success + '55' }]}>
            <Text style={[styles.bannerText, { color: Colors.success }]}>
              ✅ Approved! You earned {task.points} pts
            </Text>
          </View>
        )}
        {isRejected && (
          <View style={[styles.banner, { backgroundColor: Colors.danger + '22', borderColor: Colors.danger + '55' }]}>
            <Text style={[styles.bannerText, { color: Colors.danger }]}>
              ❌ Not approved — try again!
            </Text>
            {task.rejection_reason && (
              <Text style={[styles.bannerReason, { color: Colors.danger }]}>{task.rejection_reason}</Text>
            )}
          </View>
        )}

        {/* Description */}
        {task.description && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>What to do</Text>
            <Text style={styles.cardText}>{task.description}</Text>
          </View>
        )}

        {/* Points */}
        <View style={[styles.card, styles.row]}>
          <Text style={styles.cardLabel}>You'll earn</Text>
          <Text style={styles.pointsValue}><Emoji size={FontSize.lg}>⚡</Emoji> {task.points} pts</Text>
        </View>

        {/* Already-submitted proof photo (read-only) */}
        {task.proof_photo_url && (isSubmitted || isApproved) && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Your proof photo</Text>
            <Image source={{ uri: task.proof_photo_url }} style={styles.proofImage} resizeMode="cover" />
          </View>
        )}

        {/* Submit form */}
        {canSubmit && (
          <>
            {!showSubmitForm ? (
              <Button
                label="I Crushed This! 🎉"
                onPress={() => setShowSubmitForm(true)}
                size="lg"
                style={styles.cta}
              />
            ) : (
              <View style={styles.submitForm}>
                {/* Photo proof */}
                {task.requires_photo_proof && (
                  <View style={styles.photoSection}>
                    <Text style={styles.submitLabel}>
                      Photo proof <Text style={styles.required}>required</Text>
                    </Text>
                    {photoUpload.localUri ? (
                      <View style={styles.photoPreviewWrap}>
                        <Image source={{ uri: photoUpload.localUri }} style={styles.photoPreview} resizeMode="cover" />
                        <TouchableOpacity style={styles.changePhoto} onPress={handlePickPhoto}>
                          <Text style={styles.changePhotoText}>Change photo</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity style={styles.photoPickerBtn} onPress={handlePickPhoto} disabled={photoUpload.isUploading}>
                        {photoUpload.isUploading ? (
                          <ActivityIndicator color={Colors.primary} />
                        ) : (
                          <>
                            <Emoji size={24}>📷</Emoji>
                            <Text style={styles.photoPickerText}>Add a photo</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}
                    {photoUpload.error && (
                      <Text style={styles.error}>{photoUpload.error}</Text>
                    )}
                  </View>
                )}

                {/* Optional photo for non-required tasks */}
                {!task.requires_photo_proof && (
                  <View style={styles.photoSection}>
                    <Text style={styles.submitLabel}>Photo (optional)</Text>
                    {photoUpload.localUri ? (
                      <View style={styles.photoPreviewWrap}>
                        <Image source={{ uri: photoUpload.localUri }} style={styles.photoPreview} resizeMode="cover" />
                        <TouchableOpacity style={styles.changePhoto} onPress={handlePickPhoto}>
                          <Text style={styles.changePhotoText}>Change</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity style={styles.photoPickerBtn} onPress={handlePickPhoto} disabled={photoUpload.isUploading}>
                        {photoUpload.isUploading ? (
                          <ActivityIndicator color={Colors.primary} />
                        ) : (
                          <>
                            <Emoji size={20}>📷</Emoji>
                            <Text style={styles.photoPickerText}>Attach a photo</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* Note */}
                <Text style={styles.submitLabel}>Add a note (optional)</Text>
                <TextInput
                  style={styles.noteInput}
                  value={proofNote}
                  onChangeText={setProofNote}
                  placeholder="Tell your parent what you did..."
                  placeholderTextColor={Colors.textMuted}
                  multiline
                  numberOfLines={3}
                />

                {submitTask.error && (
                  <Text style={styles.error}>
                    {submitTask.error instanceof Error ? submitTask.error.message : 'Submission failed'}
                  </Text>
                )}

                <Button
                  label="Submit for Approval"
                  onPress={handleSubmit}
                  isLoading={submitTask.isPending || photoUpload.isUploading}
                  size="lg"
                />
                <TouchableOpacity onPress={() => { setShowSubmitForm(false); photoUpload.clear(); }}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: Spacing.xxl },
  back: { fontFamily: Fonts.interMedium, fontSize: FontSize.md, color: Colors.primary },
  taskHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  iconWrap: {
    width: 64, height: 64, borderRadius: Radius.lg,
    backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center',
  },
  taskInfo: { flex: 1, gap: Spacing.xs },
  taskTitle: { fontFamily: Fonts.nunitoBlack, fontSize: FontSize.xl, color: Colors.text },
  banner: { borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, gap: 4 },
  bannerText: { fontFamily: Fonts.nunitoBold, fontSize: FontSize.md },
  bannerReason: { fontFamily: Fonts.inter, fontSize: FontSize.sm },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardLabel: {
    fontFamily: Fonts.interMedium, fontSize: FontSize.xs,
    color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  cardText: { fontFamily: Fonts.inter, fontSize: FontSize.md, color: Colors.text },
  pointsValue: { fontFamily: Fonts.mono, fontSize: FontSize.lg, color: Colors.secondary },
  proofImage: { width: '100%', height: 180, borderRadius: Radius.md, marginTop: Spacing.xs },
  cta: { marginTop: Spacing.sm },
  submitForm: { gap: Spacing.md, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md },
  submitLabel: { fontFamily: Fonts.nunitoBold, fontSize: FontSize.md, color: Colors.text },
  required: { color: Colors.danger, fontFamily: Fonts.nunitoBold },
  photoSection: { gap: Spacing.sm },
  photoPickerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    borderWidth: 1, borderColor: Colors.primary + '55', borderStyle: 'dashed',
    borderRadius: Radius.md, padding: Spacing.md, justifyContent: 'center',
    backgroundColor: Colors.primary + '11',
  },
  photoPickerText: { fontFamily: Fonts.nunitoBold, fontSize: FontSize.md, color: Colors.primary },
  photoPreviewWrap: { gap: Spacing.xs },
  photoPreview: { width: '100%', height: 160, borderRadius: Radius.md },
  changePhoto: { alignSelf: 'flex-end' },
  changePhotoText: { fontFamily: Fonts.inter, fontSize: FontSize.sm, color: Colors.primary },
  noteInput: {
    backgroundColor: Colors.background, borderRadius: Radius.md, padding: Spacing.md,
    fontFamily: Fonts.inter, fontSize: FontSize.md, color: Colors.text,
    minHeight: 80, textAlignVertical: 'top',
  },
  error: { fontFamily: Fonts.inter, fontSize: FontSize.sm, color: Colors.danger },
  cancelText: { fontFamily: Fonts.inter, fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center' },
});
