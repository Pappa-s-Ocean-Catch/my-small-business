import * as React from 'react';
import { EmailLayout } from './components/EmailLayout';

interface ShiftReminderEmailProps {
  staffName: string;
  shiftDate: string;
  shiftTime: string;
  businessName?: string;
}

export const ShiftReminderEmail = ({
  staffName = 'John Doe',
  shiftDate = 'Monday, September 18, 2024',
  shiftTime = '9:00 AM - 5:00 PM',
  businessName = 'OperateFlow',
}: ShiftReminderEmailProps) => (
  <EmailLayout title={`${businessName} - Shift Reminder`} companyName={businessName}>
    <p style={{ margin: 0, fontSize: 14, color: '#111827' }}>Hi {staffName},</p>
    <p style={{ margin: '12px 0 0', fontSize: 14, color: '#374151' }}>
      This is a friendly reminder about your upcoming shift:
    </p>
    <div style={{ marginTop: 12, background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 10, padding: 12 }}>
      <p style={{ margin: 0, fontSize: 14, color: '#111827' }}><strong>Date:</strong> {shiftDate}</p>
      <p style={{ margin: '8px 0 0', fontSize: 14, color: '#111827' }}><strong>Time:</strong> {shiftTime}</p>
    </div>
    <p style={{ margin: '12px 0 0', fontSize: 14, color: '#374151' }}>
      Please make sure you&apos;re available and ready for your shift. If you have any questions or need to make changes, please contact your manager.
    </p>
    <p style={{ margin: '12px 0 0', fontSize: 14, color: '#374151' }}>
      Thank you for your hard work!
    </p>
  </EmailLayout>
);

export default ShiftReminderEmail;
