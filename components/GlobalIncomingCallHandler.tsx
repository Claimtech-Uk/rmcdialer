'use client';

import { useGlobalTwilio } from '@/lib/providers/GlobalTwilioProvider';
import { Button } from '@/modules/core/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/modules/core/components/ui/card';
import { Phone, PhoneOff, User, Clock } from 'lucide-react';
import { useState, useEffect } from 'react';
import { isFeatureEnabled } from '@/lib/config/features';

export function GlobalIncomingCallHandler() {
  const { incomingCall, acceptIncomingCall, rejectIncomingCall, isEnabled } = useGlobalTwilio();
  const [callDuration, setCallDuration] = useState(0);

  // Auto-increment call duration timer
  useEffect(() => {
    if (!incomingCall) {
      setCallDuration(0);
      return;
    }

    const startTime = Date.now();
    const interval = setInterval(() => {
      setCallDuration(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [incomingCall]);

  // Don't render if feature is disabled or no incoming call
  if (!isEnabled || !incomingCall) return null;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatPhoneNumber = (phone: string) => {
    // Basic phone number formatting
    if (phone.startsWith('+44')) {
      return phone.replace('+44', '0');
    }
    return phone;
  };

  const getCallerName = () => {
    // Try to extract name from caller info, fallback to "Unknown Caller"
    const phone = formatPhoneNumber(incomingCall.from);
    return `Incoming Call from ${phone}`;
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
      
      {/* Call Overlay */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Animated Call Card */}
        <div className="relative">
          {/* Pulsing Ring Effect */}
          <div className="absolute inset-0 rounded-full bg-green-400/20 animate-ping scale-110" />
          <div className="absolute inset-0 rounded-full bg-green-400/10 animate-ping scale-125 animation-delay-75" />
          
          {/* Main Call Card */}
          <Card className="relative w-full max-w-md mx-auto border-0 shadow-2xl bg-gradient-to-br from-white to-slate-50 overflow-hidden">
            {/* Header with pulsing call icon */}
            <CardHeader className="text-center bg-gradient-to-r from-green-500 to-emerald-600 text-white relative overflow-hidden">
              {/* Background Pattern */}
              <div className="absolute inset-0 bg-white/5 bg-opacity-10" />
              
              <CardTitle className="relative flex items-center justify-center gap-3 text-xl font-semibold">
                <div className="relative">
                  <Phone className="w-8 h-8 animate-pulse" />
                  {/* Ripple effect around phone icon */}
                  <div className="absolute inset-0 rounded-full bg-white/20 animate-ping scale-150" />
                </div>
                Incoming Call
              </CardTitle>
              
              {/* Call duration */}
              <div className="relative flex items-center justify-center gap-2 mt-2 text-green-100">
                <Clock className="w-4 h-4" />
                <span className="font-mono text-sm">
                  {formatDuration(callDuration)}
                </span>
              </div>
            </CardHeader>

            <CardContent className="p-8 text-center space-y-6">
              {/* Caller Avatar */}
              <div className="relative mx-auto">
                <div className="w-24 h-24 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full flex items-center justify-center shadow-lg">
                  <User className="w-12 h-12 text-slate-400" />
                </div>
                {/* Online indicator */}
                <div className="absolute bottom-1 right-1 w-6 h-6 bg-green-500 rounded-full border-4 border-white animate-pulse" />
              </div>

              {/* Caller Information */}
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-slate-800">
                  {getCallerName()}
                </h3>
                <p className="text-lg text-slate-600 font-mono">
                  {formatPhoneNumber(incomingCall.from)}
                </p>
                <p className="text-sm text-slate-500">
                  Tap to answer or decline the call
                </p>
              </div>

              {/* Call Actions */}
              <div className="flex gap-4 justify-center pt-4">
                {/* Decline Button */}
                <Button
                  onClick={rejectIncomingCall}
                  size="lg"
                  className="flex-1 max-w-32 h-16 bg-red-500 hover:bg-red-600 text-white shadow-lg hover:shadow-xl transition-all duration-200 rounded-full"
                >
                  <PhoneOff className="w-6 h-6" />
                </Button>
                
                {/* Accept Button */}
                <Button
                  onClick={acceptIncomingCall}
                  size="lg"
                  className="flex-1 max-w-32 h-16 bg-green-500 hover:bg-green-600 text-white shadow-lg hover:shadow-xl transition-all duration-200 rounded-full animate-pulse"
                >
                  <Phone className="w-6 h-6" />
                </Button>
              </div>

              {/* Helper Text */}
              <p className="text-xs text-slate-400 mt-4 leading-relaxed">
                This call will be recorded for quality and training purposes
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Keyboard Shortcuts */}
      <div className="fixed bottom-4 left-4 z-50 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg">
        <div className="text-xs text-slate-600 space-y-1">
          <div><kbd className="px-1 bg-slate-100 rounded text-xs">Space</kbd> Accept</div>
          <div><kbd className="px-1 bg-slate-100 rounded text-xs">Esc</kbd> Decline</div>
        </div>
      </div>

      {/* Global Keyboard Shortcuts */}
      <div
        className="fixed inset-0 z-40"
        onKeyDown={(e) => {
          if (e.code === 'Space' || e.code === 'Enter') {
            e.preventDefault();
            acceptIncomingCall();
          } else if (e.code === 'Escape') {
            e.preventDefault();
            rejectIncomingCall();
          }
        }}
        tabIndex={-1}
        style={{ outline: 'none' }}
      />
    </>
  );
} 