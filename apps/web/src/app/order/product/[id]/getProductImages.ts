import ImageSlider from "@/components/ImageSlider";
import type { SaleProductForDetails, BundleIncludeRow } from "./ProductDetailsClient";

export function getProductImages(
    product: SaleProductForDetails,
    bundleIncludes: BundleIncludeRow[]
): string[] {
    const images: string[] = [];
    if (product?.image_url) images.push(product.image_url);
    if (Array.isArray(bundleIncludes)) {
        for (const row of bundleIncludes) {
            if (row?.included?.image_url) images.push(row.included.image_url);
        }
    }
    return images;
}
