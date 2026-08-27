import React from 'react';
import { FlatList, Text, TouchableOpacity, View } from 'react-native';
import { Button, Divider, IconButton } from 'react-native-paper';
import { styles } from './pos.styles';
import { getFriendlyOrderNumber } from '../../utils/orderNumber';
import type {
  PosCartItem,
} from '../../app/pos.types';

type Props = {
  isCompactLayout: boolean;
  isPhoneLayout?: boolean;
  onBackToMenu?: () => void;
  orderId?: string;
  editingOrderNumber?: string | null;
  cartItems: PosCartItem[];
  quickOrderNote: string | null;
  setSaltOptionDialogVisible: (visible: boolean) => void;
  activeCartItemId: string | null;
  openCartItemEditor: (item: PosCartItem) => void;
  updateQuantity: (itemId: string, delta: number) => void;
  openNoteEditor: (item: PosCartItem) => void;
  removeCartItem: (itemId: string) => void;
  totals: { subtotal: number; discount?: number; total: number };
  freeItemPromotionTitle?: string | null;
  freeItemSelectionRequired: boolean;
  selectedFreeItemName?: string | null;
  onOpenFreeItemDialog: () => void;
  getCartItemDisplayName: (item: PosCartItem) => string;
  isFreePromotionItem: (item: PosCartItem) => boolean;
  creatingOrder: boolean;
  smartpayPreparing: boolean;
  smartpayProcessing: boolean;
  handleClearCart: () => void;
  openCheckout: () => void;
  openInstorePaymentPrompt: () => void;
  handleCheckout: () => Promise<void>;
  smartpayPaired: boolean;
  handleSmartpayInstoreCheckout: () => Promise<void>;
};

