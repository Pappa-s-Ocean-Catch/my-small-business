import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { AppNavigation } from '@/components/navigation/AppNavigation';
import { designTokens as t } from '@/lib/redesign';

/** Shared chrome for stack routes such as POS and catalogue editors. */
export function WorkspaceShell({ children, onNavigate }: { children: React.ReactNode; onNavigate?: () => void }) {
  const { width } = useWindowDimensions();
  const compact = width < 600;
  return <View style={[s.shell, { flexDirection: compact ? 'column' : 'row' }]}>
    {!compact && <AppNavigation onNavigate={onNavigate} />}
    <View style={s.content}>{children}</View>
    {compact && <AppNavigation onNavigate={onNavigate} />}
  </View>;
}
const s = StyleSheet.create({
  shell: { flex: 1, minWidth: 0, backgroundColor: t.color.background },
  content: { flex: 1, minWidth: 0, overflow: 'hidden' },
});
