import { ActionButton as Button } from '@/components/ui/ActionButton';
import React from 'react';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { FlatList, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Divider, IconButton } from 'react-native-paper';
import { styles } from './pos.styles';
import { getFriendlyOrderNumber } from '../../utils/orderNumber';
import { groupAddons } from '../../utils/orderUtils';
import { designTokens as tokens } from '../../lib/redesign';
import type {
  PosCartItem,
} from '../../app/pos.types';

type Props = {
  lockedItemId: string | null;
  cartWidth: number;
  getGroupName: (item: PosCartItem) => string;
  isCompactLayout: boolean;
  isPhoneLayout?: boolean;
  expandedReview?: boolean;
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
  handleCheckout: () => void | Promise<void>;
  smartpayPaired: boolean;
  handleSmartpayInstoreCheckout: () => Promise<void>;
};

export const PosCartPane = React.memo(function PosCartPane({
  lockedItemId,
  cartWidth,
  isCompactLayout,
  isPhoneLayout,
  expandedReview = false,
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

  const renderCartItem = ({ item }: { item: PosCartItem }) => {
    const hasMarketplaceOverride = item.override_price != null;
    return <View style={[styles.cartRow, item.id === activeCartItemId && { backgroundColor: tokens.color.primaryTint }]}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
        <TouchableOpacity style={{ flex: 1, minHeight: 48, gap: 3 }} onPress={() => openCartItemEditor(item)} accessibilityRole="button" accessibilityLabel={`Edit ${item.product_name}`}>
          <Text style={styles.cartItemName}>{getCartItemDisplayName(item)}</Text>
          {Array.from(new Set((item.addons || []).map(addon => addon.addon_group_name))).flatMap(group => groupAddons((item.addons || []).filter(addon => addon.addon_group_name === group))).map((addon, addonIndex) => <Text key={`${item.id}-addon-${addonIndex}`} style={styles.cartItemMeta}>{addon.group}: {addon.quantity > 1 ? `${addon.quantity}x ` : ''}{addon.name}{addon.price ? ` +$${addon.price.toFixed(2)} each` : ''}</Text>)}
          {item.removed_ingredients?.map(ingredient => <Text key={ingredient} style={styles.cartItemRemoved}>No {ingredient}</Text>)}
          {!!item.comment && <Text style={styles.cartItemNote}>Note: {item.comment}</Text>}
        </TouchableOpacity>
        <View style={styles.cartItemPriceBlock}>
          <Text style={styles.cartItemPrice}>{isFreePromotionItem(item) ? 'FREE' : `$${item.subtotal.toFixed(2)}`}</Text>
          {hasMarketplaceOverride && <Text style={styles.cartItemSecondaryPrice}>POS ${getPosCalculatedSubtotal(item).toFixed(2)}</Text>}
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
        <View style={styles.qtyStepper}>
          <IconButton icon="minus" size={16} hitSlop={6} accessibilityLabel={`Decrease ${item.product_name} quantity`} onPress={() => updateQuantity(item.id, -1)} style={styles.stepperButton} />
          <Text style={styles.cartQuantity}>{item.quantity}</Text>
          <IconButton icon="plus" size={16} hitSlop={6} accessibilityLabel={`Increase ${item.product_name} quantity`} onPress={() => updateQuantity(item.id, 1)} style={styles.stepperButton} />
        </View>
        <Text style={[styles.menuSubtitle, { flex: 1 }]}>${(item.subtotal / Math.max(1, item.quantity)).toFixed(2)} each</Text>
        <IconButton icon={item.comment ? 'note-edit-outline' : 'note-plus-outline'} size={18} hitSlop={6} accessibilityLabel={`Note for ${item.product_name}`} onPress={() => openNoteEditor(item)} style={styles.stepperButton} />
        <IconButton icon="trash-can-outline" size={18} hitSlop={6} iconColor={tokens.color.danger} accessibilityLabel={`Remove ${item.product_name}`} onPress={() => removeCartItem(item.id)} style={styles.stepperButton} />
      </View>
    </View>;
  };

  const header = <>
      {isPhoneLayout && !expandedReview && onBackToMenu && <Button icon="arrow-left" onPress={onBackToMenu} contentStyle={{ minHeight: 48 }}>Continue ordering</Button>}
      <View style={styles.cartHeadingRow}>
        <Text style={styles.cartTitle} numberOfLines={1}>Current order</Text>
        <View style={styles.cartCountChip}><Text style={styles.cartCountText}>{cartItems.length} {cartItems.length === 1 ? 'line' : 'lines'}{cartItems.length ? ` · ${cartItems.reduce((sum, item) => sum + item.quantity, 0)} qty` : ''}</Text></View>
        {!expandedReview && <Button mode="outlined" compact disabled={Boolean(orderId) || cartItems.length === 0} onPress={handleClearCart} textColor={tokens.color.danger} style={styles.cartClearAction} contentStyle={{ minHeight: 40 }} labelStyle={{ fontSize: 12, marginHorizontal: 8 }} hitSlop={4}>Clear</Button>}
      </View>
      {editingOrderNumber ? <Text style={styles.cartUpdateIndicator}>You are updating order {getFriendlyOrderNumber(editingOrderNumber)}</Text> : null}
      <View style={styles.cartSaltRow}>
        <Text style={styles.cartSaltLabel}>Order salt: <Text style={{ fontWeight: '700' }}>{quickOrderNote || 'Not selected'}</Text></Text>
        <Button mode="outlined" compact onPress={() => setSaltOptionDialogVisible(true)} contentStyle={{ minHeight: 40 }} labelStyle={{ fontSize: 12 }} hitSlop={4} textColor={tokens.color.text}>Change</Button>
      </View>
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
  </>;
  const footer = <>
      {expandedReview && <Divider />}
      <View style={styles.totals}>
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
      <View style={[styles.cartCheckoutActions, expandedReview && { flexDirection: 'row', alignItems: 'center' }]}>
        {orderId && (
          <Button
            mode="outlined"
            icon="clipboard-text-outline"
            compact
            disabled={cartItems.length === 0 || creatingOrder || smartpayProcessing}
            onPress={openCheckout}
            style={styles.cartCheckoutActionButton}
            contentStyle={styles.cartCheckoutActionButtonContent}
            labelStyle={styles.cartCheckoutActionLabel}
          >
            Edit Checkout Details
          </Button>
        )}
        <Button
          mode="contained"
          icon={orderId ? 'content-save' : 'cash-register'}
          compact
          loading={Boolean(orderId) && creatingOrder}
          disabled={cartItems.length === 0 || creatingOrder || smartpayProcessing}
          onPress={orderId ? () => void handleCheckout() : openCheckout}
          style={[styles.cartCheckoutPrimaryButton, expandedReview && { flex: 1 }, cartItems.length === 0 && { opacity: 0.45 }]}
          theme={{ colors: { surfaceDisabled: tokens.color.primary, onSurfaceDisabled: tokens.color.surface } }}
          contentStyle={styles.cartCheckoutActionButtonContent}
          labelStyle={styles.cartCheckoutActionLabel}
          buttonColor={tokens.color.primary}
        >
          {orderId ? 'Update Order' : 'Checkout'}
        </Button>
        {!orderId && (
          <View style={[styles.cartCheckoutSecondaryActions, expandedReview && { flex: 0, width: 230 }]}>
            <Button
              mode="outlined"
              icon="check-circle-outline"
              compact
              loading={creatingOrder && !smartpayPreparing}
              disabled={creatingOrder || smartpayPreparing || smartpayProcessing || cartItems.length === 0}
              onPress={openInstorePaymentPrompt}
              style={styles.cartCheckoutActionButton}
              contentStyle={styles.cartCheckoutActionButtonContent}
              labelStyle={styles.cartCheckoutActionLabel}
              textColor={tokens.color.text}
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
              buttonColor={tokens.color.surface}
              textColor={tokens.color.text}
            >
              SmartPay
            </Button>
          </View>
        )}
      </View>
  </>;
  if (expandedReview) {
    const panelStyle = { backgroundColor: tokens.color.surface, borderWidth: 1, borderColor: tokens.color.border, borderRadius: 16, padding: 16 };
    return <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 16, paddingBottom: 24 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}><Button mode="outlined" icon="arrow-left" onPress={onBackToMenu}>Continue ordering</Button><Button mode="outlined" disabled={Boolean(orderId) || !cartItems.length} textColor={tokens.color.danger} onPress={handleClearCart}>Clear draft</Button></View>
      <View style={panelStyle}>{header}</View>
      <View style={panelStyle}>{cartItems.length ? cartItems.map(item => <React.Fragment key={item.id}>{renderCartItem({ item })}</React.Fragment>) : <View style={styles.emptyCartState}><Text style={styles.emptyCartTitle}>Your order starts here</Text><Text style={styles.emptyCartDetail}>Tap a product to add it immediately.</Text></View>}</View>
      <View style={panelStyle}>{footer}</View>
    </ScrollView>;
  }
  return (
    <View style={[styles.cartPane, { width: cartWidth }, isCompactLayout ? styles.cartPaneCompact : null]}>
      {!isPhoneLayout && <View style={styles.cartSummaryHeader}>{header}</View>}
      <FlatList
        data={cartItems} keyExtractor={(item) => item.id} style={styles.cartList}
        ListHeaderComponent={isPhoneLayout ? <View style={styles.cartSummaryHeader}>{header}</View> : undefined}
        ListFooterComponent={isPhoneLayout ? <View style={styles.cartSummaryFooter}>{footer}</View> : undefined}
        ListEmptyComponent={<View style={styles.emptyCartState}><MaterialCommunityIcons name="shopping-outline" size={28} color={tokens.color.muted} /><Text style={styles.emptyCartTitle}>Your order starts here</Text><Text style={styles.emptyCartDetail}>Tap a product to add it immediately.</Text></View>}
        renderItem={({ item }) => <View style={{ paddingHorizontal: 16 }}>{renderCartItem({ item })}</View>}
      />
      {!isPhoneLayout && <View style={styles.cartSummaryFooter}>{footer}</View>}
    </View>
  );
});
