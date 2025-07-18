'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/trpc/client';
import { 
  Phone, 
  PhoneCall,
  PhoneOff, 
  Mic, 
  MicOff, 
  Pause, 
  Play,
  ArrowLeft,
  Clock,
  User,
  MapPin,
  Building,
  DollarSign,
  FileText,
  Calendar,
  Send
} from 'lucide-react';
import { Button } from '@/modules/core/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/modules/core/components/ui/card';
import { Badge } from '@/modules/core/components/ui/badge';
import { Alert, AlertDescription } from '@/modules/core/components/ui/alert';
import { useToast } from '@/modules/core/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/modules/core/components/ui/select';
import type { UserCallContext, CallOutcome } from '@/modules/calls/types/call.types';

// Call outcome types for the form
type CallOutcomeType = 'contacted' | 'no_answer' | 'busy' | 'wrong_number' | 'not_interested' | 'callback_requested' | 'left_voicemail' | 'failed';

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
    <div className="flex justify-center space-x-4 p-4 border-t bg-card">
      {!isConnected ? (
        <Button onClick={onConnect} size="lg" className="bg-green-600 hover:bg-green-700">
          <PhoneCall className="w-5 h-5 mr-2" />
          Start Call
        </Button>
      ) : (
        <>
          <Button
            onClick={onMute}
            variant={isMuted ? "destructive" : "outline"}
            size="sm"
          >
            {isMuted ? <MicOff className="w-4 h-4 mr-2" /> : <Mic className="w-4 h-4 mr-2" />}
            {isMuted ? 'Unmute' : 'Mute'}
          </Button>
          
          <Button
            onClick={onHold}
            variant={isOnHold ? "default" : "outline"}
            size="sm"
          >
            {isOnHold ? <Play className="w-4 h-4 mr-2" /> : <Pause className="w-4 h-4 mr-2" />}
            {isOnHold ? 'Resume' : 'Hold'}
          </Button>
          
          <Button onClick={onDisconnect} variant="destructive" size="lg">
            <PhoneOff className="w-5 h-5 mr-2" />
            End Call
          </Button>
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
    <Card className="bg-primary/10 border-primary/20">
      <CardContent className="p-6 text-center">
        <div className="text-3xl font-mono font-bold text-primary">
          {formatTime(duration)}
        </div>
        <div className="text-sm text-muted-foreground flex items-center justify-center mt-2">
          {isActive ? (
            <>
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse mr-2" />
              Call Active
            </>
          ) : (
            <>
              <Clock className="w-4 h-4 mr-2" />
              Call Ended
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface UserContextPanelProps {
  userContext: UserCallContext;
}

function UserContextPanel({ userContext }: UserContextPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="w-5 h-5" />
          Contact Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* User Information */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">Name</label>
            <p className="font-medium">{userContext.firstName} {userContext.lastName}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Phone</label>
            <p className="font-medium">{userContext.phoneNumber}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Email</label>
            <p className="font-medium">{userContext.email}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Address</label>
            <p className="font-medium">{userContext.address?.fullAddress || 'Not available'}</p>
          </div>
        </div>

        {/* Claims Information */}
        <div>
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <Building className="w-4 h-4" />
            Claims ({userContext.claims.length})
          </h4>
          <div className="space-y-3">
            {userContext.claims.map((claim) => (
              <Card key={claim.id} className="bg-muted/50">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-medium">{claim.type} - {claim.lender}</p>
                      {claim.value && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          £{claim.value.toLocaleString()}
                        </p>
                      )}
                    </div>
                    <Badge variant={
                      claim.status === 'complete' ? 'default' :
                      claim.status === 'documents_needed' ? 'destructive' : 'secondary'
                    }>
                      {claim.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  
                  {/* Requirements */}
                  {claim.requirements.length > 0 && (
                    <div className="mt-2">
                      <p className="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        Outstanding Requirements:
                      </p>
                      <div className="space-y-1">
                        {claim.requirements.map((req) => (
                          <p key={req.id} className="text-sm text-muted-foreground ml-4">
                            • {req.type.replace('_', ' ')} ({req.status})
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Vehicle Packages */}
                  {claim.vehiclePackages?.map((vehicle) => (
                    <div key={vehicle.registration} className="mt-2 text-sm">
                      <p><strong>Vehicle:</strong> {vehicle.make} {vehicle.model} ({vehicle.registration})</p>
                      <p><strong>Dealer:</strong> {vehicle.dealershipName}</p>
                      {vehicle.monthlyPayment && (
                        <p><strong>Payment:</strong> £{vehicle.monthlyPayment}/month</p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Call History */}
        <div>
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Call History
          </h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Total Attempts</p>
              <p className="font-medium">{userContext.callScore.totalAttempts}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Last Outcome</p>
              <p className="font-medium">{userContext.callScore.lastOutcome || 'None'}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
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

  const outcomeOptions: { value: CallOutcomeType; label: string; variant: 'default' | 'destructive' | 'secondary' }[] = [
    { value: 'contacted', label: '✅ Successfully Contacted', variant: 'default' },
    { value: 'callback_requested', label: '📅 Callback Requested', variant: 'default' },
    { value: 'not_interested', label: '❌ Not Interested', variant: 'destructive' },
    { value: 'no_answer', label: '📞 No Answer', variant: 'secondary' },
    { value: 'left_voicemail', label: '📧 Left Voicemail', variant: 'secondary' },
    { value: 'wrong_number', label: '🚫 Wrong Number', variant: 'destructive' },
    { value: 'busy', label: '📵 Line Busy', variant: 'secondary' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const callbackDateTime = scheduleCallback && callbackDate && callbackTime 
      ? new Date(`${callbackDate}T${callbackTime}`)
      : undefined;
    
    onSubmit(outcome, notes, callbackDateTime);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Call Outcome</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Outcome Selection */}
          <div>
            <label className="text-sm font-medium">Call Outcome</label>
            <div className="grid grid-cols-1 gap-2 mt-2">
              {outcomeOptions.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={outcome === option.value ? option.variant : "outline"}
                  onClick={() => setOutcome(option.value)}
                  className="justify-start h-auto p-3"
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm font-medium">Call Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full mt-2 px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
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
                className="rounded border-input"
              />
              <span className="text-sm font-medium">Schedule Callback</span>
            </label>
            
            {scheduleCallback && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={callbackDate}
                  onChange={(e) => setCallbackDate(e.target.value)}
                  className="px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                  min={new Date().toISOString().split('T')[0]}
                />
                <input
                  type="time"
                  value={callbackTime}
                  onChange={(e) => setCallbackTime(e.target.value)}
                  className="px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            )}
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isSubmitting || !notes.trim()}
            className="w-full"
            size="lg"
          >
            {isSubmitting ? 'Recording...' : 'Record Outcome & End Call'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// Simplified Magic Link Panel (placeholder for now)
function MagicLinkPanel({ userId, phoneNumber, callSessionId }: { userId: number; phoneNumber: string; callSessionId: string }) {
  const { toast } = useToast();
  
  const sendMagicLinkMutation = api.communications.sendMagicLinkSMS.useMutation({
    onSuccess: () => {
      toast({
        title: "Magic Link Sent",
        description: "User will receive the link via SMS",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleSendLink = () => {
    sendMagicLinkMutation.mutate({
      userId,
      phoneNumber,
      linkType: 'claimPortal',
      callSessionId
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="w-5 h-5" />
          Magic Links
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Button 
          onClick={handleSendLink} 
          disabled={sendMagicLinkMutation.isPending}
          className="w-full"
        >
          <Send className="w-4 h-4 mr-2" />
          {sendMagicLinkMutation.isPending ? 'Sending...' : 'Send Claim Portal Link'}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function CallSessionPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const sessionId = params.sessionId as string;

  // Call state
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const [callStartTime, setCallStartTime] = useState<Date>();

  // Get call session data
  const { 
    data: callSessionData, 
    isLoading: sessionLoading,
    error: sessionError 
  } = api.calls.getCallSession.useQuery(
    { sessionId },
    { enabled: !!sessionId }
  );

  // Update call status mutation
  const updateCallMutation = api.calls.updateCallStatus.useMutation({
    onSuccess: () => {
      toast({
        title: "Call Status Updated",
        description: "Call status has been updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Record call outcome mutation
  const recordOutcomeMutation = api.calls.recordOutcome.useMutation({
    onSuccess: () => {
      toast({
        title: "Outcome Recorded",
        description: "Call outcome has been recorded successfully",
      });
      router.push('/queue');
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleConnect = () => {
    setIsConnected(true);
    setCallStartTime(new Date());
    updateCallMutation.mutate({ 
      sessionId,
      status: 'connected',
      connectedAt: new Date()
    });
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    updateCallMutation.mutate({ 
      sessionId,
      status: 'completed',
      endedAt: new Date()
    });
  };

  const handleOutcomeSubmit = (outcome: CallOutcomeType, notes: string, callbackDate?: Date) => {
    recordOutcomeMutation.mutate({ 
      sessionId,
      outcomeType: outcome,
      outcomeNotes: notes,
      callbackDateTime: callbackDate
    });
  };

  if (sessionLoading) {
    return (
      <div className="max-w-7xl mx-auto py-6 px-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading call session...</p>
          </div>
        </div>
      </div>
    );
  }

  if (sessionError || !callSessionData) {
    return (
      <div className="max-w-7xl mx-auto py-6 px-6">
        <Alert variant="destructive">
          <AlertDescription>
            {sessionError?.message || 'Call session not found'}
          </AlertDescription>
        </Alert>
        <div className="mt-6">
          <Button onClick={() => router.push('/queue')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Return to Queue
          </Button>
        </div>
      </div>
    );
  }

  const { userContext } = callSessionData;

  return (
    <div className="max-w-7xl mx-auto py-6 px-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <PhoneCall className="w-8 h-8" />
            Call: {userContext.firstName} {userContext.lastName}
          </h1>
          <p className="text-muted-foreground">Session ID: {sessionId}</p>
        </div>
        <Button variant="ghost" onClick={() => router.push('/queue')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Queue
        </Button>
      </div>

      {/* Call Timer */}
      <CallTimer startTime={callStartTime} isActive={isConnected} />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - User Context */}
        <div className="lg:col-span-2">
          <UserContextPanel userContext={userContext} />
        </div>

        {/* Right Column - Actions */}
        <div className="space-y-6">
          {/* Magic Link Panel */}
          <MagicLinkPanel 
            userId={userContext.userId}
            phoneNumber={userContext.phoneNumber}
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
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t shadow-lg z-50">
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