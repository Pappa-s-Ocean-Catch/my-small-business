'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function InventoryRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the enhanced inventory page
    router.replace('/shop/inventory/enhanced');
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-900 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Redirecting...</h1>
        <p className="text-gray-600 dark:text-gray-400">Taking you to the inventory management page.</p>
      </div>
    </div>
  );
}
