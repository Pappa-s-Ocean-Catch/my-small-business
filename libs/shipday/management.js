"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDeliveryStoreAddress = getDeliveryStoreAddress;
exports.getDeliveryAddressText = getDeliveryAddressText;
exports.getShipdayManagementClient = getShipdayManagementClient;
const getShipdayApiKey = () => process.env.SHIPDAY_API_KEY || '';
function getDeliveryStoreAddress() {
    return {
        address_line1: '123 Fake Street',
        city: 'Sydney',
        state: 'NSW',
        postcode: '2000',
        country: 'AU'
    };
}
function getDeliveryAddressText(address) {
    const parts = [
        address.address_line1,
        address.address_line2,
        address.city,
        address.state,
        address.postcode
    ].filter(Boolean);
    return parts.join(', ');
}
async function fetchWithTimeout(url, options, timeoutMs = 15000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        return response;
    }
    finally {
        clearTimeout(id);
    }
}
function getShipdayManagementClient() {
    const apiKey = getShipdayApiKey();
    const headers = {
        'Authorization': `Basic ${apiKey}`,
        'Content-Type': 'application/json'
    };
    const baseUrl = 'https://api.shipday.com';
    return {
        async listOrders({ status, from, to, page }) {
            const cursor = page > 1 ? `?cursor=${page}` : '';
            const response = await fetchWithTimeout(`${baseUrl}/orders/query${cursor}`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    timeCondition: {
                        condition: "CREATED_AT",
                        startTime: from,
                        endTime: to
                    }
                })
            });
            if (!response.ok)
                throw new Error(`Failed to list orders: ${response.statusText}`);
            const data = await response.json();
            let allOrders = data.orders || [];
            if (status) {
                allOrders = allOrders.filter((o) => o.orderStatus?.orderState === status);
            }
            return {
                orders: allOrders.map((o) => ({
                    id: String(o.orderId),
                    reference: o.orderNumber,
                    status: o.orderStatus?.orderState || 'UNKNOWN',
                    customerName: o.customer?.name || '',
                    customerPhone: o.customer?.phoneNumber || '',
                    pickupAddress: o.restaurant?.address || '',
                    deliveryAddress: o.customer?.address || '',
                    createdAt: o.createdDate || null,
                    driverName: o.carrier?.name || null,
                    driverPhone: o.carrier?.phoneNumber || null,
                    trackingUrl: o.trackingLink || null,
                    deliveryFee: o.deliveryFee ? parseFloat(o.deliveryFee) : null,
                    raw: o
                })),
                page,
                hasMore: !!data.nextCursor
            };
        },
        async getOrderDetail(id, reference) {
            const response = await fetchWithTimeout(`${baseUrl}/orders/${reference}`, {
                headers
            });
            if (!response.ok)
                throw new Error(`Failed to get order detail: ${response.statusText}`);
            const data = await response.json();
            const ordersArray = Array.isArray(data) ? data : [data];
            const match = ordersArray.find((o) => String(o.orderId) === id);
            if (!match)
                throw new Error('Order ID mismatch for reference');
            let onDemand = null;
            let onDemandError = undefined;
            try {
                const detailsResponse = await fetchWithTimeout(`${baseUrl}/on-demand/details/${id}`, {
                    headers
                });
                if (detailsResponse.ok) {
                    onDemand = await detailsResponse.json();
                }
                else {
                    onDemandError = 'Failed to load on-demand details';
                }
            }
            catch (e) {
                onDemandError = e.message;
            }
            return {
                order: {
                    id: String(match.orderId),
                    reference: match.orderNumber,
                    status: match.orderStatus?.orderState || 'UNKNOWN',
                    customerName: match.customer?.name || '',
                    customerPhone: match.customer?.phoneNumber || '',
                    pickupAddress: match.restaurant?.address || '',
                    deliveryAddress: match.customer?.address || '',
                    createdAt: match.createdDate || null,
                    driverName: match.carrier?.name || null,
                    driverPhone: match.carrier?.phoneNumber || null,
                    trackingUrl: match.trackingLink || null,
                    deliveryFee: match.deliveryFee ? parseFloat(match.deliveryFee) : null,
                    raw: match
                },
                onDemand,
                onDemandError
            };
        },
        async findOrderByReference(reference) {
            try {
                const response = await fetchWithTimeout(`${baseUrl}/orders/${reference}`, {
                    headers
                });
                if (!response.ok)
                    return null;
                const data = await response.json();
                const ordersArray = Array.isArray(data) ? data : [data];
                if (ordersArray.length === 0)
                    return null;
                const match = ordersArray[0];
                return {
                    id: String(match.orderId),
                    reference: match.orderNumber,
                    status: match.orderStatus?.orderState || 'UNKNOWN',
                    customerName: match.customer?.name || '',
                    customerPhone: match.customer?.phoneNumber || '',
                    pickupAddress: match.restaurant?.address || '',
                    deliveryAddress: match.customer?.address || '',
                    createdAt: match.createdDate || null,
                    driverName: match.carrier?.name || null,
                    driverPhone: match.carrier?.phoneNumber || null,
                    trackingUrl: match.trackingLink || null,
                    deliveryFee: match.deliveryFee ? parseFloat(match.deliveryFee) : null,
                    raw: match
                };
            }
            catch {
                return null;
            }
        },
        async getQuotes(address) {
            const storeAddress = getDeliveryStoreAddress();
            const response = await fetchWithTimeout(`${baseUrl}/on-demand/availability`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    pickupAddress: getDeliveryAddressText(storeAddress),
                    dropoffAddress: getDeliveryAddressText(address)
                })
            });
            if (!response.ok)
                throw new Error(`Failed to get quotes: ${response.statusText}`);
            const data = await response.json();
            return (data || []).map((quote) => ({
                id: null,
                provider: quote.name,
                fee: parseFloat(quote.fee),
                currency: quote.currency || 'AUD',
                pickupAt: quote.pickupTime || null,
                deliveryAt: quote.deliveryTime || null,
                pickupMinutes: quote.pickupMinutes || null,
                deliveryMinutes: quote.deliveryMinutes || null
            }));
        },
        async createOrder(params) {
            const storeAddress = getDeliveryStoreAddress();
            const response = await fetchWithTimeout(`${baseUrl}/orders`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    orderNumber: params.reference,
                    customerName: params.recipient.name,
                    customerAddress: getDeliveryAddressText(params.address),
                    customerPhoneNumber: params.recipient.phone,
                    customerEmail: params.recipient.email || '',
                    restaurantName: 'Pappas Ocean Catch',
                    restaurantAddress: getDeliveryAddressText(storeAddress),
                    deliveryInstruction: params.address.delivery_instructions || ''
                })
            });
            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Failed to create order: ${errText}`);
            }
            const data = await response.json();
            if (!data || !data.orderId)
                throw new Error('Order created but no orderId returned');
            return String(data.orderId);
        },
        async getEstimates(id) {
            const response = await fetchWithTimeout(`${baseUrl}/on-demand/estimate/${id}`, {
                headers
            });
            if (!response.ok)
                throw new Error(`Failed to get estimates: ${response.statusText}`);
            const data = await response.json();
            return (data || []).map((quote) => ({
                id: quote.estimateReference,
                provider: quote.name,
                fee: parseFloat(quote.fee),
                currency: quote.currency || 'AUD',
                pickupAt: quote.pickupTime || null,
                deliveryAt: quote.deliveryTime || null,
                pickupMinutes: quote.pickupMinutes || null,
                deliveryMinutes: quote.deliveryMinutes || null
            }));
        },
        async assignDelivery(id, quote) {
            if (!quote.id)
                throw new Error('Cannot assign delivery without an estimateReference (id)');
            const response = await fetchWithTimeout(`${baseUrl}/on-demand/assign`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    orderId: parseInt(id, 10),
                    estimateReference: quote.id
                })
            });
            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Failed to assign delivery: ${errText}`);
            }
            return await response.json();
        },
        async getOnDemandDetails(id) {
            try {
                const response = await fetchWithTimeout(`${baseUrl}/on-demand/details/${id}`, {
                    headers
                });
                if (!response.ok)
                    return null;
                return await response.json();
            }
            catch {
                return null;
            }
        }
    };
}
