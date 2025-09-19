"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { AdminGuard } from "@/components/AdminGuard";
import { ConfirmationDialog } from "@/components/ConfirmationDialog";
import { Loading } from "@/components/Loading";
import { Plus, Pencil, Trash2, X, Clock, Send } from "lucide-react";
import { toast } from 'react-toastify';

type Staff = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  pay_rate: number;
  default_rate: number | null;
  mon_rate: number | null;
  tue_rate: number | null;
  wed_rate: number | null;
  thu_rate: number | null;
  fri_rate: number | null;
  sat_rate: number | null;
  sun_rate: number | null;
  is_available: boolean;
  role_slug: string | null;
  description: string | null;
};

type StaffPaymentInstruction = {
  id: string;
  staff_id: string;
  label: string;
  adjustment_per_hour: number;
  weekly_hours_cap: number | null;
  payment_method: string | null;
  priority: number;
  active: boolean;
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
  const [availabilityDeleteConfirm, setAvailabilityDeleteConfirm] = useState<{ availabilityId: string | null; isOpen: boolean }>({ availabilityId: null, isOpen: false });

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    pay_rate: 0,
    default_rate: 0,
    mon_rate: "" as string | number,
    tue_rate: "" as string | number,
    wed_rate: "" as string | number,
    thu_rate: "" as string | number,
    fri_rate: "" as string | number,
    sat_rate: "" as string | number,
    sun_rate: "" as string | number,
    is_available: true,
    role_slug: "member",
    description: "",
  });

  const [instructions, setInstructions] = useState<StaffPaymentInstruction[]>([]);
  const [instrDraft, setInstrDraft] = useState<Omit<StaffPaymentInstruction, 'id' | 'staff_id'>>({
    label: "",
    adjustment_per_hour: 0,
    weekly_hours_cap: null,
    payment_method: "",
    priority: 1,
    active: true,
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
    setForm({ name: "", phone: "", email: "", pay_rate: 0, default_rate: 0, mon_rate: "", tue_rate: "", wed_rate: "", thu_rate: "", fri_rate: "", sat_rate: "", sun_rate: "", is_available: true, role_slug: "member", description: "" });
    setEditing(null);
    setInstructions([]);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (editing) {
      await supabase.from("staff").update({
        name: form.name,
        phone: form.phone || null,
        email: form.email || null,
        pay_rate: form.pay_rate,
        default_rate: form.default_rate,
        mon_rate: form.mon_rate === "" ? null : Number(form.mon_rate),
        tue_rate: form.tue_rate === "" ? null : Number(form.tue_rate),
        wed_rate: form.wed_rate === "" ? null : Number(form.wed_rate),
        thu_rate: form.thu_rate === "" ? null : Number(form.thu_rate),
        fri_rate: form.fri_rate === "" ? null : Number(form.fri_rate),
        sat_rate: form.sat_rate === "" ? null : Number(form.sat_rate),
        sun_rate: form.sun_rate === "" ? null : Number(form.sun_rate),
        is_available: form.is_available,
        role_slug: form.role_slug,
        description: form.description || null,
      }).eq("id", editing.id);
    } else {
      const { data: inserted } = await supabase.from("staff").insert({
        name: form.name,
        phone: form.phone || null,
        email: form.email || null,
        pay_rate: form.pay_rate,
        default_rate: form.default_rate,
        mon_rate: form.mon_rate === "" ? null : Number(form.mon_rate),
        tue_rate: form.tue_rate === "" ? null : Number(form.tue_rate),
        wed_rate: form.wed_rate === "" ? null : Number(form.wed_rate),
        thu_rate: form.thu_rate === "" ? null : Number(form.thu_rate),
        fri_rate: form.fri_rate === "" ? null : Number(form.fri_rate),
        sat_rate: form.sat_rate === "" ? null : Number(form.sat_rate),
        sun_rate: form.sun_rate === "" ? null : Number(form.sun_rate),
        is_available: form.is_available,
        role_slug: form.role_slug,
        description: form.description || null,
      }).select().single();
      if (inserted?.id && instructions.length > 0) {
        await supabase.from("staff_payment_instructions").insert(
          instructions.map(i => ({
            staff_id: inserted.id,
            label: i.label,
            adjustment_per_hour: i.adjustment_per_hour,
            weekly_hours_cap: i.weekly_hours_cap,
            payment_method: i.payment_method,
            priority: i.priority,
            active: i.active,
          }))
        );
      }
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
      default_rate: s.default_rate ?? s.pay_rate,
      mon_rate: s.mon_rate ?? "",
      tue_rate: s.tue_rate ?? "",
      wed_rate: s.wed_rate ?? "",
      thu_rate: s.thu_rate ?? "",
      fri_rate: s.fri_rate ?? "",
      sat_rate: s.sat_rate ?? "",
      sun_rate: s.sun_rate ?? "",
      is_available: s.is_available,
      role_slug: s.role_slug ?? "member",
      description: s.description ?? "",
    });
    // Load payment instructions for this staff
    void (async () => {
      const { data } = await getSupabaseClient().from("staff_payment_instructions").select("*").eq("staff_id", s.id).order("priority");
      setInstructions((data as StaffPaymentInstruction[]) || []);
    })();
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
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-start sm:items-center gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold">{s.name}</h3>
                      {s.role_slug && (
                        <span className="text-xs px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                          {staffRoles.find(r => r.slug === s.role_slug)?.name || s.role_slug}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-700 dark:text-gray-300 break-words">
                      {s.phone && <span>{s.phone}</span>}
                      {s.email && <span className="ml-2">{s.email}</span>}
                    </div>
                    <div className="text-sm text-gray-700 dark:text-gray-300">
                      ${s.pay_rate.toFixed(2)}/hr • {s.is_available ? <span className="text-green-600">Available</span> : <span className="text-red-600">Unavailable</span>}
                    </div>
                    {s.description && (
                      <div className="text-sm text-gray-500 mt-1 break-words">{s.description}</div>
                    )}
                  </div>
                </div>
                {/* Desktop actions */}
                <div className="hidden md:flex flex-wrap items-center gap-2">
                  <button onClick={() => setAvailabilityOpen(s.id)} className="h-9 px-3 rounded-lg border inline-flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-neutral-900">
                    <Clock className="size-4" /> Schedule
                  </button>
                  {s.email && (
                    <button
                      onClick={async () => {
                        const res = await fetch('/api/invitations/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: s.email }) });
                        const json = await res.json();
                        if (!json.success) {
                          toast.error(json.error || 'Failed to send invitation');
                        } else {
                          toast.success('Invitation email sent');
                        }
                      }}
                      className="h-9 px-3 rounded-lg border inline-flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-neutral-900 text-blue-600"
                      title="Send Invitation"
                    >
                      <Send className="size-4" /> Invite
                    </button>
                  )}
                  <button onClick={() => startEdit(s)} className="h-9 w-9 rounded-lg border inline-grid place-items-center hover:bg-gray-50 dark:hover:bg-neutral-900">
                    <Pencil className="size-4" />
                  </button>
                  <button onClick={() => handleDeleteStaff(s)} className="h-9 w-9 rounded-lg border inline-grid place-items-center hover:bg-gray-50 dark:hover:bg-neutral-900 text-red-600">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>

              {/* Mobile actions at bottom */}
              <div className="mt-4 grid grid-cols-2 gap-2 md:hidden">
                <button onClick={() => setAvailabilityOpen(s.id)} className="h-10 px-3 rounded-lg border inline-flex items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-neutral-900">
                  <Clock className="size-4" />
                  <span className="text-sm">Schedule</span>
                </button>
                {s.email ? (
                  <button
                    onClick={async () => {
                      const res = await fetch('/api/invitations/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: s.email }) });
                      const json = await res.json();
                      if (!json.success) {
                        toast.error(json.error || 'Failed to send invitation');
                      } else {
                        toast.success('Invitation email sent');
                      }
                    }}
                    className="h-10 px-3 rounded-lg border inline-flex items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-neutral-900 text-blue-600"
                  >
                    <Send className="size-4" />
                    <span className="text-sm">Invite</span>
                  </button>
                ) : (
                  <div className="h-10 px-3 rounded-lg border inline-flex items-center justify-center gap-2 opacity-50 cursor-not-allowed">
                    <Send className="size-4" />
                    <span className="text-sm">Invite</span>
                  </div>
                )}
                <button onClick={() => startEdit(s)} className="h-10 px-3 rounded-lg border inline-flex items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-neutral-900">
                  <Pencil className="size-4" />
                  <span className="text-sm">Edit</span>
                </button>
                <button onClick={() => handleDeleteStaff(s)} className="h-10 px-3 rounded-lg border inline-flex items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-neutral-900 text-red-600">
                  <Trash2 className="size-4" />
                  <span className="text-sm">Delete</span>
                </button>
              </div>
              
              {getStaffAvailability(s.id).length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Availability</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {getStaffAvailability(s.id).map((a) => (
                      <div key={a.id} className="flex items-center justify-between bg-white dark:bg-neutral-900 rounded-lg p-2 text-sm">
                        <span>{DAYS[a.day_of_week]} {a.start_time}-{a.end_time}</span>
                        <button onClick={() => setAvailabilityDeleteConfirm({ availabilityId: a.id, isOpen: true })} className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded p-1">
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
          <div className="w-full max-w-4xl bg-white dark:bg-neutral-950 rounded-2xl border shadow-xl p-6 sm:p-8 max-h-[85vh] overflow-y-auto overflow-x-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">{editing ? "Edit staff" : "Add staff"}</h2>
              <button type="button" onClick={() => setFormOpen(false)} className="h-8 w-8 rounded-lg border inline-grid place-items-center hover:bg-gray-50 dark:hover:bg-neutral-900">
                <X className="size-4" />
              </button>
            </div>
            <form onSubmit={submit} className="mt-4 grid gap-5">
              <label className="grid gap-2">
                <span className="text-sm text-gray-700 dark:text-gray-300">Name</span>
                <input className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
              </label>
              <label className="grid gap-2">
                <span className="text-sm text-gray-700 dark:text-gray-300">Phone</span>
                <input className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              </label>
              <label className="grid gap-2">
                <span className="text-sm text-gray-700 dark:text-gray-300">Email</span>
                <input type="email" className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              </label>
              <label className="grid gap-2">
                <span className="text-sm text-gray-700 dark:text-gray-300">Pay rate</span>
                <input type="number" step="0.01" className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900" value={form.pay_rate} onChange={(e) => setForm((f) => ({ ...f, pay_rate: parseFloat(e.target.value) }))} />
              </label>
              <div className="grid gap-3">
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">Weekday rates (optional overrides)</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <label className="grid gap-1 text-xs sm:text-sm">
                    <span>Default</span>
                    <input type="number" step="0.01" className="h-9 rounded-xl border px-2 bg-white/80 dark:bg-neutral-900 min-w-0" value={form.default_rate} onChange={(e) => setForm((f) => ({ ...f, default_rate: parseFloat(e.target.value || '0') }))} />
                  </label>
                  <label className="grid gap-1 text-xs sm:text-sm">
                    <span>Mon</span>
                    <input type="number" step="0.01" className="h-9 rounded-xl border px-2 bg-white/80 dark:bg-neutral-900 min-w-0" value={form.mon_rate} onChange={(e) => setForm((f) => ({ ...f, mon_rate: e.target.value }))} placeholder="" />
                  </label>
                  <label className="grid gap-1 text-xs sm:text-sm">
                    <span>Tue</span>
                    <input type="number" step="0.01" className="h-9 rounded-xl border px-2 bg-white/80 dark:bg-neutral-900 min-w-0" value={form.tue_rate} onChange={(e) => setForm((f) => ({ ...f, tue_rate: e.target.value }))} />
                  </label>
                  <label className="grid gap-1 text-xs sm:text-sm">
                    <span>Wed</span>
                    <input type="number" step="0.01" className="h-9 rounded-xl border px-2 bg-white/80 dark:bg-neutral-900 min-w-0" value={form.wed_rate} onChange={(e) => setForm((f) => ({ ...f, wed_rate: e.target.value }))} />
                  </label>
                  <label className="grid gap-1 text-xs sm:text-sm">
                    <span>Thu</span>
                    <input type="number" step="0.01" className="h-9 rounded-xl border px-2 bg-white/80 dark:bg-neutral-900 min-w-0" value={form.thu_rate} onChange={(e) => setForm((f) => ({ ...f, thu_rate: e.target.value }))} />
                  </label>
                  <label className="grid gap-1 text-xs sm:text-sm">
                    <span>Fri</span>
                    <input type="number" step="0.01" className="h-9 rounded-xl border px-2 bg-white/80 dark:bg-neutral-900 min-w-0" value={form.fri_rate} onChange={(e) => setForm((f) => ({ ...f, fri_rate: e.target.value }))} />
                  </label>
                  <label className="grid gap-1 text-xs sm:text-sm">
                    <span>Sat</span>
                    <input type="number" step="0.01" className="h-9 rounded-xl border px-2 bg-white/80 dark:bg-neutral-900 min-w-0" value={form.sat_rate} onChange={(e) => setForm((f) => ({ ...f, sat_rate: e.target.value }))} />
                  </label>
                  <label className="grid gap-1 text-xs sm:text-sm">
                    <span>Sun</span>
                    <input type="number" step="0.01" className="h-9 rounded-xl border px-2 bg-white/80 dark:bg-neutral-900 min-w-0" value={form.sun_rate} onChange={(e) => setForm((f) => ({ ...f, sun_rate: e.target.value }))} />
                  </label>
                </div>
                <p className="text-xs text-gray-500">Leave weekday fields empty to use the default rate.</p>
              </div>
              <div className="grid gap-3">
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">Payment instructions</span>
                <div className="rounded-xl border p-4 bg-white/60 dark:bg-neutral-900 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    <label className="grid gap-1 text-xs sm:text-sm md:col-span-3">
                      <span>Label</span>
                      <input className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900 min-w-0" value={instrDraft.label} onChange={(e) => setInstrDraft(d => ({ ...d, label: e.target.value }))} />
                    </label>
                    <label className="grid gap-1 text-xs sm:text-sm md:col-span-2">
                      <span>Adj/hr</span>
                      <input type="number" step="0.01" className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900 min-w-0" value={instrDraft.adjustment_per_hour} onChange={(e) => setInstrDraft(d => ({ ...d, adjustment_per_hour: parseFloat(e.target.value || '0') }))} />
                    </label>
                    <label className="grid gap-1 text-xs sm:text-sm md:col-span-2">
                      <span>Cap (hrs)</span>
                      <input type="number" step="0.1" className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900 min-w-0" value={instrDraft.weekly_hours_cap ?? ''} onChange={(e) => setInstrDraft(d => ({ ...d, weekly_hours_cap: e.target.value === '' ? null : parseFloat(e.target.value) }))} />
                    </label>
                    <label className="grid gap-1 text-xs sm:text-sm md:col-span-3">
                      <span>Payment method</span>
                      <input className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900 min-w-0" value={instrDraft.payment_method ?? ''} onChange={(e) => setInstrDraft(d => ({ ...d, payment_method: e.target.value }))} />
                    </label>
                    <label className="grid gap-1 text-xs sm:text-sm md:col-span-2">
                      <span>Priority</span>
                      <input type="number" className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900 min-w-0" value={instrDraft.priority} onChange={(e) => setInstrDraft(d => ({ ...d, priority: parseInt(e.target.value || '1') }))} />
                    </label>
                    <div className="flex items-center gap-3 md:col-span-2">
                      <label className="text-xs sm:text-sm inline-flex items-center gap-2">
                        <input type="checkbox" className="accent-blue-600" checked={instrDraft.active} onChange={(e) => setInstrDraft(d => ({ ...d, active: e.target.checked }))} /> Active
                      </label>
                    </div>
                    <div className="md:col-span-12">
                      <button type="button" onClick={() => setInstructions(list => [...list, { id: crypto.randomUUID(), staff_id: editing?.id || 'new', ...instrDraft } as StaffPaymentInstruction])} className="h-10 px-4 rounded-lg bg-blue-600 text-white">Add instruction</button>
                    </div>
                  </div>
                  {instructions.length === 0 ? (
                    <div className="text-xs text-gray-500">No instructions added.</div>
                  ) : (
                    <div className="space-y-2">
                      {instructions.sort((a,b) => a.priority - b.priority).map((ins, idx) => (
                        <div key={ins.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center bg-gray-50 dark:bg-neutral-800 rounded-lg p-3 text-sm">
                          <div className="md:col-span-3 font-medium">{ins.label}</div>
                          <div className="md:col-span-2">Adj/hr: {ins.adjustment_per_hour}</div>
                          <div className="md:col-span-2">Cap: {ins.weekly_hours_cap ?? '∞'}</div>
                          <div className="md:col-span-3">Method: {ins.payment_method ?? '-'}</div>
                          <div className="md:col-span-1">Prio: {ins.priority}</div>
                          <div className="md:col-span-1">{ins.active ? 'Active' : 'Inactive'}</div>
                          <div className="md:col-span-12 md:justify-self-end">
                            <button type="button" onClick={() => setInstructions(list => list.filter((_, i) => i !== idx))} className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded px-2 py-1">
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <label className="grid gap-2">
                <span className="text-sm text-gray-700 dark:text-gray-300">Role</span>
                <select className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900" value={form.role_slug} onChange={(e) => setForm((f) => ({ ...f, role_slug: e.target.value }))}>
                  {staffRoles.map((role) => (
                    <option key={role.slug} value={role.slug}>{role.name}</option>
                  ))}
                </select>
              </label>
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

      {/* Availability Delete Confirmation */}
      <ConfirmationDialog
        isOpen={availabilityDeleteConfirm.isOpen}
        onClose={() => setAvailabilityDeleteConfirm({ availabilityId: null, isOpen: false })}
        onConfirm={async () => {
          if (availabilityDeleteConfirm.availabilityId) {
            await removeAvailability(availabilityDeleteConfirm.availabilityId);
            setAvailabilityDeleteConfirm({ availabilityId: null, isOpen: false });
          }
        }}
        title="Remove Availability"
        message="Are you sure you want to remove this availability slot?"
        confirmText="Remove"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
    </AdminGuard>
  );
}