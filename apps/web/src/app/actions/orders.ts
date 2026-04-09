'use server';

import { createServiceRoleClient, createServerSupabaseClient } from '@my-small-business/supabase/server';
import { CartItemData } from './cart';
import { getPostHogClient } from '@/lib/posthog-server';
import { buildDefaultStoreHours, isPickupTimeWithinHours, isStoreOpenNow } from '@/lib/store-hours';
import type {
  Order,
  OrderItem,
  OrderItemAddon,
  DeliveryAddressInput,
  OrderStatus,
  PaymentStatus,
  StoreHours,
} from '@my-small-business/types';

// Extend OrderInput to include CartItemData for web app
export interface OrderInput {
  customer_email: string;
  customer_phone: string;
  customer_name?: string;
  payment_method: 'online' | 'store';
  order_type: 'pickup' | 'delivery';
  user_id?: string;
  special_instructions?: string;
  items: CartItemData[];
  subtotal: number;
  tax?: number;
  delivery_fee?: number;
  service_fee?: number;
  total: number;
  delivery_address_id?: string;
  delivery_address?: DeliveryAddressInput;
  delivery_quote_id?: string;
  delivery_quote_amount?: number;
  delivery_quote_currency?: string;
  delivery_quote_expires_at?: string;
  delivery_eta_minutes?: number;
  reward_points_used?: number;
  reward_points_value?: number;

  // Promotions
  promotion_discount?: number;
  promotions_applied?: any[];

  /** When the customer wants to pick up (for pickup orders). Required when ordering outside open hours (pre-order). */
  scheduled_pickup_at?: string | null;
}

// Note: Types are no longer re-exported here
// Import types directly from @my-small-business/types instead
// This prevents runtime evaluation issues with type-only exports

