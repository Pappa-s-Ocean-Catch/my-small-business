import { tileTextColor } from './pos-tile-palette';
import { getPosWorkspaceLayout } from './redesign';

/** Pure configuration shared by the editor preview and the live catalogue. */
export type PosTileAppearance = {
  background?: string; text?: string; fontSize?: number;
  fontWeight?: number; align?: 'left' | 'center' | 'right'; height?: number;
};
export type PosTileConfig = PosTileAppearance & { color?: string; label?: string; visible?: boolean };
export type PosLayoutProduct = PosTileConfig & { productId: string; showOnQuickList?: boolean };
export type PosLayoutCategory = PosTileConfig & {
  categoryId: string; title?: string; sourceCategoryIds?: string[];
  hideSourceCategories?: boolean; showProductsOnTopLevel?: boolean; products: PosLayoutProduct[];
};
export type PosLayoutData = {
  version: 1; appearance?: PosTileAppearance;
  columnsExpanded?: number; columnsMedium?: number | 'auto'; columnsPhone?: number;
  quickOrderNotes?: string[]; quickItemNotes?: string[]; categories: PosLayoutCategory[];
};
export const DEFAULT_POS_QUICK_ORDER_NOTES = ['Chicken salt', 'Salt', 'Both Salt', 'No salt at all', 'Extra Salt', 'Extra chicken salt'];
export const DEFAULT_POS_QUICK_ITEM_NOTES = ['Cut in half', 'Pack separately', 'Extra sauce', 'No salt'];
export const DEFAULT_TILE_APPEARANCE = { background: '#FFFFFF', text: '#172E3A', fontSize: 16, fontWeight: 700, align: 'center' as const, height: 116 };
const bounded = (value: unknown, min: number, max: number) => typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : undefined;
export function normalizeTileAppearance(value: unknown): PosTileAppearance {
  const v = value && typeof value === 'object' ? value as PosTileAppearance : {};
  return Object.fromEntries(Object.entries({
    background: typeof v.background === 'string' && /^#[\da-f]{6}$/i.test(v.background) ? v.background : undefined,
    text: typeof v.text === 'string' && /^#[\da-f]{6}$/i.test(v.text) ? v.text : undefined,
    fontSize: bounded(v.fontSize, 12, 40), fontWeight: bounded(v.fontWeight, 100, 900),
    align: ['left', 'center', 'right'].includes(v.align || '') ? v.align : undefined, height: bounded(v.height, 64, 320),
  }).filter(([, v]) => v !== undefined));
}
function normalizeTile(value: PosTileConfig): PosTileConfig {
  return { ...value, ...normalizeTileAppearance(value), label: typeof value.label === 'string' ? value.label : undefined, visible: value.visible !== false };
}
export function normalizePosLayout(value: unknown): PosLayoutData {
  const v = (value && typeof value === 'object' ? value : {}) as Partial<PosLayoutData>;
  const notes = (items: unknown, fallback: string[]) => Array.isArray(items) ? items.filter((x): x is string => typeof x === 'string' && !!x.trim()).map(x => x.trim()) : [...fallback];
  return { ...v, version: 1, appearance: normalizeTileAppearance(v.appearance),
    columnsExpanded: bounded(v.columnsExpanded, 1, 6), columnsMedium: v.columnsMedium === 'auto' ? 'auto' : bounded(v.columnsMedium, 1, 6), columnsPhone: bounded(v.columnsPhone, 1, 3),
    quickOrderNotes: notes(v.quickOrderNotes, DEFAULT_POS_QUICK_ORDER_NOTES), quickItemNotes: notes(v.quickItemNotes, DEFAULT_POS_QUICK_ITEM_NOTES),
    categories: Array.isArray(v.categories) ? v.categories.filter(c => c && typeof c.categoryId === 'string').map(c => ({
      ...normalizeTile(c), categoryId: c.categoryId, title: c.title,
      sourceCategoryIds: Array.isArray(c.sourceCategoryIds) && c.sourceCategoryIds.length ? c.sourceCategoryIds : [c.categoryId],
      products: Array.isArray(c.products) ? c.products.filter(p => p && typeof p.productId === 'string').map(p => ({ ...normalizeTile(p), productId: p.productId, showOnQuickList: !!p.showOnQuickList })) : [],
    })) : [],
  };
}
export function resolvePosTileAppearance(layout?: PosLayoutData | null, tile?: PosTileConfig, fallback?: PosTileAppearance) {
  const appearance = { ...DEFAULT_TILE_APPEARANCE, ...normalizeTileAppearance(fallback), ...normalizeTileAppearance(layout?.appearance),
    ...(tile?.color ? { background: tile.color } : {}), ...normalizeTileAppearance(tile), label: tile?.label, visible: tile?.visible !== false };
  // Automatic product fills and legacy fill-only layouts need contrast against the resolved background.
  if ((fallback?.background || tile?.color) && !tile?.text && !layout?.appearance?.text && /^#[\da-f]{6}$/i.test(appearance.background)) {
    appearance.text = tileTextColor(appearance.background);
  }
  return appearance;
}
export const isPosTileVisible = (tile?: PosTileConfig) => tile?.visible !== false;
export function findPosProductConfig(layout: PosLayoutData | null | undefined, productId: string, categoryId?: string) {
  const categories = categoryId ? layout?.categories.filter(c => c.categoryId === categoryId) : layout?.categories;
  return categories?.flatMap(c => c.products).find(p => p.productId === productId);
}
/** Breakpoints belong to the device; automatic density belongs to the actual tile pane. */
export function getPosLayoutColumns(layout: PosLayoutData | null | undefined, deviceWidth: number, fontScale = 1, availableWidth = deviceWidth) {
  const configured = deviceWidth < 600 ? layout?.columnsPhone : deviceWidth < 1100 ? layout?.columnsMedium : layout?.columnsExpanded;
  return typeof configured === 'number' ? Math.max(1, Math.min(6, Math.round(configured))) : Math.max(1, Math.min(4, Math.floor(availableWidth / (170 * Math.max(1, fontScale)))));
}
/** Account for the navigation rail and cart just as the live POS workspace does. */
export function getPosLayoutMenuWidth(deviceWidth: number, fontScale = 1) {
  return getPosWorkspaceLayout(deviceWidth, fontScale).menuWidth;
}
/** Appearance scope affects appearance only; labels, visibility and business settings remain local. */
export function updatePosTileAppearance(layout: PosLayoutData, target: { categoryId: string; productId?: string }, patch: PosTileAppearance, scope: 'selected' | 'all'): PosLayoutData {
  if (scope === 'all') {
    const clear = <T extends PosTileConfig>(tile: T): T => {
      const next = { ...tile };
      for (const key of Object.keys(patch) as (keyof PosTileAppearance)[]) delete next[key];
      if (patch.background !== undefined) delete next.color;
      return next;
    };
    return { ...layout, appearance: { ...layout.appearance, ...patch }, categories: layout.categories.map(c => ({ ...clear(c), products: c.products.map(clear) })) };
  }
  return { ...layout, categories: layout.categories.map(c => c.categoryId !== target.categoryId ? c : target.productId ? { ...c, products: c.products.map(p => p.productId === target.productId ? { ...p, ...patch } : p) } : { ...c, ...patch }) };
}
