'use server';

import { createServiceRoleClient } from '@my-small-business/supabase/server';

// Types
export interface AddonGroup {
  id: string;
  name: string;
  description: string | null;
  is_required: boolean;
  multiple_choice: boolean;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  items?: AddonItem[];
  item_count?: number;
}

export interface AddonItem {
  id: string;
  addon_group_id: string;
  name: string;
  extra_price: number;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AddonGroupWithItems extends AddonGroup {
  items: AddonItem[];
}

// Add-on Groups CRUD
export async function getAddonGroups(): Promise<{ data: AddonGroupWithItems[] | null; error: string | null }> {
  try {
    const supabase = await createServiceRoleClient();

    // Fetch all addon groups
    const { data: groups, error: groupsError } = await supabase
      .from('addon_groups')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (groupsError) {
      console.error('Error fetching addon groups:', groupsError);
      return { data: null, error: groupsError.message };
    }

    if (!groups || groups.length === 0) {
      return { data: [], error: null };
    }

    // Fetch items for each group
    const groupIds = groups.map(g => g.id);
    const { data: items, error: itemsError } = await supabase
      .from('addon_items')
      .select('*')
      .in('addon_group_id', groupIds)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (itemsError) {
      console.error('Error fetching addon items:', itemsError);
      return { data: null, error: itemsError.message };
    }

    // Combine data
    const groupsWithItems: AddonGroupWithItems[] = groups.map(group => ({
      ...group,
      items: items?.filter(item => item.addon_group_id === group.id) || [],
      item_count: items?.filter(item => item.addon_group_id === group.id).length || 0
    }));

    return { data: groupsWithItems, error: null };
  } catch (error) {
    console.error('Unexpected error fetching addon groups:', error);
    return { data: null, error: 'An unexpected error occurred' };
  }
}

export async function getAddonGroup(id: string): Promise<{ data: AddonGroupWithItems | null; error: string | null }> {
  try {
    const supabase = await createServiceRoleClient();

    // Fetch addon group
    const { data: group, error: groupError } = await supabase
      .from('addon_groups')
      .select('*')
      .eq('id', id)
      .single();

    if (groupError) {
      console.error('Error fetching addon group:', groupError);
      return { data: null, error: groupError.message };
    }

    // Fetch items for this group
    const { data: items, error: itemsError } = await supabase
      .from('addon_items')
      .select('*')
      .eq('addon_group_id', id)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (itemsError) {
      console.error('Error fetching addon items:', itemsError);
      return { data: null, error: itemsError.message };
    }

    return {
      data: {
        ...group,
        items: items || [],
        item_count: items?.length || 0
      },
      error: null
    };
  } catch (error) {
    console.error('Unexpected error fetching addon group:', error);
    return { data: null, error: 'An unexpected error occurred' };
  }
}

export async function createAddonGroup(formData: {
  name: string;
  description?: string;
  is_required?: boolean;
  multiple_choice?: boolean;
  sort_order?: number;
  is_active?: boolean;
}): Promise<{ data: AddonGroup | null; error: string | null }> {
  try {
    const supabase = await createServiceRoleClient();

    const { data, error } = await supabase
      .from('addon_groups')
      .insert([{
        name: formData.name,
        description: formData.description || null,
        is_required: formData.is_required ?? false,
        multiple_choice: formData.multiple_choice ?? true,
        sort_order: formData.sort_order || 0,
        is_active: formData.is_active !== undefined ? formData.is_active : true
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating addon group:', error);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (error) {
    console.error('Unexpected error creating addon group:', error);
    return { data: null, error: 'An unexpected error occurred' };
  }
}

export async function updateAddonGroup(
  id: string,
  formData: {
    name: string;
    description?: string;
    is_required?: boolean;
    multiple_choice?: boolean;
    sort_order?: number;
    is_active?: boolean;
  }
): Promise<{ data: AddonGroup | null; error: string | null }> {
  try {
    const supabase = await createServiceRoleClient();

    const { data, error } = await supabase
      .from('addon_groups')
      .update({
        name: formData.name,
        description: formData.description || null,
        is_required: formData.is_required ?? false,
        multiple_choice: formData.multiple_choice ?? true,
        sort_order: formData.sort_order || 0,
        is_active: formData.is_active !== undefined ? formData.is_active : true
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating addon group:', error);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (error) {
    console.error('Unexpected error updating addon group:', error);
    return { data: null, error: 'An unexpected error occurred' };
  }
}

export async function deleteAddonGroup(id: string): Promise<{ error: string | null }> {
  try {
    const supabase = await createServiceRoleClient();

    // Check if group is used by any products
    const { data: usedBy, error: checkError } = await supabase
      .from('sale_product_addon_groups')
      .select('sale_product_id')
      .eq('addon_group_id', id)
      .limit(1);

    if (checkError) {
      console.error('Error checking addon group usage:', checkError);
      return { error: checkError.message };
    }

    if (usedBy && usedBy.length > 0) {
      return { error: 'Cannot delete addon group that is attached to menu items. Please remove it from all menu items first.' };
    }

    // Delete the group (items will be cascade deleted)
    const { error } = await supabase
      .from('addon_groups')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting addon group:', error);
      return { error: error.message };
    }

    return { error: null };
  } catch (error) {
    console.error('Unexpected error deleting addon group:', error);
    return { error: 'An unexpected error occurred' };
  }
}

// Add-on Items CRUD
export async function createAddonItem(formData: {
  addon_group_id: string;
  name: string;
  extra_price: number;
  sort_order?: number;
  is_active?: boolean;
}): Promise<{ data: AddonItem | null; error: string | null }> {
  try {
    const supabase = await createServiceRoleClient();

    const { data, error } = await supabase
      .from('addon_items')
      .insert([{
        addon_group_id: formData.addon_group_id,
        name: formData.name,
        extra_price: formData.extra_price,
        sort_order: formData.sort_order || 0,
        is_active: formData.is_active !== undefined ? formData.is_active : true
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating addon item:', error);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (error) {
    console.error('Unexpected error creating addon item:', error);
    return { data: null, error: 'An unexpected error occurred' };
  }
}

export async function updateAddonItem(
  id: string,
  formData: {
    name: string;
    extra_price: number;
    sort_order?: number;
    is_active?: boolean;
  }
): Promise<{ data: AddonItem | null; error: string | null }> {
  try {
    const supabase = await createServiceRoleClient();

    const { data, error } = await supabase
      .from('addon_items')
      .update({
        name: formData.name,
        extra_price: formData.extra_price,
        sort_order: formData.sort_order || 0,
        is_active: formData.is_active !== undefined ? formData.is_active : true
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating addon item:', error);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (error) {
    console.error('Unexpected error updating addon item:', error);
    return { data: null, error: 'An unexpected error occurred' };
  }
}

export async function deleteAddonItem(id: string): Promise<{ error: string | null }> {
  try {
    const supabase = await createServiceRoleClient();

    const { error } = await supabase
      .from('addon_items')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting addon item:', error);
      return { error: error.message };
    }

    return { error: null };
  } catch (error) {
    console.error('Unexpected error deleting addon item:', error);
    return { error: 'An unexpected error occurred' };
  }
}

export async function setAddonGroupSortOrders(
  updates: Array<{ id: string; sort_order: number }>
): Promise<{ error: string | null }> {
  try {
    const supabase = await createServiceRoleClient();

    const results = await Promise.all(
      updates.map((u) =>
        supabase
          .from('addon_groups')
          .update({ sort_order: u.sort_order })
          .eq('id', u.id)
      )
    );

    const firstError = results.find((r) => r.error)?.error;
    if (firstError) {
      console.error('Error updating addon group sort orders:', firstError);
      return { error: firstError.message };
    }

    return { error: null };
  } catch (error) {
    console.error('Unexpected error updating addon group sort orders:', error);
    return { error: 'An unexpected error occurred' };
  }
}

export async function setAddonItemSortOrders(
  updates: Array<{ id: string; sort_order: number }>
): Promise<{ error: string | null }> {
  try {
    const supabase = await createServiceRoleClient();

    const results = await Promise.all(
      updates.map((u) =>
        supabase
          .from('addon_items')
          .update({ sort_order: u.sort_order })
          .eq('id', u.id)
      )
    );

    const firstError = results.find((r) => r.error)?.error;
    if (firstError) {
      console.error('Error updating addon item sort orders:', firstError);
      return { error: firstError.message };
    }

    return { error: null };
  } catch (error) {
    console.error('Unexpected error updating addon item sort orders:', error);
    return { error: 'An unexpected error occurred' };
  }
}

// Sale Product Add-on Groups management
export async function getSaleProductAddonGroups(sale_product_id: string): Promise<{ data: AddonGroup[] | null; error: string | null }> {
  try {
    const supabase = await createServiceRoleClient();

    const { data, error } = await supabase
      .from('sale_product_addon_groups')
      .select(`
        addon_group_id,
        addon_groups (*)
      `)
      .eq('sale_product_id', sale_product_id);

    if (error) {
      console.error('Error fetching sale product addon groups:', error);
      return { data: null, error: error.message };
    }

    const groups = data?.map(item => {
      // Handle the case where addon_groups might be an array or object
      const group = Array.isArray(item.addon_groups) ? item.addon_groups[0] : item.addon_groups;
      return group as AddonGroup;
    }).filter((group): group is AddonGroup => group !== null && group !== undefined) || [];
    return { data: groups, error: null };
  } catch (error) {
    console.error('Unexpected error fetching sale product addon groups:', error);
    return { data: null, error: 'An unexpected error occurred' };
  }
}

// Optimized helper for product customization: fetch groups + items in a single round-trip
export async function getSaleProductAddonGroupsWithItems(
  sale_product_id: string
): Promise<{ data: AddonGroupWithItems[] | null; error: string | null }> {
  try {
    const supabase = await createServiceRoleClient();

    const { data, error } = await supabase
      .from('sale_product_addon_groups')
      .select(`
        addon_group_id,
        addon_groups (
          *,
          addon_items (*)
        )
      `)
      .eq('sale_product_id', sale_product_id);

    if (error) {
      console.error('Error fetching sale product addon groups with items:', error);
      return { data: null, error: error.message };
    }

    const groups: AddonGroupWithItems[] = (
      data
        ?.map((row) => {
          const group = Array.isArray(row.addon_groups) ? row.addon_groups[0] : row.addon_groups;
          if (!group) return null;
          const items = (group.addon_items || []) as AddonItem[];
          const { addon_items, ...rest } = group as any;
          return {
            ...(rest as AddonGroup),
            items,
            item_count: items.length,
          } as AddonGroupWithItems;
        })
        .filter((g): g is AddonGroupWithItems => g !== null) || []
    );

    return { data: groups, error: null };
  } catch (error) {
    console.error('Unexpected error fetching sale product addon groups with items:', error);
    return { data: null, error: 'An unexpected error occurred' };
  }
}

export async function updateSaleProductAddonGroups(
  sale_product_id: string,
  addon_group_ids: string[]
): Promise<{ error: string | null }> {
  try {
    const supabase = await createServiceRoleClient();

    // Delete existing relationships
    const { error: deleteError } = await supabase
      .from('sale_product_addon_groups')
      .delete()
      .eq('sale_product_id', sale_product_id);

    if (deleteError) {
      console.error('Error deleting sale product addon groups:', deleteError);
      return { error: deleteError.message };
    }

    // Insert new relationships
    if (addon_group_ids.length > 0) {
      const relationships = addon_group_ids.map(addon_group_id => ({
        sale_product_id,
        addon_group_id
      }));

      const { error: insertError } = await supabase
        .from('sale_product_addon_groups')
        .insert(relationships);

      if (insertError) {
        console.error('Error inserting sale product addon groups:', insertError);
        return { error: insertError.message };
      }
    }

    return { error: null };
  } catch (error) {
    console.error('Unexpected error updating sale product addon groups:', error);
    return { error: 'An unexpected error occurred' };
  }
}
