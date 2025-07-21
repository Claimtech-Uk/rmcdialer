'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/modules/core/components/ui/card';
import { Button } from '@/modules/core/components/ui/button';
import { Input } from '@/modules/core/components/ui/input';
import { Label } from '@/modules/core/components/ui/label';
import { 
  Phone, 
  PhoneOff, 
  Clock, 
  MessageSquare, 
  Calendar,
  CheckCircle,
  XCircle,
  AlertCircle,
  Send
} from 'lucide-react';
import type { CallOutcomeOptions, UserCallContext } from '../types/call.types';

interface CallOutcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (outcome: CallOutcomeOptions) => Promise<void>;
  callSessionId: string;
  userContext: UserCallContext;
  callDuration: number; // in seconds
  isSubmitting?: boolean;
}

const OUTCOME_TYPES = [
  {
    type: 'contacted' as const,
    label: 'Successfully Contacted',
    icon: CheckCircle,
    color: 'bg-green-500',
    description: 'Spoke with the customer'
  },
  {
    type: 'no_answer' as const,
    label: 'No Answer',
    icon: PhoneOff,
    color: 'bg-yellow-500',
    description: 'Phone rang but no answer'
  },
  {
    type: 'left_voicemail' as const,
    label: 'Left Voicemail',
    icon: MessageSquare,
    color: 'bg-blue-500',
    description: 'Left a voicemail message'
  },
  {
    type: 'busy' as const,
    label: 'Line Busy',
    icon: Phone,
    color: 'bg-orange-500',
    description: 'Phone line was busy'
  },
  {
    type: 'callback_requested' as const,
    label: 'Callback Requested',
    icon: Calendar,
    color: 'bg-purple-500',
    description: 'Schedule a callback'
  },
  {
    type: 'not_interested' as const,
    label: 'Not Interested',
    icon: XCircle,
    color: 'bg-red-500',
    description: 'Customer not interested'
  },
  {
    type: 'wrong_number' as const,
    label: 'Wrong Number',
    icon: AlertCircle,
    color: 'bg-gray-500',
    description: 'Wrong person or number'
  },
  {
    type: 'failed' as const,
    label: 'Call Failed',
    icon: XCircle,
    color: 'bg-red-600',
    description: 'Technical issues'
  }
];

export function CallOutcomeModal({
  isOpen,
  onClose,
  onSubmit,
  callSessionId,
  userContext,
  callDuration,
  isSubmitting = false
}: CallOutcomeModalProps) {
  const [selectedOutcome, setSelectedOutcome] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [callbackDateTime, setCallbackDateTime] = useState('');
  const [callbackReason, setCallbackReason] = useState('');

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSubmit = async () => {
    if (!selectedOutcome) return;

    const outcome: CallOutcomeOptions = {
      outcomeType: selectedOutcome as any,
      outcomeNotes: notes.trim() || undefined,
      ...(selectedOutcome === 'callback_requested' && callbackDateTime && {
        callbackDateTime: new Date(callbackDateTime),
        callbackReason: callbackReason.trim() || 'Customer requested callback'
      })
    };

    await onSubmit(outcome);
  };

  const selectedOutcomeData = OUTCOME_TYPES.find(o => o.type === selectedOutcome);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white shadow-2xl border-0">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
          <CardTitle className="flex items-center gap-3">
            <Phone className="w-6 h-6" />
            Call Outcome - {userContext.firstName} {userContext.lastName}
          </CardTitle>
          <div className="flex items-center gap-4 text-blue-100">
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              Duration: {formatDuration(callDuration)}
            </div>
            <div className="flex items-center gap-1">
              <Phone className="w-4 h-4" />
              {userContext.phoneNumber}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* Disposition Selection */}
          <div>
            <Label className="text-base font-semibold mb-3 block">Disposition *</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {OUTCOME_TYPES.map((outcome) => {
                const Icon = outcome.icon;
                const isSelected = selectedOutcome === outcome.type;
                
                return (
                  <button
                    key={outcome.type}
                    onClick={() => setSelectedOutcome(outcome.type)}
                    className={`p-3 rounded-lg border-2 transition-all text-left ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-3 h-3 rounded-full ${outcome.color}`} />
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="font-medium text-sm">{outcome.label}</div>
                    <div className="text-xs text-gray-500 mt-1">{outcome.description}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Callback Scheduling */}
          {selectedOutcome === 'callback_requested' && (
            <div className="border rounded-lg p-4 bg-purple-50">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Schedule Callback
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="callback-datetime">Callback Date & Time *</Label>
                  <Input
                    id="callback-datetime"
                    type="datetime-local"
                    value={callbackDateTime}
                    onChange={(e) => setCallbackDateTime(e.target.value)}
                    min={new Date().toISOString().slice(0, 16)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="callback-reason">Reason for Callback</Label>
                  <select
                    id="callback-reason"
                    value={callbackReason}
                    onChange={(e) => setCallbackReason(e.target.value)}
                    className="mt-1 w-full p-2 border rounded-lg"
                  >
                    <option value="">Select reason...</option>
                    <option value="Customer requested specific time">Customer requested specific time</option>
                    <option value="Need to gather documents">Need to gather documents</option>
                    <option value="Discuss with family/partner">Discuss with family/partner</option>
                    <option value="Financial review needed">Financial review needed</option>
                    <option value="Technical questions">Technical questions</option>
                    <option value="Other">Other (specify in notes)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <Label htmlFor="notes" className="text-base font-semibold mb-3 block">
              Call Notes
            </Label>
            
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 500))}
              placeholder="Add notes about the conversation, customer responses, concerns, or any other relevant information..."
              className="w-full p-3 border rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={4}
            />
            <div className="text-sm text-gray-500 mt-1">
              {notes.length}/500 characters
            </div>
          </div>
        </CardContent>

        {/* Actions */}
        <div className="border-t p-4 bg-gray-50 flex justify-between">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          
          <Button
            onClick={handleSubmit}
            disabled={!selectedOutcome || isSubmitting || (selectedOutcome === 'callback_requested' && !callbackDateTime)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Save Outcome
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
} 