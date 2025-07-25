'use client';

import React from 'react';
import type { NextAction } from '../types/call-outcome.types';

interface NextActionsPanelProps {
  actions: NextAction[];
  onActionComplete?: (actionIndex: number) => void;
}

export function NextActionsPanel({ actions, onActionComplete }: NextActionsPanelProps) {
  if (actions.length === 0) return null;

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <h3 className="font-semibold text-gray-800 mb-3">Next Actions</h3>
      
      <div className="space-y-2">
        {actions.map((action, index) => (
          <div 
            key={index}
            className={`flex items-center justify-between p-2 rounded border ${
              action.priority === 'critical' ? 'border-red-200 bg-red-50' :
              action.priority === 'high' ? 'border-orange-200 bg-orange-50' :
              action.priority === 'medium' ? 'border-yellow-200 bg-yellow-50' :
              'border-gray-200 bg-white'
            }`}
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{action.description}</span>
                {action.required && (
                  <span className="text-xs bg-red-100 text-red-800 px-1 rounded">Required</span>
                )}
              </div>
              
              {action.dueDate && (
                <div className="text-xs text-gray-500 mt-1">
                  Due: {action.dueDate.toLocaleDateString()}
                </div>
              )}
            </div>
            
            {onActionComplete && (
              <button
                onClick={() => onActionComplete(index)}
                className="text-sm px-2 py-1 bg-green-100 text-green-800 rounded hover:bg-green-200"
              >
                Complete
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
} 