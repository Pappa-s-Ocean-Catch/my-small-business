"use server";

import { createServiceRoleClient } from "@/lib/supabase/server";
import { dopplerSetSecret } from "@/lib/doppler";

export type SaveSupplierCredentialsParams = {
  currentUserId: string;
  supplierId: string;
  username: string;
  password: string;
};

export async function saveSupplierCredentials(params: SaveSupplierCredentialsParams): Promise<{ success: boolean; error?: string; secretRef?: string }> {
  try {
    const supabase = await createServiceRoleClient();

    if (!params.currentUserId) return { success: false, error: "User ID required" };

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role_slug")
      .eq("id", params.currentUserId)
      .single();

    if (profileError || !profile || profile.role_slug !== "admin") {
      return { success: false, error: "Admin access required" };
    }

    const { data: supplier, error: supplierErr } = await supabase
      .from("suppliers")
      .select("id, name")
      .eq("id", params.supplierId)
      .single();

    if (supplierErr || !supplier) {
      return { success: false, error: "Supplier not found" };
    }

    const project = process.env.DOPPLER_PROJECT || "my-small-business";
    const config = process.env.DOPPLER_CONFIG || "dev";
    // Doppler requires secret names to be [A-Z0-9_]. Sanitize supplier.id accordingly.
    const sanitizedId = String(supplier.id).toUpperCase().replace(/[^A-Z0-9_]/g, "_");
    const secretName = `SUPPLIER_${sanitizedId}_CREDENTIALS`;

    const value = JSON.stringify({ username: params.username, password: params.password });
    const setRes = await dopplerSetSecret({ project, config, name: secretName, value });
    if (!setRes.success) {
      return { success: false, error: setRes.error || "Failed to set secret in Doppler" };
    }

    const { error: upErr } = await supabase
      .from("suppliers")
      .update({ secret_ref: secretName })
      .eq("id", supplier.id);

    if (upErr) {
      return { success: false, error: upErr.message };
    }

    return { success: true, secretRef: secretName };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}


