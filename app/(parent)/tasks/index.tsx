import React, { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, FlatList,
  TouchableOpacity, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTasks, useApproveTask, useRejectTask } from '@/hooks/useTasks';
import { useKids } from '@/hooks/useFamily';
import { TaskCard } from '@/components/ui/TaskCard';
import { ApprovalCard } from '@/components/ui/ApprovalCard';
import { KidAvatar } from '@/components/ui/KidAvatar';
import { Emoji } from '@/components/ui/Emoji';
import { Colors, Fonts, FontSize, Spacing, Radius } from '@/constants/theme';
import type { TaskCategory } from '@/lib/database.types';

const CATEGORIES: { key: TaskCategory; label: string; icon: string }[] = [
  { key: 'chores',   label: 'Chores',   icon: '🧹' },
  { key: 'school',   label: 'School',   icon: '📚' },
  { key: 'personal', label: 'Personal', icon: '🌟' },
  { key: 'health',   label: 'Health',   icon: '💪' },
  { key: 'creative', label: 'Creative', icon: '🎨' },
  { key: 'kindness', label: 'Kindness', icon: '💛' },
  { key: 'custom',   label: 'Custom',   icon: '✨' },
];

type TabKey = 'pending' | 'submitted' | 'approved';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'pending',   label: 'Active' },
  { key: 'submitted', label: 'Pending Approval' },
  { key: 'approved',  label: 'Completed' },
];

export default function TasksScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>('submitted');
  const [selectedKidId, setSelectedKidId] = useState<string | undefined>(undefined);
  const [selectedCategory, setSelectedCategory] = useState<TaskCategory | undefined>(undefined);

  const { data: kids = [] } = useKids();
  const { data: tasks = [], isLoading, refetch } = useTasks({
    status: activeTab,
    assignedTo: selectedKidId,
    category: selectedCategory,
  });
  const approveTask = useApproveTask();
  const rejectTask = useRejectTask();

  const pendingCount = useTasks({ status: 'submitted' }).data?.length ?? 0;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Tasks</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push('/(parent)/tasks/new')}
        >
          <Text style={styles.addBtnText}>+ New Task</Text>
        </TouchableOpacity>
      </View>

      {/* Kid filter — only shown when there are multiple kids */}
      {kids.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.kidFilter}
        >
          <TouchableOpacity
            style={[styles.kidChip, !selectedKidId && styles.kidChipActive]}
            onPress={() => setSelectedKidId(undefined)}
          >
            <Text style={[styles.kidChipText, !selectedKidId && styles.kidChipTextActive]}>
              All
            </Text>
          </TouchableOpacity>

          {kids.map((kid) => (
            <TouchableOpacity
              key={kid.id}
              style={[
                styles.kidChip,
                selectedKidId === kid.id && styles.kidChipActive,
                selectedKidId === kid.id && { borderColor: kid.color_theme },
              ]}
              onPress={() => setSelectedKidId(
                selectedKidId === kid.id ? undefined : kid.id,
              )}
            >
              <KidAvatar
                avatarEmoji={kid.avatar_emoji}
                colorTheme={kid.color_theme}
                size={20}
              />
              <Text style={[
                styles.kidChipText,
                selectedKidId === kid.id && styles.kidChipTextActive,
              ]}>
                {kid.display_name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Category filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.categoryFilter}
      >
        <TouchableOpacity
          style={[styles.categoryChip, !selectedCategory && styles.categoryChipActive]}
          onPress={() => setSelectedCategory(undefined)}
        >
          <Text style={[styles.categoryChipText, !selectedCategory && styles.categoryChipTextActive]}>
            All
          </Text>
        </TouchableOpacity>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.key}
            style={[
              styles.categoryChip,
              selectedCategory === cat.key && styles.categoryChipActive,
            ]}
            onPress={() => setSelectedCategory(
              selectedCategory === cat.key ? undefined : cat.key,
            )}
          >
            <View style={styles.categoryChipContent}>
              <Emoji size={16}>{cat.icon}</Emoji>
              <Text style={[
                styles.categoryChipText,
                selectedCategory === cat.key && styles.categoryChipTextActive,
              ]}>
                {cat.label}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Sub-tabs */}
      <View style={styles.tabs}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
              {tab.key === 'submitted' && pendingCount > 0 && (
                <Text style={styles.badge}> {pendingCount}</Text>
              )}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      <FlatList
        data={tasks}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.list}
        onRefresh={refetch}
        refreshing={isLoading}
        renderItem={({ item }) =>
          activeTab === 'submitted' ? (
            <ApprovalCard
              task={item}
              onApprove={() => approveTask.mutate(item.id)}
              onReject={(reason) => rejectTask.mutate({ taskId: item.id, reason })}
              isApproving={approveTask.isPending}
              isRejecting={rejectTask.isPending}
            />
          ) : (
            <TaskCard
              task={item}
              onPress={() => router.push(`/(parent)/tasks/${item.id}`)}
            />
          )
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Emoji size={48}>
                {activeTab === 'submitted' ? '✅' : activeTab === 'pending' ? '📋' : '🏆'}
              </Emoji>
              <Text style={styles.emptyText}>
                {activeTab === 'submitted'
                  ? 'No tasks waiting for approval'
                  : activeTab === 'pending'
                  ? 'No active tasks — add one!'
                  : 'No completed tasks yet'}
              </Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: Spacing.lg, paddingBottom: Spacing.sm,
  },
  title: { fontFamily: Fonts.nunitoBlack, fontSize: FontSize.xxl, color: Colors.text },
  addBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.full,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2,
  },
  addBtnText: { fontFamily: Fonts.nunitoBold, fontSize: FontSize.sm, color: Colors.text },
  filterScroll: {
    maxHeight: 56,
    flexGrow: 0,
  },

  // Kid filter
  kidFilter: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    paddingBottom: Spacing.sm,
    alignItems: 'center',
  },
  kidChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm + 2,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  kidChipActive: {
    backgroundColor: Colors.surface2,
    borderColor: Colors.primary,
  },
  kidChipText: { fontFamily: Fonts.nunitoBold, fontSize: FontSize.sm, color: Colors.textMuted },
  kidChipTextActive: { color: Colors.text },

  // Category filter
  categoryFilter: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.xs,
    paddingBottom: Spacing.sm,
    alignItems: 'center',
  },
  categoryChip: {
    alignSelf: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm + 2,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryChipActive: {
    backgroundColor: Colors.surface2,
    borderColor: Colors.primary,
  },
  categoryChipContent: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  categoryChipText: { fontFamily: Fonts.inter, fontSize: FontSize.xs, color: Colors.textMuted },
  categoryChipTextActive: { color: Colors.text },

  tabs: {
    flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  tab: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.full, backgroundColor: Colors.surface,
  },
  tabActive: { backgroundColor: Colors.primary },
  tabText: { fontFamily: Fonts.nunitoBold, fontSize: FontSize.sm, color: Colors.textMuted },
  tabTextActive: { color: Colors.text },
  badge: { color: Colors.secondary },
  list: { padding: Spacing.lg, gap: Spacing.sm },
  empty: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.sm },
  emptyText: { fontFamily: Fonts.inter, fontSize: FontSize.md, color: Colors.textMuted, textAlign: 'center' },
});
