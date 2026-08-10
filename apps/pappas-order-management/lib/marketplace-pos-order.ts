import type { Order, OrderItem, OrderItemAddon, OrderStatus } from '@my-small-business/types';

import type {
  AddonGroup,
  PosCartItem,
  RemovableIngredient,
  SaleProduct,
} from '../app/pos.types';
import { formatKitchenSectionValue } from '../utils/orderUtils';
import {
  getMarketplaceImportDiscountAmount,
  parseMarketplaceMoney,
} from './marketplace-order-summary';
import { getMarketplaceOrderStatus } from './marketplace-pos-import';

export type MarketplaceProvider = 'uber_eats' | 'doordash';

type MarketplaceOrderDetailItemOption = {
  name: string;
  quantity: number;
  price: string | null;
};

type MarketplaceOrderDetail = {
  provider: MarketplaceProvider;
  sourceName: string;
  orderId: string;
  orderUUID: string;
  requestedAt: number;
  customerName: string;
  totalAmount: number | null;
  netPayout: string;
  subtotalAmount: number | null;
  discountAmount: number;
  orderJobState: string | null;
  statusDescription: string | null;
  orderStateChanges: Array<{
    changedAt: number;
    orderState: string;
  }>;
  items: Array<{
    name: string;
    price: string;
    quantity: number;
    specialInstructions: string;
    customizations: Array<{
      name: string;
      options: MarketplaceOrderDetailItemOption[];
    }>;
  }>;
};

export type MarketplaceMappingEntityType = 'product' | 'addon_group' | 'addon' | 'ingredient';

export type MarketplaceMappingRecord = {
  provider: MarketplaceProvider;
  entity_type: MarketplaceMappingEntityType;
  external_name: string;
  normalized_external_name: string;
  parent_normalized_external_name?: string;
  internal_name: string;
  internal_entity_id?: string | null;
  is_active: boolean;
};

type MarketplaceCategorySection = {
  id: string;
  section?: string | null;
};

type MarketplaceStatusUpdate = Pick<Order, 'order_status'>;

const TERMINAL_MARKETPLACE_ORDER_STATUSES: OrderStatus[] = [
  'completed',
  'cancelled',
  'refunded',
];

const LOCAL_KITCHEN_ORDER_STATUSES: OrderStatus[] = ['preparing', 'ready'];

const NON_ADVANCING_UPSTREAM_ORDER_STATUSES: OrderStatus[] = [
  'confirmed',
  'preparing',
  'ready',
];

export function shouldReconcileMarketplaceOrderStatus(
  localStatus: OrderStatus,
  upstreamStatus: OrderStatus
): boolean {
  if (TERMINAL_MARKETPLACE_ORDER_STATUSES.includes(localStatus)) return false;
  if (localStatus === upstreamStatus) return false;

  return !(
    (LOCAL_KITCHEN_ORDER_STATUSES.includes(localStatus) || localStatus === 'on_the_way')
    && NON_ADVANCING_UPSTREAM_ORDER_STATUSES.includes(upstreamStatus)
  );
}

type MarketplaceOrderPayload = Omit<
  Order,
  | 'id'
  | 'order_number'
  | 'updated_at'
  | 'items'
  | 'receipt_claim_token'
  | 'receipt_claimed_at'
  | 'receipt_claimed_by_user_id'
  | 'kitchen_print_claimed_at'
  | 'kitchen_print_claimed_by'
  | 'kitchen_print_completed_at'
  | 'kitchen_print_completed_by'
> & { created_at?: string };

type MarketplaceOrderItemPayload = Omit<
  OrderItem,
  'id' | 'order_id' | 'created_at' | 'addons'
> & {
  addons?: Omit<OrderItemAddon, 'id' | 'order_item_id' | 'created_at'>[];
};

export type MarketplaceImportMetadata = {
  source: 'Uber Eats' | 'DoorDash';
  externalOrderNumber: string;
  orderStatus: ReturnType<typeof getMarketplaceOrderStatus>;
  grossSales: number | null;
  grossPayout: number | null;
};

