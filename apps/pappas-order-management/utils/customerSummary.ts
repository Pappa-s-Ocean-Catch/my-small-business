import { supabase } from '@/lib/supabase';
import { Order } from '@/types/order';

export interface CustomerRewardHistoryItem {
    id: string;
    orderId: string | null;
    type: 'earned' | 'used' | 'expired' | 'adjusted';
    points: number;
    balanceAfter: number;
    description: string | null;
    createdAt: string;
    dollarValue: number;
    adjustmentType?: 'credit' | 'debit' | null;
    adjustedByName?: string | null;
}

export interface CustomerSummary {
    profileId?: string;
    name: string;
    email: string;
    phone: string;
    signUpDate: string;
    totalOrders: number;
    lastOrderDate: string;
    totalAmount: number;
    rewardPoints: number;
    orders: Array<{
        id: string;
        orderNumber: string;
        date: string;
        total: number;
        status: string;
    }>;
    rewardHistory: CustomerRewardHistoryItem[];
}

export async function fetchCustomerSummary({ email, phone, profileId }: { email?: string; phone?: string; profileId?: string }): Promise<CustomerSummary | null> {
    const normalizedProfileId = profileId?.trim() || undefined;
    if (!normalizedProfileId && !email && !phone) return null;
    let ordersQuery = supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: true });
    if (normalizedProfileId) {
        ordersQuery = ordersQuery.eq('user_id', normalizedProfileId);
    } else {
        const orFilter = [];
        if (email) orFilter.push(`customer_email.eq.${email}`);
        if (phone) orFilter.push(`customer_phone.eq.${phone}`);
        ordersQuery = ordersQuery.or(orFilter.join(','));
    }
    const { data: orders, error } = await ordersQuery;
    if (error) {
        throw new Error(error.message);
    }
    if (!orders || orders.length === 0) return null;
    const name = orders[0].customer_name || '';
    const signUpDate = orders[0].created_at;
    const totalOrders = orders.length;
    const lastOrderDate = orders[orders.length - 1].created_at;
    const totalAmount = orders.reduce((sum, o) => sum + (o.total || 0), 0);

    // Match customer list: balance comes from customer_summary (user_reward_points.current_balance),
    // not the sum of reward_points_used on orders.
    const rowEmail = (orders[0].customer_email ?? '').trim();
    const rowPhone = (orders[0].customer_phone ?? '').trim();
    let rewardPoints = 0;
    let resolvedProfileId: string | undefined = normalizedProfileId;
    if (!resolvedProfileId && (rowEmail || rowPhone)) {
        let summaryQuery = supabase.from('customer_summary').select('rewardPoints, profileId');
        if (rowEmail) {
            summaryQuery = summaryQuery.eq('email', rowEmail);
        } else if (rowPhone) {
            summaryQuery = summaryQuery.eq('phone', rowPhone);
        }
        const { data: summaryRows, error: summaryError } = await summaryQuery.limit(1);
        if (summaryError) {
            throw new Error(summaryError.message);
        }
        const raw = (summaryRows as any[] | null)?.[0]?.rewardPoints;
        rewardPoints = Number(raw ?? 0);
        resolvedProfileId = (summaryRows as any[] | null)?.[0]?.profileId;
    }
    const orderList = orders.map((o: Order) => ({
        id: o.id,
        orderNumber: o.order_number,
        date: o.created_at,
        total: o.total,
        status: o.order_status,
    }));

    let rewardHistory: CustomerRewardHistoryItem[] = [];
    if (resolvedProfileId) {
        const { data: rewardRows, error: rewardError } = await supabase
            .from('reward_point_transactions')
            .select('id, order_id, transaction_type, points, points_balance_after, description, metadata, created_at')
            .eq('user_id', resolvedProfileId)
            .order('created_at', { ascending: false })
            .limit(25);

        if (rewardError) {
            throw new Error(rewardError.message);
        }

        rewardHistory = (rewardRows || []).map((row: any) => ({
            id: row.id,
            orderId: row.order_id ?? null,
            type: row.transaction_type,
            points: Number(row.points ?? 0),
            balanceAfter: Number(row.points_balance_after ?? 0),
            description: row.description ?? null,
            createdAt: row.created_at,
            dollarValue: Number(row.metadata?.dollar_value ?? 0),
            adjustmentType: row.metadata?.adjustment_type ?? null,
            adjustedByName: row.metadata?.adjusted_by_name ?? null,
        }));
    }

    return {
        profileId: resolvedProfileId,
        name,
        email: orders[0].customer_email,
        phone: orders[0].customer_phone,
        signUpDate,
        totalOrders,
        lastOrderDate,
        totalAmount,
        rewardPoints,
        orders: orderList,
        rewardHistory,
    };
}

export async function updateCustomerNameByContact({
    profileId,
    name,
}: {
    profileId?: string;
    name: string;
}): Promise<{ updatedCount: number }> {
    const trimmedName = name.trim();
    if (!trimmedName) {
        throw new Error('Customer name is required.');
    }

    if (!profileId) {
        throw new Error('This customer does not have a saved profile to update.');
    }

    const { data, error } = await supabase
        .from('profiles')
        .update({
            full_name: trimmedName,
        })
        .eq('id', profileId)
        .select('id');

    if (error) {
        throw new Error(error.message);
    }

    return { updatedCount: data?.length ?? 0 };
}
