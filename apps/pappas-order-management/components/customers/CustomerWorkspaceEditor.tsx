import React, { useEffect, useRef } from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppNavigation } from '@/components/navigation/AppNavigation';
import { ActionButton } from '@/components/ui/ActionButton';
import { WorkspaceHeader } from '@/components/ui';
import { useModalFocus } from '@/hooks/useModalFocus';
import { designTokens as t } from '@/lib/redesign';

type Props = {
  visible: boolean;
  title: string;
  children: React.ReactNode;
  footer: (dismiss: () => void) => React.ReactNode;
  onDismiss: () => void;
  dirty: boolean;
  pending: boolean;
};

/** Workspace-sized customer form that stays in its caller's native modal stack. */
export function CustomerWorkspaceEditor({ visible, title, children, footer, onDismiss, dirty, pending }: Props) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const panel = useRef<View>(null);
  const dismiss = () => {
    if (pending) return;
    if (!dirty) { onDismiss(); return; }
    if (Platform.OS === 'web') {
      if (window.confirm('Discard changes? Your changes have not been saved.')) onDismiss();
    } else {
      Alert.alert('Discard changes?', 'Your changes have not been saved.', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard changes', style: 'destructive', onPress: onDismiss },
      ]);
    }
  };
  useModalFocus(panel, visible, dismiss);
  useEffect(() => { if (pending) Keyboard.dismiss(); }, [pending]);
  const gutter = width < 1100 ? 12 : 16;
  const footerControls = (node: React.ReactNode): React.ReactNode => React.Children.map(node, child => {
    if (!React.isValidElement(child)) return child;
    const element = child as React.ReactElement<any>;
    if (element.type === React.Fragment) return React.cloneElement(element, {}, footerControls(element.props.children));
    if (element.type === ActionButton) return React.cloneElement(element, { style: [width < 600 ? { flexGrow: 1, flexBasis: 120, minWidth: 0 } : { minWidth: 120 }, element.props.style], contentStyle: [{ minHeight: 48 }, element.props.contentStyle] });
    return child;
  });
  return <Modal visible={visible} animationType="slide" onRequestClose={dismiss}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[s.root, { paddingTop: insets.top }]}>
      {/* The modal owns dismissal; the underlying navigation cannot leave a dirty form. */}
      {width >= 600 && <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={s.rail}><AppNavigation /></View>}
      <View ref={panel} accessibilityViewIsModal style={s.workspace}>
        <WorkspaceHeader title={title} showProfile={false} onBack={dismiss} />
        <ScrollView keyboardShouldPersistTaps="handled" style={s.scroll} contentContainerStyle={{ padding: gutter }}>
          <View pointerEvents={pending ? 'none' : 'auto'} style={s.form}>{children}</View>
          <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>{footerControls(footer(dismiss))}</View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}
const s = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: t.color.background },
  rail: { flexDirection: 'row' },
  workspace: { flex: 1, minWidth: 0 },
  scroll: { flex: 1 },
  form: { width: '100%', maxWidth: 940, padding: 20, gap: 20, backgroundColor: t.color.surface, borderRadius: 16, borderWidth: 1, borderColor: t.color.border },
  footer: { flexShrink: 0, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 12, paddingTop: 42, backgroundColor: t.color.background },
});
