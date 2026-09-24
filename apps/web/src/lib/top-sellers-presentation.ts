export function splitTopSellers<T>(products: T[]): { featured: T[]; remaining: T[] } {
  return {
    featured: products.slice(0, 3),
    remaining: products.slice(3),
  };
}
