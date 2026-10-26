import { MD3LightTheme } from 'react-native-paper';
import { designTokens as t } from './redesign';
export const pappasTheme = {
  ...MD3LightTheme,
  roundness: t.radius.control / 4,
  fonts: { ...MD3LightTheme.fonts, labelLarge: { ...MD3LightTheme.fonts.labelLarge, fontSize: 16, fontWeight: '700' as const, letterSpacing: 0 } },
  colors: {
    ...MD3LightTheme.colors,
    primary: t.color.primary, onPrimary: t.color.surface, primaryContainer: t.color.primaryTint, onPrimaryContainer: t.color.primaryPressed,
    secondary: t.color.navy, secondaryContainer: t.color.navyTint, onSecondaryContainer: t.color.navy,
    background: t.color.background, onBackground: t.color.text, surface: t.color.surface, onSurface: t.color.text,
    surfaceVariant: t.color.background, onSurfaceVariant: t.color.muted, outline: t.color.border, outlineVariant: t.color.border,
    error: t.color.danger, errorContainer: t.color.dangerTint, onErrorContainer: t.color.danger,
    inverseSurface: t.color.navy, inverseOnSurface: t.color.surface,
    elevation: { level0: 'transparent', level1: t.color.surface, level2: t.color.surface, level3: t.color.surface, level4: t.color.surface, level5: t.color.surface },
  },
};
