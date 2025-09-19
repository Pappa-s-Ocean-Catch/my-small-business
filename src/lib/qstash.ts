import { Client } from '@upstash/qstash';

const qstash = new Client({
  token: process.env.QSTASH_TOKEN!,
});

export interface AutomationSchedule {
  id: string;
  name: string;
  description?: string;
  job_type: 'shift_reminder' | 'low_stock_notification';
  schedule_type: 'daily' | 'weekly' | 'monthly';
  schedule_config: {
    time: string; // HH:MM format
    days?: number[]; // 0-6 for weekly (0=Sunday, 1=Monday, etc.)
    frequency?: string;
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
  job_type: 'shift_reminder' | 'low_stock_notification';
  schedule_type: 'daily' | 'weekly' | 'monthly';
  schedule_config: {
    time: string;
    days?: number[];
    frequency?: string;
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
    const cronExpression = this.generateCronExpression(schedule);
    const endpoint = this.getJobEndpoint(schedule.job_type);

    const response = await qstash.publishJSON({
      url: `${this.baseUrl}/api/automation/${endpoint}`,
      body: {
        schedule_id: schedule.id,
        job_type: schedule.job_type,
      },
      cron: cronExpression,
    });

    return response.messageId;
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
    await qstash.messages.delete(jobId);
  }

  /**
   * Pause/Resume a scheduled job
   */
  async toggleScheduledJob(jobId: string, enabled: boolean): Promise<void> {
    // Note: QStash doesn't have pause/resume methods in the current API
    // We'll need to delete and recreate the job to toggle it
    if (!enabled) {
      await qstash.messages.delete(jobId);
    }
    // For enabling, we'll need to recreate the job from the schedule
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
      default:
        throw new Error(`Unknown job type: ${jobType}`);
    }
  }

  /**
   * Get job status from QStash
   */
  async getJobStatus(jobId: string): Promise<unknown> {
    return await qstash.messages.get(jobId);
  }
}

export const qstashAutomation = new QStashAutomation();
