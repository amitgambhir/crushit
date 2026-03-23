import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import { useAuthStore } from '@/store/authStore';
import { useKids, useActivityLog } from '@/hooks/useFamily';
import { useTasks, useApproveTask, useRejectTask } from '@/hooks/useTasks';
import { KidAvatar } from '@/components/ui/KidAvatar';
import { ApprovalCard } from '@/components/ui/ApprovalCard';
import { Colors, Fonts, FontSize, Spacing, Radius } from '@/constants/theme';
import {
  perKidWeeklyStats,
  pointsAwardedThisWeek,
  completedThisWeek,
  tasksThisWeek,
} from '@/lib/analytics';

export default function ParentDashboard() {
  const router = useRouter();
  const { profile, family } = useAuthStore();
  const { data: kids = [], isLoading: kidsLoading, refetch: refetchKids } = useKids();
  const { data: allTasks = [], refetch: refetchTasks } = useTasks();
  const { data: pendingTasks = [] } = useTasks({ status: 'submitted' });
  const { data: activityLog = [] } = useActivityLog();
  const approveTask = useApproveTask();
  const rejectTask = useRejectTask();

  const isRefreshing = kidsLoading;

  function onRefresh() {
    refetchKids();
    refetchTasks();
  }

  // Today's task stats
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayTasks = allTasks.filter(t => t.due_date?.startsWith(todayStr));
  const todayDone = todayTasks.filter(t => t.status === 'approved').length;

  // Weekly analytics
  const weekAssigned = tasksThisWeek(allTasks).length;
  const weekCompleted = completedThisWeek(allTasks).length;
  const weekPoints = pointsAwardedThisWeek(activityLog);
  const kidStats = perKidWeeklyStats(allTasks, kids);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.familyName}>{family?.name ?? 'Your Family'}</Text>
            <Text style={styles.date}>{format(new Date(), 'EEEE, MMM d')}</Text>
          </View>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => router.push('/(parent)/tasks/new')}
          >
            <Text style={styles.addBtnText}>+ Task</Text>
          </TouchableOpacity>
        </View>

        {/* Kids row */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Kids</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.kidsScroll}>
            {kids.map((kid) => (
              <TouchableOpacity
                key={kid.id}
                style={styles.kidChip}
                onPress={() => router.push(`/(parent)/kids/${kid.id}`)}
              >
                <KidAvatar
                  avatarEmoji={kid.avatar_emoji}
                  colorTheme={kid.color_theme}
                  size={44}
                  level={kid.level}
                />
                <Text style={styles.kidName}>{kid.display_name}</Text>
                <Text style={[styles.kidPoints, { color: kid.color_theme }]}>
                  ⚡{kid.total_points}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.kidChip, styles.addKidChip]}
              onPress={() => router.push('/(parent)/kids/new')}
            >
              <View style={styles.addKidIcon}>
                <Text style={styles.addKidPlus}>+</Text>
              </View>
              <Text style={styles.kidName}>Add Kid</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Today's progress */}
        {todayTasks.length > 0 && (
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statNum}>{todayDone}/{todayTasks.length}</Text>
              <Text style={styles.statLabel}>Today's tasks done</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statNum, { color: Colors.warning }]}>{pendingTasks.length}</Text>
              <Text style={styles.statLabel}>Awaiting approval</Text>
            </View>
          </View>
        )}

        {/* Weekly analytics */}
        {kids.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>This Week</Text>
            <View style={styles.weekCard}>
              {/* Summary row */}
              <View style={styles.weekSummary}>
                <View style={styles.weekStat}>
                  <Text style={styles.weekStatNum}>{weekCompleted}</Text>
                  <Text style={styles.weekStatLabel}>Completed</Text>
                </View>
                <View style={styles.weekDivider} />
                <View style={styles.weekStat}>
                  <Text style={styles.weekStatNum}>{weekAssigned}</Text>
                  <Text style={styles.weekStatLabel}>Assigned</Text>
                </View>
                <View style={styles.weekDivider} />
                <View style={styles.weekStat}>
                  <Text style={[styles.weekStatNum, { color: Colors.secondary }]}>
                    {weekPoints}
                  </Text>
                  <Text style={styles.weekStatLabel}>Pts awarded</Text>
                </View>
              </View>

              {/* Per-kid bars */}
              {kidStats.length > 0 && (
                <View style={styles.kidBars}>
                  {kidStats.map((s) => (
                    <View key={s.kidId} style={styles.kidBarRow}>
                      <Text style={styles.kidBarName} numberOfLines={1}>{s.displayName}</Text>
                      <View style={styles.kidBarTrack}>
                        <View
                          style={[
                            styles.kidBarFill,
                            {
                              width: `${Math.round(s.rate * 100)}%` as `${number}%`,
                              backgroundColor: s.colorTheme,
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.kidBarCount}>{s.completed}/{s.assigned}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        )}

        {/* Pending approvals */}
        {pendingTasks.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Needs Approval</Text>
            <View style={styles.list}>
              {pendingTasks.map((task) => (
                <ApprovalCard
                  key={task.id}
                  task={task}
                  onApprove={() => approveTask.mutate(task.id)}
                  onReject={(reason) => rejectTask.mutate({ taskId: task.id, reason })}
                  isApproving={approveTask.isPending}
                  isRejecting={rejectTask.isPending}
                />
              ))}
            </View>
          </View>
        )}

        {/* Recent activity */}
        {activityLog.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <View style={styles.activityList}>
              {activityLog.slice(0, 10).map((item) => (
                <View key={item.id} style={styles.activityRow}>
                  <Text style={styles.activityDot}>•</Text>
                  <View style={styles.activityText}>
                    <Text style={styles.activityTitle}>{item.title}</Text>
                    {item.body && <Text style={styles.activityBody}>{item.body}</Text>}
                  </View>
                  {item.points_delta !== 0 && (
                    <Text style={[
                      styles.activityPts,
                      { color: item.points_delta > 0 ? Colors.success : Colors.danger }
                    ]}>
                      {item.points_delta > 0 ? '+' : ''}{item.points_delta}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {kids.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>👨‍👩‍👧</Text>
            <Text style={styles.emptyTitle}>Add your first kid</Text>
            <Text style={styles.emptyDesc}>
              Create a kid account so they can log in and start crushing tasks.
            </Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => router.push('/(parent)/kids/new')}
            >
              <Text style={styles.emptyBtnText}>Add a Kid</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.lg, gap: Spacing.lg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  familyName: { fontFamily: Fonts.nunitoBlack, fontSize: FontSize.xxl, color: Colors.text },
  date: { fontFamily: Fonts.inter, fontSize: FontSize.sm, color: Colors.textMuted },
  addBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
  },
  addBtnText: { fontFamily: Fonts.nunitoBold, fontSize: FontSize.sm, color: Colors.text },
  section: { gap: Spacing.sm },
  sectionTitle: {
    fontFamily: Fonts.nunitoExtrabold,
    fontSize: FontSize.lg,
    color: Colors.text,
  },
  kidsScroll: { marginHorizontal: -Spacing.lg, paddingHorizontal: Spacing.lg },
  kidChip: { alignItems: 'center', marginRight: Spacing.lg, gap: Spacing.xs, paddingVertical: Spacing.xs },
  addKidChip: {},
  addKidIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface2,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addKidPlus: { fontSize: 22, color: Colors.textMuted },
  kidName: { fontFamily: Fonts.nunitoBold, fontSize: FontSize.sm, color: Colors.text },
  kidPoints: { fontFamily: Fonts.mono, fontSize: FontSize.xs },
  statsRow: { flexDirection: 'row', gap: Spacing.md },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 2,
  },
  statNum: { fontFamily: Fonts.nunitoBlack, fontSize: FontSize.xxl, color: Colors.text },
  statLabel: { fontFamily: Fonts.inter, fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center' },
  list: { gap: Spacing.sm },
  activityList: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  activityRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  activityDot: { color: Colors.primary, fontFamily: Fonts.nunitoBold, marginTop: 1 },
  activityText: { flex: 1 },
  activityTitle: { fontFamily: Fonts.interMedium, fontSize: FontSize.sm, color: Colors.text },
  activityBody: { fontFamily: Fonts.inter, fontSize: FontSize.xs, color: Colors.textMuted },
  activityPts: { fontFamily: Fonts.mono, fontSize: FontSize.xs },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.sm,
  },
  emptyEmoji: { fontSize: 56 },
  emptyTitle: { fontFamily: Fonts.nunitoBlack, fontSize: FontSize.xl, color: Colors.text },
  emptyDesc: { fontFamily: Fonts.inter, fontSize: FontSize.md, color: Colors.textMuted, textAlign: 'center' },
  // Weekly analytics
  weekCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  weekSummary: { flexDirection: 'row', alignItems: 'center' },
  weekStat: { flex: 1, alignItems: 'center', gap: 2 },
  weekStatNum: { fontFamily: Fonts.nunitoBlack, fontSize: FontSize.xl, color: Colors.text },
  weekStatLabel: { fontFamily: Fonts.inter, fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center' },
  weekDivider: { width: 1, height: 32, backgroundColor: Colors.border },
  kidBars: { gap: Spacing.sm },
  kidBarRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  kidBarName: { fontFamily: Fonts.nunitoBold, fontSize: FontSize.sm, color: Colors.text, width: 64 },
  kidBarTrack: {
    flex: 1, height: 8, backgroundColor: Colors.background,
    borderRadius: Radius.full, overflow: 'hidden',
  },
  kidBarFill: { height: '100%', borderRadius: Radius.full },
  kidBarCount: { fontFamily: Fonts.mono, fontSize: FontSize.xs, color: Colors.textMuted, width: 32, textAlign: 'right' },

  emptyBtn: {
    marginTop: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm + 2,
  },
  emptyBtnText: { fontFamily: Fonts.nunitoBold, fontSize: FontSize.md, color: Colors.text },
});