// Create a new order from cart
export async function createOrder(input: OrderInput): Promise<{ data: Order | null; error: string | null }> {
  try {
    const supabase = await createServiceRoleClient();

    // Validate input
    if (!input.customer_email || !input.customer_phone) {
      return {
        data: null,
        error: 'Please enter your email and phone number so we can contact you about your order.',
      };
    }

    if (!input.items || input.items.length === 0) {
      return { data: null, error: 'Order must contain at least one item' };
    }

    // Pickup-time rules:
    // - If store is closed now: customer must pre-order and choose scheduled_pickup_at
    // - If scheduled_pickup_at is provided: it must fall within store opening hours
    if (input.order_type === 'pickup') {
      const [storeHoursRes, defaultsRes] = await Promise.all([
        supabase.from('settings').select('value').eq('key', 'store_hours').maybeSingle(),
        supabase.from('settings').select('value').eq('key', 'defaults').maybeSingle(),
      ]);

      if (storeHoursRes.error) {
        console.error('[createOrder] Failed to load store_hours:', storeHoursRes.error);
        return {
          data: null,
          error: 'Failed to load store hours. Please try again. If the problem persists, ask staff to check Settings → Store opening hours.',
        };
      }

      if (defaultsRes.error) {
        console.error('[createOrder] Failed to load defaults settings:', defaultsRes.error);
        return {
          data: null,
          error: 'Failed to load store settings. Please try again. If the problem persists, ask staff to check Settings.',
        };
      }

      const storeHoursValue = storeHoursRes.data?.value as StoreHours | undefined;
      const defaultsValue = defaultsRes.data?.value as { store_open_time?: string; store_close_time?: string } | undefined;

      const storeHours: StoreHours =
        storeHoursValue && typeof storeHoursValue === 'object'
          ? storeHoursValue
          : buildDefaultStoreHours(defaultsValue?.store_open_time ?? '10:00', defaultsValue?.store_close_time ?? '21:00');

      const isOpenNow = isStoreOpenNow(storeHours);

      if (!isOpenNow && !input.scheduled_pickup_at) {
        return { data: null, error: 'Store is currently closed. Please choose a pickup time to pre-order.' };
      }

      if (input.scheduled_pickup_at && !isPickupTimeWithinHours(storeHours, input.scheduled_pickup_at)) {
        return { data: null, error: 'Selected pickup time must be within store opening hours.' };
      }

      // Allow pre-order pickup for any of the next 7 days (including today if open)
      if (input.scheduled_pickup_at) {
        const melbourneFormatter = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Australia/Melbourne',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        });

        const now = new Date();
        const scheduled = new Date(input.scheduled_pickup_at);

        const todayParts = melbourneFormatter.formatToParts(now);
        const schedParts = melbourneFormatter.formatToParts(scheduled);

        const getYMD = (parts: Intl.DateTimeFormatPart[]) => {
          const y = Number(parts.find((p) => p.type === 'year')?.value ?? '0');
          const m = Number(parts.find((p) => p.type === 'month')?.value ?? '1');
          const d = Number(parts.find((p) => p.type === 'day')?.value ?? '1');
          return { y, m, d };
        };

        const t = getYMD(todayParts);
        const s = getYMD(schedParts);

        const todayUtc = Date.UTC(t.y, t.m - 1, t.d);
        const schedUtc = Date.UTC(s.y, s.m - 1, s.d);
        const diffDays = Math.round((schedUtc - todayUtc) / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
          return { data: null, error: 'Pickup time must be in the future.' };
        }

        if (diffDays > 6) {
          return {
            data: null,
            error: 'Pre-order is only supported for up to 7 days in advance. Please choose a date within the next 7 days.',
          };
        }
      }
    }

    // Create order
    const orderData: any = {
      user_id: input.user_id || null,
      customer_email: input.customer_email,
      customer_phone: input.customer_phone,
      customer_name: input.customer_name || null,
      payment_method: input.payment_method,
      order_type: input.order_type,
      payment_status: input.payment_method === 'online' ? 'pending' : 'pending', // Will be updated when payment is processed
      order_status: input.payment_method === 'online' ? 'pending_online_payment' : 'pending',
      subtotal: input.subtotal,
      tax: input.tax || 0,
      delivery_fee: input.delivery_fee || 0,
      service_fee: input.service_fee || 0,
      promotion_discount: input.promotion_discount || 0,
      promotions_applied: input.promotions_applied || [],
      total: input.total,
      reward_points_used: input.reward_points_used ?? null,
      reward_points_value: input.reward_points_value ?? null,
      special_instructions: input.special_instructions || null,
      scheduled_pickup_at: input.scheduled_pickup_at ?? null,
    };

    // Add delivery fields if order type is delivery
    if (input.order_type === 'delivery') {
      if (input.delivery_address_id) {
        orderData.delivery_address_id = input.delivery_address_id;
      }

      if (input.delivery_address) {
        orderData.delivery_address_line1 = input.delivery_address.address_line1;
        orderData.delivery_address_line2 = input.delivery_address.address_line2 || null;
        orderData.delivery_city = input.delivery_address.city;
        orderData.delivery_state = input.delivery_address.state;
        orderData.delivery_postcode = input.delivery_address.postcode;
        orderData.delivery_country = input.delivery_address.country || 'AU';
        orderData.delivery_latitude = input.delivery_address.latitude || null;
        orderData.delivery_longitude = input.delivery_address.longitude || null;
      }

      if (input.delivery_quote_id) {
        orderData.delivery_quote_id = input.delivery_quote_id;
        orderData.delivery_quote_amount = input.delivery_quote_amount || null;
        orderData.delivery_quote_currency = input.delivery_quote_currency || 'AUD';
        orderData.delivery_quote_expires_at = input.delivery_quote_expires_at || null;
        orderData.delivery_eta_minutes = input.delivery_eta_minutes || null;
      }

      // Set initial delivery status
      orderData.delivery_status = 'pending';
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert(orderData)
      .select()
      .single();

    if (orderError) {
      console.error('Error creating order:', orderError);
      return { data: null, error: orderError.message };
    }

    if (!order) {
      return { data: null, error: 'Failed to create order' };
    }

    // Create order items
    const orderItemsToInsert = input.items.map(item => ({
      order_id: order.id,
      product_id: item.product_id,
      product_name: item.product_name,
      product_description: item.product_description || null,
      product_image_url: item.product_image_url || null,
      base_price: item.base_price,
      quantity: item.quantity,
      subtotal: item.subtotal,
      removed_ingredients: item.removed_ingredients || [],
      comment: item.comment || null
    }));

    const { data: orderItems, error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItemsToInsert)
      .select();

    if (itemsError) {
      console.error('Error creating order items:', itemsError);
      // Try to delete the order if items failed
      await supabase.from('orders').delete().eq('id', order.id);
      return { data: null, error: itemsError.message };
    }

    // Create order item addons
    if (orderItems && orderItems.length > 0) {
      const addonsToInsert: Array<{
        order_item_id: string;
        addon_group_id: string;
        addon_group_name: string;
        addon_item_id: string;
        addon_item_name: string;
        addon_item_price: number;
      }> = [];

      input.items.forEach((item, index) => {
        const orderItemId = orderItems[index]?.id;
        if (orderItemId && item.addons) {
          item.addons.forEach(addon => {
            addonsToInsert.push({
              order_item_id: orderItemId,
              addon_group_id: addon.addon_group_id,
              addon_group_name: addon.addon_group_name,
              addon_item_id: addon.addon_item_id,
              addon_item_name: addon.addon_item_name,
              addon_item_price: addon.addon_item_price
            });
          });
        }
      });

      if (addonsToInsert.length > 0) {
        const { error: addonsError } = await supabase
          .from('order_item_addons')
          .insert(addonsToInsert);

        if (addonsError) {
          console.error('Error creating order item addons:', addonsError);
          // Note: We don't delete the order here as items were created successfully
          // The addons can be added manually if needed
        }
      }
    }

    // Fetch complete order with items
    const completeOrder = await getOrder(order.id);

    // Only send order placed email if order is accepted (in-store) or payment is successful (online)
    if (completeOrder.data) {
      const status = completeOrder.data.order_status;
      if (status === 'pending' || status === 'confirmed') {
        try {
          console.log('[createOrder] About to send order placed email for order:', completeOrder.data.order_number, completeOrder.data.customer_email, 'status:', status);
          // Dynamically import to avoid circular dependency at module load
          const { sendOrderPlacedEmail } = await import('@/app/actions/email');
          const emailResult = await sendOrderPlacedEmail(completeOrder.data);
          console.log('[createOrder] sendOrderPlacedEmail result:', emailResult);
        } catch (emailErr) {
          console.error('[createOrder] Failed to send order placed email:', emailErr);
        }
      } else {
        console.log('[createOrder] Skipping order placed email for order:', completeOrder.data.order_number, 'status:', status);
      }
    }
    if (completeOrder.data) {
      const posthog = getPostHogClient();
      posthog.capture({
        distinctId: input.user_id ?? input.customer_email,
        event: 'order_created',
        properties: {
          order_id: completeOrder.data.id,
          order_number: completeOrder.data.order_number,
          order_type: input.order_type,
          payment_method: input.payment_method,
          subtotal: input.subtotal,
          total: input.total,
          item_count: input.items.length,
          has_promotion: (input.promotion_discount ?? 0) > 0,
          has_reward_points: (input.reward_points_used ?? 0) > 0,
        },
      });
      await posthog.shutdown();
    }

    return completeOrder;
  } catch (error) {
    console.error('Unexpected error creating order:', error);
    return { data: null, error: 'An unexpected error occurred' };
  }
}

// Get a single order by order number
export async function getOrderByNumber(orderNumber: string): Promise<{ data: Order | null; error: string | null }> {
  try {
    const supabase = await createServiceRoleClient();

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('order_number', orderNumber)
      .single();

    if (orderError) {
      console.error('Error fetching order by number:', orderError);
      return { data: null, error: orderError.message };
    }

    if (!order) {
      return { data: null, error: 'Order not found' };
    }

    type RawOrderItemAddon = {
      id: string;
      order_item_id: string;
      addon_group_id: string;
      addon_group_name: string;
      addon_item_id: string;
      addon_item_name: string;
      addon_item_price: string | number;
      created_at: string;
    };

    // Fetch order items
    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', order.id)
      .order('created_at', { ascending: true });

    if (itemsError) {
      console.error('Error fetching order items:', itemsError);
      return { data: { ...order, items: [] }, error: null };
    }

    // Fetch addons for each item
    const itemsWithAddons: OrderItem[] = [];
    const itemAddonsByOrderItemId = new Map<string, RawOrderItemAddon[]>();
    const addonItemIds = new Set<string>();
    const addonGroupIds = new Set<string>();
    const saleProductIds = new Set<string>();

    if (items) {
      for (const item of items) {
        saleProductIds.add(item.product_id);
        const { data: addons, error: addonsError } = await supabase
          .from('order_item_addons')
          .select('*')
          .eq('order_item_id', item.id);

        if (addonsError) {
          console.error('Error fetching order item addons:', addonsError);
        }

        const rawAddons = (addons ?? []) as unknown as RawOrderItemAddon[];
        rawAddons.forEach((a) => {
          addonItemIds.add(a.addon_item_id);
          addonGroupIds.add(a.addon_group_id);
        });
        itemAddonsByOrderItemId.set(item.id, rawAddons);

        itemsWithAddons.push({
          ...item,
          base_price: Number(item.base_price),
          quantity: item.quantity,
          subtotal: Number(item.subtotal),
          removed_ingredients: (item.removed_ingredients as string[] | null) || [],
          addons: []
        });
      }
    }

    // Fetch add-on metadata (display order + required flag) once, then map into each add-on row.
    type AddonItemMetaRow = { id: string; sort_order: number | null };
    type AddonGroupMetaRow = { id: string; is_required: boolean };
    type SaleProductAddonGroupMetaRow = {
      sale_product_id: string;
      addon_group_id: string;
      display_order: number | null;
    };

    const addonItemIdList = Array.from(addonItemIds);
    const addonGroupIdList = Array.from(addonGroupIds);
    const saleProductIdList = Array.from(saleProductIds);

    const addonItemSortOrderById = new Map<string, number>();
    if (addonItemIdList.length > 0) {
      const { data: addonItemMeta, error: addonItemMetaError } = await supabase
        .from('addon_items')
        .select('id, sort_order')
        .in('id', addonItemIdList);

      if (addonItemMetaError) {
        console.error('Error fetching addon_items metadata:', addonItemMetaError);
      } else if (addonItemMeta) {
        (addonItemMeta as AddonItemMetaRow[]).forEach((row) => {
          if (typeof row.sort_order === 'number') addonItemSortOrderById.set(row.id, row.sort_order);
        });
      }
    }

    const addonGroupIsRequiredById = new Map<string, boolean>();

    const saleProductAddonGroupDisplayOrderByKey = new Map<string, number>();

    if (addonGroupIdList.length > 0) {
      const { data: addonGroupMeta, error: addonGroupMetaError } = await supabase
        .from('addon_groups')
        .select('id, is_required')
        .in('id', addonGroupIdList);

      if (addonGroupMetaError) {
        console.error('Error fetching addon_groups metadata:', addonGroupMetaError);
      } else if (addonGroupMeta) {
        (addonGroupMeta as AddonGroupMetaRow[]).forEach((row) => {
          addonGroupIsRequiredById.set(row.id, row.is_required);
        });
      }
    }

    if (saleProductIdList.length > 0 && addonGroupIdList.length > 0) {
      const { data: spagMeta, error: spagMetaError } = await supabase
        .from('sale_product_addon_groups')
        .select('sale_product_id, addon_group_id, display_order')
        .in('sale_product_id', saleProductIdList)
        .in('addon_group_id', addonGroupIdList);

      if (spagMetaError) {
        console.error('Error fetching sale_product_addon_groups metadata:', spagMetaError);
      } else if (spagMeta) {
        (spagMeta as SaleProductAddonGroupMetaRow[]).forEach((row) => {
          if (typeof row.display_order === 'number') {
            saleProductAddonGroupDisplayOrderByKey.set(
              `${row.sale_product_id}:${row.addon_group_id}`,
              row.display_order
            );
          }
        });
      }
    }

    // Attach mapped add-on metadata.
    for (const orderItem of itemsWithAddons) {
      const rawAddons = itemAddonsByOrderItemId.get(orderItem.id) ?? [];
      orderItem.addons = rawAddons.map((a) => ({
        id: a.id,
        order_item_id: a.order_item_id,
        addon_group_id: a.addon_group_id,
        addon_group_name: a.addon_group_name,
        addon_item_id: a.addon_item_id,
        addon_item_name: a.addon_item_name,
        addon_item_price: Number(a.addon_item_price),
        created_at: a.created_at,
        display_order: addonItemSortOrderById.get(a.addon_item_id),
        is_required: addonGroupIsRequiredById.get(a.addon_group_id),
        display_group_order: saleProductAddonGroupDisplayOrderByKey.get(
          `${orderItem.product_id}:${a.addon_group_id}`
        ),
      }));
    }

    return {
      data: {
        ...order,
        subtotal: Number(order.subtotal),
        tax: Number(order.tax),
        delivery_fee: Number(order.delivery_fee),
        service_fee: Number(order.service_fee),
        promotion_discount: Number(order.promotion_discount ?? 0),
        promotions_applied: (order.promotions_applied as any[]) ?? [],
        total: Number(order.total),
        items: itemsWithAddons
      },
      error: null
    };
  } catch (error) {
    console.error('Unexpected error fetching order by number:', error);
    return { data: null, error: 'An unexpected error occurred' };
  }
}

// Get a single order by ID
export async function getOrder(orderId: string): Promise<{ data: Order | null; error: string | null }> {
  try {
    const supabase = await createServiceRoleClient();

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError) {
      console.error('Error fetching order:', orderError);
      return { data: null, error: orderError.message };
    }

    if (!order) {
      return { data: null, error: 'Order not found' };
    }

    type RawOrderItemAddon = {
      id: string;
      order_item_id: string;
      addon_group_id: string;
      addon_group_name: string;
      addon_item_id: string;
      addon_item_name: string;
      addon_item_price: string | number;
      created_at: string;
    };

    // Fetch order items
    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', order.id)
      .order('created_at', { ascending: true });

    if (itemsError) {
      console.error('Error fetching order items:', itemsError);
      return { data: { ...order, items: [] }, error: null };
    }

    // Fetch addons for each item
    const itemsWithAddons: OrderItem[] = [];
    const itemAddonsByOrderItemId = new Map<string, RawOrderItemAddon[]>();
    const addonItemIds = new Set<string>();
    const addonGroupIds = new Set<string>();
    const saleProductIds = new Set<string>();

    if (items) {
      for (const item of items) {
        saleProductIds.add(item.product_id);
        const { data: addons, error: addonsError } = await supabase
          .from('order_item_addons')
          .select('*')
          .eq('order_item_id', item.id);

        if (addonsError) {
          console.error('Error fetching order item addons:', addonsError);
        }

        const rawAddons = (addons ?? []) as unknown as RawOrderItemAddon[];
        rawAddons.forEach((a) => {
          addonItemIds.add(a.addon_item_id);
          addonGroupIds.add(a.addon_group_id);
        });
        itemAddonsByOrderItemId.set(item.id, rawAddons);

        itemsWithAddons.push({
          ...item,
          base_price: Number(item.base_price),
          quantity: item.quantity,
          subtotal: Number(item.subtotal),
          removed_ingredients: (item.removed_ingredients as string[] | null) || [],
          addons: []
        });
      }
    }

    // Fetch add-on metadata (display order + required flag) once, then map into each add-on row.
    type AddonItemMetaRow = { id: string; sort_order: number | null };
    type AddonGroupMetaRow = { id: string; is_required: boolean };
    type SaleProductAddonGroupMetaRow = {
      sale_product_id: string;
      addon_group_id: string;
      display_order: number | null;
    };

    const addonItemIdList = Array.from(addonItemIds);
    const addonGroupIdList = Array.from(addonGroupIds);
    const saleProductIdList = Array.from(saleProductIds);

    const addonItemSortOrderById = new Map<string, number>();
    if (addonItemIdList.length > 0) {
      const { data: addonItemMeta, error: addonItemMetaError } = await supabase
        .from('addon_items')
        .select('id, sort_order')
        .in('id', addonItemIdList);

      if (addonItemMetaError) {
        console.error('Error fetching addon_items metadata:', addonItemMetaError);
      } else if (addonItemMeta) {
        (addonItemMeta as AddonItemMetaRow[]).forEach((row) => {
          if (typeof row.sort_order === 'number') addonItemSortOrderById.set(row.id, row.sort_order);
        });
      }
    }

    const addonGroupIsRequiredById = new Map<string, boolean>();

    const saleProductAddonGroupDisplayOrderByKey = new Map<string, number>();

    if (addonGroupIdList.length > 0) {
      const { data: addonGroupMeta, error: addonGroupMetaError } = await supabase
        .from('addon_groups')
        .select('id, is_required')
        .in('id', addonGroupIdList);

      if (addonGroupMetaError) {
        console.error('Error fetching addon_groups metadata:', addonGroupMetaError);
      } else if (addonGroupMeta) {
        (addonGroupMeta as AddonGroupMetaRow[]).forEach((row) => {
          addonGroupIsRequiredById.set(row.id, row.is_required);
        });
      }
    }

    if (saleProductIdList.length > 0 && addonGroupIdList.length > 0) {
      const { data: spagMeta, error: spagMetaError } = await supabase
        .from('sale_product_addon_groups')
        .select('sale_product_id, addon_group_id, display_order')
        .in('sale_product_id', saleProductIdList)
        .in('addon_group_id', addonGroupIdList);

      if (spagMetaError) {
        console.error('Error fetching sale_product_addon_groups metadata:', spagMetaError);
      } else if (spagMeta) {
        (spagMeta as SaleProductAddonGroupMetaRow[]).forEach((row) => {
          if (typeof row.display_order === 'number') {
            saleProductAddonGroupDisplayOrderByKey.set(
              `${row.sale_product_id}:${row.addon_group_id}`,
              row.display_order
            );
          }
        });
      }
    }

    for (const orderItem of itemsWithAddons) {
      const rawAddons = itemAddonsByOrderItemId.get(orderItem.id) ?? [];
      orderItem.addons = rawAddons.map((a) => ({
        id: a.id,
        order_item_id: a.order_item_id,
        addon_group_id: a.addon_group_id,
        addon_group_name: a.addon_group_name,
        addon_item_id: a.addon_item_id,
        addon_item_name: a.addon_item_name,
        addon_item_price: Number(a.addon_item_price),
        created_at: a.created_at,
        display_order: addonItemSortOrderById.get(a.addon_item_id),
        is_required: addonGroupIsRequiredById.get(a.addon_group_id),
        display_group_order: saleProductAddonGroupDisplayOrderByKey.get(
          `${orderItem.product_id}:${a.addon_group_id}`
        ),
      }));
    }

    return {
      data: {
        ...order,
        subtotal: Number(order.subtotal),
        tax: Number(order.tax),
        delivery_fee: Number(order.delivery_fee),
        service_fee: Number(order.service_fee),
        promotion_discount: Number(order.promotion_discount ?? 0),
        promotions_applied: (order.promotions_applied as any[]) ?? [],
        total: Number(order.total),
        items: itemsWithAddons
      },
      error: null
    };
  } catch (error) {
    console.error('Unexpected error fetching order:', error);
    return { data: null, error: 'An unexpected error occurred' };
  }
}

