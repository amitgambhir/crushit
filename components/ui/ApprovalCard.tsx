import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Modal, StyleSheet, Image } from 'react-native';
import * as Haptics from 'expo-haptics';
import { KidAvatar } from './KidAvatar';
import { PointsBadge } from './PointsBadge';
import { Button } from './Button';
import { Colors, Fonts, FontSize, Radius, Spacing } from '@/constants/theme';
import { TaskWithAssignee } from '@/hooks/useTasks';

interface ApprovalCardProps {
  task: TaskWithAssignee;
  onApprove: () => void;
  onReject: (reason: string) => void;
  isApproving?: boolean;
  isRejecting?: boolean;
}

export function ApprovalCard({ task, onApprove, onReject, isApproving, isRejecting }: ApprovalCardProps) {
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showPhoto, setShowPhoto] = useState(false);

  function handleApprove() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onApprove();
  }

  function handleReject() {
    if (!rejectReason.trim()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onReject(rejectReason.trim());
    setShowRejectModal(false);
    setRejectReason('');
  }

  return (
    <View style={styles.card}>
      {/* Kid + task info */}
      <View style={styles.header}>
        {task.assignee && (
          <KidAvatar
            avatarEmoji={task.assignee.avatar_emoji}
            colorTheme={task.assignee.color_theme}
            size={36}
          />
        )}
        <View style={styles.headerText}>
          <Text style={styles.kidName}>{task.assignee?.display_name ?? 'Unknown'}</Text>
          <Text style={styles.taskTitle}>{task.icon} {task.title}</Text>
        </View>
        <PointsBadge points={task.points} size="sm" />
      </View>

      {/* Kid's note */}
      {task.proof_note && (
        <View style={styles.noteBox}>
          <Text style={styles.noteLabel}>Kid's note</Text>
          <Text style={styles.noteText}>"{task.proof_note}"</Text>
        </View>
      )}

      {/* Photo proof */}
      {task.proof_photo_url && (
        <TouchableOpacity onPress={() => setShowPhoto(true)} style={styles.photoThumb}>
          <Image source={{ uri: task.proof_photo_url }} style={styles.thumb} />
          <Text style={styles.photoLabel}>Tap to view proof photo</Text>
        </TouchableOpacity>
      )}

      {/* Approve / Reject */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.rejectBtn]}
          onPress={() => setShowRejectModal(true)}
          disabled={isRejecting}
        >
          <Text style={styles.rejectText}>✗ Reject</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.approveBtn]}
          onPress={handleApprove}
          disabled={isApproving}
        >
          <Text style={styles.approveText}>✓ Approve</Text>
        </TouchableOpacity>
      </View>

      {/* Reject reason modal */}
      <Modal visible={showRejectModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Why are you rejecting?</Text>
            <Text style={styles.modalSub}>The kid will see this message.</Text>
            <TextInput
              style={styles.reasonInput}
              placeholder="e.g. Room isn't fully clean yet"
              placeholderTextColor={Colors.textMuted}
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              autoFocus
            />
            <View style={styles.modalActions}>
              <Button
                label="Cancel"
                onPress={() => { setShowRejectModal(false); setRejectReason(''); }}
                variant="ghost"
                fullWidth={false}
                size="sm"
              />
              <Button
                label="Send Rejection"
                onPress={handleReject}
                variant="danger"
                disabled={!rejectReason.trim()}
                isLoading={isRejecting}
                fullWidth={false}
                size="sm"
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Full-screen photo */}
      <Modal visible={showPhoto} transparent animationType="fade">
        <TouchableOpacity style={styles.photoModal} onPress={() => setShowPhoto(false)}>
          {task.proof_photo_url && (
            <Image source={{ uri: task.proof_photo_url }} style={styles.fullPhoto} resizeMode="contain" />
          )}
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.warning + '44',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  headerText: { flex: 1 },
  kidName: { fontFamily: Fonts.interMedium, fontSize: FontSize.xs, color: Colors.textMuted },
  taskTitle: { fontFamily: Fonts.nunitoBold, fontSize: FontSize.md, color: Colors.text },
  noteBox: {
    backgroundColor: Colors.surface2,
    borderRadius: Radius.md,
    padding: Spacing.sm,
  },
  noteLabel: { fontFamily: Fonts.interMedium, fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: 2 },
  noteText: { fontFamily: Fonts.inter, fontSize: FontSize.sm, color: Colors.text, fontStyle: 'italic' },
  photoThumb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface2,
    borderRadius: Radius.md,
    padding: Spacing.sm,
  },
  thumb: { width: 48, height: 48, borderRadius: Radius.sm },
  photoLabel: { fontFamily: Fonts.interMedium, fontSize: FontSize.sm, color: Colors.primary },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  actionBtn: {
    flex: 1,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectBtn: { backgroundColor: Colors.danger + '22', borderWidth: 1, borderColor: Colors.danger + '55' },
  approveBtn: { backgroundColor: Colors.success + '22', borderWidth: 1, borderColor: Colors.success + '55' },
  rejectText: { fontFamily: Fonts.nunitoBold, fontSize: FontSize.sm, color: Colors.danger },
  approveText: { fontFamily: Fonts.nunitoBold, fontSize: FontSize.sm, color: Colors.success },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: '#000000AA', alignItems: 'center', justifyContent: 'flex-end' },
  modalCard: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  modalTitle: { fontFamily: Fonts.nunitoBlack, fontSize: FontSize.lg, color: Colors.text },
  modalSub: { fontFamily: Fonts.inter, fontSize: FontSize.sm, color: Colors.textMuted },
  reasonInput: {
    backgroundColor: Colors.surface2,
    borderRadius: Radius.md,
    padding: Spacing.md,
    color: Colors.text,
    fontFamily: Fonts.inter,
    fontSize: FontSize.md,
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm },

  // Photo modal
  photoModal: { flex: 1, backgroundColor: '#000000EE', alignItems: 'center', justifyContent: 'center' },
  fullPhoto: { width: '95%', height: '80%' },
});
