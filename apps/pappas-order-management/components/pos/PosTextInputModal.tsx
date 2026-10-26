import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { EditorSheet, FormField } from '@/components/ui';
import { ActionButton as Button } from '@/components/ui/ActionButton';
type Props = { visible: boolean; title: string; value: string; onDismiss: () => void; onSave: (value: string) => void; placeholder?: string; extraKeys?: string[]; renderInline?: boolean };
export function PosTextInputModal({ visible, title, value, onDismiss, onSave, placeholder = 'Customer name', extraKeys = [] }: Props) {
  const [draft, setDraft] = useState(value);
  useEffect(() => { if (visible) setDraft(value); }, [visible, value]);
  return <EditorSheet visible={visible} title={title.replace(/^Enter /i, '')} onDismiss={onDismiss} footer={<><Button mode="outlined" onPress={onDismiss}>Cancel</Button><Button mode="contained" disabled={!draft.trim()} onPress={() => onSave(draft.trim())}>Use name</Button></>}>
    <FormField label="Customer name" value={draft} placeholder={placeholder} autoFocus autoCapitalize="words" onChangeText={setDraft} onSubmitEditing={() => { if (draft.trim()) onSave(draft.trim()); }} />
    {!!extraKeys.length && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{extraKeys.map(key => <Button key={key} onPress={() => setDraft(v => v + key)}>{key}</Button>)}</View>}
  </EditorSheet>;
}
