import { createClient } from '@supabase/supabase-js';
import { DeliveryRepo, DeliveryProvider } from './delivery-booking';
import { getShipdayManagementClient } from '../../../../libs/shipday/management';
import { DeliveryRequestState } from '../../../../libs/types/delivery-management';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function getSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

export const deliveryRepo: DeliveryRepo = {
  async get(id: string) {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('delivery_requests').select('*').eq('id', id).single();
    if (error) return null;
    return data;
  },
  async claim(id: string, states: DeliveryRequestState[], patch: Partial<any>) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('delivery_requests')
      .update(patch)
      .eq('id', id)
      .in('state', states)
      .select()
      .single();
    if (error) return null;
    return data;
  },
  async update(id: string, patch: Partial<any>) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('delivery_requests')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error('Failed to update delivery_request');
    return data;
  },
  async linkOrder(record: any) {
    // optional POS link logic
    // We already have `order_id` on the delivery_request record. 
    // If the system expects linking logic, we update the order's delivery_provider_id
    if (record.order_id && record.shipday_order_id) {
      const supabase = getSupabase();
      await supabase.from('orders').update({
        delivery_provider_id: record.shipday_order_id,
        is_delivery: true
      }).eq('id', record.order_id);
    }
  }
};

export const deliveryProvider: DeliveryProvider = {
  async createOrder(params: any) {
    const client = getShipdayManagementClient();
    return await client.createOrder(params);
  },
  async getEstimates(id: string) {
    const client = getShipdayManagementClient();
    return await client.getEstimates(id);
  },
  async assignDelivery(id: string, quote: any) {
    const client = getShipdayManagementClient();
    return await client.assignDelivery(id, quote);
  },
  async findOrderByReference(ref: string) {
    const client = getShipdayManagementClient();
    return await client.findOrderByReference(ref);
  },
  async getOnDemandDetails(id: string) {
    const client = getShipdayManagementClient();
    return await client.getOnDemandDetails(id);
  }
};
