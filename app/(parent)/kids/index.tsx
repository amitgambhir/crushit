import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useKids } from '@/hooks/useFamily';
import { KidAvatar } from '@/components/ui/KidAvatar';
import { LevelBar } from '@/components/ui/LevelBar';
import { Colors, Fonts, FontSize, Spacing, Radius } from '@/constants/theme';
import { Profile } from '@/lib/database.types';

export default function KidsListScreen() {
  const router = useRouter();
  const { data: kids = [], isLoading } = useKids();

  function renderKid({ item: kid }: { item: Profile }) {
    return (
      <TouchableOpacity
        style={styles.kidCard}
        onPress={() => router.push(`/(parent)/kids/${kid.id}`)}
        activeOpacity={0.8}
      >
        <KidAvatar
          avatarEmoji={kid.avatar_emoji}
          colorTheme={kid.color_theme}
          size={56}
          level={kid.level}
        />
        <View style={styles.kidInfo}>
          <Text style={styles.kidName}>{kid.display_name}</Text>
          {kid.username && (
            <Text style={styles.kidUsername}>@{kid.username}</Text>
          )}
          <LevelBar lifetimePoints={kid.lifetime_points} accentColor={kid.color_theme} compact />
        </View>
        <View style={styles.kidStats}>
          <Text style={[styles.points, { color: kid.color_theme }]}>
            ⚡{kid.total_points.toLocaleString()}
          </Text>
          <Text style={styles.pointsLabel}>pts</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Kids</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push('/(parent)/kids/new')}
        >
          <Text style={styles.addBtnText}>+ Add Kid</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={kids}
        keyExtractor={(k) => k.id}
        renderItem={renderKid}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>👧</Text>
              <Text style={styles.emptyTitle}>No kids yet</Text>
              <Text style={styles.emptyDesc}>Add a kid so they can start earning Crush Points.</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  title: { fontFamily: Fonts.nunitoBlack, fontSize: FontSize.xxl, color: Colors.text },
  addBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
  },
  addBtnText: { fontFamily: Fonts.nunitoBold, fontSize: FontSize.sm, color: Colors.text },
  list: { padding: Spacing.lg, gap: Spacing.sm },
  kidCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  kidInfo: { flex: 1, gap: 4 },
  kidName: { fontFamily: Fonts.nunitoBold, fontSize: FontSize.lg, color: Colors.text },
  kidUsername: { fontFamily: Fonts.inter, fontSize: FontSize.xs, color: Colors.textMuted },
  kidStats: { alignItems: 'flex-end' },
  points: { fontFamily: Fonts.nunitoBlack, fontSize: FontSize.xl },
  pointsLabel: { fontFamily: Fonts.inter, fontSize: FontSize.xs, color: Colors.textMuted },
  empty: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.sm },
  emptyEmoji: { fontSize: 56 },
  emptyTitle: { fontFamily: Fonts.nunitoBlack, fontSize: FontSize.xl, color: Colors.text },
  emptyDesc: { fontFamily: Fonts.inter, fontSize: FontSize.md, color: Colors.textMuted, textAlign: 'center' },
});
