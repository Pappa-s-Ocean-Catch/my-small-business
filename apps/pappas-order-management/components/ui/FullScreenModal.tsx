import React, { useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { IconButton } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppModal } from './AppModal';
import { useModalFocus } from '@/hooks/useModalFocus';
import { designTokens as t } from '@/lib/redesign';

type HeaderProps = {
  title: string;
  subtitle?: React.ReactNode;
  onClose: () => void;
  closeLabel?: string;
  closeIcon?: string;
  disabled?: boolean;
  actions?: React.ReactNode;
};
/** Full-screen details and waiting screens share the established dark header. */
export function FullScreenModalHeader({ title, subtitle, onClose, closeLabel = 'Close details', closeIcon = 'close', disabled, actions }: HeaderProps) {
  const insets = useSafeAreaInsets();
  return <View style={[s.header, { paddingTop: insets.top + 12 }]}>
    <View style={s.heading}><Text accessibilityRole="header" style={s.title}>{title}</Text>{typeof subtitle === 'string' ? <Text style={s.subtitle}>{subtitle}</Text> : subtitle}</View>
    {actions}
    <IconButton icon={closeIcon} accessibilityLabel={closeLabel} iconColor="#f8fafc" disabled={disabled} onPress={onClose} style={s.close} />
  </View>;
}
export function FullScreenModal({ visible, children, footer, ...header }: HeaderProps & { visible: boolean; children: React.ReactNode; footer?: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const panel = useRef<View>(null);
  useModalFocus(panel, visible, header.onClose);
  return <AppModal visible={visible} transparent={false} presentationStyle="fullScreen" animationType="slide" onRequestClose={header.onClose}>
    <View ref={panel} accessibilityViewIsModal style={[s.screen, { paddingBottom: insets.bottom }]}>
      <FullScreenModalHeader {...header} />
      {children}
      {footer}
    </View>
  </AppModal>;
}
const s = StyleSheet.create({
  screen: { flex: 1, minHeight: 0, backgroundColor: t.color.background },
  header: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 12, backgroundColor: '#10243f', borderBottomWidth: 1, borderBottomColor: '#183457' },
  heading: { flex: 1, minWidth: 0, gap: 4 },
  title: { fontSize: 24, fontWeight: '800', color: '#f8fafc' },
  subtitle: { fontSize: 14, lineHeight: 20, color: '#b9c8dd' },
  close: { margin: 0, width: 48, height: 48, backgroundColor: '#ffffff14' },
});
