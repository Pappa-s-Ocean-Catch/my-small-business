'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { getOrCreateCart, saveCart, clearCart as clearCartDB, type CartItemData } from '@/app/actions/cart';

export interface CartAddonItem {
  id: string;
  name: string;
  extra_price: number;
}

export interface CartAddonGroup {
  id: string;
  name: string;
  is_required: boolean;
  selected_items: CartAddonItem[];
}

export interface CartItem {
  id: string; // Unique ID for this cart item instance
  product_id: string;
  name: string;
  description: string | null;
  base_price: number;
  image_url: string | null;
  quantity: number;
  addon_groups: CartAddonGroup[];
  subtotal: number; // base_price * quantity + addon prices
  comment: string | null; // Optional comment/instructions for this item
}

interface CartContextType {
  items: CartItem[];
  isLoading: boolean;
  addItem: (item: Omit<CartItem, 'id' | 'subtotal'>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  updateItem: (id: string, updates: Partial<CartItem>) => void;
  clearCart: () => void;
  getTotal: () => number;
  getItemCount: () => number;
  syncCart: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

// Generate or retrieve session ID from localStorage
function getSessionId(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  
  const stored = localStorage.getItem('cart_session_id');
  if (stored) {
    return stored;
  }
  
  // Generate new session ID
  const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  localStorage.setItem('cart_session_id', newSessionId);
  return newSessionId;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string>('');

  // Initialize session ID and load cart on mount
  useEffect(() => {
    const initSession = async () => {
      const sid = getSessionId();
      setSessionId(sid);
      
      // Load cart from database
      setIsLoading(true);
      try {
        const result = await getOrCreateCart(sid);
        if (result.data && result.data.items.length > 0) {
          // Convert database items to CartItem format
          const cartItems: CartItem[] = result.data.items.map((item, index) => {
            // Group addons by addon_group_id
            const addonGroupsMap = new Map<string, CartAddonGroup>();
            
            item.addons.forEach(addon => {
              if (!addonGroupsMap.has(addon.addon_group_id)) {
                addonGroupsMap.set(addon.addon_group_id, {
                  id: addon.addon_group_id,
                  name: addon.addon_group_name,
                  is_required: false, // We don't store this in cart, but it's fine
                  selected_items: []
                });
              }
              
              const group = addonGroupsMap.get(addon.addon_group_id)!;
              group.selected_items.push({
                id: addon.addon_item_id,
                name: addon.addon_item_name,
                extra_price: addon.addon_item_price
              });
            });
            
            return {
              id: `${item.product_id}-${index}-${Date.now()}`,
              product_id: item.product_id,
              name: item.product_name,
              description: item.product_description,
              base_price: item.base_price,
              image_url: item.product_image_url,
              quantity: item.quantity,
              addon_groups: Array.from(addonGroupsMap.values()),
              subtotal: item.subtotal
            };
          });
          
          setItems(cartItems);
        }
      } catch (error) {
        console.error('Error loading cart:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    initSession();
  }, []);

  const calculateSubtotal = useCallback((item: Omit<CartItem, 'id' | 'subtotal'>): number => {
    const baseTotal = item.base_price * item.quantity;
    const addonTotal = item.addon_groups.reduce((sum, group) => {
      return sum + group.selected_items.reduce((itemSum, addonItem) => {
        return itemSum + addonItem.extra_price;
      }, 0) * item.quantity;
    }, 0);
    return baseTotal + addonTotal;
  }, []);

  // Sync cart to database
  const syncCart = useCallback(async () => {
    if (!sessionId) return;
    
    try {
      // Convert CartItem[] to CartItemData[]
      const cartData: CartItemData[] = items.map(item => ({
        product_id: item.product_id,
        product_name: item.name,
        product_description: item.description,
        product_image_url: item.image_url,
        base_price: item.base_price,
        quantity: item.quantity,
        subtotal: item.subtotal,
        comment: item.comment || null,
        addons: item.addon_groups.flatMap(group =>
          group.selected_items.map(addonItem => ({
            addon_group_id: group.id,
            addon_group_name: group.name,
            addon_item_id: addonItem.id,
            addon_item_name: addonItem.name,
            addon_item_price: addonItem.extra_price
          }))
        )
      }));
      
      await saveCart(sessionId, cartData);
    } catch (error) {
      console.error('Error syncing cart to database:', error);
    }
  }, [sessionId, items]);

  const addItem = useCallback(async (item: Omit<CartItem, 'id' | 'subtotal'>) => {
    const subtotal = calculateSubtotal(item);
    const newItem: CartItem = {
      ...item,
      id: `${item.product_id}-${Date.now()}-${Math.random()}`,
      subtotal
    };
    setItems(prev => {
      const updated = [...prev, newItem];
      // Sync to database asynchronously
      if (sessionId) {
        const cartData: CartItemData[] = updated.map(cartItem => ({
          product_id: cartItem.product_id,
          product_name: cartItem.name,
          product_description: cartItem.description,
          product_image_url: cartItem.image_url,
          base_price: cartItem.base_price,
          quantity: cartItem.quantity,
          subtotal: cartItem.subtotal,
          comment: cartItem.comment || null,
          addons: cartItem.addon_groups.flatMap(group =>
            group.selected_items.map(addonItem => ({
              addon_group_id: group.id,
              addon_group_name: group.name,
              addon_item_id: addonItem.id,
              addon_item_name: addonItem.name,
              addon_item_price: addonItem.extra_price
            }))
          )
        }));
        saveCart(sessionId, cartData).catch(err => console.error('Error saving cart:', err));
      }
      return updated;
    });
  }, [calculateSubtotal, sessionId]);

  const removeItem = useCallback((id: string) => {
    setItems(prev => {
      const updated = prev.filter(item => item.id !== id);
      // Sync to database asynchronously
      if (sessionId) {
        const cartData: CartItemData[] = updated.map(cartItem => ({
          product_id: cartItem.product_id,
          product_name: cartItem.name,
          product_description: cartItem.description,
          product_image_url: cartItem.image_url,
          base_price: cartItem.base_price,
          quantity: cartItem.quantity,
          subtotal: cartItem.subtotal,
          comment: cartItem.comment || null,
          addons: cartItem.addon_groups.flatMap(group =>
            group.selected_items.map(addonItem => ({
              addon_group_id: group.id,
              addon_group_name: group.name,
              addon_item_id: addonItem.id,
              addon_item_name: addonItem.name,
              addon_item_price: addonItem.extra_price
            }))
          )
        }));
        saveCart(sessionId, cartData).catch(err => console.error('Error saving cart:', err));
      }
      return updated;
    });
  }, [sessionId]);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(id);
      return;
    }
    setItems(prev => {
      const updated = prev.map(item => {
        if (item.id === id) {
          const updatedItem = { ...item, quantity };
          updatedItem.subtotal = calculateSubtotal(updatedItem);
          return updatedItem;
        }
        return item;
      });
      // Sync to database asynchronously
      if (sessionId) {
        const cartData: CartItemData[] = updated.map(cartItem => ({
          product_id: cartItem.product_id,
          product_name: cartItem.name,
          product_description: cartItem.description,
          product_image_url: cartItem.image_url,
          base_price: cartItem.base_price,
          quantity: cartItem.quantity,
          subtotal: cartItem.subtotal,
          comment: cartItem.comment || null,
          addons: cartItem.addon_groups.flatMap(group =>
            group.selected_items.map(addonItem => ({
              addon_group_id: group.id,
              addon_group_name: group.name,
              addon_item_id: addonItem.id,
              addon_item_name: addonItem.name,
              addon_item_price: addonItem.extra_price
            }))
          )
        }));
        saveCart(sessionId, cartData).catch(err => console.error('Error saving cart:', err));
      }
      return updated;
    });
  }, [removeItem, calculateSubtotal, sessionId]);

  const updateItem = useCallback((id: string, updates: Partial<CartItem>) => {
    setItems(prev => {
      const updated = prev.map(item => {
        if (item.id === id) {
          const updatedItem = { ...item, ...updates };
          // Recalculate subtotal if quantity or addons changed
          if (updates.quantity !== undefined || updates.addon_groups !== undefined) {
            updatedItem.subtotal = calculateSubtotal(updatedItem);
          }
          return updatedItem;
        }
        return item;
      });
      // Sync to database asynchronously
      if (sessionId) {
        const cartData: CartItemData[] = updated.map(cartItem => ({
          product_id: cartItem.product_id,
          product_name: cartItem.name,
          product_description: cartItem.description,
          product_image_url: cartItem.image_url,
          base_price: cartItem.base_price,
          quantity: cartItem.quantity,
          subtotal: cartItem.subtotal,
          comment: cartItem.comment || null,
          addons: cartItem.addon_groups.flatMap(group =>
            group.selected_items.map(addonItem => ({
              addon_group_id: group.id,
              addon_group_name: group.name,
              addon_item_id: addonItem.id,
              addon_item_name: addonItem.name,
              addon_item_price: addonItem.extra_price
            }))
          )
        }));
        saveCart(sessionId, cartData).catch(err => console.error('Error saving cart:', err));
      }
      return updated;
    });
  }, [calculateSubtotal, sessionId]);

  const clearCart = useCallback(async () => {
    setItems([]);
    if (sessionId) {
      try {
        await clearCartDB(sessionId);
      } catch (error) {
        console.error('Error clearing cart from database:', error);
      }
    }
  }, [sessionId]);

  const getTotal = useCallback(() => {
    return items.reduce((sum, item) => sum + item.subtotal, 0);
  }, [items]);

  const getItemCount = useCallback(() => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  }, [items]);

  return (
    <CartContext.Provider
      value={{
        items,
        isLoading,
        addItem,
        removeItem,
        updateQuantity,
        updateItem,
        clearCart,
        getTotal,
        getItemCount,
        syncCart
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
