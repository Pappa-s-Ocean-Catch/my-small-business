import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@my-small-business/supabase/server';

// Ensure this route is dynamically evaluated since it fetches database records
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createServiceRoleClient();

    const { data: menus, error } = await supabase
      .from('tv_menus')
      .select('id, name, url, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('[tv-menus GET] Supabase error:', error);
      return NextResponse.json({ success: false, error: 'Failed to fetch menus' }, { status: 500 });
    }

    // Format response to match the expected `{ name, url }` structure
    const formattedMenus = menus.map(menu => ({
      id: menu.id,
      name: menu.name,
      url: menu.url,
      sort_order: menu.sort_order
    }));

    return NextResponse.json({
      success: true,
      menus: formattedMenus,
    });
  } catch (e) {
    console.error('[tv-menus GET] error', e);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