export type MarketplacePosOrderDraft = {
  cartItems: PosCartItem[];
  customerName: string;
  requestedAt: Date;
  discountAmount: number;
  metadata: MarketplaceImportMetadata;
  unmatchedProducts: string[];
  unmatchedOptions: string[];
  unresolvedIssues: MarketplaceResolutionIssue[];
};

export type MarketplaceResolutionIssue = {
  kind: MarketplaceMappingEntityType;
  externalName: string;
  mappingExternalName: string;
  parentExternalName: string;
  marketplacePrice: string | null;
  marketplaceGroupName?: string;
};

export type MarketplacePosOrderDependencies = {
  findMarketplaceOrder: (
    provider: MarketplaceProvider,
    externalOrderId: string
  ) => Promise<{ data: Order | null; error: string | null }>;
  savePosOrder: (
    orderPayload: MarketplaceOrderPayload,
    items: MarketplaceOrderItemPayload[]
  ) => Promise<{ data: Order | null; error: string | null }>;
  updateMarketplaceOrder: (
    orderId: string,
    update: MarketplaceStatusUpdate
  ) => Promise<{ data: Order | null; error: string | null }>;
  loadCatalog: () => Promise<{
    products: SaleProduct[];
    categories: MarketplaceCategorySection[];
    error?: string | null;
  }>;
  loadMappings: (provider: MarketplaceProvider) => Promise<MarketplaceMappingRecord[]>;
  loadProductCustomizations: (productId: string) => Promise<{
    groups: AddonGroup[];
    removableIngredients: RemovableIngredient[];
    error?: string | null;
  }>;
  recordUnmatchedName: (input: {
    provider: MarketplaceProvider;
    entityType: MarketplaceMappingEntityType;
    externalName: string;
    parentExternalName?: string;
  }) => Promise<void>;
  createLocalId: () => string;
  now: () => Date;
};

const MARKETPLACE_MATCH_THRESHOLD = 0.9;
const MARKETPLACE_REMOVAL_PREFIXES = ['no ', 'without ', 'remove ', 'minus '];

function normalizeMarketplaceName(value: string): string {
  return value
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function levenshteinDistance(left: string, right: string): number {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = new Array(right.length + 1).fill(0);

  for (let row = 1; row <= left.length; row += 1) {
    current[0] = row;
    for (let column = 1; column <= right.length; column += 1) {
      const substitutionCost = left[row - 1] === right[column - 1] ? 0 : 1;
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + substitutionCost
      );
    }

    for (let column = 0; column <= right.length; column += 1) {
      previous[column] = current[column];
    }
  }

  return previous[right.length];
}

function getNameSimilarity(left: string, right: string): number {
  const normalizedLeft = normalizeMarketplaceName(left);
  const normalizedRight = normalizeMarketplaceName(right);
  if (!normalizedLeft || !normalizedRight) return 0;
  if (normalizedLeft === normalizedRight) return 1;

  const directDistance = levenshteinDistance(normalizedLeft, normalizedRight);
  const directLongestLength = Math.max(normalizedLeft.length, normalizedRight.length);
  const directScore = directLongestLength > 0 ? 1 - directDistance / directLongestLength : 0;

  const leftTokens = normalizedLeft.split(' ').filter(Boolean);
  const rightTokens = normalizedRight.split(' ').filter(Boolean);
  const leftTokenSet = new Set(leftTokens);
  const rightTokenSet = new Set(rightTokens);
  const sharedTokenCount = Array.from(leftTokenSet).filter((token) => rightTokenSet.has(token)).length;
  const uniqueTokenCount = new Set([...leftTokenSet, ...rightTokenSet]).size;
  const tokenSetScore = uniqueTokenCount > 0 ? sharedTokenCount / uniqueTokenCount : 0;

  const sortedLeft = [...leftTokens].sort().join(' ');
  const sortedRight = [...rightTokens].sort().join(' ');
  const sortedDistance = levenshteinDistance(sortedLeft, sortedRight);
  const sortedLongestLength = Math.max(sortedLeft.length, sortedRight.length);
  const sortedScore = sortedLongestLength > 0 ? 1 - sortedDistance / sortedLongestLength : 0;

  return Math.max(directScore, tokenSetScore, sortedScore);
}