// Get all orders (for admin)
export async function getAllOrders(filters?: {
  status?: string;
  payment_status?: string;
  limit?: number;
  date?: string; // ISO date string (YYYY-MM-DD)
}): Promise<{ data: Order[] | null; error: string | null }> {
  try {
    const supabase = await createServiceRoleClient();

    let query = supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('order_status', filters.status);
    }

    if (filters?.payment_status) {
      query = query.eq('payment_status', filters.payment_status);
    }

    if (filters?.date) {
      // Filter by date - get all orders for the selected date (start of day to end of day)
      const selectedDate = new Date(filters.date);
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      query = query
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString());
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const { data: orders, error: ordersError } = await query;

    if (ordersError) {
      console.error('Error fetching orders:', ordersError);
      return { data: null, error: ordersError.message };
    }

    // Fetch items for each order
    const ordersWithItems: Order[] = [];
    if (orders) {
      for (const order of orders) {
        const { data: items, error: itemsError } = await supabase
          .from('order_items')
          .select('*')
          .eq('order_id', order.id)
          .order('created_at', { ascending: true });

        if (itemsError) {
          console.error('Error fetching order items:', itemsError);
        }

        ordersWithItems.push({
          ...order,
          subtotal: Number(order.subtotal),
          tax: Number(order.tax),
          delivery_fee: Number(order.delivery_fee),
          service_fee: Number(order.service_fee),
          total: Number(order.total),
          items: items?.map(item => ({
            ...item,
            base_price: Number(item.base_price),
            quantity: item.quantity,
            subtotal: Number(item.subtotal),
            removed_ingredients: (item.removed_ingredients as string[] | null) || []
          })) || []
        });
      }
    }

    return { data: ordersWithItems, error: null };
  } catch (error) {
    console.error('Unexpected error fetching orders:', error);
    return { data: null, error: 'An unexpected error occurred' };
  }
}

