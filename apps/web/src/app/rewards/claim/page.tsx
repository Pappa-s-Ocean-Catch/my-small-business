import { Suspense } from 'react';
import { ClaimReceiptClient } from './ClaimReceiptClient';

export default function ReceiptClaimPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 px-4 py-10 text-center text-sm text-gray-600">Loading receipt claim...</div>}>
      <ClaimReceiptClient />
    </Suspense>
  );
}
