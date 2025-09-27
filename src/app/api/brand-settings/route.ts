import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServiceRoleClient();
    const { data, error } = await supabase
      .from('brand_settings')
      .select('*')
      .maybeSingle();
    
    if (error) {
      console.error('Error fetching brand settings:', error);
      return NextResponse.json({ success: false, error: 'Failed to fetch brand settings' }, { status: 500 });
    }
    
    return NextResponse.json({ 
      success: true, 
      data: data || null 
    });
  } catch (error) {
    console.error('Error fetching brand settings:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch brand settings' }, { status: 500 });
  }
}
