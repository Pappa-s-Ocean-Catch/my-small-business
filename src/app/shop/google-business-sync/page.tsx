'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminGuard } from '@/components/AdminGuard';
import { AppHeader } from '@/components/AppHeader';
import GoogleBusinessProfileSync from '@/components/GoogleBusinessProfileSync';
import { FaArrowLeft, FaGoogle } from 'react-icons/fa';

export default function GoogleBusinessSyncPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <AdminGuard>
      <div className="min-h-screen bg-gray-50">
        <AppHeader />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center space-x-4 mb-4">
              <button
                onClick={() => router.back()}
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
              >
                <FaArrowLeft className="mr-2" />
                Back
              </button>
            </div>
            
            <div className="flex items-center space-x-3">
              <FaGoogle className="text-blue-500 text-3xl" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Google Business Profile Sync
                </h1>
                <p className="text-gray-600 mt-1">
                  Synchronize your menu products and categories with your Google Business Profile
                </p>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <GoogleBusinessProfileSync />
        </div>
      </div>
    </AdminGuard>
  );
}
