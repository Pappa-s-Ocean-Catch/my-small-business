"use client";

import { startOfWeek, endOfWeek } from "date-fns";
import { useEffect, useState } from "react";
import { getBrandSettings } from "@/lib/brand-settings";

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
  const [brandSettings, setBrandSettings] = useState<{ business_name: string; logo_url: string | null; slogan: string | null } | null>(null);
  const MEL_TZ = 'Australia/Melbourne';

  const toYmd = (d: Date): string => new Date(d).toLocaleDateString('en-CA', { timeZone: MEL_TZ });
  const toDdMm = (d: Date): string => {
    const [y, m, day] = toYmd(d).split('-');
    return `${day}/${m}`;
  };
  const toDdMmYyyyDash = (d: Date): string => {
    const [y, m, day] = toYmd(d).split('-');
    return `${day}-${m}-${y}`;
  };
  
  useEffect(() => {
    const loadBrandSettings = async () => {
      const settings = await getBrandSettings();
      setBrandSettings(settings);
    };
    loadBrandSettings();
  }, []);
  
  const startOfThisWeek = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(startOfThisWeek);
    date.setDate(date.getDate() + i);
    return date;
  });

  return (
    <div className="calendar-print-container print-only">
      {/* Branding Header */}
      {brandSettings && (
        <div className="print-branding-header" style={{ marginBottom: '20px', textAlign: 'center' }}>
          {brandSettings.logo_url && (
            <img 
              src={brandSettings.logo_url} 
              alt={brandSettings.business_name} 
              style={{ height: '40px', marginBottom: '10px' }}
            />
          )}
          <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '5px' }}>
            {brandSettings.business_name}
          </div>
          {brandSettings.slogan && (
            <div style={{ fontSize: '12px', color: '#666' }}>
              {brandSettings.slogan}
            </div>
          )}
        </div>
      )}
      
      <div className="print-title" style={{ fontSize: '24px', fontWeight: 700, marginBottom: '6px' }}>SHIFT SCHEDULE</div>
      <div className="print-date-range" style={{ fontSize: '18px' }}>
        {toDdMmYyyyDash(startOfThisWeek)} - {toDdMmYyyyDash(endOfWeek(startOfThisWeek, { weekStartsOn: 1 }))}
      </div>
      
      <table className="print-shift-grid">
        <thead>
          <tr>
            <th className="section-header" style={{ fontSize: '16px', textAlign: 'left' }}>Section</th>
            {weekDays.map((day) => (
              <th key={toYmd(day)} className="day-header" style={{ fontSize: '16px' }}>
                {day.toLocaleDateString('en-AU', { timeZone: MEL_TZ, weekday: 'short' })} {toDdMm(day)}
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
                <td className="section-header" style={{ fontSize: '16px' }}>{section.name}</td>
                {weekDays.map((day) => {
                  const dayKey = toYmd(day);
                  const dayShifts = shifts.filter(s => 
                    new Date(s.start_time).toLocaleDateString('en-CA', { timeZone: MEL_TZ }) === dayKey && 
                    s.section_id === section.id &&
                    s.staff_id !== null // Only show assigned shifts
                  );
                  
                  return (
                    <td key={toYmd(day)}>
                      {dayShifts.length > 0 ? (
                        <div className="print-shift-details">
                          {dayShifts.map((shift) => {
                            const staffMember = staff.find(s => s.id === shift.staff_id);
                            const startTime = new Date(shift.start_time).toLocaleTimeString('en-AU', { 
                              timeZone: MEL_TZ,
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: false
                            });
                            const endTime = new Date(shift.end_time).toLocaleTimeString('en-AU', { 
                              timeZone: MEL_TZ,
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: false
                            });
                            
                            return (
                              <div key={shift.id} style={{ marginBottom: '8px' }}>
                                <div className="print-shift-staff" style={{ fontSize: '16px', fontWeight: 600 }}>
                                  {staffMember?.name}
                                </div>
                                <div className="print-shift-time" style={{ fontSize: '15px' }}>
                                  {startTime} - {endTime}
                                </div>
                                {shift.notes && (
                                  <div className="print-shift-notes" style={{ fontSize: '14px' }}>
                                    {shift.notes}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="print-shift-details" style={{ color: '#666', fontStyle: 'italic', fontSize: '14px' }}>
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
