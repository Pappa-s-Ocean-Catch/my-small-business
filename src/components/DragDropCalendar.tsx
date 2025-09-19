"use client";

import { useState, useCallback } from "react";
import { 
  DndContext, 
  DragEndEvent, 
  DragOverlay, 
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter
} from "@dnd-kit/core";
import { 
  SortableContext, 
  verticalListSortingStrategy,
  arrayMove,
  useSortable
} from "@dnd-kit/sortable";
import { 
  CSS 
} from "@dnd-kit/utilities";
import { format, addDays, startOfWeek, endOfWeek, isToday, isSameDay } from "date-fns";
import { FaEdit, FaTrash, FaRedo, FaChevronLeft, FaChevronRight, FaHome, FaChartBar, FaPlus } from "react-icons/fa";
import { CalendarToolbar } from "@/components/CalendarToolbar";
import { ConfirmationDialog } from "@/components/ConfirmationDialog";
import Link from "next/link";

type Staff = { id: string; name: string; pay_rate: number; email: string | null };
type Shift = { id: string; staff_id: string | null; start_time: string; end_time: string; notes: string | null; non_billable_hours?: number };
type Availability = { id: string; staff_id: string; day_of_week: number; start_time: string; end_time: string };

interface DragDropCalendarProps {
  shifts: Shift[];
  staff: Staff[];
  availability: Availability[];
  isAdmin: boolean;
  onShiftCreate: (shift: Omit<Shift, 'id'>) => Promise<void>;
  onShiftUpdate: (id: string, updates: Partial<Shift>) => Promise<void>;
  onShiftDelete: (id: string) => Promise<void>;
  onShiftStaffUpdate: (shiftId: string, staffId: string | null) => Promise<void>;
  currentWeek: Date;
  onWeekChange: (week: Date) => void;
}

interface DraggableShiftProps {
  shift: Shift;
  staff: Staff | null;
  isAdmin: boolean;
  onEdit: (shift: Shift) => void;
  onDelete: (shift: Shift) => void;
  onAssign: (shift: Shift) => void;
}

function DraggableShift({ shift, staff, isAdmin, onEdit, onDelete, onAssign }: DraggableShiftProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: shift.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="rounded-lg border p-2 bg-white dark:bg-neutral-800 border-gray-200 dark:border-neutral-600 cursor-move hover:shadow-md transition-shadow"
    >
      <div className="text-xs">
        <div className="font-medium text-gray-900 dark:text-white">
          {shift.start_time.slice(11, 16)} - {shift.end_time.slice(11, 16)}
        </div>
        {staff && (
          <div className="text-gray-600 dark:text-gray-400">
            {staff.name}
          </div>
        )}
        {!staff && (
          <div className="text-orange-600 dark:text-orange-400">
            Unassigned
          </div>
        )}
        {typeof shift.non_billable_hours === 'number' && shift.non_billable_hours > 0 && (
          <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">Non-bill: {shift.non_billable_hours}h</div>
        )}
        {shift.notes && (
          <div className="text-gray-500 dark:text-gray-500 text-xs mt-1">
            {shift.notes}
          </div>
        )}
      </div>
      
      {isAdmin && (
        <div className="flex gap-1 mt-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(shift);
            }}
            className="p-1 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900 rounded"
            title="Edit shift"
          >
            <FaEdit className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAssign(shift);
            }}
            className="p-1 text-green-600 hover:bg-green-100 dark:hover:bg-green-900 rounded"
            title="Assign staff"
          >
            <FaRedo className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(shift);
            }}
            className="p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900 rounded"
            title="Delete shift"
          >
            <FaTrash className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}

interface DayColumnProps {
  day: Date;
  shifts: Shift[];
  staff: Staff[];
  isAdmin: boolean;
  onShiftCreate: (day: Date) => void;
  onShiftEdit: (shift: Shift) => void;
  onShiftDelete: (shift: Shift) => void;
  onShiftAssign: (shift: Shift) => void;
}

