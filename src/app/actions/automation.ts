'use server';

import { createServiceRoleClient } from '@/lib/supabase/server';
import { qstashAutomation, type AutomationSchedule, type CreateScheduleRequest } from '@/lib/qstash';

export async function getAutomationSchedules(currentUserId: string): Promise<{ success: boolean; data?: AutomationSchedule[]; error?: string }> {
  try {
    const supabase = await createServiceRoleClient();
    
    if (!currentUserId) {
      return { success: false, error: 'User ID required' };
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role_slug')
      .eq('id', currentUserId)
      .single();

    if (profileError || !profile || profile.role_slug !== 'admin') {
      return { success: false, error: 'Admin access required' };
    }
    
    const { data: schedules, error } = await supabase
      .from('automation_schedules')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching automation schedules:', error);
      return { success: false, error: 'Failed to fetch automation schedules' };
    }

    return { success: true, data: schedules || [] };
  } catch (error) {
    console.error('Error in getAutomationSchedules:', error);
    return { success: false, error: 'Internal server error' };
  }
}

export async function createAutomationSchedule(scheduleData: CreateScheduleRequest, currentUserId: string): Promise<{ success: boolean; data?: AutomationSchedule; error?: string }> {
  try {
    const supabase = await createServiceRoleClient();
    
    if (!currentUserId) {
      return { success: false, error: 'User ID required' };
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role_slug')
      .eq('id', currentUserId)
      .single();

    if (profileError || !profile || profile.role_slug !== 'admin') {
      return { success: false, error: 'Admin access required' };
    }

    // Create schedule in database
    const { data: schedule, error } = await supabase
      .from('automation_schedules')
      .insert({
        ...scheduleData,
        created_by: currentUserId,
        next_run_at: calculateNextRunTime(scheduleData.schedule_type, scheduleData.schedule_config),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating automation schedule:', error);
      return { success: false, error: 'Failed to create automation schedule' };
    }

    // Create QStash job if enabled
    if (schedule.is_enabled) {
      try {
        const qstashJobId = await qstashAutomation.createScheduledJob(schedule);
        
        // Update schedule with QStash job ID
        await supabase
          .from('automation_schedules')
          .update({ qstash_job_id: qstashJobId })
          .eq('id', schedule.id);
        
        schedule.qstash_job_id = qstashJobId;
      } catch (qstashError) {
        console.error('Error creating QStash job:', qstashError);
        // Don't fail the entire operation, just log the error
      }
    }

    return { success: true, data: schedule };
  } catch (error) {
    console.error('Error in createAutomationSchedule:', error);
    return { success: false, error: 'Internal server error' };
  }
}

export async function updateAutomationSchedule(
  id: string, 
  updates: Partial<CreateScheduleRequest> & { is_enabled?: boolean },
  currentUserId: string
): Promise<{ success: boolean; data?: AutomationSchedule; error?: string }> {
  try {
    const supabase = await createServiceRoleClient();
    
    if (!currentUserId) {
      return { success: false, error: 'User ID required' };
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role_slug')
      .eq('id', currentUserId)
      .single();

    if (profileError || !profile || profile.role_slug !== 'admin') {
      return { success: false, error: 'Admin access required' };
    }

    // Get current schedule
    const { data: currentSchedule, error: fetchError } = await supabase
      .from('automation_schedules')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !currentSchedule) {
      return { success: false, error: 'Schedule not found' };
    }

    // Calculate next run time if schedule config changed
    const updateData: Record<string, unknown> = { ...updates };
    if (updates.schedule_type || updates.schedule_config) {
      updateData.next_run_at = calculateNextRunTime(
        updates.schedule_type || currentSchedule.schedule_type,
        updates.schedule_config || currentSchedule.schedule_config
      );
    }

    // Update schedule in database
    const { data: schedule, error } = await supabase
      .from('automation_schedules')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating automation schedule:', error);
      return { success: false, error: 'Failed to update automation schedule' };
    }

    // Handle QStash job management
    try {
      if (currentSchedule.qstash_job_id) {
        // Delete existing job
        await qstashAutomation.deleteScheduledJob(currentSchedule.qstash_job_id);
      }

      if (schedule.is_enabled) {
        // Create new job
        const qstashJobId = await qstashAutomation.createScheduledJob(schedule);
        
        // Update schedule with new QStash job ID
        await supabase
          .from('automation_schedules')
          .update({ qstash_job_id: qstashJobId })
          .eq('id', schedule.id);
        
        schedule.qstash_job_id = qstashJobId;
      }
    } catch (qstashError) {
      console.error('Error managing QStash job:', qstashError);
      // Don't fail the entire operation, just log the error
    }

    return { success: true, data: schedule };
  } catch (error) {
    console.error('Error in updateAutomationSchedule:', error);
    return { success: false, error: 'Internal server error' };
  }
}

export async function deleteAutomationSchedule(id: string, currentUserId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServiceRoleClient();
    
    if (!currentUserId) {
      return { success: false, error: 'User ID required' };
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role_slug')
      .eq('id', currentUserId)
      .single();

    if (profileError || !profile || profile.role_slug !== 'admin') {
      return { success: false, error: 'Admin access required' };
    }

    // Get current schedule to get QStash job ID
    const { data: schedule } = await supabase
      .from('automation_schedules')
      .select('qstash_job_id')
      .eq('id', id)
      .single();

    // Delete QStash job if exists
    if (schedule?.qstash_job_id) {
      try {
        await qstashAutomation.deleteScheduledJob(schedule.qstash_job_id);
      } catch (qstashError) {
        console.error('Error deleting QStash job:', qstashError);
        // Continue with database deletion even if QStash fails
      }
    }

    // Delete schedule from database
    const { error } = await supabase
      .from('automation_schedules')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting automation schedule:', error);
      return { success: false, error: 'Failed to delete automation schedule' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in deleteAutomationSchedule:', error);
    return { success: false, error: 'Internal server error' };
  }
}

export async function toggleAutomationSchedule(id: string, enabled: boolean, currentUserId: string): Promise<{ success: boolean; data?: AutomationSchedule; error?: string }> {
  try {
    const supabase = await createServiceRoleClient();
    
    if (!currentUserId) {
      return { success: false, error: 'User ID required' };
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role_slug')
      .eq('id', currentUserId)
      .single();

    if (profileError || !profile || profile.role_slug !== 'admin') {
      return { success: false, error: 'Admin access required' };
    }

    // Get current schedule
    const { data: currentSchedule, error: fetchError } = await supabase
      .from('automation_schedules')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !currentSchedule) {
      return { success: false, error: 'Schedule not found' };
    }

    // Update schedule
    const { data: schedule, error } = await supabase
      .from('automation_schedules')
      .update({ is_enabled: enabled })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error toggling automation schedule:', error);
      return { success: false, error: 'Failed to toggle automation schedule' };
    }

    // Handle QStash job management
    try {
      if (schedule.qstash_job_id) {
        await qstashAutomation.toggleScheduledJob(schedule.qstash_job_id, enabled);
      } else if (enabled) {
        // Create new job if enabling and no job exists
        const qstashJobId = await qstashAutomation.createScheduledJob(schedule);
        
        await supabase
          .from('automation_schedules')
          .update({ qstash_job_id: qstashJobId })
          .eq('id', schedule.id);
        
        schedule.qstash_job_id = qstashJobId;
      }
    } catch (qstashError) {
      console.error('Error managing QStash job:', qstashError);
      // Don't fail the entire operation, just log the error
    }

    return { success: true, data: schedule };
  } catch (error) {
    console.error('Error in toggleAutomationSchedule:', error);
    return { success: false, error: 'Internal server error' };
  }
}

export async function getAutomationLogs(currentUserId: string, scheduleId?: string): Promise<{ success: boolean; data?: unknown[]; error?: string }> {
  try {
    const supabase = await createServiceRoleClient();
    
    if (!currentUserId) {
      return { success: false, error: 'User ID required' };
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role_slug')
      .eq('id', currentUserId)
      .single();

    if (profileError || !profile || profile.role_slug !== 'admin') {
      return { success: false, error: 'Admin access required' };
    }
    
    let query = supabase
      .from('automation_logs')
      .select('*')
      .order('executed_at', { ascending: false })
      .limit(100);

    if (scheduleId) {
      query = query.eq('schedule_id', scheduleId);
    }

    const { data: logs, error } = await query;

    if (error) {
      console.error('Error fetching automation logs:', error);
      return { success: false, error: 'Failed to fetch automation logs' };
    }

    return { success: true, data: logs || [] };
  } catch (error) {
    console.error('Error in getAutomationLogs:', error);
    return { success: false, error: 'Internal server error' };
  }
}

export async function triggerAutomationNow(scheduleId: string, currentUserId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServiceRoleClient();
    
    if (!currentUserId) {
      return { success: false, error: 'User ID required' };
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role_slug')
      .eq('id', currentUserId)
      .single();

    if (profileError || !profile || profile.role_slug !== 'admin') {
      return { success: false, error: 'Admin access required' };
    }

    // Get the schedule details
    const { data: schedule, error: scheduleError } = await supabase
      .from('automation_schedules')
      .select('*')
      .eq('id', scheduleId)
      .single();

    if (scheduleError || !schedule) {
      return { success: false, error: 'Schedule not found' };
    }

    // Trigger the appropriate API endpoint based on job type
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    let apiUrl: string;
    
    switch (schedule.job_type) {
      case 'shift_reminder':
        apiUrl = `${baseUrl}/api/automation/shift-reminders`;
        break;
      case 'low_stock_notification':
        apiUrl = `${baseUrl}/api/automation/low-stock-notifications`;
        break;
      default:
        return { success: false, error: 'Unknown job type' };
    }

    // Make the API call to trigger the automation
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        scheduleId: schedule.id,
        jobType: schedule.job_type,
        manualTrigger: true, // Flag to indicate this is a manual trigger
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `API call failed: ${errorText}` };
    }

    const result = await response.json();
    
    if (!result.success) {
      return { success: false, error: result.error || 'Automation execution failed' };
    }

    // Update the last_run_at timestamp
    await supabase
      .from('automation_schedules')
      .update({ last_run_at: new Date().toISOString() })
      .eq('id', scheduleId);

    return { success: true };
  } catch (error) {
    console.error('Error in triggerAutomationNow:', error);
    return { success: false, error: 'Internal server error' };
  }
}

// Helper function to calculate next run time
function calculateNextRunTime(scheduleType: string, scheduleConfig: Record<string, unknown>): string {
  const now = new Date();
  const { time } = scheduleConfig as { time: string };
  const [hours, minutes] = time.split(':').map(Number);

  const nextRun = new Date();
  nextRun.setHours(hours, minutes, 0, 0);

  if (scheduleType === 'daily') {
    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1);
    }
  } else if (scheduleType === 'weekly') {
    const { days } = scheduleConfig as { days?: number[] };
    const currentDay = now.getDay();
    const targetDays = days || [1, 2, 3, 4, 5]; // Default to weekdays
    
    // Find next target day
    let daysUntilNext = 0;
    for (const day of targetDays) {
      if (day > currentDay) {
        daysUntilNext = day - currentDay;
        break;
      }
    }
    
    if (daysUntilNext === 0) {
      // Next occurrence is next week
      daysUntilNext = 7 - currentDay + (targetDays[0] || 1);
    }
    
    nextRun.setDate(nextRun.getDate() + daysUntilNext);
  }

  return nextRun.toISOString();
}
