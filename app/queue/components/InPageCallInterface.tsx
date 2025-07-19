'use client';

import { useState, useEffect } from 'react';
import { 
  Phone, 
  PhoneOff, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX,
  Clock,
  User,
  X,
  Maximize2
} from 'lucide-react';
import { Button } from '@/modules/core/components/ui/button';
import { Card, CardContent } from '@/modules/core/components/ui/card';
import { Badge } from '@/modules/core/components/ui/badge';

interface CallData {
  userId: number;
  name: string;
  phoneNumber: string;
  status: 'connecting' | 'connected' | 'ended' | 'failed';
  startTime?: Date;
}

interface InPageCallInterfaceProps {
  callData: CallData;
  onEndCall: () => void;
  onOpenFullInterface?: () => void;
}

export default function InPageCallInterface({ 
  callData, 
  onEndCall, 
  onOpenFullInterface 
}: InPageCallInterfaceProps) {
  const [callDuration, setCallDuration] = useState<string>('00:00');
  const [isMuted, setIsMuted] = useState(false);
  const [volumeEnabled, setVolumeEnabled] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);

  // Update call duration timer
  useEffect(() => {
    if (callData.status === 'connected' && callData.startTime) {
      const interval = setInterval(() => {
        const now = new Date();
        const start = new Date(callData.startTime!);
        const diffMs = now.getTime() - start.getTime();
        const minutes = Math.floor(diffMs / 60000);
        const seconds = Math.floor((diffMs % 60000) / 1000);
        setCallDuration(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [callData.status, callData.startTime]);

  // Auto-connect simulation (in real implementation, this would use Twilio)
  useEffect(() => {
    if (callData.status === 'connecting') {
      const timer = setTimeout(() => {
        // Simulate successful connection
        // In real implementation, this would be handled by Twilio callbacks
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [callData.status]);

  const getStatusColor = () => {
    switch (callData.status) {
      case 'connecting': return 'bg-yellow-500';
      case 'connected': return 'bg-green-500';
      case 'ended': return 'bg-gray-500';
      case 'failed': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = () => {
    switch (callData.status) {
      case 'connecting': return 'Connecting...';
      case 'connected': return 'Connected';
      case 'ended': return 'Call Ended';
      case 'failed': return 'Failed';
      default: return 'Unknown';
    }
  };

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Card className="shadow-xl border-2 border-blue-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${getStatusColor()} animate-pulse`}></div>
              <span className="text-sm font-medium">{callData.name}</span>
              <span className="text-xs text-gray-500">{callDuration}</span>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => setIsMinimized(false)}
                className="h-6 w-6 p-0"
              >
                <Maximize2 className="w-3 h-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80">
      <Card className="shadow-2xl border-2 border-blue-500 bg-white">
        <CardContent className="p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-blue-600" />
              <span className="font-medium text-sm">Active Call</span>
            </div>
            <div className="flex items-center gap-1">
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => setIsMinimized(true)}
                className="h-6 w-6 p-0"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          </div>

          {/* Call Status */}
          <div className="text-center mb-4">
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className={`w-3 h-3 rounded-full ${getStatusColor()}`}>
                {callData.status === 'connecting' && (
                  <div className="w-3 h-3 rounded-full bg-yellow-400 animate-ping"></div>
                )}
              </div>
              <Badge variant="outline" className="text-xs">
                {getStatusText()}
              </Badge>
            </div>
            
            <div className="font-semibold text-lg">{callData.name}</div>
            <div className="text-sm text-gray-600 mb-2">{callData.phoneNumber}</div>
            
            {callData.status === 'connected' && (
              <div className="flex items-center justify-center gap-1 text-sm text-gray-500">
                <Clock className="w-3 h-3" />
                {callDuration}
              </div>
            )}
          </div>

          {/* Call Controls */}
          <div className="flex items-center justify-center gap-3 mb-4">
            {callData.status === 'connected' && (
              <>
                <Button
                  size="sm"
                  variant={isMuted ? "destructive" : "outline"}
                  onClick={() => setIsMuted(!isMuted)}
                  className="w-10 h-10 rounded-full"
                >
                  {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </Button>

                <Button
                  size="sm"
                  variant={volumeEnabled ? "outline" : "destructive"}
                  onClick={() => setVolumeEnabled(!volumeEnabled)}
                  className="w-10 h-10 rounded-full"
                >
                  {volumeEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </Button>
              </>
            )}

            <Button
              size="sm"
              variant="destructive"
              onClick={onEndCall}
              className="w-12 h-12 rounded-full bg-red-600 hover:bg-red-700"
              disabled={callData.status === 'ended'}
            >
              <PhoneOff className="w-5 h-5" />
            </Button>
          </div>

          {/* Status Messages */}
          {callData.status === 'connecting' && (
            <div className="text-center text-sm text-gray-600 mb-3">
              <div className="animate-pulse">Establishing connection...</div>
            </div>
          )}

          {callData.status === 'failed' && (
            <div className="text-center text-sm text-red-600 mb-3">
              Unable to connect. Please try again.
            </div>
          )}

          {callData.status === 'ended' && (
            <div className="text-center text-sm text-gray-600 mb-3">
              Call completed
            </div>
          )}

          {/* Quick Actions */}
          {callData.status === 'connected' && onOpenFullInterface && (
            <div className="border-t pt-3">
              <Button 
                size="sm" 
                variant="outline" 
                onClick={onOpenFullInterface}
                className="w-full text-xs"
              >
                Open Full Call Interface
              </Button>
            </div>
          )}

          {/* Call Notes Quick Access */}
          {(callData.status === 'connected' || callData.status === 'ended') && (
            <div className="border-t pt-3 mt-3">
              <div className="text-xs text-gray-500 mb-2">Quick Notes:</div>
              <textarea 
                className="w-full text-xs border rounded p-2 resize-none" 
                rows={2}
                placeholder="Add call notes..."
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 