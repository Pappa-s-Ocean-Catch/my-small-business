import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { Resend } from 'resend';
import { verifyAutomationWebhook } from '@/lib/webhook-verification';

const resend = new Resend(process.env.RESEND_API_KEY);

// Debug: Check Resend configuration
console.log('📧 Resend configuration check:');
console.log('  - RESEND_API_KEY exists:', !!process.env.RESEND_API_KEY);
console.log('  - RESEND_API_KEY length:', process.env.RESEND_API_KEY?.length || 0);
console.log('  - RESEND_API_KEY prefix:', process.env.RESEND_API_KEY?.substring(0, 10) + '...' || 'undefined');

export async function POST(request: NextRequest) {
  try {
    // Verify webhook signature and get parsed body
    const verification = await verifyAutomationWebhook(request);
    if (!verification.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { schedule_id, job_type } = verification.body as { schedule_id: string; job_type: string };

    if (job_type !== 'missing_shift_allocation') {
      return NextResponse.json({ error: 'Invalid job type' }, { status: 400 });
    }

    const supabase = await createServiceRoleClient();

    // Get the automation schedule to access custom configuration
    const { data: schedule, error: scheduleError } = await supabase
      .from('automation_schedules')
      .select('custom_config')
      .eq('id', schedule_id)
      .single();

    if (scheduleError || !schedule) {
      console.error('Error fetching schedule:', scheduleError);
      console.error('Schedule ID:', schedule_id);
      console.error('Job type:', job_type);
      return NextResponse.json({ 
        error: 'Schedule not found', 
        details: scheduleError,
        schedule_id,
        job_type 
      }, { status: 404 });
    }

    const customConfig = schedule.custom_config || {};
    const daysToCheck = customConfig.days_to_check || 7;
    const recipientEmails = customConfig.recipient_emails || [];

    // Calculate date range
    const today = new Date();
    const endDate = new Date();
    endDate.setDate(today.getDate() + daysToCheck);

    // Get all shifts in the date range
    const { data: shifts, error: shiftsError } = await supabase
      .from('shifts')
      .select(`
        id,
        start_time,
        end_time,
        staff_id,
        notes
      `)
      .gte('start_time', today.toISOString())
      .lte('start_time', endDate.toISOString());

    if (shiftsError) {
      console.error('Error fetching shifts:', shiftsError);
      return NextResponse.json({ error: 'Failed to fetch shifts' }, { status: 500 });
    }

    // Group shifts by date
    const shiftsByDate: Record<string, unknown[]> = {};
    const datesWithShifts = new Set<string>();

    (shifts || []).forEach(shift => {
      const shiftDate = new Date(shift.start_time).toISOString().split('T')[0];
      if (!shiftsByDate[shiftDate]) {
        shiftsByDate[shiftDate] = [];
      }
      shiftsByDate[shiftDate].push(shift);
      datesWithShifts.add(shiftDate);
    });

    // Find dates without shifts
    const datesWithoutShifts: string[] = [];
    const currentDate = new Date(today);
    
    for (let i = 0; i < daysToCheck; i++) {
      const checkDate = new Date(currentDate);
      checkDate.setDate(currentDate.getDate() + i);
      const dateStr = checkDate.toISOString().split('T')[0];
      
      if (!datesWithShifts.has(dateStr)) {
        datesWithoutShifts.push(dateStr);
      }
    }

    // If no missing shifts found, log success and return
    if (datesWithoutShifts.length === 0) {
      console.log('✅ No missing shift allocations found - all days are covered!');
      console.log('📊 Summary:', {
        daysChecked: daysToCheck,
        totalShifts: shifts?.length || 0,
        missingDays: 0
      });

      console.log('📝 Logging successful automation execution...');
      const logResult = await supabase.from('automation_logs').insert({
        schedule_id,
        job_type: 'missing_shift_allocation',
        status: 'success',
        message: 'All days have shift allocations',
        details: { 
          days_checked: daysToCheck,
          total_shifts: shifts?.length || 0,
          missing_days: 0
        },
        executed_at: new Date().toISOString(),
      });

      if (logResult.error) {
        console.error('❌ Error logging automation execution:', logResult.error);
      } else {
        console.log('✅ Automation execution logged successfully');
      }

      // Update the last_run_at timestamp
      console.log('⏰ Updating last_run_at timestamp...');
      const updateResult = await supabase
        .from('automation_schedules')
        .update({ last_run_at: new Date().toISOString() })
        .eq('id', schedule_id);

      if (updateResult.error) {
        console.error('❌ Error updating last_run_at:', updateResult.error);
      } else {
        console.log('✅ last_run_at timestamp updated successfully');
      }

      console.log('🎉 Missing shift allocation automation completed - no notifications needed');

      return NextResponse.json({
        success: true,
        message: 'All days have shift allocations',
        results: {
          days_checked: daysToCheck,
          total_shifts: shifts?.length || 0,
          missing_days: 0,
          dates_without_shifts: []
        },
      });
    }

    // Get admin emails if no custom recipients specified
    let emailRecipients = recipientEmails;
    console.log('📧 Email configuration:');
    console.log('  - Custom recipient emails:', recipientEmails);
    console.log('  - Days to check:', daysToCheck);
    console.log('  - Missing shift days found:', datesWithoutShifts.length);
    
    if (emailRecipients.length === 0) {
      console.log('📧 No custom recipients, fetching admin emails...');
      const { data: admins, error: adminsError } = await supabase
        .from('profiles')
        .select('email')
        .eq('role_slug', 'admin');

      if (adminsError) {
        console.error('❌ Error fetching admin emails:', adminsError);
        return NextResponse.json({ error: 'Failed to fetch admin emails' }, { status: 500 });
      }

      emailRecipients = admins?.map(admin => admin.email).filter(Boolean) || [];
      console.log('📧 Admin emails found:', emailRecipients);
    }

    if (emailRecipients.length === 0) {
      console.error('❌ No recipient emails found - cannot send notifications');
      return NextResponse.json({ error: 'No recipient emails found' }, { status: 500 });
    }

    console.log('📧 Final recipient list:', emailRecipients);

    // Format dates for display
    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    };

    // Prepare email content
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">⚠️ Missing Shift Allocation Alert - OperateFlow</h2>
        
        <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <h3 style="color: #dc2626; margin: 0 0 12px 0;">Missing Shift Allocations (${datesWithoutShifts.length} days)</h3>
          
          <p style="margin: 0 0 16px 0; color: #374151;">
            The following days in the next ${daysToCheck} days do not have any shift allocations:
          </p>
          
          <ul style="margin: 0; padding-left: 20px; color: #374151;">
            ${datesWithoutShifts.map(date => `<li style="margin-bottom: 8px;">${formatDate(date)}</li>`).join('')}
          </ul>
        </div>

        <div style="background-color: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <h4 style="color: #0369a1; margin: 0 0 8px 0;">Summary</h4>
          <ul style="margin: 0; color: #374151;">
            <li>Days checked: ${daysToCheck}</li>
            <li>Total shifts found: ${shifts?.length || 0}</li>
            <li>Days without shifts: ${datesWithoutShifts.length}</li>
          </ul>
        </div>

        <div style="margin-top: 24px; padding: 16px; background-color: #f3f4f6; border-radius: 8px;">
          <p style="margin: 0; color: #6b7280;">
            Please review your schedule and allocate shifts for these days.
            <br><br>
            <a href="${process.env.NEXT_PUBLIC_SITE_URL}/calendar" style="color: #3b82f6; text-decoration: none;">
              View Calendar Dashboard →
            </a>
          </p>
        </div>
      </div>
    `;

    // Send email to all recipients
    console.log('📧 Starting email sending process...');
    console.log('📧 Email content preview:', {
      subject: `Missing Shift Allocation Alert - ${datesWithoutShifts.length} Days Need Coverage`,
      htmlLength: emailHtml.length,
      fromAddress: process.env.EMAIL_FROM!
    });
    
    const emailResults = [];
    
    for (const recipientEmail of emailRecipients) {
      console.log(`📧 Sending email to: ${recipientEmail}`);
      try {
        const emailSubject = `Missing Shift Allocation Alert - ${datesWithoutShifts.length} Days Need Coverage`;
        console.log(`📧 Email subject: ${emailSubject}`);
        
        const result = await resend.emails.send({
          from: process.env.EMAIL_FROM!,
          to: [recipientEmail],
          subject: emailSubject,
          html: emailHtml,
        });

        console.log(`📧 Resend API response for ${recipientEmail}:`, {
          data: result.data,
          error: result.error,
          fullResult: result
        });

        if (result.error) {
          console.error(`❌ Resend API error for ${recipientEmail}:`, result.error);
          emailResults.push({
            email: recipientEmail,
            success: false,
            error: result.error.message || 'Resend API error',
          });
        } else {
          console.log(`✅ Email sent successfully to ${recipientEmail}:`, {
            messageId: result.data?.id,
            status: 'success'
          });

          emailResults.push({
            email: recipientEmail,
            success: true,
            message_id: result.data?.id,
          });
        }
      } catch (error) {
        console.error(`❌ Error sending email to ${recipientEmail}:`, error);
        emailResults.push({
          email: recipientEmail,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    console.log('📧 Email sending completed. Results:', emailResults);

    // Log the automation execution
    console.log('📝 Logging automation execution to database...');
    const logResult = await supabase.from('automation_logs').insert({
      schedule_id,
      job_type: 'missing_shift_allocation',
      status: 'success',
      message: `Found ${datesWithoutShifts.length} days without shift allocations`,
      details: { 
        days_checked: daysToCheck,
        total_shifts: shifts?.length || 0,
        missing_days: datesWithoutShifts.length,
        dates_without_shifts: datesWithoutShifts,
        email_results: emailResults,
      },
      executed_at: new Date().toISOString(),
    });

    if (logResult.error) {
      console.error('❌ Error logging automation execution:', logResult.error);
    } else {
      console.log('✅ Automation execution logged successfully');
    }

    // Update the last_run_at timestamp
    console.log('⏰ Updating last_run_at timestamp...');
    const updateResult = await supabase
      .from('automation_schedules')
      .update({ last_run_at: new Date().toISOString() })
      .eq('id', schedule_id);

    if (updateResult.error) {
      console.error('❌ Error updating last_run_at:', updateResult.error);
    } else {
      console.log('✅ last_run_at timestamp updated successfully');
    }

    const responseData = {
      success: true,
      message: `Found ${datesWithoutShifts.length} days without shift allocations`,
      results: {
        days_checked: daysToCheck,
        total_shifts: shifts?.length || 0,
        missing_days: datesWithoutShifts.length,
        dates_without_shifts: datesWithoutShifts,
        email_results: emailResults,
      },
    };

    console.log('🎉 Missing shift allocation automation completed successfully:', {
      missingDays: datesWithoutShifts.length,
      emailsSent: emailResults.filter(r => r.success).length,
      emailsFailed: emailResults.filter(r => !r.success).length,
      totalShifts: shifts?.length || 0
    });

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Missing shift allocation automation error:', error);
    
    // Log the error
    try {
      const supabase = await createServiceRoleClient();
      await supabase.from('automation_logs').insert({
        schedule_id: 'unknown',
        job_type: 'missing_shift_allocation',
        status: 'failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: { error: error instanceof Error ? error.stack : error },
        executed_at: new Date().toISOString(),
      });
    } catch (logError) {
      console.error('Failed to log automation error:', logError);
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
