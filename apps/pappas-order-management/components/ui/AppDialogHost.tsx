import React, { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AccessibilityInfo, findNodeHandle, Keyboard, Platform, BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { IconButton } from 'react-native-paper';
import { appDialogStore } from '@/lib/app-dialog';
import { designTokens as t } from '@/lib/redesign';
import { useModalFocus } from '@/hooks/useModalFocus';
import { ActionButton } from './ActionButton';

export const DialogLayerContext = createContext(0);
export function useAppDialogHost(visible: boolean, layer: number) {
  const [hostId, setHostId] = useState<number | null>(null);
  const snapshot = useSyncExternalStore(appDialogStore.subscribe, appDialogStore.getSnapshot, appDialogStore.getSnapshot);
  useEffect(() => {
    if (!visible) return;
    const id = appDialogStore.registerHost(layer);
    setHostId(id);
    return () => appDialogStore.unregisterHost(id);
  }, [visible, layer]);
  return { hostId, active: visible && hostId !== null && snapshot.hostId === hostId && !!snapshot.dialog };
}
export function AppDialogOverlay({ hostId }: { hostId: number | null }) {
  const snapshot = useSyncExternalStore(appDialogStore.subscribe, appDialogStore.getSnapshot, appDialogStore.getSnapshot);
  const request = snapshot.hostId === hostId && hostId !== null ? snapshot.dialog : null;
  const panel = useRef<View>(null);
  const heading = useRef<Text>(null);
  useEffect(() => {
    if (!request) return;
    Keyboard.dismiss();
    if (Platform.OS === 'web') return;
    const timer = setTimeout(() => {
      const handle = findNodeHandle(heading.current);
      if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
    }, 150);
    return () => clearTimeout(timer);
  }, [request?.id]);
  useModalFocus(panel, !!request, () => { appDialogStore.dismiss(); });
  useEffect(() => {
    if (!request) return;
    const back = BackHandler.addEventListener('hardwareBackPress', () => { appDialogStore.dismiss(); return true; });
    return () => back.remove();
  }, [request]);
  if (!request) return null;
  const cancel = request.buttons.find(button => button.style === 'cancel');
  const cancellable = !!cancel || request.options.cancelable;
  const choices = request.buttons.filter(button => button.style !== 'cancel').length > 1;
  const action = (button: typeof request.buttons[number], index: number) => <ActionButton key={`${request.id}-${index}`} accessibilityLabel={button.text || 'OK'} mode={button.style === 'cancel' || choices ? 'outlined' : 'contained'} textColor={button.style === 'destructive' ? t.color.danger : undefined} buttonColor={button.style === 'destructive' ? t.color.dangerTint : undefined} style={choices ? s.choice : s.action} contentStyle={{ minHeight: 48 }} onPress={() => { void appDialogStore.choose(request.id, index); }}>{button.text || 'OK'}</ActionButton>;
  return <View style={s.overlay} accessibilityViewIsModal importantForAccessibility="yes" testID="app-dialog-overlay">
    <Pressable style={StyleSheet.absoluteFill} accessible={false} onPress={() => { if (cancellable) appDialogStore.dismiss(); }} />
    <View ref={panel} style={s.panel} accessibilityViewIsModal>
      <View style={s.header}><Text ref={heading} accessibilityRole="header" style={s.title}>{request.title}</Text>{cancellable && <IconButton icon="close" accessibilityLabel={`Close ${request.title}`} onPress={() => { appDialogStore.dismiss(); }} style={s.close} />}</View>
      {!!request.message && <ScrollView style={s.messageScroll} contentContainerStyle={s.messageBody}><Text selectable style={s.message}>{request.message}</Text></ScrollView>}
      {choices ? <>
        <ScrollView style={s.choiceScroll} contentContainerStyle={s.choices} keyboardShouldPersistTaps="handled">{request.buttons.map((button, index) => button.style !== 'cancel' ? action(button, index) : null)}</ScrollView>
        <View style={s.actions}>{request.buttons.map((button, index) => button.style === 'cancel' ? action(button, index) : null)}</View>
      </> : <View style={s.actions}>{request.buttons.map(action)}</View>}
    </View>
  </View>;
}
export function AppDialogHost({ visible = true, layer }: { visible?: boolean; layer?: number }) {
  const inherited = useContext(DialogLayerContext);
  const host = useAppDialogHost(visible, layer ?? inherited);
  return <AppDialogOverlay hostId={host.active ? host.hostId : null} />;
}
/** A focused native-stack route owns dialogs until a native modal above it takes over. */
export function AppDialogScreen({ children }: { children: React.ReactNode }) {
  const focused = useIsFocused();
  const host = useAppDialogHost(focused, 1);
  return <View style={{ flex: 1 }}><View style={{ flex: 1 }} pointerEvents={host.active ? 'none' : 'auto'} accessibilityElementsHidden={host.active} importantForAccessibility={host.active ? 'no-hide-descendants' : 'auto'}>{children}</View><AppDialogOverlay hostId={host.active ? host.hostId : null} /></View>;
}
const s = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 10000, elevation: 10000, backgroundColor: t.color.scrim, alignItems: 'center', justifyContent: 'center', padding: 20 },
  panel: { width: '100%', maxWidth: 560, maxHeight: '90%', backgroundColor: t.color.surface, borderRadius: t.radius.dialog, overflow: 'hidden', flexShrink: 1 },
  header: { minHeight: 64, paddingLeft: 22, paddingRight: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: t.color.border },
  title: { flex: 1, minWidth: 0, fontSize: 20, lineHeight: 27, fontWeight: '700', color: t.color.text },
  close: { margin: 0, width: 40, height: 40, backgroundColor: t.color.background },
  messageScroll: { flexShrink: 1 }, messageBody: { padding: 22 }, message: { fontSize: 16, lineHeight: 24, color: t.color.muted },
  actions: { padding: 20, gap: 12, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end' }, choiceScroll: { flexShrink: 1 }, choices: { padding: 20, gap: 12 }, choice: { width: '100%' }, action: { minWidth: 110, flexGrow: 1 },
});
