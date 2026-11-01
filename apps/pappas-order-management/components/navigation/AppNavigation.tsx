import React, { useState } from 'react';
import { JournalLogsModal } from '@/components/PrintLogsModal';
import { JOURNAL_LOGS_ENABLED } from '@/lib/journal-config';
import { ScrollView, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { HeaderStrokeIcon } from '@/components/ui';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { designTokens as t, getWindowSizeClass } from '@/lib/redesign';

/** Shared chrome; navigate retains existing screens (including a mounted POS draft). */
export function AppNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const [showJournal, setShowJournal] = useState(false);
  const { width } = useWindowDimensions();
  const compact = getWindowSizeClass(width) === 'compact';
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();
  const entries = [
    { label: 'Orders', icon: 'clipboard-text-outline', href: '/(drawer)/(tabs)/live-orders', selected: /live-orders|on-the-way|completed|pre-orders|\/orders$/.test(pathname) },
    { label: 'Take order', icon: 'monitor', href: '/pos', selected: pathname === '/pos' },
    { label: 'Customers', icon: 'account-group-outline', href: '/customers', selected: pathname.startsWith('/customers') },
    { label: 'Reports', icon: 'chart-bar', href: '/report', selected: pathname === '/report' },
    { label: 'More', icon: 'menu', href: '/more', selected: (compact || pathname !== '/settings') && !/live-orders|on-the-way|completed|pre-orders|\/orders$|\/pos$|\/customers|\/report$/.test(pathname) },
    ...(!compact && JOURNAL_LOGS_ENABLED ? [{ label: 'Journal', icon: 'text-box-search-outline', href: '', selected: false }] : []),
    ...(!compact ? [{ label: 'Settings', icon: 'cog-outline', href: '/settings', selected: pathname === '/settings' }] : []),
  ];
  const navigationItems = entries.map((entry) => <Pressable key={entry.label} accessibilityRole="button" accessibilityLabel={entry.label} accessibilityState={{ selected: entry.selected }} onPress={() => { if (entry.label === 'Journal') { setShowJournal(true); return; } onNavigate?.(); router.navigate(entry.href as any); }} style={[s.item, compact && s.bottomItem, entry.selected && (compact ? s.selectedBottom : s.selectedRail), entry.label === 'Settings' && s.settings]}>
      {entry.icon === 'cog-outline' || entry.label === 'Journal' ? <MaterialCommunityIcons name={entry.icon as any} size={23} color="#B5C9D1" /> : <HeaderStrokeIcon name={entry.icon} size={23} color={entry.selected && compact ? t.color.primary : compact ? t.color.muted : entry.selected ? t.color.surface : '#B5C9D1'} />}
      <Text numberOfLines={!compact && entry.label === 'Take order' ? 2 : 1} adjustsFontSizeToFit minimumFontScale={0.85} style={[s.label, { color: entry.selected && compact ? t.color.primary : compact ? t.color.muted : entry.selected ? t.color.surface : '#B5C9D1' }]}>{!compact && entry.label === 'Take order' ? 'Take\norder' : entry.label}</Text>
    </Pressable>);
  return <><View style={[s.nav, compact ? [s.bottom, { paddingBottom: insets.bottom }] : [s.rail, { width: width >= 1100 ? 72 : 64, paddingTop: Math.max(insets.top, 14) }]]}>
    {compact ? navigationItems : <ScrollView style={s.railScroll} contentContainerStyle={[s.railContent, { paddingBottom: Math.max(insets.bottom, 12) }]} showsVerticalScrollIndicator indicatorStyle="white">
      <Text accessibilityLabel="Pappa's" style={s.brand}>p.</Text>
      {navigationItems}
    </ScrollView>}
  </View>
    {showJournal && <JournalLogsModal visible onClose={() => setShowJournal(false)} />}
  </>;
}
const s = StyleSheet.create({
  nav: { flexShrink: 0 }, rail: { backgroundColor: t.color.navy, alignItems: 'stretch', paddingHorizontal: 4 },
  railScroll: { flex: 1, minHeight: 0 }, railContent: { flexGrow: 1, gap: 10 },
  brand: { color: 'white', fontFamily: 'Georgia', fontSize: 28, fontWeight: '400', textAlign: 'center', marginBottom: 8 },
  bottom: { flexDirection: 'row', backgroundColor: t.color.surface, borderTopWidth: 1, borderColor: t.color.border },
  item: { minHeight: 60, alignItems: 'center', justifyContent: 'center', borderRadius: t.radius.control, paddingVertical: 10, gap: 5 },
  bottomItem: { flex: 1, minWidth: 0, minHeight: 64, borderRadius: 0, paddingHorizontal: 2 },
  label: { fontSize: 11, lineHeight: 13, fontWeight: '600', textAlign: 'center', flexShrink: 1 },
  selectedRail: { backgroundColor: '#275365' }, selectedBottom: { backgroundColor: t.color.primaryTint }, settings: { marginTop: 'auto', marginBottom: 12 },
});
