"use client";

import { useState, useCallback, useEffect } from "react";
import { 
  DndContext, 
  DragEndEvent, 
  DragOverlay, 
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  useDroppable
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
import { format, addDays, startOfWeek, endOfWeek, isToday, isSameDay, addWeeks, subWeeks } from "date-fns";
import { FaEdit, FaTrash, FaRedo, FaChevronLeft, FaChevronRight, FaHome, FaPrint, FaPlus, FaMagic, FaEnvelope } from "react-icons/fa";
import { X } from "lucide-react";
import { CalendarToolbar } from "@/components/CalendarToolbar";
import { ConfirmationDialog } from "@/components/ConfirmationDialog";
import ErrorModal from "@/components/ErrorModal";
import PrintSchedule from "@/components/PrintSchedule";
import { ShiftModal } from "@/components/ShiftModal";
import { getDefaultSettings } from "@/lib/settings";
import { getSupabaseClient } from "@/lib/supabase/client";
import { sendWeeklyRoster, getWeeklyRosterData } from "@/app/actions/roster";
import Link from "next/link";

type Staff = {
  id: string;
  name: string;
  email: string | null;
  is_available: boolean;
};

type StaffRate = {
  id: string;
  staff_id: string;
  rate: number;
  rate_type: string; // 'default', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'
  effective_date: string;
  end_date: string;
  is_current: boolean;
  created_at: string;
};
type Section = {
  id: string;
  name: string;
  description: string | null;
  color: string;
  active: boolean;
  sort_order: number;
};
type Shift = { id: string; staff_id: string | null; start_time: string; end_time: string; notes: string | null; non_billable_hours?: number; section_id?: string | null };
type Availability = { id: string; staff_id: string; day_of_week: number; start_time: string; end_time: string };

type AutoShiftSummary = {
  totalShifts: number;
  shiftsToCopy: number;
  skippedShifts: number;
  staffSummary: Array<{ name: string; hours: string }>;
  totalHours: string;
  shiftsToCopyData: Shift[];
};

type StaffHoliday = {
  id: string;
  staff_id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
};

interface DragDropCalendarProps {
  shifts: Shift[];
  staff: Staff[];
  staffRates: StaffRate[];
  availability: Availability[];
  holidays: StaffHoliday[];
  sections: Section[];
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
  formatTimeForDisplay: (isoString: string) => string;
}

interface SectionDayCellProps {
  day: Date;
  section: Section;
  shifts: Shift[];
  staff: Staff[];
  isAdmin: boolean;
  isCtrlPressed: boolean;
  onShiftCreate: (day: Date) => Promise<void>;
  onShiftEdit: (shift: Shift) => void;
  onShiftDelete: (shift: Shift) => void;
  onShiftAssign: (shift: Shift) => void;
  formatTimeForDisplay: (isoString: string) => string;
}

function DraggableShift({ shift, staff, isAdmin, onEdit, onDelete, onAssign, formatTimeForDisplay }: DraggableShiftProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: shift.id, disabled: !isAdmin });

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
      {...(isAdmin ? listeners : {})}
      className={`rounded-lg border p-2 bg-white dark:bg-neutral-800 border-gray-200 dark:border-neutral-600 transition-shadow ${
        isAdmin ? 'cursor-move hover:shadow-md' : 'cursor-default'
      }`}
    >
        <div className="text-xs">
          <div className="font-medium text-gray-900 dark:text-white">
            {formatTimeForDisplay(shift.start_time)} - {formatTimeForDisplay(shift.end_time)}
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

function SectionDayCell({ day, section, shifts, staff, isAdmin, isCtrlPressed, onShiftCreate, onShiftEdit, onShiftDelete, onShiftAssign, formatTimeForDisplay }: SectionDayCellProps) {
  const getStaffById = (id: string | null) => staff.find(s => s.id === id) || null;
  // Use a separator that won't conflict with UUIDs or dates
  const dropZoneId = `drop_${section.id}_${day.toISOString()}`;
  
  const { isOver, setNodeRef } = useDroppable({
    id: dropZoneId,
  });

  return (
    <div 
      ref={setNodeRef}
      id={dropZoneId}
      className={`min-h-[120px] p-2 border rounded-lg relative transition-colors ${
        isOver 
          ? isCtrlPressed 
            ? 'border-green-500 bg-green-50 dark:bg-green-900/20' 
            : 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
          : isCtrlPressed
            ? 'border-green-300 dark:border-green-700 bg-green-25 dark:bg-green-900/10 hover:bg-green-50 dark:hover:bg-green-900/20'
            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750'
      }`}
    >
      {/* Clone mode indicator */}
      {isCtrlPressed && (
        <div className="absolute top-1 left-1 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs z-10">
          <span className="text-[10px] font-bold">+</span>
        </div>
      )}
      
      {/* Add shift button for admins */}
      {isAdmin && (
        <button
          onClick={() => onShiftCreate(day).catch(console.error)}
          className="absolute top-1 right-1 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs hover:bg-blue-700 transition-colors z-10"
          title="Add shift"
        >
          <FaPlus className="w-3 h-3" />
        </button>
      )}
      
      {/* Shifts */}
      <div className="space-y-1">
        {shifts.map((shift) => {
          const assignedStaff = getStaffById(shift.staff_id);
          return (
            <DraggableShift
              key={shift.id}
              shift={shift}
              staff={assignedStaff}
              isAdmin={isAdmin}
              onEdit={onShiftEdit}
              onDelete={onShiftDelete}
              onAssign={onShiftAssign}
              formatTimeForDisplay={formatTimeForDisplay}
            />
          );
        })}
      </div>
      
      {/* Empty state */}
      {shifts.length === 0 && (
        <div className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">
          No shifts
        </div>
      )}
    </div>
  );
}



