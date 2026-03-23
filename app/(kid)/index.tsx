import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { useTasks } from '@/hooks/useTasks';
import { useStreaks } from '@/hooks/useFamily';
import { getLevelInfo, levelProgress } from '@/constants/levels';
import { TaskCard } from '@/components/ui/TaskCard';
import { ConfettiOverlay } from '@/components/ui/ConfettiOverlay';
import { Emoji } from '@/components/ui/Emoji';
import { supabase } from '@/lib/supabase';
import { Profile } from '@/lib/database.types';
import { Colors, Fonts, FontSize, Spacing, Radius } from '@/constants/theme';

interface CelebrationState {
  points: number;
  badgeName?: string;
}

export default function KidDashboard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { profile, setProfile } = useAuthStore();

  const { data: pendingTasks = [] } = useTasks({ status: 'pending', assignedTo: profile?.id });
  const { data: streaks = [] } = useStreaks(profile?.id ?? '');

  const [celebration, setCelebration] = useState<CelebrationState | null>(null);

  const lifetimePoints = profile?.lifetime_points ?? 0;
  const currentPoints = profile?.total_points ?? 0;
  const levelInfo = getLevelInfo(lifetimePoints);
  const progress = levelProgress(lifetimePoints);

  const activeStreak = streaks.find((s) => s.streak_type === 'daily');

  // ─── Supabase Realtime: watch for task approvals (AD-009) ─────────────────
  useEffect(() => {
    if (!profile?.id) return;

    // Channel 1: task UPDATE → approved
    const taskChannel = supabase
      .channel(`task-approvals-${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tasks',
          filter: `assigned_to=eq.${profile.id}`,
        },
        async (payload) => {
          if (payload.new.status !== 'approved') return;

          // Refresh profile so the points badge updates immediately
          const { data: updated } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', profile.id)
            .single();
          if (updated) setProfile(updated as Profile);

          // Invalidate task queries so all lists refresh
          queryClient.invalidateQueries({ queryKey: ['tasks'] });

          // Check for a badge earned at the same time
          const { data: latestBadge } = await supabase
            .from('kid_achievements')
            .select('unlocked_at, achievement:achievements(title)')
            .eq('kid_id', profile.id)
            .order('unlocked_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          // Only show badge name if it was just unlocked (within last 5 seconds)
          const justUnlocked =
            latestBadge &&
            Date.now() - new Date(latestBadge.unlocked_at).getTime() < 5_000;

          const badgeTitle =
            justUnlocked && latestBadge.achievement
              ? (latestBadge.achievement as unknown as { title: string }).title
              : undefined;

          setCelebration({ points: payload.new.points as number, badgeName: badgeTitle });
        }
      )
      .subscribe();

    // Channel 2: activity_log INSERT → crush_drop / points_awarded for this kid
    // user_id on these rows is set to the kid's profile id by award_crush_drop()
    const dropChannel = supabase
      .channel(`crush-drop-${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_log',
          filter: `user_id=eq.${profile.id}`,
        },
        async (payload) => {
          const eventType = payload.new.event_type as string;
          if (eventType !== 'crush_drop' && eventType !== 'points_awarded') return;

          const pts = (payload.new.points_delta as number | null) ?? 0;

          // Refresh profile so the points counter updates
          const { data: updated } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', profile.id)
            .single();
          if (updated) setProfile(updated as Profile);

          setCelebration({ points: pts });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(taskChannel);
      supabase.removeChannel(dropChannel);
    };
  }, [profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hey, {profile?.display_name}! 👋</Text>
            <Text style={styles.subtitle}>Ready to crush it today?</Text>
          </View>
          <Emoji size={48}>{profile?.avatar_emoji ?? '⭐'}</Emoji>
        </View>

        {/* Points + Level */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{currentPoints}</Text>
            <Text style={styles.statLabel}><Emoji size={FontSize.xs}>⚡</Emoji> Points</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{levelInfo.level}</Text>
            <Text style={styles.statLabel}>Level</Text>
          </View>
          {activeStreak && (
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{activeStreak.current_streak}</Text>
              <Text style={styles.statLabel}><Emoji size={FontSize.xs}>🔥</Emoji> Streak</Text>
            </View>
          )}
        </View>

        {/* Level bar */}
        <View style={styles.levelCard}>
          <View style={styles.levelHeader}>
            <Text style={styles.levelTitle}>{levelInfo.title}</Text>
            <Text style={styles.levelPoints}>{lifetimePoints} pts lifetime</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
          <Text style={styles.progressLabel}>
            {levelInfo.maxPoints - lifetimePoints} pts to Level {levelInfo.level + 1}
          </Text>
        </View>

        {/* Today's tasks */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your Tasks</Text>
            <TouchableOpacity onPress={() => router.push('/(kid)/tasks')}>
              <Text style={styles.seeAll}>See all →</Text>
            </TouchableOpacity>
          </View>

          {pendingTasks.slice(0, 3).map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onPress={() => router.push(`/(kid)/tasks/${task.id}`)}
            />
          ))}

          {pendingTasks.length === 0 && (
            <View style={styles.emptyCard}>
              <Emoji size={32} style={styles.emptyEmoji}>🎉</Emoji>
              <Text style={styles.emptyText}>No tasks right now — enjoy your free time!</Text>
            </View>
          )}
        </View>

        {/* Store CTA */}
        <TouchableOpacity style={styles.storeCta} onPress={() => router.push('/(kid)/store')}>
          <Emoji size={32}>🎁</Emoji>
          <View style={styles.storeCtaText}>
            <Text style={styles.storeCtaTitle}>Reward Store</Text>
            <Text style={styles.storeCtaSubtitle}>You have {currentPoints} pts to spend</Text>
          </View>
          <Text style={styles.storeCtaArrow}>→</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Celebration overlay — fired by Realtime approval event */}
      <ConfettiOverlay
        visible={!!celebration}
        points={celebration?.points ?? 0}
        badgeName={celebration?.badgeName}
        onFinish={() => setCelebration(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: Spacing.xxl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greeting: { fontFamily: Fonts.nunitoBlack, fontSize: FontSize.xl, color: Colors.text },
  subtitle: { fontFamily: Fonts.inter, fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: Spacing.sm },
  statCard: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.md, alignItems: 'center', gap: 2,
  },
  statValue: { fontFamily: Fonts.nunitoBlack, fontSize: FontSize.xl, color: Colors.text },
  statLabel: { fontFamily: Fonts.inter, fontSize: FontSize.xs, color: Colors.textMuted },
  levelCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm },
  levelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  levelTitle: { fontFamily: Fonts.nunitoBold, fontSize: FontSize.md, color: Colors.text },
  levelPoints: { fontFamily: Fonts.mono, fontSize: FontSize.xs, color: Colors.secondary },
  progressTrack: { height: 8, backgroundColor: Colors.background, borderRadius: Radius.full, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: Radius.full },
  progressLabel: { fontFamily: Fonts.inter, fontSize: FontSize.xs, color: Colors.textMuted },
  section: { gap: Spacing.sm },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontFamily: Fonts.nunitoBlack, fontSize: FontSize.lg, color: Colors.text },
  seeAll: { fontFamily: Fonts.interMedium, fontSize: FontSize.sm, color: Colors.primary },
  emptyCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg,
    alignItems: 'center', gap: Spacing.xs,
  },
  emptyEmoji: {},
  emptyText: { fontFamily: Fonts.inter, fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center' },
  storeCta: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.primary + '22', borderRadius: Radius.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.primary + '44',
  },
  storeCtaText: { flex: 1 },
  storeCtaTitle: { fontFamily: Fonts.nunitoBold, fontSize: FontSize.md, color: Colors.text },
  storeCtaSubtitle: { fontFamily: Fonts.inter, fontSize: FontSize.sm, color: Colors.textMuted },
  storeCtaArrow: { fontFamily: Fonts.nunitoBold, fontSize: FontSize.lg, color: Colors.primary },
});
