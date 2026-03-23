import React, { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Alert,
} from 'react-native';
import { useAuthStore } from '@/store/authStore';
import { useAuth } from '@/hooks/useAuth';
import { useUpdateMyProfile } from '@/hooks/useFamily';
import { getLevelInfo, levelProgress } from '@/constants/levels';
import { Emoji } from '@/components/ui/Emoji';
import { Colors, Fonts, FontSize, Spacing, Radius } from '@/constants/theme';

const AVATAR_OPTIONS = [
  '😊', '😎', '🦁', '🐯', '🦊', '🐧',
  '🦄', '🐸', '🤩', '😄', '🌟', '⭐',
  '🎮', '🎯', '🏆', '🚀', '🎸', '🌈',
  '🦋', '🐉', '🐼', '🦖',
];

const COLOR_OPTIONS = Colors.kidAccents;

export default function KidProfileScreen() {
  const { profile } = useAuthStore();
  const { signOut } = useAuth();
  const updateProfile = useUpdateMyProfile();

  const lifetimePoints = profile?.lifetime_points ?? 0;
  const levelInfo = getLevelInfo(lifetimePoints);
  const progress = levelProgress(lifetimePoints);

  const [selectedEmoji, setSelectedEmoji] = useState(profile?.avatar_emoji ?? '⭐');
  const [selectedColor, setSelectedColor] = useState(profile?.color_theme ?? Colors.kidAccents[0]);
  const [editing, setEditing] = useState(false);

  const hasChanges = selectedEmoji !== profile?.avatar_emoji || selectedColor !== profile?.color_theme;

  async function handleSave() {
    try {
      await updateProfile.mutateAsync({ avatar_emoji: selectedEmoji, color_theme: selectedColor });
      setEditing(false);
    } catch {
      Alert.alert('Oops', 'Could not save your changes — try again.');
    }
  }

  function handleCancel() {
    setSelectedEmoji(profile?.avatar_emoji ?? '⭐');
    setSelectedColor(profile?.color_theme ?? Colors.kidAccents[0]);
    setEditing(false);
  }

  function handleSignOut() {
    Alert.alert('Switch Account', 'Go back to the login screen?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Yes', onPress: () => signOut() },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>My Profile</Text>

        {/* Avatar + name */}
        <View style={styles.profileCard}>
          <TouchableOpacity
            style={[styles.avatarRing, { borderColor: selectedColor }]}
            onPress={() => setEditing(true)}
            activeOpacity={0.75}
          >
            <Emoji size={44}>{selectedEmoji}</Emoji>
          </TouchableOpacity>
          <Text style={styles.name}>{profile?.display_name}</Text>
          <Text style={styles.levelTitle}>{levelInfo.title}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
          <Text style={styles.progressLabel}>Level {levelInfo.level} · {lifetimePoints} pts earned</Text>

          {!editing && (
            <TouchableOpacity style={styles.editBtn} onPress={() => setEditing(true)}>
              <Text style={styles.editBtnText}>Customise avatar</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Customise panel */}
        {editing && (
          <View style={styles.editPanel}>
            <Text style={styles.editLabel}>Choose your emoji</Text>
            <View style={styles.emojiGrid}>
              {AVATAR_OPTIONS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={[
                    styles.emojiCell,
                    selectedEmoji === emoji && { backgroundColor: selectedColor + '44', borderColor: selectedColor },
                  ]}
                  onPress={() => setSelectedEmoji(emoji)}
                >
                  <Emoji size={28}>{emoji}</Emoji>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.editLabel}>Choose your colour</Text>
            <View style={styles.colorRow}>
              {COLOR_OPTIONS.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorSwatch,
                    { backgroundColor: color },
                    selectedColor === color && styles.colorSwatchSelected,
                  ]}
                  onPress={() => setSelectedColor(color)}
                />
              ))}
            </View>

            <View style={styles.editActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, !hasChanges && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={!hasChanges || updateProfile.isPending}
              >
                <Text style={styles.saveText}>
                  {updateProfile.isPending ? 'Saving…' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{profile?.total_points ?? 0}</Text>
            <Text style={styles.statLabel}><Emoji size={FontSize.xs}>⚡</Emoji> Points</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{levelInfo.level}</Text>
            <Text style={styles.statLabel}><Emoji size={FontSize.xs}>🏅</Emoji> Level</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{lifetimePoints}</Text>
            <Text style={styles.statLabel}>Lifetime pts</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Switch Account</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: Spacing.xxl },
  title: { fontFamily: Fonts.nunitoBlack, fontSize: FontSize.xxl, color: Colors.text },

  profileCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.lg, alignItems: 'center', gap: Spacing.sm,
  },
  avatarRing: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 3, alignItems: 'center', justifyContent: 'center',
  },
  name: { fontFamily: Fonts.nunitoBlack, fontSize: FontSize.xl, color: Colors.text },
  levelTitle: { fontFamily: Fonts.interMedium, fontSize: FontSize.md, color: Colors.textMuted },
  progressTrack: {
    width: '100%', height: 8, backgroundColor: Colors.background,
    borderRadius: Radius.full, overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: Radius.full },
  progressLabel: { fontFamily: Fonts.inter, fontSize: FontSize.xs, color: Colors.textMuted },
  editBtn: {
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.primary,
  },
  editBtnText: { fontFamily: Fonts.nunitoBold, fontSize: FontSize.sm, color: Colors.primary },

  // Edit panel
  editPanel: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.md, gap: Spacing.md,
  },
  editLabel: {
    fontFamily: Fonts.interMedium, fontSize: FontSize.xs,
    color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6,
  },
  emojiGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs,
  },
  emojiCell: {
    width: 52, height: 52, borderRadius: Radius.md,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surface2, borderWidth: 2, borderColor: 'transparent',
  },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  colorSwatch: {
    width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: 'transparent',
  },
  colorSwatchSelected: { borderColor: Colors.text, borderWidth: 3 },
  editActions: { flexDirection: 'row', gap: Spacing.sm, justifyContent: 'flex-end' },
  cancelBtn: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.full, backgroundColor: Colors.surface2,
  },
  cancelText: { fontFamily: Fonts.nunitoBold, fontSize: FontSize.sm, color: Colors.textMuted },
  saveBtn: {
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.full, backgroundColor: Colors.primary,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveText: { fontFamily: Fonts.nunitoBold, fontSize: FontSize.sm, color: Colors.text },

  statsRow: { flexDirection: 'row', gap: Spacing.sm },
  statCard: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.md, alignItems: 'center', gap: 2,
  },
  statValue: { fontFamily: Fonts.nunitoBlack, fontSize: FontSize.xl, color: Colors.text },
  statLabel: { fontFamily: Fonts.inter, fontSize: FontSize.xs, color: Colors.textMuted },
  signOutBtn: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.md, alignItems: 'center',
  },
  signOutText: { fontFamily: Fonts.nunitoBold, fontSize: FontSize.md, color: Colors.textMuted },
});
