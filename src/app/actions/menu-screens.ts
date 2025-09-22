'use server';

import { createServiceRoleClient } from '@/lib/supabase/server';

export interface MenuScreen {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  subtitle?: string | null;
  theme: Record<string, unknown>;
  is_published: boolean;
  show_images: boolean;
  num_columns: number;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MenuScreenCategory {
  id: string;
  menu_screen_id: string;
  sale_category_id: string;
  sort_order: number;
  column_index: number;
  created_at: string;
}

export async function listMenuScreens(): Promise<{ data: MenuScreen[] | null; error: string | null }> {
  try {
    const supabase = await createServiceRoleClient();
    const { data, error } = await supabase
      .from('menu_screens')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) return { data: null, error: error.message };
    return { data: (data as MenuScreen[]) ?? [], error: null };
  } catch (err) {
    return { data: null, error: 'Failed to list menu screens' };
  }
}

export async function getMenuScreenBySlug(slug: string): Promise<{ data: MenuScreen | null; error: string | null }> {
  try {
    const supabase = await createServiceRoleClient();
    const { data, error } = await supabase
      .from('menu_screens')
      .select('*')
      .eq('slug', slug)
      .single();
    if (error) return { data: null, error: error.message };
    return { data: data as MenuScreen, error: null };
  } catch (err) {
    return { data: null, error: 'Failed to fetch menu screen' };
  }
}

export async function getMenuScreenWithCategories(menuScreenId: string): Promise<{ data: { screen: MenuScreen; categories: MenuScreenCategory[] } | null; error: string | null }> {
  try {
    const supabase = await createServiceRoleClient();
    const [{ data: screen, error: sErr }, { data: categories, error: cErr }] = await Promise.all([
      supabase.from('menu_screens').select('*').eq('id', menuScreenId).single(),
      supabase.from('menu_screen_categories').select('*').eq('menu_screen_id', menuScreenId).order('sort_order', { ascending: true })
    ]);
    if (sErr) return { data: null, error: sErr.message };
    if (cErr) return { data: null, error: cErr.message };
    return { data: { screen: screen as MenuScreen, categories: (categories as MenuScreenCategory[]) ?? [] }, error: null };
  } catch (err) {
    return { data: null, error: 'Failed to fetch menu screen details' };
  }
}

export async function createMenuScreen(input: { slug: string; name: string; description?: string; theme?: Record<string, unknown>; is_published?: boolean; show_images?: boolean; sort_order?: number }): Promise<{ data: MenuScreen | null; error: string | null }> {
  try {
    const supabase = await createServiceRoleClient();
    const { data, error } = await supabase
      .from('menu_screens')
      .insert([
        {
          slug: input.slug,
          name: input.name,
          description: input.description ?? null,
          theme: input.theme ?? {},
          is_published: input.is_published ?? false,
          show_images: input.show_images ?? false,
          sort_order: input.sort_order ?? 0,
          num_columns: 3
        }
      ])
      .select('*')
      .single();
    if (error) return { data: null, error: error.message };
    return { data: data as MenuScreen, error: null };
  } catch (err) {
    return { data: null, error: 'Failed to create menu screen' };
  }
}

export async function updateMenuScreen(id: string, input: Partial<Omit<MenuScreen, 'id' | 'created_at' | 'updated_at' | 'created_by'>>): Promise<{ data: MenuScreen | null; error: string | null }> {
  try {
    const supabase = await createServiceRoleClient();
    const { data, error } = await supabase
      .from('menu_screens')
      .update(input)
      .eq('id', id)
      .select('*')
      .single();
    if (error) return { data: null, error: error.message };
    return { data: data as MenuScreen, error: null };
  } catch (err) {
    return { data: null, error: 'Failed to update menu screen' };
  }
}

export async function deleteMenuScreen(id: string): Promise<{ ok: boolean; error: string | null }> {
  try {
    const supabase = await createServiceRoleClient();
    const { error } = await supabase.from('menu_screens').delete().eq('id', id);
    if (error) return { ok: false, error: error.message };
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: 'Failed to delete menu screen' };
  }
}