function getMarketplaceRemovalCandidate(value: string): string | null {
  const normalized = normalizeMarketplaceName(value);
  for (const prefix of MARKETPLACE_REMOVAL_PREFIXES) {
    if (normalized.startsWith(prefix)) {
      return normalized.slice(prefix.length).trim();
    }
  }
  return null;
}

function findBestInternalNameMatch<T extends { name: string }>(
  candidates: T[],
  targetName: string
): { candidate: T; score: number } | null {
  return candidates
    .map((candidate) => ({
      candidate,
      score: getNameSimilarity(candidate.name, targetName),
    }))
    .sort((left, right) => right.score - left.score)[0] ?? null;
}

function getMarketplaceSource(provider: MarketplaceProvider): 'Uber Eats' | 'DoorDash' {
  return provider === 'uber_eats' ? 'Uber Eats' : 'DoorDash';
}

export function findMarketplaceOrderIdByExternalId(
  rows: Array<{ id: string; external_order_number: string | null }>,
  externalOrderId: string
): string | null {
  const normalizedExternalOrderId = externalOrderId.trim();
  return rows.find((row) => (
    row.external_order_number?.trim() === normalizedExternalOrderId
  ))?.id ?? null;
}

function getProductGroupSection(
  product: Pick<SaleProduct, 'sale_category_id' | 'sub_category_id'>,
  categories: MarketplaceCategorySection[]
): string | null {
  const subCategorySection = categories.find((category) => category.id === product.sub_category_id)?.section;
  if (subCategorySection) return subCategorySection;
  return categories.find((category) => category.id === product.sale_category_id)?.section || null;
}

function getOrderError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function buildMarketplacePromotion(discountAmount: number) {
  if (discountAmount <= 0) return [];
  return [{
    source: 'pos',
    kind: 'fixed',
    value: discountAmount,
    amount: discountAmount,
    label: `$${discountAmount.toFixed(2)} off`,
  }];
}

function formatUnmatchedMarketplaceAddon(option: MarketplaceOrderDetailItemOption): string {
  const quantity = Math.max(1, option.quantity || 1);
  const quantityPrefix = quantity > 1 ? `${quantity}x ` : '';
  const price = parseMarketplaceMoney(option.price);
  return `Add-on: ${quantityPrefix}${option.name}${price == null ? '' : ` (+$${price.toFixed(2)})`}`;
}

