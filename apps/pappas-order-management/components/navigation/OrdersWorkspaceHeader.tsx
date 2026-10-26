import React from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HeaderIconButton, WorkspaceHeader } from '@/components/ui';
import { type OrderHeaderActions, useOrderHeaderActionsStore } from './order-header-actions';
import { usePathname, useRouter } from 'expo-router';
import { usePreOrderCountQuery, useLiveOrdersQuery, useOnTheWayOrdersQuery } from '@/hooks/useLiveOrdersQuery';
import { useAppSettingsQuery } from '@/hooks/useAppSettingsQuery';
import { marketplaceSyncAlertStore } from '@/stores/marketplaceSyncAlertStore';
import { getMarketplaceSyncIndicatorColor } from '@/lib/marketplace-sync-indicator';
import { hasUpcomingOrders } from '@/components/orders/presentation';
import { designTokens as t } from '@/lib/redesign';

export function OrdersWorkspaceHeader({ title: headingTitle, onNavigate, actions: ownActions }: { title?: string; onNavigate?: () => void; actions?: OrderHeaderActions }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { width, fontScale } = useWindowDimensions();
  const { data: upcomingCount } = usePreOrderCountQuery(); // Undefined/error retains cached query data, never coerced to zero.
  const { data: live } = useLiveOrdersQuery();
  const { data: deliveries } = useOnTheWayOrdersQuery();
  const { data: settings, isLoading } = useAppSettingsQuery();
  const registration = useOrderHeaderActionsStore((state) => state.registration);
  const actions = ownActions || (registration?.path === pathname ? registration.actions : undefined);
  const alerts = marketplaceSyncAlertStore((state) => state.alerts);
  const syncColor = getMarketplaceSyncIndicatorColor(!isLoading && !!settings.marketplaceAutoSyncEnabled, Object.values(alerts).some((alert) => alert?.visible));
  const tabs = [
    { label: 'Live', path: 'live-orders', count: live?.length },
    { label: 'On the way', path: 'on-the-way', count: deliveries?.length },
    { label: 'Completed', path: 'completed', count: undefined },
    ...(hasUpcomingOrders(upcomingCount) ? [{ label: 'Pre-orders', path: 'pre-orders', count: upcomingCount }] : []),
  ];
  const content = <View accessibilityRole="tablist" style={[s.tabs, { gap: width >= 1100 ? 12 : width >= 600 ? 8 : 4, paddingHorizontal: width < 600 ? 8 : 16 }]}>{tabs.map((tab) => {
    const selected = pathname.endsWith('/' + tab.path) || (tab.path === 'completed' && pathname.endsWith('/orders'));
    return <Pressable key={tab.path} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => { onNavigate?.(); router.navigate((tab.path === 'pre-orders' ? '/pre-orders' : `/(drawer)/(tabs)/${tab.path}`) as any); }} style={[s.tab, selected && s.active, width < 600 && s.compactTab, width < 600 && tabs.length === 4 && s.fourCompactTabs]}>
      <Text style={[s.tabText, width < 600 && { fontSize: 12 }, selected && s.activeText]}>{tab.label}</Text>{tab.count !== undefined && <Text style={[s.count, selected && s.activeCount, width < 600 && { fontSize: tabs.length === 4 ? 10 : 11, minWidth: 20, paddingHorizontal: 5 }]}>{tab.count}</Text>}
    </Pressable>;
  })}</View>;
  const title = headingTitle || 'Orders';
  return <View style={s.header}>
    <View style={{ paddingTop: insets.top }}><WorkspaceHeader title={title} showNewOrder onNewOrder={() => { onNavigate?.(); router.navigate('/pos'); }} actions={<>
      {actions?.onToggleFilters && <HeaderIconButton icon="filter-variant" badge={actions.activeFilterCount} iconColor={actions.filtersExpanded || actions.activeFilterCount ? t.color.primary : undefined} style={actions.filtersExpanded ? { backgroundColor: t.color.primaryTint } : undefined} accessibilityLabel={`Filters, ${actions.activeFilterCount || 0} active`} accessibilityState={{ expanded: !!actions.filtersExpanded }} onPress={actions.onToggleFilters} />}
      {actions?.onRefresh && <HeaderIconButton icon="refresh" accessibilityLabel="Refresh orders" loading={actions.refreshing} disabled={actions.refreshing} onPress={actions.onRefresh} />}
      <HeaderIconButton icon="storefront-outline" accessibilityLabel="Marketplace sync status" iconColor={syncColor} onPress={() => { onNavigate?.(); router.navigate('/marketplace'); }} />
    </>} /></View>
    {fontScale > 1.25 ? <ScrollView horizontal>{content}</ScrollView> : content}
  </View>;
}
const s = StyleSheet.create({
  header: { backgroundColor: t.color.surface, borderBottomWidth: 1, borderColor: t.color.border },
  tabs: { flexDirection: 'row', paddingHorizontal: 16 }, tab: { minHeight: 46, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderBottomWidth: 3, borderColor: 'transparent' },
  compactTab: { flex: 1, minHeight: 44, paddingHorizontal: 6, paddingVertical: 9, gap: 4 },
  fourCompactTabs: { flexDirection: 'column', minHeight: 60, paddingHorizontal: 5, paddingVertical: 7 },
  active: { borderBottomColor: t.color.primary }, tabText: { color: t.color.muted, fontSize: 14, fontWeight: '700', textAlign: 'center' }, activeText: { color: t.color.primary }, count: { fontSize: 12, minWidth: 24, textAlign: 'center', color: t.color.muted, backgroundColor: '#EDF1F3', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  activeCount: { color: t.color.primaryPressed, backgroundColor: t.color.primaryTint },
});
