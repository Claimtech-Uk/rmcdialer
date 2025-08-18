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
  Send,
  Ban,
  UserX
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

// Updated to match call-outcomes service vocabulary
const OUTCOME_TYPES = [
  {
    type: 'completed_form' as const,
    label: 'Completed Form',
    icon: CheckCircle,
    color: 'bg-green-500',
    description: 'Customer completed their form'
  },
  {
    type: 'going_to_complete' as const,
    label: 'Going to Complete',
    icon: Clock,
    color: 'bg-blue-500',
    description: 'Customer committed to completing form'
  },
  {
    type: 'might_complete' as const,
    label: 'Might Complete',
    icon: MessageSquare,
    color: 'bg-yellow-500',
    description: 'Customer showed interest'
  },
  {
    type: 'call_back' as const,
    label: 'Callback Requested',
    icon: Calendar,
    color: 'bg-purple-500',
    description: 'Customer requested a callback'
  },
  {
    type: 'no_answer' as const,
    label: 'No Answer',
    icon: PhoneOff,
    color: 'bg-gray-400',
    description: 'Phone rang but no answer'
  },
  {
    type: 'hung_up' as const,
    label: 'Hung Up',
    icon: Phone,
    color: 'bg-orange-500',
    description: 'Customer hung up during call'
  },
  {
    type: 'bad_number' as const,
    label: 'Bad Number',
    icon: AlertCircle,
    color: 'bg-red-400',
    description: 'Incorrect or disconnected number'
  },
  {
    type: 'no_claim' as const,
    label: 'No Claim',
    icon: Ban,
    color: 'bg-gray-500',
    description: 'Customer has no valid claim'
  },
  {
    type: 'not_interested' as const,
    label: 'Not Interested',
    icon: XCircle,
    color: 'bg-red-500',
    description: 'Customer not interested'
  },
  {
    type: 'do_not_contact' as const,
    label: 'Do Not Contact',
    icon: UserX,
    color: 'bg-red-700',
    description: 'Customer requested no further contact'
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
  
  // Outcomes that require scheduling a follow-up call
  const callbackRequiredOutcomes = ['call_back']; // Only genuine callbacks need scheduling

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Set default callback time when callback-required outcomes are selected
  const handleOutcomeChange = (outcomeType: string) => {
    setSelectedOutcome(outcomeType);
    
    if (callbackRequiredOutcomes.includes(outcomeType) && !callbackDateTime) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0); // Default to 10 AM
      setCallbackDateTime(tomorrow.toISOString().slice(0, 16));
    }
  };

  const handleSubmit = async () => {
    if (!selectedOutcome) return;

    // Validation for callback scheduling
    if (callbackRequiredOutcomes.includes(selectedOutcome)) {
      if (!callbackDateTime) {
        alert('Please select a callback date and time');
        return;
      }
      
      const callbackDate = new Date(callbackDateTime);
      const now = new Date();
      
      if (callbackDate <= now) {
        alert('Callback must be scheduled for a future date and time');
        return;
      }
    }

    // Validation for do not contact - requires notes
    if (selectedOutcome === 'do_not_contact') {
      if (!notes.trim()) {
        alert('Notes are required for "Do Not Contact" outcomes to document the customer request');
        return;
      }
      
      // Confirmation dialog for serious action
      const confirmed = confirm(
        'Are you sure the customer explicitly requested not to be contacted? This will remove them from all calling queues and mark them as opted out.'
      );
      if (!confirmed) {
        return;
      }
    }

    const outcome: CallOutcomeOptions = {
      outcomeType: selectedOutcome as any,
      outcomeNotes: notes.trim() || undefined,
      ...(callbackRequiredOutcomes.includes(selectedOutcome) && callbackDateTime && {
        callbackDateTime: new Date(callbackDateTime),
        callbackReason: callbackReason.trim() || 
          (selectedOutcome === 'might_complete' ? 'Follow up on interest shown' :
           selectedOutcome === 'going_to_complete' ? 'Follow up on commitment to complete' :
           'Customer requested callback'),
        callbackScheduled: true
      })
    };

    await onSubmit(outcome);
  };

  const selectedOutcomeData = OUTCOME_TYPES.find(o => o.type === selectedOutcome);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 backdrop-blur-sm flex items-center justify-center z-50">
      <Card className="w-[60vw] max-w-[1200px] max-h-[85vh] overflow-y-auto bg-white shadow-2xl border-0">
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

        <CardContent className="p-4 space-y-4">
          {/* Disposition Selection */}
          <div>
            <Label className="text-base font-semibold mb-3 block">Disposition *</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {OUTCOME_TYPES.map((outcome) => {
                const Icon = outcome.icon;
                const isSelected = selectedOutcome === outcome.type;
                
                return (
                  <button
                    key={outcome.type}
                    onClick={() => handleOutcomeChange(outcome.type)}
                    className={`p-3 rounded-xl border-2 transition-all duration-200 text-left h-[100px] flex flex-col justify-between hover:shadow-md ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 shadow-lg scale-105'
                        : 'border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-4 h-4 rounded-full ${outcome.color} shadow-sm`} />
                      <Icon className="w-5 h-5 text-gray-600" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-gray-900 mb-1">{outcome.label}</div>
                      <div className="text-xs text-gray-500 leading-relaxed">{outcome.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Callback Scheduling */}
          {['call_back', 'might_complete', 'going_to_complete'].includes(selectedOutcome) && (
            <div className="border rounded-lg p-4 bg-purple-50 border-purple-200">
              <h3 className="font-semibold mb-3 flex items-center gap-2 text-purple-800">
                <Calendar className="w-4 h-4" />
                Schedule Follow-up Call
              </h3>
              
              <div className="mb-4 p-3 bg-purple-100 rounded-lg">
                <p className="text-sm text-purple-700 mb-2">
                  📞 <strong>A follow-up call will be scheduled for {userContext.firstName} {userContext.lastName}</strong>
                </p>
                <p className="text-xs text-purple-600">
                  {selectedOutcome === 'might_complete' 
                    ? 'Customer showed interest. They will automatically re-enter the queue in 1 day with a small priority adjustment (+2).'
                    : selectedOutcome === 'going_to_complete'
                    ? 'Customer committed to completing. They will automatically re-enter the queue in 3 days with no priority penalty.'
                    : 'The customer will appear in the callback queue at the scheduled time for the preferred agent to call back.'}
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="callback-datetime" className="text-sm font-medium mb-1 block">
                    Callback Date & Time <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="callback-datetime"
                    type="datetime-local"
                    value={callbackDateTime}
                    onChange={(e) => setCallbackDateTime(e.target.value)}
                    min={new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16)} // Minimum 1 hour from now
                    className="mt-1"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Customer expects to be called at this time
                  </p>
                </div>
                
                <div>
                  <Label htmlFor="callback-reason" className="text-sm font-medium mb-1 block">
                    Reason for Callback
                  </Label>
                  <select
                    id="callback-reason"
                    value={callbackReason}
                    onChange={(e) => setCallbackReason(e.target.value)}
                    className="mt-1 w-full p-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  >
                    <option value="">Select reason...</option>
                    <option value="Customer requested specific time">Customer requested specific time</option>
                    <option value="Need to gather documents">Need to gather documents</option>
                    <option value="Discuss with family/partner">Discuss with family/partner</option>
                    <option value="Financial review needed">Financial review needed</option>
                    <option value="Technical questions about claim">Technical questions about claim</option>
                    <option value="Preferred agent not available">Preferred agent not available</option>
                    <option value="Customer was busy">Customer was busy</option>
                    <option value="Follow up on previous discussion">Follow up on previous discussion</option>
                    <option value="Other">Other (specify in notes)</option>
                  </select>
                </div>
              </div>
              
              {/* Quick time suggestions */}
              <div className="mt-3">
                <Label className="text-sm font-medium mb-2 block">Quick Time Options:</Label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'Tomorrow 10 AM', hours: 24 + 10 - new Date().getHours() },
                    { label: 'Tomorrow 2 PM', hours: 24 + 14 - new Date().getHours() },
                    { label: 'Tomorrow 5 PM', hours: 24 + 17 - new Date().getHours() },
                    { label: 'Next Week', hours: 7 * 24 }
                  ].map((option) => {
                    const suggestedTime = new Date(Date.now() + option.hours * 60 * 60 * 1000);
                    return (
                      <Button
                        key={option.label}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setCallbackDateTime(suggestedTime.toISOString().slice(0, 16))}
                        className="text-xs border-purple-200 text-purple-700 hover:bg-purple-100"
                      >
                        {option.label}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Do Not Contact Warning */}
          {selectedOutcome === 'do_not_contact' && (
            <div className="border rounded-lg p-4 bg-red-50 border-red-200">
              <div className="flex items-center gap-2 text-red-800 font-semibold mb-2">
                <UserX className="w-5 h-5" />
                ⚠️ Critical: Do Not Contact Request
              </div>
              <p className="text-red-700 text-sm mb-2">
                This action will <strong>permanently remove</strong> the customer from all calling queues and mark them as opted out. 
                This should only be used when the customer explicitly requests not to be contacted.
              </p>
              <p className="text-red-600 text-xs">
                Notes are <strong>required</strong> to document the customer's explicit request for legal compliance.
              </p>
            </div>
          )}

          {/* Notes */}
          <div>
            <Label htmlFor="notes" className="text-base font-semibold mb-3 block">
              Call Notes {selectedOutcome === 'do_not_contact' && <span className="text-red-500">*Required</span>}
            </Label>
            
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 500))}
              placeholder={
                selectedOutcome === 'do_not_contact' 
                  ? "REQUIRED: Document the customer's explicit request not to be contacted. Include exact words used and context..."
                  : "Add notes about the conversation, customer responses, concerns, or any other relevant information..."
              }
              className={`w-full p-3 border rounded-lg resize-none focus:ring-2 ${
                selectedOutcome === 'do_not_contact' 
                  ? 'border-red-300 bg-red-50 focus:ring-red-500 focus:border-red-500' 
                  : 'focus:ring-blue-500 focus:border-blue-500'
              }`}
              rows={4}
              required={selectedOutcome === 'do_not_contact'}
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
            disabled={
              !selectedOutcome || 
              isSubmitting || 
              (callbackRequiredOutcomes.includes(selectedOutcome) && !callbackDateTime) ||
              (selectedOutcome === 'do_not_contact' && !notes.trim())
            }
            className={selectedOutcome === 'do_not_contact' 
              ? "bg-red-600 hover:bg-red-700" 
              : "bg-blue-600 hover:bg-blue-700"
            }
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                {selectedOutcome === 'call_back' 
                  ? 'Scheduling Callback...' 
                  : selectedOutcome === 'do_not_contact'
                  ? 'Processing Opt-Out...'
                  : 'Saving...'
                }
              </>
            ) : (
              <>
                {selectedOutcome === 'do_not_contact' ? (
                  <UserX className="w-4 h-4 mr-2" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                {selectedOutcome === 'call_back' 
                  ? 'Schedule Callback' 
                  : selectedOutcome === 'do_not_contact'
                  ? 'Confirm Opt-Out'
                  : 'Save Outcome'
                }
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
} 