"use client";

import { format, startOfWeek, endOfWeek } from "date-fns";

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

type Shift = {
  id: string;
  staff_id: string | null;
  start_time: string;
  end_time: string;
  notes: string | null;
  non_billable_hours?: number;
  section_id?: string | null;
};

interface PrintScheduleProps {
  shifts: Shift[];
  staff: Staff[];
  staffRates: StaffRate[];
  sections: Section[];
  currentWeek: Date;
}

export default function PrintSchedule({ shifts, staff, staffRates, sections, currentWeek }: PrintScheduleProps) {
  const startOfThisWeek = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(startOfThisWeek);
    date.setDate(date.getDate() + i);
    return date;
  });

  return (
    <div className="calendar-print-container print-only">
      <div className="print-title">SHIFT SCHEDULE</div>
      <div className="print-date-range">
        {format(startOfThisWeek, 'dd-MM-yyyy')} - {format(endOfWeek(startOfThisWeek, { weekStartsOn: 1 }), 'dd-MM-yyyy')}
      </div>
      
      <table className="print-shift-grid">
        <thead>
          <tr>
            <th className="section-header">Section</th>
            {weekDays.map((day) => (
              <th key={day.toISOString()} className="day-header">
                {format(day, 'EEE dd/MM')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sections
            .filter(section => section.active)
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((section) => (
              <tr key={section.id}>
                <td className="section-header">{section.name}</td>
                {weekDays.map((day) => {
                  const dayKey = day.toISOString().slice(0, 10);
                  const dayShifts = shifts.filter(s => 
                    s.start_time.slice(0, 10) === dayKey && 
                    s.section_id === section.id &&
                    s.staff_id !== null // Only show assigned shifts
                  );
                  
                  return (
                    <td key={day.toISOString()}>
                      {dayShifts.length > 0 ? (
                        <div className="print-shift-details">
                          {dayShifts.map((shift) => {
                            const staffMember = staff.find(s => s.id === shift.staff_id);
                            const startTime = new Date(shift.start_time).toLocaleTimeString('en-AU', { 
                              timeZone: 'Australia/Melbourne',
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: false
                            });
                            const endTime = new Date(shift.end_time).toLocaleTimeString('en-AU', { 
                              timeZone: 'Australia/Melbourne',
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: false
                            });
                            
                            return (
                              <div key={shift.id} style={{ marginBottom: '4px' }}>
                                <div className="print-shift-staff">
                                  {staffMember?.name}
                                </div>
                                <div className="print-shift-time">
                                  {startTime} - {endTime}
                                </div>
                                {shift.notes && (
                                  <div className="print-shift-notes">
                                    {shift.notes}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="print-shift-details" style={{ color: '#666', fontStyle: 'italic' }}>
                          No shifts
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
