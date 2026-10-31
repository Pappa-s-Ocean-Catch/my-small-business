import { createStore, type StoreApi } from 'zustand/vanilla';
import type {
  CacheEntry,
  CustomizationData,
  SaleCategory,
  SaleProduct,
  TopSellerProduct,
} from '../app/pos.types';

// Catalogue values remain valid for the app session; only top sellers have a TTL.
export const CATALOG_CACHE_TTL_MS = Number.POSITIVE_INFINITY;
export const TOP_SELLERS_CACHE_TTL_MS = 15 * 60 * 1000;

const DEFAULT_CATEGORY_LIMIT = 24;
const DEFAULT_AVAILABILITY_LIMIT = 300;
const DEFAULT_CUSTOMIZATION_LIMIT = 100;

type PosCatalogCacheState = {
  categories: CacheEntry<SaleCategory[]> | null;
  allProducts: CacheEntry<SaleProduct[]> | null;
  productsByCategory: Map<string, CacheEntry<SaleProduct[]>>;
  customizationAvailability: Map<string, CacheEntry<boolean>>;
  customizations: Map<string, CacheEntry<CustomizationData>>;
  topSellers: CacheEntry<TopSellerProduct[]> | null;
  getCategories: () => SaleCategory[] | null;
  setCategories: (data: SaleCategory[]) => void;
  getAllProducts: () => SaleProduct[] | null;
  setAllProducts: (data: SaleProduct[]) => void;
  getProductsByCategory: (key: string) => SaleProduct[] | null;
  setProductsByCategory: (key: string, data: SaleProduct[]) => void;
  getCustomizationAvailability: (productId: string) => boolean | null;
  setCustomizationAvailability: (productId: string, value: boolean) => void;
  getCustomization: (productId: string) => CustomizationData | null;
  setCustomization: (productId: string, data: CustomizationData) => void;
  getTopSellers: () => TopSellerProduct[] | null;
  setTopSellers: (data: TopSellerProduct[], ttlMs?: number) => void;
  clearTopSellers: () => void;
  pruneExpired: () => void;
  clear: () => void;
};

type PosCatalogCacheOptions = {
  now?: () => number;
  categoryLimit?: number;
  availabilityLimit?: number;
  customizationLimit?: number;
};

const createCacheEntry = <T,>(data: T, ttlMs: number, now: number): CacheEntry<T> => ({
  data,
  expiresAt: now + ttlMs,
});

const getFreshMapValue = <T,>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  now: number,
): T | null => {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt > now) return entry.data;
  cache.delete(key);
  return null;
};

const pruneMap = <T,>(cache: Map<string, CacheEntry<T>>, now: number) => {
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(key);
  }
};

const setBoundedMapValue = <T,>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  entry: CacheEntry<T>,
  limit: number,
) => {
  cache.delete(key);
  cache.set(key, entry);
  while (cache.size > limit) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey === undefined) break;
    cache.delete(oldestKey);
  }
};

export const createPosCatalogCacheStore = (
  options: PosCatalogCacheOptions = {},
): StoreApi<PosCatalogCacheState> => {
  const now = options.now ?? Date.now;
  const categoryLimit = options.categoryLimit ?? DEFAULT_CATEGORY_LIMIT;
  const availabilityLimit = options.availabilityLimit ?? DEFAULT_AVAILABILITY_LIMIT;
  const customizationLimit = options.customizationLimit ?? DEFAULT_CUSTOMIZATION_LIMIT;

  return createStore<PosCatalogCacheState>((set, get) => ({
    categories: null,
    allProducts: null,
    productsByCategory: new Map(),
    customizationAvailability: new Map(),
    customizations: new Map(),
    topSellers: null,
    getCategories: () => {
      const entry = get().categories;
      if (!entry || entry.expiresAt > now()) return entry?.data ?? null;
      set({ categories: null });
      return null;
    },
    setCategories: (data) => set({
      categories: createCacheEntry(data, CATALOG_CACHE_TTL_MS, now()),
    }),
    getAllProducts: () => {
      const entry = get().allProducts;
      if (!entry || entry.expiresAt > now()) return entry?.data ?? null;
      set({ allProducts: null });
      return null;
    },
    setAllProducts: (data) => set({
      allProducts: createCacheEntry(data, CATALOG_CACHE_TTL_MS, now()),
    }),
    getProductsByCategory: (key) => {
      const productsByCategory = new Map(get().productsByCategory);
      const value = getFreshMapValue(productsByCategory, key, now());
      if (productsByCategory.size !== get().productsByCategory.size) set({ productsByCategory });
      return value;
    },
    setProductsByCategory: (key, data) => {
      const productsByCategory = new Map(get().productsByCategory);
      setBoundedMapValue(productsByCategory, key, createCacheEntry(data, CATALOG_CACHE_TTL_MS, now()), categoryLimit);
      set({ productsByCategory });
    },
    getCustomizationAvailability: (productId) => {
      const customizationAvailability = new Map(get().customizationAvailability);
      const value = getFreshMapValue(customizationAvailability, productId, now());
      if (customizationAvailability.size !== get().customizationAvailability.size) set({ customizationAvailability });
      return value;
    },
    setCustomizationAvailability: (productId, value) => {
      const customizationAvailability = new Map(get().customizationAvailability);
      setBoundedMapValue(customizationAvailability, productId, createCacheEntry(value, CATALOG_CACHE_TTL_MS, now()), availabilityLimit);
      set({ customizationAvailability });
    },
    getCustomization: (productId) => {
      const customizations = new Map(get().customizations);
      const value = getFreshMapValue(customizations, productId, now());
      if (customizations.size !== get().customizations.size) set({ customizations });
      return value;
    },
    setCustomization: (productId, data) => {
      const customizations = new Map(get().customizations);
      setBoundedMapValue(customizations, productId, createCacheEntry(data, CATALOG_CACHE_TTL_MS, now()), customizationLimit);
      set({ customizations });
    },
    getTopSellers: () => {
      const entry = get().topSellers;
      if (!entry || entry.expiresAt > now()) return entry?.data ?? null;
      set({ topSellers: null });
      return null;
    },
    setTopSellers: (data, ttlMs = TOP_SELLERS_CACHE_TTL_MS) => set({
      topSellers: createCacheEntry(data, ttlMs, now()),
    }),
    clearTopSellers: () => set({ topSellers: null }),
    pruneExpired: () => {
      const currentNow = now();
      const state = get();
      const productsByCategory = new Map(state.productsByCategory);
      const customizationAvailability = new Map(state.customizationAvailability);
      const customizations = new Map(state.customizations);
      pruneMap(productsByCategory, currentNow);
      pruneMap(customizationAvailability, currentNow);
      pruneMap(customizations, currentNow);
      set({
        categories: state.categories && state.categories.expiresAt > currentNow ? state.categories : null,
        allProducts: state.allProducts && state.allProducts.expiresAt > currentNow ? state.allProducts : null,
        topSellers: state.topSellers && state.topSellers.expiresAt > currentNow ? state.topSellers : null,
        productsByCategory,
        customizationAvailability,
        customizations,
      });
    },
    clear: () => set({
      categories: null,
      allProducts: null,
      productsByCategory: new Map(),
      customizationAvailability: new Map(),
      customizations: new Map(),
      topSellers: null,
    }),
  }));
};

export const posCatalogCacheStore = createPosCatalogCacheStore();
