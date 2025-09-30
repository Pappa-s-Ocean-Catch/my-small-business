"use client";

import { useState, useCallback, useEffect, useRef } from "react";
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
import { FaEdit, FaTrash, FaRedo, FaChevronLeft, FaChevronRight, FaHome, FaPrint, FaPlus, FaMagic, FaEnvelope, FaSave, FaLayerGroup, FaFilter } from "react-icons/fa";
import { X } from "lucide-react";
import { CalendarToolbar } from "@/components/CalendarToolbar";
import { ConfirmationDialog } from "@/components/ConfirmationDialog";
import ErrorModal from "@/components/ErrorModal";
import PrintSchedule from "@/components/PrintSchedule";
import { ShiftModal } from "@/components/ShiftModal";
import { getDefaultSettings } from "@/lib/settings";
import { getSupabaseClient } from "@/lib/supabase/client";
import { sendWeeklyRoster, getWeeklyRosterData, StaffRoster } from "@/app/actions/roster";
import Link from "next/link";

type Staff = {
  id: string;
  name: string;
  email: string | null;
  is_available: boolean;
  skills: string[];
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

type TemplateItem = {
  day_of_week: number; // 0-6 (Sun-Sat)
  section_id: string | null;
  staff_id: string | null;
  start_hhmm: string; // "HH:MM"
  end_hhmm: string;   // "HH:MM"
  notes: string | null;
  non_billable_hours?: number;
};

type ShiftTemplate = {
  id: string;
  name: string;
  calendar: { items: TemplateItem[] };
  created_by: string;
  created_at: string;
};

interface DragDropCalendarProps {
  shifts: Shift[];
  staff: Staff[];
  staffRates: StaffRate[];
  availability: Availability[];
  holidays: StaffHoliday[];
  sections: Section[];
  isAdmin: boolean;
  isLoading?: boolean;
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
  getShiftFinance: (shift: Shift) => { hours: number; rate: number; total: number };
}

interface SectionDayCellProps {
  day: Date;
  section: Section;
  shifts: Shift[];
  staff: Staff[];
  isAdmin: boolean;
  isCtrlPressed: boolean;
  onShiftCreate: (day: Date, sectionId?: string) => Promise<void>;
  onShiftEdit: (shift: Shift) => void;
  onShiftDelete: (shift: Shift) => void;
  onShiftAssign: (shift: Shift) => void;
  formatTimeForDisplay: (isoString: string) => string;
  getShiftFinance: (shift: Shift) => { hours: number; rate: number; total: number };
}

function DraggableShift({ shift, staff, isAdmin, onEdit, onDelete, onAssign, formatTimeForDisplay, getShiftFinance }: DraggableShiftProps) {
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
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="font-medium text-gray-900 dark:text-white whitespace-nowrap">
              {formatTimeForDisplay(shift.start_time)} - {formatTimeForDisplay(shift.end_time)}
            </div>
            {/* Mobile inline name/unassigned */}
            {staff ? (
              <div className="text-gray-600 dark:text-gray-400 truncate md:hidden">
                {staff.name}
              </div>
            ) : (
              <div className="text-orange-600 dark:text-orange-400 truncate md:hidden">
                Unassigned
              </div>
            )}
          </div>
          {/* Desktop: name/unassigned on second line */}
          {staff ? (
            <div className="hidden md:block text-gray-600 dark:text-gray-400 truncate">
              {staff.name}
            </div>
          ) : (
            <div className="hidden md:block text-orange-600 dark:text-orange-400 truncate">
              Unassigned
            </div>
          )}

          {/* Admin-only finance summary */}
          {isAdmin && staff && (() => {
            const { hours, rate, total } = getShiftFinance(shift);
            return (
              <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                ${rate.toFixed(2)}/h × {hours.toFixed(2)}h = <span className="font-medium text-gray-700 dark:text-gray-300">${total.toFixed(2)}</span>
              </div>
            );
          })()}
        </div>

        {isAdmin && (
          <div className="flex gap-1 mt-2 justify-start">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(shift);
              }}
              className="p-1.5 md:p-1 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900 rounded"
              title="Edit shift"
            >
              <FaEdit className="w-4 h-4 md:w-3 md:h-3" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAssign(shift);
              }}
              className="p-1.5 md:p-1 text-green-600 hover:bg-green-100 dark:hover:bg-green-900 rounded"
              title="Assign staff"
            >
              <FaRedo className="w-4 h-4 md:w-3 md:h-3" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(shift);
              }}
              className="p-1.5 md:p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900 rounded"
              title="Delete shift"
            >
              <FaTrash className="w-4 h-4 md:w-3 md:h-3" />
            </button>
          </div>
        )}

        {typeof shift.non_billable_hours === 'number' && shift.non_billable_hours > 0 && (
          <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">Non-bill: {shift.non_billable_hours}h</div>
        )}
        {shift.notes && (
          <div className="text-gray-500 dark:text-gray-500 text-xs mt-1 line-clamp-2 md:line-clamp-none">
            {shift.notes}
          </div>
        )}
      </div>
    </div>
  );
}

