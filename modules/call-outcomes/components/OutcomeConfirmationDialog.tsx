'use client';

import React from 'react';
import type { CallOutcomeResult } from '../types/call-outcome.types';

interface OutcomeConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  result: CallOutcomeResult | null;
  onConfirm: () => void;
}

export function OutcomeConfirmationDialog({
  isOpen,
  onClose,
  result,
  onConfirm
}: OutcomeConfirmationDialogProps) {
  if (!isOpen || !result) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-semibold mb-4">Confirm Call Outcome</h2>
        
        <div className="space-y-3">
          <div>
            <span className="font-medium">Outcome:</span> {result.outcomeType}
          </div>
          
          {result.outcomeNotes && (
            <div>
              <span className="font-medium">Notes:</span> {result.outcomeNotes}
            </div>
          )}
          
          {result.nextActions.length > 0 && (
            <div>
              <span className="font-medium">Next Actions:</span>
              <ul className="list-disc list-inside ml-2 text-sm text-gray-600">
                {result.nextActions.map((action, idx) => (
                  <li key={idx}>{action.description}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        
        <div className="flex justify-end gap-2 mt-6">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-gray-600 border rounded hover:bg-gray-50"
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
} 