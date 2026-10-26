import React from 'react';
import { Button as PaperButton } from 'react-native-paper';
import { designTokens as t } from '@/lib/redesign';

/** Reference secondary buttons are white with dark labels; action colours remain explicit. */
export function ActionButton({ mode = 'text', style, contentStyle, textColor, buttonColor, ...props }: React.ComponentProps<typeof PaperButton>) {
  return <PaperButton {...props} mode={mode} textColor={textColor ?? (mode === 'contained' || mode === 'contained-tonal' ? undefined : t.color.text)} buttonColor={buttonColor ?? (mode === 'outlined' ? t.color.surface : undefined)} style={[{ borderRadius: t.radius.control }, style]} contentStyle={[{ minHeight: 48 }, contentStyle]} />;
}
