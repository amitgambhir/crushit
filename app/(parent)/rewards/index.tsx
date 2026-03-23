import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useRewards, usePendingRedemptions, useApproveRedemption, useFulfillRedemption, useRejectRedemption } from '@/hooks/useRewards';
import { useStreakRewards, useDeleteStreakReward, type StreakReward } from '@/hooks/useStreakRewards';
import { RewardCard } from '@/components/ui/RewardCard';
import { KidAvatar } from '@/components/ui/KidAvatar';
import { Button } from '@/components/ui/Button';
import { Emoji } from '@/components/ui/Emoji';
import { Colors, Fonts, FontSize, Spacing, Radius } from '@/constants/theme';

type Tab = 'store' | 'streaks' | 'redemptions';

const STREAK_TYPE_LABEL: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
};

export default function RewardsScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('store');

  const { data: rewards = [], isLoading: rewardsLoading } = useRewards();
  const { data: redemptions = [] } = usePendingRedemptions();
  const { data: streakRewards = [], isLoading: streakRewardsLoading, refetch: refetchStreakRewards } = useStreakRewards();
  const approveRedemption = useApproveRedemption();
  const fulfillRedemption = useFulfillRedemption();
  const rejectRedemption = useRejectRedemption();
  const deleteStreakReward = useDeleteStreakReward();

  function handleDeleteStreakReward(reward: StreakReward) {
    Alert.alert(
      'Delete Milestone',
      `Remove "${reward.reward_title}" (${STREAK_TYPE_LABEL[reward.streak_type]} · ${reward.required_streak}-streak)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteStreakReward.mutate(reward.id),
        },
      ],
    );
  }

  const addButton =
    tab === 'streaks' ? (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/(parent)/rewards/new-streak-reward' as any)}>
        <Text style={styles.addBtnText}>+ Add Milestone</Text>
      </TouchableOpacity>
    ) : tab === 'store' ? (
      <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/(parent)/rewards/new')}>
        <Text style={styles.addBtnText}>+ Add Reward</Text>
      </TouchableOpacity>
    ) : null;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Rewards</Text>
        {addButton}
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
            🔥 Milestones{streakRewards.length > 0 ? ` (${streakRewards.length})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'redemptions' && styles.tabActive]}
          onPress={() => setTab('redemptions')}
        >
          <Text style={[styles.tabText, tab === 'redemptions' && styles.tabTextActive]}>
            Requests{redemptions.length > 0 ? ` (${redemptions.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {tab === 'store' ? (
        <FlatList
          data={rewards}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.list}
          refreshing={rewardsLoading}
          renderItem={({ item }) => <RewardCard reward={item} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Emoji size={48}>🎁</Emoji>
              <Text style={styles.emptyText}>No rewards yet — add one so kids can redeem!</Text>
            </View>
          }
        />
      ) : tab === 'streaks' ? (
        <FlatList<StreakReward>
          data={streakRewards}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.list}
          onRefresh={refetchStreakRewards}
          refreshing={streakRewardsLoading}
          renderItem={({ item }) => (
            <View style={styles.streakCard}>
              <View style={styles.streakIcon}>
                <Emoji size={28}>
                  {item.is_surprise ? item.surprise_icon : (item.actual_icon ?? '🎁')}
                </Emoji>
              </View>
              <View style={styles.streakInfo}>
                <Text style={styles.streakTitle}>{item.reward_title}</Text>
                <Text style={styles.streakMeta}>
                  {STREAK_TYPE_LABEL[item.streak_type]} · {item.required_streak}-streak
                  {item.bonus_points > 0 ? ` · +${item.bonus_points} pts` : ''}
                  {item.is_surprise ? ' · Surprise 🎁' : ''}
                </Text>
                {item.reward_description ? (
                  <Text style={styles.streakDesc} numberOfLines={1}>{item.reward_description}</Text>
                ) : null}
              </View>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => handleDeleteStreakReward(item)}
              >
                <Text style={styles.deleteBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            !streakRewardsLoading ? (
              <View style={styles.empty}>
                <Emoji size={48}>🔥</Emoji>
                <Text style={styles.emptyText}>
                  No streak milestones yet — add one to reward kids for staying consistent!
                </Text>
              </View>
            ) : null
          }
        />
      ) : (
        <FlatList
          data={redemptions}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.redemptionCard}>
              <View style={styles.redemptionTop}>
                <KidAvatar
                  avatarEmoji={item.kid.avatar_emoji}
                  colorTheme={item.kid.color_theme}
                  size={36}
                />
                <View style={styles.redemptionInfo}>
                  <Text style={styles.kidName}>{item.kid.display_name}</Text>
                  <Text style={styles.rewardTitle}>
                    {item.reward.icon} {item.reward.title}
                  </Text>
                  <Text style={styles.pointsSpent}><Emoji size={FontSize.xs}>⚡</Emoji>{item.points_spent} pts</Text>
                </View>
              </View>
              <View style={styles.redemptionActions}>
                <Button
                  label="Reject"
                  onPress={() => rejectRedemption.mutate({ redemptionId: item.id, note: 'Not available right now' })}
                  variant="danger"
                  size="sm"
                  fullWidth={false}
                  isLoading={rejectRedemption.isPending}
                />
                <Button
                  label="Approve"
                  onPress={() => approveRedemption.mutate(item.id)}
                  variant="secondary"
                  size="sm"
                  fullWidth={false}
                  isLoading={approveRedemption.isPending}
                />
                <Button
                  label="Fulfilled ✓"
                  onPress={() => fulfillRedemption.mutate(item.id)}
                  size="sm"
                  fullWidth={false}
                  isLoading={fulfillRedemption.isPending}
                />
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Emoji size={48}>✅</Emoji>
              <Text style={styles.emptyText}>No pending redemption requests</Text>
            </View>
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
  addBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.full,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2,
  },
  addBtnText: { fontFamily: Fonts.nunitoBold, fontSize: FontSize.sm, color: Colors.text },
  tabs: {
    flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: Spacing.sm, paddingBottom: Spacing.sm,
  },
  tab: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.full, backgroundColor: Colors.surface,
  },
  tabActive: { backgroundColor: Colors.primary },
  tabText: { fontFamily: Fonts.nunitoBold, fontSize: FontSize.sm, color: Colors.textMuted },
  tabTextActive: { color: Colors.text },
  list: { padding: Spacing.lg, gap: Spacing.sm },
  empty: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.sm },
  emptyText: { fontFamily: Fonts.inter, fontSize: FontSize.md, color: Colors.textMuted, textAlign: 'center' },

  // Streak milestone cards
  streakCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md,
  },
  streakIcon: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.warning + '22', alignItems: 'center', justifyContent: 'center',
  },
  streakInfo: { flex: 1, gap: 2 },
  streakTitle: { fontFamily: Fonts.nunitoBold, fontSize: FontSize.md, color: Colors.text },
  streakMeta: { fontFamily: Fonts.inter, fontSize: FontSize.xs, color: Colors.textMuted },
  streakDesc: { fontFamily: Fonts.inter, fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  deleteBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.danger + '22', alignItems: 'center', justifyContent: 'center',
  },
  deleteBtnText: { fontFamily: Fonts.nunitoBold, fontSize: FontSize.xs, color: Colors.danger },

  // Redemption cards
  redemptionCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.md, gap: Spacing.md,
    borderWidth: 1, borderColor: Colors.warning + '44',
  },
  redemptionTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  redemptionInfo: { flex: 1 },
  kidName: { fontFamily: Fonts.interMedium, fontSize: FontSize.xs, color: Colors.textMuted },
  rewardTitle: { fontFamily: Fonts.nunitoBold, fontSize: FontSize.md, color: Colors.text },
  pointsSpent: { fontFamily: Fonts.mono, fontSize: FontSize.xs, color: Colors.secondary },
  redemptionActions: { flexDirection: 'row', gap: Spacing.sm, justifyContent: 'flex-end' },
});
