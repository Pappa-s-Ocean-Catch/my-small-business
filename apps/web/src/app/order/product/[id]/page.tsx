'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { getSupabaseClient } from '@my-small-business/supabase/client';
import { useCart } from '@/contexts/CartContext';
import { ItemCustomizationModal } from '@/components/ItemCustomizationModal';
import type { CartAddonGroup } from '@/contexts/CartContext';
import { ActionButton } from '@/components/ActionButton';

type SaleProduct = {
  id: string;
  name: string;
  description: string | null;
  sale_price: number;
  image_url: string | null;
  is_active: boolean;
};

type BundleIncludeRow = {
  quantity: number;
  included: {
    id: string;
    name: string;
    sale_price: number;
    image_url: string | null;
  } | null;
};

export default function OrderProductDetailsPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const { addItem, isLoading: cartLoading } = useCart();

  const [product, setProduct] = useState<SaleProduct | null>(null);
  const [bundleIncludes, setBundleIncludes] = useState<BundleIncludeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCustomize, setShowCustomize] = useState(false);

  useEffect(() => {
    if (!id) return;
    void load();

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const supabase = getSupabaseClient();

        const [productRes, includesRes] = await Promise.all([
          supabase
            .from('sale_products')
            .select('id, name, description, sale_price, image_url, is_active')
            .eq('id', id)
            .single(),
          supabase
            .from('sale_product_includes')
            .select('quantity, included:sale_products!included_sale_product_id(id, name, sale_price, image_url)')
            .eq('parent_sale_product_id', id),
        ]);

        if (productRes.error) throw productRes.error;
        if (!productRes.data) throw new Error('Product not found');

        const p = productRes.data as unknown as SaleProduct;
        setProduct(p);

        if (includesRes.error) throw includesRes.error;
        setBundleIncludes((includesRes.data || []) as unknown as BundleIncludeRow[]);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load product');
      } finally {
        setLoading(false);
      }
    }
  }, [id]);

  const bundleOriginalTotal = useMemo(() => {
    return bundleIncludes.reduce((sum, row) => {
      const price = row.included?.sale_price ?? 0;
      const qty = Math.max(1, Number(row.quantity || 1));
      return sum + price * qty;
    }, 0);
  }, [bundleIncludes]);

  const bundleSavings = useMemo(() => {
    if (!product) return 0;
    return Math.max(0, bundleOriginalTotal - product.sale_price);
  }, [bundleOriginalTotal, product]);

  const handleAddToCart = (customizations: CartAddonGroup[], comment?: string | null) => {
    if (!product) return;

    addItem({
      product_id: product.id,
      name: product.name,
      description: product.description,
      base_price: product.sale_price,
      image_url: product.image_url,
      quantity: 1,
      addon_groups: customizations,
      comment: comment || null,
    });

    setShowCustomize(false);
  };

  if (loading || cartLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-neutral-900">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 dark:bg-neutral-700 rounded w-2/3" />
            <div className="h-40 bg-gray-200 dark:bg-neutral-700 rounded" />
            <div className="h-6 bg-gray-200 dark:bg-neutral-700 rounded w-1/3" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-neutral-900">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link href="/order" className="text-sm text-blue-600 hover:underline">← Back to order</Link>
          <div className="mt-4 p-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200">
            {error}
          </div>
        </div>
      </div>
    );
  }

  if (!product) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-900 pb-24">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between gap-4">
          <Link href="/order" className="text-sm text-blue-600 hover:underline">← Back to order</Link>
          <div className="text-lg font-bold text-green-600 dark:text-green-400">${product.sale_price.toFixed(2)}</div>
        </div>

        <div className="mt-4 bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-gray-200 dark:border-neutral-700 overflow-hidden">
          {product.image_url && (
            <div className="aspect-video bg-gray-200 dark:bg-neutral-700">
              <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="p-6 space-y-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{product.name}</h1>
              {product.description && (
                <p className="mt-2 text-gray-700 dark:text-gray-300">{product.description}</p>
              )}
            </div>

            {bundleIncludes.length > 0 && (
              <div className="rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50/50 dark:bg-neutral-800/50 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-white">Pack includes</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Prices shown are the included items’ normal prices.</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-700 dark:text-gray-300">
                      <span className="line-through text-gray-500 dark:text-gray-400 mr-2">${bundleOriginalTotal.toFixed(2)}</span>
                      <span className="font-semibold">${product.sale_price.toFixed(2)}</span>
                    </div>
                    {bundleSavings > 0 && (
                      <div className="text-sm font-semibold text-green-700 dark:text-green-300">Save ${bundleSavings.toFixed(2)}</div>
                    )}
                  </div>
                </div>

                <ul className="mt-3 space-y-2">
                  {bundleIncludes.map((row, idx) => (
                    <li key={`${row.included?.id ?? 'unknown'}-${idx}`} className="flex items-center justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {Math.max(1, Number(row.quantity || 1))}× {row.included?.name ?? 'Unknown item'}
                        </span>
                      </div>
                      <div className="text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        ${(Math.max(1, Number(row.quantity || 1)) * (row.included?.sale_price ?? 0)).toFixed(2)}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center justify-end">
              <ActionButton onClick={() => setShowCustomize(true)}>
                Add to Cart
              </ActionButton>
            </div>
          </div>
        </div>
      </div>

      <ItemCustomizationModal
        isOpen={showCustomize}
        onClose={() => setShowCustomize(false)}
        product={product}
        onAddToCart={handleAddToCart}
      />
    </div>
  );
}
