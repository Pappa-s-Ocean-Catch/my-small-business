import { supabase } from '@/lib/supabase';
import { Order } from '@/types/order';

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
    if (error || !orders || orders.length === 0) return null;
    const name = orders[0].customer_name || '';
    const signUpDate = orders[0].created_at;
    const totalOrders = orders.length;
    const lastOrderDate = orders[orders.length - 1].created_at;
    const totalAmount = orders.reduce((sum, o) => sum + (o.total || 0), 0);
    const rewardPoints = orders.reduce((sum, o) => sum + (o.reward_points_used || 0), 0);
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
