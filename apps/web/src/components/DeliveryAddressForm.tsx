'use client';

import { useEffect, useState } from 'react';
import { FaMapMarkerAlt, FaTrash } from 'react-icons/fa';
import {
  createDeliveryAddress,
  deleteDeliveryAddress,
  getDeliveryAddresses,
  type DeliveryAddress,
} from '@/app/actions/delivery-addresses';
import { AddressAutocomplete } from '@/components/AddressAutocomplete';
import { Icon } from '@/components/Icon';

export interface DeliveryAddressInput {
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  postcode: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  delivery_instructions?: string;
}

interface DeliveryAddressFormProps {
  onAddressSelect: (address: DeliveryAddressInput) => void;
  selectedAddressId?: string | null;
  allowSave?: boolean;
  isAuthenticated?: boolean;
  initialAddress?: DeliveryAddressInput | null;
  compact?: boolean;
}

export function DeliveryAddressForm({
  onAddressSelect,
  selectedAddressId,
  allowSave = true,
  isAuthenticated = false,
  initialAddress = null,
  compact = false,
}: DeliveryAddressFormProps) {
  const [savedAddresses, setSavedAddresses] = useState<DeliveryAddress[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  const [formData, setFormData] = useState<DeliveryAddressInput>(
    initialAddress || {
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      postcode: '',
      country: 'AU',
      delivery_instructions: '',
    }
  );
  const [saving, setSaving] = useState(false);
  const [saveLabel, setSaveLabel] = useState('');

  const hasAutocomplete = Boolean(
    process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  );
  const [showManualFields, setShowManualFields] = useState(!hasAutocomplete);

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
        const defaultAddress = result.data.find((addr) => addr.is_default);
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
      delivery_instructions: (address as DeliveryAddressInput).delivery_instructions || undefined,
    };

    onAddressSelect(addressInput);
    setShowNewAddressForm(false);
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
        is_default: savedAddresses.length === 0,
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
      {isAuthenticated && allowSave && savedAddresses.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
            Saved Addresses
          </h3>
          <div className="space-y-2">
            {savedAddresses.map((address) => (
              <div
                key={address.id}
                className={`cursor-pointer rounded-lg border-2 p-4 transition-colors ${
                  selectedAddressId === address.id
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 hover:border-gray-300 dark:border-neutral-700 dark:hover:border-neutral-600'
                }`}
                onClick={() => handleAddressSelect(address)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {address.label}
                      </span>
                      {address.is_default && (
                        <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-800 dark:bg-blue-900 dark:text-blue-200">
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
                    className="p-1 text-red-600 hover:text-red-700"
                    title="Delete address"
                  >
                    <Icon icon={FaTrash} className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showNewAddressForm || savedAddresses.length === 0 ? (
        <div className="space-y-4">
          <div className="mb-4 flex items-center gap-2">
            <Icon icon={FaMapMarkerAlt} className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {savedAddresses.length === 0 ? 'Delivery Address' : 'New Address'}
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Street Address *
              </label>
              {hasAutocomplete ? (
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
                        delivery_instructions: formData.delivery_instructions,
                      });
                    }}
                    onInputChange={(value) => {
                      setFormData({ ...formData, address_line1: value });
                    }}
                    placeholder="Start typing your address..."
                    country="au"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
                    Start typing and choose your address from the list
                  </p>
                  {!showManualFields && compact && (
                    <button
                      type="button"
                      onClick={() => setShowManualFields(true)}
                      className="mt-3 text-sm font-medium text-emerald-700 underline-offset-4 transition hover:text-emerald-800 hover:underline dark:text-emerald-300 dark:hover:text-emerald-200"
                    >
                      Enter address manually instead
                    </button>
                  )}
                </>
              ) : (
                <>
                  <input
                    type="text"
                    value={formData.address_line1}
                    onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-neutral-600 dark:bg-neutral-800 dark:text-white"
                    placeholder="123 Main Street"
                    required
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
                    Add `NEXT_PUBLIC_GEOAPIFY_API_KEY` to enable address autocomplete
                  </p>
                </>
              )}
            </div>

            {showManualFields && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      City *
                    </label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-neutral-600 dark:bg-neutral-800 dark:text-white"
                      placeholder="Melton"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      State *
                    </label>
                    <input
                      type="text"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-neutral-600 dark:bg-neutral-800 dark:text-white"
                      placeholder="VIC"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Postcode *
                  </label>
                  <input
                    type="text"
                    value={formData.postcode}
                    onChange={(e) => setFormData({ ...formData, postcode: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-neutral-600 dark:bg-neutral-800 dark:text-white"
                    placeholder="3337"
                    required
                  />
                </div>
              </>
            )}

            {compact ? (
              <details className="rounded-2xl border border-dashed border-gray-300 bg-gray-50/80 px-4 py-3 dark:border-neutral-700 dark:bg-neutral-900/50">
                <summary className="cursor-pointer list-none text-sm font-medium text-gray-700 dark:text-gray-300">
                  Add unit number or delivery notes
                </summary>
                <div className="mt-4 grid gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Apartment, Suite, etc. (Optional)
                    </label>
                    <input
                      type="text"
                      value={formData.address_line2}
                      onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-neutral-600 dark:bg-neutral-800 dark:text-white"
                      placeholder="Apt 4B"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Delivery Instructions (Optional)
                    </label>
                    <textarea
                      value={formData.delivery_instructions}
                      onChange={(e) => setFormData({ ...formData, delivery_instructions: e.target.value })}
                      className="min-h-[80px] w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-neutral-600 dark:bg-neutral-800 dark:text-white"
                      placeholder="Gate code, leave at front door, etc."
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
                      Visible to the delivery driver
                    </p>
                  </div>
                </div>
              </details>
            ) : (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Apartment, Suite, etc. (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.address_line2}
                    onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-neutral-600 dark:bg-neutral-800 dark:text-white"
                    placeholder="Apt 4B"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Delivery Instructions (Optional)
                  </label>
                  <textarea
                    value={formData.delivery_instructions}
                    onChange={(e) => setFormData({ ...formData, delivery_instructions: e.target.value })}
                    className="min-h-[80px] w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-neutral-600 dark:bg-neutral-800 dark:text-white"
                    placeholder="Gate code, drop-off spot, etc."
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
                    Visible to the delivery driver
                  </p>
                </div>
              </>
            )}

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
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="save-address" className="text-sm text-gray-700 dark:text-gray-300">
                  Save this address for future orders
                </label>
              </div>
            )}

            {isAuthenticated && allowSave && saveLabel.length > 0 && (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Address Label (e.g., "Home", "Work")
                </label>
                <input
                  type="text"
                  value={saveLabel}
                  onChange={(e) => setSaveLabel(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-neutral-600 dark:bg-neutral-800 dark:text-white"
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
                className="flex-1 rounded-xl bg-blue-600 px-4 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? 'Saving...'
                  : isAuthenticated && allowSave && saveLabel.trim()
                    ? 'Save & Use Address'
                    : 'Use This Address'}
              </button>
              {showNewAddressForm && (
                <button
                  type="button"
                  onClick={() => {
                    setShowNewAddressForm(false);
                    setShowManualFields(!hasAutocomplete);
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
                  className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50 dark:border-neutral-600 dark:text-gray-300 dark:hover:bg-neutral-700"
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
          onClick={() => {
            setShowNewAddressForm(true);
            setShowManualFields(!hasAutocomplete);
          }}
          className="w-full rounded-lg border-2 border-dashed border-gray-300 px-4 py-2 text-gray-600 transition-colors hover:border-gray-400 dark:border-neutral-600 dark:text-gray-400 dark:hover:border-neutral-500"
        >
          + Add New Address
        </button>
      )}

      {loadingAddresses && (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading saved addresses...</p>
      )}
    </div>
  );
}
