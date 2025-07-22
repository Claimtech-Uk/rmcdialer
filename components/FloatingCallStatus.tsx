'use client';

import { useGlobalTwilio } from '@/lib/providers/GlobalTwilioProvider';
import { useGlobalCall } from '@/hooks/useGlobalCall';
import { Button } from '@/modules/core/components/ui/button';
import { Card, CardContent } from '@/modules/core/components/ui/card';
import { Phone, PhoneOff, Maximize2, Minimize2, Volume2, VolumeX } from 'lucide-react';
import { useState, useEffect } from 'react';
import { isFeatureEnabled } from '@/lib/config/features';

export function FloatingCallStatus() {
  const { isInCall, currentCallSid } = useGlobalTwilio();
  const { currentCall, callMode, endCall, switchToPage, switchToPopup } = useGlobalCall();
  const isEnabled = isFeatureEnabled('FLOATING_STATUS');
  
  // Local state for floating component
  const [callDuration, setCallDuration] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: 20 });

  // Auto-increment call duration timer
  useEffect(() => {
    if (!isInCall) {
      setCallDuration(0);
      return;
    }

    const startTime = Date.now();
    const interval = setInterval(() => {
      setCallDuration(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [isInCall]);

  // Don't render if feature is disabled or no active call
  if (!isEnabled || !isInCall || !currentCall) return null;

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatPhoneNumber = (phone: string) => {
    if (phone.startsWith('+44')) {
      return phone.replace('+44', '0');
    }
    return phone;
  };

  const getUserDisplayName = () => {
    const { firstName, lastName } = currentCall.userContext;
    return `${firstName} ${lastName}`;
  };

  const handleMuteToggle = () => {
    // TODO: Implement actual mute functionality with Twilio device
    setIsMuted(!isMuted);
    console.log(isMuted ? '🔊 Unmuted call' : '🔇 Muted call');
  };

  const handleEndCall = async () => {
    await endCall();
  };

  const handleExpandToggle = () => {
    if (callMode === 'popup') {
      switchToPage();
    } else {
      switchToPopup();
    }
  };

  // Dragging functionality for desktop
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    const startX = e.clientX - position.x;
    const startY = e.clientY - position.y;

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX - startX,
        y: e.clientY - startY
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div
      className={`fixed z-40 transition-all duration-200 ${
        isDragging ? 'cursor-grabbing' : 'cursor-grab'
      }`}
      style={{
        left: position.x,
        top: position.y,
        minWidth: isMinimized ? '200px' : '280px'
      }}
      onMouseDown={handleMouseDown}
    >
      <Card className="border border-green-200 bg-white/95 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-200">
        <CardContent className="p-3">
          {isMinimized ? (
            // Minimized view
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-slate-700">
                {formatDuration(callDuration)}
              </span>
              <div className="flex gap-1 ml-auto">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMinimized(false);
                  }}
                  className="h-6 w-6 p-0"
                >
                  <Maximize2 className="w-3 h-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEndCall();
                  }}
                  className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                >
                  <PhoneOff className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ) : (
            // Expanded view
            <div className="space-y-3">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-sm font-semibold text-green-700">
                    ACTIVE CALL
                  </span>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMinimized(true);
                    }}
                    className="h-6 w-6 p-0"
                  >
                    <Minimize2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              {/* Call Info */}
              <div className="space-y-1">
                <div className="text-sm font-medium text-slate-800">
                  {getUserDisplayName()}
                </div>
                <div className="text-xs text-slate-600 font-mono">
                  {formatPhoneNumber(currentCall.userContext.phoneNumber)}
                </div>
                <div className="text-xs text-slate-500">
                  Duration: {formatDuration(callDuration)}
                </div>
              </div>

              {/* Call Controls */}
              <div className="flex gap-2">
                {/* Mute Button */}
                <Button
                  size="sm"
                  variant={isMuted ? "destructive" : "outline"}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMuteToggle();
                  }}
                  className="flex-1 h-8"
                >
                  {isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                </Button>

                {/* Expand/Popup Toggle */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExpandToggle();
                  }}
                  className="h-8 px-3"
                >
                  {callMode === 'popup' ? 'Page' : 'Popup'}
                </Button>

                {/* End Call Button */}
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEndCall();
                  }}
                  className="h-8 px-3"
                >
                  <PhoneOff className="w-3 h-3" />
                </Button>
              </div>

              {/* Call Session Info */}
              {currentCallSid && (
                <div className="text-xs text-slate-400 border-t pt-2">
                  Session: {currentCallSid.slice(0, 8)}...
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 