'use client';

import React from 'react';
import type { CallOutcomeType, CallOutcomeContext } from '../types/call-outcome.types';

interface OutcomeSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  context: CallOutcomeContext;
  onOutcomeSelect: (outcomeType: CallOutcomeType, data?: any) => void;
}

export function OutcomeSelectionModal({
  isOpen,
  onClose,
  context,
  onOutcomeSelect
}: OutcomeSelectionModalProps) {
  if (!isOpen) return null;

  // TODO: Implement outcome selection UI
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-semibold mb-4">Select Call Outcome</h2>
        
        <div className="space-y-2">
          {/* TODO: Render outcome options */}
          <p className="text-gray-600">Outcome selection UI will be implemented here</p>
        </div>
        
        <div className="flex justify-end gap-2 mt-6">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-gray-600 border rounded hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
} 