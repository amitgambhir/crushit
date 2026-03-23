import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Colors, Fonts, FontSize, Spacing, Radius } from '@/constants/theme';

export default function DeleteAccountScreen() {
  const router = useRouter();
  const { family, reset } = useAuthStore();
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canDelete = confirmText === 'DELETE';

  async function handleDelete() {
    if (!canDelete || !family) return;
    setIsDeleting(true);
    setError(null);
    try {
      const { error: fnErr } = await supabase.functions.invoke('delete-family', {
        body: { familyId: family.id },
      });
      if (fnErr) throw fnErr;
      await supabase.auth.signOut();
      reset();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete account');
      setIsDeleting(false);
    }
  }

  function handlePress() {
    Alert.alert(
      'This cannot be undone',
      'All family data, kids, tasks, rewards, and points will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete forever', style: 'destructive', onPress: handleDelete },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Delete Account</Text>

        <View style={styles.warningBox}>
          <Text style={styles.warningTitle}>This will permanently delete:</Text>
          {[
            'Your parent account',
            'All kid accounts in this family',
            'All tasks, rewards, and points',
            'All activity history',
          ].map((item) => (
            <Text key={item} style={styles.warningItem}>• {item}</Text>
          ))}
          <Text style={styles.warningFooter}>This action cannot be undone.</Text>
        </View>

        <Input
          label='Type "DELETE" to confirm'
          value={confirmText}
          onChangeText={setConfirmText}
          placeholder="DELETE"
          autoCapitalize="characters"
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Button
          label="Delete my account and family"
          onPress={handlePress}
          variant="danger"
          size="lg"
          isLoading={isDeleting}
          style={[styles.deleteBtn, !canDelete && styles.deleteBtnDisabled]}
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
  warningBox: {
    backgroundColor: Colors.danger + '18', borderRadius: Radius.lg,
    padding: Spacing.md, gap: Spacing.xs,
    borderWidth: 1, borderColor: Colors.danger + '44',
  },
  warningTitle: { fontFamily: Fonts.nunitoBold, fontSize: FontSize.md, color: Colors.danger, marginBottom: 4 },
  warningItem: { fontFamily: Fonts.inter, fontSize: FontSize.sm, color: Colors.text },
  warningFooter: { fontFamily: Fonts.interMedium, fontSize: FontSize.sm, color: Colors.danger, marginTop: 4 },
  error: { fontFamily: Fonts.inter, fontSize: FontSize.sm, color: Colors.danger },
  deleteBtn: { marginTop: Spacing.sm },
  deleteBtnDisabled: { opacity: 0.4 },
});
