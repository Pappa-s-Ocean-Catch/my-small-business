import React, { useEffect, useState, useRef, ReactElement } from 'react';
import { getSupabaseClient } from '@my-small-business/supabase/client';
import { FaShoppingCart, FaChevronDown, FaChevronUp, FaCheckCircle, FaSpinner, FaTimesCircle, FaExclamationTriangle } from 'react-icons/fa';
import { Icon } from '@/components/Icon';
import Link from 'next/link';
import clsx from 'clsx';

type LiveOrder = {
    id: string;
    order_number: string;
    order_status: string;
    total: number;
    created_at: string;
    updated_at: string;
    items: Array<{ id: string; name: string; quantity: number; price: number; total: number }>;
};

interface LiveOrderTrackerProps {
    userId: string | null;
    minimized?: boolean;
    onMinimize?: () => void;
    onExpand?: () => void;
    hideFloatBubble?: boolean;
}

const STATUS_LABELS: Record<string, string> = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    preparing: 'Preparing',
    ready: 'Ready',
    completed: 'Completed',
    cancelled: 'Cancelled',
};

const STATUS_ICONS: Record<string, ReactElement> = {
    pending: <Icon icon={FaSpinner} className="text-yellow-500 animate-spin" />,
    confirmed: <Icon icon={FaCheckCircle} className="text-blue-500" />,
    preparing: <Icon icon={FaSpinner} className="text-purple-500 animate-spin" />,
    ready: <Icon icon={FaCheckCircle} className="text-green-500" />,
    completed: <Icon icon={FaCheckCircle} className="text-green-600" />,
    cancelled: <Icon icon={FaTimesCircle} className="text-red-500" />,
};

export function LiveOrderTracker({ userId, minimized = false, onMinimize, onExpand, hideFloatBubble = false }: LiveOrderTrackerProps) {
    const [orders, setOrders] = useState<LiveOrder[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isMinimized, setIsMinimized] = useState(minimized);
    const [activeIndex, setActiveIndex] = useState(0);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    // Fetch live orders (not completed/cancelled, last 24h) for real user directly from Supabase
    const fetchOrders = async () => {
        if (!userId) {
            setOrders([]);
            return;
        }
        setError(null);
        try {
            const supabase = getSupabaseClient();
            const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            const { data, error } = await supabase
                .from('orders')
                .select('id, order_number, order_status, total, created_at, updated_at')
                .eq('user_id', userId)
                .in('order_status', ['pending', 'confirmed', 'preparing', 'ready'])
                .gte('created_at', since)
                .order('created_at', { ascending: false });
            if (error) throw error;
            if (Array.isArray(data)) {
                setOrders(
                    data.map((order: Partial<LiveOrder>) => ({
                        id: order.id!,
                        order_number: order.order_number!,
                        order_status: order.order_status!,
                        total: order.total!,
                        created_at: order.created_at!,
                        updated_at: order.updated_at!,
                        items: [],
                    }))
                );
            }
        } catch (err) {
            setError('Could not load live orders');
        }
    };

    useEffect(() => {
        fetchOrders();
        intervalRef.current = setInterval(fetchOrders, 10000);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

    const handleMinimize = () => {
        setIsMinimized(true);
        onMinimize?.();
    };
    const handleExpand = () => {
        setIsMinimized(false);
        onExpand?.();
    };

    // Only show widget if user is logged in, has live orders, and no error
    if (!userId || error || orders.length === 0 || hideFloatBubble) return null;
    // Clamp activeIndex to valid range
    const safeIndex = Math.max(0, Math.min(activeIndex, orders.length - 1));

    // Show as floating bubble at right-middle on mobile when minimized
    if (isMinimized) {
        return (
            <button
                className="fixed z-50 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-full p-3 shadow-lg flex items-center gap-2 hover:scale-105 transition-all
          right-6 bottom-6 md:bottom-auto md:top-1/2 md:-translate-y-1/2 md:right-6 md:left-auto
          sm:right-6 sm:bottom-6 sm:top-auto sm:translate-y-0"
                style={{
                    // On small screens, place at right-middle to avoid cart icon
                    right: '1.5rem',
                    bottom: 'auto',
                    top: '50%',
                    transform: 'translateY(-50%)',
                }}
                onClick={handleExpand}
                aria-label="Expand live order tracker"
            >
                <Icon icon={FaShoppingCart} className="w-6 h-6 text-blue-600" />
                {orders.length > 0 && <span className="text-xs font-semibold">{orders.length}</span>}
                <Icon icon={FaChevronUp} className="w-4 h-4 text-gray-400" />
            </button>
        );
    }

    // Show as sticky panel at top of page, always visible and above all elements
    const order = orders[safeIndex];
    return (
        <div className="sticky top-0 left-0 w-full z-[9999] bg-white dark:bg-neutral-900 border-b border-blue-600 shadow-2xl animate-fade-in">
            <div className="max-w-3xl mx-auto p-2 flex flex-col items-center">
                <div
                    className="rounded-lg px-4 py-3 flex flex-col gap-1 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group w-full"
                    onClick={() => window.location.href = `/order/confirmation?order=${order.order_number}`}
                    tabIndex={0}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') window.location.href = `/order/confirmation?order=${order.order_number}`; }}
                    aria-label={`View order #${order.order_number}`}
                >
                    <div className="flex items-center gap-2">
                        {STATUS_ICONS[order.order_status] || <Icon icon={FaShoppingCart} className="text-gray-400" />}
                        <span className={clsx('text-sm font-semibold', order.order_status === 'cancelled' && 'line-through')}>{STATUS_LABELS[order.order_status] || order.order_status}</span>
                        <span className="ml-auto text-xs text-gray-400">{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-700 dark:text-gray-200">Order #{order.order_number}</span>
                        <span className="ml-auto text-xs font-bold text-blue-700 dark:text-blue-300">${order.total.toFixed(2)}</span>
                    </div>
                </div>
                {orders.length > 1 && (
                    <div className="flex gap-2 mt-2">
                        <button
                            className="px-2 py-1 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 font-semibold disabled:opacity-50"
                            onClick={() => setActiveIndex(i => Math.max(0, i - 1))}
                            disabled={safeIndex === 0}
                        >
                            Prev
                        </button>
                        <span className="text-xs text-gray-500 dark:text-gray-400 self-center">{safeIndex + 1} / {orders.length}</span>
                        <button
                            className="px-2 py-1 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 font-semibold disabled:opacity-50"
                            onClick={() => setActiveIndex(i => Math.min(orders.length - 1, i + 1))}
                            disabled={safeIndex === orders.length - 1}
                        >
                            Next
                        </button>
                    </div>
                )}
            </div>
            <button
                onClick={handleMinimize}
                aria-label="Minimize"
                className="absolute top-2 right-2 bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center hover:opacity-80"
            >
                <Icon icon={FaChevronDown} className="w-4 h-4" />
            </button>
        </div>
    );
}
