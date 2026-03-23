import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Emoji } from '@/components/ui/Emoji';
import { Colors, Fonts, FontSize, Radius, Spacing } from '@/constants/theme';

interface PointsBadgeProps {
  points: number;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'earn' | 'cost' | 'balance';
}

export function PointsBadge({ points, size = 'md', variant = 'earn' }: PointsBadgeProps) {
  const prefix = variant === 'cost' ? '' : variant === 'earn' ? '+' : '';
  const color = variant === 'cost' ? Colors.warning : Colors.secondary;

  return (
    <View style={[styles.badge, styles[`badge_${size}`], { backgroundColor: color + '22' }]}>
      <Emoji size={styles[`icon_${size}`].fontSize} style={styles.icon}>⚡</Emoji>
      <Text style={[styles.text, styles[`text_${size}`], { color }]}>
        {prefix}{points.toLocaleString()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.full,
    gap: 3,
  },
  badge_sm: { paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  badge_md: { paddingHorizontal: Spacing.sm + 2, paddingVertical: 5 },
  badge_lg: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },

  icon: {},
  icon_sm: { fontSize: 11 },
  icon_md: { fontSize: 13 },
  icon_lg: { fontSize: 16 },

  text: { fontFamily: Fonts.nunitoBold },
  text_sm: { fontSize: FontSize.xs },
  text_md: { fontSize: FontSize.sm },
  text_lg: { fontSize: FontSize.md },
});
