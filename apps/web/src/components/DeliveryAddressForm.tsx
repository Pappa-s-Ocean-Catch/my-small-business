'use client';

import { useState, useEffect } from 'react';
import { FaMapMarkerAlt, FaSave, FaTrash, FaEdit, FaCheck } from 'react-icons/fa';
import { getDeliveryAddresses, createDeliveryAddress, deleteDeliveryAddress, type DeliveryAddress } from '@/app/actions/delivery-addresses';
import { getSupabaseClient } from '@my-small-business/supabase/client';
import { AddressAutocomplete } from '@/components/AddressAutocomplete';

export interface DeliveryAddressInput {
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  postcode: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}

interface DeliveryAddressFormProps {
  onAddressSelect: (address: DeliveryAddressInput) => void;
  selectedAddressId?: string | null;
  allowSave?: boolean;
  isAuthenticated?: boolean;
}

export function DeliveryAddressForm({ 
  onAddressSelect, 
  selectedAddressId,
  allowSave = true,
  isAuthenticated = false 
}: DeliveryAddressFormProps) {
  const [savedAddresses, setSavedAddresses] = useState<DeliveryAddress[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [formData, setFormData] = useState<DeliveryAddressInput>({
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postcode: '',
    country: 'AU',
  });
  const [saving, setSaving] = useState(false);
  const [saveLabel, setSaveLabel] = useState('');

  // Load saved addresses if user is authenticated
  useEffect(() => {
    if (isAuthenticated && allowSave) {
      loadSavedAddresses();
    }
  }, [isAuthenticated, allowSave]);

  const loadSavedAddresses = async () => {
    setLoadingAddresses(true);
    try {
      const result = await getDeliveryAddresses();
      if (result.data) {
        setSavedAddresses(result.data);
        // Auto-select default address if available
        const defaultAddress = result.data.find(addr => addr.is_default);
        if (defaultAddress && !selectedAddressId) {
          handleAddressSelect(defaultAddress);
        }
      }
    } catch (error) {
      console.error('Error loading saved addresses:', error);
    } finally {
      setLoadingAddresses(false);
    }
  };

  const handleAddressSelect = (address: DeliveryAddress | DeliveryAddressInput) => {
    const addressInput: DeliveryAddressInput = {
      address_line1: address.address_line1,
      address_line2: address.address_line2 || undefined,
      city: address.city,
      state: address.state,
      postcode: address.postcode,
      country: address.country || 'AU',
      latitude: address.latitude || undefined,
      longitude: address.longitude || undefined,
    };
    onAddressSelect(addressInput);
    setShowNewAddressForm(false);
    setEditingAddressId(null);
  };

  const handleSaveAddress = async () => {
    if (!saveLabel.trim()) {
      alert('Please enter a label for this address (e.g., "Home", "Work")');
      return;
    }

    setSaving(true);
    try {
      const result = await createDeliveryAddress({
        ...formData,
        label: saveLabel,
        is_default: savedAddresses.length === 0, // First address is default
      });

      if (result.data) {
        await loadSavedAddresses();
        handleAddressSelect(result.data);
        setSaveLabel('');
        setShowNewAddressForm(false);
        setFormData({
          address_line1: '',
          address_line2: '',
          city: '',
          state: '',
          postcode: '',
          country: 'AU',
        });
      } else {
        alert(result.error || 'Failed to save address');
      }
    } catch (error) {
      console.error('Error saving address:', error);
      alert('Failed to save address');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAddress = async (id: string) => {
    if (!confirm('Are you sure you want to delete this saved address?')) {
      return;
    }

    try {
      const result = await deleteDeliveryAddress(id);
      if (result.success) {
        await loadSavedAddresses();
      } else {
        alert(result.error || 'Failed to delete address');
      }
    } catch (error) {
      console.error('Error deleting address:', error);
      alert('Failed to delete address');
    }
  };

  return (
    <div className="space-y-4">
      {/* Saved Addresses */}
      {isAuthenticated && allowSave && savedAddresses.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Saved Addresses
          </h3>
          <div className="space-y-2">
            {savedAddresses.map(address => (
              <div
                key={address.id}
                className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                  selectedAddressId === address.id
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-neutral-700 hover:border-gray-300 dark:hover:border-neutral-600'
                }`}
                onClick={() => handleAddressSelect(address)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {address.label}
                      </span>
                      {address.is_default && (
                        <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {address.address_line1}
                      {address.address_line2 && `, ${address.address_line2}`}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {address.city}, {address.state} {address.postcode}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteAddress(address.id);
                    }}
                    className="text-red-600 hover:text-red-700 p-1"
                    title="Delete address"
                  >
                    <FaTrash className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New Address Form */}
      {showNewAddressForm || savedAddresses.length === 0 ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <FaMapMarkerAlt className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {savedAddresses.length === 0 ? 'Delivery Address' : 'New Address'}
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Street Address *
              </label>
              {process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? (
                <>
                  <AddressAutocomplete
                    value={formData.address_line1}
                    onChange={(address) => {
                      setFormData({
                        address_line1: address.address_line1,
                        address_line2: address.address_line2,
                        city: address.city,
                        state: address.state,
                        postcode: address.postcode,
                        country: address.country,
                        latitude: address.latitude,
                        longitude: address.longitude,
                      });
                    }}
                    onInputChange={(value) => {
                      setFormData({ ...formData, address_line1: value });
                    }}
                    placeholder="Start typing your address..."
                    country="au"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
                    Start typing and select from suggestions
                  </p>
                </>
              ) : (
                <>
                  <input
                    type="text"
                    value={formData.address_line1}
                    onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                    placeholder="123 Main Street"
                    required
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
                    Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to enable address autocomplete
                  </p>
                </>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Apartment, Suite, etc. (Optional)
              </label>
              <input
                type="text"
                value={formData.address_line2}
                onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                placeholder="Apt 4B"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  City *
                </label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                  placeholder="Melton"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  State *
                </label>
                <input
                  type="text"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                  placeholder="VIC"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Postcode *
              </label>
              <input
                type="text"
                value={formData.postcode}
                onChange={(e) => setFormData({ ...formData, postcode: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                placeholder="3337"
                required
              />
            </div>

            {/* Save Address Option */}
            {isAuthenticated && allowSave && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="save-address"
                  checked={saveLabel.length > 0}
                  onChange={(e) => {
                    if (!e.target.checked) {
                      setSaveLabel('');
                    }
                  }}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="save-address" className="text-sm text-gray-700 dark:text-gray-300">
                  Save this address for future orders
                </label>
              </div>
            )}

            {isAuthenticated && allowSave && saveLabel.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Address Label (e.g., "Home", "Work")
                </label>
                <input
                  type="text"
                  value={saveLabel}
                  onChange={(e) => setSaveLabel(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                  placeholder="Home"
                />
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  if (formData.address_line1 && formData.city && formData.state && formData.postcode) {
                    if (isAuthenticated && allowSave && saveLabel.trim()) {
                      handleSaveAddress();
                    } else {
                      handleAddressSelect(formData);
                    }
                  } else {
                    alert('Please fill in all required fields');
                  }
                }}
                disabled={saving || !formData.address_line1 || !formData.city || !formData.state || !formData.postcode}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Saving...' : isAuthenticated && allowSave && saveLabel.trim() ? 'Save & Use Address' : 'Use This Address'}
              </button>
              {showNewAddressForm && (
                <button
                  type="button"
                  onClick={() => {
                    setShowNewAddressForm(false);
                    setFormData({
                      address_line1: '',
                      address_line2: '',
                      city: '',
                      state: '',
                      postcode: '',
                      country: 'AU',
                    });
                    setSaveLabel('');
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-neutral-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-700 transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowNewAddressForm(true)}
          className="w-full px-4 py-2 border-2 border-dashed border-gray-300 dark:border-neutral-600 text-gray-600 dark:text-gray-400 rounded-lg hover:border-gray-400 dark:hover:border-neutral-500 transition-colors"
        >
          + Add New Address
        </button>
      )}
    </div>
  );
}
