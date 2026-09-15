"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { FaCheck, FaDollarSign, FaTimes, FaMinus, FaPlus } from 'react-icons/fa';
import { getSupabaseClient } from '@my-small-business/supabase/client';
import type { AddonGroupWithItems } from '@/app/actions/addons';
import { getSaleProductAddonGroupsWithItems } from '@/app/actions/addons';
import type { CartAddonGroup, CartAddonItem, CartItem } from '@/contexts/CartContext';
import { ActionButton } from './ActionButton';
import { Icon } from '@/components/Icon';
import Modal from './Modal';

type BundleIncludeRow = {
  quantity: number;
  included: {
    id: string;
    name: string;
    sale_price: number;
    image_url: string | null;
  } | null;
};

type RemovableIngredient = {
  id: string;
  ingredient_name: string;
};

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
  onAddToCart: (customizations: CartAddonGroup[], comment?: string | null, removedIngredients?: string[], quantity?: number) => void;
  /** When set, modal opens in edit mode: form is pre-filled and submit calls onUpdateCartItem instead of onAddToCart */
  existingCartItem?: CartItem | null;
  onUpdateCartItem?: (cartItemId: string, addonGroups: CartAddonGroup[], comment: string | null, removedIngredients: string[], quantity: number) => void;
}

export function ItemCustomizationModal({ isOpen, onClose, product, onAddToCart, existingCartItem = null, onUpdateCartItem }: ItemCustomizationModalProps) {
  const [addonGroups, setAddonGroups] = useState<AddonGroupWithItems[]>([]);
  const [bundleIncludes, setBundleIncludes] = useState<BundleIncludeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAddons, setSelectedAddons] = useState<Record<string, string[]>>({});
  const [removableIngredients, setRemovableIngredients] = useState<RemovableIngredient[]>([]);
  const [selectedRemovedIngredientIds, setSelectedRemovedIngredientIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [comment, setComment] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const appliedEditRef = useRef(false);
  const errorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen && product.id) {
      appliedEditRef.current = false;
      void loadDetails();
      return;
    }

    // Reset when modal closes
    appliedEditRef.current = false;
    setSelectedAddons({});
    setErrors([]);
    setComment('');
    setQuantity(1);
    setAddonGroups([]);
    setBundleIncludes([]);
    setRemovableIngredients([]);
    setSelectedRemovedIngredientIds([]);
  }, [isOpen, product.id]);

  // Pre-fill form when opening in edit mode (after addons/ingredients are loaded)
  useEffect(() => {
    if (!isOpen || !existingCartItem || loading) return;
    if (appliedEditRef.current) return;
    appliedEditRef.current = true;
    setQuantity(Math.max(1, Math.min(99, existingCartItem.quantity)));
    setComment(existingCartItem.comment ?? '');
    const addons: Record<string, string[]> = {};
    existingCartItem.addon_groups.forEach((g) => {
      addons[g.id] = g.selected_items.map((i) => i.id);
    });
    setSelectedAddons(addons);
    const ids = removableIngredients
      .filter((ri) => existingCartItem.removed_ingredients.includes(ri.ingredient_name))
      .map((ri) => ri.id);
    setSelectedRemovedIngredientIds(ids);
  }, [isOpen, existingCartItem, loading, removableIngredients]);

  const loadDetails = async () => {
    setLoading(true);
    try {
      await Promise.all([loadAddonGroups(), loadBundleIncludes(), loadRemovableIngredients()]);
    } finally {
      setLoading(false);
    }
  };

  const loadAddonGroups = async () => {
    try {
      const result = await getSaleProductAddonGroupsWithItems(product.id);
      if (result.error) {
        console.error('Error loading add-on groups:', result.error);
        setAddonGroups([]);
        return;
      }

      setAddonGroups((result.data || []) as AddonGroupWithItems[]);
    } catch (err) {
      console.error('Error loading add-on groups:', err);
      setAddonGroups([]);
    }
  };

  const loadBundleIncludes = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('sale_product_includes')
        .select('quantity, included:sale_products!included_sale_product_id(id, name, sale_price, image_url)')
        .eq('parent_sale_product_id', product.id);

      if (error) {
        console.error('Error loading bundle includes:', error);
        setBundleIncludes([]);
        return;
      }

      setBundleIncludes((data || []) as unknown as BundleIncludeRow[]);
    } catch (err) {
      console.error('Error loading bundle includes:', err);
      setBundleIncludes([]);
    }
  };

  const loadRemovableIngredients = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('sale_product_ingredients')
        .select('id, products!product_id(name)')
        .eq('sale_product_id', product.id)
        .eq('customer_can_remove', true);

      if (error) {
        console.error('Error loading removable ingredients:', error);
        setRemovableIngredients([]);
        return;
      }

      const mapped = ((data || []) as Array<{ id: string; products: { name?: string } | { name?: string }[] | null }>).map((row) => {
        const productRef = Array.isArray(row.products) ? row.products[0] : row.products;
        return {
          id: row.id,
          ingredient_name: productRef?.name?.trim() || 'Unknown ingredient',
        };
      });

      setRemovableIngredients(mapped);
    } catch (err) {
      console.error('Error loading removable ingredients:', err);
      setRemovableIngredients([]);
    }
  };

  const setAddonSelection = (group: AddonGroupWithItems, itemId: string | null) => {
    setSelectedAddons((prev) => {
      const current = prev[group.id] || [];
      const newSelections: Record<string, string[]> = { ...prev };

      // Determine the change for the current group
      let updatedGroupSelections: string[] = [];
      if (!itemId) {
        updatedGroupSelections = [];
      } else if (!group.multiple_choice) {
        updatedGroupSelections = [itemId];
      } else {
        // Multiple choice: toggle
        if (current.includes(itemId)) {
          updatedGroupSelections = current.filter((id) => id !== itemId);
        } else {
          updatedGroupSelections = [...current, itemId];
        }
      }

      newSelections[group.id] = updatedGroupSelections;

      // Smart Auto-fill:
      // If this was the first selection for this group (was empty, now has at least one)
      // AND we are selecting an item (itemId is not null)
      if (current.length === 0 && itemId && updatedGroupSelections.includes(itemId)) {
        const selectedItem = group.items.find((i) => i.id === itemId);
        if (selectedItem) {
          const itemName = selectedItem.name;

          // Find other groups that are currently empty
          addonGroups.forEach((otherGroup) => {
            // Only auto-fill if the other group is empty and not the current group
            if (otherGroup.id !== group.id && (prev[otherGroup.id] || []).length === 0) {
              // Find if this group has an item with the exact same name
              const matchingItem = otherGroup.items.find((i) => i.is_active && i.name === itemName);
              if (matchingItem) {
                newSelections[otherGroup.id] = [matchingItem.id];
              }
            }
          });
        }
      }

      return newSelections;
    });
    setErrors([]);
  };

  const validateSelection = (): boolean => {
    const newErrors: string[] = [];

    addonGroups.forEach((group) => {
      if (group.is_required && group.is_active) {
        const selected = selectedAddons[group.id] || [];
        if (group.multiple_choice) {
          if (selected.length === 0) {
            newErrors.push(`${group.name} is required. Please select at least one option.`);
          }
        } else {
          if (selected.length !== 1) {
            newErrors.push(`${group.name} is required. Please select one option.`);
          }
        }
      }
    });

    setErrors(newErrors);

    if (newErrors.length > 0) {
      // Ensure the first error is visible, especially on mobile
      window.setTimeout(() => {
        if (errorRef.current) {
          errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 0);
    }

    return newErrors.length === 0;
  };

  const handleAddToCart = () => {
    if (loading) return;
    if (!validateSelection()) return;

    const cartAddonGroups: CartAddonGroup[] = addonGroups
      .filter((group) => group.is_active)
      .map((group) => {
        const selectedItemIds = selectedAddons[group.id] || [];
        const selectedItems: CartAddonItem[] = group.items
          .filter((item) => item.is_active && selectedItemIds.includes(item.id))
          .map((item) => ({
            id: item.id,
            name: item.name,
            extra_price: item.extra_price,
            section: item.section ?? null,
          }));

        return {
          id: group.id,
          name: group.name,
          is_required: group.is_required,
          selected_items: selectedItems,
        };
      })
      .filter((group) => group.selected_items.length > 0 || group.is_required);

    const removedIngredientNames = removableIngredients
      .filter((ingredient) => selectedRemovedIngredientIds.includes(ingredient.id))
      .map((ingredient) => ingredient.ingredient_name);

    const qty = Math.max(1, Math.min(99, quantity));
    if (existingCartItem && onUpdateCartItem) {
      onUpdateCartItem(existingCartItem.id, cartAddonGroups, comment.trim() || null, removedIngredientNames, qty);
    } else {
      onAddToCart(cartAddonGroups, comment.trim() || null, removedIngredientNames, qty);
    }
    onClose();
  };

  const unitPrice = useMemo((): number => {
    let total = product.sale_price;
    addonGroups.forEach((group) => {
      const selectedItemIds = selectedAddons[group.id] || [];
      group.items.forEach((item) => {
        if (item.is_active && selectedItemIds.includes(item.id)) {
          total += item.extra_price;
        }
      });
    });
    return total;
  }, [addonGroups, product.sale_price, selectedAddons]);

  const totalPrice = useMemo((): number => unitPrice * Math.max(1, Math.min(99, quantity)), [unitPrice, quantity]);

  const bundleOriginalTotal = useMemo(() => {
    return bundleIncludes.reduce((sum, row) => {
      const price = row.included?.sale_price ?? 0;
      const qty = Math.max(1, Number(row.quantity || 1));
      return sum + price * qty;
    }, 0);
  }, [bundleIncludes]);

  const bundleSavings = useMemo(() => {
    return Math.max(0, bundleOriginalTotal - product.sale_price);
  }, [bundleOriginalTotal, product.sale_price]);

  const toggleRemovedIngredient = (ingredientId: string) => {
    setSelectedRemovedIngredientIds((prev) =>
      prev.includes(ingredientId) ? prev.filter((id) => id !== ingredientId) : [...prev, ingredientId]
    );
  };

  const isEditMode = Boolean(existingCartItem && onUpdateCartItem);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? `Edit ${product.name}` : `Customize ${product.name}`}
      size="lg"
      hideHeader={true}
      bodyClassName="p-0 relative"
      footer={
        <div className="w-full flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between px-2">
          <div className="flex items-center justify-between sm:justify-start gap-2 text-xl font-bold text-gray-900 dark:text-white">
            <span>Total:</span>
            <span className="text-amber-500">${totalPrice.toFixed(2)}</span>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 flex-1 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="flex items-center justify-center gap-2 h-14 px-6 rounded-xl bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors w-full sm:w-auto"
            >
              Cancel
            </button>
            <div className="w-full sm:w-auto">
              <ActionButton
                onClick={handleAddToCart}
                icon={<Icon icon={FaCheck} />}
                className="w-full sm:min-w-[200px] h-14 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold shadow-lg shadow-amber-500/25 text-lg"
                disabled={loading}
                loadingText={isEditMode ? 'Updating...' : 'Adding...'}
              >
                {isEditMode ? 'Update Item' : 'Add to Cart'}
              </ActionButton>
            </div>
          </div>
        </div>
      }
    >
      <div className="relative">
        {/* Floating Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/90 dark:bg-neutral-900/90 shadow-md flex items-center justify-center hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors backdrop-blur-sm"
        >
          <Icon icon={FaTimes} className="w-5 h-5 text-gray-700 dark:text-gray-300" />
        </button>

        {/* Hero Image */}
        {product.image_url ? (
          <div className="w-full h-64 sm:h-72 relative">
            <img 
              src={product.image_url} 
              alt={product.name} 
              className="absolute inset-0 w-full h-full object-cover" 
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
              <h3 className="font-serif font-bold text-white text-3xl sm:text-4xl drop-shadow-md">{product.name}</h3>
              {product.description && (
                <p className="text-sm sm:text-base text-white/90 mt-2 max-w-lg drop-shadow-sm line-clamp-2">{product.description}</p>
              )}
            </div>
          </div>
        ) : (
          <div className="p-6 sm:p-8 pb-0">
            <h3 className="font-serif font-bold text-gray-900 dark:text-white text-3xl sm:text-4xl">{product.name}</h3>
            {product.description && (
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-2">{product.description}</p>
            )}
          </div>
        )}

        <div className="p-6 sm:p-8 space-y-8">
          {/* Base Price & Quantity */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-200 dark:border-neutral-800">
            <div className="flex items-baseline gap-2">
              <span className="text-gray-600 dark:text-gray-400 font-medium">Base Price:</span>
              <span className="font-bold text-2xl text-amber-500">${product.sale_price.toFixed(2)}</span>
            </div>
            {/* Quantity Selector */}
            <div className="flex items-center gap-4">
              <span className="font-medium text-gray-700 dark:text-gray-300">Quantity</span>
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-neutral-800 rounded-xl p-1 shadow-inner">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="w-10 h-10 rounded-lg bg-white dark:bg-neutral-700 shadow-sm flex items-center justify-center text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-neutral-600 transition-colors"
                  aria-label="Decrease quantity"
                >
                  <Icon icon={FaMinus} className="w-4 h-4" />
                </button>
                <span className="w-12 text-center font-bold text-lg text-gray-900 dark:text-white tabular-nums">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(99, q + 1))}
                  className="w-10 h-10 rounded-lg bg-white dark:bg-neutral-700 shadow-sm flex items-center justify-center text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-neutral-600 transition-colors"
                  aria-label="Increase quantity"
                >
                  <Icon icon={FaPlus} className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

        {/* Removable Ingredients - moved to top */}
        {!loading && removableIngredients.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-gray-900 dark:text-white">Remove Ingredients</h4>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 dark:bg-neutral-700 dark:text-gray-300">
                Optional
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Select ingredients you want removed from this item.
            </p>
            <div className="space-y-2">
              {removableIngredients.map((ingredient) => {
                const isSelected = selectedRemovedIngredientIds.includes(ingredient.id);
                return (
                  <label
                    key={ingredient.id}
                    className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${isSelected
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRemovedIngredient(ingredient.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="font-medium text-gray-900 dark:text-white">{ingredient.ingredient_name}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Bundle / Pack Includes */}
        {bundleIncludes.length > 0 && (
          <div className="rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50/50 dark:bg-neutral-800/50 p-4">
            <div className="flex items-center justify-between gap-4">
              <h4 className="font-semibold text-gray-900 dark:text-white">This pack includes</h4>
              <div className="text-sm text-gray-700 dark:text-gray-300">
                <span className="line-through text-gray-500 dark:text-gray-400 mr-2">${bundleOriginalTotal.toFixed(2)}</span>
                <span className="font-semibold">${product.sale_price.toFixed(2)}</span>
                {bundleSavings > 0 && (
                  <span className="ml-2 font-semibold text-green-700 dark:text-green-300">Save ${bundleSavings.toFixed(2)}</span>
                )}
              </div>
            </div>

            <ul className="mt-3 space-y-2">
              {bundleIncludes.map((row, idx) => (
                <li
                  key={`${row.included?.id ?? 'unknown'}-${idx}`}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <div className="min-w-0">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {Math.max(1, Number(row.quantity || 1))}× {row.included?.name ?? 'Unknown item'}
                    </span>
                  </div>
                  <div className="text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    ${(Math.max(1, Number(row.quantity || 1)) * (row.included?.sale_price ?? 0)).toFixed(2)}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Error Messages */}
        {errors.length > 0 && (
          <div
            ref={errorRef}
            className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4"
          >
            <ul className="list-disc list-inside space-y-1 text-sm text-red-800 dark:text-red-200">
              {errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Add-on Groups */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-600 mx-auto"></div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-4">Loading options...</p>
          </div>
        ) : addonGroups.length === 0 && removableIngredients.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-neutral-800/50 rounded-2xl">
            <p className="font-medium">No customization options available for this item.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {addonGroups
              .map((group) => (
                <div key={group.id} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-white text-lg">{group.name}</h4>
                      {group.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{group.description}</p>
                      )}
                    </div>
                    {group.is_required && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                        Required
                      </span>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {!group.multiple_choice && !group.is_required && (
                      <label
                        className={`flex items-center p-4 border-2 rounded-2xl cursor-pointer transition-all ${(selectedAddons[group.id] || []).length === 0
                          ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-500/10'
                          : 'border-gray-100 dark:border-neutral-800 hover:border-cyan-200 dark:hover:border-cyan-800 bg-white dark:bg-neutral-900 shadow-sm'
                          }`}
                      >
                        <div className="flex items-center gap-3 w-full">
                          <input
                            type="radio"
                            name={`addon-${group.id}`}
                            checked={(selectedAddons[group.id] || []).length === 0}
                            onChange={() => setAddonSelection(group, null)}
                            className="w-5 h-5 rounded-full border-gray-300 text-cyan-600 focus:ring-cyan-500"
                          />
                          <div className="font-semibold text-gray-900 dark:text-white text-base">No thanks</div>
                        </div>
                      </label>
                    )}
                    {group.items
                      .filter((item) => item.is_active)
                      .map((item) => {
                        const isSelected = (selectedAddons[group.id] || []).includes(item.id);
                        return (
                          <label
                            key={item.id}
                            className={`flex items-center justify-between p-4 border-2 rounded-2xl cursor-pointer transition-all ${isSelected
                              ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-500/10'
                              : 'border-gray-100 dark:border-neutral-800 hover:border-cyan-200 dark:hover:border-cyan-800 bg-white dark:bg-neutral-900 shadow-sm'
                              }`}
                          >
                            <div className="flex items-center gap-3 w-full">
                              <input
                                type={group.multiple_choice ? 'checkbox' : 'radio'}
                                name={group.multiple_choice ? undefined : `addon-${group.id}`}
                                checked={isSelected}
                                onChange={() => setAddonSelection(group, item.id)}
                                className={`w-5 h-5 border-gray-300 text-cyan-600 focus:ring-cyan-500 ${
                                  group.multiple_choice ? 'rounded' : 'rounded-full'
                                }`}
                              />
                              <div className="flex-1">
                                <div className="font-semibold text-gray-900 dark:text-white text-base leading-tight">{item.name}</div>
                              </div>
                            </div>
                            {item.extra_price > 0 && (
                              <div className="flex items-center gap-0.5 text-amber-600 dark:text-amber-400 font-bold whitespace-nowrap ml-3 bg-white dark:bg-neutral-800 px-2 py-1 rounded-lg">
                                <span>+${item.extra_price.toFixed(2)}</span>
                              </div>
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
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">{comment.length}/500 characters</p>
        </div>
        </div>
      </div>
    </Modal>
  );

}
