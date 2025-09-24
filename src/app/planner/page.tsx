"use client";

import { useState, useCallback, useEffect } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { AdminGuard } from "@/components/AdminGuard";
import Card from "@/components/Card";
import { FaRobot, FaCalendarAlt, FaUsers, FaDollarSign, FaSave, FaTrash, FaPlus, FaMinus } from "react-icons/fa";
import { toast } from 'react-toastify';

type Staff = {
  id: string;
  name: string;
  skills: string[];
  rates: {
    default: number;
    mon: number;
    tue: number;
    wed: number;
    thu: number;
    fri: number;
    sat: number;
    sun: number;
  };
  availability: Array<{
    day: number;
    start_time: string;
    end_time: string;
  }>;
};

type Section = {
  id: string;
  name: string;
  minStaffRequired: number;
};

type AIAssignment = {
  staffName: string;
  section: string;
  day: string;
  startTime: string;
  endTime: string;
  cost: number;
  reasoning: string;
};

type AssignmentResult = {
  assignments: AIAssignment[];
  totalCost: number;
  staffSummary: Array<{
    staffName: string;
    totalHours: number;
    totalCost: number;
    assignments: number;
  }>;
};

type TimeSlot = {
  id: string;
  startTime: string;
  endTime: string;
  label: string;
};

type ResourceRequirement = {
  sectionId: string;
  day: string;
  timeSlotId: string;
  resourceCount: number;
};

type MasterDataPreset = {
  id: string;
  name: string;
  weekStart: string;
  requirements: ResourceRequirement[];
  createdAt: string;
};

