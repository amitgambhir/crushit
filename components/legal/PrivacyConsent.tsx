// Required on the sign-up screen before account creation can proceed.
// See SPEC.md §Privacy Policy & Legal Integration and CLAUDE.md Privacy section.

import React from 'react';
import { View, Text, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, FontSize, Spacing, Radius } from '@/constants/theme';

interface PrivacyConsentProps {
  value: boolean;
  onChange: (value: boolean) => void;
}

const PRIVACY_URL = 'https://amitgambhir.github.io/crushit-legal/';
const TERMS_URL = 'https://amitgambhir.github.io/crushit-legal/terms';

export function PrivacyConsent({ value, onChange }: PrivacyConsentProps) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => onChange(!value)}
      activeOpacity={0.7}
    >
      <View style={[styles.checkbox, value && styles.checkboxChecked]}>
        {value && <Ionicons name="checkmark" size={14} color={Colors.text} />}
      </View>
      <Text style={styles.text}>
        I agree to the{' '}
        <Text
          style={styles.link}
          onPress={() => Linking.openURL(PRIVACY_URL)}
        >
          Privacy Policy
        </Text>
        {' '}and{' '}
        <Text
          style={styles.link}
          onPress={() => Linking.openURL(TERMS_URL)}
        >
          Terms of Service
        </Text>
        {', '}and confirm I am the parent or guardian of any children I add.
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: Radius.sm,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  text: {
    flex: 1,
    fontFamily: Fonts.inter,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    lineHeight: 20,
  },
  link: {
    color: Colors.primary,
    fontFamily: Fonts.interMedium,
  },
});
