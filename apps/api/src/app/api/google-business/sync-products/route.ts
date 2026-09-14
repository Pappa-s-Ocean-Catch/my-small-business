import { NextRequest, NextResponse } from 'next/server';
import { getGoogleBusinessProfileClient, formatProductForGoogleBusiness } from '@/lib/google-business-profile';
import { getSaleProducts } from '@/app/actions/sale-products';
import { getSaleCategories } from '@/app/actions/sale-products';

export async function POST(request: NextRequest) {
  try {
    const { locationId, tokens } = await request.json();

    if (!locationId) {
      return NextResponse.json(
        { error: 'Location ID is required' },
        { status: 400 }
      );
    }

    if (!tokens) {
      return NextResponse.json(
        { error: 'Authentication tokens are required' },
        { status: 401 }
      );
    }

    // Get products and categories from database
    const [productsResult, categoriesResult] = await Promise.all([
      getSaleProducts(),
      getSaleCategories()
    ]);

    if (productsResult.error) {
      return NextResponse.json(
        { error: `Failed to fetch products: ${productsResult.error}` },
        { status: 500 }
      );
    }

    if (categoriesResult.error) {
      return NextResponse.json(
        { error: `Failed to fetch categories: ${categoriesResult.error}` },
        { status: 500 }
      );
    }

    const products = productsResult.data || [];
    const categories = categoriesResult.data || [];

    // Create category mapping
    const categoryMap = new Map();
    categories.forEach(cat => {
      categoryMap.set(cat.id, cat.name);
    });

    // Set up Google Business Profile client
    const client = getGoogleBusinessProfileClient();
    client.setCredentials(tokens);

    // Sync products
    const syncResults = [];
    const errors = [];

    for (const product of products) {
      try {
        const categoryName = categoryMap.get(product.sale_category_id);
        const formattedProduct = formatProductForGoogleBusiness({
          ...product,
          category: categoryName
        });

        const result = await client.syncProduct(locationId, formattedProduct);
        syncResults.push({
          productId: product.id,
          productName: product.name,
          success: result.success,
          message: result.message,
          googleProductId: result.productId
        });
      } catch (error) {
        console.error(`Error syncing product ${product.name}:`, error);
        errors.push({
          productId: product.id,
          productName: product.name,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Synced ${syncResults.length} products`,
      results: syncResults,
      errors: errors,
      summary: {
        total: products.length,
        successful: syncResults.filter(r => r.success).length,
        failed: errors.length
      }
    });

  } catch (error) {
    console.error('Error syncing products:', error);
    return NextResponse.json(
      { error: 'Failed to sync products to Google Business Profile' },
      { status: 500 }
    );
  }
}
