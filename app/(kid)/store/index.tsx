import React, { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { useRewards } from '@/hooks/useRewards';
import { useKidRedemptions, redemptionStatusMeta } from '@/hooks/useRedemptions';
import { useKidUnlockedStreakRewards } from '@/hooks/useStreakRewards';
import { useStreaks } from '@/hooks/useFamily';
import { Emoji } from '@/components/ui/Emoji';
import { Colors, Fonts, FontSize, Spacing, Radius } from '@/constants/theme';
import type { Reward } from '@/lib/database.types';
import type { RedemptionWithDetails } from '@/hooks/useRewards';
import type { StreakRewardUnlock } from '@/hooks/useStreakRewards';

type Tab = 'store' | 'streaks' | 'requests';

export default function KidStoreScreen() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const [tab, setTab] = useState<Tab>('store');

  const { data: rewards = [], isLoading: rewardsLoading, refetch: refetchRewards } = useRewards();
  const { data: redemptions = [], isLoading: redemptionsLoading, refetch: refetchRedemptions } = useKidRedemptions(profile?.id);
  const { data: streakUnlocks = [], isLoading: streaksLoading, refetch: refetchStreaks } = useKidUnlockedStreakRewards(profile?.id);
  const { data: streaks = [] } = useStreaks(profile?.id ?? '');

  const currentPoints = profile?.total_points ?? 0;
  const pendingCount = redemptions.filter((r) => r.status === 'pending').length;
  const dailyStreak = streaks.find((s) => s.streak_type === 'daily');

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Reward Store</Text>
        <View style={styles.pointsBadge}>
          <Text style={styles.pointsValue}><Emoji size={FontSize.md}>⚡</Emoji> {currentPoints}</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'store' && styles.tabActive]}
          onPress={() => setTab('store')}
        >
          <Text style={[styles.tabText, tab === 'store' && styles.tabTextActive]}>Store</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'streaks' && styles.tabActive]}
          onPress={() => setTab('streaks')}
        >
          <Text style={[styles.tabText, tab === 'streaks' && styles.tabTextActive]}>
            🔥 Streaks{streakUnlocks.length > 0 ? ` (${streakUnlocks.length})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'requests' && styles.tabActive]}
          onPress={() => setTab('requests')}
        >
          <Text style={[styles.tabText, tab === 'requests' && styles.tabTextActive]}>
            Requests{pendingCount > 0 ? ` (${pendingCount})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {tab === 'streaks' ? (
        <FlatList<StreakRewardUnlock>
          data={streakUnlocks}
          keyExtractor={(u) => u.id}
          contentContainerStyle={styles.list}
          onRefresh={refetchStreaks}
          refreshing={streaksLoading}
          ListHeaderComponent={
            dailyStreak && dailyStreak.current_streak > 0 ? (
              <View style={styles.streakHeader}>
                <Text style={styles.streakHeaderText}>
                  🔥 {dailyStreak.current_streak}-day streak — keep it up!
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <View style={styles.streakUnlockCard}>
              <View style={styles.streakUnlockIcon}>
                <Emoji size={32}>
                  {item.streak_reward.is_surprise ? item.streak_reward.surprise_icon : (item.streak_reward.actual_icon ?? '🎁')}
                </Emoji>
              </View>
              <View style={styles.rewardInfo}>
                <Text style={styles.rewardTitle}>{item.streak_reward.reward_title}</Text>
                {item.streak_reward.reward_description && (
                  <Text style={styles.rewardDesc} numberOfLines={1}>
                    {item.streak_reward.reward_description}
                  </Text>
                )}
                <Text style={styles.streakMeta}>
                  {item.streak_reward.streak_type} · {item.streak_reward.required_streak}-streak milestone
                  {item.bonus_points_awarded > 0 ? ` · +${item.bonus_points_awarded} pts` : ''}
                </Text>
              </View>
              <Text style={styles.unlockBadge}>Unlocked!</Text>
            </View>
          )}
          ListEmptyComponent={
            !streaksLoading ? (
              <View style={styles.empty}>
                <Emoji size={48}>🔥</Emoji>
                <Text style={styles.emptyText}>
                  Complete tasks every day to hit streak milestones and unlock special rewards!
                </Text>
              </View>
            ) : null
          }
        />
      ) : tab === 'store' ? (
        <FlatList<Reward>
          data={rewards}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.list}
          onRefresh={refetchRewards}
          refreshing={rewardsLoading}
          ListHeaderComponent={
            <Text style={styles.hint}>Tap a reward to see details and request it</Text>
          }
          renderItem={({ item }) => {
            const canAfford = currentPoints >= item.cost_points;
            return (
              <TouchableOpacity
                style={[styles.rewardCard, !canAfford && styles.rewardCardDim]}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onPress={() => router.push(`/(kid)/store/${item.id}` as any)}
                activeOpacity={0.7}
              >
                <Emoji size={36}>{item.icon}</Emoji>
                <View style={styles.rewardInfo}>
                  <Text style={styles.rewardTitle}>{item.title}</Text>
                  {item.description && (
                    <Text style={styles.rewardDesc} numberOfLines={1}>{item.description}</Text>
                  )}
                </View>
                <View style={[
                  styles.costBadge,
                  canAfford ? styles.costBadgeAffordable : styles.costBadgeTooExpensive,
                ]}>
                  <Text style={[
                    styles.costText,
                    canAfford ? styles.costTextAffordable : styles.costTextTooExpensive,
                  ]}>
                    <Emoji size={FontSize.sm}>⚡</Emoji>{item.cost_points}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            !rewardsLoading ? (
              <View style={styles.empty}>
                <Emoji size={48}>🎁</Emoji>
                <Text style={styles.emptyText}>No rewards yet — ask your parent to add some!</Text>
              </View>
            ) : null
          }
        />
      ) : (
        <FlatList<RedemptionWithDetails>
          data={redemptions}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.list}
          onRefresh={refetchRedemptions}
          refreshing={redemptionsLoading}
          renderItem={({ item }) => {
            const meta = redemptionStatusMeta(item.status);
            return (
              <View style={styles.redemptionCard}>
                <Emoji size={32}>{item.reward?.icon ?? '🎁'}</Emoji>
                <View style={styles.rewardInfo}>
                  <Text style={styles.rewardTitle}>{item.reward?.title ?? 'Reward'}</Text>
                  <Text style={styles.rewardDesc}>
                    {new Date(item.created_at).toLocaleDateString()}
                    {' · '}
                    <Emoji size={FontSize.xs}>⚡</Emoji>{item.points_spent} pts
                  </Text>
                  {item.parent_note && item.status === 'rejected' && (
                    <Text style={styles.parentNote}>"{item.parent_note}"</Text>
                  )}
                </View>
                <View style={[styles.statusBadge, { borderColor: meta.color + '55', backgroundColor: meta.color + '22' }]}>
                  <Text style={[styles.statusText, { color: meta.color }]}>
                    {meta.icon} {meta.label}
                  </Text>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            !redemptionsLoading ? (
              <View style={styles.empty}>
                <Emoji size={48}>🛍️</Emoji>
                <Text style={styles.emptyText}>No requests yet — redeem a reward from the Store tab!</Text>
              </View>
            ) : null
          }
        />
      )}
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
  pointsBadge: {
    backgroundColor: Colors.secondary + '22', borderRadius: Radius.full,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2,
    borderWidth: 1, borderColor: Colors.secondary + '55',
  },
  pointsValue: { fontFamily: Fonts.mono, fontSize: FontSize.md, color: Colors.secondary },

  tabs: {
    flexDirection: 'row', marginHorizontal: Spacing.lg,
    backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 3, marginBottom: Spacing.xs,
  },
  tab: { flex: 1, paddingVertical: Spacing.sm, borderRadius: Radius.md, alignItems: 'center' },
  tabActive: { backgroundColor: Colors.background },
  tabText: { fontFamily: Fonts.nunitoBold, fontSize: FontSize.sm, color: Colors.textMuted },
  tabTextActive: { color: Colors.text },

  list: { padding: Spacing.lg, gap: Spacing.sm },
  hint: { fontFamily: Fonts.inter, fontSize: FontSize.sm, color: Colors.textMuted, marginBottom: Spacing.xs },

  rewardCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md,
  },
  rewardCardDim: { opacity: 0.5 },
  rewardInfo: { flex: 1, gap: 2 },
  rewardTitle: { fontFamily: Fonts.nunitoBold, fontSize: FontSize.md, color: Colors.text },
  rewardDesc: { fontFamily: Fonts.inter, fontSize: FontSize.sm, color: Colors.textMuted },
  costBadge: {
    borderRadius: Radius.md, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs,
    borderWidth: 1,
  },
  costBadgeAffordable: { backgroundColor: Colors.secondary + '22', borderColor: Colors.secondary + '55' },
  costBadgeTooExpensive: { backgroundColor: Colors.surface, borderColor: 'transparent' },
  costText: { fontFamily: Fonts.mono, fontSize: FontSize.sm },
  costTextAffordable: { color: Colors.secondary },
  costTextTooExpensive: { color: Colors.textMuted },

  redemptionCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md,
  },
  statusBadge: {
    borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 3, borderWidth: 1,
  },
  statusText: { fontFamily: Fonts.nunitoBold, fontSize: FontSize.xs },
  parentNote: { fontFamily: Fonts.inter, fontSize: FontSize.xs, color: Colors.danger, fontStyle: 'italic', marginTop: 2 },

  empty: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.sm },
  emptyText: { fontFamily: Fonts.inter, fontSize: FontSize.md, color: Colors.textMuted, textAlign: 'center' },

  // Streak rewards tab
  streakHeader: {
    backgroundColor: Colors.warning + '22', borderRadius: Radius.md,
    padding: Spacing.sm, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.warning + '44',
  },
  streakHeaderText: { fontFamily: Fonts.nunitoBold, fontSize: FontSize.sm, color: Colors.warning, textAlign: 'center' },
  streakUnlockCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.success + '11', borderRadius: Radius.lg, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.success + '33',
  },
  streakUnlockIcon: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: Colors.success + '22', alignItems: 'center', justifyContent: 'center',
  },
  streakMeta: { fontFamily: Fonts.inter, fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  unlockBadge: { fontFamily: Fonts.nunitoBold, fontSize: FontSize.xs, color: Colors.success },
});
