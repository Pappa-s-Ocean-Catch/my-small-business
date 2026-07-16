import React from 'react';
import { FlatList, Text, TouchableOpacity, View } from 'react-native';
import type { DimensionValue } from 'react-native';
import { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Button, IconButton, TextInput } from 'react-native-paper';

import { styles } from './pos.styles';
import type {
  AddonGroup,
  LayoutCategoryButton,
  PosInstorePaymentChoice,
  PosPaymentChoice,
  RemovableIngredient,
  SaleCategory,
  SaleProduct,
  TopSellerProduct,
} from '../../app/pos.types';
import { PosCheckoutPanel } from './PosCheckoutPanel';
import type { DeliveryAddressDraft, DeliveryQuoteResult } from '../../lib/delivery';

type MenuLevel = 'groups' | 'subgroups' | 'items' | 'addons' | 'checkout' | 'search';
type CustomerLookupStatus = 'idle' | 'loading' | 'found' | 'new' | 'error';

type Props = {
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
  editorSelectedIds: Record<string, boolean>;
  toggleAddon: (group: AddonGroup, item: AddonGroup['items'][number]) => void;
  addonGroupPalette: (groupId: string) => { backgroundColor: string; borderColor: string; labelColor: string };
  addonSelectionCount: number;
  addonSelectionTotal: number;
  openCheckout: () => void;
  customerLookupStatus: CustomerLookupStatus;
  customerPhone: string;
  setCustomerPhone: (value: string) => void;
  customerName: string;
  setCustomerName: (value: string) => void;
  customerLookupError: string | null;
  totals: { subtotal: number; tax: number; total: number };
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
  quickListVisible: boolean;
};

