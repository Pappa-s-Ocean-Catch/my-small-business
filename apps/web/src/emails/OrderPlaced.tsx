import * as React from 'react';
import { EmailLayout } from './components/EmailLayout';
import { Tailwind } from '@react-email/tailwind';
import { Container, Section, Text } from '@react-email/components';
import type { Order, OrderItem, OrderItemAddon } from '@my-small-business/types';

interface OrderPlacedEmailProps {
    order: Order;
    businessName?: string;
    logoUrl?: string;
}

const STORE_TIME_ZONE = 'Australia/Melbourne';

function getDateTimeParts(date: Date, options: Intl.DateTimeFormatOptions) {
    return Object.fromEntries(
        new Intl.DateTimeFormat('en-US', {
            timeZone: STORE_TIME_ZONE,
            ...options,
        }).formatToParts(date).map((part) => [part.type, part.value])
    );
}

function formatMelbournePickupTime(dateValue: string) {
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return dateValue;

    const todayInMelbourne = new Intl.DateTimeFormat('en-CA', {
        timeZone: STORE_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date());
    const pickupDayInMelbourne = new Intl.DateTimeFormat('en-CA', {
        timeZone: STORE_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(date);

    if (pickupDayInMelbourne === todayInMelbourne) {
        const parts = getDateTimeParts(date, {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });
        return `${parts.hour}:${parts.minute} ${parts.dayPeriod}`;
    }

    const parts = getDateTimeParts(date, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });
    return `${parts.weekday}, ${parts.month} ${parts.day} @ ${parts.hour}:${parts.minute} ${parts.dayPeriod}`;
}

function renderItem(item: OrderItem) {
    const addons = item.addons ?? [];
    return (
        <Section key={item.id} className="mb-2">
            <Text className="font-bold text-base m-0">
                {item.quantity}x {item.product_name}
            </Text>
            {addons.length > 0 && (
                <Text className="text-sm text-gray-700 m-0">
                    Add-ons: {addons.map((addon: OrderItemAddon) => addon.addon_item_name).join(', ')}
                </Text>
            )}
            {item.comment && (
                <Text className="text-sm text-gray-700 m-0">Note: {item.comment}</Text>
            )}
            <Text className="text-sm text-gray-700 m-0">Price: ${item.subtotal.toFixed(2)}</Text>
        </Section>
    );
}
export const OrderPlacedEmail = ({ order, businessName = 'OperateFlow', logoUrl }: OrderPlacedEmailProps) => {
    const greetingName = order.customer_name && order.customer_name.trim().length > 0 ? order.customer_name : 'there';
    const rewardPointsUsed = order.reward_points_used ?? 0;
    const rewardPointsValue = order.reward_points_value ?? 0;
    // Use env or fallback for site URL
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.pappasfishnchips.com.au';
    const orderLink = `${siteUrl}/order/confirmation?order=${order.order_number}`;
    return (
        <EmailLayout
            title={`${businessName} - Order Confirmation`}
            companyName={businessName}
            logoUrl={logoUrl}
            previewText={`Order #${order.order_number} placed successfully.`}
        >
            <Tailwind>
                <Container className="max-w-lg mx-auto font-sans">
                    <Section className="p-0">
                        <Text className="text-base text-gray-800 m-0 mb-3">
                            Hi {greetingName},
                        </Text>
                        <Text className="text-base text-gray-700 mb-4 m-0">
                            Your order <strong>
                                <a href={orderLink} style={{ color: '#2563eb', textDecoration: 'underline' }} target="_blank" rel="noopener noreferrer">
                                    #{order.order_number}
                                </a>
                            </strong> was placed successfully.
                        </Text>
                        <Text className="text-base text-gray-700 mb-2 m-0">
                            You can <a href={orderLink} style={{ color: '#2563eb', textDecoration: 'underline' }} target="_blank" rel="noopener noreferrer">track your order status here</a> at any time.
                        </Text>
                        {order.scheduled_pickup_at ? (
                            <Text className="text-base text-gray-700 mb-2 m-0">
                                Your order is scheduled for {order.order_type === 'delivery' ? 'delivery' : 'pickup'} at <strong>{
                                    formatMelbournePickupTime(order.scheduled_pickup_at)
                                }</strong>.
                            </Text> 
                        ) : (
                            <Text className="text-base text-gray-700 mb-2 m-0">
                                Most orders are ready for pickup about <strong>10 minutes</strong> after being placed. We'll update your order status on the website.
                            </Text>
                        )}
                        <Text className="text-base text-gray-700 mb-2 m-0">
                            If you have any questions or need help, please call us at <a href="tel:+61397438150" style={{ color: '#2563eb', textDecoration: 'underline' }}>+61 3 9743 8150</a>.
                        </Text>
                        <Text className="text-base text-gray-700 mb-4 m-0">
                            Here are your order details:
                        </Text>
                        {order.items?.map(renderItem)}
                        <Section className="mt-4">
                            <Text className="text-base text-gray-700 m-0">Subtotal: ${order.subtotal.toFixed(2)}</Text>
                            {(order.promotion_discount ?? 0) > 0 && (
                                <Text className="text-base text-green-700 m-0">Promotions: -${Number(order.promotion_discount).toFixed(2)}</Text>
                            )}
                            {(order.coupon_discount ?? 0) > 0 && (
                                <Text className="text-base text-green-700 m-0">Coupon ({order.coupon_code}): -${Number(order.coupon_discount).toFixed(2)}</Text>
                            )}
                            {rewardPointsUsed > 0 && rewardPointsValue > 0 && (
                                <Text className="text-base text-green-700 m-0">Points Applied ({rewardPointsUsed.toLocaleString()} pts): -${rewardPointsValue.toFixed(2)}</Text>
                            )}
                            {order.tax > 0 && <Text className="text-base text-gray-700 m-0">Tax: ${order.tax.toFixed(2)}</Text>}
                            {order.delivery_fee > 0 && <Text className="text-base text-gray-700 m-0">Delivery: ${order.delivery_fee.toFixed(2)}</Text>}
                            {order.service_fee > 0 && <Text className="text-base text-gray-700 m-0">Service Fee: ${order.service_fee.toFixed(2)}</Text>}
                            <Text className="font-bold text-base text-gray-900 m-0">Total: ${order.total.toFixed(2)}</Text>
                        </Section>
                        <Text className="text-base text-gray-700 mb-0 m-0 mt-4">
                            Thank you for ordering with {businessName}!
                        </Text>
                    </Section>
                </Container>
            </Tailwind>
        </EmailLayout>
    );
};