export function createMarketplacePosOrderService(dependencies: MarketplacePosOrderDependencies) {
  const buildMarketplacePosOrderDraft = async (
    detail: MarketplaceOrderDetail
  ): Promise<MarketplacePosOrderDraft> => {
    const externalOrderNumber = detail.orderId.trim();
    if (!externalOrderNumber) {
      throw new Error('Marketplace order ID is required.');
    }

    const [catalog, marketplaceMappings] = await Promise.all([
      dependencies.loadCatalog(),
      dependencies.loadMappings(detail.provider),
    ]);

    if (catalog.error) throw new Error(catalog.error);
    const { products, categories } = catalog;

    if (products.length === 0) {
      throw new Error('Could not load the POS catalog to build this marketplace order.');
    }

    const cartItems: PosCartItem[] = [];
    const unmatchedProducts: string[] = [];
    const unmatchedOptions: string[] = [];
    const unresolvedIssues: MarketplaceResolutionIssue[] = [];

    for (const item of detail.items) {
      const productAlias = marketplaceMappings.find((mapping) => (
        mapping.entity_type === 'product'
        && mapping.normalized_external_name === normalizeMarketplaceName(item.name)
        && !mapping.parent_normalized_external_name
      ));

      let matchedProduct: SaleProduct | null = null;
      if (productAlias) {
        matchedProduct = products.find((product) => product.id === productAlias.internal_entity_id)
          ?? findBestInternalNameMatch(products, productAlias.internal_name)?.candidate
          ?? null;
      } else {
        const bestProductMatch = products
          .map((product) => ({ product, score: getNameSimilarity(item.name, product.name) }))
          .sort((left, right) => right.score - left.score)[0] ?? null;
        matchedProduct = bestProductMatch && bestProductMatch.score >= MARKETPLACE_MATCH_THRESHOLD
          ? bestProductMatch.product
          : null;
      }

      if (!matchedProduct) {
        unmatchedProducts.push(item.name);
        unresolvedIssues.push({
          kind: 'product', externalName: item.name, mappingExternalName: item.name,
          parentExternalName: '', marketplacePrice: item.price,
        });
        void dependencies.recordUnmatchedName({
          provider: detail.provider,
          entityType: 'product',
          externalName: item.name,
        });
        continue;
      }

      const customizationData = await dependencies.loadProductCustomizations(matchedProduct.id);
      if (customizationData.error) throw new Error(customizationData.error);
      const addons: OrderItemAddon[] = [];
      const removedIngredients: string[] = [];
      const unmatchedAddonNotes: string[] = [];

      item.customizations.forEach((customization) => {
        const groupAliases = marketplaceMappings.filter((mapping) => (
          mapping.entity_type === 'addon_group'
          && mapping.normalized_external_name === normalizeMarketplaceName(customization.name)
        ));
        const groupAlias = groupAliases.find((mapping) => (
          mapping.parent_normalized_external_name === normalizeMarketplaceName(item.name)
        )) ?? groupAliases.find((mapping) => !mapping.parent_normalized_external_name);
        const posGroup = groupAlias ? customizationData.groups.find((group) => (
          group.id === groupAlias.internal_entity_id
          || normalizeMarketplaceName(group.name) === normalizeMarketplaceName(groupAlias.internal_name)
        )) : customizationData.groups.find((group) => (
          normalizeMarketplaceName(group.name) === normalizeMarketplaceName(customization.name)
        )) ?? null;
        customization.options.forEach((option) => {
        const addonAliases = marketplaceMappings.filter((mapping) => (
          mapping.entity_type === 'addon'
          && mapping.normalized_external_name === normalizeMarketplaceName(option.name)
        ));
        const addonAlias = addonAliases.find((mapping) => (
          mapping.parent_normalized_external_name === normalizeMarketplaceName(item.name)
        )) ?? addonAliases.find((mapping) => !mapping.parent_normalized_external_name);
        const optionMatches = (posGroup ? [posGroup] : customizationData.groups).flatMap((group) => group.items.map((groupItem) => ({
            group,
            addonItem: groupItem,
            score: getNameSimilarity(option.name, groupItem.name),
          } as any))).sort((left, right) => right.score - left.score);
        const exactOptionMatch = addonAlias?.is_active
          ? optionMatches.find((match) => match.addonItem.id === addonAlias.internal_entity_id)
            ?? optionMatches.find((match) => (
            normalizeMarketplaceName(match.addonItem.name)
            === normalizeMarketplaceName(addonAlias.internal_name)
          )) ?? null
          : optionMatches.find((match) => (
            normalizeMarketplaceName(match.addonItem.name)
            === normalizeMarketplaceName(option.name)
          )) ?? null;

        const removalCandidate = exactOptionMatch ? null : getMarketplaceRemovalCandidate(option.name);
        if (removalCandidate) {
          const ingredientAliases = marketplaceMappings.filter((mapping) => (
            mapping.entity_type === 'ingredient'
            && mapping.normalized_external_name === normalizeMarketplaceName(removalCandidate)
          ));
          const ingredientAlias = ingredientAliases.find((mapping) => (
            mapping.parent_normalized_external_name === normalizeMarketplaceName(item.name)
          )) ?? ingredientAliases.find((mapping) => !mapping.parent_normalized_external_name);
          const targetIngredient = ingredientAlias?.internal_name ?? removalCandidate;
          const matchedIngredientName = customizationData.removableIngredients.find((ingredient) => (
            ingredient.customer_can_remove
            && (ingredient.id === ingredientAlias?.internal_entity_id
              || normalizeMarketplaceName(ingredient.ingredient_name) === normalizeMarketplaceName(targetIngredient))
          ))?.ingredient_name ?? null;

          if (matchedIngredientName) {
            removedIngredients.push(matchedIngredientName);
            return;
          }

          unmatchedOptions.push(`${item.name}: ${option.name}`);
          unresolvedIssues.push({
            kind: 'ingredient', externalName: option.name, mappingExternalName: removalCandidate,
            parentExternalName: item.name, marketplacePrice: option.price,
          });
          void dependencies.recordUnmatchedName({
            provider: detail.provider,
            entityType: 'ingredient',
            externalName: removalCandidate,
            parentExternalName: item.name,
          });
          return;
        }

        const bestOptionMatch = exactOptionMatch ?? (addonAlias
          ? optionMatches.find((match) => (
            normalizeMarketplaceName(match.addonItem.name)
            === normalizeMarketplaceName(addonAlias.internal_name)
          )) ?? null
          : optionMatches[0] ?? null);

        if (!bestOptionMatch || (!addonAlias && bestOptionMatch.score < MARKETPLACE_MATCH_THRESHOLD) || (!posGroup && !exactOptionMatch)) {
          unmatchedAddonNotes.push(formatUnmatchedMarketplaceAddon(option));
          void dependencies.recordUnmatchedName({
            provider: detail.provider,
            entityType: 'addon',
            externalName: option.name,
            parentExternalName: item.name,
          });
          return;
        }

        const quantity = Math.max(1, option.quantity || 1);
        for (let index = 0; index < quantity; index += 1) {
          addons.push({
            id: `pos-addon-${bestOptionMatch.addonItem.id}-${index}-${dependencies.now().getTime()}`,
            order_item_id: '',
            addon_group_id: bestOptionMatch.group.id,
            addon_group_name: bestOptionMatch.group.name,
            addon_item_id: bestOptionMatch.addonItem.id,
            addon_item_name: bestOptionMatch.addonItem.name,
            addon_item_price: bestOptionMatch.addonItem.extra_price,
            section: bestOptionMatch.addonItem.section ?? null,
            created_at: dependencies.now().toISOString(),
            is_required: bestOptionMatch.group.is_required,
            display_order: bestOptionMatch.addonItem.sort_order ?? undefined,
            display_group_order: bestOptionMatch.group.display_order ?? undefined,
          });
        }
        });
      });

      const overridePrice = parseMarketplaceMoney(item.price);
      const quantity = Math.max(1, item.quantity || 1);
      cartItems.push({
        id: dependencies.createLocalId(),
        order_id: '',
        product_id: matchedProduct.id,
        product_name: matchedProduct.name,
        product_description: matchedProduct.description,
        product_image_url: matchedProduct.image_url,
        base_price: matchedProduct.sale_price,
        override_price: overridePrice,
        quantity,
        subtotal: overridePrice ?? (
          matchedProduct.sale_price
          + addons.reduce((sum, addon) => sum + (addon.addon_item_price || 0), 0)
        ) * quantity,
        section: formatKitchenSectionValue(
          matchedProduct.section,
          addons,
          getProductGroupSection(matchedProduct, categories)
        ),
        removed_ingredients: Array.from(new Set(removedIngredients)),
        comment: [item.specialInstructions.trim(), ...unmatchedAddonNotes].filter(Boolean).join('\n') || null,
        created_at: dependencies.now().toISOString(),
        addons,
      });
    }

    const requestedAt = new Date(detail.requestedAt);
    return {
      cartItems,
      customerName: detail.customerName || '',
      requestedAt: Number.isFinite(requestedAt.getTime()) ? requestedAt : dependencies.now(),
      discountAmount: getMarketplaceImportDiscountAmount(detail),
      metadata: {
        source: getMarketplaceSource(detail.provider),
        externalOrderNumber,
        orderStatus: getMarketplaceOrderStatus(
          detail.orderJobState,
          detail.statusDescription,
          detail.orderStateChanges
        ),
        grossSales: detail.totalAmount,
        grossPayout: parseMarketplaceMoney(detail.netPayout),
      },
      unmatchedProducts,
      unmatchedOptions,
      unresolvedIssues,
    };
  };

  const updateExistingMarketplaceOrder = async (
    order: Order,
    detail: MarketplaceOrderDetail
  ): Promise<{ order: Order | null; error: string | null }> => {
    const orderStatus = getMarketplaceOrderStatus(
      detail.orderJobState,
      detail.statusDescription,
      detail.orderStateChanges
    );
    if (!shouldReconcileMarketplaceOrderStatus(order.order_status, orderStatus)) {
      return { order, error: null };
    }
    const update: MarketplaceStatusUpdate = {
      order_status: orderStatus,
    };
    const result = await dependencies.updateMarketplaceOrder(order.id, update);
    return { order: result.data, error: result.error };
  };

  const syncMarketplaceOrderStatus = async (
    provider: MarketplaceProvider,
    externalOrderId: string,
    detail: MarketplaceOrderDetail
  ): Promise<{ order: Order | null; error: string | null }> => {
    try {
      const normalizedExternalOrderId = externalOrderId.trim();
      if (!normalizedExternalOrderId) {
        return { order: null, error: 'Marketplace order ID is required.' };
      }

      const existing = await dependencies.findMarketplaceOrder(provider, normalizedExternalOrderId);
      if (existing.error || !existing.data) {
        return { order: null, error: existing.error };
      }
      return updateExistingMarketplaceOrder(existing.data, detail);
    } catch (error) {
      return { order: null, error: getOrderError(error, 'Failed to synchronize marketplace order status') };
    }
  };

  const importMarketplaceOrder = async (
    detail: MarketplaceOrderDetail
  ): Promise<{ order: Order | null; created: boolean; error: string | null }> => {
    try {
      const externalOrderNumber = detail.orderId.trim();
      if (!externalOrderNumber) {
        return { order: null, created: false, error: 'Marketplace order ID is required.' };
      }

      const existing = await dependencies.findMarketplaceOrder(detail.provider, externalOrderNumber);
      if (existing.error) {
        return { order: null, created: false, error: existing.error };
      }
      if (existing.data) {
        const synced = await updateExistingMarketplaceOrder(existing.data, detail);
        return { order: synced.order, created: false, error: synced.error };
      }

      const draft = await buildMarketplacePosOrderDraft(detail);
      if (draft.cartItems.length === 0) {
        return {
          order: null,
          created: false,
          error: `None of the ${draft.metadata.source} items matched the POS catalog.`,
        };
      }

      if (draft.unmatchedProducts.length > 0 || draft.unmatchedOptions.length > 0) {
        const unmatchedProducts = draft.unmatchedProducts.length > 0
          ? draft.unmatchedProducts.join(', ')
          : 'none';
        const unmatchedOptions = draft.unmatchedOptions.length > 0
          ? draft.unmatchedOptions.join(', ')
          : 'none';
        return {
          order: null,
          created: false,
          error: `Marketplace order needs manual review before import. Unmatched products: ${unmatchedProducts}. Unmatched options: ${unmatchedOptions}.`,
        };
      }

      const subtotal = draft.cartItems.reduce((sum, item) => sum + item.subtotal, 0);
      const discountAmount = Math.max(0, Math.min(subtotal, draft.discountAmount));
      const total = Math.max(0, subtotal - discountAmount);
      const notes = [
        draft.unmatchedProducts.length > 0
          ? `Unmatched items: ${draft.unmatchedProducts.join(', ')}`
          : '',
        draft.unmatchedOptions.length > 0
          ? `Check modifiers: ${draft.unmatchedOptions.join(', ')}`
          : '',
      ].filter(Boolean).join('\n');

      const orderPayload: MarketplaceOrderPayload = {
        created_at: draft.requestedAt.toISOString(),
        user_id: null,
        customer_email: '',
        customer_phone: externalOrderNumber,
        customer_name: draft.customerName || draft.metadata.source,
        payment_method: 'store',
        order_channel: 'third_party',
        payment_method_detail: draft.metadata.source,
        order_type: 'pickup',
        payment_status: 'paid',
        order_status: draft.metadata.orderStatus,
        subtotal,
        tax: 0,
        delivery_fee: 0,
        service_fee: 0,
        promotion_discount: discountAmount,
        promotions_applied: buildMarketplacePromotion(discountAmount),
        coupon_code: null,
        coupon_discount: 0,
        total,
        marketplace_gross_sales: draft.metadata.grossSales ?? total,
        marketplace_gross_payout: draft.metadata.grossPayout,
        reward_points_used: null,
        reward_points_value: null,
        order_options: null,
        special_instructions: notes || null,
        delivery_address_id: null,
        delivery_address_line1: null,
        delivery_address_line2: null,
        delivery_city: null,
        delivery_state: null,
        delivery_postcode: null,
        delivery_country: null,
        delivery_latitude: null,
        delivery_longitude: null,
        delivery_quote_id: null,
        delivery_quote_amount: null,
        delivery_quote_currency: null,
        delivery_partner_name: draft.metadata.source,
        external_order_number: externalOrderNumber,
        marketplace_workflow_uuid: detail.orderUUID,
        delivery_quote_expires_at: null,
        delivery_eta_minutes: null,
        delivery_provider_id: null,
        delivery_status: null,
        delivery_tracking_url: null,
        delivery_driver_name: null,
        delivery_driver_phone: null,
        delivery_driver_pin: null,
        delivery_vehicle_info: null,
        delivery_instructions: null,
        scheduled_pickup_at: null,
      };

      const saveResult = await dependencies.savePosOrder(
        orderPayload,
        draft.cartItems.map((item) => ({
          product_id: item.product_id,
          product_name: item.product_name,
          product_description: item.product_description,
          product_image_url: item.product_image_url,
          base_price: item.base_price,
          override_price: item.override_price,
          quantity: item.quantity,
          subtotal: item.subtotal,
          section: item.section,
          removed_ingredients: item.removed_ingredients,
          comment: item.comment,
          addons: (item.addons || []).map((addon) => ({
            addon_group_id: addon.addon_group_id,
            addon_group_name: addon.addon_group_name,
            addon_item_id: addon.addon_item_id,
            addon_item_name: addon.addon_item_name,
            addon_item_price: addon.addon_item_price,
            section: addon.section,
            is_required: addon.is_required,
            display_order: addon.display_order,
            display_group_order: addon.display_group_order,
          })),
        }))
      );

      return {
        order: saveResult.data,
        created: Boolean(saveResult.data && !saveResult.error),
        error: saveResult.error,
      };
    } catch (error) {
      return { order: null, created: false, error: getOrderError(error, 'Failed to import marketplace order') };
    }
  };

  return {
    buildMarketplacePosOrderDraft,
    importMarketplaceOrder,
    syncMarketplaceOrderStatus,
  };
}

