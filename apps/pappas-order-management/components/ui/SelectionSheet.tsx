import { ActionButton as Button } from '@/components/ui/ActionButton';
import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { RadioButton } from 'react-native-paper';
import { EditorSheet } from './EditorSheet';
import { designTokens as t } from '@/lib/redesign';

export type SheetSelection = {
  title: string;
  value: string;
  options: { value: string; label: string }[];
  confirmLabel?: string;
  onSelect: (value: string) => void;
};

/** Stage one selection until the operator explicitly applies it. */
export function SelectionSheet({ selection, onDismiss }: { selection: SheetSelection | null; onDismiss: () => void }) {
  const [value, setValue] = useState('');
  useEffect(() => { if (selection) setValue(selection.value); }, [selection]);
  return <EditorSheet visible={!!selection} title={selection?.title || 'Choose an option'} onDismiss={onDismiss} footer={<><Button mode="outlined" contentStyle={{ minHeight: 48 }} onPress={onDismiss}>Cancel</Button><Button mode="contained" contentStyle={{ minHeight: 48 }} disabled={!selection?.options.some((option) => option.value === value)} onPress={() => { selection?.onSelect(value); onDismiss(); }}>{selection?.confirmLabel || 'Use selection'}</Button></>}>
    <View style={{ gap: 10 }}>{selection?.options.map((option) => <Pressable key={option.value} accessibilityRole="radio" accessibilityLabel={option.label} accessibilityState={{ checked: value === option.value }} onPress={() => setValue(option.value)} style={{ minHeight: 50, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, gap: 8, borderRadius: t.radius.control, borderWidth: 1, borderColor: value === option.value ? t.color.primary : t.color.border, backgroundColor: value === option.value ? t.color.primaryTint : t.color.surface }}><RadioButton.Android value={option.value} status={value === option.value ? 'checked' : 'unchecked'} color={t.color.primary} onPress={() => setValue(option.value)} /><Text style={{ flex: 1, color: t.color.text, fontSize: 16, paddingVertical: 12 }}>{option.label}</Text></Pressable>)}</View>
  </EditorSheet>;
}
