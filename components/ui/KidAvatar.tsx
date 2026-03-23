import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Emoji } from '@/components/ui/Emoji';
import { Colors, Radius } from '@/constants/theme';

interface KidAvatarProps {
  avatarUrl?: string | null;
  avatarEmoji?: string;
  colorTheme?: string;
  size?: number;
  level?: number;
}

export function KidAvatar({
  avatarUrl,
  avatarEmoji = '⭐',
  colorTheme = Colors.kidAccents[0],
  size = 48,
  level,
}: KidAvatarProps) {
  const ringSize = size + 6;
  const fontSize = size * 0.55;

  return (
    <View style={[styles.wrapper, { width: ringSize, height: ringSize }]}>
      {/* Accent colour ring */}
      <View
        style={[
          styles.ring,
          { width: ringSize, height: ringSize, borderRadius: ringSize / 2, borderColor: colorTheme },
        ]}
      />
      {/* Avatar */}
      <View
        style={[
          styles.avatar,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: Colors.surface2 },
        ]}
      >
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={{ width: size, height: size, borderRadius: size / 2 }} />
        ) : (
          <Emoji size={fontSize}>{avatarEmoji}</Emoji>
        )}
      </View>
      {/* Level badge */}
      {level !== undefined && (
        <View style={[styles.levelBadge, { backgroundColor: colorTheme }]}>
          <Text style={styles.levelText}>{level}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  ring: {
    position: 'absolute',
    borderWidth: 2.5,
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  levelBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: Colors.background,
  },
  levelText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
  },
});
