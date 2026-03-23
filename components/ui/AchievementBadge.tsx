// components/ui/AchievementBadge.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 2 — Renders a single achievement badge as earned (full colour) or
// locked (greyscale + lock icon), with optional progress bar underneath.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Emoji } from '@/components/ui/Emoji';
import { Colors, Fonts, FontSize, Spacing, Radius } from '@/constants/theme';

interface AchievementBadgeProps {
  icon: string;
  title: string;
  earned: boolean;
  progress?: number; // 0–1, shown as a thin bar below the badge
  size?: 'sm' | 'md';
}

export function AchievementBadge({
  icon,
  title,
  earned,
  progress = 0,
  size = 'md',
}: AchievementBadgeProps) {
  const dim = size === 'sm' ? 48 : 64;

  return (
    <View style={styles.wrapper}>
      <View
        style={[
          styles.badge,
          { width: dim, height: dim, borderRadius: dim / 2 },
          earned ? styles.badgeEarned : styles.badgeLocked,
        ]}
      >
        <Emoji size={size === 'sm' ? 22 : 28}>{icon}</Emoji>
      </View>
      {!earned && progress > 0 && (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` as `${number}%` }]} />
        </View>
      )}
      <Text style={[styles.label, !earned && styles.labelLocked]} numberOfLines={2}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', gap: Spacing.xs, maxWidth: 80 },
  badge: { alignItems: 'center', justifyContent: 'center' },
  badgeEarned: { backgroundColor: Colors.primary + '33', borderWidth: 2, borderColor: Colors.primary },
  badgeLocked: { backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.border, opacity: 0.5 },
  progressTrack: { width: 48, height: 3, backgroundColor: Colors.surface2, borderRadius: Radius.full },
  progressFill: { height: 3, backgroundColor: Colors.primary, borderRadius: Radius.full },
  label: { fontFamily: Fonts.inter, fontSize: FontSize.xs, color: Colors.text, textAlign: 'center' },
  labelLocked: { color: Colors.textMuted },
});
