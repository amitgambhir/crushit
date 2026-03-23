import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, FontSize, Spacing } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';
import { useHasParentPIN, useVerifyParentPIN } from '@/hooks/useParentPIN';
import { PINPad } from '@/components/ui/PINPad';

function PINGate() {
  const { setPINVerified } = useAuthStore();
  const verifyPIN = useVerifyParentPIN();
  const [error, setError] = React.useState<string | null>(null);
  const [attemptKey, setAttemptKey] = React.useState(0);

  async function handleComplete(pin: string) {
    setError(null);
    try {
      const ok = await verifyPIN.mutateAsync(pin);
      if (ok) {
        setPINVerified(true);
      } else {
        setError('Incorrect PIN — try again');
        setAttemptKey((k) => k + 1);
      }
    } catch {
      setError('Something went wrong — try again');
      setAttemptKey((k) => k + 1);
    }
  }

  return (
    <SafeAreaView style={styles.gate}>
      <Text style={styles.logo}>🔒</Text>
      <PINPad
        key={attemptKey}
        title="Parent PIN"
        subtitle="Enter your PIN to access the parent dashboard"
        error={error}
        onComplete={handleComplete}
      />
    </SafeAreaView>
  );
}

export default function ParentLayout() {
  const { isPINVerified } = useAuthStore();
  const { data: hasPIN, isLoading } = useHasParentPIN();

  // Show PIN gate if a PIN is set and not yet verified this session
  const showGate = !isLoading && hasPIN === true && !isPINVerified;

  if (showGate) {
    return <PINGate />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: { fontFamily: Fonts.nunitoSemibold, fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="kids"
        options={{
          title: 'Kids',
          tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          tabBarIcon: ({ color, size }) => <Ionicons name="checkmark-circle-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="rewards"
        options={{
          title: 'Rewards',
          tabBarIcon: ({ color, size }) => <Ionicons name="gift-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  gate: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  logo: { fontSize: 48, marginBottom: Spacing.sm },
});
