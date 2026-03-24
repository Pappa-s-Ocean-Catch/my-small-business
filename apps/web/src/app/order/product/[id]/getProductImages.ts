import ImageSlider from "@/components/ImageSlider";

export function getProductImages(product, bundleIncludes) {
    const images = [];
    if (product?.image_url) images.push(product.image_url);
    if (Array.isArray(bundleIncludes)) {
        for (const row of bundleIncludes) {
            if (row?.included?.image_url) images.push(row.included.image_url);
        }
    }
    return images;
}
