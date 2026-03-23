import React from 'react';
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
import { useAuth } from '@/hooks/useAuth';
import { Colors, Fonts, FontSize, Spacing } from '@/constants/theme';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

type FormData = z.infer<typeof schema>;

export default function SignInScreen() {
  const router = useRouter();
  const { signInWithEmail, signInWithApple, isSubmitting, error, clearError } = useAuth();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    clearError();
    await signInWithEmail(data.email, data.password);
    // _layout.tsx routes automatically based on profile.role
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to your parent account.</Text>
        </View>

        <View style={styles.form}>
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
                placeholder="Your password"
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

          {error && <Text style={styles.errorText}>{error}</Text>}

          <Button
            label="Sign In"
            onPress={handleSubmit(onSubmit)}
            isLoading={isSubmitting}
            size="lg"
          />

          {Platform.OS === 'ios' && (
            <>
              <View style={styles.dividerRow}>
                <View style={styles.divider} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.divider} />
              </View>
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                cornerRadius={12}
                style={styles.appleButton}
                onPress={signInWithApple}
              />
            </>
          )}
        </View>

        <TouchableOpacity onPress={() => router.replace('/(auth)/sign-up')} style={styles.footer}>
          <Text style={styles.footerText}>
            New here?{' '}
            <Text style={styles.footerLink}>Create a Family</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  header: { marginBottom: Spacing.xl },
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
  form: { gap: Spacing.xs },
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
  divider: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: {
    fontFamily: Fonts.inter,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  appleButton: { width: '100%', height: 52 },
  footer: { marginTop: Spacing.xl, alignItems: 'center' },
  footerText: { fontFamily: Fonts.inter, fontSize: FontSize.sm, color: Colors.textMuted },
  footerLink: { color: Colors.primary, fontFamily: Fonts.interMedium },
});
