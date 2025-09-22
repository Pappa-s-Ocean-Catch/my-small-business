import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { generateCombos, ComboConstraints, ComboProduct } from '@/lib/google-genai';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const supabase = await createServiceRoleClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError) {
      console.error('Auth error:', userError);
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized - Invalid user' }, { status: 401 });
    }

    // Admin check per workspace rules
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role_slug')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Profile error:', profileError);
      return NextResponse.json({ error: 'Profile lookup failed' }, { status: 500 });
    }
    if (!profile || profile.role_slug !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const constraints: ComboConstraints = body?.constraints as ComboConstraints;
    if (!constraints || typeof constraints.numCombos !== 'number') {
      return NextResponse.json({ error: 'Invalid constraints' }, { status: 400 });
    }

    // Fetch products and their ingredients from DB (minimal fields to keep payload small)
    // Use sale_products and sale_product_ingredients to reflect menu items
    const { data: saleProducts, error: saleProductsError } = await supabase
      .from('sale_products')
      .select(`
        id, name, description, sale_price, image_url,
        sale_categories!sale_category_id(name),
        sub_category:sale_categories!sub_category_id(name)
      `)
      .eq('is_active', true)
      .limit(500);

    if (saleProductsError) {
      console.error('Sale products fetch error:', saleProductsError);
      return NextResponse.json({ error: 'Failed to fetch sale products' }, { status: 500 });
    }

    const saleProductIds = (saleProducts ?? []).map(p => p.id);
    const { data: saleIngredients, error: saleIngredientsError } = await supabase
      .from('sale_product_ingredients')
      .select(`sale_product_id, quantity_required, unit_of_measure, products!product_id(name)`) // join to base product name
      .in('sale_product_id', saleProductIds);

    if (saleIngredientsError) {
      console.error('Sale ingredients fetch error:', saleIngredientsError);
      return NextResponse.json({ error: 'Failed to fetch sale product ingredients' }, { status: 500 });
    }

    // removed old productsError branch

    type RawSaleProduct = {
      id: string;
      name: string;
      description?: string | null;
      sale_price?: number | null;
      image_url?: string | null;
      sale_categories?: { name?: string | null } | null;
      sub_category?: { name?: string | null } | null;
    };
    type RawSaleIngredient = {
      sale_product_id: string;
      quantity_required?: number | null;
      unit_of_measure?: string | null;
      products?: { name?: string | null } | null;
    };

    const productsLookup: Record<string, RawSaleIngredient[]> = {};
    (saleIngredients as RawSaleIngredient[] | null ?? []).forEach((ing) => {
      const arr = productsLookup[ing.sale_product_id] || (productsLookup[ing.sale_product_id] = []);
      arr.push(ing);
    });

    const imageMap: Record<string, string | undefined> = {};
    const priceMap: Record<string, number> = {};
    (saleProducts as RawSaleProduct[] | null ?? []).forEach((p) => {
      priceMap[p.id] = Number(p.sale_price ?? 0);
      imageMap[p.id] = p.image_url ?? undefined;
    });

    const products: ComboProduct[] = (saleProducts as RawSaleProduct[] | null ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description ?? undefined,
      categoryName: p.sub_category?.name || p.sale_categories?.name || undefined,
      price: Number(p.sale_price ?? 0),
      ingredients: (productsLookup[p.id] || []).map((ing) => ({
        name: ing.products?.name || 'Ingredient',
        quantity: ing.quantity_required ? `${ing.quantity_required} ${ing.unit_of_measure || ''}`.trim() : undefined,
      })),
    }));

    const result = await generateCombos({ constraints, products });
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // Enrich combos with original (non-discounted) total price based on saleProducts
    const combosWithTotals = (result.combos || []).map((c) => {
      const originalTotal = (c.items || []).reduce((sum, it) => {
        const unit = priceMap[it.productId] ?? 0;
        return sum + unit * it.quantity;
      }, 0);
      // enrich items with imageUrl
      const items = (c.items || []).map(it => ({
        ...it,
        imageUrl: imageMap[it.productId] || undefined,
      }));
      return { ...c, items, originalTotalPrice: originalTotal };
    });

    return NextResponse.json({ success: true, combos: combosWithTotals });
  } catch (error) {
    console.error('Generate combo error:', error);
    return NextResponse.json({ error: 'Failed to generate combos' }, { status: 500 });
  }
}


