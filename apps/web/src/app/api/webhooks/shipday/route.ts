import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@my-small-business/supabase/server';
import { getShipdayPayloadHash } from '@/lib/shipday-event-dedupe';
import { getShipdayOrderStatusUpdate, mapShipdayStatus } from '@/lib/shipday-order-status';
import type { Order } from '@my-small-business/types';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

function collectValues(
  value: JsonValue | undefined,
  keyNames: Set<string>,
  found: string[] = [],
): string[] {
  if (value == null) return found;

  if (Array.isArray(value)) {
    for (const item of value) {
      collectValues(item, keyNames, found);
    }
    return found;
  }

  if (typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      if (keyNames.has(key) && (typeof nested === 'string' || typeof nested === 'number') && String(nested).trim()) {
        found.push(String(nested).trim());
      }
      collectValues(nested as JsonValue, keyNames, found);
    }
  }

  return found;
}

function firstMatch(body: JsonValue | undefined, keys: string[]): string | null {
  const values = collectValues(body, new Set(keys));
  return values.length > 0 ? values[0] : null;
}

function isAuthorized(request: Request): boolean {
  const configured = process.env.SHIPDAY_WEBHOOK_SECRET?.trim();
  if (!configured) return true;

  const tokenHeader = request.headers.get('token')?.trim() ?? '';
  const matched = configured === tokenHeader;

  if (!matched) {
    console.warn('[Shipday Webhook] Unauthorized request', {
      hasTokenHeader: Boolean(tokenHeader),
    });
  }

  return matched;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: JsonValue;
  try {
    body = (await request.json()) as JsonValue;
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const supabase = await createServiceRoleClient();

  const root = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  // The webhook also contains company/carrier/customer IDs and statuses.
  const externalDeliveryId = firstMatch(root.order, ['id', 'orderId'])
    ?? firstMatch(root, ['orderId', 'deliveryId']);
  const externalOrderNumber = firstMatch(body, [
    'orderNumber',
    'order_number',
    'externalOrderId',
    'external_order_id',
  ]);
  const rawStatus = typeof root.order_status === 'string' ? root.order_status
    : firstMatch(body, ['orderState', 'status', 'deliveryStatus', 'orderStatus']);
  const rawEventType = firstMatch(body, ['eventType', 'type', 'event', 'action']);
  const trackingUrl = firstMatch(body, ['trackingUrl', 'tracking_url']);
  const driverName = firstMatch(body, ['driverName', 'dasherName', 'courierName']);
  const driverPhone = firstMatch(body, ['driverPhone', 'dasherPhone', 'courierPhone']);
  const driverPin = firstMatch(body, ['driverPin', 'driver_pin', 'pickupPin', 'pickup_pin', 'verificationPin', 'verification_pin']);
  const vehicleInfo = firstMatch(body, ['vehicleInfo', 'vehicle', 'vehicleDescription']);
  const message = firstMatch(body, ['message', 'note', 'description']);

  let orderId: string | null = null;
  let matchedOrderStatus: string | null = null;
  let matchedOrder: Pick<Order, 'order_status' | 'payment_status'> | null = null;

  if (externalDeliveryId) {
    const { data } = await supabase
      .from('orders')
      .select('id, delivery_status, order_status, payment_status')
      .eq('delivery_provider_id', externalDeliveryId)
      .maybeSingle();
    if (data) {
      orderId = data.id;
      matchedOrderStatus = data.delivery_status;
      matchedOrder = data;
    }
  }

  if (!orderId && externalOrderNumber) {
    const { data } = await supabase
      .from('orders')
      .select('id, delivery_status, order_status, payment_status')
      .eq('order_number', externalOrderNumber)
      .maybeSingle();
    if (data) {
      orderId = data.id;
      matchedOrderStatus = data.delivery_status;
      matchedOrder = data;
    }
  }

  const normalizedStatus = mapShipdayStatus(rawStatus, rawEventType) ?? matchedOrderStatus ?? 'pending';
  const payloadHash = getShipdayPayloadHash(body);
  const orderStatusUpdate = matchedOrder ? getShipdayOrderStatusUpdate(matchedOrder, normalizedStatus) : null;
  let duplicatePayload = false;

  if (orderId || externalDeliveryId) {
    let duplicateQuery = supabase
      .from('order_events')
      .select('id, payload_hash')
      .eq('source', 'shipday')
      .eq('payload_hash', payloadHash)
      .order('created_at', { ascending: false })
      .limit(1);

    if (orderId) {
      duplicateQuery = duplicateQuery.eq('order_id', orderId);
    } else if (externalDeliveryId) {
      duplicateQuery = duplicateQuery.eq('external_delivery_id', externalDeliveryId);
    }

    const { data: latestMatchingEvent } = await duplicateQuery.maybeSingle();

    duplicatePayload = Boolean(latestMatchingEvent);
    if (duplicatePayload && !orderStatusUpdate) {
      return NextResponse.json({
        success: true,
        skippedDuplicatePayload: true,
        matched_order_id: orderId,
        external_delivery_id: externalDeliveryId,
        external_order_number: externalOrderNumber,
        delivery_status: normalizedStatus,
      });
    }
  }

  if (orderId) {
    const updatePayload: Record<string, string | null> = {
      delivery_status: normalizedStatus,
    };
    if (orderStatusUpdate) updatePayload.order_status = orderStatusUpdate;

    if (!duplicatePayload && externalDeliveryId) {
      updatePayload.delivery_provider_id = externalDeliveryId;
    }
    if (!duplicatePayload && trackingUrl) {
      updatePayload.delivery_tracking_url = trackingUrl;
    }
    if (!duplicatePayload && driverName) {
      updatePayload.delivery_driver_name = driverName;
    }
    if (!duplicatePayload && driverPhone) {
      updatePayload.delivery_driver_phone = driverPhone;
    }
    if (!duplicatePayload && driverPin) {
      updatePayload.delivery_driver_pin = driverPin;
    }
    if (!duplicatePayload && vehicleInfo) {
      updatePayload.delivery_vehicle_info = vehicleInfo;
    }

    let updateQuery = supabase
      .from('orders')
      .update(updatePayload)
      .eq('id', orderId);
    if (matchedOrder) {
      updateQuery = updateQuery
        .eq('order_status', matchedOrder.order_status)
        .eq('payment_status', matchedOrder.payment_status);
    }
    const { data: savedOrder, error: updateError } = await updateQuery.select('id').maybeSingle();

    if (updateError) {
      console.error('[Shipday Webhook] Failed to update order:', updateError);
      return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
    }
    if (!savedOrder) {
      // Do not acknowledge or deduplicate an event whose conditional write lost a race.
      return NextResponse.json({ error: 'Order changed during delivery sync; retry this event' }, { status: 503 });
    }
  }

  const { error: eventError } = duplicatePayload ? { error: null } : await supabase.from('order_events').insert({
    order_id: orderId,
    source: 'shipday',
    event_type: rawEventType || 'status_update',
    status: normalizedStatus,
    message,
    external_order_number: externalOrderNumber,
    external_delivery_id: externalDeliveryId,
    payload_hash: payloadHash,
    details: body,
  });

  if (eventError) {
    console.error('[Shipday Webhook] Failed to insert order event:', eventError);
    return NextResponse.json({ error: 'Failed to store webhook event' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    skippedDuplicatePayload: duplicatePayload,
    matched_order_id: orderId,
    external_delivery_id: externalDeliveryId,
    external_order_number: externalOrderNumber,
    delivery_status: normalizedStatus,
  });
}
