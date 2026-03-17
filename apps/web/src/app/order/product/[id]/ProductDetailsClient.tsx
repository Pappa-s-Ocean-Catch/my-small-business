'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/contexts/CartContext';
import { ItemCustomizationModal } from '@/components/ItemCustomizationModal';
import type { CartAddonGroup } from '@/contexts/CartContext';
import { ActionButton } from '@/components/ActionButton';
import { Icon } from '@/components/Icon';
import { FaFire, FaUtensils } from 'react-icons/fa';
import { CartSidebar } from '@/components/CartSidebar';
import { toast } from 'react-toastify';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';

export type SaleProductForDetails = {
    id: string;
    slug: string | null;
    name: string;
    description: string | null;
    seo_title: string | null;
    seo_description: string | null;
    seo_text: string | null;
    sale_price: number;
    image_url: string | null;
    is_active: boolean;
};

export type BundleIncludeRow = {
    quantity: number;
    included: {
        id: string;
        name: string;
        sale_price: number;
        image_url: string | null;
    } | null;
};

export type HotSellerProduct = {
    id: string;
    slug: string | null;
    name: string;
    description: string | null;
    sale_price: number;
    image_url: string | null;
};

export default function ProductDetailsClient(props: {
    product: SaleProductForDetails;
    bundleIncludes: BundleIncludeRow[];
    hotSellers: HotSellerProduct[];
}) {
    const router = useRouter();
    const { addItem, isLoading: cartLoading } = useCart();

    const { product, bundleIncludes, hotSellers } = props;

    const { onlineOrderEnabled } = useFeatureFlag();
    const [showCustomize, setShowCustomize] = useState(false);
    const [customizingProduct, setCustomizingProduct] = useState<HotSellerProduct | null>(null);

    const bundleOriginalTotal = useMemo(() => {
        return bundleIncludes.reduce((sum, row) => {
            const price = row.included?.sale_price ?? 0;
            const qty = Math.max(1, Number(row.quantity || 1));
            return sum + price * qty;
        }, 0);
    }, [bundleIncludes]);

    const bundleSavings = useMemo(() => {
        return Math.max(0, bundleOriginalTotal - product.sale_price);
    }, [bundleOriginalTotal, product.sale_price]);

    const handleAddToCart = (customizations: CartAddonGroup[], comment?: string | null, removedIngredients?: string[], quantity?: number) => {
        const qty = Math.max(1, Math.min(99, quantity ?? 1));
        addItem({
            product_id: product.id,
            name: product.name,
            description: product.description,
            base_price: product.sale_price,
            image_url: product.image_url,
            quantity: qty,
            addon_groups: customizations,
            removed_ingredients: removedIngredients || [],
            comment: comment || null,
        });

        setShowCustomize(false);
        toast.success('Added to cart');
    };

    const handleAddHotSellerToCart = (customizations: CartAddonGroup[], comment?: string | null, removedIngredients?: string[], quantity?: number) => {
        if (!customizingProduct) return;

        const qty = Math.max(1, Math.min(99, quantity ?? 1));
        addItem({
            product_id: customizingProduct.id,
            name: customizingProduct.name,
            description: customizingProduct.description,
            base_price: customizingProduct.sale_price,
            image_url: customizingProduct.image_url,
            quantity: qty,
            addon_groups: customizations,
            removed_ingredients: removedIngredients || [],
            comment: comment || null,
        });

        setCustomizingProduct(null);
        toast.success('Added to cart');
    };

    const seoText = product.seo_text?.trim();

    if (cartLoading) {
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

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-neutral-900 pb-24">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex items-center justify-between gap-4">
                    <Link href="/order" className="text-sm text-blue-600 hover:underline">← Back to order</Link>
                    <div className="text-lg font-bold text-green-600 dark:text-green-400">${product.sale_price.toFixed(2)}</div>
                </div>

                <div className="mt-4 bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-gray-200 dark:border-neutral-700 overflow-hidden">
                    {product.image_url ? (
                        <div className="aspect-video bg-gray-200 dark:bg-neutral-700">
                            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                        </div>
                    ) : (
                        <div className="aspect-video bg-gray-200 dark:bg-neutral-700 flex items-center justify-center">
                            <Icon icon={FaUtensils} className="w-12 h-12 text-gray-400 dark:text-gray-500" />
                        </div>
                    )}

                    <div className="p-6 space-y-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{product.name}</h1>
                            {product.description && (
                                <p className="mt-2 text-gray-700 dark:text-gray-300">{product.description}</p>
                            )}
                        </div>

                        {seoText && (
                            <div className="rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50/50 dark:bg-neutral-800/50 p-4">
                                <div className="font-semibold text-gray-900 dark:text-white">More about this item</div>
                                <div className="mt-2 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{seoText}</div>
                            </div>
                        )}

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

                        {onlineOrderEnabled === true && (
                            <div className="flex items-center justify-end">
                                <ActionButton onClick={() => setShowCustomize(true)}>
                                    Add to Cart
                                </ActionButton>
                            </div>
                        )}
                    </div>
                </div>

                {hotSellers.length > 0 && (
                    <section className="mt-10">
                        <div className="flex items-end justify-between gap-4 mb-4">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <Icon icon={FaFire} className="text-orange-500" />
                                    Hot sellers
                                </h2>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Popular items customers add alongside this.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {hotSellers.map((p) => {
                                const slug = p.slug?.trim();
                                const href = `/order/product/${slug ? slug : p.id}`;

                                return (
                                    <div
                                        key={p.id}
                                        className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                                        role="link"
                                        tabIndex={0}
                                        onClick={() => router.push(href)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                router.push(href);
                                            }
                                        }}
                                        aria-label={`View details for ${p.name}`}
                                    >
                                        <div className="aspect-[16/10] bg-gray-200 dark:bg-neutral-700 relative">
                                            {p.image_url ? (
                                                <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-500">
                                                    <Icon icon={FaUtensils} className="w-10 h-10" />
                                                </div>
                                            )}
                                        </div>

                                        <div className="p-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <h3 className="font-semibold text-gray-900 dark:text-white leading-tight">{p.name}</h3>
                                                <span className="text-base font-bold text-green-600 dark:text-green-400 whitespace-nowrap">${p.sale_price.toFixed(2)}</span>
                                            </div>
                                            {p.description && (
                                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 line-clamp-2">{p.description}</p>
                                            )}

                                            {onlineOrderEnabled === true && (
                                                <div className="mt-4 flex items-center gap-2">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setCustomizingProduct(p);
                                                        }}
                                                        className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
                                                    >
                                                        Add
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}
            </div>

            {onlineOrderEnabled === true && (
                <>
                    <ItemCustomizationModal
                        isOpen={showCustomize}
                        onClose={() => setShowCustomize(false)}
                        product={product}
                        onAddToCart={handleAddToCart}
                    />

                    {customizingProduct && (
                        <ItemCustomizationModal
                            isOpen={!!customizingProduct}
                            onClose={() => setCustomizingProduct(null)}
                            product={customizingProduct as unknown as SaleProductForDetails}
                            onAddToCart={handleAddHotSellerToCart}
                        />
                    )}

                    <CartSidebar />
                </>
            )}
        </div>
    );
}