export function PosCartPane({
  isCompactLayout,
  isPhoneLayout,
  onBackToMenu,
  orderId,
  editingOrderNumber,

  cartItems,
  quickOrderNote,
  setSaltOptionDialogVisible,
  activeCartItemId,
  openCartItemEditor,
  updateQuantity,
  openNoteEditor,
  removeCartItem,
  totals,
  freeItemPromotionTitle,
  freeItemSelectionRequired,
  selectedFreeItemName,
  onOpenFreeItemDialog,
  getCartItemDisplayName,
  isFreePromotionItem,
  creatingOrder,
  smartpayPreparing,
  smartpayProcessing,
  handleClearCart,
  openCheckout,
  openInstorePaymentPrompt,
  handleCheckout,
  smartpayPaired,
  handleSmartpayInstoreCheckout,
}: Props) {
  const getPosCalculatedSubtotal = (item: PosCartItem) => (
    (item.base_price + (item.addons || []).reduce((sum, addon) => sum + (addon.addon_item_price || 0), 0)) * item.quantity
  );

  return (
    <View style={[styles.cartPane, isCompactLayout ? styles.cartPaneCompact : null]}>
      {isPhoneLayout && onBackToMenu ? (
        <View style={styles.phoneCartHeader}>
          <Button
            mode="text"
            icon="arrow-left"
            onPress={onBackToMenu}
            compact
            contentStyle={styles.phoneBackToMenuButton}
          >
            Menu
          </Button>
          <View style={styles.phoneCartHeaderSpacer} />
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
      ) : (
        <View style={styles.cartHeader}>
          <View style={styles.cartHeaderActions}>
            <TouchableOpacity
              style={[
                styles.quickOrderNoteButton,
                styles.cartSaltButton,
                quickOrderNote && styles.quickOrderNoteButtonSelected,
              ]}
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
        </View>
      )}

      {editingOrderNumber ? (
        <Text style={styles.cartUpdateIndicator}>
          You are updating order {getFriendlyOrderNumber(editingOrderNumber)}
        </Text>
      ) : null}

      {isPhoneLayout ? (
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
      ) : null}
      {freeItemPromotionTitle ? (
        <TouchableOpacity
          style={[styles.quickOrderNoteButton, freeItemSelectionRequired ? styles.discountCardActive : null]}
          onPress={onOpenFreeItemDialog}
        >
          <View style={styles.quickOrderNoteButtonText}>
            <Text style={styles.quickOrderNoteTitle}>
              {freeItemSelectionRequired ? 'Free item unlocked' : 'Free item selected'}
            </Text>
            <Text style={styles.quickOrderNoteValue} numberOfLines={2}>
              {selectedFreeItemName || freeItemPromotionTitle}
            </Text>
          </View>
          <Text style={styles.quickOrderNoteEdit}>
            {selectedFreeItemName ? 'Change' : 'Choose'}
          </Text>
        </TouchableOpacity>
      ) : null}
      <FlatList
        data={cartItems}
        keyExtractor={(item) => item.id}
        style={styles.cartList}
        ListEmptyComponent={<Text style={styles.emptyCart}>No items yet</Text>}
        renderItem={({ item }) => {
          const showCartActions = item.id === activeCartItemId;
          const hasMarketplaceOverride = item.override_price != null;
          const posCalculatedSubtotal = getPosCalculatedSubtotal(item);
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
                      <Text style={styles.cartItemName} numberOfLines={2}>{getCartItemDisplayName(item)}</Text>
                    </TouchableOpacity>
                    <View style={styles.qtyStepper}>
                      <IconButton icon="minus" size={16} onPress={() => updateQuantity(item.id, -1)} style={styles.stepperButton} />
                      <Text style={styles.cartQuantity}>{item.quantity}</Text>
                      <IconButton icon="plus" size={16} onPress={() => updateQuantity(item.id, 1)} style={styles.stepperButton} />
                    </View>
                    <View style={styles.cartItemPriceBlock}>
                      <Text style={styles.cartItemPrice}>
                        {isFreePromotionItem(item) ? 'FREE' : `$${item.subtotal.toFixed(2)}`}
                      </Text>
                      {hasMarketplaceOverride ? (
                        <Text style={styles.cartItemSecondaryPrice}>
                          POS ${posCalculatedSubtotal.toFixed(2)}
                        </Text>
                      ) : null}
                    </View>
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
        {(totals.discount || 0) > 0 && (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Discount</Text>
            <Text style={[styles.totalValue, styles.discountTotalValue]}>-${(totals.discount || 0).toFixed(2)}</Text>
          </View>
        )}
        <View style={styles.totalRow}>
          <Text style={styles.grandTotalLabel}>Total</Text>
          <Text style={styles.grandTotalValue}>${totals.total.toFixed(2)}</Text>
        </View>
      </View>
      <View style={styles.cartCheckoutActions}>
        <Button
          mode="contained"
          icon={orderId ? 'content-save' : 'cash-register'}
          compact
          loading={Boolean(orderId) && creatingOrder}
          disabled={cartItems.length === 0 || creatingOrder || smartpayProcessing}
          onPress={orderId ? () => void handleCheckout() : openCheckout}
          style={styles.cartCheckoutActionButton}
          contentStyle={styles.cartCheckoutActionButtonContent}
          labelStyle={styles.cartCheckoutActionLabel}
          buttonColor="#16a34a"
        >
          {orderId ? 'Update Order' : 'Checkout'}
        </Button>
        {!orderId && (
          <>
            <Button
              mode="contained-tonal"
              icon="check-circle-outline"
              compact
              loading={creatingOrder && !smartpayPreparing}
              disabled={creatingOrder || smartpayPreparing || smartpayProcessing || cartItems.length === 0}
              onPress={openInstorePaymentPrompt}
              style={styles.cartCheckoutActionButton}
              contentStyle={styles.cartCheckoutActionButtonContent}
              labelStyle={styles.cartCheckoutActionLabel}
              buttonColor="#dc2626"
              textColor="#fff"
            >
              Complete
            </Button>
            <Button
              mode="contained"
              icon="credit-card-wireless-outline"
              compact
              loading={smartpayPreparing || smartpayProcessing}
              disabled={!smartpayPaired || creatingOrder || smartpayPreparing || smartpayProcessing || cartItems.length === 0}
              onPress={() => void handleSmartpayInstoreCheckout()}
              style={styles.cartCheckoutActionButton}
              contentStyle={styles.cartCheckoutActionButtonContent}
              labelStyle={styles.cartCheckoutActionLabel}
              buttonColor="#2563eb"
            >
              SmartPay
            </Button>
          </>
        )}
      </View>
    </View>
  );
}
