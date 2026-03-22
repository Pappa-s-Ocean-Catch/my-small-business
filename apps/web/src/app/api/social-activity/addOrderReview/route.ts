import { NextRequest, NextResponse } from 'next/server';
import { addOrderReview } from '@/app/actions/social-activity';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { userId, orderId, rating, comment } = body;
        if (!userId || !orderId || !rating) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }
        const result = await addOrderReview({ userId, orderId, rating, comment });
        if (result.error) {
            return NextResponse.json({ error: result.error.message || 'Failed to add review' }, { status: 500 });
        }
        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}
