import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { sendShiftReminder } from '@/app/actions/email';
import { verifyAutomationWebhook } from '@/lib/webhook-verification';

export async function POST(request: NextRequest) {
  try {
    // Verify webhook signature and get parsed body
    const verification = await verifyAutomationWebhook(request);
    if (!verification.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { schedule_id, job_type } = verification.body as { schedule_id: string; job_type: string };

    if (job_type !== 'shift_reminder') {
      return NextResponse.json({ error: 'Invalid job type' }, { status: 400 });
    }

    // Get tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    // Get shifts for tomorrow
    const supabase = await createServiceRoleClient();
    const { data: shifts, error: shiftsError } = await supabase
      .from('shifts')
      .select(`
        id,
        start_time,
        end_time,
        notes,
        staff:staff_id (
          id,
          name,
          email
        )
      `)
      .gte('start_time', `${tomorrowStr}T00:00:00`)
      .lt('start_time', `${tomorrowStr}T23:59:59`);

    if (shiftsError) {
      console.error('Error fetching shifts:', shiftsError);
      return NextResponse.json({ error: 'Failed to fetch shifts' }, { status: 500 });
    }

    // Send reminders for each shift
    const results = [];
    for (const shift of shifts || []) {
      if (shift.staff && Array.isArray(shift.staff) && shift.staff[0]?.email) {
        try {
          const result = await sendShiftReminder(
            shift.staff[0].email,
            shift.staff[0].name,
            new Date(tomorrowStr),
            shift.start_time,
            shift.end_time
          );

          results.push({
            shift_id: shift.id,
            staff_email: shift.staff[0].email,
            success: result.success,
            error: result.error,
          });
        } catch (error) {
          console.error('Error sending reminder:', error);
          results.push({
            shift_id: shift.id,
            staff_email: shift.staff[0].email,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }

    // Log the automation execution
    await supabase.from('automation_logs').insert({
      schedule_id,
      job_type: 'shift_reminder',
      status: 'success',
      message: `Sent ${results.filter(r => r.success).length} reminders`,
      details: { results, total_shifts: shifts?.length || 0 },
      executed_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: `Processed ${shifts?.length || 0} shifts`,
      results,
    });

  } catch (error) {
    console.error('Shift reminder automation error:', error);
    
    // Log the error
    try {
      const supabase = await createServiceRoleClient();
      await supabase.from('automation_logs').insert({
        schedule_id: 'unknown',
        job_type: 'shift_reminder',
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
