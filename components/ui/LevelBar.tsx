import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getLevelInfo, levelProgress } from '@/constants/levels';
import { Colors, Fonts, FontSize, Radius, Spacing } from '@/constants/theme';

interface LevelBarProps {
  lifetimePoints: number;
  accentColor?: string;
  compact?: boolean;
}

export function LevelBar({ lifetimePoints, accentColor = Colors.primary, compact = false }: LevelBarProps) {
  const { level, title, minPoints, maxPoints } = getLevelInfo(lifetimePoints);
  const progress = levelProgress(lifetimePoints);
  const pointsToNext = maxPoints - lifetimePoints;

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View style={styles.compactRow}>
          <Text style={[styles.levelNum, { color: accentColor }]}>Lv.{level}</Text>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${progress * 100}%`, backgroundColor: accentColor }]} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View>
          <Text style={[styles.levelNum, { color: accentColor }]}>Level {level}</Text>
          <Text style={styles.title}>{title}</Text>
        </View>
        <Text style={styles.pts}>{pointsToNext > 0 ? `${pointsToNext} pts to next` : 'Max level!'}</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${progress * 100}%`, backgroundColor: accentColor }]} />
      </View>
      <View style={styles.rangeRow}>
        <Text style={styles.rangeText}>{minPoints}</Text>
        <Text style={styles.rangeText}>{maxPoints}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.xs },
  compactContainer: {},
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  compactRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  levelNum: { fontFamily: Fonts.nunitoBlack, fontSize: FontSize.xl },
  title: { fontFamily: Fonts.inter, fontSize: FontSize.sm, color: Colors.textMuted },
  pts: { fontFamily: Fonts.interMedium, fontSize: FontSize.xs, color: Colors.textMuted },
  barTrack: {
    height: 8,
    flex: 1,
    backgroundColor: Colors.surface2,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: Radius.full },
  rangeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  rangeText: { fontFamily: Fonts.inter, fontSize: FontSize.xs, color: Colors.textMuted },
});
