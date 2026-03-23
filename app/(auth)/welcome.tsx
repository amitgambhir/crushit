import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Linking,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { Colors, Fonts, FontSize, Spacing } from '@/constants/theme';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Logo / Hero */}
        <View style={styles.hero}>
          <Image source={require('@/assets/adaptive-icon.png')} style={styles.logo} />
          <Text style={styles.appName}>CrushIt</Text>
          <Text style={styles.tagline}>Crush tasks. Earn rewards. Repeat.</Text>
        </View>

        {/* CTAs */}
        <View style={styles.actions}>
          <Button
            label="Create a Family"
            onPress={() => router.push('/(auth)/sign-up')}
            variant="primary"
            size="lg"
          />

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.divider} />
          </View>

          <Button
            label="Sign In"
            onPress={() => router.push('/(auth)/sign-in')}
            variant="secondary"
            size="lg"
          />

          <Button
            label="I'm a Kid"
            onPress={() => router.push('/(auth)/kid-login')}
            variant="ghost"
            size="md"
            style={styles.kidButton}
          />
        </View>

        {/* Privacy note */}
        <Text style={styles.privacyNote}>
          Your privacy is protected ·{' '}
          <Text
            style={styles.privacyLink}
            onPress={() => Linking.openURL('https://crushitapp.com/privacy')}
          >
            crushitapp.com/privacy
          </Text>
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    justifyContent: 'space-between',
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.lg,
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  logo: {
    width: 180,
    height: 180,
  },
  appName: {
    fontFamily: Fonts.nunitoBlack,
    fontSize: 52,
    lineHeight: 60,
    color: Colors.text,
    letterSpacing: -0.5,
    paddingRight: 6,
  },
  tagline: {
    fontFamily: Fonts.nunitoSemibold,
    fontSize: FontSize.lg,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  actions: {
    gap: Spacing.sm,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginVertical: Spacing.xs,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    fontFamily: Fonts.inter,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  kidButton: {
    marginTop: Spacing.xs,
  },
  privacyNote: {
    fontFamily: Fonts.inter,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.lg,
  },
  privacyLink: {
    color: Colors.primary,
  },
});
