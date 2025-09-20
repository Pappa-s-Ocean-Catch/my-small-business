'use server';

import { createServiceRoleClient } from '@/lib/supabase/server';

export interface Section {
  id: string;
  name: string;
  description: string | null;
  color: string;
  active: boolean;
  sort_order: number;
}

export interface UpdateSectionOrderRequest {
  sections: Array<{
    id: string;
    sort_order: number;
  }>;
}

/**
 * Update the sort order of multiple sections in batch
 */
export async function updateSectionOrder(request: UpdateSectionOrderRequest): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServiceRoleClient();
    
    // Validate input
    if (!request.sections || !Array.isArray(request.sections) || request.sections.length === 0) {
      return { success: false, error: 'Invalid sections data' };
    }

    // Update each section's sort order
    const updatePromises = request.sections.map(section => 
      supabase
        .from('sections')
        .update({ sort_order: section.sort_order })
        .eq('id', section.id)
    );

    const results = await Promise.all(updatePromises);
    
    // Check for any errors
    const errors = results.filter(result => result.error);
    if (errors.length > 0) {
      console.error('Error updating section orders:', errors);
      return { success: false, error: 'Failed to update some section orders' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in updateSectionOrder:', error);
    return { success: false, error: 'Internal server error' };
  }
}

/**
 * Get all sections ordered by sort_order
 */
export async function getSections(): Promise<{ success: boolean; data?: Section[]; error?: string }> {
  try {
    const supabase = await createServiceRoleClient();
    
    const { data, error } = await supabase
      .from('sections')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching sections:', error);
      return { success: false, error: 'Failed to fetch sections' };
    }

    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Error in getSections:', error);
    return { success: false, error: 'Internal server error' };
  }
}
