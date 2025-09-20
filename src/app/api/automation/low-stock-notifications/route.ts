import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { Resend } from 'resend';
import { verifyAutomationWebhook } from '@/lib/webhook-verification';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    // Verify webhook signature and get parsed body
    const verification = await verifyAutomationWebhook(request);
    if (!verification.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { schedule_id, job_type } = verification.body as { schedule_id: string; job_type: string };

    if (job_type !== 'low_stock_notification') {
      return NextResponse.json({ error: 'Invalid job type' }, { status: 400 });
    }

    const supabase = await createServiceRoleClient();

    // Get low stock products
    const { data: lowStockProducts, error: productsError } = await supabase
      .from('products')
      .select(`
        id,
        name,
        sku,
        quantity_in_stock,
        reorder_level,
        alert_threshold,
        warning_threshold,
        category:category_id (name),
        supplier:supplier_id (name, email)
      `)
      .or('quantity_in_stock.lte.reorder_level,quantity_in_stock.lte.alert_threshold');

    if (productsError) {
      console.error('Error fetching low stock products:', productsError);
      return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
    }

    if (!lowStockProducts || lowStockProducts.length === 0) {
      // No low stock products, log success
      await supabase.from('automation_logs').insert({
        schedule_id,
        job_type: 'low_stock_notification',
        status: 'success',
        message: 'No low stock products found',
        details: { total_products: 0 },
        executed_at: new Date().toISOString(),
      });

      return NextResponse.json({
        success: true,
        message: 'No low stock products found',
        results: [],
      });
    }

    // Get admin emails
    const { data: admins, error: adminsError } = await supabase
      .from('profiles')
      .select('email')
      .eq('role_slug', 'admin');

    if (adminsError) {
      console.error('Error fetching admin emails:', adminsError);
      return NextResponse.json({ error: 'Failed to fetch admin emails' }, { status: 500 });
    }

    const adminEmails = admins?.map(admin => admin.email).filter(Boolean) || [];

    if (adminEmails.length === 0) {
      return NextResponse.json({ error: 'No admin emails found' }, { status: 500 });
    }

    // Prepare email content
    const alertProducts = lowStockProducts.filter(p => p.quantity_in_stock <= (p.alert_threshold || 0));
    const warningProducts = lowStockProducts.filter(p => 
      p.quantity_in_stock > (p.alert_threshold || 0) && 
      p.quantity_in_stock <= (p.warning_threshold || p.reorder_level)
    );

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">🚨 Low Stock Alert - OperateFlow</h2>
        
        ${alertProducts.length > 0 ? `
          <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <h3 style="color: #dc2626; margin: 0 0 12px 0;">🔴 Critical Alert (${alertProducts.length} products)</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background-color: #fee2e2;">
                  <th style="padding: 8px; text-align: left; border: 1px solid #fecaca;">Product</th>
                  <th style="padding: 8px; text-align: left; border: 1px solid #fecaca;">SKU</th>
                  <th style="padding: 8px; text-align: left; border: 1px solid #fecaca;">Current Stock</th>
                  <th style="padding: 8px; text-align: left; border: 1px solid #fecaca;">Alert Level</th>
                </tr>
              </thead>
              <tbody>
                ${alertProducts.map(product => `
                  <tr>
                    <td style="padding: 8px; border: 1px solid #fecaca;">${product.name}</td>
                    <td style="padding: 8px; border: 1px solid #fecaca;">${product.sku || 'N/A'}</td>
                    <td style="padding: 8px; border: 1px solid #fecaca; color: #dc2626; font-weight: bold;">${product.quantity_in_stock}</td>
                    <td style="padding: 8px; border: 1px solid #fecaca;">${product.alert_threshold || 'N/A'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}

        ${warningProducts.length > 0 ? `
          <div style="background-color: #fffbeb; border: 1px solid #fed7aa; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <h3 style="color: #d97706; margin: 0 0 12px 0;">🟡 Warning (${warningProducts.length} products)</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background-color: #fef3c7;">
                  <th style="padding: 8px; text-align: left; border: 1px solid #fed7aa;">Product</th>
                  <th style="padding: 8px; text-align: left; border: 1px solid #fed7aa;">SKU</th>
                  <th style="padding: 8px; text-align: left; border: 1px solid #fed7aa;">Current Stock</th>
                  <th style="padding: 8px; text-align: left; border: 1px solid #fed7aa;">Warning Level</th>
                </tr>
              </thead>
              <tbody>
                ${warningProducts.map(product => `
                  <tr>
                    <td style="padding: 8px; border: 1px solid #fed7aa;">${product.name}</td>
                    <td style="padding: 8px; border: 1px solid #fed7aa;">${product.sku || 'N/A'}</td>
                    <td style="padding: 8px; border: 1px solid #fed7aa; color: #d97706; font-weight: bold;">${product.quantity_in_stock}</td>
                    <td style="padding: 8px; border: 1px solid #fed7aa;">${product.warning_threshold || product.reorder_level || 'N/A'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}

        <div style="margin-top: 24px; padding: 16px; background-color: #f3f4f6; border-radius: 8px;">
          <p style="margin: 0; color: #6b7280;">
            Please review your inventory and consider placing orders for these products.
            <br><br>
            <a href="${process.env.NEXT_PUBLIC_SITE_URL}/shop/inventory" style="color: #3b82f6; text-decoration: none;">
              View Inventory Dashboard →
            </a>
          </p>
        </div>
      </div>
    `;

    // Send email to all admins
    const emailResults = [];
    for (const adminEmail of adminEmails) {
      try {
        const result = await resend.emails.send({
          from: process.env.EMAIL_FROM!,
          to: [adminEmail],
          subject: `Low Stock Alert - ${alertProducts.length} Critical, ${warningProducts.length} Warning`,
          html: emailHtml,
        });

        emailResults.push({
          email: adminEmail,
          success: true,
          message_id: result.data?.id,
        });
      } catch (error) {
        console.error('Error sending low stock email:', error);
        emailResults.push({
          email: adminEmail,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Log the automation execution
    await supabase.from('automation_logs').insert({
      schedule_id,
      job_type: 'low_stock_notification',
      status: 'success',
      message: `Sent notifications for ${lowStockProducts.length} low stock products`,
      details: { 
        total_products: lowStockProducts.length,
        alert_products: alertProducts.length,
        warning_products: warningProducts.length,
        email_results: emailResults,
      },
      executed_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: `Processed ${lowStockProducts.length} low stock products`,
      results: {
        total_products: lowStockProducts.length,
        alert_products: alertProducts.length,
        warning_products: warningProducts.length,
        email_results: emailResults,
      },
    });

  } catch (error) {
    console.error('Low stock notification automation error:', error);
    
    // Log the error
    try {
      const supabase = await createServiceRoleClient();
      await supabase.from('automation_logs').insert({
        schedule_id: 'unknown',
        job_type: 'low_stock_notification',
        status: 'failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: { error: error instanceof Error ? error.stack : error },
        executed_at: new Date().toISOString(),
      });
    } catch (logError) {
      console.error('Failed to log automation error:', logError);
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
