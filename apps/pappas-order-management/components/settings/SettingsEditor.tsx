import React from 'react';
import { ActionButton as Button } from '@/components/ui/ActionButton';
import { EditorSheet } from '@/components/ui/EditorSheet';

/** Settings forms share the same sizing, keyboard handling and action bar as other editors. */
export function SettingsEditor({ visible, title, onCancel, onDone, children, pending = false, primaryLabel = 'Done', primaryDisabled = false }: {
  visible: boolean; page: boolean; title: string; onCancel: () => void; onDone: () => void; children: React.ReactNode; pending?: boolean; primaryLabel?: string; primaryDisabled?: boolean; wide?: boolean;
}) {
  return <EditorSheet visible={visible} title={title} onDismiss={onCancel} pending={pending} footer={<>
    <Button mode="outlined" disabled={pending} onPress={onCancel}>Cancel</Button>
    <Button mode="contained" loading={pending} disabled={pending || primaryDisabled} onPress={onDone}>{primaryLabel}</Button>
  </>}>{children}</EditorSheet>;
}
