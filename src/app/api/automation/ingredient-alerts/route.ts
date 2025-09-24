import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { verifyAutomationWebhook } from '@/lib/webhook-verification';

type ProductSummary = {
  id: string;
  name: string;
  total_units: number;
};

type IngredientRow = {
  product_id: string;
  quantity_required: number;
  products: ProductSummary | null;
};

type SaleProductRow = {
  id: string;
  name: string;
  warning_threshold_units: number | null;
  alert_threshold_units: number | null;
  is_active: boolean;
  sale_product_ingredients: IngredientRow[] | null;
};

export async function POST(request: NextRequest) {
  try {
    const verification = await verifyAutomationWebhook(request);
    if (!verification.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { schedule_id, job_type } = verification.body as { schedule_id: string; job_type: string };
    if (job_type !== 'ingredient_stock_notification') {
      return NextResponse.json({ error: 'Invalid job type' }, { status: 400 });
    }

    const supabase = await createServiceRoleClient();

    // Load active sale products with ingredients and current inventory units
    const { data: saleProducts, error: saleProductsError } = await supabase
      .from('sale_products')
      .select(`
        id, name, warning_threshold_units, alert_threshold_units, is_active,
        sale_product_ingredients: sale_product_ingredients (
          product_id, quantity_required,
          products: products (id, name, total_units)
        )
      `)
      .eq('is_active', true);

    if (saleProductsError) {
      console.error('Error fetching sale products:', saleProductsError);
      return NextResponse.json({ error: 'Failed to fetch sale products' }, { status: 500 });
    }

    let alertsCreated = 0;
    const results: Array<{ sale_product_id: string; buildable_units: number; missing_ingredients: Array<{ product_id: string; product_name: string; required: number; available: number }>; level: 'alert' | 'warning' | 'ok' }>
      = [];

    const typedSaleProducts: SaleProductRow[] = (saleProducts as unknown as SaleProductRow[]) || [];

    for (const sp of typedSaleProducts) {
      const ingredients: IngredientRow[] | null = sp.sale_product_ingredients;

      if (!ingredients || ingredients.length === 0) {
        continue;
      }

      // Compute max buildable units = min(floor(product.total_units / quantity_required))
      let buildableUnits = Number.MAX_SAFE_INTEGER;
      const missing: Array<{ product_id: string; product_name: string; required: number; available: number }>
        = [];

      for (const ing of ingredients) {
        const available = ing.products?.total_units ?? 0;
        const requiredPerUnit = ing.quantity_required;
        if (requiredPerUnit <= 0) continue;

        const maxUnitsForIngredient = Math.floor(available / requiredPerUnit);
        if (!isFinite(maxUnitsForIngredient)) continue;
        buildableUnits = Math.min(buildableUnits, maxUnitsForIngredient);

        if (available < requiredPerUnit) {
          missing.push({
            product_id: ing.products?.id || ing.product_id,
            product_name: ing.products?.name || 'Unknown',
            required: requiredPerUnit,
            available,
          });
        }
      }

      if (buildableUnits === Number.MAX_SAFE_INTEGER) buildableUnits = 0;

      const warningThreshold = sp.warning_threshold_units ?? null;
      const alertThreshold = sp.alert_threshold_units ?? null;

      let level: 'alert' | 'warning' | 'ok' = 'ok';
      if (alertThreshold !== null && buildableUnits <= alertThreshold) level = 'alert';
      else if (warningThreshold !== null && buildableUnits <= warningThreshold) level = 'warning';

      results.push({
        sale_product_id: sp.id,
        buildable_units: buildableUnits,
        missing_ingredients: missing,
        level,
      });

      if (level !== 'ok') {
        // Upsert an active notification (one per sale product, keep latest if unresolved)
        // Resolve old active and create a new one
        await supabase
          .from('ingredient_stock_notifications')
          .insert({
            sale_product_id: sp.id,
            buildable_units: buildableUnits,
            warning_threshold: warningThreshold,
            alert_threshold: alertThreshold,
            missing_ingredients: missing,
          });
        alertsCreated += 1;
      }
    }

    // Log execution
    await supabase.from('automation_logs').insert({
      schedule_id,
      job_type: 'ingredient_stock_notification',
      status: 'success',
      message: `Computed ingredient alerts for ${saleProducts?.length || 0} sale products; created ${alertsCreated} notifications`,
      details: { alertsCreated, results },
      executed_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, alertsCreated, results });
  } catch (error) {
    console.error('Ingredient alerts automation error:', error);
    try {
      const supabase = await createServiceRoleClient();
      await supabase.from('automation_logs').insert({
        schedule_id: 'unknown',
        job_type: 'ingredient_stock_notification',
        status: 'failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: { error: error instanceof Error ? error.stack : error },
        executed_at: new Date().toISOString(),
      });
    } catch {}
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


