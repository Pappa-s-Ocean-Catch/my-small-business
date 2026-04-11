import { supabase } from '@/lib/supabase';
import { Order } from '@/types/order';

interface CustomerSummaryRewardRow {
    rewardPoints: number | null;
}

export interface CustomerSummary {
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
}

export async function fetchCustomerSummary({ email, phone }: { email?: string; phone?: string }): Promise<CustomerSummary | null> {
    if (!email && !phone) return null;
    const orFilter = [];
    if (email) orFilter.push(`customer_email.eq.${email}`);
    if (phone) orFilter.push(`customer_phone.eq.${phone}`);
    const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .or(orFilter.join(','))
        .order('created_at', { ascending: true });
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
    if (rowEmail || rowPhone) {
        let summaryQuery = supabase.from('customer_summary').select('rewardPoints');
        if (rowEmail) {
            summaryQuery = summaryQuery.eq('email', rowEmail);
        }
        if (rowPhone) {
            summaryQuery = summaryQuery.eq('phone', rowPhone);
        }
        const { data: summaryRows, error: summaryError } = await summaryQuery.limit(1);
        if (summaryError) {
            throw new Error(summaryError.message);
        }
        const raw = (summaryRows as CustomerSummaryRewardRow[] | null)?.[0]?.rewardPoints;
        rewardPoints = Number(raw ?? 0);
    }
    const orderList = orders.map((o: Order) => ({
        id: o.id,
        orderNumber: o.order_number,
        date: o.created_at,
        total: o.total,
        status: o.order_status,
    }));
    return {
        name,
        email: orders[0].customer_email,
        phone: orders[0].customer_phone,
        signUpDate,
        totalOrders,
        lastOrderDate,
        totalAmount,
        rewardPoints,
        orders: orderList,
    };
}
