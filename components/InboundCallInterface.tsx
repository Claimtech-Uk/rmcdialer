'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/modules/core/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/modules/core/components/ui/card';
import { Badge } from '@/modules/core/components/ui/badge';
import { Phone, PhoneOff, User, Clock, Mic, MicOff, Volume2, VolumeX, X } from 'lucide-react';
import { IncomingCallInfo } from '@/modules/calls/services/twilio-voice.service';
import { useToast } from '@/modules/core/hooks/use-toast';

interface CallerInfo {
  id: number;
  first_name: string;
  last_name: string;
  phone_number: string;
  email_address?: string;
  claims?: any[];
  requirements?: any[];
}

interface InboundCallInterfaceProps {
  incomingCall: IncomingCallInfo | null;
  onAccept: () => void;
  onReject: () => void;
  onEndCall: () => void;
  isConnected: boolean;
  callDuration: number;
}

export function InboundCallInterface({
  incomingCall,
  onAccept,
  onReject,
  onEndCall,
  isConnected,
  callDuration
}: InboundCallInterfaceProps) {
  const [callerInfo, setCallerInfo] = useState<CallerInfo | null>(null);
  const [isLoadingCaller, setIsLoadingCaller] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(100);
  const { toast } = useToast();

  // Format call duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // DEBUG: Log what the agent receives from Twilio
  useEffect(() => {
    if (incomingCall) {
      console.log('🎯 Agent received incoming call object:', {
        callSid: incomingCall.callSid,
        callSessionId: incomingCall.callSessionId,
        callerName: incomingCall.callerName,
        userId: incomingCall.userId,
        from: incomingCall.from,
        to: incomingCall.to,
        fullObject: incomingCall
      });
    }
  }, [incomingCall]);

  // Lookup caller information - prioritize session UUID lookup (most efficient!)
  useEffect(() => {
    if (incomingCall && !callerInfo && !isLoadingCaller) {
      console.log('🔍 Starting caller lookup...');
      
      // PRIORITY 1: Use call session UUID from TwiML parameters (most reliable)
      if (incomingCall.callSessionId && incomingCall.callSessionId !== 'unknown') {
        console.log('✅ Using call session UUID:', incomingCall.callSessionId);
        lookupCallerFromSessionId(incomingCall.callSessionId);
      } else {
        console.log('❌ No valid call session UUID, falling back to Call SID lookup');
        console.log('Received callSessionId:', incomingCall.callSessionId);
        // Fallback to Call SID lookup (should not be needed after agent ID fix)
        lookupCallerFromSession(incomingCall.callSid);
      }
    }
  }, [incomingCall, callerInfo, isLoadingCaller]);

    // Direct session lookup by session ID (most efficient!)
    const lookupCallerFromSessionId = async (sessionId: string) => {
      setIsLoadingCaller(true);
      try {
        console.log('🔍 Looking up caller from call session ID:', sessionId);
        
        // Use the direct session lookup tRPC endpoint
        const response = await fetch('/api/trpc/calls.getCallSession', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            json: {
              sessionId: sessionId
            }
          })
        });
        
        if (response.ok) {
          const sessionData = await response.json();
          
          if (sessionData?.result?.data?.success && sessionData.result.data.session) {
            const session = sessionData.result.data.session;
            
            // Extract user context from the call session's userClaimsContext
            if (session.userClaimsContext) {
              try {
                const userContext = JSON.parse(session.userClaimsContext);
                
                if (userContext.knownCaller && userContext.callerName) {
                  // Build caller info from stored context
                  const [firstName, lastName] = userContext.callerName.split(' ');
                  setCallerInfo({
                    id: session.userId,
                    first_name: firstName,
                    last_name: lastName,
                    phone_number: userContext.phoneNumber,
                    email_address: undefined, // Not stored in context
                    claims: userContext.claims || [],
                    requirements: userContext.requirements || []
                  });
                  console.log('👤 Found caller from session ID:', userContext.callerName);
                } else {
                  console.log('❓ Unknown caller from session ID');
                }
              } catch (parseError) {
                console.error('❌ Error parsing userClaimsContext:', parseError);
              }
            }
          } else {
            console.log('❓ Call session not found in database');
          }
        } else {
          console.error('❌ Failed to fetch call session:', response.status, response.statusText);
          
          if (response.status === 500) {
            toast({
              title: "Database Error",
              description: "Unable to load caller information from database",
              variant: "destructive"
            });
          }
        }
      } catch (error) {
        console.error('❌ Error looking up caller from session ID:', error);
        
        toast({
          title: "Lookup Failed",
          description: "Network error while loading caller information",
          variant: "destructive"
        });
      } finally {
        setIsLoadingCaller(false);
      }
    };

    const lookupCallerFromSession = async (callSid: string) => {
    setIsLoadingCaller(true);
    try {
      console.log('🔍 Looking up caller from call session by Call SID:', callSid);
      
      // CRITICAL FIX: Validate Call SID format before making request
      if (!callSid || (!callSid.startsWith('CA') || callSid.length !== 34)) {
        console.error('🚨 Invalid Call SID format - skipping database lookup:', {
          callSid,
          expectedFormat: 'CA + 32 characters',
          actualLength: callSid?.length || 0
        });
        
        toast({
          title: "Call Information Unavailable",
          description: "Unable to load caller details due to invalid call identifier",
          variant: "destructive"
        });
        
        return; // Skip the lookup entirely
      }
      
      // STEP 1: Get session UUID using Call SID
      console.log('🔍 Step 1: Getting session UUID from Call SID...');
      const sidResponse = await fetch('/api/trpc/calls.getCallSessionByCallSid', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          json: {
            callSid: callSid
          }
        })
      });
      
      if (!sidResponse.ok) {
        console.error('❌ Failed to get session UUID from Call SID:', sidResponse.status);
        toast({
          title: "Session Lookup Failed",
          description: "Unable to find call session by Call SID",
          variant: "destructive"
        });
        return;
      }
      
      const sidData = await sidResponse.json();
      
      if (!sidData?.result?.data?.success || !sidData.result.data.callSession?.id) {
        console.error('❌ No session UUID found in Call SID response');
        toast({
          title: "Session Not Found",
          description: "Call session not found for this Call SID",
          variant: "destructive"
        });
        return;
      }
      
      const sessionUUID = sidData.result.data.callSession.id;
      console.log('✅ Got session UUID:', sessionUUID);
      
      // STEP 2: Use session UUID with the proper session endpoint
      console.log('🔍 Step 2: Looking up caller using session UUID...');
      const response = await fetch('/api/trpc/calls.getCallSession', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          json: {
            sessionId: sessionUUID
          }
        })
      });
      
      if (response.ok) {
        const sessionData = await response.json();
        
        if (sessionData?.result?.data?.success && sessionData.result.data.session) {
          const session = sessionData.result.data.session;
          
          // Extract user context from the call session's userClaimsContext
          if (session.userClaimsContext) {
            try {
              const userContext = JSON.parse(session.userClaimsContext);
              
              if (userContext.knownCaller && userContext.callerName) {
                // Build caller info from stored context
                const [firstName, lastName] = userContext.callerName.split(' ');
                setCallerInfo({
                  id: session.userId,
                  first_name: firstName,
                  last_name: lastName,
                  phone_number: userContext.phoneNumber,
                  email_address: undefined, // Not stored in context
                  claims: userContext.claims || [],
                  requirements: userContext.requirements || []
                });
                console.log('👤 Found caller from session:', userContext.callerName);
              } else {
                console.log('❓ Unknown caller from session');
              }
            } catch (parseError) {
              console.error('❌ Error parsing userClaimsContext:', parseError);
            }
          }
        } else {
          console.log('❓ Call session not found in database');
        }
      } else {
        console.error('❌ Failed to fetch call session:', response.status, response.statusText);
        
        if (response.status === 500) {
          toast({
            title: "Database Error",
            description: "Unable to load caller information from database",
            variant: "destructive"
          });
        }
      }
    } catch (error) {
      console.error('❌ Error looking up caller from session:', error);
      
      toast({
        title: "Lookup Failed",
        description: "Network error while loading caller information",
        variant: "destructive"
      });
    } finally {
      setIsLoadingCaller(false);
    }
  };

  const handleAccept = async () => {
    console.log('✅ Accepting inbound call');
    onAccept();
  };

  const handleReject = () => {
    console.log('❌ Rejecting inbound call');
    onReject();
  };

  const handleEndCall = () => {
    console.log('📞 Ending call');
    onEndCall();
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    // TODO: Implement actual mute functionality with Twilio
    toast({
      title: isMuted ? "Unmuted" : "Muted",
      description: isMuted ? "Your microphone is now active" : "Your microphone is now muted"
    });
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">
        
        {/* Header */}
        <div className={`p-6 text-white ${isConnected ? 'bg-green-600' : 'bg-blue-600'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-full ${isConnected ? 'bg-green-700' : 'bg-blue-700'}`}>
                <Phone className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">
                  {isConnected ? 'Call Connected' : 'Incoming Call'}
                </h2>
                {isConnected && (
                  <p className="text-green-100">
                    <Clock className="w-4 h-4 inline mr-1" />
                    {formatDuration(callDuration)}
                  </p>
                )}
              </div>
            </div>
            
            {isConnected && (
              <Badge className="bg-green-700 text-green-100 border-green-600">
                Connected
              </Badge>
            )}
          </div>
        </div>

        {/* Caller Information */}
        <div className="p-6">
          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <User className="w-10 h-10 text-gray-500" />
            </div>
            
                         {isLoadingCaller ? (
               <div>
                 <h3 className="text-xl font-semibold text-gray-600">Loading...</h3>
                 <p className="text-gray-500">{incomingCall?.from || 'Unknown'}</p>
               </div>
             ) : callerInfo ? (
               <div>
                 <h3 className="text-2xl font-semibold text-gray-900">
                   {callerInfo.first_name} {callerInfo.last_name}
                 </h3>
                 <p className="text-gray-600">{callerInfo.phone_number}</p>
                 {callerInfo.email_address && (
                   <p className="text-sm text-gray-500">{callerInfo.email_address}</p>
                 )}
               </div>
             ) : (
               <div>
                 <h3 className="text-xl font-semibold text-gray-600">Unknown Caller</h3>
                 <p className="text-gray-500">{incomingCall?.from || 'Unknown'}</p>
               </div>
             )}
          </div>

          {/* Caller Context - Show when connected and we have info */}
          {isConnected && callerInfo && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h4 className="font-medium text-gray-900 mb-2">Caller Information</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Phone:</span>
                  <span className="ml-2 text-gray-900">{callerInfo.phone_number}</span>
                </div>
                {callerInfo.email_address && (
                  <div>
                    <span className="text-gray-500">Email:</span>
                    <span className="ml-2 text-gray-900">{callerInfo.email_address}</span>
                  </div>
                )}
              </div>
              
              <div className="mt-4">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => window.open(`/users/${callerInfo.id}`, '_blank')}
                >
                  View Full Profile
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Call Controls */}
        <div className="p-6 bg-gray-50 border-t">
          {!isConnected ? (
            /* Incoming call buttons */
            <div className="flex justify-center gap-6">
              <Button
                onClick={handleReject}
                variant="destructive"
                size="lg"
                className="flex items-center gap-2 px-8"
              >
                <PhoneOff className="w-5 h-5" />
                Decline
              </Button>
              <Button
                onClick={handleAccept}
                className="bg-green-600 hover:bg-green-700 flex items-center gap-2 px-8"
                size="lg"
              >
                <Phone className="w-5 h-5" />
                Answer
              </Button>
            </div>
          ) : (
            /* Connected call controls */
            <div className="flex justify-center gap-4">
              <Button
                onClick={toggleMute}
                variant={isMuted ? "destructive" : "outline"}
                size="lg"
                className="flex items-center gap-2"
              >
                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                {isMuted ? 'Unmute' : 'Mute'}
              </Button>
              
              <Button
                onClick={handleEndCall}
                variant="destructive"
                size="lg"
                className="flex items-center gap-2 px-8"
              >
                <PhoneOff className="w-5 h-5" />
                End Call
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 