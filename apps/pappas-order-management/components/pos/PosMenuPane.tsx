import { toggleNotePreset } from '@/lib/note-presets';
import { ActionButton as Button } from '@/components/ui/ActionButton';
import React from 'react';
import { PosProductTile } from './PosProductTile';
import { PosGroupTile } from './PosConfigurableTile';
import { findPosProductConfig, type PosLayoutData } from '@/lib/pos-layout-config';
import { EditorSheet, FormField, HeaderIconButton } from '@/components/ui';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { designTokens as tokens } from '../../lib/redesign';
import { FlatList, Text, TouchableOpacity, View } from 'react-native';
import type { DimensionValue } from 'react-native';
import { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { TextInput } from 'react-native-paper';

import { styles } from './pos.styles';
import type {
  AddonGroup,
  LayoutCategoryButton,
  PosInstorePaymentChoice,
  PosPaymentChoice,
  PosThirdPartySource,
  RemovableIngredient,
  SaleCategory,
  SaleProduct,
  TopSellerProduct,
} from '../../app/pos.types';
import { PosCheckoutPanel } from './PosCheckoutPanel';
import type { PosCheckoutTab } from './PosCheckoutPanel';
import type { DeliveryAddressDraft, DeliveryQuoteResult } from '../../lib/delivery';
import type { Customer } from '../../lib/customers';

type MenuLevel = 'groups' | 'subgroups' | 'items' | 'addons' | 'checkout' | 'search' | 'quick-list';

type CustomerLookupStatus = 'idle' | 'loading' | 'found' | 'new' | 'error';

type Props = {
  quickItemNotes?: string[];
  layout?: PosLayoutData | null;
  layoutCategoryId?: string;
  productQuery: string;
  onProductQueryChange: (value: string) => void;
  groupQuery: string;
  onGroupQueryChange: (value: string) => void;
  groupScrollOffset: React.MutableRefObject<number>;
  groupColumns: number;
  hasAddons: (productId: string) => boolean;
  getProductGroupName: (product: SaleProduct) => string;
  itemFeedback: string;
  hasEditorDraft: boolean;
  onResumeDraft: () => void;
  editorQuantity: number;
  onEditorQuantityChange: (value: number) => void;
  editorNote: string;
  onEditorNoteChange: (value: string) => void;
  editorError: string | null;
  editingItem: boolean;
  onConfirmEditor: () => void;
  onCancelEditor: () => void;
  isPhoneLayout?: boolean;
  onOpenCart?: () => void;
  menuLevel: MenuLevel;
  gridColumns: number;

  quickListColumns: number;
  addonOptionWidth: DimensionValue;
  layoutTopLevelCategories: LayoutCategoryButton[];
  topSellers: TopSellerProduct[];
  loadingTopSellers: boolean;
  quickQuantityForProduct: (productId: string) => number;
  openCategory: (categoryId: string) => void;
  quickAddProduct: (
    product: SaleProduct,
    options?: { forcePlainAdd?: boolean; skipCustomization?: boolean }
  ) => Promise<void>;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  searchResults: SaleProduct[];
  loadingSearchProducts: boolean;
  backToGroups: () => void;
  activeParentCategoryName: string;
  childCategoriesForSelectedGroup: SaleCategory[];
  activeLayoutCategory: { color?: string; title?: string; showProductsOnTopLevel?: boolean } | null;
  openSubcategory: (categoryId: string) => void;
  activeCategoryName: string;
  layoutProducts: SaleProduct[];
  loadingProducts: boolean;
  itemsBackAction: () => void;
  itemsBackLabel: string;
  selectedParentCatId: string | null;
  setQuickListVisible: (visible: boolean) => void;
  quickAccessProducts: SaleProduct[];
  productButtonColor: (productId: string) => string | undefined;
  productTilePalette: (productId: string) => { backgroundColor: string; borderColor: string; priceColor: string };
  selectedProduct: SaleProduct | null;
  backToItems: () => void;
  editorRemovableIngredients: RemovableIngredient[];
  editorRemovedIngredientIds: Record<string, boolean>;
  toggleRemovedIngredient: (ingredientId: string) => void;
  editorAddonGroups: AddonGroup[];
  loadingAddons: boolean;
  editorAddonQuantities: Record<string, number>;
  changeAddonQuantity: (group: AddonGroup, item: AddonGroup['items'][number], delta: number) => void;
  addonGroupPalette: (groupId: string) => { backgroundColor: string; borderColor: string; labelColor: string };
  addonSelectionCount: number;
  addonSelectionTotal: number;
  openCheckout: () => void;
  customerLookupStatus: CustomerLookupStatus;
  customerPhone: string;
  onChangeCustomerPhone: (value: string) => void;
  customerName: string;
  onChangeCustomerName: (value: string) => void;
  customerLookupError: string | null;
  selectedCustomer: Customer | null;
  onSelectCustomer: (customer: Customer) => void;
  onClearCustomer: () => void;
  onResetToDefaultInstore: () => void;
  rewardPointsEnabled: boolean;
  rewardPointsBalance: number;
  rewardPointsDollarValue: number;
  rewardPointsApplied: boolean;
  appliedRewardPointsValue: number;
  onToggleRewardPoints: () => void;
  totals: { subtotal: number; tax: number; total: number };
  freeItemPromotionTitle?: string | null;
  freeItemSelectionRequired: boolean;
  selectedFreeItemName?: string | null;
  onOpenFreeItemDialog: () => void;
  discountLabel: string;
  discountAmount: number;
  activeDiscountPercent: number | null;
  selectDiscountPreset: (percent: number) => void;
  openDiscountDialog: () => void;
  cartItemsCount: number;
  isPreOrder: boolean;
  setIsPreOrder: (value: boolean) => void;
  scheduledPickupAt: Date;
  setScheduledPickupAt: React.Dispatch<React.SetStateAction<Date>>;
  defaultPickupTime: () => Date;
  formatPickupTime: (date: Date) => string;
  openPickupPicker: (mode: 'date' | 'time') => void;
  showPickupPicker: boolean;
  pickupPickerMode: 'date' | 'time';
  handlePickupPickerChange: (event: DateTimePickerEvent, date?: Date) => void;
  orderNoteText: string;
  setOrderNoteText: (value: string) => void;
  creatingOrder: boolean;
  smartpayPreparing: boolean;
  smartpayProcessing: boolean;
  orderId?: string;
  checkoutPrimaryLabel: string;
  handleCheckout: (override?: 'card' | 'cash' | 'no_pay' | 'smartpay') => Promise<void>;
  smartpayPaired: boolean;
  handleInstoreCheckout: (payment: PosInstorePaymentChoice) => Promise<void>;
  handleSmartpayInstoreCheckout: () => Promise<void>;
  handleDeliveryCheckout: (input: {
    address: DeliveryAddressDraft;
    quote: DeliveryQuoteResult;
  }) => Promise<void>;
  thirdPartySource: PosThirdPartySource;
  setThirdPartySource: (value: PosThirdPartySource) => void;
  thirdPartyCustomerName: string;
  setThirdPartyCustomerName: (value: string) => void;
  thirdPartyExternalOrderId: string;
  setThirdPartyExternalOrderId: (value: string) => void;
  thirdPartyOrderAt: Date;
  formatOrderTime: (date: Date) => string;
  openThirdPartyOrderAtPicker: (mode: 'date' | 'time') => void;
  showThirdPartyOrderAtPicker: boolean;
  thirdPartyOrderAtPickerMode: 'date' | 'time';
  handleThirdPartyOrderAtPickerChange: (event: DateTimePickerEvent, date?: Date) => void;
  handleThirdPartyCheckout: () => Promise<void>;
  initialCheckoutTab?: PosCheckoutTab;
};

export const PosMenuPane = React.memo(function PosMenuPane(props: Props) {
  const {
    isPhoneLayout,
    onOpenCart,
    menuLevel,
    gridColumns,

    quickListColumns,
    addonOptionWidth,
    layoutTopLevelCategories,
    topSellers,
    loadingTopSellers,
    quickQuantityForProduct,
    openCategory,
    quickAddProduct,
    searchQuery,
    setSearchQuery,
    searchResults,
    loadingSearchProducts,
    backToGroups,
    activeParentCategoryName,
    childCategoriesForSelectedGroup,
    activeLayoutCategory,
    openSubcategory,
    activeCategoryName,
    layoutProducts,
    loadingProducts,
    itemsBackAction,
    itemsBackLabel,
    selectedParentCatId,
    setQuickListVisible,
    quickAccessProducts,
    productButtonColor,
    productTilePalette,
    selectedProduct,
    backToItems,
    editorRemovableIngredients,
    editorRemovedIngredientIds,
    toggleRemovedIngredient,
    editorAddonGroups,
    loadingAddons,
    editorAddonQuantities,
    changeAddonQuantity,
    addonGroupPalette,
    addonSelectionCount,
    addonSelectionTotal,
    openCheckout,
    customerLookupStatus,
    customerPhone,
    onChangeCustomerPhone,
    customerName,
    onChangeCustomerName,
    customerLookupError,
    selectedCustomer,
    onSelectCustomer,
    onClearCustomer,
    onResetToDefaultInstore,
    rewardPointsEnabled,
    rewardPointsBalance,
    rewardPointsDollarValue,
    rewardPointsApplied,
    appliedRewardPointsValue,
    onToggleRewardPoints,
    totals,
    freeItemPromotionTitle,
    freeItemSelectionRequired,
    selectedFreeItemName,
    onOpenFreeItemDialog,
    discountLabel,
    discountAmount,
    activeDiscountPercent,
    selectDiscountPreset,
    openDiscountDialog,
    cartItemsCount,
    isPreOrder,
    setIsPreOrder,
    scheduledPickupAt,
    setScheduledPickupAt,
    defaultPickupTime,
    formatPickupTime,
    openPickupPicker,
    showPickupPicker,
    pickupPickerMode,
    handlePickupPickerChange,
    orderNoteText,
    setOrderNoteText,
    creatingOrder,
    smartpayPreparing,
    smartpayProcessing,
    orderId,
    checkoutPrimaryLabel,
    handleCheckout,
    smartpayPaired,
    handleInstoreCheckout,
    handleSmartpayInstoreCheckout,
    handleDeliveryCheckout,
    thirdPartySource,
    setThirdPartySource,
    thirdPartyCustomerName,
    setThirdPartyCustomerName,
    thirdPartyExternalOrderId,
    setThirdPartyExternalOrderId,
    thirdPartyOrderAt,
    formatOrderTime,
    openThirdPartyOrderAtPicker,
    showThirdPartyOrderAtPicker,
    thirdPartyOrderAtPickerMode,
    handleThirdPartyOrderAtPickerChange,
    handleThirdPartyCheckout,
    initialCheckoutTab,
  } = props;

  const addonListRef = React.useRef<FlatList<AddonGroup>>(null);
  const [noteVisible, setNoteVisible] = React.useState(false);
  const [topSellersExpanded, setTopSellersExpanded] = React.useState(false);
  const [noteDraft, setNoteDraft] = React.useState('');
  React.useEffect(() => {
    if (!props.editorError) return;
    const index = editorAddonGroups.findIndex((group) => props.editorError?.includes(group.name));
    if (index >= 0) addonListRef.current?.scrollToIndex({ index, animated: false, viewPosition: 0 });
  }, [props.editorError, editorAddonGroups]);

  return (
    <View style={styles.menuPane}>
      {!!props.itemFeedback && <Text accessibilityLiveRegion="polite" style={styles.feedback}>{props.itemFeedback}</Text>}
      {props.hasEditorDraft && menuLevel !== 'addons' && menuLevel !== 'checkout' && <Button onPress={props.onResumeDraft}>Return to item options</Button>}
      {menuLevel === 'groups' && (
        <View style={styles.groupScreen}>
          <FlatList
            data={layoutTopLevelCategories}
            contentOffset={{ x: 0, y: props.groupScrollOffset.current }}
            onScroll={(event) => { props.groupScrollOffset.current = event.nativeEvent.contentOffset.y; }}
            scrollEventThrottle={100}
            keyExtractor={(item) => item.id}
            numColumns={props.groupColumns}
            columnWrapperStyle={undefined}
            ItemSeparatorComponent={undefined}
            key={`groups-${props.groupColumns}`}
            ListEmptyComponent={<View style={styles.emptyState}><Text style={styles.emptyTitle}>No matching groups</Text><Text style={styles.menuSubtitle}>Try another group name.</Text></View>}
            contentContainerStyle={styles.tileGrid}
            renderItem={({ item }) => (
              <PosGroupTile label={item.name} subtitle={`${item.productCount} products`} columns={props.groupColumns} layout={props.layout} tileConfig={props.layout?.categories.find(c => c.categoryId === item.id)} onPress={() => openCategory(item.id)} />
            )}
          />


        </View>
      )}

      {menuLevel === 'search' && (
        <>
          <View style={styles.menuHeader}>
            <Button mode="outlined" icon="arrow-left" onPress={backToGroups} style={styles.backButton}>
              Groups
            </Button>
            <View style={styles.menuHeaderText}>
              <Text style={styles.menuTitle}>Search Items</Text>
              <Text style={styles.menuSubtitle}>{searchResults.length} results</Text>
            </View>
          </View>
          <View style={styles.searchBody}>
            <TextInput
              label="Search menu"
              mode="outlined"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
              left={<TextInput.Icon icon="magnify" />}
              style={styles.searchInput}
            />
            <ProductGrid
              layout={props.layout} layoutCategoryId={props.layoutCategoryId}
              data={searchResults}
              gridColumns={gridColumns}
              listKey="search-products"
              contentContainerStyle={styles.searchGrid}
              emptyText={loadingSearchProducts ? 'Loading items...' : 'No matching items'}
              getQuantity={quickQuantityForProduct}
              onPressProduct={(item) => void quickAddProduct(item)}
              productTilePalette={productTilePalette}
              hasAddons={props.hasAddons}
              getGroupName={props.getProductGroupName}
            />
          </View>
        </>
      )}

      {menuLevel === 'subgroups' && (
        <>
          <View style={styles.productContext}>
            <HeaderIconButton icon="arrow-left" accessibilityLabel="Back to groups" onPress={backToGroups} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.contextTitle}>{activeParentCategoryName}</Text>
              <Text style={styles.menuSubtitle}>{childCategoriesForSelectedGroup.length} sub-categories</Text>
            </View>
          </View>
          <FlatList
            data={childCategoriesForSelectedGroup}
            keyExtractor={(item) => item.id}
            numColumns={gridColumns}
            key={`subgroups-${gridColumns}`}
            contentContainerStyle={styles.tileGrid}
            ListEmptyComponent={(
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No sub-categories in this group</Text>
              </View>
            )}
            renderItem={({ item }) => {
              const ownConfig = props.layout?.categories.find(category => category.categoryId === item.id);
              const parentConfig = props.layout?.categories.find(category => category.categoryId === props.layoutCategoryId);
              return <PosGroupTile label={item.name} subtitle="Choose products" columns={gridColumns} layout={props.layout}
                tileConfig={{ ...parentConfig, ...ownConfig, label: ownConfig?.label }} onPress={() => openSubcategory(item.id)} />;
            }}
          />
        </>
      )}

      {menuLevel === 'items' && (
        <>
          <View style={styles.productContext}>
            <HeaderIconButton icon="arrow-left" accessibilityLabel={`Back to ${itemsBackLabel}`} onPress={itemsBackAction} />
            <View style={{ flex: 1, gap: 4 }}><Text style={styles.contextTitle}>{activeCategoryName}</Text></View>
          </View>
          <ProductGrid
              layout={props.layout} layoutCategoryId={props.layoutCategoryId}
            data={layoutProducts}
            gridColumns={gridColumns} listKey="group-products" contentContainerStyle={styles.tileGrid}
            emptyText={loadingProducts ? 'Loading products…' : 'No matching products in this group'}
            getQuantity={quickQuantityForProduct} onPressProduct={(item) => void quickAddProduct(item)}
            productTilePalette={productTilePalette} hasAddons={props.hasAddons} getGroupName={() => activeCategoryName}
          />
        </>
      )}

      {menuLevel === 'addons' && selectedProduct && (
        <>
          <View style={styles.editorBody}>


            <FlatList
              ref={addonListRef}
              onScrollToIndexFailed={({ index, averageItemLength }) => addonListRef.current?.scrollToOffset({ offset: index * averageItemLength, animated: false })}
              data={editorAddonGroups}
              ListHeaderComponent={<>
              <View style={styles.modifierProductCard}>
                <HeaderIconButton icon="arrow-left" accessibilityLabel="Back to product group" onPress={backToItems} />
                <View style={{ flex: 1, gap: 3 }}><Text style={styles.menuSubtitle}>{props.getProductGroupName(selectedProduct)}</Text><Text style={styles.addonGroupTitle}>{selectedProduct.name}</Text><Text style={styles.menuSubtitle}>${selectedProduct.sale_price.toFixed(2)} each · Quantity {props.editorQuantity}</Text></View>
                <Text style={{ color: tokens.color.success, backgroundColor: tokens.color.successTint, padding: 7, borderRadius: 6, fontSize: 12, fontWeight: '700' }}>Already in order</Text>
              </View>
              {editorRemovableIngredients.length > 0 && (
              <View style={styles.removableBlock}>
                <View style={[styles.addonGroupLabel, styles.removeGroupLabel]}>
                  <Text style={[styles.addonGroupTitle, styles.removeGroupTitle]}>Remove Ingredients</Text>
                </View>
                <Text style={styles.groupRequirementText}>Optional removals</Text>
                <View style={styles.optionGrid}>
                  {editorRemovableIngredients.map((ingredient) => {
                    const selected = Boolean(editorRemovedIngredientIds[ingredient.id]);
                    return (
                      <TouchableOpacity
                        key={ingredient.id}
                        style={[styles.optionButton, { width: addonOptionWidth }, selected && styles.removeButtonSelected]}
                        onPress={() => toggleRemovedIngredient(ingredient.id)}
                      >
                        <Text style={[styles.optionText, selected && styles.optionTextSelected]} numberOfLines={2}>
                          No {ingredient.ingredient_name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
              </>}
              keyExtractor={(item) => item.id}
              style={styles.addonList}
              ListEmptyComponent={(
                <Text style={styles.emptyAddonText}>
                  {loadingAddons ? 'Loading add-ons...' : 'No add-ons for this item'}
                </Text>
              )}
              renderItem={({ item: group }) => {
                const groupPalette = addonGroupPalette(group.id);
                return (
                  <View
                    style={[
                      styles.addonGroup,
                      props.editorError?.includes(group.name) ? { borderColor: tokens.color.danger, borderWidth: 2 } : null,
                      { backgroundColor: tokens.color.surface, borderColor: tokens.color.border },
                    ]}
                  >
                    <View style={styles.modifierHeading}>
                      <Text style={styles.addonGroupTitle}>{group.name}</Text>
                      <Text style={styles.modifierRequirement}>
                        Optional · {group.multiple_choice ? 'Choose multiple' : 'Choose 1'}
                      </Text>
                    </View>
                    <View style={styles.optionGrid}>
                      {group.items.map((item) => {
                        const quantity = editorAddonQuantities[item.id] || 0;
                        const selected = quantity > 0;
                        const optionContent = (
                          <>
                            <Text style={[styles.optionText, selected && styles.optionTextSelected]} >
                              {item.name}
                            </Text>
                            <Text style={[styles.optionPrice, selected && styles.optionTextSelected]}>
                              {item.extra_price > 0 ? `+$${item.extra_price.toFixed(2)}` : 'Included'}
                            </Text>
                          </>
                        );

                        if (group.multiple_choice && selected) {
                          return (
                            <View key={item.id} style={[styles.optionButton, styles.optionButtonSelected, styles.quantityOption, { width: addonOptionWidth }]}>
                              {optionContent}
                              <View style={styles.addonQuantityControls}>
                                <TouchableOpacity
                                  accessibilityRole="button"
                                  accessibilityLabel={`Remove one ${item.name}`}
                                  hitSlop={4}
                                  onPress={() => changeAddonQuantity(group, item, -1)}
                                  style={styles.addonQuantityButton}
                                >
                                  <Text style={styles.addonQuantityButtonText}>−</Text>
                                </TouchableOpacity>
                                <Text accessibilityLabel={`${quantity} ${item.name}`} style={styles.addonQuantityValue}>{quantity}</Text>
                                <TouchableOpacity
                                  accessibilityRole="button"
                                  accessibilityLabel={`Add one ${item.name}`}
                                  hitSlop={4}
                                  onPress={() => changeAddonQuantity(group, item, 1)}
                                  style={styles.addonQuantityButton}
                                >
                                  <Text style={styles.addonQuantityButtonText}>+</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          );
                        }

                        return (
                          <TouchableOpacity
                            key={item.id}
                            accessibilityRole="button"
                            accessibilityState={{ selected }}
                            accessibilityLabel={selected ? `Remove ${item.name}` : `Add ${item.name}`}
                            style={[styles.optionButton, { width: addonOptionWidth }, selected && styles.optionButtonSelected]}
                            onPress={() => changeAddonQuantity(group, item, selected ? -1 : 1)}
                          >
                            {optionContent}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                );
              }}
            />

            {!!props.editorError && <Text accessibilityRole="alert" style={styles.editorError}>{props.editorError}</Text>}
            <View style={styles.selectedModifierSummary}><Text style={styles.selectedModifierSummaryText}>Current item: {editorAddonGroups.flatMap((group) => group.items.filter((item) => (editorAddonQuantities[item.id] || 0) > 0).map((item) => `${group.name}: ${item.name} ×${editorAddonQuantities[item.id]}`)).join(' · ') || 'No add-ons'}{props.editorNote ? ` · Note: ${props.editorNote}` : ''}</Text></View>
            <View style={styles.addonSummaryBar}>
              <View style={styles.qtyStepper}>
                <Button compact accessibilityLabel="Reduce item quantity" onPress={() => props.onEditorQuantityChange(Math.max(1, props.editorQuantity - 1))} contentStyle={{ minHeight: 48 }}>−</Button>
                <Text style={styles.cartQuantity}>{props.editorQuantity}</Text>
                <Button compact accessibilityLabel="Increase item quantity" onPress={() => props.onEditorQuantityChange(props.editorQuantity + 1)} contentStyle={{ minHeight: 48 }}>+</Button>
              </View>
              <Button mode="outlined" onPress={() => { setNoteDraft(props.editorNote); setNoteVisible(true); }} contentStyle={{ minHeight: 48 }}>Item note{props.editorNote ? ' •' : ''}</Button>
              <Text style={{ marginLeft: 'auto', color: tokens.color.text, fontSize: 20, fontWeight: '700' }}>${((selectedProduct.sale_price + addonSelectionTotal) * props.editorQuantity).toFixed(2)}</Text><Button mode="contained" onPress={props.onConfirmEditor} style={styles.addonSummaryButton} contentStyle={{ minHeight: 52 }}>
                Continue
              </Button>
            </View>

          </View>
        </>
      )}

      <EditorSheet size="options" visible={noteVisible} title="Item note" onDismiss={() => setNoteVisible(false)} footer={(dismiss) => <><Button onPress={dismiss}>Cancel</Button><Button mode="contained" onPress={() => { props.onEditorNoteChange(noteDraft); setNoteVisible(false); }} contentStyle={{ minHeight: 52 }}>Save note</Button></>}>
        <Text style={{ color: tokens.color.text, fontWeight: '700', fontSize: 13 }}>Quick notes</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{(props.quickItemNotes || []).map(note => <Button mode="outlined" key={note} onPress={() => setNoteDraft(current => toggleNotePreset(current, note))}>{note}</Button>)}</View><FormField label="Item note" value={noteDraft} onChangeText={setNoteDraft} multiline autoFocus />
      </EditorSheet>

      {menuLevel === 'checkout' && (
        <PosCheckoutPanel
          initialTab={initialCheckoutTab}
          closeCheckout={backToItems}
          customerLookupStatus={customerLookupStatus}
          customerPhone={customerPhone}
          onChangeCustomerPhone={onChangeCustomerPhone}
          customerName={customerName}
          onChangeCustomerName={onChangeCustomerName}
          customerLookupError={customerLookupError}
          selectedCustomer={selectedCustomer}
          onSelectCustomer={onSelectCustomer}
          onClearCustomer={onClearCustomer}
          onResetToDefaultInstore={onResetToDefaultInstore}
          rewardPointsEnabled={rewardPointsEnabled}
          rewardPointsBalance={rewardPointsBalance}
          rewardPointsDollarValue={rewardPointsDollarValue}
          rewardPointsApplied={rewardPointsApplied}
          appliedRewardPointsValue={appliedRewardPointsValue}
          onToggleRewardPoints={onToggleRewardPoints}
          totals={totals}
          freeItemPromotionTitle={freeItemPromotionTitle}
          freeItemSelectionRequired={freeItemSelectionRequired}
          selectedFreeItemName={selectedFreeItemName}
          onOpenFreeItemDialog={onOpenFreeItemDialog}
          discountLabel={discountLabel}
          discountAmount={discountAmount}
          activeDiscountPercent={activeDiscountPercent}
          selectDiscountPreset={selectDiscountPreset}
          openDiscountDialog={openDiscountDialog}
          cartItemsCount={cartItemsCount}
          isPreOrder={isPreOrder}
          setIsPreOrder={setIsPreOrder}
          scheduledPickupAt={scheduledPickupAt}
          setScheduledPickupAt={setScheduledPickupAt}
          defaultPickupTime={defaultPickupTime}
          formatPickupTime={formatPickupTime}
          openPickupPicker={openPickupPicker}
          showPickupPicker={showPickupPicker}
          pickupPickerMode={pickupPickerMode}
          handlePickupPickerChange={handlePickupPickerChange}
          orderNoteText={orderNoteText}
          setOrderNoteText={setOrderNoteText}
          creatingOrder={creatingOrder}
          smartpayPreparing={smartpayPreparing}
          smartpayProcessing={smartpayProcessing}
          orderId={orderId}
          checkoutPrimaryLabel={checkoutPrimaryLabel}
          handleCheckout={handleCheckout}
          smartpayPaired={smartpayPaired}
          handleInstoreCheckout={handleInstoreCheckout}
          handleSmartpayInstoreCheckout={handleSmartpayInstoreCheckout}
          handleDeliveryCheckout={handleDeliveryCheckout}
          thirdPartySource={thirdPartySource}
          setThirdPartySource={setThirdPartySource}
          thirdPartyCustomerName={thirdPartyCustomerName}
          setThirdPartyCustomerName={setThirdPartyCustomerName}
          thirdPartyExternalOrderId={thirdPartyExternalOrderId}
          setThirdPartyExternalOrderId={setThirdPartyExternalOrderId}
          thirdPartyOrderAt={thirdPartyOrderAt}
          formatOrderTime={formatOrderTime}
          openThirdPartyOrderAtPicker={openThirdPartyOrderAtPicker}
          showThirdPartyOrderAtPicker={showThirdPartyOrderAtPicker}
          thirdPartyOrderAtPickerMode={thirdPartyOrderAtPickerMode}
          handleThirdPartyOrderAtPickerChange={handleThirdPartyOrderAtPickerChange}
          handleThirdPartyCheckout={handleThirdPartyCheckout}
        />
      )}

      {menuLevel === 'quick-list' && (
        <>
          <View style={styles.productContext}>
            <HeaderIconButton icon="arrow-left" accessibilityLabel="Back to groups" onPress={backToGroups} />
            <Text style={[styles.contextTitle, { flex: 1, textAlign: 'center' }]}>Quick list</Text>
            {topSellers.length > 0 ? <Button compact onPress={() => setTopSellersExpanded(value => !value)} accessibilityState={{ expanded: topSellersExpanded }} contentStyle={{ minHeight: 40 }} labelStyle={{ fontSize: 12 }}>Top sellers</Button> : <Text style={styles.menuSubtitle}>Favourites</Text>}
          </View>
          {topSellersExpanded && topSellers.length > 0 && (
            <View style={[styles.topSellersSection, { flexShrink: 0, minHeight: 142 }]}>
              <FlatList
                data={topSellers}
                keyExtractor={(item) => item.id}
                horizontal
                style={{ flexGrow: 0 }}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.topSellersList}
                renderItem={({ item }) => {
                  return <View style={{ width: 190 }}><PosProductTile accent={productTilePalette(item.id).borderColor} layout={props.layout} tileConfig={findPosProductConfig(props.layout, item.id)} product={item} groupName={`${item.total_quantity_sold} sold`} columns={1} quantity={quickQuantityForProduct(item.id)} hasAddons={props.hasAddons(item.id)} onPress={() => void quickAddProduct(item)} /></View>;
                }}
              />
            </View>
          )}
          {quickAccessProducts.length > 0 ? (
            <ProductGrid
              layout={props.layout}
              data={quickAccessProducts}
              gridColumns={quickListColumns}
              listKey="quick-list"
              contentContainerStyle={styles.quickListGrid}
              getQuantity={quickQuantityForProduct}
              onPressProduct={(item) => void quickAddProduct(item)}
              productTilePalette={productTilePalette}
              hasAddons={props.hasAddons}
              getGroupName={props.getProductGroupName}
            />
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No quick-list items</Text>
              <Text style={styles.quickListEmpty}>
                Select products in POS Layout and check `Show on quick list` to display them here.
              </Text>
            </View>
          )}

        </>
      )}

      {menuLevel !== 'groups' && menuLevel !== 'subgroups' && menuLevel !== 'items' && menuLevel !== 'addons' && menuLevel !== 'quick-list' && menuLevel !== 'checkout' && (
        <View pointerEvents="box-none" style={styles.quickListButtonWrap}>
          <Button
            mode="contained"
            icon="lightning-bolt"
            onPress={() => setQuickListVisible(true)}
            style={styles.quickListButton}
            contentStyle={styles.quickListButtonContent}
            buttonColor="#0f766e"
            disabled={quickAccessProducts.length === 0}
          >
            Quick List
          </Button>
        </View>
      )}

      {isPhoneLayout && onOpenCart && menuLevel !== 'checkout' && (
        <TouchableOpacity
          style={styles.phoneFloatingCartBar}
          onPress={onOpenCart}
          disabled={cartItemsCount === 0}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`View cart with ${cartItemsCount} items total ${totals.subtotal.toFixed(2)}`}
        >
          <View style={styles.phoneFloatingCartInfo}>
            <Text style={styles.phoneFloatingCartTitle}>
              Order ({cartItemsCount} {cartItemsCount === 1 ? 'item' : 'items'})
            </Text>
            <Text style={styles.phoneFloatingCartSub}>
              Subtotal: ${totals.subtotal.toFixed(2)}
            </Text>
          </View>
          <View style={styles.phoneFloatingCartButton}>
            <Text style={styles.phoneFloatingCartButtonText}>View order →</Text>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
});

function ProductGrid({
  layout, layoutCategoryId,
  data,
  gridColumns,
  listKey,
  contentContainerStyle,
  emptyText,
  getQuantity,
  onPressProduct,
  productTilePalette,
  hasAddons,
  getGroupName,
}: {
  layout?: PosLayoutData | null; layoutCategoryId?: string;
  hasAddons?: (productId: string) => boolean;
  getGroupName?: (product: SaleProduct) => string;
  data: SaleProduct[];
  gridColumns: number;
  listKey: string;
  contentContainerStyle: object;
  emptyText?: string;
  getQuantity: (productId: string) => number;
  onPressProduct: (product: SaleProduct) => void;
  productTilePalette: (productId: string) => { backgroundColor: string; borderColor: string; priceColor: string };
}) {
  return (
    <FlatList
      data={data}
      keyExtractor={(item) => item.id}
      numColumns={gridColumns}
      key={`${listKey}-${gridColumns}`}
      contentContainerStyle={contentContainerStyle}
      ListEmptyComponent={emptyText ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>{emptyText}</Text>
        </View>
      ) : null}
      renderItem={({ item }) => <PosProductTile layout={layout} tileConfig={findPosProductConfig(layout, item.id, layoutCategoryId)} product={item} groupName={getGroupName?.(item) || 'Menu'} quantity={getQuantity(item.id)} hasAddons={Boolean(hasAddons?.(item.id))} accent={productTilePalette(item.id).borderColor} columns={gridColumns} onPress={() => onPressProduct(item)} />}

    />
  );
}
