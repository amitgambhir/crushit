import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Share, Alert, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { useAuth } from '@/hooks/useAuth';
import { useHasParentPIN } from '@/hooks/useParentPIN';
import { Colors, Fonts, FontSize, Spacing, Radius } from '@/constants/theme';

export default function SettingsScreen() {
  const router = useRouter();
  const { profile, family } = useAuthStore();
  const { signOut } = useAuth();
  const { data: hasPIN } = useHasParentPIN();

  async function handleShareInvite() {
    if (!family?.invite_code) return;
    await Share.share({
      message: `Join our family on CrushIt! Use invite code: ${family.invite_code}\n\nDownload at crushitapp.com`,
      title: 'Join our CrushIt family',
    });
  }

  function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Settings</Text>

        {/* Profile */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Account</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Name</Text>
              <Text style={styles.rowValue}>{profile?.display_name ?? '—'}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Role</Text>
              <Text style={styles.rowValue}>Parent</Text>
            </View>
          </View>
        </View>

        {/* Family */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Family</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Family name</Text>
              <Text style={styles.rowValue}>{family?.name ?? '—'}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Invite code</Text>
              <Text style={[styles.rowValue, styles.code]}>{family?.invite_code ?? '—'}</Text>
            </View>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.row} onPress={handleShareInvite}>
              <Text style={styles.rowLabel}>Share invite link</Text>
              <Text style={styles.rowAction}>Share →</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Security */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Security</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.row}
              onPress={() => router.push('/(parent)/settings/set-pin' as any)}
            >
              <Text style={styles.rowLabel}>
                {hasPIN ? 'Change Parent PIN' : 'Set Parent PIN'}
              </Text>
              <Text style={styles.rowAction}>
                {hasPIN ? '🔒 Change →' : '→'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Data */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Data & Privacy</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.row} onPress={() => router.push('/(parent)/settings/export-data')}>
              <Text style={styles.rowLabel}>Export my data</Text>
              <Text style={styles.rowAction}>→</Text>
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.row} onPress={() => router.push('/(parent)/settings/delete-account')}>
              <Text style={[styles.rowLabel, { color: Colors.danger }]}>Delete account & family</Text>
              <Text style={[styles.rowAction, { color: Colors.danger }]}>→</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Legal */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Legal</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.row} onPress={() => Linking.openURL('https://amitgambhir.github.io/crushit-legal/')}>
              <Text style={styles.rowLabel}>Privacy Policy</Text>
              <Ionicons name="open-outline" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.row} onPress={() => Linking.openURL('https://amitgambhir.github.io/crushit-legal/terms')}>
              <Text style={styles.rowLabel}>Terms of Service</Text>
              <Ionicons name="open-outline" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.version}>CrushIt v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: Spacing.xxl },
  title: { fontFamily: Fonts.nunitoBlack, fontSize: FontSize.xxl, color: Colors.text },
  section: { gap: Spacing.xs },
  sectionLabel: {
    fontFamily: Fonts.interMedium, fontSize: FontSize.xs, color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: Spacing.xs,
  },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, overflow: 'hidden' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.md },
  divider: { height: 1, backgroundColor: Colors.background, marginHorizontal: Spacing.md },
  rowLabel: { fontFamily: Fonts.inter, fontSize: FontSize.md, color: Colors.text },
  rowValue: { fontFamily: Fonts.interMedium, fontSize: FontSize.md, color: Colors.textMuted },
  rowAction: { fontFamily: Fonts.interMedium, fontSize: FontSize.md, color: Colors.primary },
  rowMuted: { fontFamily: Fonts.inter, fontSize: FontSize.sm, color: Colors.textMuted },
  code: { fontFamily: Fonts.mono, fontSize: FontSize.md, color: Colors.secondary, letterSpacing: 2 },
  signOutBtn: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.md, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.danger + '44',
  },
  signOutText: { fontFamily: Fonts.nunitoBold, fontSize: FontSize.md, color: Colors.danger },
  version: { fontFamily: Fonts.inter, fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center' },
});
