'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/modules/core/components/ui/card';
import { Button } from '@/modules/core/components/ui/button';
import { Badge } from '@/modules/core/components/ui/badge';
import { 
  Phone, 
  PhoneOff, 
  Mic, 
  MicOff, 
  Clock, 
  User,
  MapPin,
  FileText,
  DollarSign,
  Building,
  AlertCircle,
  CheckCircle2,
  Calendar
} from 'lucide-react';
import { useTwilioVoice } from '../hooks/useTwilioVoice';
import { CallOutcomeModal } from './CallOutcomeModal';
import type { UserCallContext, CallOutcomeOptions } from '../types/call.types';

interface CallInterfaceProps {
  userContext: UserCallContext;
  onCallComplete?: (outcome: CallOutcomeOptions) => void;
  agentId: string;
  agentEmail: string;
}

export function CallInterface({ 
  userContext, 
  onCallComplete,
  agentId,
  agentEmail
}: CallInterfaceProps) {
  const [showOutcomeModal, setShowOutcomeModal] = useState(false);
  const [callSessionId, setCallSessionId] = useState<string>('');
  const [submittingOutcome, setSubmittingOutcome] = useState(false);

  const {
    isReady,
    isConnecting,
    isInCall,
    callStatus,
    error,
    makeCall,
    hangUp,
    toggleMute,
    sendDigits,
    callDuration,
    isMuted
  } = useTwilioVoice({
    agentId,
    agentEmail,
    autoConnect: true
  });

  // Handle call end - show outcome modal
  useEffect(() => {
    if (callStatus?.state === 'disconnected' && callDuration > 0) {
      // Generate a session ID (in production, this would come from the service)
      setCallSessionId(`session_${Date.now()}`);
      setShowOutcomeModal(true);
    }
  }, [callStatus?.state, callDuration]);

  const handleMakeCall = async () => {
    try {
      await makeCall({
        phoneNumber: userContext.phoneNumber,
        userContext: {
          userId: userContext.userId,
          firstName: userContext.firstName,
          lastName: userContext.lastName,
          claimId: userContext.claims[0]?.id
        }
      });
    } catch (error) {
      console.error('Failed to make call:', error);
    }
  };

  const handleCallEnd = () => {
    hangUp();
  };

  const handleOutcomeSubmit = async (outcome: CallOutcomeOptions) => {
    setSubmittingOutcome(true);
    try {
      // In production, this would call the CallService via tRPC
      console.log('Submitting call outcome:', {
        sessionId: callSessionId,
        outcome,
        userContext
      });
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setShowOutcomeModal(false);
      onCallComplete?.(outcome);
    } catch (error) {
      console.error('Failed to save call outcome:', error);
    } finally {
      setSubmittingOutcome(false);
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getPendingRequirements = () => {
    return userContext.claims.flatMap(claim => 
      claim.requirements.filter(req => req.status === 'PENDING')
    );
  };

  const getTotalClaimValue = () => {
    return userContext.claims.reduce((total, claim) => total + (claim.value || 0), 0);
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Context Panel */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Customer Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-2xl font-bold">
                    {userContext.firstName} {userContext.lastName}
                  </div>
                  <div className="text-gray-600 flex items-center gap-2 mt-1">
                    <Phone className="w-4 h-4" />
                    {userContext.phoneNumber}
                  </div>
                  {userContext.address && (
                    <div className="text-gray-600 flex items-center gap-2 mt-1">
                      <MapPin className="w-4 h-4" />
                      {userContext.address.fullAddress}
                    </div>
                  )}
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      {userContext.claims.length} Claims
                    </Badge>
                    <Badge 
                      variant={getPendingRequirements().length > 0 ? "destructive" : "default"}
                      className="flex items-center gap-1"
                    >
                      <AlertCircle className="w-3 h-3" />
                      {getPendingRequirements().length} Pending
                    </Badge>
                  </div>
                  
                  {getTotalClaimValue() > 0 && (
                    <div className="flex items-center gap-2 text-green-600">
                      <DollarSign className="w-4 h-4" />
                      <span className="font-semibold">
                        £{getTotalClaimValue().toLocaleString()}
                      </span>
                      <span className="text-sm text-gray-500">total value</span>
                    </div>
                  )}
                  
                  <div className="text-sm text-gray-500">
                    Score: {userContext.callScore.currentScore} | 
                    Attempts: {userContext.callScore.totalAttempts}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Claims Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Active Claims</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {userContext.claims.map((claim, index) => (
                  <div key={claim.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{claim.type}</Badge>
                        <span className="font-medium">{claim.lender}</span>
                      </div>
                      <Badge 
                        variant={claim.status === 'documents_needed' ? 'destructive' : 'default'}
                      >
                        {claim.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    
                    {claim.value && (
                      <div className="text-lg font-semibold text-green-600 mb-2">
                        £{claim.value.toLocaleString()}
                      </div>
                    )}
                    
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Pending Requirements:</h4>
                      {claim.requirements.filter(req => req.status === 'PENDING').map((req, reqIndex) => (
                        <div key={req.id} className="flex items-center gap-2 text-sm">
                          <AlertCircle className="w-3 h-3 text-amber-500" />
                          <span>{req.type.replace(/_/g, ' ')}</span>
                          {req.reason && (
                            <span className="text-gray-500">- {req.reason}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Call Controls Panel */}
        <div className="space-y-6">
          {/* Call Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="w-5 h-5" />
                Call Controls
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Connection Status */}
              <div className={`p-3 rounded-lg ${
                isReady ? 'bg-green-50 text-green-800' : 
                isConnecting ? 'bg-yellow-50 text-yellow-800' : 
                'bg-gray-50 text-gray-800'
              }`}>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    isReady ? 'bg-green-500' : 
                    isConnecting ? 'bg-yellow-500' : 
                    'bg-gray-500'
                  }`} />
                  <span className="font-medium">
                    {isConnecting ? 'Connecting...' : isReady ? 'Ready' : 'Not Connected'}
                  </span>
                </div>
                {error && (
                  <div className="text-red-600 text-sm mt-1">{error}</div>
                )}
              </div>

              {/* Call Duration */}
              {isInCall && (
                <div className="text-center">
                  <div className="text-3xl font-mono font-bold text-blue-600">
                    {formatDuration(callDuration)}
                  </div>
                  <div className="text-sm text-gray-500">Call Duration</div>
                </div>
              )}

              {/* Main Call Button */}
              <div className="flex justify-center">
                {!isInCall ? (
                  <Button
                    onClick={handleMakeCall}
                    disabled={!isReady}
                    size="lg"
                    className="bg-green-500 hover:bg-green-600 text-white px-8 py-4 rounded-full"
                  >
                    <Phone className="w-6 h-6 mr-2" />
                    Call {userContext.firstName}
                  </Button>
                ) : (
                  <Button
                    onClick={handleCallEnd}
                    size="lg"
                    className="bg-red-500 hover:bg-red-600 text-white px-8 py-4 rounded-full"
                  >
                    <PhoneOff className="w-6 h-6 mr-2" />
                    End Call
                  </Button>
                )}
              </div>

              {/* In-Call Controls */}
              {isInCall && (
                <div className="flex justify-center gap-4">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={toggleMute}
                    className={isMuted ? 'bg-red-50 text-red-600' : ''}
                  >
                    {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </Button>
                </div>
              )}

              {/* DTMF Keypad (if in call) */}
              {isInCall && (
                <div>
                  <h4 className="font-medium mb-2 text-center">Dial Pad</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((digit) => (
                      <Button
                        key={digit}
                        variant="outline"
                        onClick={() => sendDigits(digit)}
                        className="aspect-square"
                      >
                        {digit}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start">
                <FileText className="w-4 h-4 mr-2" />
                View Documents
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Calendar className="w-4 h-4 mr-2" />
                Schedule Callback
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Mark as Complete
              </Button>
            </CardContent>
          </Card>

          {/* Call History Preview */}
          {userContext.callScore.lastCallAt && (
            <Card>
              <CardHeader>
                <CardTitle>Previous Contact</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm space-y-1">
                  <div>
                    <span className="font-medium">Last Call:</span>{' '}
                    {new Date(userContext.callScore.lastCallAt).toLocaleDateString()}
                  </div>
                  {userContext.callScore.lastOutcome && (
                    <div>
                      <span className="font-medium">Outcome:</span>{' '}
                      {userContext.callScore.lastOutcome.replace('_', ' ')}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Call Outcome Modal */}
      <CallOutcomeModal
        isOpen={showOutcomeModal}
        onClose={() => setShowOutcomeModal(false)}
        onSubmit={handleOutcomeSubmit}
        callSessionId={callSessionId}
        userContext={userContext}
        callDuration={callDuration}
        isSubmitting={submittingOutcome}
      />
    </>
  );
} 