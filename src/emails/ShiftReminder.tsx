import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

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
  businessName = 'ShiftFlow',
}: ShiftReminderEmailProps) => (
  <Html>
    <Head />
    <Preview>Shift reminder for {shiftDate}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={h1}>Shift Reminder</Heading>
        </Section>
        
        <Section style={content}>
          <Text style={text}>Hi {staffName},</Text>
          
          <Text style={text}>
            This is a friendly reminder about your upcoming shift:
          </Text>
          
          <Section style={shiftBox}>
            <Text style={shiftText}>
              <strong>Date:</strong> {shiftDate}
            </Text>
            <Text style={shiftText}>
              <strong>Time:</strong> {shiftTime}
            </Text>
          </Section>
          
          <Text style={text}>
            Please make sure you&apos;re available and ready for your shift. If you have any questions or need to make changes, please contact your manager.
          </Text>
          
          <Text style={text}>
            Thank you for your hard work!
          </Text>
        </Section>
        
        <Section style={footer}>
          <Text style={footerText}>
            {businessName} - Staff Management System
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
);

export default ShiftReminderEmail;

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
};

const header = {
  padding: '32px 24px 0',
};

const h1 = {
  color: '#333',
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '0 0 8px',
  padding: '0',
};

const content = {
  padding: '24px',
};

const text = {
  color: '#333',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0 0 16px',
};

const shiftBox = {
  backgroundColor: '#f8f9fa',
  border: '1px solid #e9ecef',
  borderRadius: '8px',
  padding: '16px',
  margin: '16px 0',
};

const shiftText = {
  color: '#333',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0 0 8px',
};

const footer = {
  padding: '24px',
  borderTop: '1px solid #e9ecef',
};

const footerText = {
  color: '#6c757d',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0',
  textAlign: 'center' as const,
};
