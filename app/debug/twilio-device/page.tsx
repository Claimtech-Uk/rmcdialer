'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/modules/core/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/modules/core/components/ui/card';
import { Badge } from '@/modules/core/components/ui/badge';
import { RefreshCw, Phone, AlertCircle, CheckCircle, XCircle, Mic, MicOff } from 'lucide-react';
import { useGlobalTwilio } from '@/lib/providers/GlobalTwilioProvider';
import { api } from '@/lib/trpc/client';
import { useToast } from '@/modules/core/hooks/use-toast';

export default function TwilioDeviceDebugPage() {
  const [systemStatus, setSystemStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [micPermission, setMicPermission] = useState<PermissionState | null>(null);

  const { toast } = useToast();

  // Get auth session
  const { data: session } = api.auth.me.useQuery();

  // Get Global Twilio state
  const {
    isReady,
    isConnecting,
    error,
    incomingCall,
    isInCall,
    currentCallSid,
    getDevice,
    reinitialize,
    isEnabled
  } = useGlobalTwilio();

  // Check microphone permissions
  useEffect(() => {
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'microphone' as PermissionName })
        .then(result => {
          setMicPermission(result.state);
          result.addEventListener('change', () => {
            setMicPermission(result.state);
          });
        })
        .catch(() => setMicPermission(null));
    }
  }, []);

  // Fetch system status
  const fetchSystemStatus = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/debug-agent-device-status');
      const data = await response.json();
      setSystemStatus(data);
      setLastRefresh(new Date());
    } catch (err: any) {
      toast({
        title: "Failed to fetch system status",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize on load
  useEffect(() => {
    fetchSystemStatus();
  }, []);

  const handleReinitialize = async () => {
    try {
      await reinitialize();
      toast({
        title: "Twilio Device Reinitialized",
        description: "Device connection has been reset"
      });
      setTimeout(fetchSystemStatus, 1000); // Refresh status after reinit
    } catch (err: any) {
      toast({
        title: "Failed to reinitialize",
        description: err.message,
        variant: "destructive"
      });
    }
  };

  const StatusBadge = ({ condition, trueText, falseText }: { 
    condition: boolean; 
    trueText: string; 
    falseText: string; 
  }) => (
    <Badge variant={condition ? "default" : "destructive"} className="flex items-center gap-1">
      {condition ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {condition ? trueText : falseText}
    </Badge>
  );

  const MicPermissionBadge = () => {
    const getVariant = () => {
      switch (micPermission) {
        case 'granted': return 'default';
        case 'denied': return 'destructive';
        case 'prompt': return 'secondary';
        default: return 'outline';
      }
    };

    const getIcon = () => {
      switch (micPermission) {
        case 'granted': return <Mic className="h-3 w-3" />;
        case 'denied': return <MicOff className="h-3 w-3" />;
        default: return <AlertCircle className="h-3 w-3" />;
      }
    };

    return (
      <Badge variant={getVariant()} className="flex items-center gap-1">
        {getIcon()}
        Microphone: {micPermission || 'Unknown'}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Twilio Device Debug</h1>
          <p className="text-gray-600">Agent call system diagnostics</p>
        </div>
        <Button onClick={fetchSystemStatus} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Status
        </Button>
      </div>

      {lastRefresh && (
        <p className="text-sm text-gray-500">
          Last updated: {lastRefresh.toLocaleTimeString()}
        </p>
      )}

      {/* Agent Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Agent Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {session?.agent ? (
            <div>
              <p><strong>Name:</strong> {session.agent.firstName} {session.agent.lastName}</p>
              <p><strong>Email:</strong> {session.agent.email}</p>
              <p><strong>Agent ID:</strong> {session.agent.id}</p>
              <p><strong>Expected Twilio Identity:</strong> <code>agent_{session.agent.id}</code></p>
              <p><strong>Role:</strong> {session.agent.role}</p>
            </div>
          ) : (
            <p className="text-red-600">❌ No agent session found - please log in</p>
          )}
        </CardContent>
      </Card>

      {/* Real-time Device Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Live Device Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatusBadge condition={isEnabled} trueText="Feature Enabled" falseText="Feature Disabled" />
            <StatusBadge condition={isReady} trueText="Device Ready" falseText="Not Ready" />
            <StatusBadge condition={!isConnecting} trueText="Connected" falseText="Connecting..." />
            <MicPermissionBadge />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-800"><strong>Error:</strong> {error}</p>
            </div>
          )}

          {incomingCall && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-blue-800"><strong>Incoming Call:</strong> {incomingCall.from}</p>
            </div>
          )}

          {isInCall && currentCallSid && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-md">
              <p className="text-green-800"><strong>Active Call:</strong> {currentCallSid}</p>
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={handleReinitialize} variant="outline">
              Reinitialize Device
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* System Status */}
      {systemStatus && (
        <Card>
          <CardHeader>
            <CardTitle>System Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatusBadge 
                condition={systemStatus.system.globalTwilioEnabled} 
                trueText="Global Twilio ON" 
                falseText="Global Twilio OFF" 
              />
              <StatusBadge 
                condition={systemStatus.system.twilioCredentials.accountSid} 
                trueText="Account SID OK" 
                falseText="Missing Account SID" 
              />
              <StatusBadge 
                condition={systemStatus.system.twilioCredentials.apiKey} 
                trueText="API Key OK" 
                falseText="Missing API Key" 
              />
              <StatusBadge 
                condition={systemStatus.system.twilioCredentials.twimlAppSid} 
                trueText="TwiML App OK" 
                falseText="Missing TwiML App" 
              />
            </div>

            <div>
              <h4 className="font-semibold mb-2">Active Agents: {systemStatus.agents.length}</h4>
              <h4 className="font-semibold mb-2">Agent Sessions: {systemStatus.agentSessions.length}</h4>
              <h4 className="font-semibold mb-2">Available for Calls: {systemStatus.agentSessions.filter((s: any) => s.isAvailableForCalls).length}</h4>
            </div>

            {systemStatus.recommendations && (
              <div>
                <h4 className="font-semibold mb-2">Recommendations:</h4>
                <div className="space-y-1">
                  {systemStatus.recommendations.map((rec: string, index: number) => (
                    <p key={index} className="text-sm text-gray-700">{rec}</p>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Browser Console Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Browser Console Debug</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p><strong>To debug further, check your browser console (F12) for these messages:</strong></p>
            <ul className="list-disc ml-6 space-y-1">
              <li><code>🎧 Initializing Global Twilio for agent: [email]</code> - Provider starting</li>
              <li><code>🔑 Access token received</code> - Token generation working</li>
              <li><code>📱 Registering Twilio Device...</code> - Device registration attempt</li>
              <li><code>✅ Twilio Device registered successfully</code> - Device ready for calls</li>
              <li><code>📱 Twilio Device is ready for calls</code> - Final ready state</li>
            </ul>
            <p className="mt-3"><strong>Common error messages to look for:</strong></p>
            <ul className="list-disc ml-6 space-y-1">
              <li><code>❌ Failed to initialize Twilio Device</code> - Check credentials</li>
              <li><code>AccessTokenInvalid</code> - Token generation issue</li>
              <li><code>Development Mode: Missing Twilio credentials</code> - Environment setup</li>
              <li>Microphone permission errors</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 