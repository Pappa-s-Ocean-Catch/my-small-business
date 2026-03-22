import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@my-small-business/supabase/server';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const itemIds = searchParams.get('itemIds'); // comma-separated
    if (!userId || !itemIds) {
        return NextResponse.json({ error: 'Missing userId or itemIds' }, { status: 400 });
    }
    const ids = itemIds.split(',');
    try {
        const supabase = await createServiceRoleClient();
        const { data, error } = await supabase.from('item_likes')
            .select('item_id, is_like')
            .eq('user_id', userId)
            .in('item_id', ids);
        if (error) {
            return NextResponse.json({ error }, { status: 500 });
        }
        // Return a map: { [item_id]: true/false/null }
        const likeMap: Record<string, boolean | null> = {};
        ids.forEach(id => { likeMap[id] = null; });
        data?.forEach(row => { likeMap[row.item_id] = row.is_like; });
        return NextResponse.json({ itemLikes: likeMap });
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
    }
}