const defaultDependencies: MarketplacePosOrderDependencies = {
  findMarketplaceOrder: async (provider, externalOrderId) => {
    const { findMarketplaceOrder } = require('./orders');
    return findMarketplaceOrder(provider, externalOrderId);
  },
  savePosOrder: async (orderPayload, items) => {
    const { savePosOrder } = require('./orders');
    return savePosOrder(orderPayload as Parameters<typeof savePosOrder>[0], items);
  },
  updateMarketplaceOrder: async (orderId, update) => {
    const { updateMarketplaceOrderStatus } = require('./orders');
    return updateMarketplaceOrderStatus(orderId, update.order_status);
  },
  loadCatalog: async () => {
    const { supabase } = require('./supabase');
    const [productResult, categoryResult] = await Promise.all([
      supabase
        .from('sale_products')
        .select('id, name, description, section, search_term, sale_price, image_url, sale_category_id, sub_category_id, sort_order, is_active')
        .eq('is_active', true)
        .order('name', { ascending: true }),
      supabase
        .from('sale_categories')
        .select('id, section')
        .eq('is_active', true),
    ]);

    if (productResult.error) throw new Error(productResult.error.message);
    if (categoryResult.error) throw new Error(categoryResult.error.message);

    return {
      products: (productResult.data || []) as SaleProduct[],
      categories: (categoryResult.data || []) as MarketplaceCategorySection[],
    };
  },
  loadMappings: async (provider) => {
    const { supabase } = require('./supabase');
    const { data, error } = await supabase
      .from('marketplace_name_mappings')
      .select('provider, entity_type, external_name, normalized_external_name, parent_normalized_external_name, internal_name, internal_entity_id, is_active')
      .eq('provider', provider)
      .eq('is_active', true);

    if (error) {
      throw new Error(error.message);
    }
    return (data || []) as MarketplaceMappingRecord[];
  },
  loadProductCustomizations: async (productId) => {
    const { supabase } = require('./supabase');
    const [addonResult, ingredientResult] = await Promise.all([
      supabase
        .from('sale_product_addon_groups')
        .select(`
          addon_group_id,
          display_order,
          addon_groups (
            id,
            name,
            is_required,
            multiple_choice,
            addon_items (
              id,
              addon_group_id,
              name,
              extra_price,
              section,
              sort_order,
              is_active
            )
          )
        `)
        .eq('sale_product_id', productId)
        .order('display_order', { ascending: true }),
      supabase
        .from('sale_product_ingredients')
        .select('id, customer_can_remove, products!product_id(name)')
        .eq('sale_product_id', productId)
        .eq('customer_can_remove', true)
        .order('id', { ascending: true }),
    ]);

    const groups: AddonGroup[] = ((addonResult.data || []) as any[]).flatMap((row) => {
      const group = Array.isArray(row.addon_groups) ? row.addon_groups[0] : row.addon_groups;
      if (!group) return [];
      return [{
        id: group.id,
        name: group.name,
        is_required: Boolean(group.is_required),
        multiple_choice: Boolean(group.multiple_choice),
        display_order: row.display_order ?? null,
        items: (group.addon_items || [])
          .filter((item: any) => item.is_active !== false)
          .map((item: any) => ({
            id: item.id,
            addon_group_id: item.addon_group_id,
            name: item.name,
            extra_price: Number(item.extra_price || 0),
            section: item.section ?? null,
            sort_order: item.sort_order ?? null,
            is_active: item.is_active ?? true,
          })),
      }];
    });

    const removableIngredients: RemovableIngredient[] = ((ingredientResult.data || []) as Array<{
      id: string;
      customer_can_remove: boolean;
      products: { name?: string } | { name?: string }[] | null;
    }>).map((row) => {
      const productRef = Array.isArray(row.products) ? row.products[0] : row.products;
      return {
        id: row.id,
        ingredient_name: productRef?.name?.trim() || 'Unknown ingredient',
        customer_can_remove: row.customer_can_remove,
      };
    });

    if (addonResult.error) throw new Error(addonResult.error.message);
    if (ingredientResult.error) throw new Error(ingredientResult.error.message);

    return { groups, removableIngredients };
  },
  recordUnmatchedName: async (input) => {
    const normalizedExternalName = normalizeMarketplaceName(input.externalName);
    const parentExternalName = input.parentExternalName || '';
    if (!normalizedExternalName) return;

    const { supabase } = require('./supabase');
    const { data: existing, error: existingError } = await supabase
      .from('marketplace_unmatched_names')
      .select('id, occurrences')
      .eq('provider', input.provider)
      .eq('entity_type', input.entityType)
      .eq('normalized_external_name', normalizedExternalName)
      .eq('parent_external_name', parentExternalName)
      .maybeSingle();

    if (existingError) {
      console.warn('Marketplace unmatched lookup failed', existingError);
      return;
    }

    if (existing?.id) {
      const { error: updateError } = await supabase
        .from('marketplace_unmatched_names')
        .update({
          occurrences: Number(existing.occurrences || 0) + 1,
          last_seen_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
      if (updateError) console.warn('Marketplace unmatched update failed', updateError);
      return;
    }

    const { error: insertError } = await supabase
      .from('marketplace_unmatched_names')
      .insert({
        provider: input.provider,
        entity_type: input.entityType,
        external_name: input.externalName,
        normalized_external_name: normalizedExternalName,
        parent_external_name: parentExternalName,
        occurrences: 1,
        first_seen_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      });
    if (insertError) console.warn('Marketplace unmatched insert failed', insertError);
  },
  createLocalId: () => `pos-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  now: () => new Date(),
};

const defaultService = createMarketplacePosOrderService(defaultDependencies);

export const buildMarketplacePosOrderDraft = defaultService.buildMarketplacePosOrderDraft;
export const importMarketplaceOrder = defaultService.importMarketplaceOrder;
export const syncMarketplaceOrderStatus = defaultService.syncMarketplaceOrderStatus;
