"use client";

import { FaCalendarAlt, FaClock, FaUser } from "react-icons/fa";
import { format, isToday, isFuture } from "date-fns";
import { Shift } from "@/types/dashboard";

interface UserDashboardProps {
  shifts: Shift[];
}

export function UserDashboard({ shifts }: UserDashboardProps) {
  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-neutral-800 rounded-xl p-6 border border-gray-200 dark:border-neutral-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">This Week&apos;s Shifts</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{shifts.length}</p>
            </div>
            <FaCalendarAlt className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        
        <div className="bg-white dark:bg-neutral-800 rounded-xl p-6 border border-gray-200 dark:border-neutral-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Upcoming Shifts</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {shifts.filter(shift => isFuture(new Date(shift.date))).length}
              </p>
            </div>
            <FaClock className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-800 rounded-xl p-6 border border-gray-200 dark:border-neutral-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Today&apos;s Shifts</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {shifts.filter(shift => isToday(new Date(shift.date))).length}
              </p>
            </div>
            <FaUser className="w-8 h-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Upcoming Shifts */}
      <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700">
        <div className="p-6 border-b border-gray-200 dark:border-neutral-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Your Shifts This Week</h2>
        </div>
        <div className="p-6">
          {shifts.length === 0 ? (
            <div className="text-center py-8">
              <FaCalendarAlt className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No shifts scheduled</h3>
              <p className="text-gray-600 dark:text-gray-400">You don&apos;t have any shifts scheduled for this week.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {shifts.map((shift) => (
                <div 
                  key={shift.id} 
                  className={`p-4 rounded-lg border ${
                    isToday(new Date(shift.date)) 
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' 
                      : 'bg-gray-50 dark:bg-neutral-700 border-gray-200 dark:border-neutral-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {format(new Date(shift.date), 'EEEE, MMMM d')}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {shift.start_time} - {shift.end_time}
                      </p>
                    </div>
                    {isToday(new Date(shift.date)) && (
                      <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs font-medium rounded-full">
                        Today
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
