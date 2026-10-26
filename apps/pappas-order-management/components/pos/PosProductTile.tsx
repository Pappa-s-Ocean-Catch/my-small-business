import React from 'react';
import { Text, View } from 'react-native';
import type { SaleProduct } from '@/app/pos.types';
import { resolvePosTileAppearance, type PosLayoutData, type PosTileConfig } from '@/lib/pos-layout-config';
import { PosConfigurableTile } from './PosConfigurableTile';
type Props = { product: Pick<SaleProduct, 'id' | 'name' | 'sale_price'>; groupName: string; quantity: number; hasAddons: boolean; accent: string; columns: number; onPress?: () => void; preview?: boolean; layout?: PosLayoutData | null; tileConfig?: PosTileConfig };
/** Product and group previews use the exact renderer used by the live POS. */
export function PosProductTile({ product, groupName, quantity, hasAddons, columns, onPress, preview = false, layout, tileConfig }: Props) {
  const a = resolvePosTileAppearance(layout, tileConfig);
  return <PosConfigurableTile variant="product" label={product.name} subtitle={groupName} quantity={quantity} columns={columns} layout={layout} tileConfig={tileConfig} onPress={onPress} preview={preview} accessibilityLabel={`${a.label || product.name}, $${product.sale_price.toFixed(2)}, add to order${hasAddons ? ' and update add-ons' : ''}`} footer={<View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}><Text style={{ fontSize: 16, fontWeight: '700', color: a.text, fontVariant: ['tabular-nums'] }}>${product.sale_price.toFixed(2)}</Text><Text style={{ fontSize: 12, color: a.text }}>{hasAddons ? 'Add-ons ›' : '+ Add'}</Text></View>} />;
}
