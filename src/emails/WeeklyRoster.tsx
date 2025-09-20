import React from 'react';
import { EmailLayout } from './components/EmailLayout';

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
}

export const WeeklyRoster = ({
  staffName,
  weekStart,
  weekEnd,
  shifts,
  totalHours,
  totalBillableHours
}: WeeklyRosterProps) => {
  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric'
    });
  };

  const getDayShifts = (dayOfWeek: number) => {
    return shifts.filter(shift => {
      const shiftDate = new Date(shift.start_time);
      return shiftDate.getDay() === dayOfWeek;
    }).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  };

  const weekDays = [1, 2, 3, 4, 5, 6, 0]; // Monday to Sunday
  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  return (
    <EmailLayout title="Weekly Roster">
      <div style={{ maxWidth: '600px', margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>
        {/* Header */}
        <div style={{ 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          padding: '30px 20px',
          textAlign: 'center',
          borderRadius: '8px 8px 0 0'
        }}>
          <h1 style={{ margin: '0 0 10px 0', fontSize: '28px', fontWeight: 'bold' }}>
            Weekly Roster
          </h1>
          <p style={{ margin: '0', fontSize: '16px', opacity: '0.9' }}>
            {weekStart} - {weekEnd}
          </p>
        </div>

        {/* Staff Info */}
        <div style={{ 
          background: '#f8f9fa',
          padding: '20px',
          borderBottom: '1px solid #e9ecef'
        }}>
          <h2 style={{ 
            margin: '0 0 10px 0',
            fontSize: '24px',
            color: '#333',
            fontWeight: '600'
          }}>
            Hello {staffName}!
          </h2>
          <p style={{ 
            margin: '0',
            fontSize: '16px',
            color: '#666',
            lineHeight: '1.5'
          }}>
            Here&apos;s your schedule for the upcoming week. Please review your shifts and contact management if you have any questions or need to make changes.
          </p>
        </div>

        {/* Weekly Summary */}
        <div style={{ 
          background: '#fff',
          padding: '20px',
          borderBottom: '1px solid #e9ecef'
        }}>
          <h3 style={{ 
            margin: '0 0 15px 0',
            fontSize: '18px',
            color: '#333',
            fontWeight: '600'
          }}>
            Weekly Summary
          </h3>
          <div style={{ 
            display: 'flex',
            gap: '20px',
            flexWrap: 'wrap'
          }}>
            <div style={{ 
              background: '#e3f2fd',
              padding: '15px',
              borderRadius: '8px',
              flex: '1',
              minWidth: '150px'
            }}>
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>Total Hours</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1976d2' }}>
                {totalHours.toFixed(1)}h
              </div>
            </div>
            <div style={{ 
              background: '#e8f5e8',
              padding: '15px',
              borderRadius: '8px',
              flex: '1',
              minWidth: '150px'
            }}>
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>Billable Hours</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2e7d32' }}>
                {totalBillableHours.toFixed(1)}h
              </div>
            </div>
            <div style={{ 
              background: '#fff3e0',
              padding: '15px',
              borderRadius: '8px',
              flex: '1',
              minWidth: '150px'
            }}>
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>Total Shifts</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f57c00' }}>
                {shifts.length}
              </div>
            </div>
          </div>
        </div>

        {/* Daily Schedule */}
        <div style={{ 
          background: '#fff',
          padding: '20px'
        }}>
          <h3 style={{ 
            margin: '0 0 20px 0',
            fontSize: '18px',
            color: '#333',
            fontWeight: '600'
          }}>
            Daily Schedule
          </h3>
          
          {weekDays.map((dayOfWeek, index) => {
            const dayShifts = getDayShifts(dayOfWeek);
            const dayName = dayNames[index];
            
            return (
              <div key={dayOfWeek} style={{ 
                marginBottom: '20px',
                border: '1px solid #e9ecef',
                borderRadius: '8px',
                overflow: 'hidden'
              }}>
                <div style={{ 
                  background: dayShifts.length > 0 ? '#f8f9fa' : '#f1f3f4',
                  padding: '12px 16px',
                  borderBottom: dayShifts.length > 0 ? '1px solid #e9ecef' : 'none'
                }}>
                  <h4 style={{ 
                    margin: '0',
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#333'
                  }}>
                    {dayName}
                    {dayShifts.length === 0 && (
                      <span style={{ 
                        marginLeft: '10px',
                        fontSize: '14px',
                        color: '#666',
                        fontWeight: 'normal'
                      }}>
                        - No shifts scheduled
                      </span>
                    )}
                  </h4>
                </div>
                
                {dayShifts.length > 0 && (
                  <div style={{ padding: '0' }}>
                    {dayShifts.map((shift, shiftIndex) => (
                      <div key={shift.id} style={{ 
                        padding: '12px 16px',
                        borderBottom: shiftIndex < dayShifts.length - 1 ? '1px solid #f0f0f0' : 'none',
                        background: '#fff'
                      }}>
                        <div style={{ 
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '10px'
                        }}>
                          <div style={{ flex: '1', minWidth: '200px' }}>
                            <div style={{ 
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              marginBottom: '5px'
                            }}>
                              <span style={{ 
                                fontSize: '16px',
                                fontWeight: '600',
                                color: '#333'
                              }}>
                                {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
                              </span>
                              {shift.section && (
                                <span style={{ 
                                  background: shift.section.color,
                                  color: 'white',
                                  padding: '2px 8px',
                                  borderRadius: '12px',
                                  fontSize: '12px',
                                  fontWeight: '500'
                                }}>
                                  {shift.section.name}
                                </span>
                              )}
                            </div>
                            {shift.notes && (
                              <div style={{ 
                                fontSize: '14px',
                                color: '#666',
                                fontStyle: 'italic',
                                marginTop: '5px'
                              }}>
                                Note: {shift.notes}
                              </div>
                            )}
                            {shift.non_billable_hours && shift.non_billable_hours > 0 && (
                              <div style={{ 
                                fontSize: '12px',
                                color: '#f57c00',
                                marginTop: '5px',
                                fontWeight: '500'
                              }}>
                                Warning: Non-billable: {shift.non_billable_hours}h
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ 
          background: '#f8f9fa',
          padding: '20px',
          textAlign: 'center',
          borderRadius: '0 0 8px 8px',
          borderTop: '1px solid #e9ecef'
        }}>
          <p style={{ 
            margin: '0 0 10px 0',
            fontSize: '14px',
            color: '#666'
          }}>
            Need to make changes to your schedule?
          </p>
          <p style={{ 
            margin: '0',
            fontSize: '14px',
            color: '#666'
          }}>
            Contact your manager or reply to this email.
          </p>
          <div style={{ 
            marginTop: '20px',
            paddingTop: '20px',
            borderTop: '1px solid #e9ecef'
          }}>
            <p style={{ 
              margin: '0',
              fontSize: '12px',
              color: '#999'
            }}>
              This is an automated roster notification from OperateFlow
            </p>
          </div>
        </div>
      </div>
    </EmailLayout>
  );
};
