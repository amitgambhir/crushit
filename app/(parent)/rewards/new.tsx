import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useRewardTemplates, useCreateReward } from '@/hooks/useRewards';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Colors, Fonts, FontSize, Spacing, Radius } from '@/constants/theme';
import { RewardCategory } from '@/lib/database.types';

const CATEGORIES: RewardCategory[] = ['screen_time', 'food', 'outing', 'toy', 'privilege', 'experience', 'custom'];
const CATEGORY_LABELS: Record<RewardCategory, string> = {
  screen_time: '📱 Screen', food: '🍦 Food', outing: '🌳 Outing',
  toy: '🎁 Toy', privilege: '👑 Privilege', experience: '⛺ Experience', custom: '⭐ Custom',
};

export default function NewRewardScreen() {
  const router = useRouter();
  const { data: templates = [] } = useRewardTemplates();
  const createReward = useCreateReward();

  const [useTemplate, setUseTemplate] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('🎁');
  const [category, setCategory] = useState<RewardCategory>('privilege');
  const [costPoints, setCostPoints] = useState('50');
  const [templateSearch, setTemplateSearch] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const filteredTemplates = templates.filter(t =>
    t.title.toLowerCase().includes(templateSearch.toLowerCase())
  );

  function applyTemplate(templateId: string) {
    const t = templates.find(tmpl => tmpl.id === templateId);
    if (!t) return;
    setSelectedTemplate(templateId);
    setTitle(t.title);
    setCategory(t.category as RewardCategory);
    setIcon(t.icon);
    setCostPoints(String(t.cost_points));
    if (t.description) setDescription(t.description);
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = 'Title is required';
    if (!costPoints || isNaN(Number(costPoints)) || Number(costPoints) <= 0) e.costPoints = 'Enter a valid cost';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleCreate() {
    if (!validate()) return;
    await createReward.mutateAsync({
      templateId: selectedTemplate ?? undefined,
      title: title.trim(),
      description: description.trim() || undefined,
      category,
      icon,
      costPoints: Number(costPoints),
    });
    router.back();
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Add a Reward</Text>
        </View>

        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, useTemplate && styles.toggleBtnActive]}
            onPress={() => setUseTemplate(true)}
          >
            <Text style={[styles.toggleText, useTemplate && styles.toggleTextActive]}>From Library</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, !useTemplate && styles.toggleBtnActive]}
            onPress={() => setUseTemplate(false)}
          >
            <Text style={[styles.toggleText, !useTemplate && styles.toggleTextActive]}>Custom</Text>
          </TouchableOpacity>
        </View>

        {useTemplate ? (
          <View style={styles.section}>
            <Input
              placeholder="Search rewards..."
              leftIcon="search-outline"
              value={templateSearch}
              onChangeText={setTemplateSearch}
            />
            <View style={styles.templateList}>
              {filteredTemplates.slice(0, 20).map((tmpl) => (
                <TouchableOpacity
                  key={tmpl.id}
                  style={[styles.templateRow, selectedTemplate === tmpl.id && styles.templateRowActive]}
                  onPress={() => applyTemplate(tmpl.id)}
                >
                  <Text style={styles.templateIcon}>{tmpl.icon}</Text>
                  <View style={styles.templateInfo}>
                    <Text style={styles.templateTitle}>{tmpl.title}</Text>
                    <Text style={styles.templateMeta}>{tmpl.category} · ⚡{tmpl.cost_points}</Text>
                  </View>
                  {selectedTemplate === tmpl.id && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.section}>
            <Input label="Icon" value={icon} onChangeText={setIcon} placeholder="🎁" maxLength={4} />
            <View style={styles.categoryRow}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.catBtn, category === cat && styles.catBtnActive]}
                  onPress={() => setCategory(cat)}
                >
                  <Text style={[styles.catLabel, category === cat && styles.catLabelActive]}>
                    {CATEGORY_LABELS[cat]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <Input
          label="Reward title"
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Ice cream trip"
          error={errors.title}
        />
        <Input
          label="Description (optional)"
          value={description}
          onChangeText={setDescription}
          placeholder="Any extra details..."
          multiline
        />
        <Input
          label="Crush Points cost"
          value={costPoints}
          onChangeText={(t) => setCostPoints(t.replace(/\D/g, ''))}
          keyboardType="number-pad"
          leftIcon="flash-outline"
          error={errors.costPoints}
        />

        {createReward.error && (
          <Text style={styles.error}>
            {createReward.error instanceof Error ? createReward.error.message : 'Failed to create reward'}
          </Text>
        )}

        <Button label="Add Reward" onPress={handleCreate} isLoading={createReward.isPending} size="lg" style={styles.cta} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.lg, gap: Spacing.sm, paddingBottom: Spacing.xxl },
  header: { marginBottom: Spacing.sm },
  back: { fontFamily: Fonts.interMedium, fontSize: FontSize.md, color: Colors.primary, marginBottom: Spacing.lg },
  title: { fontFamily: Fonts.nunitoBlack, fontSize: FontSize.xxl, color: Colors.text },
  section: { gap: Spacing.sm },
  toggleRow: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 3, gap: 3 },
  toggleBtn: { flex: 1, paddingVertical: Spacing.xs + 2, borderRadius: Radius.md, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: Colors.primary },
  toggleText: { fontFamily: Fonts.nunitoBold, fontSize: FontSize.sm, color: Colors.textMuted },
  toggleTextActive: { color: Colors.text },
  templateList: { gap: 2 },
  templateRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.sm,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  templateRowActive: { borderColor: Colors.primary },
  templateIcon: { fontSize: 24 },
  templateInfo: { flex: 1 },
  templateTitle: { fontFamily: Fonts.nunitoBold, fontSize: FontSize.sm, color: Colors.text },
  templateMeta: { fontFamily: Fonts.inter, fontSize: FontSize.xs, color: Colors.textMuted },
  checkmark: { color: Colors.success, fontFamily: Fonts.nunitoBold, fontSize: FontSize.lg },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  catBtn: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2,
    backgroundColor: Colors.surface, borderRadius: Radius.full,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  catBtnActive: { borderColor: Colors.primary },
  catLabel: { fontFamily: Fonts.inter, fontSize: FontSize.xs, color: Colors.textMuted },
  catLabelActive: { color: Colors.text },
  error: { fontFamily: Fonts.inter, fontSize: FontSize.sm, color: Colors.danger },
  cta: { marginTop: Spacing.md },
});