export function PosMenuPane(props: Props) {
  const {
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
    editorSelectedIds,
    toggleAddon,
    addonGroupPalette,
    addonSelectionCount,
    addonSelectionTotal,
    openCheckout,
    customerLookupStatus,
    customerPhone,
    setCustomerPhone,
    customerName,
    setCustomerName,
    customerLookupError,
    totals,
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
    smartpayProcessing,
    orderId,
    checkoutPrimaryLabel,
    handleCheckout,
    smartpayPaired,
    handleInstoreCheckout,
    handleSmartpayInstoreCheckout,
    handleDeliveryCheckout,
    quickListVisible,
  } = props;

  return (
    <View style={styles.menuPane}>
      {menuLevel === 'groups' && (
        <View style={styles.groupScreen}>
          <FlatList
            data={layoutTopLevelCategories}
            keyExtractor={(item) => item.id}
            numColumns={gridColumns}
            key={`groups-${gridColumns}`}
            contentContainerStyle={styles.tileGrid}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.groupCard, { backgroundColor: item.color }]}
                onPress={() => openCategory(item.id)}
              >
                <Text style={styles.groupCardText} numberOfLines={3}>{item.name}</Text>
              </TouchableOpacity>
            )}
          />
          <View style={styles.topSellersSection}>
            <View style={styles.topSellersHeader}>
              <View style={styles.topSellersHeaderText}>
                <Text style={styles.topSellersTitle}>Top sellers today</Text>
                {loadingTopSellers && <Text style={styles.topSellersLoading}>Refreshing...</Text>}
              </View>
            </View>
            {topSellers.length > 0 ? (
              <FlatList
                data={topSellers}
                keyExtractor={(item) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.topSellersList}
                renderItem={({ item }) => {
                  const quickQuantity = quickQuantityForProduct(item.id);
                  return (
                    <TouchableOpacity style={styles.topSellerCard} onPress={() => void quickAddProduct(item)}>
                      {quickQuantity > 0 && (
                        <View style={styles.topSellerQuantityBadge}>
                          <Text style={styles.productQuantityText}>{quickQuantity}</Text>
                        </View>
                      )}
                      <Text style={styles.topSellerName} numberOfLines={2}>{item.name}</Text>
                      <Text style={styles.topSellerMeta}>{item.total_quantity_sold} sold</Text>
                    </TouchableOpacity>
                  );
                }}
              />
            ) : (
              <Text style={styles.topSellersEmpty}>
                {loadingTopSellers ? 'Loading top sellers...' : 'No sales yet today'}
              </Text>
            )}
          </View>
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
              data={searchResults}
              gridColumns={gridColumns}
              listKey="search-products"
              contentContainerStyle={styles.searchGrid}
              emptyText={loadingSearchProducts ? 'Loading items...' : 'No matching items'}
              getQuantity={quickQuantityForProduct}
              onPressProduct={(item) => void quickAddProduct(item)}
              productTilePalette={productTilePalette}
            />
          </View>
        </>
      )}

      {menuLevel === 'subgroups' && (
        <>
          <View style={styles.menuHeader}>
            <Button mode="outlined" icon="arrow-left" onPress={backToGroups} style={styles.backButton}>
              Groups
            </Button>
            <View style={styles.menuHeaderText}>
              <Text style={styles.menuTitle}>{activeParentCategoryName}</Text>
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
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.groupCard, activeLayoutCategory?.color ? { backgroundColor: activeLayoutCategory.color } : null]}
                onPress={() => openSubcategory(item.id)}
              >
                <Text style={styles.groupCardText} numberOfLines={3}>{item.name}</Text>
              </TouchableOpacity>
            )}
          />
        </>
      )}

      {menuLevel === 'items' && (
        <>
          <View style={styles.menuHeader}>
            <Button mode="outlined" icon="arrow-left" onPress={itemsBackAction} style={styles.backButton}>
              {itemsBackLabel}
            </Button>
            <View style={styles.menuHeaderText}>
              <Text style={styles.menuTitle}>{activeCategoryName}</Text>
              <Text style={styles.menuSubtitle}>{layoutProducts.length} items</Text>
            </View>
          </View>
          <FlatList
            data={layoutProducts}
            keyExtractor={(item) => item.id}
            numColumns={gridColumns}
            key={`products-${gridColumns}`}
            contentContainerStyle={styles.tileGrid}
            ListEmptyComponent={(
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>{loadingProducts ? 'Loading items...' : 'No items in this group'}</Text>
              </View>
            )}
            renderItem={({ item }) => {
              const quickQuantity = quickQuantityForProduct(item.id);
              const skipCustomization = Boolean(activeLayoutCategory?.showProductsOnTopLevel);
              const customColor = productButtonColor(item.id);
              const tilePalette = productTilePalette(item.id);
              return (
                <TouchableOpacity
                  style={[
                    styles.productCard,
                    { backgroundColor: tilePalette.backgroundColor, borderColor: tilePalette.borderColor },
                    customColor ? styles.productCardCustomColor : null,
                    customColor ? { backgroundColor: customColor, borderColor: customColor } : null,
                  ]}
                  onPress={() => void quickAddProduct(item, { skipCustomization })}
                >
                  {quickQuantity > 0 && (
                    <View style={styles.productQuantityBadge}>
                      <Text style={styles.productQuantityText}>{quickQuantity}</Text>
                    </View>
                  )}
                  <View style={styles.productNameArea}>
                    <Text style={[styles.productName, customColor ? styles.productCardCustomText : null]} numberOfLines={3}>{item.name}</Text>
                  </View>
                  <View style={[
                    styles.productPricePill,
                    customColor ? styles.productPricePillCustom : { backgroundColor: tilePalette.priceColor },
                  ]}>
                    <Text style={[styles.productPrice, customColor ? styles.productCardCustomText : null]}>${item.sale_price.toFixed(2)}</Text>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
          <View style={styles.levelFooter}>
            <View style={styles.levelFooterActions}>
              <Button
                mode="outlined"
                icon="arrow-left"
                onPress={itemsBackAction}
                style={styles.levelFooterButton}
                contentStyle={styles.levelFooterButtonContent}
                labelStyle={styles.levelFooterButtonLabel}
              >
                {selectedParentCatId ? `Back to ${activeParentCategoryName}` : 'Back to Groups'}
              </Button>
              <Button
                mode="contained"
                icon="lightning-bolt"
                onPress={() => setQuickListVisible(true)}
                style={styles.levelFooterQuickListButton}
                contentStyle={styles.quickListButtonContent}
                buttonColor="#0f766e"
                disabled={quickAccessProducts.length === 0}
              >
                Quick List
              </Button>
            </View>
          </View>
        </>
      )}

      {menuLevel === 'addons' && selectedProduct && (
        <>
          <View style={styles.menuHeader}>
            <Button mode="outlined" icon="arrow-left" onPress={backToItems} style={styles.backButton}>
              Items
            </Button>
            <View style={styles.menuHeaderText}>
              <Text style={styles.menuTitle} numberOfLines={1}>{selectedProduct.name}</Text>
              <Text style={styles.menuSubtitle}>Customize item</Text>
            </View>
          </View>

          <View style={styles.editorBody}>
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

            <FlatList
              data={editorAddonGroups}
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
                      { backgroundColor: groupPalette.backgroundColor, borderColor: groupPalette.borderColor },
                    ]}
                  >
                    <View style={[styles.addonGroupLabel, { backgroundColor: groupPalette.labelColor }]}>
                      <Text style={styles.addonGroupTitle}>{group.name}</Text>
                    </View>
                    <Text style={styles.groupRequirementText}>
                      {group.is_required ? 'Required selection' : group.multiple_choice ? 'Optional, choose multiple' : 'Optional, choose one'}
                    </Text>
                    <View style={styles.optionGrid}>
                      {group.items.map((item) => {
                        const selected = Boolean(editorSelectedIds[item.id]);
                        return (
                          <TouchableOpacity
                            key={item.id}
                            style={[styles.optionButton, { width: addonOptionWidth }, selected && styles.optionButtonSelected]}
                            onPress={() => toggleAddon(group, item)}
                          >
                            <Text style={[styles.optionText, selected && styles.optionTextSelected]} numberOfLines={2}>
                              {item.name}
                            </Text>
                            {item.extra_price > 0 && (
                              <Text style={[styles.optionPrice, selected && styles.optionTextSelected]}>
                                +${item.extra_price.toFixed(2)}
                              </Text>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                );
              }}
            />

            <View style={styles.addonSummaryBar}>
              <View style={styles.addonSummaryText}>
                <Text style={styles.addonSummaryTitle}>
                  {addonSelectionCount > 0 ? `${addonSelectionCount} selections` : 'No selections yet'}
                </Text>
                <Text style={styles.addonSummaryMeta}>
                  {addonSelectionTotal > 0 ? `Add-ons +$${addonSelectionTotal.toFixed(2)}` : 'Continue when the item looks right'}
                </Text>
              </View>
              <Button
                mode="contained"
                icon="arrow-right"
                onPress={backToItems}
                style={styles.addonSummaryButton}
                contentStyle={styles.levelFooterButtonContent}
              >
                Continue
              </Button>
            </View>

            <View style={styles.editorActions}>
              <Button mode="outlined" icon="arrow-left" onPress={backToGroups} style={styles.editorActionButton}>
                Back to Groups
              </Button>
              <Button mode="contained" icon="cash-register" onPress={openCheckout} style={styles.editorActionButton}>
                Checkout
              </Button>
            </View>
          </View>
        </>
      )}

      {menuLevel === 'checkout' && (
        <PosCheckoutPanel
          closeCheckout={backToItems}
          customerLookupStatus={customerLookupStatus}
          customerPhone={customerPhone}
          setCustomerPhone={setCustomerPhone}
          customerName={customerName}
          setCustomerName={setCustomerName}
          customerLookupError={customerLookupError}
          totals={totals}
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
          smartpayProcessing={smartpayProcessing}
          orderId={orderId}
          checkoutPrimaryLabel={checkoutPrimaryLabel}
          handleCheckout={handleCheckout}
          smartpayPaired={smartpayPaired}
          handleInstoreCheckout={handleInstoreCheckout}
          handleSmartpayInstoreCheckout={handleSmartpayInstoreCheckout}
          handleDeliveryCheckout={handleDeliveryCheckout}
        />
      )}

      {menuLevel !== 'groups' && menuLevel !== 'items' && menuLevel !== 'addons' && (
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

      {quickListVisible && (
        <View style={styles.quickListOverlay}>
          <View style={styles.quickListPanel}>
            <View style={styles.quickListHeader}>
              <View>
                <Text style={styles.quickListTitle}>Quick list</Text>
                <Text style={styles.quickListSubtitle}>Tap items to add without leaving the cart</Text>
              </View>
              <IconButton icon="close" size={20} onPress={() => setQuickListVisible(false)} />
            </View>
            {quickAccessProducts.length > 0 ? (
              <ProductGrid
                data={quickAccessProducts}
                gridColumns={quickListColumns}
                listKey="quick-list"
                contentContainerStyle={styles.quickListGrid}
                getQuantity={quickQuantityForProduct}
                onPressProduct={(item) => void quickAddProduct(item, { forcePlainAdd: true, skipCustomization: true })}
                productTilePalette={productTilePalette}
              />
            ) : (
              <Text style={styles.quickListEmpty}>
                Select products in POS Layout and check `Show on quick list` to display them here.
              </Text>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

function ProductGrid({
  data,
  gridColumns,
  listKey,
  contentContainerStyle,
  emptyText,
  getQuantity,
  onPressProduct,
  productTilePalette,
}: {
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
      renderItem={({ item }) => {
        const quickQuantity = getQuantity(item.id);
        const tilePalette = productTilePalette(item.id);
        return (
          <TouchableOpacity
            style={[
              styles.productCard,
              { backgroundColor: tilePalette.backgroundColor, borderColor: tilePalette.borderColor },
            ]}
            onPress={() => onPressProduct(item)}
          >
            {quickQuantity > 0 && (
              <View style={styles.productQuantityBadge}>
                <Text style={styles.productQuantityText}>{quickQuantity}</Text>
              </View>
            )}
            <View style={styles.productNameArea}>
              <Text style={styles.productName} numberOfLines={3}>{item.name}</Text>
            </View>
            <View style={[styles.productPricePill, { backgroundColor: tilePalette.priceColor }]}>
              <Text style={styles.productPrice}>${item.sale_price.toFixed(2)}</Text>
            </View>
          </TouchableOpacity>
        );
      }}
    />
  );
}
