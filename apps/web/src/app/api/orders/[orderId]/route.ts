import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@my-small-business/supabase/server";

// DELETE /api/orders/[orderId]


export async function DELETE(
    req: NextRequest,
    context: { params: Promise<{ orderId: string }> }
) {
    const params = await context.params;
    const orderId = params.orderId;
    if (!orderId) {
        return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
    }

    // Anonymous web checkout orders are created before the customer signs in, so
    // this narrowly scoped cancellation must not depend on an authenticated RLS session.
    const supabase = await createServiceRoleClient();
    // Fetch order to check status
    const { data: order, error: fetchError } = await supabase
        .from("orders")
        .select("id, order_status")
        .eq("id", orderId)
        .single();

    if (fetchError || !order) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.order_status !== "pending_online_payment") {
        return NextResponse.json({ error: "Order cannot be deleted" }, { status: 400 });
    }

    // Delete order
    const { error: deleteError } = await supabase
        .from("orders")
        .delete()
        .eq("id", orderId);

    if (deleteError) {
        return NextResponse.json({ error: "Failed to delete order" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
