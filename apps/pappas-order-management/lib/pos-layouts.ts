import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

export type PosLayoutProduct = {
  productId: string;
  color?: string;
  showOnQuickList?: boolean;
};

export type PosLayoutCategory = {
  categoryId: string;
  title?: string;
  sourceCategoryIds?: string[];
  hideSourceCategories?: boolean;
  showProductsOnTopLevel?: boolean;
  color?: string;
  products: PosLayoutProduct[];
};

export type PosLayoutData = {
  version: 1;
  quickOrderNotes?: string[];
  categories: PosLayoutCategory[];
};

export const DEFAULT_POS_QUICK_ORDER_NOTES = [
  'Chicken salt',
  'Salt',
  'Both Salt',
  'No salt at all',
  'Extra Salt',
  'Extra chicken salt',
];

export type PosLayoutRecord = {
  id: string;
  name: string;
  layout: PosLayoutData;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export const SELECTED_POS_LAYOUT_KEY = 'selectedPosLayoutId';
export const DEFAULT_POS_BUTTON_COLOR = '#111827';

export const normalizePosLayout = (layout: unknown): PosLayoutData => {
  const candidate = layout as Partial<PosLayoutData> | null | undefined;
  return {
    version: 1,
    quickOrderNotes: Array.isArray(candidate?.quickOrderNotes)
      ? candidate.quickOrderNotes
        .filter((note): note is string => typeof note === 'string' && note.trim().length > 0)
        .map((note) => note.trim())
      : DEFAULT_POS_QUICK_ORDER_NOTES,
    categories: Array.isArray(candidate?.categories)
      ? candidate.categories
        .filter((category): category is PosLayoutCategory => Boolean(category?.categoryId))
        .map((category) => ({
          categoryId: category.categoryId,
          title: category.title,
          sourceCategoryIds: Array.isArray(category.sourceCategoryIds) && category.sourceCategoryIds.length > 0
            ? category.sourceCategoryIds
            : [category.categoryId],
          hideSourceCategories: Boolean(category.hideSourceCategories),
          showProductsOnTopLevel: Boolean(category.showProductsOnTopLevel),
          color: category.color,
          products: Array.isArray(category.products)
            ? category.products
              .filter((product): product is PosLayoutProduct => Boolean(product?.productId))
              .map((product) => ({
                productId: product.productId,
                color: product.color,
                showOnQuickList: Boolean(product.showOnQuickList),
              }))
            : [],
        }))
      : [],
  };
};

export const getSelectedPosLayoutId = async () => AsyncStorage.getItem(SELECTED_POS_LAYOUT_KEY);

export const setSelectedPosLayoutId = async (layoutId: string | null) => {
  if (layoutId) {
    await AsyncStorage.setItem(SELECTED_POS_LAYOUT_KEY, layoutId);
    return;
  }

  await AsyncStorage.removeItem(SELECTED_POS_LAYOUT_KEY);
};

export const fetchPosLayouts = async () => {
  const { data, error } = await supabase
    .from('pos_layouts')
    .select('id, name, layout, is_default, created_at, updated_at')
    .order('is_default', { ascending: false })
    .order('updated_at', { ascending: false });

  if (error) return { data: null, error: error.message };

  return {
    data: (data || []).map((layout: any) => ({
      ...layout,
      layout: normalizePosLayout(layout.layout),
    })) as PosLayoutRecord[],
    error: null,
  };
};

export const fetchPreferredPosLayout = async () => {
  const selectedId = await getSelectedPosLayoutId();
  const { data: layouts, error } = await fetchPosLayouts();
  if (error) return { data: null, error };

  const selectedLayout = selectedId ? layouts?.find((layout) => layout.id === selectedId) : null;
  return {
    data: selectedLayout || layouts?.find((layout) => layout.is_default) || layouts?.[0] || null,
    error: null,
  };
};

export const savePosLayout = async (
  payload: { id?: string; name: string; layout: PosLayoutData; isDefault: boolean }
) => {
  const { data: userResult } = await supabase.auth.getUser();
  const basePayload = {
    name: payload.name.trim() || 'POS Layout',
    layout: payload.layout,
    is_default: payload.isDefault,
    created_by: userResult.user?.id ?? null,
  };

  const result = payload.id
    ? await supabase
      .from('pos_layouts')
      .update({
        name: basePayload.name,
        layout: basePayload.layout,
        is_default: basePayload.is_default,
      })
      .eq('id', payload.id)
      .select('id')
      .single()
    : await supabase
      .from('pos_layouts')
      .insert(basePayload)
      .select('id')
      .single();

  if (result.error) return { data: null, error: result.error.message };

  if (payload.isDefault && result.data?.id) {
    await supabase
      .from('pos_layouts')
      .update({ is_default: false })
      .neq('id', result.data.id);
  }

  if (result.data?.id) await setSelectedPosLayoutId(result.data.id);
  return { data: result.data, error: null };
};
