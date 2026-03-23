import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Share } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import { Colors, Fonts, FontSize, Spacing, Radius } from '@/constants/theme';

export default function ExportDataScreen() {
  const router = useRouter();
  const { family } = useAuthStore();
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    if (!family) return;
    setIsExporting(true);
    setError(null);
    try {
      // Fetch all family data in parallel
      const [profilesRes, tasksRes, rewardsRes, redemptionsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('family_id', family.id),
        supabase.from('tasks').select('*').eq('family_id', family.id),
        supabase.from('rewards').select('*').eq('family_id', family.id),
        supabase.from('redemptions').select('*'),
      ]);

      const exportData = {
        exportedAt: new Date().toISOString(),
        family: { id: family.id, name: family.name, invite_code: family.invite_code },
        profiles: profilesRes.data ?? [],
        tasks: tasksRes.data ?? [],
        rewards: rewardsRes.data ?? [],
        redemptions: redemptionsRes.data ?? [],
      };

      await Share.share({
        message: JSON.stringify(exportData, null, 2),
        title: `CrushIt data export — ${family.name}`,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Export My Data</Text>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Your export will include all family data: profiles, tasks, rewards, and redemption history.
            The data is exported as JSON and can be saved or shared from your device.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>What's included</Text>
          <View style={styles.card}>
            {[
              ['Profiles', 'Parent and kid account information'],
              ['Tasks', 'All tasks and completion history'],
              ['Rewards', 'Reward catalog and redemptions'],
            ].map(([title, desc], i, arr) => (
              <View key={title}>
                <View style={styles.row}>
                  <Text style={styles.rowTitle}>{title}</Text>
                  <Text style={styles.rowDesc}>{desc}</Text>
                </View>
                {i < arr.length - 1 && <View style={styles.divider} />}
              </View>
            ))}
          </View>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <Button
          label="Export as JSON"
          onPress={handleExport}
          isLoading={isExporting}
          size="lg"
          style={styles.cta}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: Spacing.xxl },
  back: { fontFamily: Fonts.interMedium, fontSize: FontSize.md, color: Colors.primary },
  title: { fontFamily: Fonts.nunitoBlack, fontSize: FontSize.xxl, color: Colors.text },
  infoBox: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md,
  },
  infoText: { fontFamily: Fonts.inter, fontSize: FontSize.md, color: Colors.textMuted, lineHeight: 22 },
  section: { gap: Spacing.xs },
  sectionLabel: {
    fontFamily: Fonts.interMedium, fontSize: FontSize.xs, color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: Spacing.xs,
  },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, overflow: 'hidden' },
  row: { padding: Spacing.md, gap: 2 },
  divider: { height: 1, backgroundColor: Colors.background, marginHorizontal: Spacing.md },
  rowTitle: { fontFamily: Fonts.nunitoBold, fontSize: FontSize.md, color: Colors.text },
  rowDesc: { fontFamily: Fonts.inter, fontSize: FontSize.sm, color: Colors.textMuted },
  error: { fontFamily: Fonts.inter, fontSize: FontSize.sm, color: Colors.danger },
  cta: { marginTop: Spacing.sm },
});