export function DragDropCalendar({
  shifts,
  staff,
  staffRates,
  availability,
  sections,
  isAdmin,
  onShiftCreate,
  onShiftUpdate,
  onShiftDelete,
  onShiftStaffUpdate,
  currentWeek,
  onWeekChange
}: DragDropCalendarProps) {
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [editForm, setEditForm] = useState<{ start: string; end: string; notes: string; nonbill: string; section_id: string }>({ start: "", end: "", notes: "", nonbill: "0", section_id: "" });
  const [deleteConfirm, setDeleteConfirm] = useState<{ shift: Shift | null; isOpen: boolean }>({ shift: null, isOpen: false });
  const [assignmentModal, setAssignmentModal] = useState<{ shift: Shift | null; isOpen: boolean }>({ shift: null, isOpen: false });
  const [autoShiftConfirm, setAutoShiftConfirm] = useState<{ isOpen: boolean; summary: AutoShiftSummary | null }>({ isOpen: false, summary: null });
  const [errorModal, setErrorModal] = useState<{ isOpen: boolean; title: string; message: string; details?: string }>({ isOpen: false, title: "", message: "" });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);
  const [sendingRoster, setSendingRoster] = useState(false);

  // Helper function to convert UTC time to Melbourne local time for display
  const formatTimeForDisplay = useCallback((isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-AU', { 
      timeZone: 'Australia/Melbourne',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Track Ctrl key state for clone operations - only for admin users on calendar page
  useEffect(() => {
    // Don't set up keyboard listeners for staff users
    if (!isAdmin) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      // Only track Ctrl key when we're on the calendar page and user is admin
      if ((event.key === 'Control' || event.metaKey) && window.location.pathname === '/calendar') {
        setIsCtrlPressed(true);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Control' || event.metaKey) {
        setIsCtrlPressed(false);
      }
    };

    // Only add listeners when the calendar is mounted and user is admin
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [isAdmin]);

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
    
    // Find the rate that was effective on the shift date
    const dateStr = start.toISOString().split('T')[0];
    const dayOfWeek = start.getDay(); // 0=Sunday, 1=Monday, etc.
    
    // Map day of week to rate type
    const rateTypeMap: { [key: number]: string } = {
      0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat'
    };
    const rateType = rateTypeMap[dayOfWeek];
    
    // First try to find specific day rate
    let rate = staffRates.find(r => 
      r.staff_id === s.id && 
      r.rate_type === rateType &&
      r.effective_date <= dateStr && 
      r.end_date >= dateStr
    );
    
    // If no specific day rate, fall back to default rate
    if (!rate) {
      rate = staffRates.find(r => 
        r.staff_id === s.id && 
        r.rate_type === 'default' &&
        r.effective_date <= dateStr && 
        r.end_date >= dateStr
      );
    }
    
    const baseRate = rate?.rate || 0;
    
    // For now, use simple calculation since we don't have payment instructions in calendar context
    // TODO: Add payment instructions support to calendar if needed
    return Math.max(0, hours) * baseRate;
  }, [staff, staffRates]);

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
    // Only allow dragging for admin users
    if (!isAdmin) {
      return;
    }
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    // Only allow drag operations for admin users
    if (!isAdmin) {
      setActiveId(null);
      return;
    }
    
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

    // Check if dropped on a valid drop zone
    const dropZoneId = over.id as string;
    if (!dropZoneId.startsWith('drop_')) {
      setActiveId(null);
      return;
    }

    // Parse the drop zone ID to get section and date
    // Format: drop_{sectionId}_{dateString}
    const parts = dropZoneId.split('_');
    if (parts.length !== 3) {
      setActiveId(null);
      return;
    }
    
    const sectionId = parts[1];
    const dateString = parts[2];
    const targetDate = new Date(dateString);
    
    // Find the target section
    const targetSection = sections.find(s => s.id === sectionId);
    if (!targetSection) {
      setActiveId(null);
      return;
    }

    // Check if the shift is being moved to a different section or date
    const currentDate = new Date(sourceShift.start_time);
    const isDifferentSection = sourceShift.section_id !== sectionId;
    const isDifferentDate = !isSameDay(currentDate, targetDate);

    if (isDifferentSection || isDifferentDate) {
      // Calculate new start and end times
      const currentStartTime = formatTimeForDisplay(sourceShift.start_time); // Get time part
      const currentEndTime = formatTimeForDisplay(sourceShift.end_time);
      
      // Ensure proper timezone handling for drag and drop
      // Create Date objects in local timezone (Melbourne), then convert to UTC
      const startDateTime = new Date(`${format(targetDate, 'yyyy-MM-dd')}T${currentStartTime}:00`);
      const endDateTime = new Date(`${format(targetDate, 'yyyy-MM-dd')}T${currentEndTime}:00`);
      const newStartTime = startDateTime.toISOString();
      const newEndTime = endDateTime.toISOString();

      if (isCtrlPressed && isDifferentDate) {
        // Clone the shift to the new date
        try {
          const clonedShift: Omit<Shift, 'id'> = {
            staff_id: sourceShift.staff_id,
            start_time: newStartTime,
            end_time: newEndTime,
            notes: sourceShift.notes,
            non_billable_hours: sourceShift.non_billable_hours,
            section_id: sectionId
          };
          await onShiftCreate(clonedShift);
        } catch (error) {
          console.error('Error cloning shift:', error);
        }
      } else {
        // Move the shift (original behavior)
        try {
          await onShiftUpdate(sourceShift.id, {
            start_time: newStartTime,
            end_time: newEndTime,
            section_id: sectionId
          });
        } catch (error) {
          console.error('Error updating shift:', error);
        }
      }
    }
    
    setActiveId(null);
  };

  const handleShiftCreate = useCallback(async (day: Date) => {
    // Fetch default settings
    const defaultSettings = await getDefaultSettings();
    const defaultStartTime = defaultSettings.default_shift_start_time;
    const defaultEndTime = defaultSettings.default_shift_end_time;
    
    // Debug: Log the settings
    console.log('🔍 Default settings:', defaultSettings);
    console.log('🔍 defaultStartTime:', defaultStartTime);
    console.log('🔍 defaultEndTime:', defaultEndTime);
    
    // Get the first available section for prefill
    const defaultSectionId = sections.length > 0 ? sections[0].id : null;
    
    // Check for existing shifts on this date for this section
    const dayStr = format(day, 'yyyy-MM-dd');
    const existingShiftsForSection = shifts.filter(shift => {
      const shiftDate = shift.start_time.split('T')[0];
      return shiftDate === dayStr && shift.section_id === defaultSectionId;
    });
    
    // Always use default shift times from settings
    const prefillStartTime = defaultStartTime;
    const prefillEndTime = defaultEndTime;
    
    console.log('🔍 Using default shift times from settings:', defaultStartTime, '-', defaultEndTime);
    console.log('🔍 Existing shifts for this date + section:', existingShiftsForSection.length);
    
    // Create a temporary shift object for the edit modal
    const tempShift: Shift = {
      id: 'temp-new-shift',
      staff_id: null,
      start_time: `${dayStr}T${prefillStartTime}`,
      end_time: `${dayStr}T${prefillEndTime}`,
      notes: null,
      non_billable_hours: 0,
      section_id: defaultSectionId
    };

    // Debug: Log the date being passed
    console.log('🔍 Creating shift for date:', dayStr);
    console.log('🔍 Section:', defaultSectionId);
    console.log('🔍 Existing shifts for this date + section:', existingShiftsForSection.length);
    console.log('🔍 Prefill times:', prefillStartTime, '-', prefillEndTime);
    console.log('🔍 Temp shift start_time:', tempShift.start_time);

    setEditingShift(tempShift);
  }, [sections, shifts]);

  const handleShiftEdit = useCallback((shift: Shift) => {
    setEditingShift(shift);
  }, []);

  // Calculate total hours from start and end times
  const calculateTotalHours = useCallback((start: string, end: string): number => {
    if (!start || !end) return 0;
    const [startHour, startMin] = start.split(':').map(Number);
    const [endHour, endMin] = end.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    return Math.max(0, (endMinutes - startMinutes) / 60);
  }, []);

  // Auto-fill non-billable hours for long shifts on weekdays
  const handleTimeChange = useCallback((field: 'start' | 'end', value: string) => {
    setEditForm(prev => {
      const newForm = { ...prev, [field]: value };
      
      // Calculate total hours
      const totalHours = calculateTotalHours(newForm.start, newForm.end);
      
      // Auto-fill non-billable hours if conditions are met
      if (totalHours >= 8 && editingShift) {
        const shiftDate = new Date(editingShift.start_time);
        const dayOfWeek = shiftDate.getDay(); // 0 = Sunday, 6 = Saturday
        
        // Check if it's a weekday (Monday = 1 to Friday = 5)
        const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
        
        // Auto-fill 0.5 hours (30 minutes) for lunch break if it's a weekday and non-billable is empty/zero
        if (isWeekday && (prev.nonbill === '' || prev.nonbill === '0')) {
          newForm.nonbill = '0.5';
        }
      }
      
      return newForm;
    });
  }, [calculateTotalHours, editingShift]);

  // Get available staff for the current shift being edited
  const getAvailableStaff = useCallback(() => {
    if (!editingShift || !editForm.start || !editForm.end) return [];
    
    const shiftDate = new Date(editingShift.start_time);
    const dayOfWeek = shiftDate.getDay();
    const shiftStartTime = editForm.start;
    const shiftEndTime = editForm.end;
    
    return staff.filter(s => {
      // Check if staff is available
      if (!s.is_available) return false;
      
      // Check if staff has availability for this day and time
      const hasAvailability = availability.some(a => 
        a.staff_id === s.id && 
        a.day_of_week === dayOfWeek &&
        a.start_time <= shiftStartTime &&
        a.end_time >= shiftEndTime
      );
      
      if (!hasAvailability) return false;
      
      // Check if staff is not already assigned to another shift on the same day
      const isAlreadyAssigned = shifts.some(shift => 
        shift.id !== editingShift.id && // Exclude current shift
        shift.staff_id === s.id &&
        new Date(shift.start_time).toDateString() === shiftDate.toDateString()
      );
      
      return !isAlreadyAssigned;
    });
  }, [editingShift, editForm.start, editForm.end, staff, availability, shifts]);

  // Get staff rate for the shift date
  const getStaffRate = useCallback((staffMember: Staff): number => {
    if (!editingShift) {
      // Return current default rate if no shift is being edited
      const currentRate = staffRates.find(r => r.staff_id === staffMember.id && r.rate_type === 'default' && r.is_current);
      return currentRate?.rate || 0;
    }
    
    const shiftDate = new Date(editingShift.start_time);
    const dateStr = shiftDate.toISOString().split('T')[0];
    const dayOfWeek = shiftDate.getDay(); // 0=Sunday, 1=Monday, etc.
    
    // Map day of week to rate type
    const rateTypeMap: { [key: number]: string } = {
      0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat'
    };
    const rateType = rateTypeMap[dayOfWeek];
    
    // First try to find specific day rate
    let rate = staffRates.find(r => 
      r.staff_id === staffMember.id && 
      r.rate_type === rateType &&
      r.effective_date <= dateStr && 
      r.end_date >= dateStr
    );
    
    // If no specific day rate, fall back to default rate
    if (!rate) {
      rate = staffRates.find(r => 
        r.staff_id === staffMember.id && 
        r.rate_type === 'default' &&
        r.effective_date <= dateStr && 
        r.end_date >= dateStr
      );
    }
    
    return rate?.rate || 0;
  }, [editingShift, staffRates]);

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
    
    // Create Date objects in local timezone (Melbourne)
    // The browser will automatically handle the timezone conversion
    const startDateTime = new Date(`${datePart}T${editForm.start}:00`);
    const endDateTime = new Date(`${datePart}T${editForm.end}:00`);
    
    // Convert to UTC for database storage
    const newStartIso = startDateTime.toISOString();
    const newEndIso = endDateTime.toISOString();
    const nb = Number(editForm.nonbill || 0);
    
    // Debug: Log what's being saved
    console.log('🔍 Shift Creation Debug:', {
      selectedDate: datePart,
      localTimeInput: `${editForm.start} - ${editForm.end}`,
      startDateTime: startDateTime.toString(),
      endDateTime: endDateTime.toString(),
      startUTC: newStartIso,
      endUTC: newEndIso,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      offset: new Date().getTimezoneOffset()
    });
    
    if (editingShift.id === 'temp-new-shift') {
      // Create new shift
      const newShift: Omit<Shift, 'id'> = {
        staff_id: editingShift.staff_id,
        start_time: newStartIso,
        end_time: newEndIso,
        notes: editForm.notes || null,
        non_billable_hours: isNaN(nb) ? 0 : nb,
        section_id: editForm.section_id || null
      };
      await onShiftCreate(newShift);
    } else {
      // Update existing shift
      await onShiftUpdate(editingShift.id, { start_time: newStartIso, end_time: newEndIso, notes: editForm.notes, non_billable_hours: isNaN(nb) ? 0 : nb, section_id: editForm.section_id || null });
    }
    
    setEditingShift(null);
  }, [editingShift, editForm.start, editForm.end, editForm.notes, editForm.nonbill, editForm.section_id, onShiftUpdate, onShiftCreate]);

  const handleStaffAssignmentInEdit = useCallback(async (staffId: string | null) => {
    if (!editingShift) return;
    
    if (editingShift.id === 'temp-new-shift') {
      // For new shifts, just update the local state
      setEditingShift(prev => prev ? { ...prev, staff_id: staffId } : null);
    } else {
      // For existing shifts, update in database
      await onShiftStaffUpdate(editingShift.id, staffId);
    }
  }, [editingShift, onShiftStaffUpdate]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleAutoShift = useCallback(async () => {
    try {
      // Get previous week's data
      const previousWeek = addDays(currentWeek, -7);
      const startOfPrevWeek = startOfWeek(previousWeek, { weekStartsOn: 1 });
      const endOfPrevWeek = endOfWeek(previousWeek, { weekStartsOn: 1 });
      
      // Fetch previous week's shifts
      const supabase = getSupabaseClient();
      const { data: prevShifts, error } = await supabase
        .from("shifts")
        .select("*")
        .gte("start_time", startOfPrevWeek.toISOString())
        .lte("start_time", endOfPrevWeek.toISOString())
        .not("staff_id", "is", null); // Only get assigned shifts

      if (error) {
        console.error("Error fetching previous week shifts:", error);
        return;
      }

      // Filter to only assigned shifts from previous week
      const assignedPrevShifts = (prevShifts || []).filter(shift => shift.staff_id !== null);
      
      if (assignedPrevShifts.length === 0) {
        setErrorModal({
          isOpen: true,
          title: "No Shifts Found",
          message: "No shifts found in the previous week to copy. Please ensure there are assigned shifts in the previous week before using Auto Shift."
        });
        return;
      }

      // Calculate summary
      const staffSummary = new Map();
      let totalHours = 0;

      assignedPrevShifts.forEach(shift => {
        const staffMember = staff.find(s => s.id === shift.staff_id);
        if (staffMember) {
          const start = new Date(shift.start_time);
          const end = new Date(shift.end_time);
          const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
          totalHours += hours;

          if (staffSummary.has(staffMember.name)) {
            staffSummary.set(staffMember.name, staffSummary.get(staffMember.name) + hours);
          } else {
            staffSummary.set(staffMember.name, hours);
          }
        }
      });

      // Check for existing shifts in current week to skip - handle timezone properly
      const currentWeekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
      const currentWeekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
      
      // Create timezone-aware week boundaries
      const weekStartDate = new Date(currentWeekStart);
      weekStartDate.setHours(0, 0, 0, 0); // Start of day in local timezone
      const weekEndDate = new Date(currentWeekEnd);
      weekEndDate.setHours(23, 59, 59, 999); // End of day in local timezone
      
      const { data: currentShifts } = await supabase
        .from("shifts")
        .select("*")
        .gte("start_time", weekStartDate.toISOString())
        .lte("start_time", weekEndDate.toISOString());

      const existingShifts = new Set();
      (currentShifts || []).forEach(shift => {
        const dayKey = shift.start_time.slice(0, 10);
        const sectionKey = shift.section_id || 'no-section';
        existingShifts.add(`${dayKey}-${sectionKey}`);
      });

      // Filter shifts that don't conflict with existing ones
      const shiftsToCopy = assignedPrevShifts.filter(shift => {
        const dayKey = shift.start_time.slice(0, 10);
        const sectionKey = shift.section_id || 'no-section';
        const newDayKey = addDays(new Date(dayKey), 7).toISOString().slice(0, 10);
        return !existingShifts.has(`${newDayKey}-${sectionKey}`);
      });

      const summary = {
        totalShifts: assignedPrevShifts.length,
        shiftsToCopy: shiftsToCopy.length,
        skippedShifts: assignedPrevShifts.length - shiftsToCopy.length,
        staffSummary: Array.from(staffSummary.entries()).map(([name, hours]) => ({ name, hours: hours.toFixed(1) })),
        totalHours: totalHours.toFixed(1),
        shiftsToCopyData: shiftsToCopy
      };

      setAutoShiftConfirm({ isOpen: true, summary });
    } catch (error) {
      console.error("Error in handleAutoShift:", error);
      setErrorModal({
        isOpen: true,
        title: "Auto Shift Error",
        message: "An error occurred while preparing the auto shift. Please try again.",
        details: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  }, [currentWeek, staff]);

  const confirmAutoShift = useCallback(async () => {
    if (!autoShiftConfirm.summary) return;

    try {
      const supabase = getSupabaseClient();
      const shiftsToCreate = autoShiftConfirm.summary.shiftsToCopyData.map((shift: Shift) => {
        const originalStartTime = new Date(shift.start_time);
        const originalEndTime = new Date(shift.end_time);
        
        // Calculate the new date (7 days later)
        const newDate = addDays(originalStartTime, 7);
        
        // Create new start time with the same time but new date - handle timezone properly
        // Extract time components from original times
        const originalStartHours = originalStartTime.getHours();
        const originalStartMinutes = originalStartTime.getMinutes();
        const originalEndHours = originalEndTime.getHours();
        const originalEndMinutes = originalEndTime.getMinutes();
        
        // Create new dates in local timezone (Melbourne)
        const newStartTime = new Date(newDate);
        newStartTime.setHours(originalStartHours, originalStartMinutes, 0, 0);
        
        const newEndTime = new Date(newDate);
        newEndTime.setHours(originalEndHours, originalEndMinutes, 0, 0);
        
        // Validate that end time is after start time
        if (newEndTime <= newStartTime) {
          console.error("Invalid shift time: end time must be after start time", {
            original: { start: shift.start_time, end: shift.end_time },
            new: { start: newStartTime.toISOString(), end: newEndTime.toISOString() }
          });
          return null; // Skip this shift
        }

        return {
          staff_id: shift.staff_id,
          start_time: newStartTime.toISOString(),
          end_time: newEndTime.toISOString(),
          notes: shift.notes,
          non_billable_hours: shift.non_billable_hours,
          section_id: shift.section_id
        };
      }).filter(Boolean); // Remove any null entries

      // Check if we have any valid shifts to create
      if (shiftsToCreate.length === 0) {
        setErrorModal({
          isOpen: true,
          title: "No Valid Shifts",
          message: "No valid shifts could be copied. This may be due to invalid time data in the previous week's shifts.",
          details: "All shifts were filtered out due to time constraint violations."
        });
        return;
      }

      const { error } = await supabase
        .from("shifts")
        .insert(shiftsToCreate);

      if (error) {
        console.error("Error creating shifts:", error);
        setErrorModal({
          isOpen: true,
          title: "Copy Shifts Error",
          message: "An error occurred while copying shifts. Please try again.",
          details: error.message
        });
        return;
      }

      // Close dialog and refresh data
      setAutoShiftConfirm({ isOpen: false, summary: null });
      
      // Show success message
      const originalCount = autoShiftConfirm.summary.shiftsToCopy;
      const actualCount = shiftsToCreate.length;
      const skippedCount = originalCount - actualCount;
      
      let message = `Successfully copied ${actualCount} shifts from the previous week!`;
      let details = "The calendar will refresh to show the new shifts.";
      
      if (skippedCount > 0) {
        message += ` (${skippedCount} shifts were skipped due to invalid time data)`;
        details += ` ${skippedCount} shifts had invalid time constraints and were not copied.`;
      }
      
      setErrorModal({
        isOpen: true,
        title: "Success",
        message,
        details
      });
      
      // Refresh the calendar data after a short delay
      setTimeout(() => {
        window.location.reload(); // Simple refresh for now
      }, 2000);
    } catch (error) {
      console.error("Error in confirmAutoShift:", error);
      setErrorModal({
        isOpen: true,
        title: "Copy Shifts Error",
        message: "An error occurred while copying shifts. Please try again.",
        details: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  }, [autoShiftConfirm.summary]);

  const handleSendRoster = useCallback(async () => {
    if (sendingRoster) return;
    
    setSendingRoster(true);
    try {
      console.log('📧 Starting roster email process...');
      
      // Get roster data for current week
      const rosterResult = await getWeeklyRosterData(currentWeek);
      
      if (!rosterResult.success || !rosterResult.data) {
        setErrorModal({
          isOpen: true,
          title: "Roster Error",
          message: rosterResult.error || "Failed to fetch roster data",
          details: "Please try again or contact support if the issue persists."
        });
        return;
      }

      const staffRosters = rosterResult.data;
      
      if (staffRosters.length === 0) {
        setErrorModal({
          isOpen: true,
          title: "No Staff Found",
          message: "No staff members with shifts found for this week",
          details: "Make sure shifts are assigned to staff members before sending rosters."
        });
        return;
      }

      // Filter out staff without email addresses
      const staffWithEmails = staffRosters.filter(roster => roster.staffEmail);
      const staffWithoutEmails = staffRosters.filter(roster => !roster.staffEmail);
      
      if (staffWithEmails.length === 0) {
        setErrorModal({
          isOpen: true,
          title: "No Email Addresses",
          message: "No staff members have email addresses configured",
          details: "Please add email addresses to staff profiles before sending rosters."
        });
        return;
      }

      // Send roster emails
      const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
      
      const sendResult = await sendWeeklyRoster({
        weekStart,
        weekEnd,
        staffRosters: staffWithEmails
      });

      if (!sendResult.success) {
        setErrorModal({
          isOpen: true,
          title: "Send Failed",
          message: sendResult.error || "Failed to send roster emails",
          details: "Please try again or contact support if the issue persists."
        });
        return;
      }

      // Show success message with details
      const results = sendResult.results || [];
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      
      let message = `Successfully sent roster emails to ${successful} staff members!`;
      let details = `Week: ${format(weekStart, 'MMM dd')} - ${format(weekEnd, 'MMM dd, yyyy')}`;
      
      if (failed > 0) {
        message += ` (${failed} emails failed)`;
        details += `\n\nFailed emails:\n${results.filter(r => !r.success).map(r => `• ${r.email}: ${r.error}`).join('\n')}`;
      }
      
      if (staffWithoutEmails.length > 0) {
        details += `\n\nStaff without email addresses (${staffWithoutEmails.length}):\n${staffWithoutEmails.map(r => `• ${r.staffName}`).join('\n')}`;
      }

      setErrorModal({
        isOpen: true,
        title: "Roster Sent",
        message,
        details
      });

    } catch (error) {
      console.error('Error sending roster:', error);
      setErrorModal({
        isOpen: true,
        title: "Send Error",
        message: "An unexpected error occurred while sending roster emails",
        details: error instanceof Error ? error.message : "Unknown error occurred"
      });
    } finally {
      setSendingRoster(false);
    }
  }, [currentWeek, sendingRoster]);

  return (
    <>
      {/* Print-only content */}
      <PrintSchedule 
        shifts={shifts}
        staff={staff}
        staffRates={staffRates}
        sections={sections}
        currentWeek={currentWeek}
      />

      {/* Clone Mode Indicator */}
      {isCtrlPressed && (
        <div className="fixed top-4 right-4 z-40 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-pulse">
          <div className="w-2 h-2 bg-white rounded-full"></div>
          <span className="text-sm font-medium">Clone Mode Active</span>
        </div>
      )}

      {/* Main calendar content */}
      <div className="p-4 w-full print-hide" data-calendar-container>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3 calendar-toolbar">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Weekly Schedule ({format(startOfThisWeek, 'dd-MM-yyyy')} - {format(endOfWeek(startOfThisWeek, { weekStartsOn: 1 }), 'dd-MM-yyyy')})
          </h1>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {isAdmin ? (
              <>
                Drag shifts to reorganize • Ctrl+Drag to clone to different day • Click + to add shifts
                {isCtrlPressed && (
                  <span className="ml-2 inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-[10px] font-medium">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                    Clone Mode
                  </span>
                )}
              </>
            ) : (
              "View your assigned shifts for the week • Contact admin for schedule changes"
            )}
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
            <>
              <button
                onClick={handlePrint}
                className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors print-button"
              >
                <FaPrint className="w-3 h-3" />
                Print
              </button>
              <button
                onClick={handleSendRoster}
                disabled={sendingRoster}
                className="flex items-center gap-1 px-3 py-1 text-sm bg-purple-600 text-white hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                <FaEnvelope className="w-3 h-3" />
                {sendingRoster ? 'Sending...' : 'Send Roster'}
              </button>
              <button
                onClick={handleAutoShift}
                className="flex items-center gap-1 px-3 py-1 text-sm bg-green-600 text-white hover:bg-green-700 rounded-lg transition-colors"
              >
                <FaMagic className="w-3 h-3" />
                Auto Shift
              </button>
            </>
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

      {/* Debug Button */}
      <div className="mt-6 mb-4 flex justify-end">
        <button
          onClick={async () => {
            // Collect all debug information
            const debugInfo = {
              timestamp: new Date().toISOString(),
              browser: {
                userAgent: navigator.userAgent,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                offset: new Date().getTimezoneOffset(),
                language: navigator.language
              },
              calendar: {
                currentWeek: currentWeek.toISOString(),
                currentWeekLocal: currentWeek.toLocaleDateString('en-AU', { timeZone: 'Australia/Melbourne' }),
                startOfThisWeek: startOfThisWeek.toISOString(),
                startOfThisWeekLocal: startOfThisWeek.toLocaleDateString('en-AU', { timeZone: 'Australia/Melbourne' }),
                weekDays: weekDays.map(day => ({
                  date: day.toISOString(),
                  dateLocal: day.toLocaleDateString('en-AU', { timeZone: 'Australia/Melbourne' }),
                  dayName: day.toLocaleDateString('en-AU', { weekday: 'long', timeZone: 'Australia/Melbourne' })
                }))
              },
              shifts: shifts.map(shift => ({
                id: shift.id,
                start_time: shift.start_time,
                end_time: shift.end_time,
                start_time_parsed: new Date(shift.start_time).toString(),
                end_time_parsed: new Date(shift.end_time).toString(),
                start_time_local: new Date(shift.start_time).toLocaleString('en-AU', { timeZone: 'Australia/Melbourne' }),
                end_time_local: new Date(shift.end_time).toLocaleString('en-AU', { timeZone: 'Australia/Melbourne' }),
                section_id: shift.section_id,
                staff_id: shift.staff_id
              })),
              sections: sections.map(section => ({
                id: section.id,
                name: section.name,
                active: section.active
              })),
              staff: staff.map(s => ({
                id: s.id,
                name: s.name,
                is_available: s.is_available
              }))
            };

            // Format as JSON string
            const debugString = JSON.stringify(debugInfo, null, 2);
            
            try {
              await navigator.clipboard.writeText(debugString);
              alert('Debug information copied to clipboard!');
              console.log('🔍 Full Debug Information:', debugInfo);
            } catch (err) {
              console.error('Failed to copy to clipboard:', err);
              console.log('🔍 Full Debug Information (manual copy):', debugString);
              alert('Failed to copy to clipboard. Check console for debug info.');
            }
          }}
          className="px-3 py-1 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/30 transition-colors text-xs"
        >
          🔍 Copy Debug Info
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="mt-6">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="overflow-x-auto">
          <div className="min-w-full">
            {/* Header row with date names */}
            <div className="grid gap-2 mb-2" style={{ gridTemplateColumns: `120px repeat(${weekDays.length}, 1fr)` }}>
              <div className="p-2 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded-lg">
                Section
              </div>
              {weekDays.map((day) => (
                <div key={day.toISOString()} className={`p-2 text-sm font-semibold rounded-lg flex flex-col items-center justify-center ${
                  isToday(day) 
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100' 
                    : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                }`}>
                  <div className="font-semibold">{format(day, 'EEE')}</div>
                  <div className="text-xs">{format(day, 'dd/MM')}</div>
                </div>
              ))}
            </div>
            
            {/* Section rows */}
            {sections.map((section) => (
              <div key={section.id} className="grid gap-2 mb-2" style={{ gridTemplateColumns: `120px repeat(${weekDays.length}, 1fr)` }}>
                {/* Section label */}
                <div className="p-3 text-sm font-medium text-white rounded-lg flex items-center gap-2" style={{ backgroundColor: section.color }}>
                  <div className="w-3 h-3 rounded-full bg-white/20"></div>
                  <span className="font-semibold">{section.name}</span>
                </div>
                
                {/* Date columns for this section */}
                {weekDays.map((day) => (
                  <SectionDayCell
                    key={`${section.id}-${day.toISOString()}`}
                    day={day}
                    section={section}
    shifts={shifts.filter(s => {
      if (s.section_id !== section.id) return false;
      
      // Handle timezone properly by comparing dates in Melbourne timezone
      const shiftDate = new Date(s.start_time);
      const shiftDateMelbourne = shiftDate.toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' }); // YYYY-MM-DD format
      const dayDateMelbourne = day.toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' }); // YYYY-MM-DD format
      const matches = shiftDateMelbourne === dayDateMelbourne;
      
      return matches;
    })}
                    staff={staff}
                    isAdmin={isAdmin}
                    isCtrlPressed={isCtrlPressed}
                    onShiftCreate={handleShiftCreate}
                    onShiftEdit={handleShiftEdit}
                    onShiftDelete={handleShiftDelete}
                    onShiftAssign={handleShiftAssign}
                    formatTimeForDisplay={formatTimeForDisplay}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        <DragOverlay>
          {activeId ? (
            <div className={`rounded-lg border p-2 shadow-lg ${
              isCtrlPressed 
                ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700' 
                : 'bg-white dark:bg-neutral-800 border-gray-200 dark:border-neutral-600'
            }`}>
              <div className="text-xs">
                <div className={`font-medium ${
                  isCtrlPressed 
                    ? 'text-green-900 dark:text-green-100' 
                    : 'text-gray-900 dark:text-white'
                }`}>
                  {isCtrlPressed ? 'Cloning shift...' : 'Dragging shift...'}
                </div>
                {isCtrlPressed && (
                  <div className="text-green-700 dark:text-green-300 text-[10px] mt-1">
                    Hold Ctrl to clone
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      </div>

      {/* Shift Modal */}
      <ShiftModal
        isOpen={!!editingShift}
        onClose={() => setEditingShift(null)}
        onSave={async (shiftData) => {
          console.log('🔍 DragDropCalendar - ShiftModal onSave called with:', {
            shiftData,
            editingShift,
            isNewShift: editingShift?.id === 'temp-new-shift',
            start_time_parsed: new Date(shiftData.start_time).toString(),
            end_time_parsed: new Date(shiftData.end_time).toString(),
            start_time_local: new Date(shiftData.start_time).toLocaleString('en-AU', { timeZone: 'Australia/Melbourne' }),
            end_time_local: new Date(shiftData.end_time).toLocaleString('en-AU', { timeZone: 'Australia/Melbourne' })
          });

          if (editingShift?.id === 'temp-new-shift') {
            // Create new shift
            const newShift: Omit<Shift, 'id'> = {
              staff_id: shiftData.staff_id,
              start_time: shiftData.start_time,
              end_time: shiftData.end_time,
              notes: shiftData.notes || null,
              non_billable_hours: shiftData.non_billable_hours,
              section_id: shiftData.section_id
            };
            console.log('🔍 DragDropCalendar - Creating new shift:', newShift);
            await onShiftCreate(newShift);
          } else if (editingShift) {
            // Update existing shift
            console.log('🔍 DragDropCalendar - Updating existing shift:', editingShift.id, shiftData);
            await onShiftUpdate(editingShift.id, shiftData);
          }
        }}
        initialData={editingShift ? {
          start_time: editingShift.start_time,
          end_time: editingShift.end_time,
          notes: editingShift.notes || "",
          non_billable_hours: editingShift.non_billable_hours || 0,
          section_id: editingShift.section_id || null,
          staff_id: editingShift.staff_id
        } : undefined}
        selectedDate={editingShift?.start_time?.slice(0, 10)}
        sections={sections}
        staff={staff}
        staffRates={staffRates}
        isAdmin={isAdmin}
        isNewShift={editingShift?.id === 'temp-new-shift'}
      />

      {/* Assignment Modal */}
      {assignmentModal.isOpen && assignmentModal.shift && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-700 shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Assign Staff to Shift
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {formatTimeForDisplay(assignmentModal.shift.start_time)} - {formatTimeForDisplay(assignmentModal.shift.end_time)}
            </p>
            
            <div className="space-y-2 mb-6">
              <button
                onClick={() => handleStaffAssignment(null)}
                className="w-full p-3 text-left border border-gray-200 dark:border-neutral-700 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
              >
                <div className="font-medium text-gray-900 dark:text-white">Unassigned</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">No staff assigned</div>
              </button>
              
              {staff.map((s) => {
                // Get the shift date for rate calculation
                const shiftDate = assignmentModal.shift?.start_time?.slice(0, 10) || '';
                const dateObj = new Date(shiftDate);
                const dayOfWeek = dateObj.getDay(); // 0=Sunday, 1=Monday, etc.
                
                // Map day of week to rate type
                const rateTypeMap: { [key: number]: string } = {
                  0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat'
                };
                const rateType = rateTypeMap[dayOfWeek];
                
                // Find the appropriate rate
                let rate = staffRates.find(r => 
                  r.staff_id === s.id && 
                  r.rate_type === rateType &&
                  r.effective_date <= shiftDate && 
                  r.end_date >= shiftDate &&
                  r.is_current
                );
                
                // If no specific day rate, fall back to default rate
                if (!rate) {
                  rate = staffRates.find(r => 
                    r.staff_id === s.id && 
                    r.rate_type === 'default' &&
                    r.effective_date <= shiftDate && 
                    r.end_date >= shiftDate &&
                    r.is_current
                  );
                }
                
                const hourlyRate = rate?.rate || 0;
                
                // Calculate shift duration
                const startTime = new Date(assignmentModal.shift?.start_time || '');
                const endTime = new Date(assignmentModal.shift?.end_time || '');
                const durationMs = endTime.getTime() - startTime.getTime();
                const durationHours = durationMs / (1000 * 60 * 60);
                const totalCost = hourlyRate * durationHours;
                
                return (
                  <button
                    key={s.id}
                    onClick={() => handleStaffAssignment(s.id)}
                    className="w-full p-3 text-left border border-gray-200 dark:border-neutral-700 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
                  >
                    <div className="font-medium text-gray-900 dark:text-white">{s.name}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      ${hourlyRate}/hour
                      <span className="ml-2 font-medium text-green-600 dark:text-green-400">
                        Total: ${totalCost.toFixed(2)} ({durationHours.toFixed(1)}h)
                      </span>
                    </div>
                  </button>
                );
              })}
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

      {/* Auto Shift Confirmation Dialog */}
      {autoShiftConfirm.isOpen && autoShiftConfirm.summary && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm grid place-items-center p-4 z-50">
          <div className="w-full max-w-2xl bg-white dark:bg-neutral-950 rounded-2xl shadow-2xl p-0 max-h-[85vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-neutral-800">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Auto Shift - Copy from Previous Week</h2>
              <button
                type="button"
                onClick={() => setAutoShiftConfirm({ isOpen: false, summary: null })}
                className="h-8 w-8 rounded-lg inline-grid place-items-center hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <X className="size-4 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            {/* Body */}
            <div className="max-h-[calc(85vh-80px)] overflow-y-auto overflow-x-hidden p-6">
              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Summary</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-blue-700 dark:text-blue-300">Total shifts found:</span>
                      <span className="ml-2 font-medium">{autoShiftConfirm.summary.totalShifts}</span>
                    </div>
                    <div>
                      <span className="text-blue-700 dark:text-blue-300">Shifts to copy:</span>
                      <span className="ml-2 font-medium">{autoShiftConfirm.summary.shiftsToCopy}</span>
                    </div>
                    <div>
                      <span className="text-blue-700 dark:text-blue-300">Shifts skipped:</span>
                      <span className="ml-2 font-medium">{autoShiftConfirm.summary.skippedShifts}</span>
                    </div>
                    <div>
                      <span className="text-blue-700 dark:text-blue-300">Total hours:</span>
                      <span className="ml-2 font-medium">{autoShiftConfirm.summary.totalHours}h</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Staff Hours Breakdown</h3>
                  <div className="space-y-2">
                    {autoShiftConfirm.summary.staffSummary.map((staff: { name: string; hours: string }, index: number) => (
                      <div key={index} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-neutral-800 rounded">
                        <span className="text-gray-900 dark:text-gray-100">{staff.name}</span>
                        <span className="font-medium text-gray-700 dark:text-gray-300">{staff.hours}h</span>
                      </div>
                    ))}
                  </div>
                </div>

                {autoShiftConfirm.summary.skippedShifts > 0 && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                    <p className="text-yellow-800 dark:text-yellow-200 text-sm">
                      <strong>Note:</strong> {autoShiftConfirm.summary.skippedShifts} shifts were skipped because they conflict with existing shifts in the current week.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-neutral-800 bg-gray-50/50 dark:bg-neutral-900/50">
              <button
                onClick={() => setAutoShiftConfirm({ isOpen: false, summary: null })}
                className="h-10 px-4 rounded-lg border border-gray-300 dark:border-neutral-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmAutoShift}
                className="h-10 px-4 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
              >
                Copy Shifts
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Modal */}
      <ErrorModal
        isOpen={errorModal.isOpen}
        onClose={() => setErrorModal({ isOpen: false, title: "", message: "" })}
        title={errorModal.title}
        message={errorModal.message}
        details={errorModal.details}
      />
      </div>
    </>
  );
}
