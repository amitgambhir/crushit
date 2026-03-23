import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { formatDistanceToNow, isPast } from 'date-fns';
import { KidAvatar } from './KidAvatar';
import { PointsBadge } from './PointsBadge';
import { Colors, Fonts, FontSize, Radius, Spacing } from '@/constants/theme';
import { TaskWithAssignee } from '@/hooks/useTasks';

interface TaskCardProps {
  task: TaskWithAssignee;
  onPress?: () => void;
  showKid?: boolean;
}

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: 'To Do',    color: Colors.textMuted, bg: Colors.surface2 },
  submitted: { label: 'Pending',  color: Colors.warning,   bg: Colors.warning + '22' },
  approved:  { label: 'Approved', color: Colors.success,   bg: Colors.success + '22' },
  rejected:  { label: 'Rejected', color: Colors.danger,    bg: Colors.danger  + '22' },
  expired:   { label: 'Expired',  color: Colors.textMuted, bg: Colors.surface2 },
};

export function TaskCard({ task, onPress, showKid = true }: TaskCardProps) {
  const statusStyle = STATUS_STYLES[task.status] ?? STATUS_STYLES.pending;
  const isOverdue = task.due_date && isPast(new Date(task.due_date)) && task.status === 'pending';

  return (
    <TouchableOpacity
      style={[styles.card, isOverdue && styles.cardOverdue]}
      onPress={onPress}
      activeOpacity={0.75}
      disabled={!onPress}
    >
      {/* Icon */}
      <View style={styles.iconWrap}>
        <Text style={styles.icon}>{task.icon}</Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>{task.title}</Text>

        <View style={styles.meta}>
          {task.due_date && (
            <Text style={[styles.due, isOverdue && styles.dueOverdue]}>
              {isOverdue ? '⚠ Overdue' : formatDistanceToNow(new Date(task.due_date), { addSuffix: true })}
            </Text>
          )}
          {task.recurrence && task.recurrence !== 'once' && (
            <Text style={styles.recurrence}>🔁 {task.recurrence}</Text>
          )}
        </View>
      </View>

      {/* Right side */}
      <View style={styles.right}>
        <PointsBadge points={task.points} size="sm" variant="earn" />
        <View style={[styles.statusPill, { backgroundColor: statusStyle.bg }]}>
          <Text style={[styles.statusText, { color: statusStyle.color }]}>{statusStyle.label}</Text>
        </View>
        {showKid && task.assignee && (
          <KidAvatar
            avatarEmoji={task.assignee.avatar_emoji}
            colorTheme={task.assignee.color_theme}
            size={28}
          />
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  cardOverdue: {
    borderColor: Colors.danger + '55',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 22 },
  content: { flex: 1, gap: 3 },
  title: { fontFamily: Fonts.nunitoBold, fontSize: FontSize.md, color: Colors.text },
  meta: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  due: { fontFamily: Fonts.inter, fontSize: FontSize.xs, color: Colors.textMuted },
  dueOverdue: { color: Colors.danger },
  recurrence: { fontFamily: Fonts.inter, fontSize: FontSize.xs, color: Colors.textMuted },
  right: { alignItems: 'flex-end', gap: 5 },
  statusPill: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  statusText: { fontFamily: Fonts.interMedium, fontSize: 11 },
});
