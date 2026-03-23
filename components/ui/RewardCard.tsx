import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { PointsBadge } from './PointsBadge';
import { Colors, Fonts, FontSize, Radius, Spacing } from '@/constants/theme';
import { Reward } from '@/lib/database.types';

interface RewardCardProps {
  reward: Reward;
  kidPoints?: number;       // if provided, shows affordability state
  onPress?: () => void;
}

export function RewardCard({ reward, kidPoints, onPress }: RewardCardProps) {
  const canAfford = kidPoints !== undefined ? kidPoints >= reward.cost_points : undefined;

  return (
    <TouchableOpacity
      style={[styles.card, canAfford === false && styles.cardDim]}
      onPress={onPress}
      activeOpacity={0.8}
      disabled={!onPress}
    >
      <View style={styles.iconWrap}>
        <Text style={styles.icon}>{reward.icon}</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>{reward.title}</Text>
        {reward.description && (
          <Text style={styles.desc} numberOfLines={1}>{reward.description}</Text>
        )}
      </View>
      <View style={styles.right}>
        <PointsBadge points={reward.cost_points} size="sm" variant="cost" />
        {canAfford === true && <Text style={styles.canAfford}>I can get this!</Text>}
        {reward.quantity_available !== null && (
          <Text style={styles.qty}>
            {reward.quantity_available - reward.quantity_redeemed} left
          </Text>
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
  },
  cardDim: { opacity: 0.55 },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 28 },
  content: { flex: 1 },
  title: { fontFamily: Fonts.nunitoBold, fontSize: FontSize.md, color: Colors.text },
  desc: { fontFamily: Fonts.inter, fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  right: { alignItems: 'flex-end', gap: 4 },
  canAfford: { fontFamily: Fonts.interMedium, fontSize: 11, color: Colors.success },
  qty: { fontFamily: Fonts.inter, fontSize: 11, color: Colors.textMuted },
});
