'use client';

import { useState, useEffect, useCallback } from 'react';
import Card from '@/components/Card';
import { ActionButton } from '@/components/ActionButton';
import { Loading } from '@/components/Loading';
import { useSnackbar } from '@/components/Snackbar';
import { 
  FaGoogle, 
  FaSync, 
  FaCheckCircle, 
  FaExclamationTriangle,
  FaCog,
  FaHistory
} from 'react-icons/fa';

interface SyncStatus {
  connected: boolean;
  lastSync?: string;
  status: 'idle' | 'syncing' | 'error' | 'success';
  message?: string;
}

interface BusinessLocation {
  name: string;
  title: string;
  address: string;
}

interface SyncResult {
  success: boolean;
  message: string;
  results?: any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  errors?: any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  summary?: {
    total: number;
    successful: number;
    failed: number;
  };
}

export default function GoogleBusinessProfileSync() {
  const { showSnackbar } = useSnackbar();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    connected: false,
    status: 'idle'
  });
  const [loading, setLoading] = useState(false);
  const [locations, setLocations] = useState<BusinessLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [tokens, setTokens] = useState<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [activeTab, setActiveTab] = useState<'sync' | 'mapping' | 'history'>('sync');

  const checkConnectionStatus = useCallback(async () => {
    try {
      setLoading(true);
      // Check if we have stored tokens
      const storedTokens = localStorage.getItem('google_business_tokens');
      if (storedTokens) {
        const parsedTokens = JSON.parse(storedTokens);
        setTokens(parsedTokens);
        setSyncStatus(prev => ({ ...prev, connected: true }));
        
        // Get business locations
        await fetchLocations(parsedTokens);
      }
    } catch (error) {
      console.error('Error checking connection status:', error);
      showSnackbar('Failed to check connection status', 'error');
    } finally {
      setLoading(false);
    }
  }, [showSnackbar]);

  useEffect(() => {
    checkConnectionStatus();
  }, [checkConnectionStatus]);

  const fetchLocations = async (authTokens: any): Promise<void> => { // eslint-disable-line @typescript-eslint/no-explicit-any
    try {
      const response = await fetch(`/api/google-business/locations?tokens=${encodeURIComponent(JSON.stringify(authTokens))}`);
      const data = await response.json();
      
      if (data.success && data.locations?.locations) {
        setLocations(data.locations.locations);
        if (data.locations.locations.length > 0) {
          setSelectedLocation(data.locations.locations[0].name);
        }
      }
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  };

  const handleConnect = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/google-business/auth');
      const data = await response.json();
      
      if (data.authUrl) {
        // Open OAuth flow in new window
        const authWindow = window.open(
          data.authUrl,
          'google-auth',
          'width=500,height=600,scrollbars=yes,resizable=yes'
        );

        // Listen for OAuth completion
        const checkClosed = setInterval(() => {
          if (authWindow?.closed) {
            clearInterval(checkClosed);
            checkConnectionStatus();
          }
        }, 1000);
      }
    } catch (error) {
      console.error('Error initiating OAuth:', error);
      showSnackbar('Failed to connect to Google Business Profile', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncProducts = async () => {
    if (!selectedLocation || !tokens) {
      showSnackbar('Please select a location and ensure you are connected', 'error');
      return;
    }

    try {
      setLoading(true);
      setSyncStatus(prev => ({ ...prev, status: 'syncing' }));
      
      const response = await fetch('/api/google-business/sync-products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          locationId: selectedLocation,
          tokens: tokens
        })
      });

      const result: SyncResult = await response.json();
      
      if (result.success) {
        setSyncStatus(prev => ({ 
          ...prev, 
          status: 'success',
          lastSync: new Date().toISOString(),
          message: result.message
        }));
        showSnackbar(`Successfully synced ${result.summary?.successful || 0} products`, 'success');
      } else {
        setSyncStatus(prev => ({ ...prev, status: 'error' }));
        showSnackbar(result.message || 'Failed to sync products', 'error');
      }
    } catch (error) {
      console.error('Error syncing products:', error);
      setSyncStatus(prev => ({ ...prev, status: 'error' }));
      showSnackbar('Failed to sync products', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncCategories = async () => {
    if (!selectedLocation || !tokens) {
      showSnackbar('Please select a location and ensure you are connected', 'error');
      return;
    }

    try {
      setLoading(true);
      setSyncStatus(prev => ({ ...prev, status: 'syncing' }));
      
      const response = await fetch('/api/google-business/sync-categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          locationId: selectedLocation,
          tokens: tokens
        })
      });

      const result: SyncResult = await response.json();
      
      if (result.success) {
        setSyncStatus(prev => ({ 
          ...prev, 
          status: 'success',
          lastSync: new Date().toISOString(),
          message: result.message
        }));
        showSnackbar(`Successfully synced ${result.summary?.successful || 0} categories`, 'success');
      } else {
        setSyncStatus(prev => ({ ...prev, status: 'error' }));
        showSnackbar(result.message || 'Failed to sync categories', 'error');
      }
    } catch (error) {
      console.error('Error syncing categories:', error);
      setSyncStatus(prev => ({ ...prev, status: 'error' }));
      showSnackbar('Failed to sync categories', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncAll = async () => {
    await handleSyncCategories();
    await handleSyncProducts();
  };

  const getStatusIcon = () => {
    switch (syncStatus.status) {
      case 'syncing':
        return <FaSync className="animate-spin text-blue-500" />;
      case 'success':
        return <FaCheckCircle className="text-green-500" />;
      case 'error':
        return <FaExclamationTriangle className="text-red-500" />;
      default:
        return syncStatus.connected ? 
          <FaCheckCircle className="text-green-500" /> : 
          <FaExclamationTriangle className="text-gray-400" />;
    }
  };

  const getStatusText = () => {
    if (syncStatus.status === 'syncing') return 'Syncing...';
    if (syncStatus.status === 'success') return 'Last sync successful';
    if (syncStatus.status === 'error') return 'Sync failed';
    if (syncStatus.connected) return 'Connected';
    return 'Not connected';
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <FaGoogle className="text-blue-500 text-2xl" />
            <div>
              <h2 className="text-xl font-semibold">Google Business Profile Sync</h2>
              <p className="text-gray-600">Sync your menu products and categories to Google Business Profile</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {getStatusIcon()}
            <span className="text-sm font-medium">{getStatusText()}</span>
          </div>
        </div>

        {!syncStatus.connected ? (
          <div className="text-center py-8">
            <FaGoogle className="text-6xl text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Connect to Google Business Profile</h3>
            <p className="text-gray-600 mb-6">
              Connect your Google Business Profile to sync your menu products and categories automatically.
            </p>
            <ActionButton
              onClick={handleConnect}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <FaGoogle className="mr-2" />
              Connect to Google Business Profile
            </ActionButton>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Location Selection */}
            {locations.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Business Location
                </label>
                <select
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {locations.map((location) => (
                    <option key={location.name} value={location.name}>
                      {location.title} - {location.address}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Tab Navigation */}
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8">
                <button
                  onClick={() => setActiveTab('sync')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'sync'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <FaSync className="inline mr-2" />
                  Sync Operations
                </button>
                <button
                  onClick={() => setActiveTab('mapping')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'mapping'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <FaCog className="inline mr-2" />
                  Category Mapping
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'history'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <FaHistory className="inline mr-2" />
                  Sync History
                </button>
              </nav>
            </div>

            {/* Sync Operations Tab */}
            {activeTab === 'sync' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <ActionButton
                    onClick={handleSyncCategories}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <FaSync className="mr-2" />
                    Sync Categories
                  </ActionButton>
                  
                  <ActionButton
                    onClick={handleSyncProducts}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <FaSync className="mr-2" />
                    Sync Products
                  </ActionButton>
                  
                  <ActionButton
                    onClick={handleSyncAll}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    <FaSync className="mr-2" />
                    Sync All
                  </ActionButton>
                </div>

                {syncStatus.lastSync && (
                  <div className="text-sm text-gray-600">
                    Last sync: {new Date(syncStatus.lastSync).toLocaleString()}
                  </div>
                )}
              </div>
            )}

            {/* Category Mapping Tab */}
            {activeTab === 'mapping' && (
              <div className="text-center py-8">
                <FaCog className="text-4xl text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Category Mapping</h3>
                <p className="text-gray-600 mb-4">
                  Configure how your local categories map to Google Business categories.
                </p>
                <p className="text-sm text-gray-500">
                  Category mapping configuration will be available in a future update.
                </p>
              </div>
            )}

            {/* Sync History Tab */}
            {activeTab === 'history' && (
              <div className="text-center py-8">
                <FaHistory className="text-4xl text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Sync History</h3>
                <p className="text-gray-600 mb-4">
                  View your sync history and status.
                </p>
                <p className="text-sm text-gray-500">
                  Sync history tracking will be available in a future update.
                </p>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Loading Overlay */}
      {loading && <Loading />}

    </div>
  );
}
