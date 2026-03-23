import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { format } from 'date-fns';
import { useTaskDetail, useApproveTask, useRejectTask } from '@/hooks/useTasks';
import { ApprovalCard } from '@/components/ui/ApprovalCard';
import { PointsBadge } from '@/components/ui/PointsBadge';
import { KidAvatar } from '@/components/ui/KidAvatar';
import { Colors, Fonts, FontSize, Spacing, Radius } from '@/constants/theme';

export default function TaskDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: task } = useTaskDetail(id);
  const approveTask = useApproveTask();
  const rejectTask = useRejectTask();

  if (!task) return null;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>

        {/* Task header */}
        <View style={styles.taskHeader}>
          <View style={styles.iconWrap}>
            <Text style={styles.icon}>{task.icon}</Text>
          </View>
          <View style={styles.taskInfo}>
            <Text style={styles.taskTitle}>{task.title}</Text>
            <PointsBadge points={task.points} size="sm" />
          </View>
        </View>

        {task.description && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Description</Text>
            <Text style={styles.cardText}>{task.description}</Text>
          </View>
        )}

        {/* Assigned to */}
        {task.assignee && (
          <View style={[styles.card, styles.row]}>
            <Text style={styles.cardLabel}>Assigned to</Text>
            <View style={styles.kidRow}>
              <KidAvatar
                avatarEmoji={task.assignee.avatar_emoji}
                colorTheme={task.assignee.color_theme}
                size={28}
              />
              <Text style={styles.kidName}>{task.assignee.display_name}</Text>
            </View>
          </View>
        )}

        {/* Meta */}
        <View style={styles.metaGrid}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Status</Text>
            <Text style={styles.metaValue}>{task.status}</Text>
          </View>
          {task.due_date && (
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Due</Text>
              <Text style={styles.metaValue}>{format(new Date(task.due_date), 'MMM d, yyyy')}</Text>
            </View>
          )}
          {task.recurrence && task.recurrence !== 'once' && (
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Repeats</Text>
              <Text style={styles.metaValue}>{task.recurrence}</Text>
            </View>
          )}
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Photo proof</Text>
            <Text style={styles.metaValue}>{task.requires_photo_proof ? 'Required' : 'Not required'}</Text>
          </View>
        </View>

        {/* Kid's proof note */}
        {task.proof_note && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Kid's note</Text>
            <Text style={styles.cardText}>{task.proof_note}</Text>
          </View>
        )}

        {/* Photo proof */}
        {task.proof_photo_url && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Photo proof</Text>
            <Image
              source={{ uri: task.proof_photo_url }}
              style={styles.proofImage}
              resizeMode="cover"
            />
          </View>
        )}

        {/* Rejection reason */}
        {task.status === 'rejected' && task.rejection_reason && (
          <View style={[styles.card, { borderColor: Colors.danger + '55', borderWidth: 1 }]}>
            <Text style={[styles.cardLabel, { color: Colors.danger }]}>Rejection reason</Text>
            <Text style={styles.cardText}>{task.rejection_reason}</Text>
          </View>
        )}

        {/* Approval card if submitted */}
        {task.status === 'submitted' && (
          <ApprovalCard
            task={task}
            onApprove={() => {
              approveTask.mutate(task.id);
              router.back();
            }}
            onReject={(reason) => {
              rejectTask.mutate({ taskId: task.id, reason });
              router.back();
            }}
            isApproving={approveTask.isPending}
            isRejecting={rejectTask.isPending}
          />
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
  icon: { fontSize: 32 },
  taskInfo: { flex: 1, gap: Spacing.xs },
  taskTitle: { fontFamily: Fonts.nunitoBlack, fontSize: FontSize.xl, color: Colors.text },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardLabel: { fontFamily: Fonts.interMedium, fontSize: FontSize.xs, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  cardText: { fontFamily: Fonts.inter, fontSize: FontSize.md, color: Colors.text },
  kidRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  kidName: { fontFamily: Fonts.nunitoBold, fontSize: FontSize.md, color: Colors.text },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  metaItem: {
    flex: 1, minWidth: '45%', backgroundColor: Colors.surface,
    borderRadius: Radius.md, padding: Spacing.md, gap: 4,
  },
  metaLabel: { fontFamily: Fonts.interMedium, fontSize: FontSize.xs, color: Colors.textMuted },
  metaValue: { fontFamily: Fonts.nunitoBold, fontSize: FontSize.sm, color: Colors.text, textTransform: 'capitalize' },
  proofImage: { width: '100%', height: 220, borderRadius: Radius.md, marginTop: Spacing.xs },
});
