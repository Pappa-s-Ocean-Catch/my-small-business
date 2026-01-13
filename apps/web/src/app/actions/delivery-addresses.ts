'use server';

import { createServiceRoleClient, createServerSupabaseClient } from '@my-small-business/supabase/server';

export interface DeliveryAddress {
  id: string;
  user_id: string;
  label: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  postcode: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface DeliveryAddressInput {
  label: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  postcode: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  is_default?: boolean;
}

/**
 * Get saved delivery addresses for the current user
 */
export async function getDeliveryAddresses(): Promise<{ data: DeliveryAddress[]; error: string | null }> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { data: [], error: 'User not authenticated' };
    }

    const { data, error } = await supabase
      .from('delivery_addresses')
      .select('*')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching delivery addresses:', error);
      return { data: [], error: error.message };
    }

    return { data: data || [], error: null };
  } catch (error) {
    console.error('Error fetching delivery addresses:', error);
    return { data: [], error: error instanceof Error ? error.message : 'Failed to fetch delivery addresses' };
  }
}

/**
 * Create a new delivery address
 */
export async function createDeliveryAddress(
  input: DeliveryAddressInput
): Promise<{ data: DeliveryAddress | null; error: string | null }> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { data: null, error: 'User not authenticated' };
    }

    // If this is set as default, we'll let the database trigger handle unsetting others
    const { data, error } = await supabase
      .from('delivery_addresses')
      .insert({
        user_id: user.id,
        label: input.label,
        address_line1: input.address_line1,
        address_line2: input.address_line2 || null,
        city: input.city,
        state: input.state,
        postcode: input.postcode,
        country: input.country || 'AU',
        latitude: input.latitude || null,
        longitude: input.longitude || null,
        is_default: input.is_default || false,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating delivery address:', error);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (error) {
    console.error('Error creating delivery address:', error);
    return { data: null, error: error instanceof Error ? error.message : 'Failed to create delivery address' };
  }
}

/**
 * Update a delivery address
 */
export async function updateDeliveryAddress(
  id: string,
  input: Partial<DeliveryAddressInput>
): Promise<{ data: DeliveryAddress | null; error: string | null }> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { data: null, error: 'User not authenticated' };
    }

    // Verify ownership
    const { data: existing } = await supabase
      .from('delivery_addresses')
      .select('user_id')
      .eq('id', id)
      .single();

    if (!existing || existing.user_id !== user.id) {
      return { data: null, error: 'Address not found or access denied' };
    }

    const updateData: any = {};
    if (input.label !== undefined) updateData.label = input.label;
    if (input.address_line1 !== undefined) updateData.address_line1 = input.address_line1;
    if (input.address_line2 !== undefined) updateData.address_line2 = input.address_line2 || null;
    if (input.city !== undefined) updateData.city = input.city;
    if (input.state !== undefined) updateData.state = input.state;
    if (input.postcode !== undefined) updateData.postcode = input.postcode;
    if (input.country !== undefined) updateData.country = input.country || 'AU';
    if (input.latitude !== undefined) updateData.latitude = input.latitude || null;
    if (input.longitude !== undefined) updateData.longitude = input.longitude || null;
    if (input.is_default !== undefined) updateData.is_default = input.is_default;

    const { data, error } = await supabase
      .from('delivery_addresses')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating delivery address:', error);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (error) {
    console.error('Error updating delivery address:', error);
    return { data: null, error: error instanceof Error ? error.message : 'Failed to update delivery address' };
  }
}

/**
 * Delete a delivery address
 */
export async function deleteDeliveryAddress(id: string): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    // Verify ownership
    const { data: existing } = await supabase
      .from('delivery_addresses')
      .select('user_id')
      .eq('id', id)
      .single();

    if (!existing || existing.user_id !== user.id) {
      return { success: false, error: 'Address not found or access denied' };
    }

    const { error } = await supabase
      .from('delivery_addresses')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting delivery address:', error);
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (error) {
    console.error('Error deleting delivery address:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to delete delivery address' };
  }
}
