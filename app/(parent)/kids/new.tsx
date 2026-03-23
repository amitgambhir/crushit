import React, { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, TextInput, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useCreateKid } from '@/hooks/useFamily';
import { Button } from '@/components/ui/Button';
import { Emoji } from '@/components/ui/Emoji';
import { Input } from '@/components/ui/Input';
import { Colors, Fonts, FontSize, Spacing, Radius } from '@/constants/theme';

const EMOJI_OPTIONS = ['⭐', '🚀', '🦁', '🐉', '🦊', '🐼', '🦄', '🐯', '🦋', '🐬', '🦅', '🐸'];
const COLOR_OPTIONS = [
  '#6C63FF', '#FF5722', '#FFD600', '#00C853',
  '#00BCD4', '#E91E63', '#9C27B0', '#3F51B5',
  '#FF9800', '#F44336', '#4CAF50', '#009688',
];

export default function NewKidScreen() {
  const router = useRouter();
  const createKid = useCreateKid();

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [avatarEmoji, setAvatarEmoji] = useState('⭐');
  const [colorTheme, setColorTheme] = useState('#6C63FF');
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!displayName.trim()) e.displayName = 'Name is required';
    if (!username.trim()) e.username = 'Username is required';
    else if (!/^[a-z0-9_]{3,20}$/.test(username)) e.username = '3–20 chars, letters/numbers/underscore only';
    if (pin.length !== 4) e.pin = 'PIN must be exactly 4 digits';
    else if (!/^\d{4}$/.test(pin)) e.pin = 'PIN must be exactly 4 digits';
    if (pin !== confirmPin) e.confirmPin = 'PINs do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleCreate() {
    if (!validate()) return;
    try {
      await createKid.mutateAsync({
        displayName: displayName.trim(),
        username: username.trim().toLowerCase(),
        pin,
        avatarEmoji,
        colorTheme,
      });
      router.back();
    } catch {
      // Error state is rendered below the form via createKid.error.
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Add a Kid</Text>
          <Text style={styles.subtitle}>
            They'll use their username + PIN to log in.
          </Text>
        </View>

        {/* Avatar preview */}
        <View style={styles.avatarPreview}>
          <View style={[styles.avatarCircle, { borderColor: colorTheme }]}>
            <Emoji size={44} style={styles.avatarEmoji}>{avatarEmoji}</Emoji>
          </View>
          <Text style={styles.previewName}>{displayName || 'Kid Name'}</Text>
        </View>

        {/* Emoji picker */}
        <View style={styles.section}>
          <Text style={styles.label}>Choose an emoji</Text>
          <View style={styles.emojiGrid}>
            {EMOJI_OPTIONS.map((e) => (
              <TouchableOpacity
                key={e}
                style={[styles.emojiBtn, avatarEmoji === e && { borderColor: colorTheme, borderWidth: 2.5 }]}
                onPress={() => setAvatarEmoji(e)}
              >
                <Emoji size={26} style={styles.emojiOption}>{e}</Emoji>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Color picker */}
        <View style={styles.section}>
          <Text style={styles.label}>Choose a color</Text>
          <View style={styles.colorRow}>
            {COLOR_OPTIONS.map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.colorDot, { backgroundColor: c },
                  colorTheme === c && styles.colorDotSelected]}
                onPress={() => setColorTheme(c)}
              />
            ))}
          </View>
        </View>

        {/* Fields */}
        <Input
          label="Kid's name"
          placeholder="e.g. Emma"
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
          error={errors.displayName}
        />
        <Input
          label="Username"
          placeholder="e.g. emma (used to log in)"
          value={username}
          onChangeText={(t) => setUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
          autoCapitalize="none"
          error={errors.username}
          hint="Letters, numbers and _ only. Kids type this to log in."
        />
        <Input
          label="PIN (4 digits)"
          placeholder="••••"
          value={pin}
          onChangeText={(t) => setPin(t.replace(/\D/g, '').slice(0, 4))}
          keyboardType="number-pad"
          secureTextEntry
          error={errors.pin}
        />
        <Input
          label="Confirm PIN"
          placeholder="••••"
          value={confirmPin}
          onChangeText={(t) => setConfirmPin(t.replace(/\D/g, '').slice(0, 4))}
          keyboardType="number-pad"
          secureTextEntry
          error={errors.confirmPin}
        />

        {createKid.error && (
          <Text style={styles.error}>
            {createKid.error instanceof Error ? createKid.error.message : 'Failed to create kid account'}
          </Text>
        )}

        <Button
          label="Create Kid Account"
          onPress={handleCreate}
          isLoading={createKid.isPending}
          size="lg"
          style={styles.cta}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flexGrow: 1, padding: Spacing.lg, gap: Spacing.sm, paddingBottom: Spacing.xxl },
  header: { marginBottom: Spacing.md },
  back: { fontFamily: Fonts.interMedium, fontSize: FontSize.md, color: Colors.primary, marginBottom: Spacing.lg },
  title: { fontFamily: Fonts.nunitoBlack, fontSize: FontSize.xxl, color: Colors.text },
  subtitle: { fontFamily: Fonts.inter, fontSize: FontSize.md, color: Colors.textMuted, marginTop: 4 },
  avatarPreview: { alignItems: 'center', gap: Spacing.sm, marginVertical: Spacing.md },
  avatarCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.surface2, borderWidth: 3,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarEmoji: {},
  previewName: { fontFamily: Fonts.nunitoBold, fontSize: FontSize.lg, color: Colors.text },
  section: { marginBottom: Spacing.md },
  label: { fontFamily: Fonts.interMedium, fontSize: FontSize.sm, color: Colors.text, marginBottom: Spacing.sm },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  emojiBtn: {
    width: 52, height: 52, borderRadius: Radius.md,
    backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'transparent',
  },
  emojiOption: {},
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  colorDot: { width: 32, height: 32, borderRadius: 16 },
  colorDotSelected: { borderWidth: 3, borderColor: Colors.text },
  error: { fontFamily: Fonts.inter, fontSize: FontSize.sm, color: Colors.danger },
  cta: { marginTop: Spacing.md },
});
