import * as React from 'react';
import { EmailLayout } from './components/EmailLayout';
import { Tailwind } from '@react-email/tailwind';
import { Container, Section, Text } from '@react-email/components';

interface ShiftReminderEmailProps {
  staffName: string;
  shiftDate: string;
  shiftTime: string;
  businessName?: string;
  logoUrl?: string;
}

export const ShiftReminderEmail = ({
  staffName = 'John Doe',
  shiftDate = 'Monday, September 18, 2024',
  shiftTime = '9:00 AM - 5:00 PM',
  businessName = 'OperateFlow',
  logoUrl
}: ShiftReminderEmailProps) => (
  <EmailLayout 
    title={`${businessName} - Shift Reminder`} 
    companyName={businessName} 
    logoUrl={logoUrl}
  >
    <Tailwind>
      <Container className="max-w-lg mx-auto font-sans">
        <Section className="p-6">
          <Text className="text-base text-gray-800 m-0 mb-3">
            Hi {staffName},
          </Text>
          <Text className="text-base text-gray-600 mb-4 m-0">
            This is a friendly reminder about your upcoming shift:
          </Text>
          
          <Section className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
            <Text className="text-base text-gray-800 m-0 mb-2">
              <strong>Date:</strong> {shiftDate}
            </Text>
            <Text className="text-base text-gray-800 m-0">
              <strong>Time:</strong> {shiftTime}
            </Text>
          </Section>
          
          <Text className="text-base text-gray-600 mb-4 m-0">
            Please make sure you&apos;re available and ready for your shift. If you have any questions or need to make changes, please contact your manager.
          </Text>
          <Text className="text-base text-gray-600 mb-0 m-0">
            Thank you for your hard work!
          </Text>
        </Section>
      </Container>
    </Tailwind>
  </EmailLayout>
);