export async function saveMenuScreensOrder(idsInOrder: string[]): Promise<{ ok: boolean; error: string | null }> {
  try {
    const supabase = await createServiceRoleClient();
    for (let i = 0; i < idsInOrder.length; i++) {
      const id = idsInOrder[i];
      const { error } = await supabase
        .from('menu_screens')
        .update({ sort_order: i })
        .eq('id', id);
      if (error) return { ok: false, error: error.message };
    }
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: 'Failed to save screens order' };
  }
}

export async function replaceMenuScreenCategories(menuScreenId: string, categoryIdsSorted: string[]): Promise<{ ok: boolean; error: string | null }> {
  try {
    const supabase = await createServiceRoleClient();
    // Delete existing
    const { error: delErr } = await supabase.from('menu_screen_categories').delete().eq('menu_screen_id', menuScreenId);
    if (delErr) return { ok: false, error: delErr.message };
    if (categoryIdsSorted.length === 0) return { ok: true, error: null };
    const payload = categoryIdsSorted.map((catId, index) => ({ menu_screen_id: menuScreenId, sale_category_id: catId, sort_order: index }));
    const { error: insErr } = await supabase.from('menu_screen_categories').insert(payload);
    if (insErr) return { ok: false, error: insErr.message };
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: 'Failed to update screen categories' };
  }
}

export async function getMenuScreenCategoryUsageCounts(): Promise<{ data: Record<string, number> | null; error: string | null }> {
  try {
    const supabase = await createServiceRoleClient();
    const { data, error } = await supabase
      .from('menu_screen_categories')
      .select('sale_category_id');
    if (error) return { data: null, error: error.message };
    const counts: Record<string, number> = {};
    for (const row of (data as Array<{ sale_category_id: string }>)) {
      const key = row.sale_category_id;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return { data: counts, error: null };
  } catch (err) {
    return { data: null, error: 'Failed to load category usage counts' };
  }
}

export async function saveMenuScreenColumnsLayout(menuScreenId: string, numColumns: number, columns: Array<{ categoryId: string; columnIndex: number; sortOrder: number }>): Promise<{ ok: boolean; error: string | null }> {
  try {
    const supabase = await createServiceRoleClient();
    const { error: updErr } = await supabase
      .from('menu_screens')
      .update({ num_columns: numColumns })
      .eq('id', menuScreenId);
    if (updErr) return { ok: false, error: updErr.message };

    // Sync join table to exactly match provided columns set (upsert/update/delete)
    const { data: existing, error: fetchErr } = await supabase
      .from('menu_screen_categories')
      .select('id, sale_category_id')
      .eq('menu_screen_id', menuScreenId);
    if (fetchErr) return { ok: false, error: fetchErr.message };
    const existingMap = new Map<string, string>();
    (existing as Array<{ id: string; sale_category_id: string }> | null)?.forEach(r => existingMap.set(r.sale_category_id, r.id));

    const incomingIds = new Set(columns.map(c => c.categoryId));
    const toDelete: string[] = [];
    existingMap.forEach((rowId, saleCategoryId) => {
      if (!incomingIds.has(saleCategoryId)) toDelete.push(saleCategoryId);
    });

    // Delete removed
    if (toDelete.length > 0) {
      const { error: delErr } = await supabase
        .from('menu_screen_categories')
        .delete()
        .eq('menu_screen_id', menuScreenId)
        .in('sale_category_id', toDelete);
      if (delErr) return { ok: false, error: delErr.message };
    }

    // Insert new
    const toInsert = columns.filter(c => !existingMap.has(c.categoryId)).map(c => ({
      menu_screen_id: menuScreenId,
      sale_category_id: c.categoryId,
      column_index: c.columnIndex,
      sort_order: c.sortOrder,
    }));
    if (toInsert.length > 0) {
      const { error: insErr } = await supabase
        .from('menu_screen_categories')
        .insert(toInsert);
      if (insErr) return { ok: false, error: insErr.message };
    }

    // Update existing
    for (const c of columns) {
      if (!existingMap.has(c.categoryId)) continue;
      const { error } = await supabase
        .from('menu_screen_categories')
        .update({ column_index: c.columnIndex, sort_order: c.sortOrder })
        .eq('menu_screen_id', menuScreenId)
        .eq('sale_category_id', c.categoryId);
      if (error) return { ok: false, error: error.message };
    }
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: 'Failed to save column layout' };
  }
}


