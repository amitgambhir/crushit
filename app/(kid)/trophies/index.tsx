import React from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
} from 'react-native';
import { useAuthStore } from '@/store/authStore';
import { useStreaks } from '@/hooks/useFamily';
import { useKidAchievements } from '@/hooks/useAchievements';
import { getLevelInfo } from '@/constants/levels';
import { AchievementBadge } from '@/components/ui/AchievementBadge';
import { StreakBadge } from '@/components/ui/StreakBadge';
import { Emoji } from '@/components/ui/Emoji';
import { Colors, Fonts, FontSize, Spacing, Radius } from '@/constants/theme';
import type { AchievementWithStatus } from '@/hooks/useAchievements';

export default function KidTrophiesScreen() {
  const { profile } = useAuthStore();
  const { data: streaks = [] } = useStreaks(profile?.id ?? '');
  const { data: achievements = [], isLoading } = useKidAchievements(profile?.id);

  const lifetimePoints = profile?.lifetime_points ?? 0;
  const levelInfo = getLevelInfo(lifetimePoints);

  const dailyStreak = streaks.find((s) => s.streak_type === 'daily');
  const weeklyStreak = streaks.find((s) => s.streak_type === 'weekly');

  const earned = achievements.filter((a) => a.earned);
  const locked = achievements.filter((a) => !a.earned);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>My Trophies</Text>

        {/* Level card */}
        <View style={styles.levelCard}>
          <Emoji size={48}>🏆</Emoji>
          <Text style={styles.levelTitle}>{levelInfo.title}</Text>
          <Text style={styles.levelSub}>Level {levelInfo.level} · {lifetimePoints.toLocaleString()} lifetime pts</Text>
        </View>

        {/* Streaks row */}
        {(dailyStreak || weeklyStreak) && (
          <View style={styles.streakRow}>
            {dailyStreak && (
              <StreakBadge streakType="daily" count={dailyStreak.current_streak} />
            )}
            {weeklyStreak && (
              <StreakBadge streakType="weekly" count={weeklyStreak.current_streak} accentColor={Colors.primary} />
            )}
          </View>
        )}

        {/* Earned badges */}
        {earned.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Badges Earned <Text style={styles.sectionCount}>{earned.length}</Text>
            </Text>
            <View style={styles.badgeGrid}>
              {earned.map((a) => (
                <AchievementBadge
                  key={a.id}
                  icon={a.icon}
                  title={a.title}
                  earned
                />
              ))}
            </View>
          </View>
        )}

        {/* Locked badges */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Still To Earn{' '}
            <Text style={styles.sectionCount}>{locked.length}</Text>
          </Text>
          {isLoading ? (
            <Text style={styles.loading}>Loading…</Text>
          ) : (
            <View style={styles.badgeGrid}>
              {locked.map((a: AchievementWithStatus) => (
                <AchievementBadge
                  key={a.id}
                  icon={a.icon}
                  title={a.title}
                  earned={false}
                />
              ))}
            </View>
          )}
        </View>

        {achievements.length === 0 && !isLoading && (
          <View style={styles.emptyCard}>
            <Emoji size={40}>🌟</Emoji>
            <Text style={styles.emptyText}>Complete tasks to earn your first badge!</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: Spacing.xxl },
  title: { fontFamily: Fonts.nunitoBlack, fontSize: FontSize.xxl, color: Colors.text },
  levelCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg,
    alignItems: 'center', gap: Spacing.xs,
    borderWidth: 1, borderColor: Colors.secondary + '44',
  },
  levelTitle: { fontFamily: Fonts.nunitoBlack, fontSize: FontSize.lg, color: Colors.text },
  levelSub: { fontFamily: Fonts.inter, fontSize: FontSize.sm, color: Colors.textMuted },
  streakRow: { flexDirection: 'row', gap: Spacing.md },
  section: { gap: Spacing.md },
  sectionTitle: { fontFamily: Fonts.nunitoExtrabold, fontSize: FontSize.md, color: Colors.text },
  sectionCount: { color: Colors.textMuted },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  loading: { fontFamily: Fonts.inter, fontSize: FontSize.sm, color: Colors.textMuted },
  emptyCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.xl,
    alignItems: 'center', gap: Spacing.sm,
  },
  emptyText: { fontFamily: Fonts.inter, fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center' },
});