// Update order status
export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus
): Promise<{ data: Order | null; error: string | null }> {
  try {
    const supabase = await createServiceRoleClient();

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .update({ order_status: status })
      .eq('id', orderId)
      .select()
      .single();

    if (orderError) {
      console.error('Error updating order status:', orderError);
      return { data: null, error: orderError.message };
    }

    if (!order) {
      return { data: null, error: 'Order not found' };
    }

    // If status is set to completed, ensure reward points exist and send review email.
    if (status === 'completed' && order) {
      try {
        const { ensureOrderRewardPoints } = await import('@/app/actions/reward-points');
        const ensureResult = await ensureOrderRewardPoints(orderId);
        if (!ensureResult.success) {
          console.error('Failed to ensure reward points on completion:', ensureResult.error);
        }
      } catch (err) {
        console.error('Failed to ensure reward points on completion:', err);
      }

      try {
        const { sendOrderCompletedEmail } = require('./email');
        await sendOrderCompletedEmail(order);
      } catch (err) {
        console.error('Failed to send order completed review email:', err);
      }
    }

    return getOrder(orderId);
  } catch (error) {
    console.error('Unexpected error updating order status:', error);
    return { data: null, error: 'An unexpected error occurred' };
  }
}

// Update payment status
export async function updatePaymentStatus(
  orderId: string,
  paymentStatus: PaymentStatus
): Promise<{ data: Order | null; error: string | null }> {
  try {
    const supabase = await createServiceRoleClient();

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .update({ payment_status: paymentStatus })
      .eq('id', orderId)
      .select()
      .single();

    if (orderError) {
      console.error('Error updating payment status:', orderError);
      return { data: null, error: orderError.message };
    }

    if (!order) {
      return { data: null, error: 'Order not found' };
    }

    return getOrder(orderId);
  } catch (error) {
    console.error('Unexpected error updating payment status:', error);
    return { data: null, error: 'An unexpected error occurred' };
  }
}

