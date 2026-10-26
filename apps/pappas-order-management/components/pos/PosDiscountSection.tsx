import { ActionButton as Button } from '@/components/ui/ActionButton';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { designTokens as t } from '@/lib/redesign';

type Props = {
  discountLabel: string;
  discountAmount: number;
  activeDiscountPercent: number | null;
  onSelectPreset: (percent: number) => void;
  onOpenMore: () => void;
};
/** Every discount mode and preset lives in the shared discount editor. */
export function PosDiscountSection({ discountLabel, discountAmount, onOpenMore }: Props) {
  return <View style={s.row}><View style={s.label}><Text style={s.title}>Discount</Text>{discountAmount > 0 && <Text style={s.applied}>{discountLabel} · −${discountAmount.toFixed(2)}</Text>}</View><Button mode="outlined" onPress={onOpenMore} contentStyle={{ minHeight: 48 }} textColor={t.color.text}>{discountAmount > 0 ? 'Edit discount' : 'Add discount'}</Button></View>;
}
const s = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, paddingVertical: 6 }, label: { flex: 1, gap: 4 }, title: { fontSize: 18, fontWeight: '700', color: t.color.text }, applied: { fontSize: 14, color: t.color.primaryPressed } });
