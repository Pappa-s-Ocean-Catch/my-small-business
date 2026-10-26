import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

import { normalizePosLayout, type PosLayoutData } from './pos-layout-config';
export * from './pos-layout-config';

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
const ACTIVE_POS_LAYOUT_KEY = 'activePosLayoutSnapshot';

export const applyPosLayout = async (layout: PosLayoutData, name = 'Local POS layout', id: string | null = null) => {
  const now = new Date().toISOString();
  const record: PosLayoutRecord = { id: id || 'local-active', name, layout: normalizePosLayout(layout), is_default: false, created_at: now, updated_at: now };
  await AsyncStorage.setItem(ACTIVE_POS_LAYOUT_KEY, JSON.stringify(record));
  await setSelectedPosLayoutId(id);
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

export const getAppliedPosLayout = async (): Promise<PosLayoutRecord | null> => {
  const active = await AsyncStorage.getItem(ACTIVE_POS_LAYOUT_KEY);
  if (active) {
    try { const record = JSON.parse(active) as PosLayoutRecord; if (record.layout) return { ...record, layout: normalizePosLayout(record.layout) }; } catch { /* Fall back to saved preference. */ }
  }
  return null;
};

export const fetchPreferredPosLayout = async () => {
  const active = await getAppliedPosLayout();
  if (active) return { data: active, error: null };
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
  // Freeze the current render before editing a named record, including the selected/default record.
  if (!await AsyncStorage.getItem(ACTIVE_POS_LAYOUT_KEY)) {
    const current = await fetchPreferredPosLayout();
    if (current.error) return { data: null, error: current.error };
    if (current.data) await applyPosLayout(current.data.layout, current.data.name, current.data.id);
    else await applyPosLayout({ version: 1, categories: [] });
  }
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

  return { data: result.data, error: null };
};
