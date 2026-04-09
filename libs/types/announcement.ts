export type AnnouncementStatus = "draft" | "published" | "archived";

export interface Announcement {
  id: string;
  title: string;
  body: string | null;
  image_url: string | null;
  action_button_text: string | null;
  action_button_link: string | null;
  status: AnnouncementStatus;
  priority: number;
  starts_at: string | null; // ISO datetime
  ends_at: string | null; // ISO datetime
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AnnouncementUpsertInput {
  id?: string;
  title: string;
  body?: string | null;
  image_url?: string | null;
  action_button_text?: string | null;
  action_button_link?: string | null;
  status: AnnouncementStatus;
  priority?: number;
  starts_at?: string | null;
  ends_at?: string | null;
}

