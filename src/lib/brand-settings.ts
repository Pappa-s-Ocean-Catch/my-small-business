import { createServiceRoleClient } from '@/lib/supabase/server';

export interface BrandSettings {
  id: string;
  business_name: string;
  slogan: string | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

export async function getBrandSettings(): Promise<BrandSettings | null> {
  try {
    const supabase = await createServiceRoleClient();
    const { data, error } = await supabase
      .from('brand_settings')
      .select('*')
      .maybeSingle();
    
    if (error) {
      console.error('Error fetching brand settings:', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Error fetching brand settings:', error);
    return null;
  }
}

export function getDefaultBrandSettings(): BrandSettings {
  return {
    id: '',
    business_name: 'OperateFlow',
    slogan: 'Streamline Your Operations',
    logo_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}
