"use server";

import { Resend } from 'resend';
import { ShiftReminderEmail } from '@/emails/ShiftReminder';
import { format } from 'date-fns';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function sendShiftReminder(
  staffEmail: string,
  staffName: string,
  shiftDate: Date,
  startTime: string,
  endTime: string
) {
  try {
    if (!resend || !process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not configured');
    }

    const formattedDate = format(shiftDate, 'EEEE, MMMM do, yyyy');
    const formattedTime = `${startTime} - ${endTime}`;

    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'OperateFlow <noreply@yourdomain.com>', // Replace with your verified domain
      to: [staffEmail],
      subject: `Shift Reminder - ${formattedDate}`,
      react: ShiftReminderEmail({
        staffName,
        shiftDate: formattedDate,
        shiftTime: formattedTime,
        businessName: 'OperateFlow',
      }),
    });

    if (error) {
      console.error('Error sending email:', error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error('Error in sendShiftReminder:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
}
