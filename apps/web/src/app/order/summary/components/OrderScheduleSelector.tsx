'use client';

import type { PickupDayOption } from '@/lib/store-hours';

type TimingOption = 'asap' | 'scheduled';
interface OrderScheduleSelectorProps {
  orderType: 'pickup' | 'delivery';
  isOpen: boolean;
  option: TimingOption;
  days: PickupDayOption[];
  selectedDate: string | null;
  selectedTime: string | null;
  onOptionChange: (option: TimingOption) => void;
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
}

export function OrderScheduleSelector({ orderType, isOpen, option, days, selectedDate, selectedTime, onOptionChange, onDateChange, onTimeChange }: OrderScheduleSelectorProps) {
  const isDelivery = orderType === 'delivery';
  const title = isDelivery ? 'Delivery' : 'Pickup';
  const day = days.find(day => day.date === selectedDate) ?? days[0];
  return (
    <div className="space-y-4">
      {isOpen && (
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer text-sm text-gray-900 dark:text-white">
            <input type="radio" name="orderTiming" className="w-4 h-4 text-blue-600" checked={option === 'asap'} onChange={() => onOptionChange('asap')} />
            {isDelivery ? 'As soon as possible' : 'As soon as ready [ETA=10 minutes]'}
          </label>
          <label className="flex items-center gap-3 cursor-pointer text-sm text-gray-900 dark:text-white">
            <input type="radio" name="orderTiming" className="w-4 h-4 text-blue-600" checked={option === 'scheduled'} onChange={() => onOptionChange('scheduled')} />
            Choose a {isDelivery ? 'delivery' : 'pickup'} time
          </label>
        </div>
      )}
      {option === 'scheduled' && (
        <>
          <p className="text-xs text-gray-500 dark:text-gray-400">All times are Australia/Melbourne.</p>
          {days.length === 0 ? (
            <p className="text-sm" role="status">No {isDelivery ? 'delivery' : 'pickup'} times are available in the next seven days.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
              <div className="flex flex-col gap-1">
                <label htmlFor="order-schedule-date" className="text-sm text-gray-700 dark:text-gray-300">{title} date</label>
                <select id="order-schedule-date" className="h-10 rounded-lg border px-3 bg-white/80 dark:bg-neutral-900 text-sm" value={day?.date ?? ''} onChange={e => onDateChange(e.target.value)}>
                  {days.map(day => <option key={day.date} value={day.date}>{day.dateLabel}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="order-schedule-time" className="text-sm text-gray-700 dark:text-gray-300">{title} time (required)</label>
                <select id="order-schedule-time" required className="h-10 rounded-lg border px-3 bg-white/80 dark:bg-neutral-900 text-sm" value={selectedTime ?? ''} onChange={e => onTimeChange(e.target.value)}>
                  <option value="" disabled>Select {isDelivery ? 'delivery' : 'pickup'} time</option>
                  {day.slots.map(slot => <option key={slot.value} value={slot.value}>{slot.label}</option>)}
                </select>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
