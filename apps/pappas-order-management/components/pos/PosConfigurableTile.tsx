import React from 'react';
import { Pressable, StyleSheet, Text, View, type TextStyle } from 'react-native';
import { designTokens as t } from '@/lib/redesign';
import { resolvePosTileAppearance, type PosLayoutData, type PosTileConfig } from '@/lib/pos-layout-config';
type Props = { label: string; subtitle?: string; columns: number; layout?: PosLayoutData | null; tileConfig?: PosTileConfig; onPress?: () => void; preview?: boolean; accessibilityLabel?: string; quantity?: number; footer?: React.ReactNode; variant?: 'group' | 'product'; selected?: boolean };
export function PosConfigurableTile({ label, subtitle, columns, layout, tileConfig, onPress, preview, accessibilityLabel, quantity = 0, footer, variant = 'group', selected = false }: Props) {
  const a = resolvePosTileAppearance(layout, tileConfig);
  const textStyle = { color: a.text, fontSize: a.fontSize, fontWeight: a.fontWeight as TextStyle['fontWeight'], textAlign: a.align };
  return <Pressable disabled={preview && !onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel || a.label || label} accessibilityState={{ disabled: !!preview && !onPress }} onPress={onPress} style={({ pressed }) => [s.tile, { maxWidth: `${100 / columns}%`, minHeight: a.height, borderLeftWidth: variant === 'group' ? 4 : 1, borderLeftColor: variant === 'group' ? '#9CC6BF' : t.color.border, borderTopWidth: variant === 'product' ? 3 : 1, borderTopColor: variant === 'product' ? '#D7CBA7' : t.color.border, ...(selected ? { borderColor: t.color.primary, borderWidth: 2 } : {}), backgroundColor: a.background, opacity: a.visible ? pressed ? 0.75 : 1 : 0.45 }, !a.visible && { borderStyle: 'dashed' }]}>
    <View style={s.heading}><Text style={[s.name, textStyle]}>{a.label || label}</Text>{quantity > 0 && <Text style={[s.quantity, { color: a.text }]}>{quantity}</Text>}</View>
    {!!subtitle && <View style={{ marginTop: variant === 'group' ? 'auto' : 0, flexDirection: 'row', alignItems: 'center', gap: 8 }}><Text style={{ flex: 1, color: a.text, fontSize: 12, textAlign: a.align }}>{subtitle}</Text>{variant === 'group' && <Text style={{ color: a.text, fontWeight: '700' }}>→</Text>}</View>}
    {!a.visible && <Text style={{ color: a.text, fontSize: 12 }}>Hidden</Text>}
    {footer && <View style={s.footer}>{footer}</View>}
  </Pressable>;
}
export const PosGroupTile = PosConfigurableTile;
const s = StyleSheet.create({ tile: { flex: 1, minWidth: 0, margin: 5, paddingVertical: 12, paddingHorizontal: 14, gap: 7, borderWidth: 1, borderColor: t.color.border, borderRadius: t.radius.card }, heading: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 }, name: { flex: 1 }, quantity: { padding: 4, borderRadius: 6, backgroundColor: t.color.primaryTint, fontSize: 12, fontWeight: '700' }, footer: { marginTop: 'auto', paddingTop: 10 } });
