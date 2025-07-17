import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { UserCallContext, CallSession, CallOutcomeType } from '@/types/shared';
import { MagicLinkPanel } from '@/components/MagicLinkPanel';

interface CallControlsProps {
  isConnected: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onMute: () => void;
  onHold: () => void;
  isMuted: boolean;
  isOnHold: boolean;
}

function CallControls({ isConnected, onConnect, onDisconnect, onMute, onHold, isMuted, isOnHold }: CallControlsProps) {
  return (
    <div className="flex justify-center space-x-4 p-4 border-t bg-gray-50">
      {!isConnected ? (
        <button
          onClick={onConnect}
          className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-full font-semibold flex items-center"
        >
          📞 Start Call
        </button>
      ) : (
        <>
          <button
            onClick={onMute}
            className={`px-4 py-2 rounded-full font-semibold ${
              isMuted 
                ? 'bg-red-100 text-red-700 border border-red-300' 
                : 'bg-gray-100 text-gray-700 border border-gray-300'
            }`}
          >
            {isMuted ? '🔇 Unmute' : '🔊 Mute'}
          </button>
          
          <button
            onClick={onHold}
            className={`px-4 py-2 rounded-full font-semibold ${
              isOnHold 
                ? 'bg-yellow-100 text-yellow-700 border border-yellow-300' 
                : 'bg-gray-100 text-gray-700 border border-gray-300'
            }`}
          >
            {isOnHold ? '▶️ Resume' : '⏸️ Hold'}
          </button>
          
          <button
            onClick={onDisconnect}
            className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-full font-semibold"
          >
            📵 End Call
          </button>
        </>
      )}
    </div>
  );
}

interface CallTimerProps {
  startTime?: Date;
  isActive: boolean;
}

function CallTimer({ startTime, isActive }: CallTimerProps) {
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!isActive || !startTime) return;

    const interval = setInterval(() => {
      const now = new Date();
      const diff = Math.floor((now.getTime() - startTime.getTime()) / 1000);
      setDuration(diff);
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime, isActive]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="text-center p-4 bg-blue-50 border-b">
      <div className="text-2xl font-mono font-bold text-blue-900">
        {formatTime(duration)}
      </div>
      <div className="text-sm text-blue-600">
        {isActive ? '🔴 Call Active' : '⏹️ Call Ended'}
      </div>
    </div>
  );
}

interface UserContextPanelProps {
  userContext: UserCallContext;
}

