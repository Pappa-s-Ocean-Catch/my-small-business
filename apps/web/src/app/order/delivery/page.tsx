'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DeliveryAddressForm, type DeliveryAddressInput } from '@/components/DeliveryAddressForm';
import { OrderHeader } from '@/components/OrderHeader';
import { Icon } from '@/components/Icon';
import {
  FaArrowRight,
  FaCheckCircle,
  FaClock,
  FaMapMarkerAlt,
  FaStore,
  FaTruck,
} from 'react-icons/fa';
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

    sessionStorage.setItem('order_type', 'delivery');
    sessionStorage.setItem('delivery_address', JSON.stringify(address));
    sessionStorage.setItem('delivery_quote', JSON.stringify(quote));

    router.push('/order');
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.12),_transparent_35%),linear-gradient(180deg,#f8fafc_0%,#ecfdf5_100%)] pb-12 dark:bg-neutral-950">
      <OrderHeader />

      <main className="mx-auto max-w-5xl px-4 py-8 md:py-12">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <section className="rounded-[2rem] border border-emerald-100 bg-white/90 p-6 shadow-[0_24px_80px_-32px_rgba(16,185,129,0.45)] backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/90 md:p-8">
            <div className="mb-8">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                <Icon icon={FaTruck} className="h-4 w-4" />
                Online delivery order
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900 dark:text-white md:text-5xl">
                From fryer to your door.
              </h1>
            </div>

            <div className="mb-6 grid gap-3 sm:grid-cols-3">
              {[
                { icon: FaMapMarkerAlt, label: 'Enter address' },
                { icon: FaClock, label: 'See ETA' },
                { icon: FaCheckCircle, label: 'Start ordering' },
              ].map((step, index) => (
                <div
                  key={step.label}
                  className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 dark:border-neutral-800 dark:bg-neutral-950/50"
                >
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white text-emerald-600 shadow-sm dark:bg-neutral-900 dark:text-emerald-400">
                    <Icon icon={step.icon} className="h-4 w-4" />
                  </div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {index + 1}. {step.label}
                  </p>
                </div>
              ))}
            </div>

            <div className="rounded-[1.5rem] border border-gray-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900/80 md:p-6">
              <DeliveryAddressForm
                onAddressSelect={handleAddressSelect}
                isAuthenticated={false}
                allowSave={false}
                compact
              />
            </div>

            {loading && (
              <div className="mt-8 flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-gray-50 py-10 dark:border-neutral-800 dark:bg-neutral-900/60">
                <LoadingSpinner size="lg" />
                <p className="mt-4 text-gray-600 dark:text-gray-400">Checking delivery fee and ETA...</p>
              </div>
            )}

            {error && !loading && (
              <div className="mt-8 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                <div className="h-2 w-2 shrink-0 rounded-full bg-red-600" />
                {error}
              </div>
            )}

            {quote && !loading && (
              <div className="mt-8 animate-in slide-in-from-bottom-4 fade-in duration-500">
                <div className="rounded-[1.75rem] border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-900 dark:bg-emerald-950/30">
                  <div className="mb-6 flex items-start justify-between">
                    <div>
                      <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
                        <Icon icon={FaMapMarkerAlt} className="text-emerald-600" />
                        Delivery Details
                      </h3>
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        {address?.address_line1}, {address?.city}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                        ${quote.fee.toFixed(2)}
                      </p>
                      <p className="text-xs font-bold uppercase tracking-wider text-emerald-500">
                        Delivery Fee
                      </p>
                    </div>
                  </div>

                  <div className="mb-6 grid grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                      <div className="mb-1 flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                        <Icon icon={FaClock} className="h-4 w-4" />
                        <span className="text-xs font-bold uppercase">Estimated ETA</span>
                      </div>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {quote.estimated_duration_minutes} mins
                      </p>
                    </div>
                    <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                      <div className="mb-1 flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                        <Icon icon={FaTruck} className="h-4 w-4" />
                        <span className="text-xs font-bold uppercase">Distance</span>
                      </div>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {quote.distance_km} km
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleContinue}
                    className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-4 font-bold text-white shadow-lg shadow-emerald-200 transition-all hover:bg-emerald-700 dark:shadow-none"
                  >
                    Start Ordering
                    <Icon icon={FaArrowRight} className="transition-transform group-hover:translate-x-1" />
                  </button>
                </div>
              </div>
            )}
          </section>

          <aside className="space-y-4">
            <div className="rounded-[2rem] border border-gray-200 bg-white/90 p-6 shadow-sm backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/85">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-300">
                  <Icon icon={FaStore} className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                    From our shop
                  </p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    Pappa&apos;s Ocean Catch
                  </p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-gray-600 dark:text-gray-400">
                Delivery pricing is calculated live from your address, so you only see the fee that applies to your order.
              </p>
            </div>

            <div className="rounded-[2rem] border border-gray-200 bg-white/80 p-6 dark:border-neutral-800 dark:bg-neutral-900/80">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Prefer pickup?</h2>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Skip the delivery fee and head straight to the menu.
              </p>
              <button
                onClick={() => {
                  sessionStorage.setItem('order_type', 'pickup');
                  router.push('/order');
                }}
                className="mt-4 w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-neutral-700 dark:text-gray-200 dark:hover:bg-neutral-800"
              >
                Switch to Pickup Order
              </button>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
