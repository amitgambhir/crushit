// Kid login: family name + username + numeric PIN pad.
// Family name scopes the username lookup — kids can't guess usernames from
// other families. Username is unique per family (UNIQUE(username, family_id)).
// See AD-005, AD-011, AD-012 in CLAUDE.md.

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Linking,
  Vibration,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { Colors, Fonts, FontSize, Spacing, Radius } from '@/constants/theme';

const PIN_LENGTH = 4;

type Step = 'identity' | 'pin';

export default function KidLoginScreen() {
  const router = useRouter();
  const { signInAsKid, isSubmitting, error, clearError } = useAuth();

  const [step, setStep] = useState<Step>('identity');
  const [familyName, setFamilyName] = useState('');
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');

  const usernameRef = useRef<TextInput>(null);

  function handlePinDigit(digit: string) {
    if (pin.length >= PIN_LENGTH) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = pin + digit;
    setPin(next);
    if (next.length === PIN_LENGTH) {
      handleSignIn(next);
    }
  }

  function handlePinDelete() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPin((p) => p.slice(0, -1));
  }

  function handleIdentityNext() {
    if (!familyName.trim() || !username.trim()) return;
    clearError();
    setStep('pin');
  }

  async function handleSignIn(currentPin = pin) {
    clearError();
    await signInAsKid(familyName.trim(), username.trim().toLowerCase(), currentPin);
    if (error) {
      Vibration.vibrate(300);
      setPin('');
    }
    // _layout.tsx routes to /(kid) on success
  }

  const PAD_ROWS = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['', '0', '⌫'],
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>
            {step === 'identity' ? "Let's find you!" : `Hi, ${username}! 👋`}
          </Text>
          <Text style={styles.subtitle}>
            {step === 'identity'
              ? 'Enter your family name and username.'
              : 'Enter your PIN to get started.'}
          </Text>
        </View>

        {step === 'identity' ? (
          /* ── Identity step: family name + username ──────────────── */
          <View style={styles.identityForm}>
            <Input
              label="Family name"
              placeholder="e.g. The Smiths"
              leftIcon="home-outline"
              value={familyName}
              onChangeText={setFamilyName}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={() => usernameRef.current?.focus()}
              autoFocus
            />
            <Input
              ref={usernameRef}
              label="Your username"
              placeholder="your username"
              leftIcon="person-outline"
              value={username}
              onChangeText={(t) => setUsername(t.toLowerCase().replace(/\s/g, ''))}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleIdentityNext}
            />
            {error && <Text style={styles.errorText}>{error}</Text>}
            <Button
              label="Next"
              onPress={handleIdentityNext}
              disabled={!familyName.trim() || !username.trim()}
              size="lg"
            />
          </View>
        ) : (
          /* ── PIN step ──────────────────────────────────────────── */
          <View style={styles.pinSection}>
            {/* PIN dots */}
            <View style={styles.dotsRow}>
              {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    i < pin.length ? styles.dotFilled : styles.dotEmpty,
                  ]}
                />
              ))}
            </View>

            {error && <Text style={styles.errorText}>{error}</Text>}

            {/* Number pad */}
            <View style={styles.pad}>
              {PAD_ROWS.map((row, ri) => (
                <View key={ri} style={styles.padRow}>
                  {row.map((digit, di) => (
                    <TouchableOpacity
                      key={di}
                      style={[styles.padKey, digit === '' && styles.padKeyEmpty]}
                      onPress={() => {
                        if (digit === '') return;
                        if (digit === '⌫') handlePinDelete();
                        else handlePinDigit(digit);
                      }}
                      disabled={isSubmitting || digit === ''}
                      activeOpacity={0.6}
                    >
                      <Text style={styles.padKeyText}>{digit}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </View>

            <TouchableOpacity
              onPress={() => { setStep('identity'); setPin(''); clearError(); }}
              style={styles.changeUser}
            >
              <Text style={styles.changeUserText}>Not {username}?</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Privacy note — static, no interaction needed for kids */}
        <Text style={styles.privacyNote}>
          Your privacy is protected ·{' '}
          <Text
            style={styles.privacyLink}
            onPress={() => Linking.openURL('https://crushitapp.com/privacy')}
          >
            crushitapp.com/privacy
          </Text>
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  header: { marginBottom: Spacing.xl },
  backText: {
    fontFamily: Fonts.interMedium,
    fontSize: FontSize.md,
    color: Colors.primary,
    marginBottom: Spacing.lg,
  },
  title: {
    fontFamily: Fonts.nunitoBlack,
    fontSize: FontSize.xxl,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontFamily: Fonts.inter,
    fontSize: FontSize.md,
    color: Colors.textMuted,
  },

  // Identity step
  identityForm: { flex: 1, gap: Spacing.md },
  errorText: {
    fontFamily: Fonts.inter,
    fontSize: FontSize.sm,
    color: Colors.danger,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },

  // PIN step
  pinSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xl,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  dotEmpty: {
    backgroundColor: Colors.surface2,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  dotFilled: {
    backgroundColor: Colors.primary,
  },

  // Numpad
  pad: {
    gap: Spacing.sm,
    width: '100%',
    maxWidth: 300,
  },
  padRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    justifyContent: 'center',
  },
  padKey: {
    width: 88,
    height: 72,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  padKeyEmpty: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  padKeyText: {
    fontFamily: Fonts.nunitoBold,
    fontSize: FontSize.xl,
    color: Colors.text,
  },
  changeUser: {
    paddingVertical: Spacing.sm,
  },
  changeUserText: {
    fontFamily: Fonts.interMedium,
    fontSize: FontSize.sm,
    color: Colors.primary,
  },

  // Footer
  privacyNote: {
    fontFamily: Fonts.inter,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 'auto',
  },
  privacyLink: {
    color: Colors.primary,
  },
});