function UserContextPanel({ userContext }: UserContextPanelProps) {
  const { user, claims, callScore } = userContext;

  return (
    <div className="bg-white border rounded-lg p-6 space-y-6">
      {/* User Information */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Contact Information</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium text-gray-700">Name:</span>
            <div>{user.firstName} {user.lastName}</div>
          </div>
          <div>
            <span className="font-medium text-gray-700">Phone:</span>
            <div>{user.phoneNumber}</div>
          </div>
          <div>
            <span className="font-medium text-gray-700">Email:</span>
            <div>{user.email}</div>
          </div>
          <div>
            <span className="font-medium text-gray-700">Address:</span>
            <div>{user.address?.fullAddress || 'Not available'}</div>
          </div>
        </div>
      </div>

      {/* Claims Information */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          Claims ({claims.length})
        </h3>
        {claims.map((claim) => (
          <div key={claim.id} className="border rounded p-4 mb-3 bg-gray-50">
            <div className="flex justify-between items-start mb-2">
              <div className="font-medium text-gray-900">
                {claim.type} - {claim.lender}
              </div>
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                claim.status === 'complete' ? 'bg-green-100 text-green-800' :
                claim.status === 'documents_needed' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {claim.status.replace('_', ' ')}
              </span>
            </div>
            
            {/* Requirements */}
            {claim.requirements.length > 0 && (
              <div className="mt-2">
                <div className="text-sm font-medium text-gray-700 mb-1">
                  Outstanding Requirements:
                </div>
                {claim.requirements.map((req) => (
                  <div key={req.id} className="text-sm text-gray-600 ml-2">
                    • {req.type.replace('_', ' ')} ({req.status})
                  </div>
                ))}
              </div>
            )}

            {/* Vehicle Packages */}
            {claim.vehiclePackages.map((vehicle) => (
              <div key={vehicle.registration} className="mt-2 text-sm text-gray-600">
                <strong>Vehicle:</strong> {vehicle.make} {vehicle.model} ({vehicle.registration})
                <br />
                <strong>Dealer:</strong> {vehicle.dealershipName} | <strong>Payment:</strong> £{vehicle.monthlyPayment}/month
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Call History */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Call History</h3>
        <div className="text-sm text-gray-600">
          <div>Total Attempts: {callScore.totalAttempts}</div>
          <div>Successful Calls: {callScore.successfulCalls}</div>
          <div>Last Outcome: {callScore.lastOutcome || 'None'}</div>
          <div>Success Rate: {
            callScore.totalAttempts > 0 
              ? Math.round((callScore.successfulCalls / callScore.totalAttempts) * 100)
              : 0
          }%</div>
        </div>
      </div>
    </div>
  );
}

interface CallOutcomeFormProps {
  onSubmit: (outcome: CallOutcomeType, notes: string, scheduleCallback?: Date) => void;
  isSubmitting: boolean;
}

function CallOutcomeForm({ onSubmit, isSubmitting }: CallOutcomeFormProps) {
  const [outcome, setOutcome] = useState<CallOutcomeType>('contacted');
  const [notes, setNotes] = useState('');
  const [scheduleCallback, setScheduleCallback] = useState(false);
  const [callbackDate, setCallbackDate] = useState('');
  const [callbackTime, setCallbackTime] = useState('');

  const outcomeOptions: { value: CallOutcomeType; label: string; color: string }[] = [
    { value: 'contacted', label: '✅ Successfully Contacted', color: 'green' },
    { value: 'callback_requested', label: '📅 Callback Requested', color: 'blue' },
    { value: 'not_interested', label: '❌ Not Interested', color: 'red' },
    { value: 'no_answer', label: '📞 No Answer', color: 'yellow' },
    { value: 'voicemail', label: '📧 Left Voicemail', color: 'purple' },
    { value: 'wrong_number', label: '🚫 Wrong Number', color: 'gray' },
    { value: 'busy', label: '📵 Line Busy', color: 'orange' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const callbackDateTime = scheduleCallback && callbackDate && callbackTime 
      ? new Date(`${callbackDate}T${callbackTime}`)
      : undefined;
    
    onSubmit(outcome, notes, callbackDateTime);
  };

  return (
    <div className="bg-white border rounded-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Call Outcome</h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Outcome Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Call Outcome
          </label>
          <div className="grid grid-cols-2 gap-2">
            {outcomeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setOutcome(option.value)}
                className={`p-3 text-left border rounded-lg transition-colors ${
                  outcome === option.value
                    ? `border-${option.color}-500 bg-${option.color}-50 text-${option.color}-700`
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Call Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter detailed notes about the call..."
          />
        </div>

        {/* Callback Scheduling */}
        <div>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={scheduleCallback}
              onChange={(e) => setScheduleCallback(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">Schedule Callback</span>
          </label>
          
          {scheduleCallback && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <input
                type="date"
                value={callbackDate}
                onChange={(e) => setCallbackDate(e.target.value)}
                className="border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500"
                min={new Date().toISOString().split('T')[0]}
              />
              <input
                type="time"
                value={callbackTime}
                onChange={(e) => setCallbackTime(e.target.value)}
                className="border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting || !notes.trim()}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
        >
          {isSubmitting ? 'Recording...' : 'Record Outcome & End Call'}
        </button>
      </form>
    </div>
  );
}

export function CallPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Call state
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const [callStartTime, setCallStartTime] = useState<Date>();

  // Get call session data
  const { data: callSession, isLoading: sessionLoading } = useQuery({
    queryKey: ['call-session', sessionId],
    queryFn: () => apiClient.get<CallSession>(`/api/calls/${sessionId}`),
    enabled: !!sessionId,
  });

  // Get user context for the call
  const { data: userContext, isLoading: contextLoading } = useQuery({
    queryKey: ['user-context', callSession?.userId],
    queryFn: () => apiClient.get<UserCallContext>(`/api/users/${callSession?.userId}/context`),
    enabled: !!callSession?.userId,
  });

  // Update call status mutation
  const updateCallMutation = useMutation({
    mutationFn: ({ status, data }: { status: string; data?: any }) =>
      apiClient.put(`/api/calls/${sessionId}/status`, { status, ...data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-session', sessionId] });
    },
  });

  // Record call outcome mutation
  const recordOutcomeMutation = useMutation({
    mutationFn: ({ outcome, notes, callbackDate }: { 
      outcome: CallOutcomeType; 
      notes: string; 
      callbackDate?: Date;
    }) =>
      apiClient.post(`/api/calls/${sessionId}/outcome`, {
        outcomeType: outcome,
        outcomeNotes: notes,
        callbackScheduled: !!callbackDate,
        callbackDate,
      }),
    onSuccess: () => {
      // Navigate back to queue after successful outcome recording
      navigate('/queue');
    },
  });

  const handleConnect = () => {
    setIsConnected(true);
    setCallStartTime(new Date());
    updateCallMutation.mutate({ 
      status: 'connected',
      data: { connectedAt: new Date() }
    });
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    updateCallMutation.mutate({ 
      status: 'completed',
      data: { endedAt: new Date() }
    });
  };

  const handleOutcomeSubmit = (outcome: CallOutcomeType, notes: string, callbackDate?: Date) => {
    recordOutcomeMutation.mutate({ outcome, notes, callbackDate });
  };

  if (sessionLoading || contextLoading) {
  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading call session...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!callSession || !userContext) {
    return (
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Call Session Not Found</h1>
          <p className="text-gray-600 mt-2">The requested call session could not be found.</p>
          <button
            onClick={() => navigate('/queue')}
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Return to Queue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">
            📞 Call: {userContext.user.firstName} {userContext.user.lastName}
          </h1>
          <button
            onClick={() => navigate('/queue')}
            className="text-gray-600 hover:text-gray-900 font-medium"
          >
            ← Back to Queue
          </button>
        </div>
        <p className="text-gray-600 mt-1">Session ID: {sessionId}</p>
      </div>

      {/* Call Timer */}
      <CallTimer startTime={callStartTime} isActive={isConnected} />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        {/* Left Column - User Context */}
        <div className="lg:col-span-2">
          <UserContextPanel userContext={userContext} />
        </div>

        {/* Right Column - Actions */}
        <div className="space-y-6">
          {/* Magic Link Panel */}
          <MagicLinkPanel 
            userId={userContext.user.id}
            phoneNumber={userContext.user.phoneNumber}
            callSessionId={sessionId}
          />

          {/* Call Outcome Form */}
          <CallOutcomeForm
            onSubmit={handleOutcomeSubmit}
            isSubmitting={recordOutcomeMutation.isPending}
          />
        </div>
      </div>

      {/* Call Controls - Fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg">
        <div className="max-w-7xl mx-auto">
          <CallControls
            isConnected={isConnected}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
            onMute={() => setIsMuted(!isMuted)}
            onHold={() => setIsOnHold(!isOnHold)}
            isMuted={isMuted}
            isOnHold={isOnHold}
          />
        </div>
      </div>

      {/* Bottom padding to account for fixed controls */}
      <div className="h-24"></div>
    </div>
  );
} 