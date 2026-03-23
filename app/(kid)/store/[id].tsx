import React, { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { useRewards, useRedeemReward } from '@/hooks/useRewards';
import { Emoji } from '@/components/ui/Emoji';
import { Button } from '@/components/ui/Button';
import { Colors, Fonts, FontSize, Spacing, Radius } from '@/constants/theme';

const CATEGORY_LABELS: Record<string, string> = {
  screen_time: 'Screen Time',
  food:        'Food & Treats',
  outing:      'Outing',
  toy:         'Toy / Gift',
  privilege:   'Special Privilege',
  experience:  'Experience',
  custom:      'Custom',
};

export default function KidRewardDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuthStore();
  const { data: rewards = [] } = useRewards();
  const redeemReward = useRedeemReward();
  const [redeeming, setRedeeming] = useState(false);

  const reward = rewards.find((r) => r.id === id);
  const currentPoints = profile?.total_points ?? 0;

  if (!reward) return null;

  const canAfford = currentPoints >= reward.cost_points;
  const pointsShort = reward.cost_points - currentPoints;

  async function handleRedeem() {
    Alert.alert(
      `Redeem ${reward!.icon} ${reward!.title}?`,
      `This costs ${reward!.cost_points} pts. You'll have ${currentPoints - reward!.cost_points} pts left.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Redeem!',
          onPress: async () => {
            setRedeeming(true);
            try {
              await redeemReward.mutateAsync(reward!.id);
              Alert.alert(
                'Request sent! 🎉',
                'Your parent will see your request and deliver it soon.',
                [{ text: 'OK', onPress: () => router.back() }]
              );
            } catch (err) {
              Alert.alert('Could not redeem', err instanceof Error ? err.message : 'Please try again.');
            } finally {
              setRedeeming(false);
            }
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Store</Text>
        </TouchableOpacity>

        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.iconWrap}>
            <Emoji size={64}>{reward.icon}</Emoji>
          </View>
          <Text style={styles.title}>{reward.title}</Text>
          <Text style={styles.category}>{CATEGORY_LABELS[reward.category] ?? reward.category}</Text>
        </View>

        {/* Cost card */}
        <View style={[styles.costCard, canAfford ? styles.costCardAffordable : styles.costCardTooExpensive]}>
          <View style={styles.costRow}>
            <Emoji size={FontSize.xl}>⚡</Emoji>
            <Text style={[styles.costValue, canAfford ? styles.costValueAffordable : styles.costValueTooExpensive]}>
              {reward.cost_points} pts
            </Text>
          </View>
          {canAfford ? (
            <Text style={styles.costMeta}>You have {currentPoints} pts — you can afford this!</Text>
          ) : (
            <Text style={styles.costMeta}>You need {pointsShort} more pts (you have {currentPoints})</Text>
          )}
        </View>

        {/* Description */}
        {reward.description && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>About this reward</Text>
            <Text style={styles.cardText}>{reward.description}</Text>
          </View>
        )}

        {/* Availability */}
        {reward.quantity_available !== null && (
          <View style={[styles.card, styles.row]}>
            <Text style={styles.cardLabel}>Available</Text>
            <Text style={styles.cardValue}>
              {Math.max(0, reward.quantity_available - reward.quantity_redeemed)} left
            </Text>
          </View>
        )}

        {/* Redeem CTA */}
        <Button
          label={canAfford ? `Redeem for ${reward.cost_points} pts` : `Need ${pointsShort} more pts`}
          onPress={handleRedeem}
          disabled={!canAfford || redeeming}
          isLoading={redeeming}
          size="lg"
          style={styles.cta}
        />

        {!canAfford && (
          <Text style={styles.hint}>
            Keep completing tasks to earn more Crush Points!
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: Spacing.xxl },
  back: { fontFamily: Fonts.interMedium, fontSize: FontSize.md, color: Colors.primary },

  hero: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md },
  iconWrap: {
    width: 112, height: 112, borderRadius: Radius.xl,
    backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center',
  },
  title: { fontFamily: Fonts.nunitoBlack, fontSize: FontSize.xxl, color: Colors.text, textAlign: 'center' },
  category: { fontFamily: Fonts.inter, fontSize: FontSize.sm, color: Colors.textMuted },

  costCard: {
    borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.xs,
    alignItems: 'center', borderWidth: 1,
  },
  costCardAffordable: {
    backgroundColor: Colors.secondary + '11', borderColor: Colors.secondary + '44',
  },
  costCardTooExpensive: {
    backgroundColor: Colors.surface, borderColor: Colors.surface,
  },
  costRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  costValue: { fontFamily: Fonts.mono, fontSize: FontSize.xxl },
  costValueAffordable: { color: Colors.secondary },
  costValueTooExpensive: { color: Colors.textMuted },
  costMeta: { fontFamily: Fonts.inter, fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center' },

  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardLabel: {
    fontFamily: Fonts.interMedium, fontSize: FontSize.xs,
    color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  cardText: { fontFamily: Fonts.inter, fontSize: FontSize.md, color: Colors.text },
  cardValue: { fontFamily: Fonts.nunitoBold, fontSize: FontSize.md, color: Colors.text },

  cta: { marginTop: Spacing.xs },
  hint: { fontFamily: Fonts.inter, fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center' },
});
