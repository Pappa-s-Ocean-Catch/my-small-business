import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';

/** Stable grid events let unchanged tiles skip work while still using the latest committed cart/group state. */
export function useProductTilePress<T extends { id: string }>(products: readonly T[], onPress: (product: T) => unknown): (id: string) => void {
  const productsById = useMemo(() => new Map(products.map(product => [product.id, product])), [products]);
  const latest = useRef({ productsById, onPress });
  useLayoutEffect(() => { latest.current = { productsById, onPress }; }, [productsById, onPress]);
  return useCallback((id: string) => {
    const product = latest.current.productsById.get(id);
    if (product) void latest.current.onPress(product);
  }, []);
}
