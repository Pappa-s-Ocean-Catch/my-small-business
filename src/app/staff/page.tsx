"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { AdminGuard } from "@/components/AdminGuard";
import { ConfirmationDialog } from "@/components/ConfirmationDialog";
import { Loading } from "@/components/Loading";
import { Plus, Pencil, Trash2, X, Clock } from "lucide-react";

type Staff = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  pay_rate: number;
  is_available: boolean;
  role_slug: string | null;
  description: string | null;
};

type StaffRole = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
};

type Availability = {
  id: string;
  staff_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
};

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function StaffPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [staffRoles, setStaffRoles] = useState<StaffRole[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [availabilityOpen, setAvailabilityOpen] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ staff: Staff | null; isOpen: boolean }>({ staff: null, isOpen: false });

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    pay_rate: 0,
    is_available: true,
    role_slug: "member",
    description: "",
  });

  const [availabilityForm, setAvailabilityForm] = useState({
    day_of_week: 1,
    start_time: "09:00",
    end_time: "17:00",
  });

  const fetchStaff = async () => {
    setLoading(true);
    const [{ data: staffData }, { data: availabilityData }, { data: rolesData }] = await Promise.all([
      getSupabaseClient().from("staff").select("*").order("created_at", { ascending: false }),
      getSupabaseClient().from("staff_availability").select("*"),
      getSupabaseClient().from("staff_roles").select("*").order("name")
    ]);
    if (staffData) setStaff(staffData as Staff[]);
    if (availabilityData) setAvailability(availabilityData as Availability[]);
    if (rolesData) setStaffRoles(rolesData as StaffRole[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const resetForm = () => {
    setForm({ name: "", phone: "", email: "", pay_rate: 0, is_available: true, role_slug: "member", description: "" });
    setEditing(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) {
      await getSupabaseClient().from("staff").update(form).eq("id", editing.id);
    } else {
      await getSupabaseClient().from("staff").insert({ ...form, phone: form.phone || null, email: form.email || null });
    }
    await fetchStaff();
    setFormOpen(false);
    resetForm();
  };

  const startEdit = (s: Staff) => {
    setEditing(s);
    setForm({
      name: s.name,
      phone: s.phone ?? "",
      email: s.email ?? "",
      pay_rate: s.pay_rate,
      is_available: s.is_available,
      role_slug: s.role_slug ?? "member",
      description: s.description ?? "",
    });
    setFormOpen(true);
  };

  const remove = async (id: string) => {
    await getSupabaseClient().from("staff").delete().eq("id", id);
    await fetchStaff();
  };

  const handleDeleteStaff = (staff: Staff) => {
    setDeleteConfirm({ staff, isOpen: true });
  };

  const confirmDeleteStaff = async () => {
    if (deleteConfirm.staff) {
      await remove(deleteConfirm.staff.id);
      setDeleteConfirm({ staff: null, isOpen: false });
    }
  };

  const addAvailability = async (staffId: string) => {
    // Validate minimum 2-hour duration
    const start = new Date(`2000-01-01T${availabilityForm.start_time}`);
    const end = new Date(`2000-01-01T${availabilityForm.end_time}`);
    const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    
    if (durationHours < 2) {
      alert("Minimum availability duration is 2 hours");
      return;
    }

    await getSupabaseClient().from("staff_availability").insert({
      staff_id: staffId,
      day_of_week: availabilityForm.day_of_week,
      start_time: availabilityForm.start_time,
      end_time: availabilityForm.end_time,
    });
    await fetchStaff();
    setAvailabilityForm({ day_of_week: 1, start_time: "09:00", end_time: "17:00" });
  };

  const removeAvailability = async (id: string) => {
    await getSupabaseClient().from("staff_availability").delete().eq("id", id);
    await fetchStaff();
  };

  const getStaffAvailability = (staffId: string) => {
    return availability.filter(a => a.staff_id === staffId);
  };

  return (
    <AdminGuard>
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
          <p className="text-sm text-gray-500">Manage staff, pay rates, and availability</p>
        </div>
        <button onClick={() => { resetForm(); setFormOpen(true); }} className="h-10 px-4 rounded-xl bg-black text-white dark:bg-white dark:text-black inline-flex items-center gap-2">
          <Plus className="size-4" /> Add staff
        </button>
      </div>

      <div className="mt-6 space-y-4">
        {loading ? (
          <Loading message="Loading staff..." size="sm" />
        ) : staff.length === 0 ? (
          <div className="text-center text-gray-500 py-8">No staff yet</div>
        ) : (
          staff.map((s) => (
            <div key={s.id} className="rounded-2xl border p-6 bg-white/60 dark:bg-black/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{s.name}</h3>
                      {s.role_slug && (
                        <span className="text-xs px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                          {staffRoles.find(r => r.slug === s.role_slug)?.name || s.role_slug}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-700 dark:text-gray-300">
                      {s.phone && <span>{s.phone}</span>}
                      {s.email && <span className="ml-2">{s.email}</span>}
                    </div>
                    <div className="text-sm text-gray-700 dark:text-gray-300">
                      ${s.pay_rate.toFixed(2)}/hr • {s.is_available ? <span className="text-green-600">Available</span> : <span className="text-red-600">Unavailable</span>}
                    </div>
                    {s.description && (
                      <div className="text-sm text-gray-500 mt-1">{s.description}</div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setAvailabilityOpen(s.id)} className="h-9 px-3 rounded-lg border inline-flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-neutral-900">
                    <Clock className="size-4" /> Schedule
                  </button>
                  <button onClick={() => startEdit(s)} className="h-9 w-9 rounded-lg border inline-grid place-items-center hover:bg-gray-50 dark:hover:bg-neutral-900">
                    <Pencil className="size-4" />
                  </button>
                  <button onClick={() => handleDeleteStaff(s)} className="h-9 w-9 rounded-lg border inline-grid place-items-center hover:bg-gray-50 dark:hover:bg-neutral-900 text-red-600">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
              
              {getStaffAvailability(s.id).length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Availability</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {getStaffAvailability(s.id).map((a) => (
                      <div key={a.id} className="flex items-center justify-between bg-white dark:bg-neutral-900 rounded-lg p-2 text-sm">
                        <span>{DAYS[a.day_of_week]} {a.start_time}-{a.end_time}</span>
                        <button onClick={() => removeAvailability(a.id)} className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded p-1">
                          <X className="size-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {formOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm grid place-items-center p-4 z-50" onClick={() => setFormOpen(false)}>
          <div className="w-full max-w-2xl bg-white dark:bg-neutral-950 rounded-2xl border shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">{editing ? "Edit staff" : "Add staff"}</h2>
            <form onSubmit={submit} className="mt-4 grid gap-4">
              <label className="grid gap-2">
                <span className="text-sm text-gray-700 dark:text-gray-300">Name</span>
                <input className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="grid gap-2">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Phone</span>
                  <input className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Email</span>
                  <input type="email" className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <label className="grid gap-2">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Pay rate</span>
                  <input type="number" step="0.01" className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900" value={form.pay_rate} onChange={(e) => setForm((f) => ({ ...f, pay_rate: parseFloat(e.target.value) }))} />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Role</span>
                  <select className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900" value={form.role_slug} onChange={(e) => setForm((f) => ({ ...f, role_slug: e.target.value }))}>
                    {staffRoles.map((role) => (
                      <option key={role.slug} value={role.slug}>{role.name}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="grid gap-2">
                <span className="text-sm text-gray-700 dark:text-gray-300">Available</span>
                <select className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900" value={form.is_available ? "yes" : "no"} onChange={(e) => setForm((f) => ({ ...f, is_available: e.target.value === "yes" }))}>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </label>
              <label className="grid gap-2">
                <span className="text-sm text-gray-700 dark:text-gray-300">Description</span>
                <textarea 
                  className="min-h-24 rounded-xl border px-3 py-2 bg-white/80 dark:bg-neutral-900 resize-y" 
                  value={form.description} 
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} 
                  placeholder="Optional description about the staff member, their skills, responsibilities, etc."
                  rows={4}
                />
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setFormOpen(false)} className="h-10 px-4 rounded-xl border">Cancel</button>
                <button className="h-10 px-4 rounded-xl bg-black text-white dark:bg-white dark:text-black">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {availabilityOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm grid place-items-center p-4 z-50" onClick={() => setAvailabilityOpen(null)}>
          <div className="w-full max-w-lg bg-white dark:bg-neutral-950 rounded-2xl border shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">Add Availability</h2>
            <p className="text-sm text-gray-500 mt-1">Add multiple time slots for the same day. Minimum 2 hours per slot.</p>
            
            <form onSubmit={(e) => { e.preventDefault(); addAvailability(availabilityOpen); }} className="mt-4 grid gap-4">
              <label className="grid gap-2">
                <span className="text-sm text-gray-700 dark:text-gray-300">Day</span>
                <select className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900" value={availabilityForm.day_of_week} onChange={(e) => setAvailabilityForm((f) => ({ ...f, day_of_week: parseInt(e.target.value) }))}>
                  {DAYS.map((day, i) => (
                    <option key={i} value={i}>{day}</option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="grid gap-2">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Start time</span>
                  <input type="time" className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900" value={availabilityForm.start_time} onChange={(e) => setAvailabilityForm((f) => ({ ...f, start_time: e.target.value }))} />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm text-gray-700 dark:text-gray-300">End time</span>
                  <input type="time" className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900" value={availabilityForm.end_time} onChange={(e) => setAvailabilityForm((f) => ({ ...f, end_time: e.target.value }))} />
                </label>
              </div>
              <div className="flex justify-between gap-2">
                <button type="button" onClick={() => setAvailabilityOpen(null)} className="h-10 px-4 rounded-xl border">Close</button>
                <button type="button" onClick={() => addAvailability(availabilityOpen)} className="h-10 px-4 rounded-xl bg-blue-600 text-white">Add This Slot</button>
              </div>
            </form>
            
            {/* Show existing availability for this staff member */}
            <div className="mt-6 pt-4 border-t">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Current availability for {DAYS[availabilityForm.day_of_week]}</div>
              <div className="space-y-2">
                {getStaffAvailability(availabilityOpen).filter(a => a.day_of_week === availabilityForm.day_of_week).map((a) => (
                  <div key={a.id} className="flex items-center justify-between bg-gray-50 dark:bg-neutral-800 rounded-lg p-2 text-sm">
                    <span>{a.start_time} - {a.end_time}</span>
                    <button onClick={() => removeAvailability(a.id)} className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded p-1">
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
                {getStaffAvailability(availabilityOpen).filter(a => a.day_of_week === availabilityForm.day_of_week).length === 0 && (
                  <div className="text-sm text-gray-500">No availability set for this day</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ staff: null, isOpen: false })}
        onConfirm={confirmDeleteStaff}
        title="Delete Staff Member"
        message={`Are you sure you want to delete ${deleteConfirm.staff?.name}? This action cannot be undone and will remove all their availability settings and shift assignments.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
    </AdminGuard>
  );
}