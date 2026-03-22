import { NextRequest, NextResponse } from 'next/server';
import { getOrderReviews } from '@/app/actions/social-activity';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get('orderId');
    if (!orderId) {
        return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });
    }
    try {
        const { reviews, error } = await getOrderReviews(orderId);
        if (error) {
            return NextResponse.json({ error }, { status: 500 });
        }
        return NextResponse.json({ reviews });
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
    }
}
