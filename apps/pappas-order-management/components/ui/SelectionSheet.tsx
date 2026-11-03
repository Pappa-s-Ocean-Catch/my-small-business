import { ActionButton as Button } from '@/components/ui/ActionButton';
import React, { useEffect, useRef } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { EditorSheet } from './EditorSheet';
import { designTokens as t } from '@/lib/redesign';

export type SheetSelection = {
  title: string;
  value: string;
  options: { value: string; label: string; description?: string; disabled?: boolean }[];
  onSelect: (value: string) => void;
};

/** A single choice applies immediately; Cancel always leaves the current value unchanged. */
export function SelectionSheet({ selection, onDismiss, deferSelectionUntilDismissed = false }: { selection: SheetSelection | null; onDismiss: () => void; deferSelectionUntilDismissed?: boolean }) {
  const choosing = useRef(false);
  const pendingSelection = useRef<(() => void) | null>(null);
  const finishDismissal = () => {
    const select = pendingSelection.current;
    pendingSelection.current = null;
    select?.();
  };
  const visible = !!selection;
  useEffect(() => { if (!visible) choosing.current = false; }, [visible]);
  const choose = (option: NonNullable<SheetSelection>['options'][number]) => {
    if (!selection || option.disabled || choosing.current) return;
    choosing.current = true;
    try {
      // UIKit cannot present the next modal while this native controller is closing.
      if (deferSelectionUntilDismissed && Platform.OS === 'ios') {
        pendingSelection.current = () => selection.onSelect(option.value);
        onDismiss();
        return;
      }
      selection.onSelect(option.value);
      onDismiss();
    } catch (error) {
      choosing.current = false;
      throw error;
    }
  };
  return <EditorSheet visible={visible} title={selection?.title || 'Choose an option'} onDismiss={onDismiss} onDismissed={finishDismissal} footer={<Button mode="outlined" contentStyle={{ minHeight: 48 }} onPress={onDismiss}>Cancel</Button>}>
    <View style={{ gap: 10 }}>{selection?.options.map(option => <Pressable key={option.value} accessibilityRole="button" accessibilityLabel={option.label} accessibilityHint={option.description} accessibilityState={{ disabled: !!option.disabled }} disabled={option.disabled} onPress={() => choose(option)} style={({ pressed }) => ({ minHeight: 54, padding: 14, gap: 4, borderRadius: t.radius.control, borderWidth: 1, borderColor: t.color.border, backgroundColor: t.color.surface, opacity: option.disabled ? 0.45 : pressed ? 0.75 : 1 })}><Text style={{ color: t.color.text, fontSize: 16, fontWeight: '700' }}>{option.label}</Text>{option.description && <Text style={{ color: t.color.muted, fontSize: 13 }}>{option.description}</Text>}</Pressable>)}</View>
  </EditorSheet>;
}
