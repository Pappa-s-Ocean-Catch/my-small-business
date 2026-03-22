import { NextRequest, NextResponse } from 'next/server';
import { likeItem } from '@/app/actions/social-activity';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { userId, itemId, isLike } = body;
        if (!userId || !itemId || typeof isLike !== 'boolean') {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }
        const result = await likeItem({ userId, itemId, isLike });
        if (result.error) {
            return NextResponse.json({ error: result.error.message || 'Failed to like/dislike item' }, { status: 500 });
        }
        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}
