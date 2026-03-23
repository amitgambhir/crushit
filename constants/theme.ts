// Design tokens matching SPEC.md §Design System & UI/UX
// Mirror of tailwind.config.js — use this file in StyleSheet.create() contexts.

export const Colors = {
  primary: '#FF5722',    // electric orange — "crush energy"
  secondary: '#FFD600',  // lightning yellow — Crush Points/coins
  success: '#00C853',    // task crushed
  warning: '#FF9800',    // due soon, streak at risk
  danger: '#FF1744',     // overdue, expired
  background: '#0F0F0F', // near-black — default dark bg
  surface: '#1C1C1C',    // dark cards
  surface2: '#2A2A2A',   // elevated cards
  text: '#FFFFFF',
  textMuted: '#9E9E9E',
  border: '#333333',

  // 12 bold per-kid accent options (parent/kid can pick one)
  kidAccents: [
    '#6C63FF', // violet (default)
    '#FF5722', // orange
    '#FFD600', // yellow
    '#00C853', // green
    '#00BCD4', // cyan
    '#E91E63', // pink
    '#9C27B0', // purple
    '#3F51B5', // indigo
    '#FF9800', // amber
    '#F44336', // red
    '#4CAF50', // lime green
    '#009688', // teal
  ],
} as const;

export const Fonts = {
  nunito: 'Nunito_400Regular',
  nunitoSemibold: 'Nunito_600SemiBold',
  nunitoBold: 'Nunito_700Bold',
  nunitoExtrabold: 'Nunito_800ExtraBold',
  nunitoBlack: 'Nunito_900Black',
  inter: 'Inter_400Regular',
  interMedium: 'Inter_500Medium',
  interSemibold: 'Inter_600SemiBold',
  interBold: 'Inter_700Bold',
  mono: 'JetBrainsMono_400Regular',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const FontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
  display: 36,
  hero: 48,
} as const;
