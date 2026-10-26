import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Icon } from 'react-native-paper';
import { EditorSheet, FormField } from '@/components/ui';
import { ActionButton as Button } from '@/components/ui/ActionButton';
import { designTokens as t } from '@/lib/redesign';
type Props = { visible: boolean; value: string; onDismiss: () => void; onSave: (value: string) => void; renderInline?: boolean };
const keys = ['1','2','3','4','5','6','7','8','9','03','0','back'];
export function PosPhoneInputModal({ visible, value, onDismiss, onSave }: Props) {
  const [draft, setDraft] = useState(value || '04');
  useEffect(() => { if (visible) setDraft(value || '04'); }, [visible, value]);
  const valid = /^(?:0[34]\d{8}|61[34]\d{8})$/.test(draft.replace(/\D/g, ''));
  return <EditorSheet visible={visible} title="Customer phone" onDismiss={onDismiss} footer={<><Button mode="outlined" onPress={onDismiss}>Cancel</Button><Button mode="contained" disabled={!valid} onPress={() => onSave(draft)}>Use phone number</Button></>}>
    <FormField label="Phone number" value={draft} keyboardType="phone-pad" onChangeText={setDraft} />
    <View style={{ gap: 8 }}>{[0,1,2,3].map(row => <View key={row} style={{ flexDirection: 'row', gap: 8 }}>{keys.slice(row*3,row*3+3).map(key => <Pressable key={key} accessibilityRole="button" accessibilityLabel={key === 'back' ? 'Backspace' : key} onPress={() => setDraft(current => key === 'back' ? current.slice(0,-1) : key === '03' ? key : current + key)} style={{ flex: 1, minHeight: 62, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: t.color.border, borderRadius: 8, backgroundColor: t.color.surface }}>{key === 'back' ? <Icon source="backspace-outline" size={20} color={t.color.text} /> : <Text style={{ color: t.color.text, fontSize: 24, fontWeight: '700' }}>{key}</Text>}</Pressable>)}</View>)}</View>
    <Button compact onPress={() => setDraft('')}>Clear number</Button>
  </EditorSheet>;
}
