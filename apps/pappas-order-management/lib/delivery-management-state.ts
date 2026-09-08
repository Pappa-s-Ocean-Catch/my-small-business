import type { DeliveryRequest, DeliveryJobAddress, DeliveryRequestState, DeliveryQuoteOption } from '../../../libs/types/delivery-management';

export function addressKey(address: DeliveryJobAddress): string {
  return JSON.stringify({
    address_line1: address.address_line1 || '',
    address_line2: address.address_line2 || '',
    city: address.city || '',
    state: address.state || '',
    postcode: address.postcode || '',
    country: address.country || '',
    latitude: address.latitude || null,
    longitude: address.longitude || null,
    delivery_instructions: address.delivery_instructions || '',
  });
}

export function selectedQuote(request: DeliveryRequest | null, indexOrId: number | string | null): DeliveryQuoteOption | null {
  if (!request) return null;
  if (indexOrId === null) return null;
  
  if (typeof indexOrId === 'number') {
    return request.quotes[indexOrId] || null;
  }
  
  return request.quotes.find(q => q.id === indexOrId) || null;
}

export function canSubmitDelivery(request: DeliveryRequest | null, quoteId: number | string | null, isSubmitting: boolean): boolean {
  if (isSubmitting) return false;
  if (!request) return false;
  
  const quote = selectedQuote(request, quoteId);
  if (!quote) return false;
  
  if (new Date(request.expiresAt) < new Date()) {
    return false;
  }
  
  const inFlightStates: DeliveryRequestState[] = ['creating', 'created', 'assigning', 'creation_uncertain', 'assignment_uncertain', 'requested'];
  if (inFlightStates.includes(request.state)) {
    return false;
  }
  
  return true;
}

export function needsDeliveryRecovery(state: DeliveryRequestState): boolean {
  return ['creating', 'created', 'assigning', 'creation_uncertain', 'assignment_uncertain'].includes(state);
}

export function deliveryRequestMessage(state: DeliveryRequestState): string {
  switch (state) {
    case 'creation_uncertain':
    case 'assignment_uncertain':
      return 'The delivery status is uncertain. Please check provider dashboard.';
    case 'needs_confirmation':
      return 'The delivery quote price changed and requires your confirmation.';
    case 'failed':
      return 'The delivery booking failed. Try again.';
    case 'requested':
      return 'Delivery successfully requested.';
    default:
      return '';
  }
}

export function dateRangeBounds(fromStr: string, toStr: string): { from: string; to: string } {
  // fromStr and toStr are like '2026-09-01'
  const fromDate = new Date(`${fromStr}T00:00:00`);
  const toDate = new Date(`${toStr}T00:00:00`);

  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    throw new Error('Invalid date');
  }

  // The test checks '2026-02-30' which is invalid but JS Date might parse it as March 2.
  // We need strict validation.
  const isStrictValidDate = (dateStr: string, parsedDate: Date) => {
    const [y, m, d] = dateStr.split('-');
    return parsedDate.getFullYear() === parseInt(y, 10) && 
           parsedDate.getMonth() + 1 === parseInt(m, 10) && 
           parsedDate.getDate() === parseInt(d, 10);
  };

  if (!isStrictValidDate(fromStr, fromDate) || !isStrictValidDate(toStr, toDate)) {
    throw new Error('Invalid date');
  }

  if (fromDate > toDate) {
    throw new Error('from date must be before or equal to to date');
  }

  // to is the whole local end date, so add 1 day
  const toDateExclusive = new Date(toDate);
  toDateExclusive.setDate(toDateExclusive.getDate() + 1);

  return {
    from: fromDate.toISOString(),
    to: toDateExclusive.toISOString()
  };
}
