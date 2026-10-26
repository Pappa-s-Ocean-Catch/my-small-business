import React, { useState } from 'react';
import { Modal, ScrollView, View, useWindowDimensions } from 'react-native';
import { ActionButton as Button } from '@/components/ui/ActionButton';
import { WorkspaceHeader, Panel } from '@/components/ui';
import { AppNavigation } from '@/components/navigation/AppNavigation';
import { designTokens as t } from '@/lib/redesign';

/** Settings are workspace pages in the latest handoff, including short forms. */
export function SettingsEditor({ visible, page, title, onCancel, onDone, children, pending = false, primaryLabel = 'Done', primaryDisabled = false, wide = true }: {
  visible: boolean; page: boolean; title: string; onCancel: () => void; onDone: () => void; children: React.ReactNode; pending?: boolean; primaryLabel?: string; primaryDisabled?: boolean; wide?: boolean;
}) {
  const { width } = useWindowDimensions();
  const compact = width < 600;
  const [bodyHeight, setBodyHeight] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const sticky = viewportHeight > 0 && bodyHeight + 112 > viewportHeight;
  const cancel = () => { if (!pending) onCancel(); };
  const footer = <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 12 }}><Button mode="outlined" disabled={pending} onPress={cancel}>Cancel</Button><Button mode="contained" loading={pending} disabled={pending || primaryDisabled} onPress={onDone}>{primaryLabel}</Button></View>;
  return <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={cancel}>
    <View style={{ flex: 1, flexDirection: compact ? 'column' : 'row', backgroundColor: t.color.background }}>
      {!compact && <AppNavigation onNavigate={cancel} />}
      <View style={{ flex: 1, minWidth: 0 }}>
        <WorkspaceHeader title={title} showNewOrder={false} />
        <ScrollView onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)} pointerEvents={pending ? 'none' : 'auto'} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: compact ? 12 : 16, gap: 42 }}>
          <View onLayout={(event) => setBodyHeight(event.nativeEvent.layout.height)}>{page ? children : <Panel style={{ width: '100%', maxWidth: wide ? 940 : 620, padding: 20 }}>{children}</Panel>}</View>
          {!sticky && footer}
        </ScrollView>
        {sticky && <View style={{ padding: 12, borderTopWidth: 1, borderColor: t.color.border, backgroundColor: t.color.background }}>{footer}</View>}
      </View>
      {compact && <AppNavigation onNavigate={cancel} />}
    </View>
  </Modal>;
}
