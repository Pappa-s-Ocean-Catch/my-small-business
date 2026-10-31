import { useProductTilePress } from '@/hooks/useProductTilePress';
import { ActionButton as Button } from '@/components/ui/ActionButton';
import React from 'react';
import { findPosProductConfig, getPosLayoutColumns, type PosLayoutData } from '@/lib/pos-layout-config';
import { Text, View, useWindowDimensions } from 'react-native';
import { TextInput } from 'react-native-paper';
import { EditorSheet, FormField } from '@/components/ui';
import { PosGroupTile } from './PosConfigurableTile';
import { PosProductTile } from './PosProductTile';
import { designTokens as t } from '@/lib/redesign';
import type { LayoutCategoryButton, SaleProduct } from '@/app/pos.types';

export function PosSearchSheet({ layout, visible, onClose, query, onQueryChange, groups, products, onGroup, onProduct, quantity, hasAddons, groupName, accent, feedback }: {
  layout?: PosLayoutData | null; visible: boolean; onClose: () => void; query: string; onQueryChange: (value: string) => void;
  groups: LayoutCategoryButton[]; products: SaleProduct[]; onGroup: (id: string) => void; onProduct: (product: SaleProduct) => void;
  quantity: (id: string) => number; hasAddons: (id: string) => boolean; groupName: (product: SaleProduct) => string; accent: (id: string) => string; feedback: string;
}) {
  const { width, fontScale } = useWindowDimensions();
  const pressProduct = useProductTilePress(products, onProduct);
  if (!visible) return null;
  const columns = getPosLayoutColumns(layout, width, fontScale, Math.min(width, 920) - 60);
  const groupMatches = query.trim() ? groups.filter((group) => group.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) : groups;
  return <EditorSheet visible={visible} title="Search menu" size="wide" onDismiss={onClose} footer={<Button mode="outlined" onPress={onClose} contentStyle={{ minHeight: 48 }}>Close search</Button>}>
    <FormField label="Find a group or product" value={query} onChangeText={onQueryChange} autoFocus autoCorrect={false} right={<TextInput.Icon icon="close" accessibilityLabel="Clear menu search" onPress={() => onQueryChange('')} />} />
    {!!feedback && <Text accessibilityLiveRegion="polite" style={{ color: t.color.primary }}>{feedback}</Text>}

    <Text style={{ fontSize: 16, fontWeight: '700', color: t.color.text }}>Products · {products.length}</Text>
    {products.length === 0 && groupMatches.length === 0 && <Text style={{ color: t.color.muted }}>No matching groups or products. Try another name.</Text>}
    {Array.from({ length: Math.ceil(products.length / columns) }, (_, index) => <View key={index} style={{ flexDirection: 'row' }}>{products.slice(index * columns, (index + 1) * columns).map((product) => <PosProductTile layout={layout} tileConfig={findPosProductConfig(layout, product.id)} key={product.id} product={product} groupName={groupName(product)} quantity={quantity(product.id)} hasAddons={hasAddons(product.id)} accent={accent(product.id)} columns={columns} onProductPress={pressProduct} />)}</View>)}
    {groupMatches.length > 0 && <Text style={{ fontSize: 16, fontWeight: '700', color: t.color.text }}>Groups</Text>}
    {Array.from({ length: Math.ceil(groupMatches.length / columns) }, (_, index) => <View key={`groups-${index}`} style={{ flexDirection: 'row' }}>{groupMatches.slice(index * columns, (index + 1) * columns).map(group => <PosGroupTile key={group.id} label={group.name} subtitle={`${group.productCount} products`} layout={layout} tileConfig={layout?.categories.find(c => c.categoryId === group.id)} columns={columns} onPress={() => onGroup(group.id)} />)}</View>)}

  </EditorSheet>;
}
