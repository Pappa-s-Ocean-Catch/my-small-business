"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { addDays, startOfWeek, endOfWeek, format, setHours, setMinutes } from "date-fns";
import { ensureProfile } from "@/app/actions/profile";
import { FaEdit, FaTrash, FaRedo, FaChevronLeft, FaChevronRight, FaHome, FaChartBar } from "react-icons/fa";
import { CalendarToolbar } from "@/components/CalendarToolbar";
import { ConfirmationDialog } from "@/components/ConfirmationDialog";
import Link from "next/link";

type Staff = { id: string; name: string; pay_rate: number; email: string | null };
type Shift = { id: string; staff_id: string | null; start_time: string; end_time: string; notes: string | null };
type Availability = { id: string; staff_id: string; day_of_week: number; start_time: string; end_time: string };

const weekDays = (anchor: Date) => {
  const start = startOfWeek(anchor, { weekStartsOn: 1 }); // Mon
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
};

export default function CalendarPage() {
  const [anchor, setAnchor] = useState(new Date());
  const [days, setDays] = useState<Date[]>(weekDays(new Date()));
  const [staff, setStaff] = useState<Staff[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [assignmentModal, setAssignmentModal] = useState<{ shift: Shift; day: Date } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ shift: Shift | null; isOpen: boolean }>({ shift: null, isOpen: false });

  useEffect(() => { setDays(weekDays(anchor)); }, [anchor]);

  const fetchData = useCallback(async (): Promise<void> => {
    const [{ data: staffData }, { data: shiftData }, { data: availabilityData }] = await Promise.all([
      getSupabaseClient().from("staff").select("id,name,pay_rate,email").order("name"),
      getSupabaseClient().from("shifts").select("*")
        .gte("start_time", startOfWeek(anchor, { weekStartsOn: 1 }).toISOString())
        .lte("end_time", endOfWeek(anchor, { weekStartsOn: 1 }).toISOString()),
      getSupabaseClient().from("staff_availability").select("*"),
    ]);
    setStaff((staffData as Staff[]) ?? []);
    setShifts((shiftData as Shift[]) ?? []);
    setAvailability((availabilityData as Availability[]) ?? []);
  }, [anchor]);

  // Check if user is admin
  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
          setIsAdmin(false);
          return;
        }
        const ensureResult = await ensureProfile(user.id, user.email);
        if (!ensureResult.ok) {
          setIsAdmin(false);
          return;
        }
        // Now check the profile role
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role_slug")
          .eq("id", user.id)
          .maybeSingle();
        if (profileError) {
          setIsAdmin(false);
          return;
        }
        setIsAdmin(profile && profile.role_slug === "admin");
      } catch {
        setIsAdmin(false);
      }
    };
    void checkAdmin();
  }, []);

  useEffect(() => { void fetchData(); }, [anchor, fetchData]);

  const dayShifts = (day: Date) => {
    const y = day.toISOString().slice(0, 10);
    return shifts.filter(s => s.start_time.slice(0, 10) === y);
  };

  const getAvailableStaff = (day: Date) => {
    const dayOfWeek = day.getDay(); // 0=Sunday, 1=Monday, etc
    return staff.filter(s => {
      const staffAvailability = availability.filter(a => a.staff_id === s.id && a.day_of_week === dayOfWeek);
      return staffAvailability.length > 0;
    });
  };

  const getStaffAvailabilityForDay = (staffId: string, day: Date) => {
    const dayOfWeek = day.getDay();
    return availability.filter(a => a.staff_id === staffId && a.day_of_week === dayOfWeek);
  };

  const createShift = async (day: Date) => {
    const start = setMinutes(setHours(day, 9), 0);
    const end = setMinutes(setHours(day, 17), 0);
    const { data: newShift } = await getSupabaseClient().from("shifts").insert({ start_time: start.toISOString(), end_time: end.toISOString(), staff_id: null }).select().single();
    if (newShift) {
      setAssignmentModal({ shift: newShift, day });
    }
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

  const handleDeleteShift = (shift: Shift) => {
    setDeleteConfirm({ shift, isOpen: true });
  };

  const confirmDeleteShift = async () => {
    if (deleteConfirm.shift) {
      await removeShift(deleteConfirm.shift.id);
      setDeleteConfirm({ shift: null, isOpen: false });
    }
  };

  // Finance calculations
  const calculateShiftCost = (shift: Shift) => {
    if (!shift.staff_id) return 0;
    const staffMember = staff.find(s => s.id === shift.staff_id);
    if (!staffMember) return 0;
    
    const start = new Date(shift.start_time);
    const end = new Date(shift.end_time);
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    return hours * staffMember.pay_rate;
  };

  const getDailyTotal = (day: Date) => {
    return dayShifts(day).reduce((total, shift) => total + calculateShiftCost(shift), 0);
  };

  const getWeeklyTotal = () => {
    return days.reduce((total, day) => total + getDailyTotal(day), 0);
  };

  const isToday = (day: Date) => {
    const today = new Date();
    return day.toDateString() === today.toDateString();
  };

  if (isAdmin === null) {
    return <div className="p-6 text-center text-gray-500">Loading...</div>;
  }

  return (
    <div className="p-4 w-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Weekly Schedule ({format(days[0], "dd-MM-yyyy")} - {format(days[6], "dd-MM-yyyy")})
          </h1>
          <p className="text-xs text-gray-500">
            {isAdmin ? "Manage staff assignments and view costs" : "View your assigned shifts"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="h-8 px-3 rounded-lg border text-sm flex items-center gap-1 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors" onClick={() => setAnchor(addDays(anchor, -7))}>
            <FaChevronLeft className="w-3 h-3" />
            Prev
          </button>
          <button className="h-8 px-3 rounded-lg border text-sm flex items-center gap-1 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors" onClick={() => setAnchor(new Date())}>
            <FaHome className="w-3 h-3" />
            Today
          </button>
          <button className="h-8 px-3 rounded-lg border text-sm flex items-center gap-1 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors" onClick={() => setAnchor(addDays(anchor, 7))}>
            Next
            <FaChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Finance section for admins */}
      {isAdmin && (
        <div className="mt-4 rounded-xl border p-3 bg-white/60 dark:bg-black/20 backdrop-blur">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold">Weekly Finance</h2>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold">${getWeeklyTotal().toFixed(0)}</span>
              <Link 
                href="/reports" 
                className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                title="View detailed reports"
              >
                <FaChartBar className="w-3 h-3" />
                Reports
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {days.map((day) => (
              <div key={day.toISOString()} className={`text-center ${isToday(day) ? 'bg-blue-50 dark:bg-blue-900/20 rounded-lg p-1' : ''}`}>
                <div className={`text-xs ${isToday(day) ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-500'}`}>
                  {format(day, "EEE")}
                </div>
                <div className={`text-xs font-medium ${isToday(day) ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                  ${getDailyTotal(day).toFixed(0)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 grid grid-cols-7 gap-2">
        {days.map((d) => (
          <div key={d.toISOString()} className={`relative rounded-2xl border p-3 min-h-64 backdrop-blur ${
            isToday(d) 
              ? 'border-blue-300 bg-blue-50/60 dark:bg-blue-900/20 dark:border-blue-600' 
              : 'bg-white/60 dark:bg-black/20'
          }`}>
            <div className="flex items-center justify-between">
              <div className={`font-medium ${isToday(d) ? 'text-blue-700 dark:text-blue-300' : ''}`}>
                {format(d, "EEE dd MMM")}
                {isToday(d) && <span className="ml-1 text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded-full">Today</span>}
              </div>
              {isAdmin && (
                <button className="text-xs rounded-lg border px-2 py-1" onClick={() => createShift(d)}>+ Shift</button>
              )}
            </div>
            <div className="mt-3 grid gap-2">
              {isAdmin && getAvailableStaff(d).length > 0 && (
                <div className="text-xs text-gray-500 mb-2">
                  Available: {getAvailableStaff(d).map(s => s.name).join(", ")}
                </div>
              )}
              {dayShifts(d).length === 0 ? (
                <div className="text-xs text-gray-500">No shifts</div>
              ) : (
                dayShifts(d).map((s) => {
                  const assignedStaff = s.staff_id ? staff.find(st => st.id === s.staff_id) : null;
                  return (
                    <div key={s.id} className="rounded-lg border p-2 bg-white dark:bg-neutral-900">
                      <div className="flex items-center justify-between gap-1 mb-2">
                        <div className="text-xs font-medium">
                          {format(new Date(s.start_time), "HH:mm")}–{format(new Date(s.end_time), "HH:mm")}
                        </div>
                        {isAdmin && (
                          <div className="flex items-center gap-1">
                            <button className="text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded px-1" onClick={() => setEdit(s)} title="Edit shift">
                              <FaEdit />
                            </button>
                            <button className="text-xs hover:bg-red-100 dark:hover:bg-red-900/20 rounded px-1" onClick={() => handleDeleteShift(s)} title="Delete shift">
                              <FaTrash />
                            </button>
                          </div>
                        )}
                      </div>
                      
                      {/* Staff assignment display */}
                      <div>
                        {assignedStaff ? (
                          <div className="flex items-center justify-between bg-green-50 dark:bg-green-900/20 rounded p-1.5">
                            <div className="flex items-center gap-1 min-w-0">
                              <span className="text-xs font-medium truncate">{assignedStaff.name}</span>
                              {isAdmin && (
                                <span className="text-xs text-gray-500 whitespace-nowrap">
                                  ${calculateShiftCost(s).toFixed(0)}
                                </span>
                              )}
                            </div>
                            {isAdmin && (
                              <button 
                                className="text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded px-1"
                                onClick={() => setAssignmentModal({ shift: s, day: d })}
                                title="Reassign"
                              >
                                <FaRedo />
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center justify-between bg-gray-50 dark:bg-neutral-800 rounded p-1.5">
                            <span className="text-xs text-gray-500">Unassigned</span>
                            {isAdmin && (
                              <button 
                                className="text-xs bg-blue-600 text-white hover:bg-blue-700 rounded px-2 py-0.5"
                                onClick={() => setAssignmentModal({ shift: s, day: d })}
                              >
                                Assign
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            
            {/* Calendar Toolbar */}
            <CalendarToolbar 
              day={d} 
              shifts={dayShifts(d).map(shift => ({
                ...shift,
                staff: shift.staff_id ? staff.find(s => s.id === shift.staff_id) : null
              }))}
              isAdmin={isAdmin}
            />
          </div>
        ))}
      </div>

      {edit && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm grid place-items-center p-4 z-50" onClick={() => setEdit(null)}>
          <div className="w-full max-w-md bg-white dark:bg-neutral-950 rounded-2xl border shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">Edit shift</h2>
            <form className="mt-4 grid gap-4" onSubmit={async (e) => { e.preventDefault(); await updateShiftTime(edit); setEdit(null); }}>
              <label className="grid gap-2">
                <span className="text-sm text-gray-700 dark:text-gray-300">Start</span>
                <input type="datetime-local" className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900" value={edit.start_time.slice(0,16)} onChange={(e) => setEdit({ ...edit, start_time: new Date(e.target.value).toISOString() })} />
              </label>
              <label className="grid gap-2">
                <span className="text-sm text-gray-700 dark:text-gray-300">End</span>
                <input type="datetime-local" className="h-10 rounded-xl border px-3 bg-white/80 dark:bg-neutral-900" value={edit.end_time.slice(0,16)} onChange={(e) => setEdit({ ...edit, end_time: new Date(e.target.value).toISOString() })} />
              </label>
              <label className="grid gap-2">
                <span className="text-sm text-gray-700 dark:text-gray-300">Notes</span>
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

      {/* Assignment Modal */}
      {assignmentModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm grid place-items-center p-4 z-50" onClick={() => setAssignmentModal(null)}>
          <div className="w-full max-w-md bg-white dark:bg-neutral-950 rounded-2xl border shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">
              {assignmentModal.shift.staff_id ? "Reassign Staff" : "Assign Staff to Shift"}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {format(new Date(assignmentModal.shift.start_time), "HH:mm")} - {format(new Date(assignmentModal.shift.end_time), "HH:mm")} on {format(assignmentModal.day, "EEE, MMM dd")}
            </p>
            
            <div className="mt-4 space-y-2">
              {/* Option to unassign if currently assigned */}
              {assignmentModal.shift.staff_id && (
                <button
                  className="w-full p-3 rounded-lg border border-gray-200 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-left transition-colors"
                  onClick={() => {
                    updateShiftStaff(assignmentModal.shift.id, null);
                    setAssignmentModal(null);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-500">Unassign</div>
                      <div className="text-xs text-gray-400">Remove current assignment</div>
                    </div>
                    <div className="text-sm font-medium text-gray-400">$0.00</div>
                  </div>
                </button>
              )}
              
              {getAvailableStaff(assignmentModal.day).map((st) => {
                const staffAvail = getStaffAvailabilityForDay(st.id, assignmentModal.day);
                const isAvailable = staffAvail.some(a => {
                  const shiftStart = new Date(assignmentModal.shift.start_time).toTimeString().slice(0, 5);
                  const shiftEnd = new Date(assignmentModal.shift.end_time).toTimeString().slice(0, 5);
                  return shiftStart >= a.start_time && shiftEnd <= a.end_time;
                });
                const shiftCost = (() => {
                  const start = new Date(assignmentModal.shift.start_time);
                  const end = new Date(assignmentModal.shift.end_time);
                  const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                  return hours * st.pay_rate;
                })();
                
                return (
                  <button
                    key={st.id}
                    className={`w-full p-3 rounded-lg border text-left transition-colors ${
                      isAvailable 
                        ? "border-green-200 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30" 
                        : "border-orange-200 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30"
                    }`}
                    onClick={() => {
                      updateShiftStaff(assignmentModal.shift.id, st.id);
                      setAssignmentModal(null);
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{st.name}</div>
                        <div className="text-xs text-gray-500">
                          {isAvailable ? "✓ Available" : "⚠ Outside availability"}
                        </div>
                      </div>
                      <div className="text-sm font-medium">${shiftCost.toFixed(2)}</div>
                    </div>
                  </button>
                );
              })}
              
              {staff.filter(st => !getAvailableStaff(assignmentModal.day).some(ast => ast.id === st.id)).map((st) => {
                const shiftCost = (() => {
                  const start = new Date(assignmentModal.shift.start_time);
                  const end = new Date(assignmentModal.shift.end_time);
                  const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                  return hours * st.pay_rate;
                })();
                
                return (
                  <button
                    key={st.id}
                    className="w-full p-3 rounded-lg border border-gray-200 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-left transition-colors"
                    onClick={() => {
                      updateShiftStaff(assignmentModal.shift.id, st.id);
                      setAssignmentModal(null);
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{st.name}</div>
                        <div className="text-xs text-gray-500">Not available this day</div>
                      </div>
                      <div className="text-sm font-medium">${shiftCost.toFixed(2)}</div>
                    </div>
                  </button>
                );
              })}
            </div>
            
            <div className="flex justify-between gap-2 mt-4">
              <button 
                type="button" 
                onClick={async () => {
                  // If this is a newly created shift with no staff assigned, delete it
                  if (!assignmentModal.shift.staff_id) {
                    await removeShift(assignmentModal.shift.id);
                  }
                  setAssignmentModal(null);
                }} 
                className="h-10 px-4 rounded-xl border"
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={() => setAssignmentModal(null)} 
                className="h-10 px-4 rounded-xl bg-gray-600 text-white"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ shift: null, isOpen: false })}
        onConfirm={confirmDeleteShift}
        title="Delete Shift"
        message={`Are you sure you want to delete this shift? This action cannot be undone.${
          deleteConfirm.shift?.staff_id 
            ? ` The assigned staff member will be notified that their shift has been removed.`
            : ''
        }`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
}


