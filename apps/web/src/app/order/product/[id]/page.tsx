import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { createServiceRoleClient } from '@my-small-business/supabase/server';
import { getTopSellingProducts } from '@/app/actions/top-sellers';
import ProductDetailsClient, {
  type BundleIncludeRow,
  type HotSellerProduct,
  type SaleProductForDetails,
} from './ProductDetailsClient';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function fetchSaleProductByIdOrSlug(idOrSlug: string): Promise<SaleProductForDetails | null> {
  const supabase = await createServiceRoleClient();
  const isUuid = UUID_RE.test(idOrSlug);

  const { data, error } = await supabase
    .from('sale_products')
    .select('id, slug, name, description, seo_title, seo_description, seo_text, sale_price, image_url, is_active')
    .eq(isUuid ? 'id' : 'slug', idOrSlug)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const p = data as unknown as SaleProductForDetails;
  if (!p.is_active) return null;
  return p;
}

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params;
  const product = await fetchSaleProductByIdOrSlug(id);

  if (!product) {
    return {
      title: 'Product not found',
      robots: { index: false, follow: false },
    };
  }

  const seoTitle = product.seo_title?.trim() || product.name;
  const seoDescription =
    product.seo_description?.trim() ||
    product.description?.trim() ||
    `Order ${product.name} online.`;

  const canonical = `/order/product/${product.slug?.trim() || product.id}`;

  return {
    title: seoTitle,
    description: seoDescription,
    alternates: { canonical },
    openGraph: {
      title: seoTitle,
      description: seoDescription,
      url: canonical,
      type: 'website',
      images: product.image_url ? [{ url: product.image_url }] : undefined,
    },
  };
}

export default async function OrderProductDetailsPage(
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const isUuid = UUID_RE.test(id);

  const product = await fetchSaleProductByIdOrSlug(id);
  if (!product) notFound();

  // Canonicalize UUID URLs to slug URLs when possible
  if (isUuid && product.slug?.trim()) {
    redirect(`/order/product/${product.slug.trim()}`);
  }

  const supabase = await createServiceRoleClient();

  const { data: includesData, error: includesError } = await supabase
    .from('sale_product_includes')
    .select('quantity, included:sale_products!included_sale_product_id(id, name, sale_price, image_url)')
    .eq('parent_sale_product_id', product.id);

  if (includesError) {
    throw includesError;
  }

  const { data: topSellersRes, error: topSellersError } = await getTopSellingProducts(20);
  if (topSellersError) {
    // Non-fatal: just omit the section if analytics fails
    // (still want the product page to render)
  }

  const hotSellers: HotSellerProduct[] = (topSellersRes || [])
    .filter((p) => p.id !== product.id)
    .slice(0, 8)
    .map((p) => ({
      id: p.id,
      slug: p.slug ?? null,
      name: p.name,
      description: p.description,
      sale_price: p.sale_price,
      image_url: p.image_url,
    }));

  return (
    <ProductDetailsClient
      product={product}
      bundleIncludes={(includesData || []) as unknown as BundleIncludeRow[]}
      hotSellers={hotSellers}
    />
  );
}
