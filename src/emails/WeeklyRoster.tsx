import React from 'react';
import { EmailLayout } from './components/EmailLayout';
import { Tailwind } from '@react-email/tailwind';
import { Container, Section, Text, Heading, Row, Column, Hr } from '@react-email/components';

interface WeeklyRosterProps {
  staffName: string;
  weekStart: string;
  weekEnd: string;
  shifts: Array<{
    id: string;
    start_time: string;
    end_time: string;
    notes: string | null;
    non_billable_hours?: number;
    section: {
      name: string;
      color: string;
    } | null;
  }>;
  totalHours: number;
  totalBillableHours: number;
  businessName?: string;
  businessSlogan?: string;
  logoUrl?: string;
}

export const WeeklyRoster = ({
  staffName,
  weekStart,
  weekEnd,
  shifts,
  totalHours,
  totalBillableHours,
  businessName = 'OperateFlow',
  logoUrl
}: WeeklyRosterProps) => {
  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const weekDays = [1, 2, 3, 4, 5, 6, 0]; // Monday to Sunday
  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  return (
    <EmailLayout 
      title="Weekly Roster"
      companyName={businessName}
      logoUrl={logoUrl}
    >
      <Tailwind>
        <Container className="max-w-2xl mx-auto font-sans">
          {/* Header */}
          <Section className="bg-gradient-to-br from-blue-500 to-purple-600 text-white p-6 rounded-t-xl text-center">
            <Heading className="text-2xl font-bold m-0">Weekly Roster</Heading>
            <Text className="text-base opacity-90 mt-2 mb-0">
              {weekStart} - {weekEnd}
            </Text>
          </Section>

          {/* Staff Info */}
          <Section className="bg-gray-50 p-5 border-b border-gray-200">
            <Heading className="text-2xl text-gray-800 m-0 mb-2">
              Hello {staffName}!
            </Heading>
            <Text className="text-base text-gray-600 m-0 leading-relaxed">
              Here&apos;s your schedule for the upcoming week. Please review your shifts and contact management if you have any questions or need to make changes.
            </Text>
          </Section>

          {/* Weekly Summary */}
          <Section className="bg-white p-5 border-b border-gray-200">
            <Heading className="text-lg text-gray-800 m-0 mb-4">Weekly Summary</Heading>
            <Row className="gap-5">
              <Column className="bg-blue-50 p-4 rounded-lg flex-1 min-w-36">
                <Text className="text-sm text-gray-600 mb-1 m-0">Total Hours</Text>
                <Text className="text-2xl font-bold text-blue-600 m-0">
                  {totalHours.toFixed(1)}h
                </Text>
              </Column>
              <Column className="bg-green-50 p-4 rounded-lg flex-1 min-w-36">
                <Text className="text-sm text-gray-600 mb-1 m-0">Billable Hours</Text>
                <Text className="text-2xl font-bold text-green-600 m-0">
                  {totalBillableHours.toFixed(1)}h
                </Text>
              </Column>
              <Column className="bg-orange-50 p-4 rounded-lg flex-1 min-w-36">
                <Text className="text-sm text-gray-600 mb-1 m-0">Total Shifts</Text>
                <Text className="text-2xl font-bold text-orange-600 m-0">
                  {shifts.length}
                </Text>
              </Column>
            </Row>
          </Section>

          {/* Schedule Table */}
          <Section className="p-5 bg-white">
            <Heading className="text-lg text-gray-800 m-0 mb-4">Your Shifts</Heading>
            
            {weekDays.map((dayNum, index) => {
              const dayName = dayNames[index];
              const dayShifts = shifts.filter(shift => {
                const shiftDate = new Date(shift.start_time);
                return shiftDate.getDay() === dayNum;
              });

              return (
                <Section key={dayNum} className="mb-4">
                  <Heading className="text-base text-gray-700 bg-gray-100 p-3 rounded-md m-0 mb-2">
                    {dayName}
                  </Heading>
                  
                  {dayShifts.length > 0 ? (
                    <Section className="ml-4">
                      {dayShifts.map((shift, shiftIndex) => (
                        <Section key={shiftIndex} className="bg-white border border-gray-200 rounded-md p-3 mb-2">
                          <Row className="mb-1">
                            <Column>
                              <Text className="font-semibold text-gray-900 m-0">
                                {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
                              </Text>
                            </Column>
                            {shift.section && (
                              <Column>
                                <Text 
                                  className="text-white px-2 py-1 rounded text-xs font-medium m-0 text-right"
                                  style={{ backgroundColor: shift.section.color || '#3b82f6' }}
                                >
                                  {shift.section.name}
                                </Text>
                              </Column>
                            )}
                          </Row>
                          {shift.notes && (
                            <Text className="text-sm text-gray-600 italic mt-1 mb-0">
                              Note: {shift.notes}
                            </Text>
                          )}
                          {shift.non_billable_hours && shift.non_billable_hours > 0 && (
                            <Text className="text-xs text-amber-600 font-medium mt-1 mb-0">
                              Non-billable: {shift.non_billable_hours}h
                            </Text>
                          )}
                        </Section>
                      ))}
                    </Section>
                  ) : (
                    <Text className="text-sm text-gray-400 italic ml-4 mt-2 mb-0">
                      No shifts scheduled
                    </Text>
                  )}
                </Section>
              );
            })}
          </Section>

          {/* Footer */}
          <Hr className="border-gray-200" />
          <Section className="pt-4 text-center">
            <Text className="text-sm text-gray-600 mb-2 m-0">
              If you have any questions about your schedule, please contact your manager.
            </Text>
            <Text className="text-xs text-gray-400 m-0">
              This is an automated roster notification from {businessName}
            </Text>
          </Section>
        </Container>
      </Tailwind>
    </EmailLayout>
  );
};