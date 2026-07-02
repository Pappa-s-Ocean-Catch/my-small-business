// Utility to render friendly order number (e.g. ORD-date-003 => P003)
export function getFriendlyOrderNumber(orderNumber?: string | null, fallback?: string | null): string {
    const rawValue = typeof orderNumber === 'string' && orderNumber.trim()
        ? orderNumber.trim()
        : typeof fallback === 'string' && fallback.trim()
            ? fallback.trim()
            : 'Unknown';

    // Match trailing 3+ digits
    const match = rawValue.match(/(\d{3,})$/);
    if (!match) return rawValue;
    return `P${match[1]}`;
}
