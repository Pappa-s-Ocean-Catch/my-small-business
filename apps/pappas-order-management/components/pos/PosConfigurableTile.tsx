import { tileBorderColor } from '@/lib/pos-tile-palette';
import React from 'react';
import { Pressable, StyleSheet, Text, View, type TextStyle } from 'react-native';
import { designTokens as t } from '@/lib/redesign';
import { resolvePosTileAppearance, type PosLayoutData, type PosTileConfig, type PosTileAppearance } from '@/lib/pos-layout-config';
type Props = { label: string; subtitle?: string; columns: number; layout?: PosLayoutData | null; tileConfig?: PosTileConfig; fallbackAppearance?: PosTileAppearance; onPress?: () => void; preview?: boolean; accessibilityLabel?: string; quantity?: number; footer?: React.ReactNode; variant?: 'group' | 'product'; selected?: boolean };
export function PosConfigurableTile({ label, subtitle, columns, layout, tileConfig, fallbackAppearance, onPress, preview, accessibilityLabel, quantity = 0, footer, variant = 'group', selected = false }: Props) {
  const a = resolvePosTileAppearance(layout, tileConfig, fallbackAppearance);
  const borderColor = variant === 'product' ? tileBorderColor(a.background) : t.color.border;
  const textStyle = { color: a.text, fontSize: a.fontSize, fontWeight: a.fontWeight as TextStyle['fontWeight'], textAlign: a.align };
  return <Pressable disabled={preview && !onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel || a.label || label} accessibilityState={{ disabled: !!preview && !onPress }} onPress={onPress} style={({ pressed }) => [s.tile, { maxWidth: `${100 / columns}%`, minHeight: a.height, borderColor, borderLeftWidth: variant === 'group' ? 4 : 1, borderLeftColor: variant === 'group' ? '#9CC6BF' : borderColor, borderTopWidth: variant === 'product' ? 3 : 1, borderTopColor: borderColor, ...(selected ? { borderColor: t.color.primary, borderWidth: 2 } : {}), backgroundColor: a.background, opacity: a.visible ? pressed ? 0.75 : 1 : 0.45 }, !a.visible && { borderStyle: 'dashed' }]}>
    <View style={s.content}>
      <View style={s.heading}><Text style={[s.name, textStyle, quantity > 0 && { paddingHorizontal: 16 }]}>{a.label || label}</Text></View>
      {!!subtitle && <View style={s.subtitle}><Text style={{ width: '100%', paddingHorizontal: variant === 'group' ? 18 : 0, color: a.text, fontSize: 12, textAlign: a.align }}>{subtitle}</Text>{variant === 'group' && <Text style={{ position: 'absolute', right: 0, color: a.text, fontWeight: '700' }}>→</Text>}</View>}
    </View>
    {quantity > 0 && <Text style={[s.quantity, { color: t.color.primaryPressed }]}>{quantity}</Text>}
    {!a.visible && <Text style={{ color: a.text, fontSize: 12 }}>Hidden</Text>}
    {footer && <View style={s.footer}>{footer}</View>}
  </Pressable>;
}
export const PosGroupTile = PosConfigurableTile;
const s = StyleSheet.create({ tile: { flex: 1, minWidth: 0, margin: 5, paddingVertical: 12, paddingHorizontal: 14, gap: 7, borderWidth: 1, borderColor: t.color.border, borderRadius: t.radius.card }, content: { flex: 1, justifyContent: 'center', gap: 7 }, heading: { minHeight: 36, justifyContent: 'center', alignItems: 'center' }, name: { width: '100%' }, subtitle: { flexDirection: 'row', alignItems: 'center' }, quantity: { position: 'absolute', top: 6, right: 6, padding: 4, borderRadius: 6, backgroundColor: t.color.primaryTint, fontSize: 12, fontWeight: '700' }, footer: { marginTop: 'auto', paddingTop: 10 } });
