'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DeliveryAddressForm, type DeliveryAddressInput } from '@/components/DeliveryAddressForm';
import { OrderHeader } from '@/components/OrderHeader';
import { Icon } from '@/components/Icon';
import { FaTruck, FaClock, FaArrowRight, FaMapMarkerAlt } from 'react-icons/fa';
import { LoadingSpinner } from '@/components/Loading';

export default function DeliveryEntryPage() {
  const router = useRouter();
  const [address, setAddress] = useState<DeliveryAddressInput | null>(null);
  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddressSelect = async (selectedAddress: DeliveryAddressInput) => {
    setAddress(selectedAddress);
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/delivery/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pickup_address: {
            address_line1: process.env.NEXT_PUBLIC_STORE_ADDRESS_LINE1 || 'Shop 2/87 Unitt Street',
            city: process.env.NEXT_PUBLIC_STORE_CITY || 'Melton',
            state: process.env.NEXT_PUBLIC_STORE_STATE || 'VIC',
            postcode: process.env.NEXT_PUBLIC_STORE_POSTCODE || '3337',
            country: 'AU',
            latitude: parseFloat(process.env.NEXT_PUBLIC_STORE_LATITUDE || '-37.678'),
            longitude: parseFloat(process.env.NEXT_PUBLIC_STORE_LONGITUDE || '144.579'),
          },

          dropoff_address: selectedAddress,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setQuote(data.data);
      } else {
        setError(data.error || 'Failed to get delivery quote');
      }
    } catch (err) {
      console.error('Error getting quote:', err);
      setError('An error occurred while getting the delivery quote');
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    if (!address || !quote) return;

    // Save to session storage
    sessionStorage.setItem('order_type', 'delivery');
    sessionStorage.setItem('delivery_address', JSON.stringify(address));
    sessionStorage.setItem('delivery_quote', JSON.stringify(quote));

    // Redirect to menu
    router.push('/order');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-900 pb-12">
      <OrderHeader />
      
      <main className="max-w-3xl mx-auto px-4 py-8 md:py-12">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full mb-4">
            <Icon icon={FaTruck} className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Online Delivery
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Enter your address to see delivery fee and ETA
          </p>
        </div>

        <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-xl border border-gray-200 dark:border-neutral-700">

          <div className="p-6 md:p-8">
            <DeliveryAddressForm 
              onAddressSelect={handleAddressSelect}
              isAuthenticated={false} // We handle auth during checkout
              allowSave={false}
            />

            {loading && (
              <div className="mt-8 flex flex-col items-center justify-center py-10 border-t border-gray-100 dark:border-neutral-700">
                <LoadingSpinner size="lg" />
                <p className="mt-4 text-gray-600 dark:text-gray-400">Calculating delivery fee...</p>
              </div>
            )}

            {error && !loading && (
              <div className="mt-8 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-red-600 shrink-0" />
                {error}
              </div>
            )}

            {quote && !loading && (
              <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="p-6 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800">
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-white text-lg flex items-center gap-2">
                        <Icon icon={FaMapMarkerAlt} className="text-blue-600" />
                        Delivery Details
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {address?.address_line1}, {address?.city}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-blue-600 dark:text-blue-400">
                        ${quote.fee.toFixed(2)}
                      </p>
                      <p className="text-xs font-bold text-blue-400 dark:text-blue-500 uppercase tracking-wider">
                        Delivery Fee
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="p-4 bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-blue-50 dark:border-neutral-700">
                      <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
                        <Icon icon={FaClock} className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase">Estimated ETA</span>
                      </div>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {quote.estimated_duration_minutes} mins
                      </p>
                    </div>
                    <div className="p-4 bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-blue-50 dark:border-neutral-700">
                      <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
                        <Icon icon={FaTruck} className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase">Distance</span>
                      </div>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {quote.distance_km} km
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleContinue}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-200 dark:shadow-none transition-all flex items-center justify-center gap-2 group"
                  >
                    Start Ordering
                    <Icon icon={FaArrowRight} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 text-center">
          <button 
            onClick={() => {
              sessionStorage.setItem('order_type', 'pickup');
              router.push('/order');
            }}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-sm font-medium transition-colors"
          >
            Or switch to Pickup Order
          </button>
        </div>
      </main>
    </div>
  );
}
