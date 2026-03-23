import React, { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useKids } from '@/hooks/useFamily';
import { useTaskTemplates, useCreateTask } from '@/hooks/useTasks';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { KidAvatar } from '@/components/ui/KidAvatar';
import { Colors, Fonts, FontSize, Spacing, Radius } from '@/constants/theme';
import { TaskCategory } from '@/lib/database.types';

const RECURRENCE_OPTIONS = ['once', 'daily', 'weekdays', 'weekends', 'weekly', 'monthly'];

const CATEGORY_ICONS: Record<TaskCategory, string> = {
  chores: '🏠', school: '📚', personal: '💪',
  health: '🦷', creative: '🎨', kindness: '🤝', custom: '⭐',
};

export default function NewTaskScreen() {
  const router = useRouter();
  const { data: kids = [] } = useKids();
  const { data: templates = [] } = useTaskTemplates();
  const createTask = useCreateTask();

  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TaskCategory>('chores');
  const [icon, setIcon] = useState('⭐');
  const [points, setPoints] = useState('10');
  const [recurrence, setRecurrence] = useState('once');
  const [requiresPhoto, setRequiresPhoto] = useState(false);
  const [useTemplate, setUseTemplate] = useState(true);
  const [templateSearch, setTemplateSearch] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const filteredTemplates = templates.filter(t =>
    t.title.toLowerCase().includes(templateSearch.toLowerCase()) ||
    t.category.includes(templateSearch.toLowerCase())
  );

  function applyTemplate(templateId: string) {
    const t = templates.find(tmpl => tmpl.id === templateId);
    if (!t) return;
    setSelectedTemplate(templateId);
    setTitle(t.title);
    setCategory(t.category as TaskCategory);
    setIcon(t.icon);
    setPoints(String(t.default_points));
    if (t.description) setDescription(t.description);
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = 'Title is required';
    if (!points || isNaN(Number(points)) || Number(points) <= 0) e.points = 'Enter a valid point value';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleCreate() {
    if (!validate()) return;
    await createTask.mutateAsync({
      templateId: selectedTemplate ?? undefined,
      assignedTo,
      title: title.trim(),
      description: description.trim() || undefined,
      category,
      icon,
      points: Number(points),
      recurrence,
      requiresPhotoProof: requiresPhoto,
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
          <Text style={styles.title}>New Task</Text>
        </View>

        {/* Assign to kid */}
        <View style={styles.section}>
          <Text style={styles.label}>Assign to</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.kidsRow}>
            <TouchableOpacity
              style={[styles.kidPill, assignedTo === null && styles.kidPillActive]}
              onPress={() => setAssignedTo(null)}
            >
              <Text style={styles.kidPillText}>Anyone</Text>
            </TouchableOpacity>
            {kids.map((kid) => (
              <TouchableOpacity
                key={kid.id}
                style={[styles.kidPill, assignedTo === kid.id && { borderColor: kid.color_theme, borderWidth: 2 }]}
                onPress={() => setAssignedTo(kid.id)}
              >
                <KidAvatar avatarEmoji={kid.avatar_emoji} colorTheme={kid.color_theme} size={24} />
                <Text style={styles.kidPillText}>{kid.display_name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Template vs Custom toggle */}
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
          /* Template picker */
          <View style={styles.section}>
            <Input
              placeholder="Search tasks..."
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
                    <Text style={styles.templateMeta}>
                      {tmpl.category} · {tmpl.default_points} pts · {tmpl.difficulty}
                    </Text>
                  </View>
                  {selectedTemplate === tmpl.id && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          /* Custom fields */
          <View style={styles.section}>
            <Input
              label="Icon (emoji)"
              value={icon}
              onChangeText={setIcon}
              placeholder="e.g. 🧹"
              maxLength={4}
            />
            <View style={styles.categoryRow}>
              {(Object.keys(CATEGORY_ICONS) as TaskCategory[]).map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.catBtn, category === cat && styles.catBtnActive]}
                  onPress={() => setCategory(cat)}
                >
                  <Text>{CATEGORY_ICONS[cat]}</Text>
                  <Text style={[styles.catLabel, category === cat && styles.catLabelActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Task details */}
        <Input
          label="Task title"
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Clean your room"
          error={errors.title}
        />
        <Input
          label="Description (optional)"
          value={description}
          onChangeText={setDescription}
          placeholder="Add any extra instructions..."
          multiline
        />
        <Input
          label="Crush Points"
          value={points}
          onChangeText={(t) => setPoints(t.replace(/\D/g, ''))}
          keyboardType="number-pad"
          leftIcon="flash-outline"
          error={errors.points}
        />

        {/* Recurrence */}
        <View style={styles.section}>
          <Text style={styles.label}>Repeats</Text>
          <View style={styles.recurrenceRow}>
            {RECURRENCE_OPTIONS.map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.recBtn, recurrence === r && styles.recBtnActive]}
                onPress={() => setRecurrence(r)}
              >
                <Text style={[styles.recText, recurrence === r && styles.recTextActive]}>{r}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Photo proof */}
        <View style={styles.switchRow}>
          <View>
            <Text style={styles.switchLabel}>Require photo proof</Text>
            <Text style={styles.switchHint}>Kid must upload a photo to submit</Text>
          </View>
          <Switch
            value={requiresPhoto}
            onValueChange={setRequiresPhoto}
            trackColor={{ true: Colors.primary, false: Colors.surface2 }}
          />
        </View>

        {createTask.error && (
          <Text style={styles.error}>
            {createTask.error instanceof Error ? createTask.error.message : 'Failed to create task'}
          </Text>
        )}

        <Button
          label="Create Task"
          onPress={handleCreate}
          isLoading={createTask.isPending}
          size="lg"
          style={styles.cta}
        />
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
  label: { fontFamily: Fonts.interMedium, fontSize: FontSize.sm, color: Colors.text },
  kidsRow: { marginHorizontal: -Spacing.lg, paddingHorizontal: Spacing.lg },
  kidPill: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    backgroundColor: Colors.surface, borderRadius: Radius.full,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2,
    marginRight: Spacing.sm, borderWidth: 2, borderColor: 'transparent',
  },
  kidPillActive: { borderColor: Colors.primary },
  kidPillText: { fontFamily: Fonts.nunitoBold, fontSize: FontSize.sm, color: Colors.text },
  toggleRow: {
    flexDirection: 'row', backgroundColor: Colors.surface,
    borderRadius: Radius.lg, padding: 3, gap: 3,
  },
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
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.surface, borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  catBtnActive: { borderColor: Colors.primary },
  catLabel: { fontFamily: Fonts.inter, fontSize: FontSize.xs, color: Colors.textMuted },
  catLabelActive: { color: Colors.text },
  recurrenceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  recBtn: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2,
    backgroundColor: Colors.surface, borderRadius: Radius.full,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  recBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '22' },
  recText: { fontFamily: Fonts.interMedium, fontSize: FontSize.sm, color: Colors.textMuted },
  recTextActive: { color: Colors.primary },
  switchRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md,
  },
  switchLabel: { fontFamily: Fonts.nunitoBold, fontSize: FontSize.md, color: Colors.text },
  switchHint: { fontFamily: Fonts.inter, fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  error: { fontFamily: Fonts.inter, fontSize: FontSize.sm, color: Colors.danger },
  cta: { marginTop: Spacing.md },
});
