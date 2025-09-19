"use server";

import { Resend } from 'resend';
import { ShiftReminderEmail } from '@/emails/ShiftReminder';
import { MagicLinkInviteEmail } from '@/emails/MagicLinkInvite';
import { createServiceRoleClient } from '@/lib/supabase/server';
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

export async function sendMagicLinkInvite(inviteeEmail: string) {
  try {
    if (!resend || !process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not configured');
    }

    const supabase = await createServiceRoleClient();
    // Detect existing profile
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .ilike('email', inviteeEmail)
      .maybeSingle();
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: inviteeEmail,
      options: { redirectTo: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000' }
    });
    if (error || !data?.properties?.action_link) {
      throw new Error(error?.message || 'Failed to generate magic link');
    }

    const actionUrl = data.properties.action_link as string;

    const { data: sent, error: sendErr } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'OperateFlow <noreply@yourdomain.com>',
      to: [inviteeEmail],
      subject: existing ? 'Your OperateFlow sign-in link' : 'You’re invited to OperateFlow',
      react: MagicLinkInviteEmail({ inviteeEmail, actionUrl, isExistingUser: Boolean(existing) }),
    });

    if (sendErr) {
      return { success: false, error: sendErr.message };
    }
    return { success: true, messageId: sent?.id };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
