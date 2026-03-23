// components/ui/PINPad.tsx
// 4-digit PIN entry pad used for Parent PIN lock (Session 2.4).
//
// Renders 4 dot indicators + a 3×4 digit grid.
// Calls onComplete(pin) as soon as the 4th digit is entered.
// Parent is responsible for resetting via the `key` prop on error.

import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Vibration,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, Fonts, FontSize, Spacing, Radius } from '@/constants/theme';

const PIN_LENGTH = 4;

const KEYS = [
  '1', '2', '3',
  '4', '5', '6',
  '7', '8', '9',
  '',  '0', '⌫',
];

interface PINPadProps {
  title?: string;
  subtitle?: string;
  error?: string | null;
  onComplete: (pin: string) => void;
}

export function PINPad({ title, subtitle, error, onComplete }: PINPadProps) {
  const [digits, setDigits] = useState<string[]>([]);

  function handleKey(key: string) {
    if (key === '') return; // empty cell (bottom-left placeholder)

    if (key === '⌫') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setDigits((d) => d.slice(0, -1));
      return;
    }

    if (digits.length >= PIN_LENGTH) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = [...digits, key];
    setDigits(next);

    if (next.length === PIN_LENGTH) {
      // Brief delay so the last dot fills before callback fires
      setTimeout(() => {
        onComplete(next.join(''));
        setDigits([]);
      }, 80);
    }
  }

  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}

      {/* Dot indicators */}
      <View style={styles.dots}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i < digits.length && styles.dotFilled,
              error && styles.dotError,
            ]}
          />
        ))}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      {/* Key grid */}
      <View style={styles.grid}>
        {KEYS.map((key, idx) => (
          <TouchableOpacity
            key={idx}
            style={[styles.key, key === '' && styles.keyEmpty]}
            onPress={() => handleKey(key)}
            disabled={key === ''}
            activeOpacity={0.6}
          >
            <Text style={[styles.keyText, key === '⌫' && styles.keyBackspace]}>
              {key}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: Spacing.lg,
    paddingVertical: Spacing.xl,
  },
  title: {
    fontFamily: Fonts.nunitoBlack,
    fontSize: FontSize.xl,
    color: Colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: Fonts.inter,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: Spacing.lg,
    marginVertical: Spacing.sm,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.textMuted,
    backgroundColor: 'transparent',
  },
  dotFilled: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  dotError: {
    borderColor: Colors.danger,
    backgroundColor: Colors.danger + '44',
  },
  error: {
    fontFamily: Fonts.interMedium,
    fontSize: FontSize.sm,
    color: Colors.danger,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 264,
    gap: Spacing.sm,
  },
  key: {
    width: 80,
    height: 80,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  keyEmpty: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  keyText: {
    fontFamily: Fonts.nunitoBlack,
    fontSize: FontSize.xxl,
    color: Colors.text,
  },
  keyBackspace: {
    fontFamily: Fonts.inter,
    fontSize: FontSize.lg,
    color: Colors.textMuted,
  },
});
