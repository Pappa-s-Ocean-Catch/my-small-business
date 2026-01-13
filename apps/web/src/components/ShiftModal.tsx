"use client";

import { useState, useCallback, useEffect } from "react";
import { FaTimes } from "react-icons/fa";

interface ShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (shiftData: {
    start_time: string;
    end_time: string;
    notes: string;
    non_billable_hours: number;
    section_id: string | null;
    staff_id: string | null;
  }) => void;
  initialData?: {
    start_time: string;
    end_time: string;
    notes: string;
    non_billable_hours: number;
    section_id: string | null;
    staff_id: string | null;
  };
  selectedDate?: string;
  sections: Array<{ id: string; name: string; active: boolean }>;
  staff: Array<{ id: string; name: string; is_available: boolean; skills: string[] }>;
  staffRates: Array<{ id: string; staff_id: string; rate_type: string; rate: number; effective_date: string; end_date: string; is_current: boolean }>;
  isAdmin: boolean;
  isNewShift: boolean;
}

export function ShiftModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  selectedDate,
  sections,
  staff,
  staffRates,
  isAdmin,
  isNewShift
}: ShiftModalProps) {
  // Compute the selected date directly from props
  const currentSelectedDate = selectedDate || initialData?.start_time?.slice(0, 10) || "";

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

  // Function to get staff rate for a specific date
  const getStaffRateForDate = useCallback((staffId: string, date: string) => {
    const dateObj = new Date(date);
    const dayOfWeek = dateObj.getDay(); // 0=Sunday, 1=Monday, etc.
    
    // Map day of week to rate type
    const rateTypeMap: { [key: number]: string } = {
      0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat'
    };
    const rateType = rateTypeMap[dayOfWeek];
    
    // First try to find specific day rate
    let rate = staffRates.find(r => 
      r.staff_id === staffId && 
      r.rate_type === rateType &&
      r.effective_date <= date && 
      r.end_date >= date &&
      r.is_current
    );
    
    // If no specific day rate, fall back to default rate
    if (!rate) {
      rate = staffRates.find(r => 
        r.staff_id === staffId && 
        r.rate_type === 'default' &&
        r.effective_date <= date && 
        r.end_date >= date &&
        r.is_current
      );
    }
    
    return rate?.rate || 0;
  }, [staffRates]);

  // Local state for form changes
  const [localFormData, setLocalFormData] = useState({
    start_time: "",
    end_time: "",
    notes: "",
    non_billable_hours: 0,
    section_id: "",
    staff_id: null as string | null
  });

  // Update local form data when initialData changes
  useEffect(() => {
    if (initialData) {
      setLocalFormData({
        start_time: initialData.start_time ? formatTimeForDisplay(initialData.start_time) : "",
        end_time: initialData.end_time ? formatTimeForDisplay(initialData.end_time) : "",
        notes: initialData.notes || "",
        non_billable_hours: initialData.non_billable_hours || 0,
        section_id: initialData.section_id || "",
        staff_id: initialData.staff_id || null
      });
    }
  }, [initialData]);

  // Use local form data if available, otherwise use computed from props
  const formData = localFormData.start_time ? localFormData : {
    start_time: initialData?.start_time ? formatTimeForDisplay(initialData.start_time) : "",
    end_time: initialData?.end_time ? formatTimeForDisplay(initialData.end_time) : "",
    notes: initialData?.notes || "",
    non_billable_hours: initialData?.non_billable_hours || 0,
    section_id: initialData?.section_id || "",
    staff_id: initialData?.staff_id || null
  };

  // Function to calculate shift duration in hours
  const calculateShiftDuration = useCallback(() => {
    if (!formData.start_time || !formData.end_time) return 0;
    
    const startTime = new Date(`${currentSelectedDate}T${formData.start_time}:00`);
    const endTime = new Date(`${currentSelectedDate}T${formData.end_time}:00`);
    
    // Handle overnight shifts (end time is next day)
    if (endTime <= startTime) {
      endTime.setDate(endTime.getDate() + 1);
    }
    
    const durationMs = endTime.getTime() - startTime.getTime();
    return durationMs / (1000 * 60 * 60); // Convert to hours
  }, [formData.start_time, formData.end_time, currentSelectedDate]);

  // Function to calculate total cost for a staff member
  const calculateTotalCost = useCallback((staffId: string) => {
    const rate = getStaffRateForDate(staffId, currentSelectedDate);
    const duration = calculateShiftDuration();
    return rate * duration;
  }, [getStaffRateForDate, calculateShiftDuration, currentSelectedDate]);

  // Debug: Log the selected date
  console.log('🔍 ShiftModal selectedDate prop:', selectedDate);
  console.log('🔍 ShiftModal initialData start_time:', initialData?.start_time);
  console.log('🔍 ShiftModal currentSelectedDate:', currentSelectedDate);
  console.log('🔍 ShiftModal formData:', formData);

  const handleInputChange = useCallback((field: string, value: string | number | null) => {
    setLocalFormData(prev => ({ ...prev, [field]: value }));
  }, []);

      const handleSave = useCallback(() => {
        // Create Date objects in Melbourne timezone explicitly
        // Melbourne is UTC+10 (or UTC+11 during daylight saving)
        const melbourneOffset = 10; // UTC+10 for Melbourne (adjust for DST if needed)
        
        // Parse the time components
        const [startHour, startMin] = formData.start_time.split(':').map(Number);
        const [endHour, endMin] = formData.end_time.split(':').map(Number);
        
        // Create Date objects in Melbourne timezone
        const startDateTime = new Date(`${currentSelectedDate}T${formData.start_time}:00+10:00`);
        const endDateTime = new Date(`${currentSelectedDate}T${formData.end_time}:00+10:00`);
        
        // Debug: Log what's being saved
        console.log('🔍 Shift Modal Debug - Form Submission:', {
          selectedDate: currentSelectedDate,
          localTimeInput: `${formData.start_time} - ${formData.end_time}`,
          startDateTime: startDateTime.toString(),
          endDateTime: endDateTime.toString(),
          startUTC: startDateTime.toISOString(),
          endUTC: endDateTime.toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          offset: new Date().getTimezoneOffset(),
          melbourneOffset: melbourneOffset,
          manualCalculation: {
            startHour,
            startMin,
            endHour,
            endMin
          },
          formData: formData,
          currentSelectedDate: currentSelectedDate
        });
        
        const shiftData = {
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          notes: formData.notes,
          non_billable_hours: formData.non_billable_hours,
          section_id: formData.section_id || null,
          staff_id: formData.staff_id
        };
        
        console.log('🔍 Shift Modal Debug - Data being passed to onSave:', shiftData);
        
        onSave(shiftData);
        onClose();
      }, [formData, currentSelectedDate, onSave, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-700 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-neutral-700">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            {isNewShift ? 'Add Shift' : 'Edit Shift'}
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-600 dark:text-gray-300 transition-colors"
          >
            <FaTimes className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 max-h-[calc(90vh-140px)] overflow-y-auto">

          {/* Form Fields */}
          <div className="space-y-4">
            {/* Time Fields - 2 Column */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Start Time
                </label>
                <input
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => handleInputChange('start_time', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  End Time
                </label>
                <input
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => handleInputChange('end_time', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Duration Display */}
            {formData.start_time && formData.end_time && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Duration:</strong> {(() => {
                    const [startHour, startMin] = formData.start_time.split(':').map(Number);
                    const [endHour, endMin] = formData.end_time.split(':').map(Number);
                    const startMinutes = startHour * 60 + startMin;
                    const endMinutes = endHour * 60 + endMin;
                    const totalMinutes = endMinutes - startMinutes;
                    const hours = Math.floor(totalMinutes / 60);
                    const minutes = totalMinutes % 60;
                    return `${hours}h ${minutes}m`;
                  })()}
                </div>
              </div>
            )}

            {/* Section and Non-billable - 2 Column */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Section
                </label>
                <select
                  value={formData.section_id}
                  onChange={(e) => handleInputChange('section_id', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select section</option>
                  {sections.filter(s => s.active).map(section => (
                    <option key={section.id} value={section.id}>
                      {section.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Non-billable Hours
                </label>
                <input
                  type="number"
                  step="0.25"
                  min="0"
                  value={formData.non_billable_hours}
                  onChange={(e) => handleInputChange('non_billable_hours', Number(e.target.value))}
                  placeholder="0.5 for 30min"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                rows={3}
                placeholder="Optional notes for this shift..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>

            {/* Staff Assignment - Only for admins */}
            {isAdmin && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Assign Staff
                </label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {/* Unassigned option */}
                  <button
                    onClick={() => handleInputChange('staff_id', null)}
                    className={`w-full p-3 text-left border rounded-lg transition-colors ${
                      formData.staff_id === null 
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                        : 'border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <div className="font-medium text-gray-900 dark:text-white">Unassigned</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">No staff assigned</div>
                  </button>
                  
                  {/* Staff options */}
                  {staff.filter(s => {
                    if (!s.is_available) return false;
                    
                    // If no section is selected, show all available staff
                    if (!formData.section_id) return true;
                    
                    // If staff has no skills defined (empty array), they can work in any section
                    if (!s.skills || s.skills.length === 0) return true;
                    
                    // Check if staff has the skill for the selected section
                    return s.skills.includes(formData.section_id);
                  }).map((s) => {
                    const hourlyRate = getStaffRateForDate(s.id, currentSelectedDate);
                    const totalCost = calculateTotalCost(s.id);
                    const duration = calculateShiftDuration();
                    
                    return (
                      <button
                        key={s.id}
                        onClick={() => handleInputChange('staff_id', s.id)}
                        className={`w-full p-3 text-left border rounded-lg transition-colors ${
                          formData.staff_id === s.id 
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                            : 'border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800'
                        }`}
                      >
                        <div className="font-medium text-gray-900 dark:text-white">{s.name}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          ${hourlyRate}/hour
                          {duration > 0 && (
                            <span className="ml-2 font-medium text-green-600 dark:text-green-400">
                              Total: ${totalCost.toFixed(2)} ({duration.toFixed(1)}h)
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-neutral-700 bg-gray-50/50 dark:bg-neutral-900/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            {isNewShift ? 'Create Shift' : 'Update Shift'}
          </button>
        </div>
      </div>
    </div>
  );
}
