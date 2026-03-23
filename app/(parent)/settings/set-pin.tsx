// app/(parent)/settings/set-pin.tsx
// Set or change the parent PIN lock.
//
// Flow when no PIN exists:
//   Step 1: Enter new PIN
//   Step 2: Confirm new PIN → call set_parent_pin RPC → done
//
// Flow when a PIN already exists:
//   Step 0: Verify current PIN
//   Step 1: Enter new PIN
//   Step 2: Confirm new PIN → call set_parent_pin RPC → done

import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useHasParentPIN, useVerifyParentPIN, useSetParentPIN } from '@/hooks/useParentPIN';
import { useAuthStore } from '@/store/authStore';
import { PINPad } from '@/components/ui/PINPad';
import { Colors, Fonts, FontSize, Spacing } from '@/constants/theme';

type Step = 'verify_current' | 'enter_new' | 'confirm_new';

export default function SetPINScreen() {
  const router = useRouter();
  const { data: hasPIN } = useHasParentPIN();
  const verifyPIN = useVerifyParentPIN();
  const setPIN = useSetParentPIN();
  const { setPINVerified } = useAuthStore();

  const [step, setStep] = useState<Step>(hasPIN ? 'verify_current' : 'enter_new');
  const [newPIN, setNewPIN] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [attemptKey, setAttemptKey] = useState(0);

  function bump(err?: string) {
    setError(err ?? null);
    setAttemptKey((k) => k + 1);
  }

  async function handleVerifyCurrent(pin: string) {
    setError(null);
    try {
      const ok = await verifyPIN.mutateAsync(pin);
      if (ok) {
        setStep('enter_new');
        setAttemptKey((k) => k + 1);
      } else {
        bump('Incorrect PIN — try again');
      }
    } catch {
      bump('Something went wrong');
    }
  }

  function handleEnterNew(pin: string) {
    setNewPIN(pin);
    setStep('confirm_new');
    setAttemptKey((k) => k + 1);
  }

  async function handleConfirmNew(pin: string) {
    if (pin !== newPIN) {
      bump("PINs don't match — start again");
      setNewPIN('');
      setStep('enter_new');
      return;
    }

    try {
      await setPIN.mutateAsync(pin);
      // Mark verified for this session so the gate doesn't re-lock immediately
      setPINVerified(true);
      Alert.alert('PIN set', 'Your parent PIN has been saved.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save PIN';
      bump(msg);
      setStep('enter_new');
    }
  }

  const configs: Record<Step, { title: string; subtitle: string; onComplete: (pin: string) => void }> = {
    verify_current: {
      title: 'Current PIN',
      subtitle: 'Enter your current PIN to continue',
      onComplete: handleVerifyCurrent,
    },
    enter_new: {
      title: hasPIN ? 'New PIN' : 'Set a PIN',
      subtitle: hasPIN ? 'Enter your new 4-digit PIN' : 'Create a 4-digit PIN to lock the parent dashboard',
      onComplete: handleEnterNew,
    },
    confirm_new: {
      title: 'Confirm PIN',
      subtitle: 'Enter the same PIN again to confirm',
      onComplete: handleConfirmNew,
    },
  };

  const config = configs[step];

  return (
    <SafeAreaView style={styles.safe}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.back}>← Back</Text>
      </TouchableOpacity>

      <PINPad
        key={attemptKey}
        title={config.title}
        subtitle={config.subtitle}
        error={error}
        onComplete={config.onComplete}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  backBtn: { padding: Spacing.lg, paddingBottom: 0 },
  back: { fontFamily: Fonts.interMedium, fontSize: FontSize.md, color: Colors.primary },
});
