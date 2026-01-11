'use server';

import { createServiceRoleClient } from '@/lib/supabase/server';

export interface CartItemAddon {
  addon_group_id: string;
  addon_group_name: string;
  addon_item_id: string;
  addon_item_name: string;
  addon_item_price: number;
}

export interface CartItemData {
  product_id: string;
  product_name: string;
  product_description: string | null;
  product_image_url: string | null;
  base_price: number;
  quantity: number;
  subtotal: number;
  addons: CartItemAddon[];
  comment: string | null;
}

export interface CartData {
  id: string;
  session_id: string;
  user_id: string | null;
  items: CartItemData[];
  created_at: string;
  updated_at: string;
}

// Get or create cart for a session
export async function getOrCreateCart(sessionId: string): Promise<{ data: CartData | null; error: string | null }> {
  try {
    const supabase = await createServiceRoleClient();
    
    // Try to get existing cart
    let { data: cart, error: cartError } = await supabase
      .from('carts')
      .select('*')
      .eq('session_id', sessionId)
      .single();

    // If cart doesn't exist, create it
    if (cartError && cartError.code === 'PGRST116') {
      const { data: newCart, error: createError } = await supabase
        .from('carts')
        .insert([{ session_id: sessionId }])
        .select()
        .single();

      if (createError) {
        console.error('Error creating cart:', createError);
        return { data: null, error: createError.message };
      }

      cart = newCart;
    } else if (cartError) {
      console.error('Error fetching cart:', cartError);
      return { data: null, error: cartError.message };
    }

    // Fetch cart items with addons
    const { data: items, error: itemsError } = await supabase
      .from('cart_items')
      .select('*')
      .eq('cart_id', cart.id)
      .order('created_at', { ascending: true });

    if (itemsError) {
      console.error('Error fetching cart items:', itemsError);
      return { data: null, error: itemsError.message };
    }

    // Fetch addons for each item
    const itemsWithAddons: CartItemData[] = [];
    if (items) {
      for (const item of items) {
        const { data: addons, error: addonsError } = await supabase
          .from('cart_item_addons')
          .select('*')
          .eq('cart_item_id', item.id);

        if (addonsError) {
          console.error('Error fetching cart item addons:', addonsError);
          continue;
        }

        itemsWithAddons.push({
          product_id: item.product_id,
          product_name: item.product_name,
          product_description: item.product_description,
          product_image_url: item.product_image_url,
          base_price: Number(item.base_price),
          quantity: item.quantity,
          subtotal: Number(item.subtotal),
          addons: (addons || []).map(addon => ({
            addon_group_id: addon.addon_group_id,
            addon_group_name: addon.addon_group_name,
            addon_item_id: addon.addon_item_id,
            addon_item_name: addon.addon_item_name,
            addon_item_price: Number(addon.addon_item_price)
          }))
        });
      }
    }

    return {
      data: {
        id: cart.id,
        session_id: cart.session_id,
        user_id: cart.user_id,
        items: itemsWithAddons,
        created_at: cart.created_at,
        updated_at: cart.updated_at
      },
      error: null
    };
  } catch (error) {
    console.error('Unexpected error getting cart:', error);
    return { data: null, error: 'An unexpected error occurred' };
  }
}

// Save cart to database
export async function saveCart(
  sessionId: string,
  items: CartItemData[]
): Promise<{ data: CartData | null; error: string | null }> {
  try {
    const supabase = await createServiceRoleClient();
    
    // Get or create cart
    const cartResult = await getOrCreateCart(sessionId);
    if (cartResult.error) {
      return cartResult;
    }

    const cart = cartResult.data;
    if (!cart) {
      return { data: null, error: 'Failed to get or create cart' };
    }

    // Delete all existing items and addons
    const { error: deleteItemsError } = await supabase
      .from('cart_items')
      .delete()
      .eq('cart_id', cart.id);

    if (deleteItemsError) {
      console.error('Error deleting cart items:', deleteItemsError);
      return { data: null, error: deleteItemsError.message };
    }

    // Insert new items
    if (items.length > 0) {
      const cartItemsToInsert = items.map(item => ({
        cart_id: cart.id,
        product_id: item.product_id,
        product_name: item.product_name,
        product_description: item.product_description,
        product_image_url: item.product_image_url,
        base_price: item.base_price,
        quantity: item.quantity,
        subtotal: item.subtotal,
        comment: item.comment || null
      }));

      const { data: insertedItems, error: insertItemsError } = await supabase
        .from('cart_items')
        .insert(cartItemsToInsert)
        .select();

      if (insertItemsError) {
        console.error('Error inserting cart items:', insertItemsError);
        return { data: null, error: insertItemsError.message };
      }

      // Insert addons for each item
      if (insertedItems) {
        const addonsToInsert: Array<{
          cart_item_id: string;
          addon_group_id: string;
          addon_group_name: string;
          addon_item_id: string;
          addon_item_name: string;
          addon_item_price: number;
        }> = [];

        items.forEach((item, index) => {
          const cartItemId = insertedItems[index]?.id;
          if (cartItemId && item.addons) {
            item.addons.forEach(addon => {
              addonsToInsert.push({
                cart_item_id: cartItemId,
                addon_group_id: addon.addon_group_id,
                addon_group_name: addon.addon_group_name,
                addon_item_id: addon.addon_item_id,
                addon_item_name: addon.addon_item_name,
                addon_item_price: addon.addon_item_price
              });
            });
          }
        });

        if (addonsToInsert.length > 0) {
          const { error: insertAddonsError } = await supabase
            .from('cart_item_addons')
            .insert(addonsToInsert);

          if (insertAddonsError) {
            console.error('Error inserting cart item addons:', insertAddonsError);
            return { data: null, error: insertAddonsError.message };
          }
        }
      }
    }

    // Update cart updated_at timestamp
    await supabase
      .from('carts')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', cart.id);

    // Return updated cart
    return await getOrCreateCart(sessionId);
  } catch (error) {
    console.error('Unexpected error saving cart:', error);
    return { data: null, error: 'An unexpected error occurred' };
  }
}

// Clear cart
export async function clearCart(sessionId: string): Promise<{ error: string | null }> {
  try {
    const supabase = await createServiceRoleClient();
    
    const { data: cart } = await supabase
      .from('carts')
      .select('id')
      .eq('session_id', sessionId)
      .single();

    if (!cart) {
      return { error: null }; // Cart doesn't exist, nothing to clear
    }

    // Delete all items (addons will be cascade deleted)
    const { error } = await supabase
      .from('cart_items')
      .delete()
      .eq('cart_id', cart.id);

    if (error) {
      console.error('Error clearing cart:', error);
      return { error: error.message };
    }

    return { error: null };
  } catch (error) {
    console.error('Unexpected error clearing cart:', error);
    return { error: 'An unexpected error occurred' };
  }
}
