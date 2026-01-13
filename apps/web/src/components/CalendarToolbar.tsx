"use client";

import { useState } from "react";
import { FaEnvelope } from "react-icons/fa";
import { sendShiftReminder } from "@/app/actions/email";
import { LoadingSpinner } from "./Loading";
import { format } from "date-fns";
import { toast } from 'react-toastify';

interface CalendarToolbarProps {
  day: Date;
  shifts: Array<{
    id: string;
    staff_id: string | null;
    start_time: string;
    end_time: string;
    staff?: {
      name: string;
      email: string | null;
    } | null;
  }>;
  isAdmin: boolean;
}

export function CalendarToolbar({ day, shifts, isAdmin }: CalendarToolbarProps) {
  const [sendingEmails, setSendingEmails] = useState<Set<string>>(new Set());

  if (!isAdmin) return null;

  const assignedShifts = shifts.filter(shift => shift.staff_id && shift.staff?.email);
  
  // Only show reminders for future dates
  const isFutureDate = day > new Date();
  const canSendReminders = isFutureDate && assignedShifts.length > 0;

  const handleSendReminders = async () => {
    if (assignedShifts.length === 0) return;

    setSendingEmails(new Set(assignedShifts.map(s => s.id)));

    try {
      const emailPromises = assignedShifts.map(async (shift) => {
        if (!shift.staff?.email || !shift.staff?.name) return;

        const startTime = format(new Date(shift.start_time), 'h:mm a');
        const endTime = format(new Date(shift.end_time), 'h:mm a');

        const result = await sendShiftReminder(
          shift.staff.email,
          shift.staff.name,
          day,
          startTime,
          endTime
        );

        if (!result.success) {
          throw new Error(result.error || 'Failed to send');
        }
      });

      await Promise.all(emailPromises);
      toast.success('Reminders sent');
    } catch (error) {
      toast.error('Failed to send some reminders');
    } finally {
      setSendingEmails(new Set());
    }
  };

  if (!canSendReminders) return null;

  const isLoading = sendingEmails.size > 0;

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-neutral-900 border-t border-gray-200 dark:border-neutral-700 rounded-b-2xl">
      <div className="flex items-center justify-between px-3 py-2">
        <div className="text-xs text-gray-500">
          {assignedShifts.length} assigned shift{assignedShifts.length !== 1 ? 's' : ''}
        </div>
        <button
          onClick={handleSendReminders}
          disabled={isLoading}
          className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? (
            <LoadingSpinner size="sm" />
          ) : (
            <FaEnvelope className="w-3 h-3" />
          )}
          Send Reminders
        </button>
      </div>
    </div>
  );
}
