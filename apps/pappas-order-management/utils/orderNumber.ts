// Utility to render friendly order number (e.g. ORD-date-003 => P003)
export function getFriendlyOrderNumber(orderNumber: string): string {
    // Match trailing 3+ digits
    const match = orderNumber.match(/(\d{3,})$/);
    if (!match) return orderNumber;
    return `P${match[1]}`;
}
