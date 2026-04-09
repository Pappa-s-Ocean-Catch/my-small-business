"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminGuard } from "@/components/AdminGuard";
import { ConfirmationDialog } from "@/components/ConfirmationDialog";
import { Icon } from "@/components/Icon";
import { ImageUpload } from "@/components/ImageUpload";
import Modal from "@/components/Modal";
import { getSupabaseClient } from "@my-small-business/supabase/client";
import { adminDeleteAnnouncement, adminListAnnouncements, adminUpsertAnnouncement } from "@/app/actions/announcements";
import type { Announcement, AnnouncementStatus, AnnouncementUpsertInput } from "@my-small-business/types";
import { FaEdit, FaPlus, FaSave, FaTimes, FaTrash } from "react-icons/fa";

function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocalValue(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

const statusOptions: Array<{ value: AnnouncementStatus; label: string }> = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

type EditorState = {
  id?: string;
  title: string;
  body: string;
  image_url: string;
  action_button_text: string;
  action_button_link: string;
  status: AnnouncementStatus;
  priority: number;
  starts_at: string; // datetime-local
  ends_at: string; // datetime-local
};

const emptyEditor: EditorState = {
  title: "",
  body: "",
  image_url: "",
  action_button_text: "",
  action_button_link: "",
  status: "draft",
  priority: 0,
  starts_at: "",
  ends_at: "",
};

export default function AdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editor, setEditor] = useState<EditorState>(emptyEditor);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const sortedAnnouncements = useMemo(() => {
    return [...announcements].sort((a, b) => {
      if (a.status !== b.status) return a.status.localeCompare(b.status);
      if (b.priority !== a.priority) return b.priority - a.priority;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [announcements]);

  const load = async () => {
    setError(null);
    setLoading(true);
    try {
      const supa = getSupabaseClient();
      const { data: userRes, error: userErr } = await supa.auth.getUser();
      if (userErr) {
        setError(userErr.message);
        return;
      }
      const userId = userRes.user?.id;
      if (!userId) {
        setError("You must be logged in as admin.");
        return;
      }

      const res = await adminListAnnouncements(userId);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setAnnouncements(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const openCreate = () => {
    setEditor(emptyEditor);
    setEditorOpen(true);
  };

  const openEdit = (a: Announcement) => {
    setEditor({
      id: a.id,
      title: a.title,
      body: a.body ?? "",
      image_url: a.image_url ?? "",
      action_button_text: a.action_button_text ?? "",
      action_button_link: a.action_button_link ?? "",
      status: a.status,
      priority: a.priority ?? 0,
      starts_at: toDatetimeLocalValue(a.starts_at),
      ends_at: toDatetimeLocalValue(a.ends_at),
    });
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditor(emptyEditor);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const supa = getSupabaseClient();
      const { data: userRes, error: userErr } = await supa.auth.getUser();
      if (userErr) {
        setError(userErr.message);
        return;
      }
      const userId = userRes.user?.id;
      if (!userId) {
        setError("You must be logged in as admin.");
        return;
      }

      const input: AnnouncementUpsertInput = {
        id: editor.id,
        title: editor.title,
        body: editor.body || null,
        image_url: editor.image_url || null,
        action_button_text: editor.action_button_text || null,
        action_button_link: editor.action_button_link || null,
        status: editor.status,
        priority: editor.priority,
        starts_at: fromDatetimeLocalValue(editor.starts_at),
        ends_at: fromDatetimeLocalValue(editor.ends_at),
      };

      const res = await adminUpsertAnnouncement(input, userId);
      if (!res.success) {
        setError(res.error);
        return;
      }

      await load();
      closeEditor();
    } finally {
      setSaving(false);
    }
  };

  const askDelete = (a: Announcement) => {
    setDeleteTarget(a);
    setDeleteError(null);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const supa = getSupabaseClient();
      const { data: userRes, error: userErr } = await supa.auth.getUser();
      if (userErr) {
        setDeleteError(userErr.message);
        return;
      }
      const userId = userRes.user?.id;
      if (!userId) {
        setDeleteError("You must be logged in as admin.");
        return;
      }

      const res = await adminDeleteAnnouncement(deleteTarget.id, userId);
      if (!res.success) {
        setDeleteError(res.error);
        return;
      }

      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      await load();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AdminGuard>
      <div className="min-h-[80vh] p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Announcements</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Create announcements shown on the home page (time window + status).
              </p>
            </div>
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-black text-white dark:bg-white dark:text-black hover:opacity-90 transition"
            >
              <Icon icon={FaPlus} className="w-4 h-4" />
              New announcement
            </button>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-200">
              {error}
            </div>
          )}

          <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-900 dark:text-white">All announcements</div>
              <button
                onClick={load}
                className="text-sm px-3 py-1.5 rounded-md border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800 transition"
              >
                Refresh
              </button>
            </div>

            {loading ? (
              <div className="p-6 text-sm text-gray-600 dark:text-gray-400">Loading...</div>
            ) : sortedAnnouncements.length === 0 ? (
              <div className="p-6 text-sm text-gray-600 dark:text-gray-400">No announcements yet.</div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-neutral-800">
                {sortedAnnouncements.map((a) => (
                  <div key={a.id} className="p-5 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-semibold text-gray-900 dark:text-white truncate">{a.title}</div>
                        <span className="text-xs px-2 py-0.5 rounded-full border border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-gray-300">
                          {a.status}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full border border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-gray-300">
                          priority {a.priority}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                        {a.body || <span className="italic">No body</span>}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                        Window: {a.starts_at ? new Date(a.starts_at).toLocaleString() : "Any time"} →{" "}
                        {a.ends_at ? new Date(a.ends_at).toLocaleString() : "No end"}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => openEdit(a)}
                        className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800 transition text-sm"
                      >
                        <Icon icon={FaEdit} className="w-4 h-4" />
                        Edit
                      </button>
                      <button
                        onClick={() => askDelete(a)}
                        className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 transition text-sm text-red-700 dark:text-red-300"
                      >
                        <Icon icon={FaTrash} className="w-4 h-4" />
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <Modal
          isOpen={editorOpen}
          onClose={() => {
            if (saving) return;
            closeEditor();
          }}
          title={editor.id ? "Edit announcement" : "New announcement"}
          size="lg"
          bodyClassName="p-5 grid grid-cols-1 md:grid-cols-2 gap-4"
          footer={
            <div className="flex items-center justify-end gap-3 w-full">
              <button
                onClick={closeEditor}
                disabled={saving}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800 transition"
              >
                <Icon icon={FaTimes} className="w-4 h-4" />
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-black text-white dark:bg-white dark:text-black hover:opacity-90 transition"
              >
                <Icon icon={FaSave} className="w-4 h-4" />
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          }
        >
          <>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
                  <input
                    value={editor.title}
                    onChange={(e) => setEditor((s) => ({ ...s, title: e.target.value }))}
                    className="mt-1 w-full h-11 px-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                    placeholder="Announcement title"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Body</label>
                  <textarea
                    value={editor.body}
                    onChange={(e) => setEditor((s) => ({ ...s, body: e.target.value }))}
                    className="mt-1 w-full min-h-28 px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                    placeholder="Optional details"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Image URL</label>
                  <input
                    value={editor.image_url}
                    onChange={(e) => setEditor((s) => ({ ...s, image_url: e.target.value }))}
                    className="mt-1 w-full h-11 px-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                    placeholder="https://..."
                  />
                </div>

                <div className="md:col-span-2">
                  <ImageUpload
                    type="brand"
                    currentImageUrl={editor.image_url || undefined}
                    onImageChange={(url) => setEditor((s) => ({ ...s, image_url: url ?? "" }))}
                  />
                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-500">
                    Upload will set the URL automatically. You can also paste a URL above.
                  </div>
                </div>

                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Action button text</label>
                    <input
                      value={editor.action_button_text}
                      onChange={(e) => setEditor((s) => ({ ...s, action_button_text: e.target.value }))}
                      className="mt-1 w-full h-11 px-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                      placeholder="e.g. Order now"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Action link</label>
                    <input
                      value={editor.action_button_link}
                      onChange={(e) => setEditor((s) => ({ ...s, action_button_link: e.target.value }))}
                      className="mt-1 w-full h-11 px-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                      placeholder="/order (or https://...)"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                  <select
                    value={editor.status}
                    onChange={(e) => setEditor((s) => ({ ...s, status: e.target.value as AnnouncementStatus }))}
                    className="mt-1 w-full h-11 px-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                  >
                    {statusOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Priority</label>
                  <input
                    type="number"
                    value={editor.priority}
                    onChange={(e) => setEditor((s) => ({ ...s, priority: Number(e.target.value) }))}
                    className="mt-1 w-full h-11 px-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Start time</label>
                  <input
                    type="datetime-local"
                    value={editor.starts_at}
                    onChange={(e) => setEditor((s) => ({ ...s, starts_at: e.target.value }))}
                    className="mt-1 w-full h-11 px-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">End time</label>
                  <input
                    type="datetime-local"
                    value={editor.ends_at}
                    onChange={(e) => setEditor((s) => ({ ...s, ends_at: e.target.value }))}
                    className="mt-1 w-full h-11 px-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                  />
                </div>
          </>
        </Modal>

        <ConfirmationDialog
          isOpen={deleteDialogOpen}
          onClose={() => {
            if (deleting) return;
            setDeleteDialogOpen(false);
          }}
          onConfirm={confirmDelete}
          title="Delete announcement"
          message={`Delete "${deleteTarget?.title ?? "this announcement"}"? This cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          variant="danger"
          isLoading={deleting}
          error={deleteError}
        />
      </div>
    </AdminGuard>
  );
}

