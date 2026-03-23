import React, { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, TextInput, Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useKidDetail, useStreaks } from '@/hooks/useFamily';
import { useTasks, useAwardCrushDrop } from '@/hooks/useTasks';
import { KidAvatar } from '@/components/ui/KidAvatar';
import { LevelBar } from '@/components/ui/LevelBar';
import { TaskCard } from '@/components/ui/TaskCard';
import { Button } from '@/components/ui/Button';
import { Emoji } from '@/components/ui/Emoji';
import { Colors, Fonts, FontSize, Spacing, Radius } from '@/constants/theme';

export default function KidDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: kid } = useKidDetail(id);
  const { data: streaks = [] } = useStreaks(id);
  const { data: tasks = [] } = useTasks({ assignedTo: id });
  const crushDrop = useAwardCrushDrop();

  const [showCrushDrop, setShowCrushDrop] = useState(false);
  const [dropPoints, setDropPoints] = useState('');
  const [dropReason, setDropReason] = useState('');

  const dailyStreak = streaks.find(s => s.streak_type === 'daily');
  const weeklyStreak = streaks.find(s => s.streak_type === 'weekly');
  const recentTasks = tasks.slice(0, 10);

  async function handleCrushDrop() {
    const pts = parseInt(dropPoints, 10);
    if (!pts || pts <= 0 || !dropReason.trim()) return;
    await crushDrop.mutateAsync({ kidId: id, points: pts, reason: dropReason.trim() });
    setShowCrushDrop(false);
    setDropPoints('');
    setDropReason('');
  }

  if (!kid) return null;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.crushDropBtn}
            onPress={() => setShowCrushDrop(true)}
          >
            <Text style={styles.crushDropText}>💥 Crush Drop</Text>
          </TouchableOpacity>
        </View>

        {/* Profile */}
        <View style={styles.profile}>
          <KidAvatar
            avatarEmoji={kid.avatar_emoji}
            colorTheme={kid.color_theme}
            size={72}
            level={kid.level}
          />
          <Text style={styles.name}>{kid.display_name}</Text>
          {kid.username && <Text style={styles.username}>@{kid.username}</Text>}
        </View>

        {/* Points */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={[styles.statNum, { color: kid.color_theme }]}>
              ⚡{kid.total_points.toLocaleString()}
            </Text>
            <Text style={styles.statLabel}>Points to spend</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{kid.lifetime_points.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Lifetime points</Text>
          </View>
        </View>

        {/* Level */}
        <View style={styles.card}>
          <LevelBar lifetimePoints={kid.lifetime_points} accentColor={kid.color_theme} />
        </View>

        {/* Streaks */}
        {(dailyStreak || weeklyStreak) && (
          <View style={styles.streakRow}>
            {dailyStreak && (
              <View style={[styles.streakBadge, { backgroundColor: Colors.warning + '22' }]}>
                <Emoji size={28}>🔥</Emoji>
                <Text style={[styles.streakNum, { color: Colors.warning }]}>
                  {dailyStreak.current_streak}
                </Text>
                <Text style={styles.streakLabel}>day streak</Text>
              </View>
            )}
            {weeklyStreak && (
              <View style={[styles.streakBadge, { backgroundColor: Colors.primary + '22' }]}>
                <Emoji size={28}>📅</Emoji>
                <Text style={[styles.streakNum, { color: Colors.primary }]}>
                  {weeklyStreak.current_streak}
                </Text>
                <Text style={styles.streakLabel}>week streak</Text>
              </View>
            )}
          </View>
        )}

        {/* Recent tasks */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Tasks</Text>
          {recentTasks.length === 0 ? (
            <Text style={styles.empty}>No tasks yet.</Text>
          ) : (
            <View style={styles.taskList}>
              {recentTasks.map((t) => (
                <TaskCard key={t.id} task={t} showKid={false} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Crush Drop modal */}
      <Modal visible={showCrushDrop} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>💥 Crush Drop</Text>
            <Text style={styles.modalSub}>
              Award bonus points to {kid.display_name} for something awesome.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Points (e.g. 20)"
              placeholderTextColor={Colors.textMuted}
              value={dropPoints}
              onChangeText={(t) => setDropPoints(t.replace(/\D/g, ''))}
              keyboardType="number-pad"
            />
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              placeholder="Reason (e.g. Amazing attitude today!)"
              placeholderTextColor={Colors.textMuted}
              value={dropReason}
              onChangeText={setDropReason}
              multiline
            />
            <View style={styles.modalActions}>
              <Button
                label="Cancel"
                onPress={() => setShowCrushDrop(false)}
                variant="ghost"
                fullWidth={false}
                size="sm"
              />
              <Button
                label="Send Drop 💥"
                onPress={handleCrushDrop}
                isLoading={crushDrop.isPending}
                disabled={!dropPoints || !dropReason.trim()}
                fullWidth={false}
                size="sm"
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: Spacing.xxl },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  back: { fontFamily: Fonts.interMedium, fontSize: FontSize.md, color: Colors.primary },
  crushDropBtn: {
    backgroundColor: Colors.primary + '22',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderWidth: 1,
    borderColor: Colors.primary + '44',
  },
  crushDropText: { fontFamily: Fonts.nunitoBold, fontSize: FontSize.sm, color: Colors.primary },
  profile: { alignItems: 'center', gap: Spacing.xs },
  name: { fontFamily: Fonts.nunitoBlack, fontSize: FontSize.xxl, color: Colors.text },
  username: { fontFamily: Fonts.inter, fontSize: FontSize.sm, color: Colors.textMuted },
  statsRow: { flexDirection: 'row', gap: Spacing.md },
  statCard: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.md, alignItems: 'center', gap: 2,
  },
  statNum: { fontFamily: Fonts.nunitoBlack, fontSize: FontSize.xxl, color: Colors.text },
  statLabel: { fontFamily: Fonts.inter, fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center' },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md },
  streakRow: { flexDirection: 'row', gap: Spacing.md },
  streakBadge: {
    flex: 1, borderRadius: Radius.lg, padding: Spacing.md,
    alignItems: 'center', gap: 2,
  },
  streakIcon: { fontSize: 28 },
  streakNum: { fontFamily: Fonts.nunitoBlack, fontSize: FontSize.xl },
  streakLabel: { fontFamily: Fonts.inter, fontSize: FontSize.xs, color: Colors.textMuted },
  section: { gap: Spacing.sm },
  sectionTitle: { fontFamily: Fonts.nunitoExtrabold, fontSize: FontSize.lg, color: Colors.text },
  empty: { fontFamily: Fonts.inter, fontSize: FontSize.sm, color: Colors.textMuted },
  taskList: { gap: Spacing.sm },
  modalOverlay: { flex: 1, backgroundColor: '#000000AA', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    padding: Spacing.lg, gap: Spacing.md,
  },
  modalTitle: { fontFamily: Fonts.nunitoBlack, fontSize: FontSize.xl, color: Colors.text },
  modalSub: { fontFamily: Fonts.inter, fontSize: FontSize.sm, color: Colors.textMuted },
  input: {
    backgroundColor: Colors.surface2, borderRadius: Radius.md, padding: Spacing.md,
    color: Colors.text, fontFamily: Fonts.inter, fontSize: FontSize.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm },
});
