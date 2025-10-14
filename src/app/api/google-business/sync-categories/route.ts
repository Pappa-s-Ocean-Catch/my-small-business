import { NextRequest, NextResponse } from 'next/server';
import { getGoogleBusinessProfileClient, mapCategoryToGoogleBusiness } from '@/lib/google-business-profile';
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

    // Get categories from database
    const categoriesResult = await getSaleCategories();

    if (categoriesResult.error) {
      return NextResponse.json(
        { error: `Failed to fetch categories: ${categoriesResult.error}` },
        { status: 500 }
      );
    }

    const categories = categoriesResult.data || [];

    // Set up Google Business Profile client
    const client = getGoogleBusinessProfileClient();
    client.setCredentials(tokens);

    // Sync categories
    const syncResults = [];
    const errors = [];

    for (const category of categories) {
      try {
        const googleCategory = mapCategoryToGoogleBusiness(category.name);
        const categoryData = {
          name: category.name,
          description: category.description || undefined,
          parentCategory: category.parent_category_id ? 
            categories.find(c => c.id === category.parent_category_id)?.name : undefined
        };

        const result = await client.syncCategory(locationId, categoryData);
        syncResults.push({
          categoryId: category.id,
          categoryName: category.name,
          googleCategory: googleCategory,
          success: result.success,
          message: result.message,
          googleCategoryId: result.categoryId
        });
      } catch (error) {
        console.error(`Error syncing category ${category.name}:`, error);
        errors.push({
          categoryId: category.id,
          categoryName: category.name,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Synced ${syncResults.length} categories`,
      results: syncResults,
      errors: errors,
      summary: {
        total: categories.length,
        successful: syncResults.filter(r => r.success).length,
        failed: errors.length
      }
    });

  } catch (error) {
    console.error('Error syncing categories:', error);
    return NextResponse.json(
      { error: 'Failed to sync categories to Google Business Profile' },
      { status: 500 }
    );
  }
}