function DayColumn({ day, shifts, staff, isAdmin, onShiftCreate, onShiftEdit, onShiftDelete, onShiftAssign }: DayColumnProps) {
  const dayShifts = shifts.filter(shift => isSameDay(new Date(shift.start_time), day));
  const today = isToday(day);

  return (
    <div className={`flex-1 min-h-64 p-3 rounded-lg border relative pb-12 ${
      today 
        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' 
        : 'bg-white dark:bg-neutral-800 border-gray-200 dark:border-neutral-700'
    }`}>
      {/* Day Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className={`font-semibold ${today ? 'text-blue-900 dark:text-blue-100' : 'text-gray-900 dark:text-white'}`}>
            {format(day, 'EEE')}
          </h3>
          <p className={`text-sm ${today ? 'text-blue-700 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400'}`}>
            {format(day, 'MMM d')}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => onShiftCreate(day)}
            className="p-2 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900 rounded-lg transition-colors"
            title="Add shift"
          >
            <FaPlus className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Shifts */}
      <SortableContext items={dayShifts.map(s => s.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {dayShifts.map((shift) => {
            const shiftStaff = staff.find(s => s.id === shift.staff_id) || null;
            return (
              <DraggableShift
                key={shift.id}
                shift={shift}
                staff={shiftStaff}
                isAdmin={isAdmin}
                onEdit={onShiftEdit}
                onDelete={onShiftDelete}
                onAssign={onShiftAssign}
              />
            );
          })}
        </div>
      </SortableContext>

      {/* Empty State */}
      {dayShifts.length === 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <p className="text-sm">No shifts</p>
        </div>
      )}

      {/* Calendar Toolbar */}
      {isAdmin && (
        <CalendarToolbar 
          day={day} 
          shifts={dayShifts.map(s => ({
            id: s.id,
            staff_id: s.staff_id,
            start_time: s.start_time,
            end_time: s.end_time,
            staff: s.staff_id ? (() => {
              const found = staff.find(st => st.id === s.staff_id);
              return found ? { name: found.name, email: found.email } : null;
            })() : null
          }))} 
          isAdmin={isAdmin} 
        />
      )}
    </div>
  );
}

export function DragDropCalendar({
  shifts,
  staff,
  availability,
  isAdmin,
  onShiftCreate,
  onShiftUpdate,
  onShiftDelete,
  onShiftStaffUpdate,
  currentWeek,
  onWeekChange
}: DragDropCalendarProps) {
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [editForm, setEditForm] = useState<{ start: string; end: string; notes: string; nonbill: string }>({ start: "", end: "", notes: "", nonbill: "0" });
  const [deleteConfirm, setDeleteConfirm] = useState<{ shift: Shift | null; isOpen: boolean }>({ shift: null, isOpen: false });
  const [assignmentModal, setAssignmentModal] = useState<{ shift: Shift | null; isOpen: boolean }>({ shift: null, isOpen: false });
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const startOfThisWeek = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startOfThisWeek, i));

  // Finance helpers (admin only)
  const calculateShiftCost = useCallback((shift: Shift): number => {
    if (!shift.staff_id) return 0;
    const s = staff.find(st => st.id === shift.staff_id);
    if (!s) return 0;
    const start = new Date(shift.start_time);
    const end = new Date(shift.end_time);
    const rawHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    const nonbill = Number(shift.non_billable_hours || 0);
    const hours = Math.max(0, rawHours - nonbill);
    return Math.max(0, hours) * (s.pay_rate || 0);
  }, [staff]);

  const getDailyTotal = useCallback((day: Date): number => {
    const dayKey = day.toISOString().slice(0, 10);
    return shifts
      .filter(s => s.start_time.slice(0, 10) === dayKey)
      .reduce((sum, s) => sum + calculateShiftCost(s), 0);
  }, [shifts, calculateShiftCost]);

  const getWeeklyTotal = useCallback((): number => {
    return weekDays.reduce((sum, d) => sum + getDailyTotal(d), 0);
  }, [weekDays, getDailyTotal]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) {
      setActiveId(null);
      return;
    }

    // Find the source shift
    const sourceShift = shifts.find(s => s.id === active.id);
    if (!sourceShift) {
      setActiveId(null);
      return;
    }

    // Determine the target day based on the drop zone
    // For now, we'll implement a simple version that moves shifts within the same day
    // In a more advanced implementation, you could detect which day column the shift was dropped on
    
    setActiveId(null);
  };

  const handleShiftCreate = useCallback((day: Date) => {
    const defaultStartTime = "09:00";
    const defaultEndTime = "17:00";
    
    const newShift: Omit<Shift, 'id'> = {
      staff_id: null,
      start_time: `${format(day, 'yyyy-MM-dd')}T${defaultStartTime}`,
      end_time: `${format(day, 'yyyy-MM-dd')}T${defaultEndTime}`,
      notes: null
    };

    void onShiftCreate(newShift);
  }, [onShiftCreate]);

  const handleShiftEdit = useCallback((shift: Shift) => {
    // Initialize form with existing times and notes
    const startTime = shift.start_time.slice(11, 16);
    const endTime = shift.end_time.slice(11, 16);
    setEditForm({ start: startTime, end: endTime, notes: shift.notes ?? "", nonbill: String(shift.non_billable_hours ?? 0) });
    setEditingShift(shift);
  }, []);

  const handleShiftDelete = useCallback((shift: Shift) => {
    setDeleteConfirm({ shift, isOpen: true });
  }, []);

  const handleShiftAssign = useCallback((shift: Shift) => {
    setAssignmentModal({ shift, isOpen: true });
  }, []);

  const confirmDelete = useCallback(async () => {
    if (deleteConfirm.shift) {
      await onShiftDelete(deleteConfirm.shift.id);
      setDeleteConfirm({ shift: null, isOpen: false });
    }
  }, [deleteConfirm.shift, onShiftDelete]);

  const handleStaffAssignment = useCallback(async (staffId: string | null) => {
    if (assignmentModal.shift) {
      await onShiftStaffUpdate(assignmentModal.shift.id, staffId);
      setAssignmentModal({ shift: null, isOpen: false });
    }
  }, [assignmentModal.shift, onShiftStaffUpdate]);

  const saveEdit = useCallback(async () => {
    if (!editingShift) return;
    const datePart = editingShift.start_time.slice(0, 10);
    const newStartIso = `${datePart}T${editForm.start}`;
    const newEndIso = `${datePart}T${editForm.end}`;
    const nb = Number(editForm.nonbill || 0);
    await onShiftUpdate(editingShift.id, { start_time: newStartIso, end_time: newEndIso, notes: editForm.notes, non_billable_hours: isNaN(nb) ? 0 : nb });
    setEditingShift(null);
  }, [editingShift, editForm.start, editForm.end, editForm.notes, editForm.nonbill, onShiftUpdate]);

  return (
    <div className="p-4 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Weekly Schedule ({format(startOfThisWeek, 'dd-MM-yyyy')} - {format(endOfWeek(startOfThisWeek, { weekStartsOn: 1 }), 'dd-MM-yyyy')})
          </h1>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Drag shifts to reorganize • Click + to add shifts
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => onWeekChange(addDays(currentWeek, -7))}
            className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 rounded-lg transition-colors"
          >
            <FaChevronLeft className="w-3 h-3" />
            Prev
          </button>
          <button
            onClick={() => onWeekChange(new Date())}
            className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 rounded-lg transition-colors"
          >
            <FaHome className="w-3 h-3" />
            Today
          </button>
          <button
            onClick={() => onWeekChange(addDays(currentWeek, 7))}
            className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 rounded-lg transition-colors"
          >
            Next
            <FaChevronRight className="w-3 h-3" />
          </button>
          {isAdmin && (
            <Link
              href="/reports"
              className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors"
            >
              <FaChartBar className="w-3 h-3" />
              Reports
            </Link>
          )}
        </div>
      </div>

      {/* Finance section for admins */}
      {isAdmin && (
        <div className="mt-4 rounded-xl border p-3 bg-white dark:bg-neutral-800 border-gray-200 dark:border-neutral-700">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Weekly Finance</h2>
            <div className="text-sm font-bold text-gray-900 dark:text-white">${getWeeklyTotal().toFixed(2)}</div>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((day) => (
              <div key={day.toISOString()} className={`text-center rounded-lg p-2 ${isToday(day) ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-gray-50 dark:bg-neutral-900'}`}>
                <div className={`text-xs ${isToday(day) ? 'text-blue-700 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400'}`}>{format(day, 'EEE')}</div>
                <div className={`text-xs font-semibold ${isToday(day) ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-white'}`}>${getDailyTotal(day).toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Calendar Grid */}
      <div className="mt-6">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2">
          {weekDays.map((day) => (
            <DayColumn
              key={day.toISOString()}
              day={day}
              shifts={shifts}
              staff={staff}
              isAdmin={isAdmin}
              onShiftCreate={handleShiftCreate}
              onShiftEdit={handleShiftEdit}
              onShiftDelete={handleShiftDelete}
              onShiftAssign={handleShiftAssign}
            />
          ))}
        </div>

        <DragOverlay>
          {activeId ? (
            <div className="rounded-lg border p-2 bg-white dark:bg-neutral-800 border-gray-200 dark:border-neutral-600 shadow-lg">
              <div className="text-xs">
                <div className="font-medium text-gray-900 dark:text-white">
                  Dragging shift...
                </div>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      </div>

      {/* Edit Shift Modal */}
      {editingShift && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-700 shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Shift</h3>
              <button aria-label="Close" onClick={() => setEditingShift(null)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-600 dark:text-gray-300">×</button>
            </div>
            <div className="grid gap-3">
              <label className="block">
                <span className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Start</span>
                <input type="time" value={editForm.start} onChange={(e) => setEditForm(s => ({ ...s, start: e.target.value }))} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white" />
              </label>
              <label className="block">
                <span className="block text-sm text-gray-700 dark:text-gray-300 mb-1">End</span>
                <input type="time" value={editForm.end} onChange={(e) => setEditForm(s => ({ ...s, end: e.target.value }))} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white" />
              </label>
            <label className="block">
              <span className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Non-billable hours</span>
              <input type="number" step="0.25" min="0" value={editForm.nonbill} onChange={(e) => setEditForm(s => ({ ...s, nonbill: e.target.value }))} placeholder="e.g., 0.5 for 30m, 0.75 for 45m" className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white" />
            </label>
              <label className="block">
                <span className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Notes</span>
                <textarea value={editForm.notes} onChange={(e) => setEditForm(s => ({ ...s, notes: e.target.value }))} rows={3} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white" />
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setEditingShift(null)} className="px-4 py-2 border rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800">Cancel</button>
              <button onClick={() => { void saveEdit(); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Assignment Modal */}
      {assignmentModal.isOpen && assignmentModal.shift && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-700 shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Assign Staff to Shift
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {assignmentModal.shift.start_time.slice(11, 16)} - {assignmentModal.shift.end_time.slice(11, 16)}
            </p>
            
            <div className="space-y-2 mb-6">
              <button
                onClick={() => handleStaffAssignment(null)}
                className="w-full p-3 text-left border border-gray-200 dark:border-neutral-700 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
              >
                <div className="font-medium text-gray-900 dark:text-white">Unassigned</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">No staff assigned</div>
              </button>
              
              {staff.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleStaffAssignment(s.id)}
                  className="w-full p-3 text-left border border-gray-200 dark:border-neutral-700 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
                >
                  <div className="font-medium text-gray-900 dark:text-white">{s.name}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    ${s.pay_rate}/hour
                  </div>
                </button>
              ))}
            </div>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setAssignmentModal({ shift: null, isOpen: false })}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmationDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ shift: null, isOpen: false })}
        onConfirm={confirmDelete}
        title="Delete Shift"
        message={`Are you sure you want to delete this shift? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
}
