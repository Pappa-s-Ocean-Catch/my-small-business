'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { FaCheckCircle, FaExclamationCircle, FaSpinner } from 'react-icons/fa';

function UnsubscribeContent() {
  const searchParams = useSearchParams();
  const id = searchParams?.get('id');
  const token = searchParams?.get('token');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!id || !token) {
      setStatus('error');
      setErrorMessage('Invalid unsubscribe link.');
      return;
    }

    const processUnsubscribe = async () => {
      try {
        const response = await fetch('/api/marketing/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, token }),
        });

        if (response.ok) {
          setStatus('success');
        } else {
          const data = await response.json();
          setStatus('error');
          setErrorMessage(data.error || 'Failed to unsubscribe.');
        }
      } catch (err) {
        setStatus('error');
        setErrorMessage('An unexpected error occurred.');
      }
    };

    processUnsubscribe();
  }, [id, token]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-neutral-800 rounded-2xl shadow-xl p-8 text-center border border-gray-100 dark:border-neutral-700">
        {status === 'loading' && (
          <div className="flex flex-col items-center">
            <Icon icon={FaSpinner} className="w-12 h-12 text-blue-500 animate-spin mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Processing your request...</h2>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center">
            <Icon icon={FaCheckCircle} className="w-16 h-16 text-green-500 mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Unsubscribed Successfully</h2>
            <p className="text-gray-600 dark:text-gray-400">
              You have been successfully removed from our marketing mailing list. You will no longer receive promotional emails from us.
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center">
            <Icon icon={FaExclamationCircle} className="w-16 h-16 text-red-500 mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Unsubscribe Failed</h2>
            <p className="text-gray-600 dark:text-gray-400">
              {errorMessage}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 dark:bg-neutral-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-neutral-800 rounded-2xl shadow-xl p-8 text-center border border-gray-100 dark:border-neutral-700 flex flex-col items-center">
          <Icon icon={FaSpinner} className="w-12 h-12 text-blue-500 animate-spin mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Loading...</h2>
        </div>
      </div>
    }>
      <UnsubscribeContent />
    </Suspense>
  );
}
