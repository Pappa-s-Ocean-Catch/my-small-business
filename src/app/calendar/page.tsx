"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { addDays, startOfWeek, endOfWeek, format, setHours, setMinutes } from "date-fns";
import { AdminGuard } from "@/components/AdminGuard";

type Staff = { id: string; name: string };
type Shift = { id: string; staff_id: string | null; start_time: string; end_time: string; notes: string | null };

const weekDays = (anchor: Date) => {
  const start = startOfWeek(anchor, { weekStartsOn: 1 }); // Mon
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
};

export default function CalendarPage() {
  const [anchor, setAnchor] = useState(new Date());
  const [days, setDays] = useState<Date[]>(weekDays(new Date()));
  const [staff, setStaff] = useState<Staff[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);

  useEffect(() => { setDays(weekDays(anchor)); }, [anchor]);

  const fetchData = useCallback(async (): Promise<void> => {
    const [{ data: staffData }, { data: shiftData }] = await Promise.all([
      getSupabaseClient().from("staff").select("id,name").order("name"),
      getSupabaseClient().from("shifts").select("*")
        .gte("start_time", startOfWeek(anchor, { weekStartsOn: 1 }).toISOString())
        .lte("end_time", endOfWeek(anchor, { weekStartsOn: 1 }).toISOString()),
    ]);
    setStaff((staffData as Staff[]) ?? []);
    setShifts((shiftData as Shift[]) ?? []);
  }, [anchor]);

  useEffect(() => { void fetchData(); }, [anchor, fetchData]);

  const dayShifts = (day: Date) => {
    const y = day.toISOString().slice(0, 10);
    return shifts.filter(s => s.start_time.slice(0, 10) === y);
  };

  const createShift = async (day: Date) => {
    const start = setMinutes(setHours(day, 9), 0);
    const end = setMinutes(setHours(day, 17), 0);
    await getSupabaseClient().from("shifts").insert({ start_time: start.toISOString(), end_time: end.toISOString(), staff_id: null });
    await fetchData();
  };

  const [edit, setEdit] = useState<Shift | null>(null);
  const updateShiftTime = async (s: Shift) => {
    await getSupabaseClient().from("shifts").update({ start_time: s.start_time, end_time: s.end_time, notes: s.notes }).eq("id", s.id);
    await fetchData();
  };

  const updateShiftStaff = async (shiftId: string, staffId: string | null) => {
    await getSupabaseClient().from("shifts").update({ staff_id: staffId }).eq("id", shiftId);
    await fetchData();
  };

  const removeShift = async (shiftId: string) => {
    await getSupabaseClient().from("shifts").delete().eq("id", shiftId);
    await fetchData();
  };

  return (
    <AdminGuard>
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Weekly schedule</h1>
          <p className="text-sm text-gray-500">Assign staff to shifts</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="h-10 px-3 rounded-xl border" onClick={() => setAnchor(addDays(anchor, -7))}>Prev</button>
          <button className="h-10 px-3 rounded-xl border" onClick={() => setAnchor(new Date())}>Today</button>
          <button className="h-10 px-3 rounded-xl border" onClick={() => setAnchor(addDays(anchor, 7))}>Next</button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-7 gap-3">
        {days.map((d) => (
          <div key={d.toISOString()} className="rounded-2xl border p-3 min-h-48 bg-white/60 dark:bg-black/20 backdrop-blur">
            <div className="flex items-center justify-between">
              <div className="font-medium">{format(d, "EEE dd MMM")}</div>
              <button className="text-xs rounded-lg border px-2 py-1" onClick={() => createShift(d)}>+ Shift</button>
            </div>
            <div className="mt-3 grid gap-2">
              {dayShifts(d).length === 0 ? (
                <div className="text-xs text-gray-500">No shifts</div>
              ) : (
                dayShifts(d).map((s) => (
                  <div key={s.id} className="rounded-xl border p-2 bg-white dark:bg-neutral-900">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium">
                        {format(new Date(s.start_time), "HH:mm")}–{format(new Date(s.end_time), "HH:mm")}
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="text-xs" onClick={() => setEdit(s)}>Edit</button>
                        <button className="text-xs text-red-600" onClick={() => removeShift(s.id)}>Delete</button>
                      </div>
                    </div>
                    <div className="mt-2">
                      <select className="w-full h-9 rounded-lg border bg-white/80 dark:bg-neutral-900" value={s.staff_id ?? ""} onChange={(e) => updateShiftStaff(s.id, e.target.value || null)}>
                        <option value="">Unassigned</option>
                        {staff.map((st) => (
                          <option key={st.id} value={st.id}>{st.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {edit && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm grid place-items-center p-4 z-50" onClick={() => setEdit(null)}>
          <div className="w-full max-w-md bg-white dark:bg-neutral-950 rounded-2xl border shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">Edit shift</h2>
            <form className="mt-4 grid gap-4" onSubmit={async (e) => { e.preventDefault(); await updateShiftTime(edit); setEdit(null); }}>
              <label className="grid gap-2">
                <span className="text-sm text-gray-600">Start</span>
                <input type="datetime-local" className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900" value={edit.start_time.slice(0,16)} onChange={(e) => setEdit({ ...edit, start_time: new Date(e.target.value).toISOString() })} />
              </label>
              <label className="grid gap-2">
                <span className="text-sm text-gray-600">End</span>
                <input type="datetime-local" className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900" value={edit.end_time.slice(0,16)} onChange={(e) => setEdit({ ...edit, end_time: new Date(e.target.value).toISOString() })} />
              </label>
              <label className="grid gap-2">
                <span className="text-sm text-gray-600">Notes</span>
                <textarea className="min-h-24 rounded-xl border px-3 py-2 bg-white/80 dark:bg-neutral-900" value={edit.notes ?? ""} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} />
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setEdit(null)} className="h-10 px-4 rounded-xl border">Cancel</button>
                <button className="h-10 px-4 rounded-xl bg-black text-white dark:bg-white dark:text-black">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </AdminGuard>
  );
}


