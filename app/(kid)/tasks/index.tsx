import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { useTasks } from '@/hooks/useTasks';
import { TaskCard } from '@/components/ui/TaskCard';
import { Emoji } from '@/components/ui/Emoji';
import { Colors, Fonts, FontSize, Spacing, Radius } from '@/constants/theme';

type TabKey = 'pending' | 'submitted' | 'approved';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'pending', label: 'To Do' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'approved', label: 'Done' },
];

const EMPTY: Record<TabKey, { emoji: string; text: string }> = {
  pending: { emoji: '🎉', text: 'Nothing to do right now!' },
  submitted: { emoji: '⏳', text: 'No tasks waiting for approval' },
  approved: { emoji: '🏆', text: 'Completed tasks will show here' },
};

export default function KidTasksScreen() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabKey>('pending');

  const { data: tasks = [], isLoading, refetch } = useTasks({
    status: activeTab,
    assignedTo: profile?.id,
  });

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>My Tasks</Text>
      </View>

      <View style={styles.tabs}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={tasks}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.list}
        onRefresh={refetch}
        refreshing={isLoading}
        renderItem={({ item }) => (
          <TaskCard
            task={item}
            onPress={() => router.push(`/(kid)/tasks/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Emoji size={48}>{EMPTY[activeTab].emoji}</Emoji>
              <Text style={styles.emptyText}>{EMPTY[activeTab].text}</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { padding: Spacing.lg, paddingBottom: Spacing.sm },
  title: { fontFamily: Fonts.nunitoBlack, fontSize: FontSize.xxl, color: Colors.text },
  tabs: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: Spacing.sm, paddingBottom: Spacing.sm },
  tab: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.full, backgroundColor: Colors.surface,
  },
  tabActive: { backgroundColor: Colors.primary },
  tabText: { fontFamily: Fonts.nunitoBold, fontSize: FontSize.sm, color: Colors.textMuted },
  tabTextActive: { color: Colors.text },
  list: { padding: Spacing.lg, gap: Spacing.sm },
  empty: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.sm },
  emptyEmoji: { fontSize: 48 },
  emptyText: { fontFamily: Fonts.inter, fontSize: FontSize.md, color: Colors.textMuted, textAlign: 'center' },
});
