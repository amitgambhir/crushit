// Reached after sign-up (create mode) or sign-in without a family (join mode).
// The _layout.tsx auth guard sends users here when session exists but profile.family_id is null.

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Share,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/authStore';
import { Emoji } from '@/components/ui/Emoji';
import { Colors, Fonts, FontSize, Spacing, Radius } from '@/constants/theme';

type Mode = 'choose' | 'create' | 'join';

export default function FamilySetupScreen() {
  const router = useRouter();
  const { session } = useAuthStore();
  const { createFamily, joinFamily, isSubmitting, error, clearError } = useAuth();

  const [mode, setMode] = useState<Mode>('choose');
  const [familyName, setFamilyName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [createdFamily, setCreatedFamily] = useState<{ name: string; invite_code: string } | null>(null);

  async function handleCreate() {
    if (!familyName.trim() || !session?.user) return;
    clearError();
    const family = await createFamily(familyName.trim());
    if (family) {
      setCreatedFamily(family);
      // _layout.tsx will detect profile.family_id is now set and route to /(parent)
    }
  }

  async function handleJoin() {
    if (!inviteCode.trim() || !session?.user) return;
    clearError();
    const family = await joinFamily(inviteCode.trim());
    if (family) {
      // _layout.tsx routes automatically
    }
  }

  async function shareInviteCode() {
    if (!createdFamily) return;
    await Share.share({
      message: `Join our family "${createdFamily.name}" on CrushIt! Use invite code: ${createdFamily.invite_code}`,
    });
  }

  // ── Success state: family created, show invite code before entering app ────
  if (createdFamily) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <View style={styles.successHero}>
            <Emoji size={64}>🎉</Emoji>
            <Text style={styles.title}>Family created!</Text>
            <Text style={styles.subtitle}>
              Share this code so other parents or devices can join your family.
            </Text>
          </View>

          <Card style={styles.codeCard}>
            <Text style={styles.codeLabel}>Family Invite Code</Text>
            <Text style={styles.code}>{createdFamily.invite_code}</Text>
            <Text style={styles.codeHint}>
              You can find this later in Settings → Family.
            </Text>
          </Card>

          <Button
            label="Share Invite Code"
            onPress={shareInviteCode}
            variant="secondary"
          />

          <Button
            label="Go to Dashboard"
            onPress={() => router.replace('/(parent)')}
            style={styles.continueButton}
          />
        </View>
      </SafeAreaView>
    );
  }

  // ── Choose mode ────────────────────────────────────────────────────────────
  if (mode === 'choose') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Set up your family</Text>
            <Text style={styles.subtitle}>
              Are you starting fresh or joining an existing family?
            </Text>
          </View>

          <View style={styles.modeCards}>
            <TouchableOpacity style={styles.modeCard} onPress={() => setMode('create')} activeOpacity={0.8}>
              <Text style={styles.modeIcon}>🏠</Text>
              <Text style={styles.modeTitle}>Create a new family</Text>
              <Text style={styles.modeDesc}>You're the first parent setting up CrushIt.</Text>
              <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} style={styles.modeChevron} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.modeCard} onPress={() => setMode('join')} activeOpacity={0.8}>
              <Text style={styles.modeIcon}>🔑</Text>
              <Text style={styles.modeTitle}>Join an existing family</Text>
              <Text style={styles.modeDesc}>You have an invite code from the other parent.</Text>
              <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} style={styles.modeChevron} />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ── Create mode ────────────────────────────────────────────────────────────
  if (mode === 'create') {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setMode('choose')} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Name your family</Text>
            <Text style={styles.subtitle}>
              This appears on the kids' dashboards and leaderboard.
            </Text>
          </View>

          <Input
            label="Family name"
            placeholder="e.g. The Johnsons"
            leftIcon="home-outline"
            value={familyName}
            onChangeText={setFamilyName}
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={handleCreate}
          />

          {error && <Text style={styles.errorText}>{error}</Text>}

          <Button
            label="Create Family"
            onPress={handleCreate}
            isLoading={isSubmitting}
            disabled={!familyName.trim()}
            size="lg"
            style={styles.ctaButton}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Join mode ──────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setMode('choose')} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Enter invite code</Text>
          <Text style={styles.subtitle}>
            Ask the family admin for the 6-character code.
          </Text>
        </View>

        <Input
          label="Invite code"
          placeholder="e.g. ABC123"
          leftIcon="key-outline"
          value={inviteCode}
          onChangeText={(t) => setInviteCode(t.toUpperCase())}
          autoCapitalize="characters"
          maxLength={6}
          returnKeyType="done"
          onSubmitEditing={handleJoin}
        />

        {error && <Text style={styles.errorText}>{error}</Text>}

        <Button
          label="Join Family"
          onPress={handleJoin}
          isLoading={isSubmitting}
          disabled={inviteCode.length < 6}
          size="lg"
          style={styles.ctaButton}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xxl,
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
  modeCards: { gap: Spacing.md },
  modeCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flexWrap: 'wrap',
  },
  modeIcon: { fontSize: 32 },
  modeTitle: {
    fontFamily: Fonts.nunitoBold,
    fontSize: FontSize.lg,
    color: Colors.text,
    flex: 1,
  },
  modeDesc: {
    fontFamily: Fonts.inter,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    width: '100%',
  },
  modeChevron: { marginLeft: 'auto' },
  errorText: {
    fontFamily: Fonts.inter,
    fontSize: FontSize.sm,
    color: Colors.danger,
    marginBottom: Spacing.sm,
  },
  ctaButton: { marginTop: Spacing.md },

  // Success state
  successHero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  successEmoji: { fontSize: 64 },
  codeCard: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
    padding: Spacing.xl,
  },
  codeLabel: {
    fontFamily: Fonts.interMedium,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  code: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 40,
    color: Colors.secondary,
    letterSpacing: 8,
    marginBottom: Spacing.sm,
  },
  codeHint: {
    fontFamily: Fonts.inter,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  continueButton: { marginTop: Spacing.md },
});
