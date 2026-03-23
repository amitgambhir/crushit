import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { PrivacyConsent } from '@/components/legal/PrivacyConsent';
import { useAuth } from '@/hooks/useAuth';
import { Colors, Fonts, FontSize, Spacing } from '@/constants/theme';

const schema = z.object({
  displayName: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters'),
});

type FormData = z.infer<typeof schema>;

export default function SignUpScreen() {
  const router = useRouter();
  const { signUpWithEmail, signInWithApple, isSubmitting, error, clearError } = useAuth();
  const [hasAgreed, setHasAgreed] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    if (!hasAgreed) return;
    clearError();
    await signUpWithEmail(data.email, data.password, data.displayName);
    // _layout.tsx auth guard routes to /(auth)/family-setup automatically
    // once profile exists but family_id is null
  }

  async function handleAppleSignIn() {
    if (!hasAgreed) return;
    clearError();
    await signInWithApple();
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>You'll manage your family from here.</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Controller
            control={control}
            name="displayName"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Your name"
                placeholder="e.g. Sarah"
                leftIcon="person-outline"
                onChangeText={onChange}
                onBlur={onBlur}
                value={value}
                error={errors.displayName?.message}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="next"
              />
            )}
          />
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Email"
                placeholder="you@example.com"
                leftIcon="mail-outline"
                onChangeText={onChange}
                onBlur={onBlur}
                value={value}
                error={errors.email?.message}
                keyboardType="email-address"
                autoCapitalize="none"
                returnKeyType="next"
              />
            )}
          />
          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Password"
                placeholder="8+ characters"
                leftIcon="lock-closed-outline"
                onChangeText={onChange}
                onBlur={onBlur}
                value={value}
                error={errors.password?.message}
                secureTextEntry
                returnKeyType="done"
                onSubmitEditing={handleSubmit(onSubmit)}
              />
            )}
          />

          <PrivacyConsent value={hasAgreed} onChange={setHasAgreed} />

          {error && <Text style={styles.errorText}>{error}</Text>}

          <Button
            label="Create Account"
            onPress={handleSubmit(onSubmit)}
            isLoading={isSubmitting}
            disabled={!hasAgreed}
            size="lg"
          />

          {/* Apple Sign-In (iOS only) */}
          {Platform.OS === 'ios' && (
            <>
              <View style={styles.dividerRow}>
                <View style={styles.divider} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.divider} />
              </View>
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                cornerRadius={12}
                style={styles.appleButton}
                onPress={handleAppleSignIn}
              />
              {!hasAgreed && (
                <Text style={styles.appleHint}>
                  Agree to the Privacy Policy above to enable Sign in with Apple.
                </Text>
              )}
            </>
          )}
        </View>

        {/* Footer */}
        <TouchableOpacity onPress={() => router.replace('/(auth)/sign-in')} style={styles.footer}>
          <Text style={styles.footerText}>
            Already have an account?{' '}
            <Text style={styles.footerLink}>Sign In</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  header: {
    marginBottom: Spacing.xl,
  },
  backText: {
    fontFamily: Fonts.interMedium,
    fontSize: FontSize.md,
    color: Colors.primary,
    marginBottom: Spacing.lg,
  },
  title: {
    fontFamily: Fonts.nunitoBlack,
    fontSize: FontSize.xxl,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontFamily: Fonts.inter,
    fontSize: FontSize.md,
    color: Colors.textMuted,
  },
  form: {
    flex: 1,
    gap: Spacing.xs,
  },
  errorText: {
    fontFamily: Fonts.inter,
    fontSize: FontSize.sm,
    color: Colors.danger,
    marginBottom: Spacing.sm,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginVertical: Spacing.md,
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
  appleButton: {
    width: '100%',
    height: 52,
  },
  appleHint: {
    fontFamily: Fonts.inter,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  footer: {
    marginTop: Spacing.xl,
    alignItems: 'center',
  },
  footerText: {
    fontFamily: Fonts.inter,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  footerLink: {
    color: Colors.primary,
    fontFamily: Fonts.interMedium,
  },
});