function SectionDayCell({ day, section, shifts, staff, isAdmin, isCtrlPressed, onShiftCreate, onShiftEdit, onShiftDelete, onShiftAssign, formatTimeForDisplay, getShiftFinance }: SectionDayCellProps) {
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
      className={`min-h-[96px] md:min-h-[120px] p-1.5 md:p-2 border rounded-lg relative transition-colors ${
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
          onClick={() => onShiftCreate(day, section.id).catch(console.error)}
          className="absolute top-1 right-1 w-6 h-6 md:w-7 md:h-7 bg-blue-600 text-white rounded-full flex items-center justify-center text-[10px] md:text-xs hover:bg-blue-700 transition-colors z-10"
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
              getShiftFinance={getShiftFinance}
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
  isLoading = false,
  onShiftCreate,
  onShiftUpdate,
  onShiftDelete,
  onShiftStaffUpdate,
  currentWeek,
  onWeekChange
}: DragDropCalendarProps) {
  const [selectedStaffId, setSelectedStaffId] = useState<string | "all">("all");
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [filterOpen, setFilterOpen] = useState<boolean>(false);
  const [editForm, setEditForm] = useState<{ start: string; end: string; notes: string; nonbill: string; section_id: string }>({ start: "", end: "", notes: "", nonbill: "0", section_id: "" });
  const [deleteConfirm, setDeleteConfirm] = useState<{ shift: Shift | null; isOpen: boolean }>({ shift: null, isOpen: false });
  const [assignmentModal, setAssignmentModal] = useState<{ shift: Shift | null; isOpen: boolean }>({ shift: null, isOpen: false });
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState<boolean>(false);
  const [saveTemplateModal, setSaveTemplateModal] = useState<{ isOpen: boolean }>({ isOpen: false });
  const [templateName, setTemplateName] = useState<string>("");
  const [chooseAutoShiftModal, setChooseAutoShiftModal] = useState<{ isOpen: boolean }>({ isOpen: false });
  const [templateDeleteConfirm, setTemplateDeleteConfirm] = useState<{ template: ShiftTemplate | null; isOpen: boolean }>({ template: null, isOpen: false });

  const loadTemplates = useCallback(async () => {
    try {
      setLoadingTemplates(true);
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('shift_templates')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTemplates(data || []);
    } catch (err) {
      console.error('Failed to load templates', err);
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      void loadTemplates();
    }
  }, [isAdmin, loadTemplates]);

  const openSaveTemplate = useCallback(() => {
    setTemplateName("");
    setSaveTemplateModal({ isOpen: true });
  }, []);

  const saveCurrentWeekAsTemplate = useCallback(async () => {
    try {
      if (!templateName.trim()) return;
      const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });

      // Build template items from current shifts only within the current week
      const items: TemplateItem[] = shifts
        .filter((s) => {
          const d = new Date(s.start_time);
          return d >= weekStart && d <= weekEnd;
        })
        .map((s) => {
          const start = new Date(s.start_time);
          const end = new Date(s.end_time);
          const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
          const start_hhmm = `${pad(start.getHours())}:${pad(start.getMinutes())}`;
          const end_hhmm = `${pad(end.getHours())}:${pad(end.getMinutes())}`;
          return {
            day_of_week: start.getDay(),
            section_id: s.section_id || null,
            staff_id: s.staff_id,
            start_hhmm,
            end_hhmm,
            notes: s.notes,
            non_billable_hours: typeof s.non_billable_hours === 'number' ? s.non_billable_hours : 0,
          };
        });

      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('shift_templates')
        .insert({ name: templateName.trim(), calendar: { items } });
      if (error) throw error;

      setSaveTemplateModal({ isOpen: false });
      setTemplateName("");
      await loadTemplates();
      setErrorModal({
        isOpen: true,
        title: 'Template Saved',
        message: 'Your current week has been saved as a template.',
        details: undefined,
      });
    } catch (err) {
      console.error('Save template failed', err);
      setErrorModal({
        isOpen: true,
        title: 'Save Template Error',
        message: 'Failed to save the template. Please try again.',
        details: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }, [currentWeek, loadTemplates, shifts, templateName]);

  const openChooseAutoShift = useCallback(() => {
    setChooseAutoShiftModal({ isOpen: true });
    void loadTemplates();
  }, [loadTemplates]);

  const applyTemplateToCurrentWeek = useCallback(async (template: ShiftTemplate) => {
    try {
      const supabase = getSupabaseClient();
      const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });

      // Load existing shifts in current week to prevent duplicates by day+section+start_hhmm
      const { data: currentWeekShifts, error: curErr } = await supabase
        .from('shifts')
        .select('*')
        .gte('start_time', weekStart.toISOString())
        .lte('start_time', weekEnd.toISOString());
      if (curErr) throw curErr;

      const existingKeys = new Set<string>();
      (currentWeekShifts || []).forEach((s) => {
        const d = new Date(s.start_time);
        const dow = d.getDay();
        const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
        const hhmm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
        const sectionKey = s.section_id || 'no-section';
        existingKeys.add(`${dow}-${sectionKey}-${hhmm}`);
      });

      const items = Array.isArray(template.calendar?.items) ? template.calendar.items : [];

      const toCreate = items
        .filter((it) => it && typeof it.day_of_week === 'number')
        .filter((it) => !existingKeys.has(`${it.day_of_week}-${it.section_id || 'no-section'}-${it.start_hhmm}`))
        .map((it) => {
          const dayDate = new Date(weekStart);
          dayDate.setDate(weekStart.getDate() + it.day_of_week - (weekStart.getDay()));
          // Ensure we align Monday-start weeks; compute real date: startOfWeek is Monday (1)
          // So build by adding delta from Monday
          const mondayDow = 1; // Monday
          const delta = (it.day_of_week - mondayDow + 7) % 7;
          const baseDate = new Date(weekStart);
          baseDate.setDate(weekStart.getDate() + delta);

          const [sh, sm] = it.start_hhmm.split(':').map((v) => Number(v));
          const [eh, em] = it.end_hhmm.split(':').map((v) => Number(v));

          const start = new Date(baseDate);
          start.setHours(sh, sm, 0, 0);
          const end = new Date(baseDate);
          end.setHours(eh, em, 0, 0);
          if (end <= start) {
            // Skip invalid
            return null;
          }
          return {
            staff_id: it.staff_id,
            section_id: it.section_id,
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            notes: it.notes,
            non_billable_hours: typeof it.non_billable_hours === 'number' ? it.non_billable_hours : 0,
          };
        })
        .filter((v): v is {
          staff_id: string | null;
          section_id: string | null;
          start_time: string;
          end_time: string;
          notes: string | null;
          non_billable_hours: number;
        } => Boolean(v));

      if (toCreate.length === 0) {
        setErrorModal({
          isOpen: true,
          title: 'No Shifts Created',
          message: 'All shifts in this template already exist for the current week or are invalid.',
          details: undefined,
        });
        return;
      }

      const { error } = await supabase.from('shifts').insert(toCreate);
      if (error) throw error;

      setChooseAutoShiftModal({ isOpen: false });
      setErrorModal({
        isOpen: true,
        title: 'Template Applied',
        message: `Created ${toCreate.length} shifts from template '${template.name}'.`,
        details: 'The calendar will refresh to show the new shifts.',
      });
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      console.error('Apply template failed', err);
      setErrorModal({
        isOpen: true,
        title: 'Apply Template Error',
        message: 'Failed to apply the selected template.',
        details: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }, [currentWeek]);

  const confirmDeleteTemplate = useCallback(async () => {
    if (!templateDeleteConfirm.template) return;
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('shift_templates')
        .delete()
        .eq('id', templateDeleteConfirm.template.id);
      if (error) throw error;
      setTemplateDeleteConfirm({ template: null, isOpen: false });
      await loadTemplates();
      setErrorModal({
        isOpen: true,
        title: 'Template Deleted',
        message: 'The template has been deleted successfully.',
        details: undefined,
      });
    } catch (err) {
      console.error('Delete template failed', err);
      setErrorModal({
        isOpen: true,
        title: 'Delete Template Error',
        message: 'Failed to delete the template. Please try again.',
        details: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }, [loadTemplates, templateDeleteConfirm.template]);
  const [autoShiftConfirm, setAutoShiftConfirm] = useState<{ isOpen: boolean; summary: AutoShiftSummary | null }>({ isOpen: false, summary: null });
  const [errorModal, setErrorModal] = useState<{ 
    isOpen: boolean; 
    title: string; 
    message: string; 
    details?: string; 
    variant?: 'success' | 'warning' | 'error';
    emailResults?: Array<{ staffName: string; email: string; success: boolean; messageId?: string; error?: string }>;
    staffWithoutEmails?: Array<{ staffName: string; staffEmail: string | null }>;
  }>({ isOpen: false, title: "", message: "" });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);
  const [sendingRoster, setSendingRoster] = useState(false);
  const [activeDayIndex, setActiveDayIndex] = useState<number>(0);
  const [mobileActionsVisible, setMobileActionsVisible] = useState(false);
  const [rosterConfirmModal, setRosterConfirmModal] = useState<{ 
    isOpen: boolean; 
    staffRosters: StaffRoster[] | null;
    weekStart: Date | null;
    weekEnd: Date | null;
  }>({ isOpen: false, staffRosters: null, weekStart: null, weekEnd: null });
  const mobileEndRef = useRef<HTMLDivElement | null>(null);

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
  
  useEffect(() => {
    const todayIndex = weekDays.findIndex(d => isToday(d));
    setActiveDayIndex(todayIndex >= 0 ? todayIndex : 0);
  }, [currentWeek]);

  // On mobile, show admin action bar only when user scrolls to end of page
  useEffect(() => {
    // Only apply on client and for mobile widths
    if (typeof window === 'undefined') return;
    const isMobile = window.matchMedia('(max-width: 767px)').matches;
    if (!isMobile) {
      setMobileActionsVisible(false);
      return;
    }
    const sentinel = mobileEndRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setMobileActionsVisible(entry.isIntersecting);
      },
      { root: null, rootMargin: '0px', threshold: 0.25 }
    );
    observer.observe(sentinel);
    return () => {
      observer.disconnect();
    };
  }, []);
  

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
    // Compare dates in Melbourne timezone to match visual grouping
    const dayKeyMel = day.toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' });
    return (selectedStaffId === "all" ? shifts : shifts.filter(s => s.staff_id === selectedStaffId))
      .filter(s => {
        const shiftDate = new Date(s.start_time);
        const shiftKeyMel = shiftDate.toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' });
        return shiftKeyMel === dayKeyMel;
      })
      .reduce((sum, s) => sum + calculateShiftCost(s), 0);
  }, [shifts, calculateShiftCost, selectedStaffId]);

  const getWeeklyTotal = useCallback((): number => {
    return weekDays.reduce((sum, d) => sum + getDailyTotal(d), 0);
  }, [weekDays, getDailyTotal]);
  // Apply staff filter to all rendered shifts once to ensure consistency across UI
  const filteredShifts: Shift[] = selectedStaffId === "all" ? shifts : shifts.filter(s => s.staff_id === selectedStaffId);


  // Compute finance details for a specific shift (hours, rate, total)
  const getShiftFinance = useCallback((shift: Shift): { hours: number; rate: number; total: number } => {
    const start = new Date(shift.start_time);
    const end = new Date(shift.end_time);
    const rawHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    const nonbill = Number(shift.non_billable_hours || 0);
    const hours = Math.max(0, rawHours - nonbill);

    let rate = 0;
    if (shift.staff_id) {
      const dateStr = start.toISOString().split('T')[0];
      const dayOfWeek = start.getDay();
      const rateTypeMap: { [key: number]: string } = { 0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat' };
      const rateType = rateTypeMap[dayOfWeek];

      let r = staffRates.find(rr => rr.staff_id === shift.staff_id && rr.rate_type === rateType && rr.effective_date <= dateStr && rr.end_date >= dateStr);
      if (!r) {
        r = staffRates.find(rr => rr.staff_id === shift.staff_id && rr.rate_type === 'default' && rr.effective_date <= dateStr && rr.end_date >= dateStr);
      }
      rate = r?.rate || 0;
    }
    const total = Math.max(0, hours) * rate;
    return { hours: Math.max(0, hours), rate, total };
  }, [staffRates]);

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

  const handleShiftCreate = useCallback(async (day: Date, sectionId?: string) => {
    // Fetch default settings
    const defaultSettings = await getDefaultSettings();
    const defaultStartTime = defaultSettings.default_shift_start_time;
    const defaultEndTime = defaultSettings.default_shift_end_time;
    
    // Debug: Log the settings
    console.log('🔍 Default settings:', defaultSettings);
    console.log('🔍 defaultStartTime:', defaultStartTime);
    console.log('🔍 defaultEndTime:', defaultEndTime);
    
    // Use the provided section ID or fall back to first available section
    const defaultSectionId = sectionId || (sections.length > 0 ? sections[0].id : null);
    
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
    
    // Create Date objects in Melbourne timezone explicitly
    // Melbourne is UTC+10 (or UTC+11 during daylight saving)
    // Use explicit timezone offset to ensure consistent behavior
    const startDateTime = new Date(`${datePart}T${editForm.start}:00+10:00`);
    const endDateTime = new Date(`${datePart}T${editForm.end}:00+10:00`);
    
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
      offset: new Date().getTimezoneOffset(),
      melbourneOffset: '+10:00',
      note: 'Using explicit Melbourne timezone (+10:00) to prevent timezone conversion issues'
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

      // Show confirmation modal with staff details
      const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
      
      setRosterConfirmModal({
        isOpen: true,
        staffRosters: staffWithEmails,
        weekStart,
        weekEnd
      });
      
    } catch (error) {
      console.error('Error preparing roster:', error);
      setErrorModal({
        isOpen: true,
        title: "Roster Error",
        message: "An unexpected error occurred while preparing roster data",
        details: error instanceof Error ? error.message : "Unknown error occurred",
        variant: 'error'
      });
    }
  }, [currentWeek, sendingRoster]);

  const handleConfirmSendRoster = useCallback(async () => {
    if (!rosterConfirmModal.staffRosters || !rosterConfirmModal.weekStart || !rosterConfirmModal.weekEnd) return;
    
    setSendingRoster(true);
    setRosterConfirmModal({ isOpen: false, staffRosters: null, weekStart: null, weekEnd: null });
    
    try {
      console.log('📧 Sending roster emails...');
      
      const sendResult = await sendWeeklyRoster({
        weekStart: rosterConfirmModal.weekStart,
        weekEnd: rosterConfirmModal.weekEnd,
        staffRosters: rosterConfirmModal.staffRosters
      });

      if (!sendResult.success) {
        setErrorModal({
          isOpen: true,
          title: "Send Failed",
          message: sendResult.error || "Failed to send roster emails",
          details: "Please try again or contact support if the issue persists.",
          variant: 'error'
        });
        return;
      }

      // Show success message with details
      const results = sendResult.results || [];
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      
      let message = `Successfully sent roster emails to ${successful} staff members!`;
      const details = `Week: ${format(rosterConfirmModal.weekStart, 'MMM dd')} - ${format(rosterConfirmModal.weekEnd, 'MMM dd, yyyy')}`;
      let variant: 'success' | 'warning' | 'error' = 'success';
      
      if (failed > 0) {
        message += ` (${failed} emails failed)`;
        variant = 'warning'; // Show warning if some emails failed
      }

      setErrorModal({
        isOpen: true,
        title: "Roster Sent",
        message,
        details,
        variant,
        emailResults: results,
        staffWithoutEmails: []
      });

    } catch (error) {
      console.error('Error sending roster:', error);
      setErrorModal({
        isOpen: true,
        title: "Send Error",
        message: "An unexpected error occurred while sending roster emails",
        details: error instanceof Error ? error.message : "Unknown error occurred",
        variant: 'error'
      });
    } finally {
      setSendingRoster(false);
    }
  }, [rosterConfirmModal]);

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
      <div className="p-4 w-full print-hide pb-28 md:pb-32" data-calendar-container>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3 calendar-toolbar">
        <div>
          <h1 className="text-base md:text-xl font-bold text-gray-900 dark:text-white whitespace-nowrap overflow-hidden text-ellipsis">
            <span className="md:hidden">Week</span>
            <span className="hidden md:inline">Weekly Schedule</span>
            <span> ({format(startOfThisWeek, 'dd-MM-yyyy')} - {format(endOfWeek(startOfThisWeek, { weekStartsOn: 1 }), 'dd-MM-yyyy')})</span>
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
        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-between sm:justify-end">
          <button
            onClick={() => onWeekChange(addDays(currentWeek, -7))}
            className="flex items-center justify-center gap-1 px-3 py-2 text-sm bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 rounded-lg transition-colors flex-1 sm:flex-initial"
          >
            <FaChevronLeft className="w-3 h-3" />
            Prev
          </button>
          <button
            onClick={() => onWeekChange(new Date())}
            className="flex items-center justify-center gap-1 px-3 py-2 text-sm bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 rounded-lg transition-colors flex-1 sm:flex-initial"
          >
            <FaHome className="w-3 h-3" />
            Today
          </button>
          <button
            onClick={() => onWeekChange(addDays(currentWeek, 7))}
            className="flex items-center justify-center gap-1 px-3 py-2 text-sm bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 rounded-lg transition-colors flex-1 sm:flex-initial"
          >
            Next
            <FaChevronRight className="w-3 h-3" />
          </button>
          {isAdmin && null}
        </div>
      </div>

      {/* Finance section for admins */}
      {isAdmin && (
        <div className="mt-4 rounded-xl border p-3 bg-white dark:bg-neutral-800 border-gray-200 dark:border-neutral-700">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Weekly Finance</h2>
            <div className="text-xs md:text-sm font-bold text-gray-900 dark:text-white">${Math.round(getWeeklyTotal()).toLocaleString()}</div>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((day) => (
              <div key={day.toISOString()} className={`text-center rounded-lg p-2 ${isToday(day) ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-gray-50 dark:bg-neutral-900'}`}>
                <div className={`text-xs ${isToday(day) ? 'text-blue-700 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400'}`}>{format(day, 'EEE')}</div>
                <div className={`text-[10px] md:text-xs font-semibold ${isToday(day) ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-white'}`}>${Math.round(getDailyTotal(day)).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      

      {/* Calendar Grid */}
      <div className="mt-6">
      {isLoading && (
        <div className="mb-4 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <div className="w-3 h-3 rounded-full border-2 border-blue-600 border-t-transparent animate-spin"></div>
          Loading week...
        </div>
      )}
      {/* Mobile: single-day view with quick nav */}
      <div className="md:hidden">
        <div className="flex flex-wrap gap-1 pb-2 justify-between">
          {weekDays.map((day, idx) => {
            const isActive = idx === activeDayIndex;
            const today = isToday(day);
            return (
              <button
                key={day.toISOString()}
                onClick={() => setActiveDayIndex(idx)}
                className={`px-2 py-1.5 rounded-md border transition-colors text-xs ${
                  isActive
                    ? 'bg-blue-600 text-white border-blue-600'
                    : today
                      ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-900'
                      : 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-neutral-700'
                }`}
                aria-current={isActive ? 'date' : undefined}
              >
                <div className="font-semibold leading-none">{format(day, 'EEE')}</div>
                <div className="text-[10px] leading-none">{format(day, 'dd/MM')}</div>
              </button>
            );
          })}
        </div>

        {/* Selected day header removed as it's visible in the day chips */}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="mt-3 space-y-2">
            {sections.map((section) => (
              <div key={section.id} className="grid gap-2 mb-2" style={{ gridTemplateColumns: `120px 1fr` }}>
                {/* Section label (column 1) */}
                <div className="p-3 text-sm font-medium text-white rounded-lg flex items-center gap-2" style={{ backgroundColor: section.color }}>
                  <div className="w-3 h-3 rounded-full bg-white/20"></div>
                  <span className="font-semibold">{section.name}</span>
                </div>
                {/* Shift allocation droppable (column 2) */}
                <SectionDayCell
                  key={`${section.id}-${weekDays[activeDayIndex].toISOString()}`}
                  day={weekDays[activeDayIndex]}
                  section={section}
                  shifts={filteredShifts.filter(s => {
                    if (s.section_id !== section.id) return false;
                    const shiftDate = new Date(s.start_time);
                    const shiftDateMelbourne = shiftDate.toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' });
                    const dayDateMelbourne = weekDays[activeDayIndex].toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' });
                    return shiftDateMelbourne === dayDateMelbourne;
                  })}
                  staff={staff}
                  isAdmin={isAdmin}
                  isCtrlPressed={isCtrlPressed}
                  onShiftCreate={handleShiftCreate}
                  onShiftEdit={handleShiftEdit}
                  onShiftDelete={handleShiftDelete}
                  onShiftAssign={handleShiftAssign}
                  formatTimeForDisplay={formatTimeForDisplay}
                  getShiftFinance={getShiftFinance}
                />
              </div>
            ))}
          </div>
        </DndContext>
      </div>

      {/* Desktop and tablets: weekly grid */}
      <div className="hidden md:block">
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
    shifts={filteredShifts.filter(s => {
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
                    getShiftFinance={getShiftFinance}
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
      </div>

      {/* Scroll end sentinel for mobile action bar visibility */}
      <div ref={mobileEndRef} className="h-1 w-full" aria-hidden></div>

      {/* Fixed bottom action bar for admins */}
      {isAdmin && (
        <div className={`fixed inset-x-0 bottom-4 md:bottom-6 z-40 print-hide group h-14 md:h-16 ${mobileActionsVisible ? '' : 'hidden md:block'}` }>
          {/* Hover catcher area (transparent, full width) */}
          <div className="absolute inset-x-0 bottom-0 h-14 md:h-16"></div>
          {/* Action bar container - always visible on mobile, hover-reveal on md+ */}
          <div className="mx-auto max-w-7xl px-4 pb-4 pointer-events-none">
            <div className="transform translate-y-0 opacity-100 md:translate-y-6 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100 transition-all duration-200 ease-out pointer-events-auto">
              <div className="w-full bg-transparent">
                <div className="flex md:flex-wrap flex-nowrap items-center justify-center gap-3 p-3 relative">
                  {/* Staff Filter (icon + popover) */}
                  <div className="relative">
                    <button
                      type="button"
                      aria-haspopup="dialog"
                      aria-expanded={filterOpen}
                      onClick={() => setFilterOpen((v) => !v)}
                      className="flex items-center justify-center gap-2 px-4 py-3 md:px-4 md:py-3.5 text-base bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 rounded-lg transition-colors"
                      title="Filter by staff"
                    >
                      <FaFilter className="w-5 h-5 md:w-4 md:h-4" />
                      <span className="hidden md:inline text-sm">{selectedStaffId === 'all' ? 'All staff' : (staff.find(s => s.id === selectedStaffId)?.name || 'Staff')}</span>
                    </button>
                    {filterOpen && (
                      <div
                        role="dialog"
                        aria-label="Filter shifts by staff"
                        className="absolute bottom-14 md:bottom-16 left-0 z-50 w-64 md:w-72 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl shadow-xl p-3 max-h-80 overflow-y-auto"
                      >
                        <div className="text-xs font-semibold text-gray-600 dark:text-gray-300 px-1 pb-2">Show shifts for</div>
                        <div className="space-y-1">
                          <label className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-neutral-800 cursor-pointer">
                            <input
                              type="radio"
                              name="staff-filter"
                              value="all"
                              checked={selectedStaffId === 'all'}
                              onChange={() => { setSelectedStaffId('all'); setFilterOpen(false); }}
                              className="accent-blue-600"
                            />
                            <span className="text-sm text-gray-900 dark:text-gray-100">All staff</span>
                          </label>
                          {staff.map((s) => (
                            <label key={s.id} className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-neutral-800 cursor-pointer">
                              <input
                                type="radio"
                                name="staff-filter"
                                value={s.id}
                                checked={selectedStaffId === s.id}
                                onChange={() => { setSelectedStaffId(s.id); setFilterOpen(false); }}
                                className="accent-blue-600"
                              />
                              <span className="text-sm text-gray-900 dark:text-gray-100 truncate">{s.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={handlePrint}
                    className="flex items-center justify-center gap-2 px-4 py-3 md:px-5 md:py-3.5 text-base bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors"
                  >
                    <FaPrint className="w-5 h-5 md:w-4 md:h-4" />
                    <span className="hidden md:inline">Print</span>
                  </button>
                  <button
                    onClick={handleSendRoster}
                    disabled={sendingRoster}
                    className="flex items-center justify-center gap-2 px-4 py-3 md:px-5 md:py-3.5 text-base bg-purple-600 text-white hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors"
                  >
                    <FaEnvelope className="w-5 h-5 md:w-4 md:h-4" />
                    <span className="hidden md:inline">{sendingRoster ? 'Sending...' : 'Send Roster'}</span>
                  </button>
                  <button
                    onClick={openSaveTemplate}
                    className="flex items-center justify-center gap-2 px-4 py-3 md:px-5 md:py-3.5 text-base bg-amber-600 text-white hover:bg-amber-700 rounded-lg transition-colors"
                  >
                    <FaSave className="w-5 h-5 md:w-4 md:h-4" />
                    <span className="hidden md:inline">Save as Template</span>
                  </button>
                  <button
                    onClick={openChooseAutoShift}
                    className="flex items-center justify-center gap-2 px-4 py-3 md:px-5 md:py-3.5 text-base bg-green-600 text-white hover:bg-green-700 rounded-lg transition-colors"
                  >
                    <FaMagic className="w-5 h-5 md:w-4 md:h-4" />
                    <span className="hidden md:inline">Auto Shift</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Shift Modal */}
      <ShiftModal
        isOpen={!!editingShift}
        onClose={() => setEditingShift(null)}
        onSave={async (shiftData) => {
          console.log('🔍 DragDropCalendar - ShiftModal onSave called with:', {
            shiftData,
            editingShift,
            isNewShift: editingShift?.id === 'temp-new-shift',
            start_time: shiftData.start_time,
            end_time: shiftData.end_time
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
          <div className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-700 shadow-2xl max-w-md w-full p-6 max-h-[85vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Assign Staff to Shift
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {formatTimeForDisplay(assignmentModal.shift.start_time)} - {formatTimeForDisplay(assignmentModal.shift.end_time)}
            </p>
            
            <div className="space-y-2 mb-6 overflow-y-auto max-h-[60vh] pr-1">
              <button
                onClick={() => handleStaffAssignment(null)}
                className="w-full p-3 text-left border border-gray-200 dark:border-neutral-700 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
              >
                <div className="font-medium text-gray-900 dark:text-white">Unassigned</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">No staff assigned</div>
              </button>
              
              {staff.filter(s => {
                // Filter staff based on their skills for the shift's section
                const shiftSectionId = assignmentModal.shift?.section_id;
                
                // If no section is assigned to the shift, show all staff
                if (!shiftSectionId) return true;
                
                // If staff has no skills defined (empty array), they can work in any section
                if (!s.skills || s.skills.length === 0) return true;
                
                // Check if staff has the skill for the shift's section
                return s.skills.includes(shiftSectionId);
              }).map((s) => {
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

      {/* Save Template Modal */}
      {saveTemplateModal.isOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm grid place-items-center p-4 z-50">
          <div className="w-full max-w-md bg-white dark:bg-neutral-950 rounded-2xl shadow-2xl p-0 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-neutral-800">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Save Current Week as Template</h2>
              <button
                type="button"
                onClick={() => setSaveTemplateModal({ isOpen: false })}
                className="h-8 w-8 rounded-lg inline-grid place-items-center hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <X className="size-4 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Template Name</label>
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g. Busy Week Setup"
                className="w-full h-10 rounded-lg border px-3 bg-white/80 dark:bg-neutral-900 border-gray-300 dark:border-neutral-700 text-gray-900 dark:text-white"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">This will capture all shifts in the current week.</p>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-neutral-800 bg-gray-50/50 dark:bg-neutral-900/50">
              <button
                onClick={() => setSaveTemplateModal({ isOpen: false })}
                className="h-10 px-4 rounded-lg border border-gray-300 dark:border-neutral-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveCurrentWeekAsTemplate}
                disabled={!templateName.trim()}
                className="h-10 px-4 rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Choose Auto Shift Source Modal */}
      {chooseAutoShiftModal.isOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm grid place-items-center p-4 z-50">
          <div className="w-full max-w-xl bg-white dark:bg-neutral-950 rounded-2xl shadow-2xl p-0 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-neutral-800">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Auto Shift</h2>
              <button
                type="button"
                onClick={() => setChooseAutoShiftModal({ isOpen: false })}
                className="h-8 w-8 rounded-lg inline-grid place-items-center hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <X className="size-4 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <button
                onClick={() => { setChooseAutoShiftModal({ isOpen: false }); void (async () => { await handleAutoShift(); })(); }}
                className="w-full flex items-center gap-3 p-3 border border-gray-200 dark:border-neutral-700 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
              >
                <FaMagic className="w-4 h-4 text-green-600" />
                <div className="text-left">
                  <div className="font-medium text-gray-900 dark:text-white">Copy from Previous Week</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Uses the same shifts from last week</div>
                </div>
              </button>

              <div className="pt-2">
                <div className="flex items-center gap-2 mb-2">
                  <FaLayerGroup className="w-3 h-3 text-gray-500" />
                  <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">Saved Templates</div>
                </div>
                {loadingTemplates && (
                  <div className="text-sm text-gray-500 dark:text-gray-400">Loading templates...</div>
                )}
                {!loadingTemplates && templates.length === 0 && (
                  <div className="text-sm text-gray-500 dark:text-gray-400">No templates yet. Save your current week to create one.</div>
                )}
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {templates.map((t) => (
                    <div
                      key={t.id}
                      className="w-full p-3 border border-gray-200 dark:border-neutral-700 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors flex items-center justify-between gap-3"
                    >
                      <button
                        onClick={() => void (async () => { await applyTemplateToCurrentWeek(t); })()}
                        className="flex-1 text-left"
                      >
                        <div className="font-medium text-gray-900 dark:text-white">{t.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{t.created_at}</div>
                      </button>
                      <button
                        onClick={() => setTemplateDeleteConfirm({ template: t, isOpen: true })}
                        className="px-2 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700"
                        title="Delete template"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-neutral-800 bg-gray-50/50 dark:bg-neutral-900/50">
              <button
                onClick={() => setChooseAutoShiftModal({ isOpen: false })}
                className="h-10 px-4 rounded-lg border border-gray-300 dark:border-neutral-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
              >
                Close
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
        variant={errorModal.variant}
        emailResults={errorModal.emailResults}
        staffWithoutEmails={errorModal.staffWithoutEmails}
      />

      {/* Delete Template Confirmation */}
      <ConfirmationDialog
        isOpen={templateDeleteConfirm.isOpen}
        onClose={() => setTemplateDeleteConfirm({ template: null, isOpen: false })}
        onConfirm={confirmDeleteTemplate}
        title="Delete Template"
        message={`Are you sure you want to delete template '${templateDeleteConfirm.template?.name ?? ''}'? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />

      {/* Roster Confirmation Modal */}
      {rosterConfirmModal.isOpen && rosterConfirmModal.staffRosters && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-neutral-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Send Roster Confirmation
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Week: {rosterConfirmModal.weekStart && rosterConfirmModal.weekEnd ? 
                  `${format(rosterConfirmModal.weekStart, 'MMM dd')} - ${format(rosterConfirmModal.weekEnd, 'MMM dd, yyyy')}` : ''}
              </p>
            </div>
            
            <div className="p-6 max-h-96 overflow-y-auto">
              <div className="space-y-4">
                {rosterConfirmModal.staffRosters.map((roster) => (
                  <div key={roster.staffId} className="border border-gray-200 dark:border-neutral-600 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">{roster.staffName}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{roster.staffEmail}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {roster.totalHours.toFixed(1)}h total
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {roster.totalBillableHours.toFixed(1)}h billable
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {roster.shifts.length} shift{roster.shifts.length !== 1 ? 's' : ''} scheduled
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-200 dark:border-neutral-700 flex justify-end gap-3">
              <button
                onClick={() => setRosterConfirmModal({ isOpen: false, staffRosters: null, weekStart: null, weekEnd: null })}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-neutral-700 hover:bg-gray-200 dark:hover:bg-neutral-600 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSendRoster}
                disabled={sendingRoster}
                className="px-4 py-2 bg-purple-600 text-white hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
              >
                {sendingRoster ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <FaEnvelope className="w-4 h-4" />
                    Send Roster
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
}
