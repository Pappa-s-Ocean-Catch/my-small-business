import { useState, useRef, memo, useCallback } from 'react';
import { FlatList, StyleSheet, View, Pressable, useWindowDimensions, type ListRenderItemInfo } from 'react-native';
import { Text, TouchableRipple, Portal, Dialog, Button } from 'react-native-paper';
import type { MirrorOrderLine, MirrorOrderSnapshotV1 } from '@my-small-business/pos-mirror';

import { useQueueCount } from '../hooks/useQueueCount';
import { getCustomerDisplayLayout } from '../lib/customer-display-layout';
import { colors, radius, spacing } from '../theme';

function money(value: number): string { return `$${value.toFixed(2)}`; }

const OrderLine = memo(function OrderLine({ item, compact, rowMinHeight, onPress }: { item: MirrorOrderLine; compact: boolean; rowMinHeight: number; onPress: (item: MirrorOrderLine) => void }) {
  const hasCustomizations = item.customizations && item.customizations.length > 0;
  return <TouchableRipple onPress={() => onPress(item)} style={[styles.line, { minHeight: rowMinHeight, paddingVertical: compact ? spacing.sm : spacing.md }]}>
    <View style={styles.lineContent}>
      <Text variant={compact ? "titleLarge" : "headlineSmall"} style={styles.quantity}>{item.quantity}×</Text>
      <View style={styles.nameBlock}>
        <View style={styles.nameRow}>
          <Text variant={compact ? "titleMedium" : "titleLarge"} numberOfLines={2} style={styles.name}>{item.name}</Text>
          {hasCustomizations && <View style={styles.customizedBadge}><Text style={styles.customizedBadgeText}>Customized</Text></View>}
        </View>
      </View>
      <View style={styles.eachColumn}><Text variant="labelSmall" style={styles.priceLabel}>EACH</Text><Text variant={compact ? "titleSmall" : "titleMedium"} style={styles.unitPrice}>{money(item.unitPrice)}</Text></View>
      <View style={styles.totalColumn}><Text variant="labelSmall" style={styles.priceLabel}>TOTAL</Text><Text variant={compact ? "titleMedium" : "titleLarge"} style={styles.lineTotal}>{money(item.lineTotal)}</Text></View>
    </View>
  </TouchableRipple>;
}, (previous, next) => previous.compact === next.compact && previous.rowMinHeight === next.rowMinHeight
  && previous.item.id === next.item.id && previous.item.name === next.item.name
  && previous.item.quantity === next.item.quantity && previous.item.unitPrice === next.item.unitPrice
  && previous.item.lineTotal === next.item.lineTotal
  && previous.item.customizations === next.item.customizations);

