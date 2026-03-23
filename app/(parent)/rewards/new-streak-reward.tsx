import React, { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useCreateStreakReward } from '@/hooks/useStreakRewards';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Colors, Fonts, FontSize, Spacing, Radius } from '@/constants/theme';
import type { StreakType } from '@/lib/streaks';

const STREAK_TYPES: { key: StreakType; label: string; icon: string; hint: string }[] = [
  { key: 'daily',   label: 'Daily',   icon: '🔥', hint: 'Days in a row' },
  { key: 'weekly',  label: 'Weekly',  icon: '📅', hint: 'Weeks in a row' },
  { key: 'monthly', label: 'Monthly', icon: '🗓️', hint: 'Months in a row' },
  { key: 'yearly',  label: 'Yearly',  icon: '🏆', hint: 'Years in a row' },
];

const STREAK_PRESETS: Record<StreakType, number[]> = {
  daily:   [3, 7, 14, 30, 60, 100],
  weekly:  [2, 4, 8, 12, 26, 52],
  monthly: [2, 3, 6, 9, 12],
  yearly:  [1, 2, 3, 5],
};

export default function NewStreakRewardScreen() {
  const router = useRouter();
  const createStreakReward = useCreateStreakReward();

  const [streakType, setStreakType]         = useState<StreakType>('daily');
  const [requiredStreak, setRequiredStreak] = useState('7');
  const [rewardTitle, setRewardTitle]       = useState('');
  const [description, setDescription]      = useState('');
  const [bonusPoints, setBonusPoints]       = useState('50');
  const [isSurprise, setIsSurprise]         = useState(true);
  const [actualIcon, setActualIcon]         = useState('🎁');
  const [errors, setErrors]                 = useState<Record<string, string>>({});

  function validate() {
    const e: Record<string, string> = {};
    if (!rewardTitle.trim()) e.rewardTitle = 'Title is required';
    const n = Number(requiredStreak);
    if (!requiredStreak || isNaN(n) || n < 1 || !Number.isInteger(n)) {
      e.requiredStreak = 'Enter a whole number ≥ 1';
    }
    if (bonusPoints && (isNaN(Number(bonusPoints)) || Number(bonusPoints) < 0)) {
      e.bonusPoints = 'Enter 0 or a positive number';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleCreate() {
    if (!validate()) return;
    await createStreakReward.mutateAsync({
      streak_type:        streakType,
      required_streak:    Number(requiredStreak),
      reward_title:       rewardTitle.trim(),
      reward_description: description.trim() || undefined,
      bonus_points:       Number(bonusPoints) || 0,
      is_surprise:        isSurprise,
      actual_icon:        isSurprise ? undefined : actualIcon.trim() || undefined,
    });
    router.back();
  }

  const presets = STREAK_PRESETS[streakType];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Add Streak Milestone</Text>
          <Text style={styles.subtitle}>
            Reward kids automatically when they hit a streak target.
          </Text>
        </View>

        {/* Streak type selector */}
        <Text style={styles.label}>Streak type</Text>
        <View style={styles.typeRow}>
          {STREAK_TYPES.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[styles.typeBtn, streakType === t.key && styles.typeBtnActive]}
              onPress={() => {
                setStreakType(t.key);
                // Reset to first preset for new type
                setRequiredStreak(String(STREAK_PRESETS[t.key][1] ?? STREAK_PRESETS[t.key][0]));
              }}
            >
              <Text style={styles.typeIcon}>{t.icon}</Text>
              <Text style={[styles.typeLabel, streakType === t.key && styles.typeLabelActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Required streak with presets */}
        <Text style={styles.label}>
          Required {STREAK_TYPES.find(t => t.key === streakType)?.hint.toLowerCase()}
        </Text>
        <View style={styles.presetRow}>
          {presets.map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.presetChip, String(p) === requiredStreak && styles.presetChipActive]}
              onPress={() => setRequiredStreak(String(p))}
            >
              <Text style={[styles.presetText, String(p) === requiredStreak && styles.presetTextActive]}>
                {p}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Input
          placeholder="Or enter custom number"
          value={requiredStreak}
          onChangeText={(v) => setRequiredStreak(v.replace(/\D/g, ''))}
          keyboardType="number-pad"
          error={errors.requiredStreak}
        />

        {/* Reward details */}
        <Input
          label="Reward title"
          value={rewardTitle}
          onChangeText={setRewardTitle}
          placeholder="e.g. Pizza night!"
          error={errors.rewardTitle}
        />
        <Input
          label="Description (optional)"
          value={description}
          onChangeText={setDescription}
          placeholder="Any extra details..."
          multiline
        />
        <Input
          label="Bonus Crush Points"
          value={bonusPoints}
          onChangeText={(v) => setBonusPoints(v.replace(/\D/g, ''))}
          keyboardType="number-pad"
          leftIcon="flash-outline"
          error={errors.bonusPoints}
        />

        {/* Surprise toggle */}
        <View style={styles.switchRow}>
          <View style={styles.switchInfo}>
            <Text style={styles.switchLabel}>Surprise reward</Text>
            <Text style={styles.switchHint}>
              Kids see a mystery gift until they unlock it
            </Text>
          </View>
          <Switch
            value={isSurprise}
            onValueChange={setIsSurprise}
            trackColor={{ false: Colors.surface2, true: Colors.primary + '88' }}
            thumbColor={isSurprise ? Colors.primary : Colors.textMuted}
          />
        </View>

        {/* Actual icon — only shown when NOT surprise */}
        {!isSurprise && (
          <Input
            label="Reward icon (emoji)"
            value={actualIcon}
            onChangeText={setActualIcon}
            placeholder="🎁"
            maxLength={4}
          />
        )}

        {createStreakReward.error && (
          <Text style={styles.error}>
            {createStreakReward.error instanceof Error
              ? createStreakReward.error.message
              : 'Failed to create milestone'}
          </Text>
        )}

        <Button
          label="Add Milestone"
          onPress={handleCreate}
          isLoading={createStreakReward.isPending}
          size="lg"
          style={styles.cta}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: Colors.background },
  scroll:   { padding: Spacing.lg, gap: Spacing.sm, paddingBottom: Spacing.xxl },
  header:   { marginBottom: Spacing.sm, gap: Spacing.xs },
  back:     { fontFamily: Fonts.interMedium, fontSize: FontSize.md, color: Colors.primary, marginBottom: Spacing.sm },
  title:    { fontFamily: Fonts.nunitoBlack, fontSize: FontSize.xxl, color: Colors.text },
  subtitle: { fontFamily: Fonts.inter, fontSize: FontSize.sm, color: Colors.textMuted },

  label: {
    fontFamily: Fonts.nunitoBold, fontSize: FontSize.sm,
    color: Colors.textMuted, marginTop: Spacing.xs,
  },

  typeRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xs },
  typeBtn: {
    flex: 1, alignItems: 'center', paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1.5, borderColor: 'transparent', gap: 2,
  },
  typeBtnActive: { borderColor: Colors.warning, backgroundColor: Colors.warning + '18' },
  typeIcon:  { fontSize: 20 },
  typeLabel: { fontFamily: Fonts.inter, fontSize: FontSize.xs, color: Colors.textMuted },
  typeLabelActive: { color: Colors.warning, fontFamily: Fonts.interMedium },

  presetRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginBottom: Spacing.xs },
  presetChip: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
    backgroundColor: Colors.surface, borderRadius: Radius.full,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  presetChipActive: { borderColor: Colors.primary, backgroundColor: Colors.surface2 },
  presetText:     { fontFamily: Fonts.mono, fontSize: FontSize.sm, color: Colors.textMuted },
  presetTextActive: { color: Colors.text },

  switchRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.md, marginTop: Spacing.xs,
  },
  switchInfo:  { flex: 1, gap: 2 },
  switchLabel: { fontFamily: Fonts.nunitoBold, fontSize: FontSize.md, color: Colors.text },
  switchHint:  { fontFamily: Fonts.inter, fontSize: FontSize.xs, color: Colors.textMuted },

  error: { fontFamily: Fonts.inter, fontSize: FontSize.sm, color: Colors.danger },
  cta:   { marginTop: Spacing.md },
});
