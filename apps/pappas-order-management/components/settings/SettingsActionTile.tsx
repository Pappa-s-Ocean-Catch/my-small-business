import React from 'react';
import { Pressable, StyleSheet, View, Text } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { designTokens as t } from '@/lib/redesign';
type SettingsActionTileProps = { title: string; description?: string; icon?: string; last?: boolean; onPress: () => void };
export function SettingsActionTile({ title, description, onPress, last = false }: SettingsActionTileProps) {
  return <Pressable accessibilityRole="button" accessibilityLabel={description ? `${title}, ${description}` : title} onPress={onPress} style={[s.tile, last && { borderBottomWidth: 0 }]}><View style={{ flex: 1, gap: 4 }}><Text style={s.title}>{title}</Text>{description && <Text style={s.description}>{description}</Text>}</View><View style={s.arrow}><MaterialCommunityIcons name="chevron-right" size={22} color={t.color.text} /></View></Pressable>;
}
const s = StyleSheet.create({ tile: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderColor: t.color.border, paddingVertical: 12 }, title: { fontSize: 16, fontWeight: '700', color: t.color.text }, description: { fontSize: 14, lineHeight: 21, color: t.color.muted }, arrow: { width: 52, height: 48, borderRadius: 10, borderWidth: 1, borderColor: t.color.border, alignItems: 'center', justifyContent: 'center' } });
