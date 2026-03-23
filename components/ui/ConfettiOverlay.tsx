// components/ui/ConfettiOverlay.tsx
// Full-screen celebration shown when a task is approved via Realtime (AD-009).
// Phase 2: RN Animated scale + fade.
// Phase 3: replace the emoji burst with Lottie confetti animation.

import React, { useEffect, useRef } from 'react';
import { Animated, Modal, StyleSheet, Text, View } from 'react-native';
import { Emoji } from '@/components/ui/Emoji';
import { Colors, Fonts, FontSize, Spacing, Radius } from '@/constants/theme';

interface ConfettiOverlayProps {
  visible: boolean;
  points: number;
  badgeName?: string; // name of a newly unlocked achievement, if any
  onFinish: () => void;
}

export function ConfettiOverlay({ visible, points, badgeName, onFinish }: ConfettiOverlayProps) {
  const scaleAnim = useRef(new Animated.Value(0.4)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    scaleAnim.setValue(0.4);
    opacityAnim.setValue(0);

    Animated.sequence([
      // Pop in
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 5 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]),
      // Hold
      Animated.delay(2200),
      // Fade out
      Animated.timing(opacityAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start(() => onFinish());
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible) return null;

  return (
    <Modal transparent animationType="none" visible={visible} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}>
          <Text style={styles.burst}>🎉</Text>
          <Text style={styles.title}>Task Crushed!</Text>
          <View style={styles.pointsPill}>
            <Emoji size={FontSize.lg}>⚡</Emoji>
            <Text style={styles.pointsText}>+{points} pts</Text>
          </View>
          {badgeName && (
            <View style={styles.badgeBanner}>
              <Emoji size={FontSize.md}>🏅</Emoji>
              <Text style={styles.badgeText}>Badge unlocked: {badgeName}</Text>
            </View>
          )}
          <Text style={styles.sub}>Your parent approved it — keep crushing it!</Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#000000BB',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
    width: '100%',
    borderWidth: 2,
    borderColor: Colors.primary + '66',
  },
  burst: { fontSize: 64 },
  title: { fontFamily: Fonts.nunitoBlack, fontSize: FontSize.xxl, color: Colors.text },
  pointsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.secondary + '33',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  pointsText: { fontFamily: Fonts.nunitoBlack, fontSize: FontSize.xl, color: Colors.secondary },
  badgeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.primary + '22',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  badgeText: { fontFamily: Fonts.nunitoBold, fontSize: FontSize.sm, color: Colors.primary },
  sub: { fontFamily: Fonts.inter, fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center' },
});
