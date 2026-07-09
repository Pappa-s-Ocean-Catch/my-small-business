import React from 'react';
import { FlatList, Text, TouchableOpacity, View } from 'react-native';
import { Button, Divider, IconButton } from 'react-native-paper';
import { styles } from '../../app/pos.styles';
import type {
  PosCartItem,
} from '../../app/pos.types';

type Props = {
  isCompactLayout: boolean;
  orderId?: string;
  cartItems: PosCartItem[];
  quickOrderNote: string | null;
  setSaltOptionDialogVisible: (visible: boolean) => void;
  activeCartItemId: string | null;
  openCartItemEditor: (item: PosCartItem) => void;
  updateQuantity: (itemId: string, delta: number) => void;
  openNoteEditor: (item: PosCartItem) => void;
  removeCartItem: (itemId: string) => void;
  totals: { subtotal: number; total: number };
  creatingOrder: boolean;
  smartpayProcessing: boolean;
  handleClearCart: () => void;
  openCheckout: () => void;
  handleCheckout: () => Promise<void>;
  smartpayPaired: boolean;
  handleSmartpayInstoreCheckout: () => Promise<void>;
};

export function PosCartPane({
  isCompactLayout,
  orderId,
  cartItems,
  quickOrderNote,
  setSaltOptionDialogVisible,
  activeCartItemId,
  openCartItemEditor,
  updateQuantity,
  openNoteEditor,
  removeCartItem,
  totals,
  creatingOrder,
  smartpayProcessing,
  handleClearCart,
  openCheckout,
  handleCheckout,
  smartpayPaired,
  handleSmartpayInstoreCheckout,
}: Props) {
  return (
    <View style={[styles.cartPane, isCompactLayout ? styles.cartPaneCompact : null]}>
      <View style={styles.cartHeader}>
        <Text style={styles.cartTitle}>Current Order</Text>
        <Button
          mode="outlined"
          icon="trash-can-outline"
          compact
          disabled={Boolean(orderId) || cartItems.length === 0}
          onPress={handleClearCart}
          textColor="#dc2626"
          style={styles.clearCartButton}
        >
          Clear
        </Button>
      </View>
      <TouchableOpacity
        style={[styles.quickOrderNoteButton, quickOrderNote && styles.quickOrderNoteButtonSelected]}
        onPress={() => setSaltOptionDialogVisible(true)}
      >
        <View style={styles.quickOrderNoteButtonText}>
          <Text style={[styles.quickOrderNoteTitle, quickOrderNote && styles.quickOrderNoteTitleSelected]}>
            Salt option
          </Text>
          <Text style={[styles.quickOrderNoteValue, quickOrderNote && styles.quickOrderNoteValueSelected]} numberOfLines={1}>
            {quickOrderNote || 'Not selected'}
          </Text>
        </View>
        <Text style={[styles.quickOrderNoteEdit, quickOrderNote && styles.quickOrderNoteEditSelected]}>
          Change
        </Text>
      </TouchableOpacity>
      <FlatList
        data={cartItems}
        keyExtractor={(item) => item.id}
        style={styles.cartList}
        ListEmptyComponent={<Text style={styles.emptyCart}>No items yet</Text>}
        renderItem={({ item }) => {
          const showCartActions = item.id === activeCartItemId;
          return (
            <View style={styles.cartRow}>
              <View style={styles.cartItemHeader}>
                <View style={styles.cartItemText}>
                  <View style={styles.cartItemTopLine}>
                    <TouchableOpacity
                      style={styles.cartItemNameButton}
                      onPress={() => openCartItemEditor(item)}
                      accessibilityRole="button"
                      accessibilityLabel={`Edit ${item.product_name}`}
                    >
                      <Text style={styles.cartItemName} numberOfLines={2}>{item.product_name}</Text>
                    </TouchableOpacity>
                    <View style={styles.qtyStepper}>
                      <IconButton icon="minus" size={16} onPress={() => updateQuantity(item.id, -1)} style={styles.stepperButton} />
                      <Text style={styles.cartQuantity}>{item.quantity}</Text>
                      <IconButton icon="plus" size={16} onPress={() => updateQuantity(item.id, 1)} style={styles.stepperButton} />
                    </View>
                    <Text style={styles.cartItemPrice}>${item.subtotal.toFixed(2)}</Text>
                  </View>
                  <View style={styles.cartItemDetails}>
                    {item.addons?.map((addon) => (
                      <Text key={`${item.id}-addon-${addon.addon_item_id}`} style={styles.cartItemMeta} numberOfLines={1}>
                        + {addon.addon_item_name}
                        {addon.addon_item_price > 0 ? ` $${addon.addon_item_price.toFixed(2)}` : ''}
                      </Text>
                    ))}
                    {item.removed_ingredients?.map((ingredient) => (
                      <Text key={`${item.id}-removed-${ingredient}`} style={styles.cartItemRemoved} numberOfLines={1}>
                        No {ingredient}
                      </Text>
                    ))}
                    {item.comment && <Text style={styles.cartItemNote} numberOfLines={2}>{item.comment}</Text>}
                  </View>
                </View>
              </View>
              {showCartActions && (
                <View style={styles.cartControls}>
                  <Button mode="outlined" compact icon="pencil" onPress={() => openCartItemEditor(item)} style={styles.cartActionButton}>
                    Edit
                  </Button>
                  <Button mode="outlined" compact icon={item.comment ? 'note-edit-outline' : 'note-plus-outline'} onPress={() => openNoteEditor(item)} style={styles.cartActionButton}>
                    Note
                  </Button>
                  <Button mode="outlined" compact icon="trash-can-outline" textColor="#dc2626" onPress={() => removeCartItem(item.id)} style={styles.cartActionButton}>
                    Remove
                  </Button>
                </View>
              )}
            </View>
          );
        }}
      />
      <Divider />
      <View style={styles.totals}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total items</Text>
          <Text style={styles.totalValue}>{cartItems.length}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Subtotal</Text>
          <Text style={styles.totalValue}>${totals.subtotal.toFixed(2)}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.grandTotalLabel}>Total</Text>
          <Text style={styles.grandTotalValue}>${totals.total.toFixed(2)}</Text>
        </View>
      </View>
      <Button
        mode="contained"
        icon={orderId ? 'content-save' : 'cash-register'}
        disabled={cartItems.length === 0 || creatingOrder || smartpayProcessing}
        onPress={orderId ? () => void handleCheckout() : openCheckout}
        style={styles.checkoutButton}
        buttonColor="#16a34a"
      >
        {orderId ? 'Update Order' : 'Checkout'}
      </Button>
      {!orderId && (
        <View style={styles.quickActionsPanel}>
          <Text style={styles.quickActionsTitle}>Quick actions</Text>
          <View style={styles.quickPaymentRow}>
            <Button
              mode="contained-tonal"
              icon="check-circle-outline"
              loading={creatingOrder}
              disabled={creatingOrder || smartpayProcessing || cartItems.length === 0}
              onPress={openCheckout}
              style={[styles.checkoutButton, styles.quickPaymentButton, styles.completeButton]}
              buttonColor="#dc2626"
              textColor="#fff"
            >
              Complete
            </Button>
            <Button
              mode="contained"
              icon="credit-card-wireless-outline"
              loading={smartpayProcessing}
              disabled={!smartpayPaired || creatingOrder || smartpayProcessing || cartItems.length === 0}
              onPress={() => void handleSmartpayInstoreCheckout()}
              style={[styles.checkoutButton, styles.quickPaymentButton]}
              buttonColor="#2563eb"
            >
              SmartPay
            </Button>
          </View>
        </View>
      )}
    </View>
  );
}
