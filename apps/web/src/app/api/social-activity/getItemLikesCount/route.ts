import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@my-small-business/supabase/server';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const itemId = searchParams.get('itemId');
    if (!itemId) {
        return NextResponse.json({ error: 'Missing itemId' }, { status: 400 });
    }
    try {
        const supabase = await createServiceRoleClient();
        const { data, error } = await supabase.from('item_likes')
            .select('is_like')
            .eq('item_id', itemId);
        if (error) {
            return NextResponse.json({ error }, { status: 500 });
        }
        const likes = (data || []).filter((d: any) => d.is_like).length;
        const dislikes = (data || []).filter((d: any) => d.is_like === false).length;
        return NextResponse.json({ likes, dislikes });
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
    }
}
