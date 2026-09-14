import { DeliveryRequest, DeliveryRequestState, DeliveryQuoteOption, DeliveryRecipient } from '../../../../libs/types/delivery-management';

export interface BookingRequestInput {
  quoteRequestId: string;
  provider: string;
  acceptedFee: number;
  currency: string;
  recipient: DeliveryRecipient;
  orderId?: string | null;
}

export interface DeliveryRepo {
  get(id: string): Promise<any>;
  claim(id: string, states: DeliveryRequestState[], patch: Partial<any>): Promise<any>;
  update(id: string, patch: Partial<any>): Promise<any>;
  linkOrder(record: any): Promise<void>;
}

export interface DeliveryProvider {
  createOrder(params: any): Promise<string>;
  getEstimates(id: string): Promise<DeliveryQuoteOption[]>;
  assignDelivery(id: string, quote: DeliveryQuoteOption): Promise<any>;
  findOrderByReference(ref: string): Promise<any>;
  getOnDemandDetails(id: string): Promise<any>;
}

function toDeliveryRequest(row: any): DeliveryRequest {
  return {
    id: row.id,
    reference: row.reference,
    state: row.state,
    shipdayOrderId: row.shipday_order_id,
    orderId: row.order_id,
    quotes: row.quotes || [],
    expiresAt: row.expires_at,
    error: row.last_error,
    trackingUrl: row.tracking_url
  };
}

export async function bookDelivery(input: BookingRequestInput, repo: DeliveryRepo, provider: DeliveryProvider): Promise<DeliveryRequest> {
  let record = await repo.get(input.quoteRequestId);
  if (!record) throw new Error('Request not found');

  if (!input.recipient || !input.recipient.name || !input.recipient.phone) {
    throw new Error('Invalid recipient');
  }
  if (new Date(record.expires_at) < new Date()) {
    throw new Error('Quote expired');
  }
  if (input.acceptedFee < 0) {
    throw new Error('Invalid fee');
  }

  const quote = record.quotes.find((q: any) => q.provider === input.provider && q.fee === input.acceptedFee && q.currency === input.currency);
  if (!quote) {
    throw new Error('Quote not found or mismatch');
  }

  if (record.state === 'requested') return toDeliveryRequest(record);
  if (record.state === 'creation_uncertain') return toDeliveryRequest(record);

  if (record.state === 'quoted' || (record.state === 'needs_confirmation' && !record.shipday_order_id)) {
    const claim = await repo.claim(input.quoteRequestId, ['quoted', 'needs_confirmation'], {
      state: 'creating',
      selected_provider: input.provider,
      accepted_fee: input.acceptedFee,
      currency: input.currency,
      recipient: input.recipient,
      order_id: input.orderId || record.order_id
    });
    if (!claim) return toDeliveryRequest(await repo.get(input.quoteRequestId));
    record = claim;

    try {
      const shipdayOrderId = await provider.createOrder({
        reference: record.reference,
        address: record.address,
        recipient: record.recipient
      });
      record = await repo.update(input.quoteRequestId, { state: 'created', shipday_order_id: shipdayOrderId });
    } catch (e) {
      if (e instanceof Error && e.message.includes('timeout')) {
        return toDeliveryRequest(await repo.update(input.quoteRequestId, { state: 'creation_uncertain', last_error: 'timeout' }));
      }
      return toDeliveryRequest(await repo.update(input.quoteRequestId, { state: 'failed', last_error: e instanceof Error ? e.message : 'Unknown' }));
    }
  } else if (record.state === 'needs_confirmation' && record.shipday_order_id) {
    const claim = await repo.claim(input.quoteRequestId, ['needs_confirmation'], {
      selected_provider: input.provider,
      accepted_fee: input.acceptedFee,
      currency: input.currency,
      state: 'created',
      order_id: input.orderId || record.order_id
    });
    if (!claim) return toDeliveryRequest(await repo.get(input.quoteRequestId));
    record = claim;
  }

  if (record.state === 'created' && record.shipday_order_id) {
    if (record.order_id) {
      await repo.linkOrder(record);
    }
    
    const estimates = await provider.getEstimates(record.shipday_order_id);
    const estimate = estimates.find(e => e.provider === record.selected_provider);
    if (!estimate || estimate.fee > record.accepted_fee) {
      return toDeliveryRequest(await repo.update(input.quoteRequestId, { state: 'needs_confirmation', quotes: estimates }));
    }

    const claim = await repo.claim(input.quoteRequestId, ['created'], { state: 'assigning' });
    if (!claim) return toDeliveryRequest(await repo.get(input.quoteRequestId));
    record = claim;

    try {
      const assignResult = await provider.assignDelivery(record.shipday_order_id, estimate);
      return toDeliveryRequest(await repo.update(input.quoteRequestId, { 
        state: 'requested', 
        tracking_url: assignResult.trackingUrl || null 
      }));
    } catch (e) {
      if (e instanceof Error && e.message.includes('timeout')) {
        return toDeliveryRequest(await repo.update(input.quoteRequestId, { state: 'assignment_uncertain', last_error: 'timeout' }));
      }
      return toDeliveryRequest(await repo.update(input.quoteRequestId, { state: 'needs_confirmation', last_error: e instanceof Error ? e.message : 'Unknown', quotes: estimates }));
    }
  }

  return toDeliveryRequest(record);
}

export async function reconcileDeliveryRequest(id: string, repo: DeliveryRepo, provider: DeliveryProvider): Promise<DeliveryRequest> {
  let record = await repo.get(id);
  if (!record) throw new Error('Request not found');

  if (record.state === 'creation_uncertain') {
    const order = await provider.findOrderByReference(record.reference);
    if (order && order.id) {
      record = await repo.update(id, { state: 'created', shipday_order_id: order.id });
    } else {
      return toDeliveryRequest(record);
    }
  }

  if (record.state === 'assignment_uncertain' && record.shipday_order_id) {
    const details = await provider.getOnDemandDetails(record.shipday_order_id);
    if (details && (details.status === 'REQUESTED' || details.status === 'ACCEPTED' || details.status === 'ASSIGNED')) {
      record = await repo.update(id, { state: 'requested', tracking_url: details.trackingUrl || record.tracking_url });
    }
  }

  return toDeliveryRequest(record);
}
