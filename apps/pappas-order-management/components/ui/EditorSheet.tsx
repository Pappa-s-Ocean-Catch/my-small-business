import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Alert, findNodeHandle, Keyboard, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Button, IconButton, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useModalFocus } from '@/hooks/useModalFocus';
import { ActionButton } from './ActionButton';
import { designTokens as t } from '@/lib/redesign';

type Props = {
  visible: boolean;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode | ((requestDismiss: () => void) => React.ReactNode);
  onDismiss: () => void;
  dirty?: boolean;
  pending?: boolean;
  size?: 'confirm' | 'form' | 'wide';
};

/** Native editor with a scrolling body and actions that stay above the keyboard. */
export function EditorSheet({ visible, title, subtitle, children, footer, onDismiss, dirty = false, pending = false, size = 'form' }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const heading = useRef<View>(null);
  const panel = useRef<View>(null);
  const compact = width < 600;
  useEffect(() => { if (pending) Keyboard.dismiss(); }, [pending]);
  const dismiss = () => {
    if (pending) return;
    if (dirty) {
      if (Platform.OS === 'web') {
        if (window.confirm('Discard changes? Your changes have not been saved.')) onDismiss();
        return;
      }
      Alert.alert('Discard changes?', 'Your changes have not been saved.', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard changes', style: 'destructive', onPress: onDismiss },
      ]);
    } else onDismiss();
  };
  useModalFocus(panel, visible, dismiss);
  const focusTitle = () => {
    const handle = findNodeHandle(heading.current);
    if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
  };
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(focusTitle, 180);
    return () => clearTimeout(timer);
  }, [visible]);
  const footerControls = (node: React.ReactNode): React.ReactNode => React.Children.map(node, child => {
    if (!React.isValidElement(child)) return child;
    const element = child as React.ReactElement<any>;
    if (element.type === React.Fragment) return React.cloneElement(element, {}, footerControls(element.props.children));
    if (element.type === Button || element.type === ActionButton) return React.cloneElement(element, { style: [{ minWidth: compact ? 0 : 120, borderRadius: 10, ...(compact ? { flexGrow: 1, flexBasis: 120 } : {}) }, element.props.style], contentStyle: [{ minHeight: 48 }, element.props.contentStyle] });
    return child;
  });
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss} onShow={focusTitle} statusBarTranslucent>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[s.scrim, Platform.OS === 'web' && ({ backdropFilter: 'blur(3px)' } as any), { paddingTop: compact ? insets.top : 32, paddingBottom: compact ? insets.bottom : 32, paddingHorizontal: compact ? 0 : 32 }]}>
      <View ref={panel} accessibilityViewIsModal importantForAccessibility="yes" style={[s.sheet, { maxWidth: compact ? undefined : size === 'wide' ? 920 : size === 'confirm' ? 460 : 620, maxHeight: height - (compact ? insets.top + insets.bottom : 64) }, compact && s.compact]}>
        <View style={s.header}>
          <View ref={heading} accessible accessibilityRole="header" accessibilityLabel={title} style={s.heading}><Text style={s.title}>{title}</Text>{subtitle && <Text style={s.subtitle}>{subtitle}</Text>}</View>
          <IconButton icon="close" accessibilityLabel={`Close ${title}`} onPress={dismiss} disabled={pending} size={22} hitSlop={4} style={s.close} />
        </View>
        <ScrollView pointerEvents={pending ? 'none' : 'auto'} keyboardShouldPersistTaps="handled" contentContainerStyle={s.body} style={[s.scroll, compact && { flex: 1 }]}>{children}</ScrollView>
        {footer && <View style={s.footer}>{footerControls(typeof footer === 'function' ? footer(dismiss) : footer)}</View>}
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}
const s = StyleSheet.create({
  scrim: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.color.scrim },
  sheet: { width: '100%', backgroundColor: '#F7F9F8', borderRadius: t.radius.dialog, overflow: 'hidden', flexShrink: 1 },
  compact: { flex: 1, borderRadius: 0 },
  header: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 18, minHeight: 64, backgroundColor: t.color.surface, gap: 16, borderBottomWidth: 1, borderBottomColor: t.color.border },
  heading: { flex: 1, minWidth: 0, gap: 4 }, title: { fontSize: 19, color: t.color.text, fontWeight: '700' }, subtitle: { fontSize: 14, lineHeight: 21, color: t.color.muted },
  close: { margin: 0, width: 40, height: 40, borderRadius: 20, backgroundColor: '#F0F4F3' }, scroll: { flexShrink: 1 }, body: { padding: 18, gap: 16 },
  footer: { paddingVertical: 18, paddingHorizontal: 26, backgroundColor: t.color.surface, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: t.color.border },
});
