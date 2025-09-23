'use server';

import { createServiceRoleClient } from '@/lib/supabase/server';
import { Resend } from 'resend';
import { WeeklyRoster } from '@/emails/WeeklyRoster';
import { render } from '@react-email/render';
import { startOfWeek, endOfWeek, format } from 'date-fns';

const resend = new Resend(process.env.RESEND_API_KEY);

export interface RosterShift {
  id: string;
  start_time: string;
  end_time: string;
  notes: string | null;
  non_billable_hours?: number;
  section: {
    name: string;
    color: string;
  } | null;
}

export interface StaffRoster {
  staffId: string;
  staffName: string;
  staffEmail: string;
  shifts: RosterShift[];
  totalHours: number;
  totalBillableHours: number;
}

export interface SendRosterRequest {
  weekStart: Date;
  weekEnd: Date;
  staffRosters: StaffRoster[];
}

/**
 * Send weekly roster emails to staff members who have shifts scheduled
 */
export async function sendWeeklyRoster(request: SendRosterRequest): Promise<{ 
  success: boolean; 
  error?: string; 
  results?: Array<{ email: string; success: boolean; messageId?: string; error?: string }> 
}> {
  try {
    const { weekStart, weekEnd, staffRosters } = request;
    
    if (!staffRosters || staffRosters.length === 0) {
      return { success: false, error: 'No staff rosters provided' };
    }

    const weekStartFormatted = format(weekStart, 'MMM dd, yyyy');
    const weekEndFormatted = format(weekEnd, 'MMM dd, yyyy');

    // Filter out staff who don't have any shifts for this week
    const staffWithShifts = staffRosters.filter(roster => roster.shifts.length > 0);
    
    console.log(`📧 Sending weekly roster emails for ${weekStartFormatted} - ${weekEndFormatted}`);
    console.log(`📧 Total staff with shifts: ${staffWithShifts.length}`);
    console.log(`📧 Staff without shifts (skipped): ${staffRosters.length - staffWithShifts.length}`);

    if (staffWithShifts.length === 0) {
      return { 
        success: false, 
        error: 'No staff members have shifts scheduled for this week' 
      };
    }

    const emailResults = [];

    for (let i = 0; i < staffWithShifts.length; i++) {
      const roster = staffWithShifts[i];
      
      // Add delay between emails to avoid rate limiting (except for first email)
      if (i > 0) {
        console.log(`⏳ Waiting 500ms before sending next email...`);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      if (!roster.staffEmail) {
        console.log(`⚠️ Skipping ${roster.staffName} - no email address`);
        emailResults.push({
          email: 'No email',
          success: false,
          error: 'No email address provided'
        });
        continue;
      }

      try {
        console.log(`📧 Sending roster to ${roster.staffName} (${roster.staffEmail})`);
        
        // Render the email template
        const emailHtml = await render(WeeklyRoster({
          staffName: roster.staffName,
          weekStart: weekStartFormatted,
          weekEnd: weekEndFormatted,
          shifts: roster.shifts,
          totalHours: roster.totalHours,
          totalBillableHours: roster.totalBillableHours
        }));

        const emailSubject = `Weekly Roster - ${weekStartFormatted} to ${weekEndFormatted}`;

        // Retry logic for rate limiting
        let result;
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount <= maxRetries) {
          result = await resend.emails.send({
            from: process.env.EMAIL_FROM!,
            to: [roster.staffEmail],
            subject: emailSubject,
            html: emailHtml,
          });

          // Check if it's a rate limit error (429)
          if (result.error && result.error.message?.includes('Too many requests')) {
            retryCount++;
            if (retryCount <= maxRetries) {
              console.log(`⏳ Rate limit hit for ${roster.staffEmail}, retrying in 1 second... (attempt ${retryCount}/${maxRetries})`);
              await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
              continue;
            }
          }
          
          // If not a rate limit error or max retries reached, break
          break;
        }

        if (result && result.error) {
          console.error(`❌ Error sending roster to ${roster.staffEmail}:`, result.error);
          emailResults.push({
            email: roster.staffEmail,
            success: false,
            error: result.error.message || 'Resend API error'
          });
        } else if (result && result.data) {
          console.log(`✅ Roster sent successfully to ${roster.staffEmail}:`, {
            messageId: result.data.id,
            shifts: roster.shifts.length,
            totalHours: roster.totalHours
          });
          emailResults.push({
            email: roster.staffEmail,
            success: true,
            messageId: result.data.id
          });
        } else {
          console.error(`❌ Unexpected result for ${roster.staffEmail}:`, result);
          emailResults.push({
            email: roster.staffEmail,
            success: false,
            error: 'Unexpected result from email service'
          });
        }
      } catch (error) {
        console.error(`❌ Error processing roster for ${roster.staffEmail}:`, error);
        emailResults.push({
          email: roster.staffEmail,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const successCount = emailResults.filter(r => r.success).length;
    const failureCount = emailResults.filter(r => !r.success).length;

    console.log(`📧 Roster email sending completed:`, {
      total: staffRosters.length,
      successful: successCount,
      failed: failureCount
    });

    return {
      success: true,
      results: emailResults
    };
  } catch (error) {
    console.error('Error in sendWeeklyRoster:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error' 
    };
  }
}

/**
 * Get roster data for a specific week
 */
export async function getWeeklyRosterData(weekStart: Date): Promise<{ 
  success: boolean; 
  data?: StaffRoster[]; 
  error?: string 
}> {
  try {
    const supabase = await createServiceRoleClient();
    
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    const startOfThisWeek = startOfWeek(weekStart, { weekStartsOn: 1 });
    
    // Create timezone-aware week boundaries
    const weekStartDate = new Date(startOfThisWeek);
    weekStartDate.setHours(0, 0, 0, 0); // Start of day in local timezone
    const weekEndDate = new Date(weekEnd);
    weekEndDate.setHours(23, 59, 59, 999); // End of day in local timezone
    
    console.log(`📊 Fetching roster data for week: ${format(startOfThisWeek, 'yyyy-MM-dd')} to ${format(weekEnd, 'yyyy-MM-dd')}`);

    // Fetch shifts for the week with staff and section information
    const { data: shifts, error: shiftsError } = await supabase
      .from('shifts')
      .select(`
        id,
        staff_id,
        start_time,
        end_time,
        notes,
        non_billable_hours,
        section_id,
        staff:staff_id (
          id,
          name,
          email
        ),
        sections:section_id (
          id,
          name,
          color
        )
      `)
      .gte('start_time', weekStartDate.toISOString())
      .lte('start_time', weekEndDate.toISOString())
      .not('staff_id', 'is', null)
      .order('start_time', { ascending: true });

    if (shiftsError) {
      console.error('Error fetching shifts:', shiftsError);
      return { success: false, error: 'Failed to fetch shifts' };
    }

    if (!shifts || shifts.length === 0) {
      console.log('No shifts found for the week');
      return { success: true, data: [] };
    }

    // Group shifts by staff member
    const staffRosterMap = new Map<string, StaffRoster>();

    for (const shift of shifts) {
      if (!shift.staff || Array.isArray(shift.staff)) continue;

      const staff = shift.staff as { id: string; name: string; email: string };
      const staffId = staff.id;
      const staffName = staff.name;
      const staffEmail = staff.email;

      if (!staffRosterMap.has(staffId)) {
        staffRosterMap.set(staffId, {
          staffId,
          staffName,
          staffEmail,
          shifts: [],
          totalHours: 0,
          totalBillableHours: 0
        });
      }

      const roster = staffRosterMap.get(staffId)!;
      
      // Calculate shift duration
      const startTime = new Date(shift.start_time);
      const endTime = new Date(shift.end_time);
      const durationHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
      
      // Add shift to roster
      roster.shifts.push({
        id: shift.id,
        start_time: shift.start_time,
        end_time: shift.end_time,
        notes: shift.notes,
        non_billable_hours: shift.non_billable_hours,
        section: shift.sections && !Array.isArray(shift.sections) ? {
          name: (shift.sections as { name: string; color: string }).name,
          color: (shift.sections as { name: string; color: string }).color
        } : null
      });

      // Update totals
      roster.totalHours += durationHours;
      roster.totalBillableHours += durationHours - (shift.non_billable_hours || 0);
    }

    const staffRosters = Array.from(staffRosterMap.values());
    
    console.log(`📊 Roster data prepared:`, {
      totalStaff: staffRosters.length,
      totalShifts: shifts.length,
      staffWithShifts: staffRosters.filter(r => r.shifts.length > 0).length
    });

    return { success: true, data: staffRosters };
  } catch (error) {
    console.error('Error in getWeeklyRosterData:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error' 
    };
  }
}
