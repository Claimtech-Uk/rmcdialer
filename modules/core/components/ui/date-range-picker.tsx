'use client';

import React, { useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { Button } from './button';
import { Card, CardContent } from './card';

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  disabled?: boolean;
  className?: string;
}

const presets = [
  {
    label: 'Today',
    getValue: () => {
      const today = new Date();
      const start = new Date(today);
      start.setHours(0, 0, 0, 0);
      const end = new Date(today);
      end.setHours(23, 59, 59, 999);
      return { startDate: start, endDate: end };
    }
  },
  {
    label: 'Yesterday',
    getValue: () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const start = new Date(yesterday);
      start.setHours(0, 0, 0, 0);
      const end = new Date(yesterday);
      end.setHours(23, 59, 59, 999);
      return { startDate: start, endDate: end };
    }
  },
  {
    label: 'Last 7 Days',
    getValue: () => {
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      const start = new Date();
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      return { startDate: start, endDate: end };
    }
  },
  {
    label: 'Last 30 Days',
    getValue: () => {
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      const start = new Date();
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      return { startDate: start, endDate: end };
    }
  },
  {
    label: 'This Month',
    getValue: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      return { startDate: start, endDate: end };
    }
  },
  {
    label: 'Last Month',
    getValue: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      end.setHours(23, 59, 59, 999);
      return { startDate: start, endDate: end };
    }
  }
];

export function DateRangePicker({ value, onChange, disabled, className }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(date);
  };

  const formatDateForInput = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const handlePresetClick = (preset: typeof presets[0]) => {
    const range = preset.getValue();
    onChange(range);
    setIsOpen(false);
  };

  const handleCustomDateChange = (field: 'startDate' | 'endDate', dateString: string) => {
    const newDate = new Date(dateString);
    if (field === 'startDate') {
      newDate.setHours(0, 0, 0, 0);
    } else {
      newDate.setHours(23, 59, 59, 999);
    }

    const newRange = {
      ...value,
      [field]: newDate
    };

    // Ensure start date is not after end date
    if (newRange.startDate > newRange.endDate) {
      if (field === 'startDate') {
        newRange.endDate = new Date(newRange.startDate);
        newRange.endDate.setHours(23, 59, 59, 999);
      } else {
        newRange.startDate = new Date(newRange.endDate);
        newRange.startDate.setHours(0, 0, 0, 0);
      }
    }

    onChange(newRange);
  };

  // Check if current range matches any preset
  const currentPreset = presets.find(preset => {
    const presetRange = preset.getValue();
    return (
      Math.abs(value.startDate.getTime() - presetRange.startDate.getTime()) < 1000 &&
      Math.abs(value.endDate.getTime() - presetRange.endDate.getTime()) < 1000
    );
  });

  const displayText = currentPreset 
    ? currentPreset.label 
    : `${formatDate(value.startDate)} - ${formatDate(value.endDate)}`;

  return (
    <div className={`relative ${className || ''}`}>
      <Button
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="flex items-center gap-2 bg-white/80 backdrop-blur-sm border-slate-200 hover:bg-white/90 transition-all duration-200 min-w-[200px] justify-between"
      >
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-700">{displayText}</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </Button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown */}
          <Card className="absolute top-full left-0 mt-2 z-50 w-80 shadow-2xl border-slate-200 bg-white/95 backdrop-blur-sm">
            <CardContent className="p-4 space-y-4">
              {/* Presets */}
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-2">Quick Ranges</h4>
                <div className="grid grid-cols-2 gap-1">
                  {presets.map((preset) => (
                    <Button
                      key={preset.label}
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePresetClick(preset)}
                      className={`justify-start text-xs h-8 ${
                        currentPreset?.label === preset.label 
                          ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                          : 'hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Custom Date Inputs */}
              <div className="border-t border-slate-200 pt-4">
                <h4 className="text-sm font-semibold text-slate-700 mb-3">Custom Range</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={formatDateForInput(value.startDate)}
                      onChange={(e) => handleCustomDateChange('startDate', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={formatDateForInput(value.endDate)}
                      onChange={(e) => handleCustomDateChange('endDate', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
} 