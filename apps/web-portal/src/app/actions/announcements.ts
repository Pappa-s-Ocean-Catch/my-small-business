"use server";

import { createServerSupabaseClient, createServiceRoleClient } from "@my-small-business/supabase/server";
import type { Announcement, AnnouncementUpsertInput } from "@my-small-business/types";

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

async function requireAdmin(serviceRoleClient: Awaited<ReturnType<typeof createServiceRoleClient>>, currentUserId: string): Promise<ActionResult<true>> {
  if (!currentUserId) return { success: false, error: "Current user ID required" };

  const { data: profile, error } = await serviceRoleClient
    .from("profiles")
    .select("role_slug")
    .eq("id", currentUserId)
    .single();

  if (error) return { success: false, error: error.message };
  if (!profile || profile.role_slug !== "admin") return { success: false, error: "Admin access required" };
  return { success: true, data: true };
}

export async function getActiveAnnouncements(): Promise<ActionResult<Announcement[]>> {
  try {
    const supabase = await createServerSupabaseClient();
    const nowIso = new Date().toISOString();

    // Use explicit filters instead of relying solely on RLS to avoid accidental overexposure.
    const { data, error } = await supabase
      .from("announcements")
      .select("*")
      .eq("status", "published")
      .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
      .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
      .order("priority", { ascending: false })
      .order("starts_at", { ascending: false });

    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as Announcement[] };
  } catch (e) {
    console.error("[getActiveAnnouncements] unexpected error", e);
    return { success: false, error: "Failed to fetch announcements" };
  }
}

export async function adminListAnnouncements(currentUserId: string): Promise<ActionResult<Announcement[]>> {
  try {
    const supabase = await createServiceRoleClient();
    const adminCheck = await requireAdmin(supabase, currentUserId);
    if (!adminCheck.success) return adminCheck;

    const { data, error } = await supabase
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as Announcement[] };
  } catch (e) {
    console.error("[adminListAnnouncements] unexpected error", e);
    return { success: false, error: "Failed to fetch announcements (admin)" };
  }
}

export async function adminUpsertAnnouncement(input: AnnouncementUpsertInput, currentUserId: string): Promise<ActionResult<Announcement>> {
  try {
    const supabase = await createServiceRoleClient();
    const adminCheck = await requireAdmin(supabase, currentUserId);
    if (!adminCheck.success) return adminCheck;

    if (!input.title?.trim()) return { success: false, error: "Title is required" };

    const payload: Partial<Announcement> & {
      id?: string;
      title: string;
      body: string | null;
      image_url: string | null;
      action_button_text: string | null;
      action_button_link: string | null;
      status: Announcement["status"];
      priority: number;
      starts_at: string | null;
      ends_at: string | null;
      created_by?: string;
      updated_by: string;
    } = {
      id: input.id,
      title: input.title.trim(),
      body: input.body ?? null,
      image_url: input.image_url ?? null,
      action_button_text: input.action_button_text ?? null,
      action_button_link: input.action_button_link ?? null,
      status: input.status,
      priority: input.priority ?? 0,
      starts_at: input.starts_at ?? null,
      ends_at: input.ends_at ?? null,
      updated_by: currentUserId,
    };

    if (!input.id) payload.created_by = currentUserId;

    const { data, error } = await supabase
      .from("announcements")
      .upsert(payload, { onConflict: "id" })
      .select("*")
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as Announcement };
  } catch (e) {
    console.error("[adminUpsertAnnouncement] unexpected error", e);
    return { success: false, error: "Failed to save announcement" };
  }
}

export async function adminDeleteAnnouncement(announcementId: string, currentUserId: string): Promise<ActionResult<true>> {
  try {
    const supabase = await createServiceRoleClient();
    const adminCheck = await requireAdmin(supabase, currentUserId);
    if (!adminCheck.success) return adminCheck;

    if (!announcementId) return { success: false, error: "Announcement ID required" };

    const { error } = await supabase.from("announcements").delete().eq("id", announcementId);
    if (error) return { success: false, error: error.message };
    return { success: true, data: true };
  } catch (e) {
    console.error("[adminDeleteAnnouncement] unexpected error", e);
    return { success: false, error: "Failed to delete announcement" };
  }
}