export const ActiveCartDisplay = memo(function ActiveCartDisplay({ snapshot, onRevealSettings }: { snapshot: MirrorOrderSnapshotV1, onRevealSettings?: () => void }) {
  const { width, height } = useWindowDimensions();
  const layout = getCustomerDisplayLayout({ width, height });
  const [selectedItem, setSelectedItem] = useState<MirrorOrderLine | null>(null);
  const queueCount = useQueueCount();

  const handlePressLine = useCallback((item: MirrorOrderLine) => {
    if (item.customizations && item.customizations.length > 0) {
      setSelectedItem(item);
    }
  }, []);

  const [tapCount, setTapCount] = useState(0);
  const lastTapRef = useRef(0);
  const handlePriceTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current > 1000) {
      setTapCount(1);
    } else {
      const newCount = tapCount + 1;
      setTapCount(newCount);
      if (newCount >= 5) {
        onRevealSettings?.();
        setTapCount(0);
      }
    }
    lastTapRef.current = now;
  };

  const renderItem = useCallback(({ item }: ListRenderItemInfo<MirrorOrderLine>) => <OrderLine item={item} compact={layout.compact} rowMinHeight={layout.rowMinHeight} onPress={handlePressLine} />, [layout.compact, layout.rowMinHeight, handlePressLine]);
  return <View style={styles.container} accessibilityLabel={`Current order with ${snapshot.itemCount} items`}>
    <View style={[styles.itemsPanel, { padding: layout.gutter }]}>
      <View style={[styles.headingRow, { marginBottom: layout.compact ? spacing.sm : spacing.md }]}><View><Text variant={layout.compact ? "headlineSmall" : "headlineMedium"} style={styles.title}>Your order</Text><Text variant={layout.compact ? "bodyLarge" : "titleMedium"} style={styles.itemCount}>{snapshot.itemCount} item{snapshot.itemCount === 1 ? '' : 's'}</Text></View><View style={styles.livePill}><Text variant="labelLarge" style={styles.live}>LIVE</Text></View></View>
      <View style={styles.columnLabels}><Text variant="labelMedium" style={styles.quantityLabel}>QTY</Text><Text variant="labelMedium" style={styles.itemLabel}>ITEM</Text><Text variant="labelMedium" style={styles.eachLabel}>EACH</Text><Text variant="labelMedium" style={styles.totalLabel}>TOTAL</Text></View>
      <FlatList data={snapshot.items} renderItem={renderItem} keyExtractor={(item) => item.id} contentContainerStyle={styles.items} showsVerticalScrollIndicator={false} removeClippedSubviews initialNumToRender={8} windowSize={5} />
    </View>
    <View style={[styles.totalPanel, { width: layout.totalPanelWidth, padding: layout.gutter }]}>
      <Text variant={layout.compact ? "titleMedium" : "titleLarge"} style={styles.totalPanelLabel}>TOTAL TO PAY</Text>
      
      <Pressable style={styles.totalSpacer} onPress={handlePriceTap}>
        <Text style={[styles.total, { fontSize: layout.totalFontSize, lineHeight: layout.totalFontSize + 8 }]}>
          {money(snapshot.total)}
        </Text>
        {snapshot.discount > 0 && (
          <Text variant="titleMedium" style={styles.discountHint}>
            Includes {money(snapshot.discount)} discount
          </Text>
        )}
      </Pressable>

      <View style={styles.divider} />
      
      <View style={styles.queueStats}>
        <Text style={styles.queueLabel}>ORDERS PREPPING</Text>
        <Text style={styles.queueCount}>{queueCount}</Text>
      </View>
    </View>
    <Portal>
      <Dialog visible={!!selectedItem} onDismiss={() => setSelectedItem(null)}>
        <Dialog.Title>{selectedItem?.name} Customizations</Dialog.Title>
        <Dialog.Content>
          {selectedItem?.customizations?.map((c, i) => (
            <Text key={i} variant="bodyLarge" style={styles.customizationText}>• {c.label}</Text>
          ))}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={() => setSelectedItem(null)}>Close</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  </View>;
});

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', backgroundColor: colors.background }, itemsPanel: { flex: 1, minWidth: 0 },
  headingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, title: { color: colors.text, fontWeight: '800' }, itemCount: { color: colors.mutedText, marginTop: spacing.xs }, livePill: { backgroundColor: colors.surfaceMuted, borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }, live: { color: colors.primary, fontWeight: '800', letterSpacing: 1 },
  columnLabels: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs, paddingHorizontal: spacing.sm }, quantityLabel: { width: 48, color: colors.mutedText }, itemLabel: { flex: 1, color: colors.mutedText }, eachLabel: { width: 76, color: colors.mutedText, textAlign: 'right' }, totalLabel: { width: 94, color: colors.mutedText, textAlign: 'right' }, items: { gap: spacing.sm, paddingBottom: spacing.sm },
  line: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden', justifyContent: 'center' }, lineContent: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm }, quantity: { width: 48, color: colors.primary, fontWeight: '800' }, nameBlock: { flex: 1, minWidth: 0, paddingRight: spacing.sm }, nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs }, name: { color: colors.text, fontWeight: '700', flexShrink: 1 }, customizedBadge: { backgroundColor: colors.primary + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }, customizedBadgeText: { color: colors.primary, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' }, eachColumn: { width: 76, alignItems: 'flex-end' }, totalColumn: { width: 94, alignItems: 'flex-end' }, priceLabel: { color: colors.mutedText, fontSize: 9 }, unitPrice: { color: colors.mutedText, fontVariant: ['tabular-nums'] }, lineTotal: { color: colors.text, fontWeight: '800', fontVariant: ['tabular-nums'] },
  totalPanel: { backgroundColor: colors.text, justifyContent: 'center' }, totalPanelLabel: { color: colors.surfaceMuted, fontWeight: '800', letterSpacing: 1 }, totalSpacer: { flex: 1, minHeight: spacing.md, justifyContent: 'center', alignItems: 'flex-start' }, divider: { height: 1, backgroundColor: colors.mutedText, marginVertical: spacing.md }, total: { color: colors.primaryOn, fontWeight: '900', fontVariant: ['tabular-nums'], letterSpacing: -1 }, discountHint: { color: colors.surfaceMuted, marginTop: spacing.sm }, queueStats: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, queueLabel: { color: colors.surfaceMuted, fontWeight: '700', letterSpacing: 1, fontSize: 13 }, queueCount: { color: colors.primaryOn, fontWeight: '800', fontSize: 28, fontVariant: ['tabular-nums'] },
  customizationText: { color: colors.text, marginVertical: 2 },
});
