import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@my-small-business/supabase/server';
import { getShipdayPayloadHash } from '@/lib/shipday-event-dedupe';

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
      if (keyNames.has(key) && typeof nested === 'string' && nested.trim()) {
        found.push(nested.trim());
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

function mapShipdayStatus(rawStatus: string | null, rawEventType: string | null): string | null {
  const status = `${rawStatus || ''} ${rawEventType || ''}`.toLowerCase();

  if (!status.trim()) return null;
  if (status.includes('deliver')) return 'delivered';
  if (
    status.includes('picked_up') ||
    status.includes('picked up') ||
    status.includes('pickup complete') ||
    status.includes('in_transit') ||
    status.includes('in transit') ||
    status.includes('picked') ||
    status.includes('transit') ||
    status.includes('inflight') ||
    status.includes('enroute') ||
    status.includes('on_the_way') ||
    status.includes('on the way')
  ) {
    return 'inflight';
  }
  if (
    status.includes('assign') ||
    status.includes('accept') ||
    status.includes('driver') ||
    status.includes('dispatch') ||
    status.includes('scheduled')
  ) {
    return 'assigned';
  }
  if (status.includes('cancel')) return 'cancelled';
  if (status.includes('fail')) return 'failed';
  return 'pending';
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

  const externalDeliveryId = firstMatch(body, ['orderId', 'deliveryId', 'id']);
  const externalOrderNumber = firstMatch(body, [
    'orderNumber',
    'order_number',
    'externalOrderId',
    'external_order_id',
  ]);
  const rawStatus = firstMatch(body, ['status', 'deliveryStatus', 'orderStatus']);
  const rawEventType = firstMatch(body, ['eventType', 'type', 'event', 'action']);
  const trackingUrl = firstMatch(body, ['trackingUrl', 'tracking_url']);
  const driverName = firstMatch(body, ['driverName', 'dasherName', 'courierName']);
  const driverPhone = firstMatch(body, ['driverPhone', 'dasherPhone', 'courierPhone']);
  const driverPin = firstMatch(body, ['driverPin', 'driver_pin', 'pickupPin', 'pickup_pin', 'verificationPin', 'verification_pin']);
  const vehicleInfo = firstMatch(body, ['vehicleInfo', 'vehicle', 'vehicleDescription']);
  const message = firstMatch(body, ['message', 'note', 'description']);

  let orderId: string | null = null;
  let matchedOrderStatus: string | null = null;

  if (externalDeliveryId) {
    const { data } = await supabase
      .from('orders')
      .select('id, delivery_status')
      .eq('delivery_provider_id', externalDeliveryId)
      .maybeSingle();
    if (data) {
      orderId = data.id;
      matchedOrderStatus = data.delivery_status;
    }
  }

  if (!orderId && externalOrderNumber) {
    const { data } = await supabase
      .from('orders')
      .select('id, delivery_status')
      .eq('order_number', externalOrderNumber)
      .maybeSingle();
    if (data) {
      orderId = data.id;
      matchedOrderStatus = data.delivery_status;
    }
  }

  const normalizedStatus = mapShipdayStatus(rawStatus, rawEventType) ?? matchedOrderStatus ?? 'pending';
  const payloadHash = getShipdayPayloadHash(body);

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

    if (latestMatchingEvent) {
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

    if (externalDeliveryId) {
      updatePayload.delivery_provider_id = externalDeliveryId;
    }
    if (trackingUrl) {
      updatePayload.delivery_tracking_url = trackingUrl;
    }
    if (driverName) {
      updatePayload.delivery_driver_name = driverName;
    }
    if (driverPhone) {
      updatePayload.delivery_driver_phone = driverPhone;
    }
    if (driverPin) {
      updatePayload.delivery_driver_pin = driverPin;
    }
    if (vehicleInfo) {
      updatePayload.delivery_vehicle_info = vehicleInfo;
    }

    const { error: updateError } = await supabase
      .from('orders')
      .update(updatePayload)
      .eq('id', orderId);

    if (updateError) {
      console.error('[Shipday Webhook] Failed to update order:', updateError);
      return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
    }
  }

  const { error: eventError } = await supabase.from('order_events').insert({
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
    matched_order_id: orderId,
    external_delivery_id: externalDeliveryId,
    external_order_number: externalOrderNumber,
    delivery_status: normalizedStatus,
  });
}