export default function PlannerPage() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AssignmentResult | null>(null);
  const [weekStart, setWeekStart] = useState(() => {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - today.getDay() + 1);
    return monday.toISOString().split('T')[0];
  });

  // Resource planning state
  const [sections, setSections] = useState<Section[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [resourceRequirements, setResourceRequirements] = useState<ResourceRequirement[]>([]);
  const [presets, setPresets] = useState<MasterDataPreset[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  const [showResourceGrid, setShowResourceGrid] = useState(false);

  // Days of the week
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      const supabase = getSupabaseClient();
      
      // Load sections
      const { data: sectionsData } = await supabase
        .from("sections")
        .select("id, name")
        .eq("active", true)
        .order("name");
      
      if (sectionsData) {
        setSections(sectionsData.map(s => ({ ...s, minStaffRequired: 1 })));
      }

      // Load presets from localStorage
      const savedPresets = localStorage.getItem('resourcePresets');
      if (savedPresets) {
        setPresets(JSON.parse(savedPresets));
      }
    };

    loadInitialData();
  }, []);

  // Initialize default time slots
  useEffect(() => {
    const defaultTimeSlots: TimeSlot[] = [
      { id: 'morning', startTime: '10:00', endTime: '14:00', label: 'Morning (10:00-14:00)' },
      { id: 'afternoon', startTime: '14:00', endTime: '18:00', label: 'Afternoon (14:00-18:00)' },
      { id: 'evening', startTime: '18:00', endTime: '21:00', label: 'Evening (18:00-21:00)' },
    ];
    setTimeSlots(defaultTimeSlots);
  }, []);

  // Save presets to localStorage
  const savePresets = (newPresets: MasterDataPreset[]) => {
    setPresets(newPresets);
    localStorage.setItem('resourcePresets', JSON.stringify(newPresets));
  };

  // Load preset
  const loadPreset = (presetId: string) => {
    const preset = presets.find(p => p.id === presetId);
    if (preset) {
      setResourceRequirements(preset.requirements);
      setWeekStart(preset.weekStart);
      setSelectedPreset(presetId);
    }
  };

  // Save current state as preset
  const saveAsPreset = (presetName: string) => {
    const newPreset: MasterDataPreset = {
      id: Date.now().toString(),
      name: presetName,
      weekStart,
      requirements: resourceRequirements,
      createdAt: new Date().toISOString()
    };
    
    const newPresets = [...presets, newPreset];
    savePresets(newPresets);
    setSelectedPreset(newPreset.id);
    toast.success(`Preset "${presetName}" saved successfully`);
  };

  // Delete preset
  const deletePreset = (presetId: string) => {
    const newPresets = presets.filter(p => p.id !== presetId);
    savePresets(newPresets);
    if (selectedPreset === presetId) {
      setSelectedPreset("");
      setResourceRequirements([]);
    }
    toast.success('Preset deleted successfully');
  };

  // Update resource requirement
  const updateResourceRequirement = (sectionId: string, day: string, timeSlotId: string, resourceCount: number) => {
    const existingIndex = resourceRequirements.findIndex(
      r => r.sectionId === sectionId && r.day === day && r.timeSlotId === timeSlotId
    );

    if (resourceCount === 0) {
      // Remove requirement if count is 0
      setResourceRequirements(prev => prev.filter((_, index) => index !== existingIndex));
    } else {
      const newRequirement: ResourceRequirement = {
        sectionId,
        day,
        timeSlotId,
        resourceCount
      };

      if (existingIndex >= 0) {
        // Update existing
        setResourceRequirements(prev => prev.map((r, index) => 
          index === existingIndex ? newRequirement : r
        ));
      } else {
        // Add new
        setResourceRequirements(prev => [...prev, newRequirement]);
      }
    }
  };

  // Get resource requirement for a specific cell
  const getResourceRequirement = (sectionId: string, day: string, timeSlotId: string): number => {
    const requirement = resourceRequirements.find(
      r => r.sectionId === sectionId && r.day === day && r.timeSlotId === timeSlotId
    );
    return requirement?.resourceCount || 0;
  };

  const processStaffSummary = (assignments: AIAssignment[]) => {
    const summary = new Map<string, { totalHours: number; totalCost: number; assignments: number }>();
    
    assignments.forEach(assignment => {
      const hours = calculateHours(assignment.startTime, assignment.endTime);
      const existing = summary.get(assignment.staffName) || { totalHours: 0, totalCost: 0, assignments: 0 };
      
      summary.set(assignment.staffName, {
        totalHours: existing.totalHours + hours,
        totalCost: existing.totalCost + assignment.cost,
        assignments: existing.assignments + 1
      });
    });

    return Array.from(summary.entries()).map(([staffName, data]) => ({
      staffName,
      ...data
    }));
  };

  const generateAIAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      
      // Fetch all required data
      const [staffResult, sectionsResult] = await Promise.all([
        supabase
          .from("staff")
          .select(`
            id, name, skills,
            staff_rates!inner(rate_type, rate, is_current)
          `)
          .eq("is_available", true)
          .eq("staff_rates.is_current", true),
        
        supabase
          .from("sections")
          .select("id, name")
          .eq("active", true),
        
      ]);

      if (staffResult.error) throw staffResult.error;
      if (sectionsResult.error) throw sectionsResult.error;

      // Process staff data with rates
      const staff: Staff[] = staffResult.data?.map(s => {
        const rates = s.staff_rates.reduce((acc, rate) => {
          acc[rate.rate_type] = rate.rate;
          return acc;
        }, {} as Record<string, number>);
        
        return {
          id: s.id,
          name: s.name,
          skills: s.skills || [],
          rates: {
            default: rates.default || 0,
            mon: rates.mon || rates.default || 0,
            tue: rates.tue || rates.default || 0,
            wed: rates.wed || rates.default || 0,
            thu: rates.thu || rates.default || 0,
            fri: rates.fri || rates.default || 0,
            sat: rates.sat || rates.default || 0,
            sun: rates.sun || rates.default || 0,
          },
          availability: [] // For now, assume all staff available 9-17
        };
      }) || [];

      const sections: Section[] = sectionsResult.data?.map(s => ({
        id: s.id,
        name: s.name,
        minStaffRequired: 1
      })) || [];

      // Generate AI prompt
      const prompt = generateAIPrompt(staff, sections, weekStart);
      
      // Call AI API
      const aiResponse = await fetch('/api/ai/generate-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });

      if (!aiResponse.ok) {
        throw new Error('AI API call failed');
      }

      const aiResult = await aiResponse.json();
      const assignments: AIAssignment[] = JSON.parse(aiResult.assignments || '[]');

      // Process results
      const staffSummary = processStaffSummary(assignments);
      const totalCost = assignments.reduce((sum, a) => sum + a.cost, 0);

      setResults({
        assignments,
        totalCost,
        staffSummary
      });

      toast.success(`AI generated ${assignments.length} assignments with total cost $${totalCost.toFixed(2)}`);
    } catch (error) {
      console.error('Error generating AI assignments:', error);
      toast.error('Failed to generate AI assignments');
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  const generateAIPrompt = (staff: Staff[], sections: Section[], weekStart: string): string => {
    const staffInfo = staff.map(s => 
      `- ${s.name}: Skills[${s.skills.join(',')}], Rates[Default:$${s.rates.default}, Mon:$${s.rates.mon}, Tue:$${s.rates.tue}, Wed:$${s.rates.wed}, Thu:$${s.rates.thu}, Fri:$${s.rates.fri}, Sat:$${s.rates.sat}, Sun:$${s.rates.sun}]`
    ).join('\n');
    
    const sectionsInfo = sections.map(s => 
      `- ${s.name}: Min ${s.minStaffRequired} staff`
    ).join('\n');

    // Generate resource requirements info
    const resourceRequirementsInfo = resourceRequirements.length > 0 
      ? resourceRequirements.map(req => {
          const section = sections.find(s => s.id === req.sectionId);
          const timeSlot = timeSlots.find(t => t.id === req.timeSlotId);
          return `${section?.name} on ${req.day} during ${timeSlot?.label}: ${req.resourceCount} staff needed`;
        }).join('\n')
      : 'No specific resource requirements set - use default minimum coverage';

    return `You are an expert shift scheduler for a restaurant. Create an optimal weekly schedule that minimizes cost while ensuring adequate coverage.

BUSINESS INFO:
- Operating Hours: 10:00 - 21:00
- Week: ${weekStart}

SECTIONS:
${sectionsInfo}

STAFF AVAILABLE:
${staffInfo}

RESOURCE REQUIREMENTS:
${resourceRequirementsInfo}

REQUIREMENTS:
1. Minimize total labor cost
2. Meet all specified resource requirements for each section/day/time slot
3. Respect staff skills (only assign to sections they can work)
4. Create shifts that match the time slots: ${timeSlots.map(t => t.label).join(', ')}
5. Balance hours fairly among staff
6. Use cheapest available staff for each assignment
7. Support partial shifts (0.5 staff = half-time coverage)

CONSTRAINTS:
- Staff can only work sections they have skills for
- No overlapping shifts for same staff
- Prefer staff with lower rates for same skill level
- Must meet exact resource requirements specified above

Return ONLY a JSON array of assignments in this exact format:
[
  {
    "staffName": "John Doe",
    "section": "Grill",
    "day": "Monday",
    "startTime": "10:00",
    "endTime": "18:00",
    "cost": 120.00,
    "reasoning": "Lowest rate for grill section, available all day"
  }
]`;
  };

  const calculateHours = (startTime: string, endTime: string): number => {
    const start = new Date(`2000-01-01T${startTime}:00`);
    const end = new Date(`2000-01-01T${endTime}:00`);
    return (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  };


  return (
    <AdminGuard>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            AI Shift Planner
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Generate optimal shift assignments using AI to minimize cost while ensuring adequate coverage.
          </p>
        </div>

        {/* Controls */}
        <Card className="mb-6">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Week Starting
              </label>
              <input
                type="date"
                value={weekStart}
                onChange={(e) => setWeekStart(e.target.value)}
                className="h-10 rounded-lg border px-3 bg-white/80 dark:bg-neutral-900"
              />
            </div>
            <button
              onClick={() => setShowResourceGrid(!showResourceGrid)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <FaCalendarAlt className="w-4 h-4" />
              {showResourceGrid ? 'Hide' : 'Show'} Resource Planning
            </button>
            <button
              onClick={generateAIAssignments}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              <FaRobot className="w-4 h-4" />
              {loading ? 'Generating...' : 'Generate AI Schedule'}
            </button>
          </div>
        </Card>

        {/* Resource Planning Grid */}
        {showResourceGrid && (
          <Card className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Resource Requirements Planning
              </h3>
              <div className="flex items-center gap-2">
                <select
                  value={selectedPreset}
                  onChange={(e) => {
                    if (e.target.value) {
                      loadPreset(e.target.value);
                    } else {
                      setSelectedPreset("");
                      setResourceRequirements([]);
                    }
                  }}
                  className="h-8 rounded border px-2 bg-white/80 dark:bg-neutral-900 text-sm"
                >
                  <option value="">Select Preset</option>
                  {presets.map(preset => (
                    <option key={preset.id} value={preset.id}>
                      {preset.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    const name = prompt('Enter preset name:');
                    if (name) saveAsPreset(name);
                  }}
                  className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                >
                  <FaSave className="w-3 h-3" />
                  Save
                </button>
                {selectedPreset && (
                  <button
                    onClick={() => deletePreset(selectedPreset)}
                    className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                  >
                    <FaTrash className="w-3 h-3" />
                    Delete
                  </button>
                )}
              </div>
            </div>

            {/* Resource Grid */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-neutral-700">
                    <th className="w-32 px-3 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                      Section
                    </th>
                    {days.map(day => (
                      <th key={day} className="w-24 px-2 py-2 text-center text-sm font-medium text-gray-700 dark:text-gray-300">
                        {day.slice(0, 3)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sections.map(section => (
                    <tr key={section.id} className="border-b border-gray-100 dark:border-neutral-800">
                      <td className="px-3 py-2 text-sm font-medium text-gray-900 dark:text-white">
                        {section.name}
                      </td>
                      {days.map(day => (
                        <td key={`${section.id}-${day}`} className="px-2 py-2">
                          <div className="space-y-1">
                            {timeSlots.map(timeSlot => (
                              <div key={`${section.id}-${day}-${timeSlot.id}`} className="flex items-center gap-1">
                                <span className="text-xs text-gray-500 dark:text-gray-400 w-16 truncate">
                                  {timeSlot.startTime}-{timeSlot.endTime}
                                </span>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => {
                                      const current = getResourceRequirement(section.id, day, timeSlot.id);
                                      const newValue = Math.max(0, current - 0.5);
                                      updateResourceRequirement(section.id, day, timeSlot.id, newValue);
                                    }}
                                    className="w-5 h-5 flex items-center justify-center bg-gray-200 dark:bg-neutral-700 rounded text-xs hover:bg-gray-300 dark:hover:bg-neutral-600"
                                  >
                                    <FaMinus className="w-2 h-2" />
                                  </button>
                                  <span className="w-8 text-center text-sm font-medium">
                                    {getResourceRequirement(section.id, day, timeSlot.id)}
                                  </span>
                                  <button
                                    onClick={() => {
                                      const current = getResourceRequirement(section.id, day, timeSlot.id);
                                      const newValue = Math.min(3, current + 0.5);
                                      updateResourceRequirement(section.id, day, timeSlot.id, newValue);
                                    }}
                                    className="w-5 h-5 flex items-center justify-center bg-gray-200 dark:bg-neutral-700 rounded text-xs hover:bg-gray-300 dark:hover:bg-neutral-600"
                                  >
                                    <FaPlus className="w-2 h-2" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
              <p>• Use +/- buttons to set resource requirements (0.5 = half-time, 1 = full-time, etc.)</p>
              <p>• Save your planning as presets for future use</p>
              <p>• AI will use these requirements to generate optimal schedules</p>
            </div>
          </Card>
        )}

        {/* Results */}
        {results && (
          <div className="grid gap-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <div className="flex items-center gap-3">
                  <FaDollarSign className="w-8 h-8 text-green-600" />
                  <div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      ${results.totalCost.toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Total Cost</div>
                  </div>
                </div>
              </Card>
              
              <Card>
                <div className="flex items-center gap-3">
                  <FaCalendarAlt className="w-8 h-8 text-blue-600" />
                  <div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {results.assignments.length}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Total Assignments</div>
                  </div>
                </div>
              </Card>
              
              <Card>
                <div className="flex items-center gap-3">
                  <FaUsers className="w-8 h-8 text-purple-600" />
                  <div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {results.staffSummary.length}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Staff Assigned</div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Staff Summary Table */}
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Staff Summary
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-neutral-700">
                      <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Staff</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Total Hours</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Total Cost</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Assignments</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.staffSummary.map((staff, index) => (
                      <tr key={index} className="border-b border-gray-100 dark:border-neutral-800">
                        <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">
                          {staff.staffName}
                        </td>
                        <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                          {staff.totalHours.toFixed(1)}h
                        </td>
                        <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                          ${staff.totalCost.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                          {staff.assignments}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Detailed Assignments */}
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Detailed Assignments
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-neutral-700">
                      <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Staff</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Section</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Day</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Time</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Cost</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Reasoning</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.assignments.map((assignment, index) => (
                      <tr key={index} className="border-b border-gray-100 dark:border-neutral-800">
                        <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">
                          {assignment.staffName}
                        </td>
                        <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                          {assignment.section}
                        </td>
                        <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                          {assignment.day}
                        </td>
                        <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                          {assignment.startTime} - {assignment.endTime}
                        </td>
                        <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                          ${assignment.cost.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-gray-500 dark:text-gray-500 text-sm">
                          {assignment.reasoning}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}
      </div>
    </AdminGuard>
  );
}
