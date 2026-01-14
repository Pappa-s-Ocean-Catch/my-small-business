'use client';

import { useState, useEffect } from 'react';
import { FaTimes, FaCheck, FaDollarSign } from 'react-icons/fa';
import Modal from './Modal';
import { ActionButton } from './ActionButton';
import type { AddonGroupWithItems, AddonItem } from '@/app/actions/addons';
import type { CartAddonGroup, CartAddonItem } from '@/contexts/CartContext';
import { getSaleProductAddonGroups, getAddonGroup } from '@/app/actions/addons';
import { Icon } from '@/components/Icon';
interface ItemCustomizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: {
    id: string;
    name: string;
    description: string | null;
    sale_price: number;
    image_url: string | null;
  };
  onAddToCart: (customizations: CartAddonGroup[], comment?: string | null) => void;
}

export function ItemCustomizationModal({
  isOpen,
  onClose,
  product,
  onAddToCart
}: ItemCustomizationModalProps) {
  const [addonGroups, setAddonGroups] = useState<AddonGroupWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAddons, setSelectedAddons] = useState<Record<string, string[]>>({}); // groupId -> itemIds[]
  const [errors, setErrors] = useState<string[]>([]);
  const [comment, setComment] = useState<string>('');

  useEffect(() => {
    if (isOpen && product.id) {
      loadAddonGroups();
    } else {
      // Reset when modal closes
      setSelectedAddons({});
      setErrors([]);
      setComment('');
    }
  }, [isOpen, product.id]);

  const loadAddonGroups = async () => {
    try {
      setLoading(true);
      const result = await getSaleProductAddonGroups(product.id);
      if (result.error) {
        console.error('Error loading add-on groups:', result.error);
        setAddonGroups([]);
        return;
      }

      // Fetch full group details with items
      const groupsWithItems = await Promise.all(
        (result.data || []).map(async (group) => {
          const groupResult = await getAddonGroup(group.id);
          return groupResult.data || null;
        })
      );

      setAddonGroups(groupsWithItems.filter((g): g is AddonGroupWithItems => g !== null));
    } catch (err) {
      console.error('Error loading add-on groups:', err);
      setAddonGroups([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleAddonItem = (groupId: string, itemId: string) => {
    setSelectedAddons(prev => {
      const current = prev[groupId] || [];
      if (current.includes(itemId)) {
        return { ...prev, [groupId]: current.filter(id => id !== itemId) };
      } else {
        return { ...prev, [groupId]: [...current, itemId] };
      }
    });
    // Clear errors when user makes a selection
    setErrors([]);
  };

  const validateSelection = (): boolean => {
    const newErrors: string[] = [];
    
    addonGroups.forEach(group => {
      if (group.is_required && group.is_active) {
        const selected = selectedAddons[group.id] || [];
        if (selected.length === 0) {
          newErrors.push(`${group.name} is required. Please select at least one option.`);
        }
      }
    });

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleAddToCart = () => {
    if (!validateSelection()) {
      return;
    }

    // Convert selected addons to cart format
    const cartAddonGroups: CartAddonGroup[] = addonGroups
      .filter(group => group.is_active)
      .map(group => {
        const selectedItemIds = selectedAddons[group.id] || [];
        const selectedItems: CartAddonItem[] = group.items
          .filter(item => item.is_active && selectedItemIds.includes(item.id))
          .map(item => ({
            id: item.id,
            name: item.name,
            extra_price: item.extra_price
          }));

        return {
          id: group.id,
          name: group.name,
          is_required: group.is_required,
          selected_items: selectedItems
        };
      })
      .filter(group => group.selected_items.length > 0 || group.is_required);

    onAddToCart(cartAddonGroups, comment.trim() || null);
    onClose();
  };

  const getTotalPrice = (): number => {
    let total = product.sale_price;
    addonGroups.forEach(group => {
      const selectedItemIds = selectedAddons[group.id] || [];
      group.items.forEach(item => {
        if (item.is_active && selectedItemIds.includes(item.id)) {
          total += item.extra_price;
        }
      });
    });
    return total;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Customize ${product.name}`}
      size="lg"
      bodyClassName="px-6 sm:px-8 pt-6 sm:pt-8"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
            <span>Total:</span>
            <span className="text-green-600 dark:text-green-400">
              ${getTotalPrice().toFixed(2)}
            </span>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-2 h-10 px-4 rounded-lg border border-gray-300 dark:border-neutral-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
            >
              <Icon icon={FaTimes} className="h-4 w-4" />
              Cancel
            </button>
            <ActionButton
              onClick={handleAddToCart}
              icon={<Icon icon={FaCheck} />}
            >
              Add to Cart
            </ActionButton>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Product Info */}
        <div className="flex gap-4 pb-4 border-b border-gray-200 dark:border-neutral-700">
          {product.image_url && (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-20 h-20 object-cover rounded-lg"
            />
          )}
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 dark:text-white text-lg">
              {product.name}
            </h3>
            {product.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {product.description}
              </p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Base Price:</span>
              <span className="font-semibold text-green-600 dark:text-green-400">
                ${product.sale_price.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Error Messages */}
        {errors.length > 0 && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <ul className="list-disc list-inside space-y-1 text-sm text-red-800 dark:text-red-200">
              {errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Add-on Groups */}
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Loading options...</p>
          </div>
        ) : addonGroups.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p>No customization options available for this item.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {addonGroups
              .filter(group => group.is_active)
              .map(group => (
                <div key={group.id} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-gray-900 dark:text-white">
                      {group.name}
                    </h4>
                    {group.is_required && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                        Required
                      </span>
                    )}
                  </div>
                  {group.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {group.description}
                    </p>
                  )}
                  <div className="space-y-2">
                    {group.items
                      .filter(item => item.is_active)
                      .map(item => {
                        const isSelected = (selectedAddons[group.id] || []).includes(item.id);
                        return (
                          <label
                            key={item.id}
                            className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                              isSelected
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-600'
                                : 'border-gray-200 dark:border-neutral-700 hover:border-gray-300 dark:hover:border-neutral-600'
                            }`}
                          >
                            <div className="flex items-center gap-3 flex-1">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleAddonItem(group.id, item.id)}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              <span className="text-gray-900 dark:text-white">
                                {item.name}
                              </span>
                            </div>
                            {item.extra_price > 0 && (
                              <span className="text-sm font-medium text-green-600 dark:text-green-400">
                                +${item.extra_price.toFixed(2)}
                              </span>
                            )}
                          </label>
                        );
                      })}
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* Comment Section */}
        <div className="pt-4 border-t border-gray-200 dark:border-neutral-700">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Special Instructions (Optional)
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            maxLength={500}
            className="w-full px-4 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-neutral-800 text-gray-900 dark:text-white resize-none"
            placeholder="Add any special instructions or notes for this item..."
          />
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            {comment.length}/500 characters
          </p>
        </div>
      </div>
    </Modal>
  );
}
