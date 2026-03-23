// components/ui/StreakBadge.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Displays a streak count with fire/calendar/moon icon and optional label.
// Used on the kid dashboard and the parent's kid detail screen.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Emoji } from '@/components/ui/Emoji';
import type { StreakType } from '@/lib/streaks';
import { Colors, Fonts, FontSize, Spacing, Radius } from '@/constants/theme';

const STREAK_ICON: Record<StreakType, string> = {
  daily:   '🔥',
  weekly:  '📅',
  monthly: '🌙',
  yearly:  '⭐',
};

const STREAK_LABEL: Record<StreakType, string> = {
  daily:   'day streak',
  weekly:  'week streak',
  monthly: 'month streak',
  yearly:  'year streak',
};

interface StreakBadgeProps {
  streakType: StreakType;
  count: number;
  accentColor?: string;
}

export function StreakBadge({ streakType, count, accentColor = Colors.warning }: StreakBadgeProps) {
  return (
    <View style={[styles.badge, { backgroundColor: accentColor + '22' }]}>
      <Emoji size={24}>{STREAK_ICON[streakType]}</Emoji>
      <Text style={[styles.count, { color: accentColor }]}>{count}</Text>
      <Text style={styles.label}>{STREAK_LABEL[streakType]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flex: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 2,
  },
  count: { fontFamily: Fonts.nunitoBlack, fontSize: FontSize.xl },
  label: { fontFamily: Fonts.inter, fontSize: FontSize.xs, color: Colors.textMuted },
});
