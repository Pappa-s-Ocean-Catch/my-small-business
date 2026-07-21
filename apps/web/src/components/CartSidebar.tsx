'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FaShoppingCart, FaTimes, FaPlus, FaMinus, FaTrash, FaChevronRight, FaEdit, FaComment, FaGift } from 'react-icons/fa';
import { Icon } from '@/components/Icon';
import { useCart } from '@/contexts/CartContext';
import type { CartItem } from '@/contexts/CartContext';
import { ItemCustomizationModal } from '@/components/ItemCustomizationModal';
import { toast } from 'react-toastify';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { getActivePromotions } from '@/app/actions/promotions';
import { computeCartPromotionTotals, findFreeItemEncouragement, type PromotionWithProducts } from '@/lib/promotions';

export function CartSidebar({ hideFloatBubble = false }: { hideFloatBubble?: boolean }) {
  const { items, removeItem, updateQuantity, updateItem, getTotal, clearCart } = useCart();
  const [isOpen, setIsOpen] = useState(false);
  const [editingCommentItemId, setEditingCommentItemId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState<string>('');
  const [itemToRemove, setItemToRemove] = useState<string | null>(null);
  const [itemToEdit, setItemToEdit] = useState<CartItem | null>(null);
  const [activePromotions, setActivePromotions] = useState<PromotionWithProducts[]>([]);
  const [promotionsLoaded, setPromotionsLoaded] = useState(false);
  const [selectedFreeItemId, setSelectedFreeItemId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const loadPromotions = async () => {
      const result = await getActivePromotions();
      if (result.data) setActivePromotions(result.data);
      setPromotionsLoaded(true);
    };

    void loadPromotions();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.sessionStorage.getItem('checkout:selectedFreeItemId');
    if (stored) {
      setSelectedFreeItemId(stored);
    }
  }, []);

  const handleCheckout = () => {
    setIsOpen(false);
    router.push('/order/summary');
  };

  const total = getTotal();
  const totalLabel = `$${total.toFixed(2)}`;
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotalExGst = total / 1.1;
  const gstAmount = total - subtotalExGst;
  const freeItemEncouragement = findFreeItemEncouragement({
    promotions: activePromotions,
    items: items.map((item) => ({
      id: item.id,
      product_id: item.product_id,
      name: item.name,
      base_price: item.base_price,
      quantity: item.quantity,
      subtotal: item.subtotal,
    })),
    cartSubtotal: total,
  });
  const freeItemPromoTotals = computeCartPromotionTotals({
    promotions: activePromotions,
    items: items.map((item) => ({
      id: item.id,
      product_id: item.product_id,
      name: item.name,
      base_price: item.base_price,
      quantity: item.quantity,
      subtotal: item.subtotal,
    })),
    cartSubtotal: total,
    selectedFreeItemId,
  });

  useEffect(() => {
    if (!promotionsLoaded || !selectedFreeItemId) return;
    if (freeItemPromoTotals.freeItemPromotion) return;

    const stillExists = items.some((item) => item.id === selectedFreeItemId);
    if (!stillExists) {
      setSelectedFreeItemId(null);
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem('checkout:selectedFreeItemId');
      }
      return;
    }

    removeItem(selectedFreeItemId);
    setSelectedFreeItemId(null);
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem('checkout:selectedFreeItemId');
    }
    toast.info('Free item removed because the cart no longer qualifies for that promotion.');
  }, [freeItemPromoTotals.freeItemPromotion, items, promotionsLoaded, removeItem, selectedFreeItemId]);

  if ((items.length === 0 && !isOpen) || hideFloatBubble) {
    if (hideFloatBubble) return null;
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-lg transition-all hover:scale-105 flex items-center gap-2"
        aria-label="Open cart"
      >
        <Icon icon={FaShoppingCart} className="w-6 h-6" />
        {total > 0 && (
          <span className="text-sm font-semibold">{totalLabel}</span>
        )}
      </button>
    );
  }

  return (
    <>
      {/* Cart Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 bg-blue-600 hover:bg-blue-700 text-white rounded-full px-4 py-3 shadow-lg transition-all hover:scale-105 flex items-center gap-2"
        aria-label="Open cart"
      >
        <Icon icon={FaShoppingCart} className="w-6 h-6" />
        {total > 0 && (
          <span className="text-sm font-semibold">{totalLabel}</span>
        )}
      </button>

      {/* Cart Sidebar */}
      {isOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Sidebar */}
          <div className="fixed right-0 top-0 h-full w-full sm:w-96 bg-white dark:bg-neutral-900 shadow-xl z-50 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-neutral-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Icon icon={FaShoppingCart} className="text-blue-600" />
                Your Cart
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                aria-label="Close cart"
              >
                <Icon icon={FaTimes} className="w-5 h-5" />
              </button>
            </div>

            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {items.length === 0 ? (
                <div className="text-center py-12">
                  <Icon icon={FaShoppingCart} className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">Your cart is empty</p>
                </div>
              ) : (
                items.map(item => (
                  <div
                    key={item.id}
                    className="bg-gray-50 dark:bg-neutral-800 rounded-lg p-4 border border-gray-200 dark:border-neutral-700"
                  >
                    <div className="flex gap-3">
                      {item.image_url && (
                        <Link href={`/order/product/${item.product_id}`} aria-label={`View details for ${item.name}`}>
                          <img
                            src={item.image_url}
                            alt={item.name}
                            className="w-16 h-16 object-cover rounded-lg"
                          />
                        </Link>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                          <Link href={`/order/product/${item.product_id}`} className="hover:underline">
                            {item.name}
                          </Link>
                        </h3>

                        {/* Add-ons */}
                        {item.addon_groups.length > 0 && (
                          <div className="mt-1 space-y-1">
                            {item.addon_groups.map(group => (
                              group.selected_items.length > 0 && (
                                <div key={group.id} className="text-xs text-gray-600 dark:text-gray-400">
                                  <span className="font-medium">{group.name}:</span>{' '}
                                  {group.selected_items.map(addon => addon.name).join(', ')}
                                </div>
                              )
                            ))}
                          </div>
                        )}

                        {item.removed_ingredients.length > 0 && (
                          <div className="mt-1 text-xs text-orange-700 dark:text-orange-300">
                            <span className="font-medium">Removed:</span> {item.removed_ingredients.join(', ')}
                          </div>
                        )}

                        {/* Comment */}
                        {editingCommentItemId === item.id ? (
                          <div className="mt-2">
                            <textarea
                              value={commentText}
                              onChange={(e) => setCommentText(e.target.value)}
                              rows={2}
                              maxLength={500}
                              className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-900 text-gray-900 dark:text-white resize-none"
                              placeholder="Add special instructions..."
                              autoFocus
                            />
                            <div className="flex items-center gap-2 mt-1">
                              <button
                                onClick={() => {
                                  updateItem(item.id, { comment: commentText.trim() || null });
                                  setEditingCommentItemId(null);
                                  setCommentText('');
                                }}
                                className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => {
                                  setEditingCommentItemId(null);
                                  setCommentText('');
                                }}
                                className="text-xs px-2 py-1 bg-gray-200 dark:bg-neutral-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-neutral-600 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-2">
                            {item.comment ? (
                              <div className="flex items-start gap-2">
                                <Icon icon={FaComment} className="w-3 h-3 text-gray-500 dark:text-gray-400 mt-0.5 flex-shrink-0" />
                                <p className="text-xs text-gray-600 dark:text-gray-400 flex-1">{item.comment}</p>
                                <button
                                  onClick={() => {
                                    setEditingCommentItemId(item.id);
                                    setCommentText(item.comment || '');
                                  }}
                                  className="p-1 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 rounded hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors"
                                  aria-label="Edit comment"
                                >
                                  <Icon icon={FaEdit} className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setEditingCommentItemId(item.id);
                                  setCommentText('');
                                }}
                                className="text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1"
                              >
                                <Icon icon={FaComment} className="w-3 h-3" />
                                Add comment
                              </button>
                            )}
                          </div>
                        )}

                        {/* Quantity Controls */}
                        <div className="flex items-center justify-between mt-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              className="p-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors"
                              aria-label="Decrease quantity"
                            >
                              <Icon icon={FaMinus} className="w-3 h-3" />
                            </button>
                            <span className="text-sm font-medium text-gray-900 dark:text-white w-8 text-center">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              className="p-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors"
                              aria-label="Increase quantity"
                            >
                              <Icon icon={FaPlus} className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => {
                                setItemToEdit(item);
                                setIsOpen(false);
                              }}
                              className="p-1 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors"
                              aria-label="Edit item"
                            >
                              <Icon icon={FaEdit} className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => setItemToRemove(item.id)}
                              className="p-1 text-red-600 hover:text-red-700 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                              aria-label="Remove item"
                            >
                              <Icon icon={FaTrash} className="w-4 h-4" />
                            </button>
                          </div>
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">
                            ${item.subtotal.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer - Order Summary */}
            {items.length > 0 && (
              <div className="border-t border-gray-200 dark:border-neutral-700 p-4 space-y-3">
                {freeItemEncouragement && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100">
                    <div className="flex items-start gap-2">
                      <Icon icon={FaGift} className="mt-0.5 h-4 w-4 text-amber-600 dark:text-amber-300" />
                      <div>
                        <p className="font-semibold">
                          Add ${freeItemEncouragement.remainingAmount.toFixed(2)} more to claim {freeItemEncouragement.promotion.title}.
                        </p>
                        <p className="mt-1 text-amber-800/80 dark:text-amber-100/80">
                          You&apos;re close to unlocking a free eligible item.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                <h3 className="font-semibold text-gray-900 dark:text-white">Order Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>Items</span>
                    <span>{itemCount}</span>
                  </div>
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>Subtotal</span>
                    <span>${subtotalExGst.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>GST (10%)</span>
                    <span>${gstAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-neutral-700 text-base font-semibold">
                    <span className="text-gray-900 dark:text-white">Total</span>
                    <span className="text-green-600 dark:text-green-400">
                      ${total.toFixed(2)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleCheckout}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  Checkout
                  <Icon icon={FaChevronRight} className="w-4 h-4" />
                </button>
                <button
                  onClick={clearCart}
                  className="w-full text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white py-2 transition-colors"
                >
                  Clear Cart
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {itemToEdit && (
        <ItemCustomizationModal
          isOpen={!!itemToEdit}
          onClose={() => setItemToEdit(null)}
          product={{
            id: itemToEdit.product_id,
            name: itemToEdit.name,
            description: itemToEdit.description,
            sale_price: itemToEdit.base_price,
            image_url: itemToEdit.image_url,
          }}
          onAddToCart={() => { }}
          existingCartItem={itemToEdit}
          onUpdateCartItem={(cartItemId, addonGroups, comment, removedIngredients, quantity) => {
            updateItem(cartItemId, {
              addon_groups: addonGroups,
              comment: comment || null,
              removed_ingredients: removedIngredients,
              quantity,
            });
            setItemToEdit(null);
            toast.success('Cart item updated successfully');
          }}
        />
      )}

      {/* Remove Item Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={itemToRemove !== null}
        onClose={() => setItemToRemove(null)}
        onConfirm={() => {
          if (itemToRemove) {
            removeItem(itemToRemove);
            setItemToRemove(null);
          }
        }}
        title="Remove Item"
        message={`Are you sure you want to remove "${items.find(item => item.id === itemToRemove)?.name || 'this item'}" from your cart?`}
        confirmText="Remove"
        cancelText="Cancel"
        variant="warning"
      />
    </>
  );
}
