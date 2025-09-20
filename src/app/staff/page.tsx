"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { AdminGuard } from "@/components/AdminGuard";
import { ConfirmationDialog } from "@/components/ConfirmationDialog";
import { Loading } from "@/components/Loading";
import { Plus, Pencil, Trash2, X, Clock, Send, Calendar } from "lucide-react";
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

type StaffHoliday = {
  id: string;
  staff_id: string;
  start_date: string;
  end_date: string;
  notes: string | null;
};

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function StaffPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [staffRoles, setStaffRoles] = useState<StaffRole[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [holidays, setHolidays] = useState<StaffHoliday[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ staff: Staff | null; isOpen: boolean }>({ staff: null, isOpen: false });
  const [availabilityDeleteConfirm, setAvailabilityDeleteConfirm] = useState<{ availabilityId: string | null; isOpen: boolean }>({ availabilityId: null, isOpen: false });
  const [holidayDeleteConfirm, setHolidayDeleteConfirm] = useState<{ holidayId: string | null; isOpen: boolean }>({ holidayId: null, isOpen: false });

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
  const [activeTab, setActiveTab] = useState<'general' | 'rates' | 'instructions' | 'availability' | 'holidays'>("general");
  const [dayFilter, setDayFilter] = useState<number | null>(null); // null = show all, 1-7 = specific day

  const [availabilityForm, setAvailabilityForm] = useState({
    selected_days: [] as number[],
    start_time: "09:00",
    end_time: "17:00",
  });

  const [holidayForm, setHolidayForm] = useState({
    start_date: "",
    end_date: "",
    notes: "",
  });

  const fetchStaff = async () => {
    setLoading(true);
    const [{ data: staffData }, { data: availabilityData }, { data: rolesData }, { data: holidaysData }] = await Promise.all([
      getSupabaseClient().from("staff").select("*").order("created_at", { ascending: false }),
      getSupabaseClient().from("staff_availability").select("*"),
      getSupabaseClient().from("staff_roles").select("*").order("name"),
      getSupabaseClient().from("staff_holidays").select("*").order("start_date", { ascending: false })
    ]);
    if (staffData) setStaff(staffData as Staff[]);
    if (availabilityData) setAvailability(availabilityData as Availability[]);
    if (rolesData) setStaffRoles(rolesData as StaffRole[]);
    if (holidaysData) setHolidays(holidaysData as StaffHoliday[]);
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

    if (availabilityForm.selected_days.length === 0) {
      alert("Please select at least one day");
      return;
    }

    // Insert availability for each selected day
    const availabilityData = availabilityForm.selected_days.map(day => ({
      staff_id: staffId,
      day_of_week: day,
      start_time: availabilityForm.start_time,
      end_time: availabilityForm.end_time
    }));

    await getSupabaseClient().from("staff_availability").insert(availabilityData);
    await fetchStaff();
    setAvailabilityForm({ selected_days: [], start_time: "09:00", end_time: "17:00" });
  };

  const removeAvailability = async (id: string) => {
    await getSupabaseClient().from("staff_availability").delete().eq("id", id);
    await fetchStaff();
  };

  const addHoliday = async (staffId: string) => {
    if (!holidayForm.start_date || !holidayForm.end_date) {
      alert("Please select start and end dates");
      return;
    }

    const startDate = new Date(holidayForm.start_date);
    const endDate = new Date(holidayForm.end_date);
    
    if (endDate < startDate) {
      alert("End date must be after start date");
      return;
    }

    await getSupabaseClient().from("staff_holidays").insert({
      staff_id: staffId,
      start_date: holidayForm.start_date,
      end_date: holidayForm.end_date,
      notes: holidayForm.notes || null
    });
    
    setHolidayForm({ start_date: "", end_date: "", notes: "" });
    await fetchStaff();
  };

  const removeHoliday = async (id: string) => {
    await getSupabaseClient().from("staff_holidays").delete().eq("id", id);
    await fetchStaff();
  };

  const getStaffAvailability = (staffId: string) => {
    return availability.filter(a => a.staff_id === staffId);
  };

  const getStaffHolidays = (staffId: string) => {
    return holidays.filter(h => h.staff_id === staffId);
  };

  const getFilteredStaff = () => {
    if (dayFilter === null) {
      return staff;
    }
    
    return staff.filter(s => {
      // Check if staff has availability for the selected day
      const dayAvailability = availability.filter(a => 
        a.staff_id === s.id && a.day_of_week === dayFilter
      );
      
      // Check if staff is on holiday today (we'll use a sample date for the day filter)
      const today = new Date();
      const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const isOnHoliday = holidays.some(h => {
        const startDate = new Date(h.start_date);
        const endDate = new Date(h.end_date);
        // For simplicity, we'll check if today falls within any holiday period
        // In a real implementation, you might want to check against a specific date
        return today >= startDate && today <= endDate && h.staff_id === s.id;
      });
      
      return dayAvailability.length > 0 && !isOnHoliday;
    });
  };

  const getDayName = (dayNumber: number) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[dayNumber];
  };

  const formatTime = (time24: string) => {
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${hour12}:${minutes} ${ampm}`;
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

      {/* Day Filter */}
      <div className="mt-6">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter by day:</span>
          <button
            onClick={() => setDayFilter(null)}
            className={`px-3 py-1 text-sm rounded-lg transition-colors ${
              dayFilter === null
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            All Days
          </button>
          {[1, 2, 3, 4, 5, 6, 0].map(dayNum => (
            <button
              key={dayNum}
              onClick={() => setDayFilter(dayNum)}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                dayFilter === dayNum
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {getDayName(dayNum)}
            </button>
          ))}
        </div>
        {dayFilter !== null && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Showing staff available on {getDayName(dayFilter)} ({getFilteredStaff().length} staff)
          </p>
        )}
      </div>

      <div className="mt-6 space-y-4">
        {loading ? (
          <Loading message="Loading staff..." size="sm" />
        ) : getFilteredStaff().length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            {dayFilter === null ? "No staff yet" : `No staff available on ${getDayName(dayFilter)}`}
          </div>
        ) : (
          getFilteredStaff().map((s) => (
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
              
              {/* Display availability for quick overview */}
              {getStaffAvailability(s.id).length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Availability</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {getStaffAvailability(s.id).map((a) => (
                      <div key={a.id} className="bg-white dark:bg-neutral-900 rounded-lg p-2 text-sm">
                        <span>{DAYS[a.day_of_week]} {formatTime(a.start_time)} - {formatTime(a.end_time)}</span>
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
          <div className="w-full max-w-4xl bg-white dark:bg-neutral-950 rounded-2xl shadow-2xl p-0 max-h-[85vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-neutral-800">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{editing ? "Edit staff" : "Add staff"}</h2>
              <button type="button" onClick={() => setFormOpen(false)} className="h-8 w-8 rounded-lg inline-grid place-items-center hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors">
                <X className="size-4 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            
        {/* Modal Body */}
        <div className="max-h-[calc(85vh-80px)] overflow-y-auto overflow-x-hidden pb-5">
              <div className="px-6 sm:px-8 pt-6 sm:pt-8">
                <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-neutral-800 pb-4 mb-6">
                <button type="button" className={`px-3 py-2 text-sm border-b-2 ${activeTab==='general' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 dark:text-gray-300'}`} onClick={() => setActiveTab('general')}>General</button>
                <button type="button" className={`px-3 py-2 text-sm border-b-2 ${activeTab==='rates' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 dark:text-gray-300'}`} onClick={() => setActiveTab('rates')}>Rates</button>
                <button type="button" className={`px-3 py-2 text-sm border-b-2 ${activeTab==='instructions' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 dark:text-gray-300'}`} onClick={() => setActiveTab('instructions')}>Payment Instructions</button>
                <button type="button" className={`px-3 py-2 text-sm border-b-2 ${activeTab==='availability' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 dark:text-gray-300'}`} onClick={() => setActiveTab('availability')}>Availability</button>
                <button type="button" className={`px-3 py-2 text-sm border-b-2 ${activeTab==='holidays' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 dark:text-gray-300'}`} onClick={() => setActiveTab('holidays')}>Holidays</button>
                </div>
              </div>
            <form id="staff-form" onSubmit={submit} className="px-6 sm:px-8">
              <div className="grid gap-5">
                {activeTab === 'general' && (
                  <>
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
                      <span className="text-sm text-gray-700 dark:text-gray-300">Role</span>
                      <select className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900" value={form.role_slug} onChange={(e) => setForm((f) => ({ ...f, role_slug: e.target.value }))}>
                        {staffRoles.map((role) => (
                          <option key={role.slug} value={role.slug}>{role.name}</option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-2">
                      <span className="text-sm text-gray-700 dark:text-gray-300">Available</span>
                      <select className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900" value={form.is_available ? 'yes' : 'no'} onChange={(e) => setForm((f) => ({ ...f, is_available: e.target.value === 'yes' }))}>
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
                  </>
                )}
                {activeTab === 'rates' && (
                  <>
                    <label className="grid gap-2">
                      <span className="text-sm text-gray-700 dark:text-gray-300">Default Pay Rate</span>
                      <input type="number" step="0.01" className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900" value={form.default_rate} onChange={(e) => setForm((f) => ({ ...f, default_rate: parseFloat(e.target.value || '0') }))} />
                    </label>
                    <div className="grid gap-3">
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200">Weekday rates (optional overrides)</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
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
                  </>
                )}
                {activeTab === 'instructions' && (
                  <>
                    <div className="grid gap-3">
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200">Payment instructions</span>
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                          <label className="grid gap-1 text-xs sm:text-sm md:col-span-3">
                            <span>Label</span>
                            <input className="h-10 rounded-lg border px-3 bg-white dark:bg-neutral-900 min-w-0" value={instrDraft.label} onChange={(e) => setInstrDraft(d => ({ ...d, label: e.target.value }))} />
                          </label>
                          <label className="grid gap-1 text-xs sm:text-sm md:col-span-2">
                            <span>Adj/hr</span>
                            <input type="number" step="0.01" className="h-10 rounded-lg border px-3 bg-white dark:bg-neutral-900 min-w-0" value={instrDraft.adjustment_per_hour} onChange={(e) => setInstrDraft(d => ({ ...d, adjustment_per_hour: parseFloat(e.target.value || '0') }))} />
                          </label>
                          <label className="grid gap-1 text-xs sm:text-sm md:col-span-2">
                            <span>Cap (hrs)</span>
                            <input type="number" step="0.1" className="h-10 rounded-lg border px-3 bg-white dark:bg-neutral-900 min-w-0" value={instrDraft.weekly_hours_cap ?? ''} onChange={(e) => setInstrDraft(d => ({ ...d, weekly_hours_cap: e.target.value === '' ? null : parseFloat(e.target.value) }))} />
                          </label>
                          <label className="grid gap-1 text-xs sm:text-sm md:col-span-3">
                            <span>Payment method</span>
                            <input className="h-10 rounded-lg border px-3 bg-white dark:bg-neutral-900 min-w-0" value={instrDraft.payment_method ?? ''} onChange={(e) => setInstrDraft(d => ({ ...d, payment_method: e.target.value }))} />
                          </label>
                          <label className="grid gap-1 text-xs sm:text-sm md:col-span-2">
                            <span>Priority</span>
                            <input type="number" className="h-10 rounded-lg border px-3 bg-white dark:bg-neutral-900 min-w-0" value={instrDraft.priority} onChange={(e) => setInstrDraft(d => ({ ...d, priority: parseInt(e.target.value || '1') }))} />
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
                          <div className="p-4 bg-gray-50/30 dark:bg-neutral-800/20 rounded-lg">
                            <div className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-3">Current Payment Instructions</div>
                            <div className="space-y-2">
                              {instructions.sort((a,b) => a.priority - b.priority).map((ins, idx) => (
                                <div key={ins.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center bg-white dark:bg-neutral-900 rounded-lg p-3 text-sm border">
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
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {activeTab === 'availability' && (
                  <>
                    <div className="grid gap-3">
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200">Availability Management</span>
                      <p className="text-xs text-gray-500">Select multiple days and add the same time slot to all selected days. Minimum 2 hours per slot.</p>
                      
                      <div className="space-y-6">
                        {/* Days row */}
                        <div className="grid gap-3">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Select Days</span>
                          <div className="flex gap-4 p-4 bg-gray-50/50 dark:bg-neutral-800/30 rounded-lg">
                            {DAYS.map((day, i) => (
                              <label key={i} className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={availabilityForm.selected_days.includes(i)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setAvailabilityForm((f) => ({ 
                                        ...f, 
                                        selected_days: [...f.selected_days, i] 
                                      }));
                                    } else {
                                      setAvailabilityForm((f) => ({ 
                                        ...f, 
                                        selected_days: f.selected_days.filter(d => d !== i) 
                                      }));
                                    }
                                  }}
                                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                                />
                                <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">{day.substring(0, 3).toUpperCase()}</span>
                              </label>
                            ))}
                          </div>
                          <p className="text-xs text-gray-500">Check the days you want to add this availability to</p>
                        </div>

                        {/* Time inputs row */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <label className="grid gap-2">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Start time</span>
                            <input type="time" className="h-10 rounded-lg border px-3 bg-white dark:bg-neutral-900" value={availabilityForm.start_time} onChange={(e) => setAvailabilityForm((f) => ({ ...f, start_time: e.target.value }))} />
                          </label>
                          <label className="grid gap-2">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">End time</span>
                            <input type="time" className="h-10 rounded-lg border px-3 bg-white dark:bg-neutral-900" value={availabilityForm.end_time} onChange={(e) => setAvailabilityForm((f) => ({ ...f, end_time: e.target.value }))} />
                          </label>
                        </div>
                        
                        <button type="button" onClick={() => editing && addAvailability(editing.id)} className="h-10 px-4 rounded-lg bg-blue-600 text-white">
                          Add to {availabilityForm.selected_days.length} Selected Day{availabilityForm.selected_days.length !== 1 ? 's' : ''}
                        </button>
                      </div>

                      {/* Show existing availability */}
                      <div className="p-4 bg-gray-50/30 dark:bg-neutral-800/20 rounded-lg">
                        <div className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-3">Current Availability</div>
                        {editing && getStaffAvailability(editing.id).length === 0 ? (
                          <div className="text-xs text-gray-500">No availability set</div>
                        ) : (
                          <div className="space-y-2">
                            {editing && getStaffAvailability(editing.id).map((a) => (
                              <div key={a.id} className="flex items-center justify-between bg-gray-50 dark:bg-neutral-800 rounded-lg p-3 text-sm">
                                <div>
                                  <span className="font-medium">{DAYS[a.day_of_week]}</span>
                                  <span className="ml-2">{formatTime(a.start_time)} - {formatTime(a.end_time)}</span>
                                </div>
                                <button type="button" onClick={() => setAvailabilityDeleteConfirm({ availabilityId: a.id, isOpen: true })} className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded px-2 py-1">
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {activeTab === 'holidays' && (
                  <>
                    <div className="grid gap-3">
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200">Holiday Management</span>
                      <p className="text-xs text-gray-500">Add holiday periods when this staff member is unavailable for shifts.</p>
                      
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <label className="grid gap-2">
                            <span className="text-sm text-gray-700 dark:text-gray-300">Start date</span>
                            <input type="date" className="h-10 rounded-lg border px-3 bg-white dark:bg-neutral-900" value={holidayForm.start_date} onChange={(e) => setHolidayForm((f) => ({ ...f, start_date: e.target.value }))} />
                          </label>
                          <label className="grid gap-2">
                            <span className="text-sm text-gray-700 dark:text-gray-300">End date</span>
                            <input type="date" className="h-10 rounded-lg border px-3 bg-white dark:bg-neutral-900" value={holidayForm.end_date} onChange={(e) => setHolidayForm((f) => ({ ...f, end_date: e.target.value }))} />
                          </label>
                        </div>
                        <label className="grid gap-2">
                          <span className="text-sm text-gray-700 dark:text-gray-300">Notes (optional)</span>
                          <input type="text" placeholder="e.g., Vacation, Sick leave" className="h-10 rounded-lg border px-3 bg-white dark:bg-neutral-900" value={holidayForm.notes} onChange={(e) => setHolidayForm((f) => ({ ...f, notes: e.target.value }))} />
                        </label>
                        <button type="button" onClick={() => editing && addHoliday(editing.id)} className="h-10 px-4 rounded-lg bg-blue-600 text-white">Add Holiday</button>
                      </div>

                      {/* Show existing holidays */}
                      <div className="p-4 bg-gray-50/30 dark:bg-neutral-800/20 rounded-lg">
                        <div className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-3">Current Holidays</div>
                        {editing && getStaffHolidays(editing.id).length === 0 ? (
                          <div className="text-xs text-gray-500">No holidays set</div>
                        ) : (
                          <div className="space-y-2">
                            {editing && getStaffHolidays(editing.id).map((h) => (
                              <div key={h.id} className="flex items-center justify-between bg-gray-50 dark:bg-neutral-800 rounded-lg p-3 text-sm">
                                <div>
                                  <span className="font-medium">{new Date(h.start_date).toLocaleDateString()}</span>
                                  {h.start_date !== h.end_date && (
                                    <span> - {new Date(h.end_date).toLocaleDateString()}</span>
                                  )}
                                  {h.notes && <div className="text-xs text-gray-500 mt-1">{h.notes}</div>}
                                </div>
                                <button type="button" onClick={() => setHolidayDeleteConfirm({ holidayId: h.id, isOpen: true })} className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded px-2 py-1">
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </form>
            </div>
            
            {/* Modal Footer */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-neutral-800 bg-gray-50/50 dark:bg-neutral-900/50">
              <button type="button" onClick={() => setFormOpen(false)} className="h-10 px-4 rounded-lg border border-gray-300 dark:border-neutral-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors">Cancel</button>
              <button type="submit" form="staff-form" className="h-10 px-4 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors">Save</button>
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


      {/* Holiday Delete Confirmation */}
      <ConfirmationDialog
        isOpen={holidayDeleteConfirm.isOpen}
        onClose={() => setHolidayDeleteConfirm({ holidayId: null, isOpen: false })}
        onConfirm={async () => {
          if (holidayDeleteConfirm.holidayId) {
            await removeHoliday(holidayDeleteConfirm.holidayId);
            setHolidayDeleteConfirm({ holidayId: null, isOpen: false });
          }
        }}
        title="Remove Holiday"
        message="Are you sure you want to remove this holiday period?"
        confirmText="Remove"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
    </AdminGuard>
  );
}