import { Client } from '@upstash/qstash';

const qstash = new Client({
  token: process.env.QSTASH_TOKEN!,
});

// QStash signing keys for webhook signature verification
export const QSTASH_CURRENT_SIGNING_KEY = process.env.QSTASH_CURRENT_SIGNING_KEY;
export const QSTASH_NEXT_SIGNING_KEY = process.env.QSTASH_NEXT_SIGNING_KEY;

export interface AutomationSchedule {
  id: string;
  name: string;
  description?: string;
  job_type: 'shift_reminder' | 'low_stock_notification' | 'missing_shift_allocation';
  schedule_type: 'daily' | 'weekly' | 'monthly';
  schedule_config: {
    time: string; // HH:MM format
    days?: number[]; // 0-6 for weekly (0=Sunday, 1=Monday, etc.)
    frequency?: string;
  };
  custom_config?: {
    recipient_emails?: string[];
    days_to_check?: number;
    check_all_days?: boolean;
    alert_threshold?: number;
    warning_threshold?: number;
    [key: string]: unknown; // Allow additional custom fields
  };
  is_enabled: boolean;
  qstash_job_id?: string;
  last_run_at?: string;
  next_run_at?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface CreateScheduleRequest {
  name: string;
  description?: string;
  job_type: 'shift_reminder' | 'low_stock_notification' | 'missing_shift_allocation';
  schedule_type: 'daily' | 'weekly' | 'monthly';
  schedule_config: {
    time: string;
    days?: number[];
    frequency?: string;
  };
  custom_config?: {
    recipient_emails?: string[];
    days_to_check?: number;
    check_all_days?: boolean;
    alert_threshold?: number;
    warning_threshold?: number;
    [key: string]: unknown;
  };
}

export class QStashAutomation {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  }

  /**
   * Create a scheduled job in QStash
   */
  async createScheduledJob(schedule: AutomationSchedule): Promise<string> {
    try {
      const cronExpression = this.generateCronExpression(schedule);
      const endpoint = this.getJobEndpoint(schedule.job_type);

      const response = await qstash.schedules.create({
        destination: `${this.baseUrl}/api/automation/${endpoint}`,
        cron: cronExpression,
        body: JSON.stringify({
          schedule_id: schedule.id,
          job_type: schedule.job_type,
        }),
      });

      if (!response.scheduleId) {
        throw new Error('QStash did not return a schedule ID');
      }

      return response.scheduleId;
    } catch (error) {
      console.error('QStash createScheduledJob error:', error);
      throw new Error(`Failed to create QStash job: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update an existing scheduled job
   */
  async updateScheduledJob(schedule: AutomationSchedule): Promise<string> {
    if (schedule.qstash_job_id) {
      // Delete existing job
      await this.deleteScheduledJob(schedule.qstash_job_id);
    }

    // Create new job
    return await this.createScheduledJob(schedule);
  }

  /**
   * Delete a scheduled job
   */
  async deleteScheduledJob(jobId: string): Promise<void> {
    try {
      await qstash.schedules.delete(jobId);
    } catch (error) {
      console.error('QStash deleteScheduledJob error:', error);
      throw new Error(`Failed to delete QStash job: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Pause/Resume a scheduled job
   */
  async toggleScheduledJob(jobId: string, enabled: boolean): Promise<void> {
    try {
      // Note: QStash doesn't have pause/resume methods in the current API
      // We'll need to delete and recreate the job to toggle it
      if (!enabled) {
        await qstash.schedules.delete(jobId);
      }
      // For enabling, we'll need to recreate the job from the schedule
    } catch (error) {
      console.error('QStash toggleScheduledJob error:', error);
      throw new Error(`Failed to toggle QStash job: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate cron expression from schedule config
   */
  private generateCronExpression(schedule: AutomationSchedule): string {
    const { time, days } = schedule.schedule_config;
    const [hours, minutes] = time.split(':').map(Number);

    if (schedule.schedule_type === 'daily') {
      // Daily at specific time: "0 9 * * *" (9:00 AM daily)
      return `${minutes} ${hours} * * *`;
    } else if (schedule.schedule_type === 'weekly') {
      // Weekly on specific days: "0 9 * * 1,2,3,4,5" (9:00 AM Mon-Fri)
      const dayList = days?.join(',') || '1,2,3,4,5';
      return `${minutes} ${hours} * * ${dayList}`;
    } else if (schedule.schedule_type === 'monthly') {
      // Monthly on 1st day: "0 9 1 * *" (9:00 AM on 1st of month)
      return `${minutes} ${hours} 1 * *`;
    }

    // Default to daily
    return `${minutes} ${hours} * * *`;
  }

  /**
   * Get the API endpoint for the job type
   */
  private getJobEndpoint(jobType: string): string {
    switch (jobType) {
      case 'shift_reminder':
        return 'shift-reminders';
      case 'low_stock_notification':
        return 'low-stock-notifications';
      case 'missing_shift_allocation':
        return 'missing-shift-allocation';
      default:
        throw new Error(`Unknown job type: ${jobType}`);
    }
  }

  /**
   * Get job status from QStash
   */
  async getJobStatus(jobId: string): Promise<unknown> {
    return await qstash.schedules.get(jobId);
  }

  /**
   * Get a specific message by ID for debugging
   */
  async getMessage(messageId: string): Promise<unknown> {
    try {
      const message = await qstash.messages.get(messageId);
      return message;
    } catch (error) {
      console.error('QStash getMessage error:', error);
      throw new Error(`Failed to get QStash message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const qstashAutomation = new QStashAutomation();