// Get customer orders (respects RLS - customers can only see their own orders)
export async function getCustomerOrders(): Promise<{ data: Order[] | null; error: string | null }> {
  try {
    const supabase = await createServerSupabaseClient();

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { data: null, error: 'Not authenticated' };
    }

    // Fetch orders for this user (RLS will filter automatically)
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (ordersError) {
      console.error('Error fetching customer orders:', ordersError);
      return { data: null, error: ordersError.message };
    }

    // Fetch items and addons for each order
    const ordersWithItems: Order[] = [];
    if (orders) {
      for (const order of orders) {
        const { data: items, error: itemsError } = await supabase
          .from('order_items')
          .select('*')
          .eq('order_id', order.id)
          .order('created_at', { ascending: true });

        if (itemsError) {
          console.error('Error fetching order items:', itemsError);
        }

        const itemsWithAddons: OrderItem[] = [];
        if (items) {
          for (const item of items) {
            const { data: addons } = await supabase
              .from('order_item_addons')
              .select('*')
              .eq('order_item_id', item.id);

            itemsWithAddons.push({
              ...item,
              base_price: Number(item.base_price),
              quantity: item.quantity,
              subtotal: Number(item.subtotal),
              removed_ingredients: (item.removed_ingredients as string[] | null) || [],
              addons: addons?.map(addon => ({
                id: addon.id,
                order_item_id: addon.order_item_id,
                addon_group_id: addon.addon_group_id,
                addon_group_name: addon.addon_group_name,
                addon_item_id: addon.addon_item_id,
                addon_item_name: addon.addon_item_name,
                addon_item_price: Number(addon.addon_item_price),
                created_at: addon.created_at
              })) || []
            });
          }
        }

        ordersWithItems.push({
          ...order,
          subtotal: Number(order.subtotal),
          tax: Number(order.tax),
          delivery_fee: Number(order.delivery_fee),
          service_fee: Number(order.service_fee),
          total: Number(order.total),
          items: itemsWithAddons
        });
      }
    }

    return { data: ordersWithItems, error: null };
  } catch (error) {
    console.error('Unexpected error fetching customer orders:', error);
    return { data: null, error: 'An unexpected error occurred' };
  }
}
