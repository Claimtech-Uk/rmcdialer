'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/modules/core/components/ui/card';
import { Button } from '@/modules/core/components/ui/button';
import { Badge } from '@/modules/core/components/ui/badge';
import { Clock, User, Phone, CheckCircle, X } from 'lucide-react';
import { useAuth } from '@/modules/auth';

interface PendingCallback {
  id: string;
  userId: number;
  scheduledFor: Date;
  callbackReason?: string;
  userName: string;
  userPhone: string;
  isAssigned: boolean;
}

export function CallbackNotificationHandler() {
  const { agent } = useAuth();
  const [pendingCallbacks, setPendingCallbacks] = useState<PendingCallback[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Poll for pending callbacks assigned to this agent
  useEffect(() => {
    if (!agent?.id) return;

    const pollCallbacks = async () => {
      try {
        const response = await fetch(`/api/agents/${agent.id}/pending-callbacks`);
        if (response.ok) {
          const data = await response.json();
          setPendingCallbacks(data.callbacks || []);
        }
      } catch (error) {
        console.error('Error fetching pending callbacks:', error);
      }
    };

    // Initial fetch
    pollCallbacks();

    // Poll every 30 seconds for updates
    const interval = setInterval(pollCallbacks, 30000);

    return () => clearInterval(interval);
  }, [agent?.id]);

  const handleAcceptCallback = async (callback: PendingCallback) => {
    setIsLoading(true);
    try {
      // Accept the callback and queue it as the agent's next call
      const response = await fetch('/api/callbacks/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          callbackId: callback.id,
          agentId: agent?.id
        }),
      });

      if (response.ok) {
        // Remove this callback from the list
        setPendingCallbacks(prev => prev.filter(cb => cb.id !== callback.id));
        
        // Optionally refresh the page or navigate to queue to start the call
        window.location.href = '/queue';
      } else {
        console.error('Failed to accept callback');
      }
    } catch (error) {
      console.error('Error accepting callback:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSnoozeCallback = async (callback: PendingCallback, minutes: number = 5) => {
    try {
      const response = await fetch('/api/callbacks/snooze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          callbackId: callback.id,
          snoozeMinutes: minutes
        }),
      });

      if (response.ok) {
        // Remove this callback from the list temporarily
        setPendingCallbacks(prev => prev.filter(cb => cb.id !== callback.id));
      }
    } catch (error) {
      console.error('Error snoozing callback:', error);
    }
  };

  // Don't render if no pending callbacks
  if (pendingCallbacks.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-[100] space-y-3">
      {pendingCallbacks.map((callback) => (
        <CallbackNotificationCard
          key={callback.id}
          callback={callback}
          onAccept={handleAcceptCallback}
          onSnooze={handleSnoozeCallback}
          isLoading={isLoading}
        />
      ))}
    </div>
  );
}

interface CallbackNotificationCardProps {
  callback: PendingCallback;
  onAccept: (callback: PendingCallback) => void;
  onSnooze: (callback: PendingCallback, minutes?: number) => void;
  isLoading: boolean;
}

function CallbackNotificationCard({ 
  callback, 
  onAccept, 
  onSnooze, 
  isLoading 
}: CallbackNotificationCardProps) {
  const [timeUntilCallback, setTimeUntilCallback] = useState<string>('');

  useEffect(() => {
    const updateTimeDisplay = () => {
      const now = new Date();
      const scheduledTime = new Date(callback.scheduledFor);
      const diffMs = scheduledTime.getTime() - now.getTime();
      
      if (diffMs <= 0) {
        setTimeUntilCallback('Due now');
      } else {
        const minutes = Math.floor(diffMs / (1000 * 60));
        const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
        
        if (minutes > 0) {
          setTimeUntilCallback(`${minutes}m ${seconds}s`);
        } else {
          setTimeUntilCallback(`${seconds}s`);
        }
      }
    };

    updateTimeDisplay();
    const interval = setInterval(updateTimeDisplay, 1000);
    
    return () => clearInterval(interval);
  }, [callback.scheduledFor]);

  const isOverdue = new Date(callback.scheduledFor) <= new Date();
  const formattedTime = new Date(callback.scheduledFor).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  return (
    <Card className={`
      w-80 shadow-2xl border-2 transition-all duration-300 animate-in slide-in-from-right-5
      ${isOverdue ? 'border-red-500 bg-red-50' : 'border-blue-500 bg-blue-50'}
      backdrop-blur-sm bg-opacity-95
    `}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`
              w-3 h-3 rounded-full animate-pulse
              ${isOverdue ? 'bg-red-500' : 'bg-blue-500'}
            `} />
            <CardTitle className="text-lg font-semibold text-slate-800">
              Callback Due
            </CardTitle>
          </div>
          <Badge variant={isOverdue ? 'destructive' : 'secondary'} className="text-xs">
            {timeUntilCallback}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* User Information */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-slate-700">
            <User className="w-4 h-4" />
            <span className="font-medium">{callback.userName}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-600">
            <Phone className="w-4 h-4" />
            <span className="text-sm font-mono">{callback.userPhone}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-600">
            <Clock className="w-4 h-4" />
            <span className="text-sm">Scheduled for {formattedTime}</span>
          </div>
        </div>

        {/* Callback Reason */}
        {callback.callbackReason && (
          <div className="bg-white rounded-lg p-3 border">
            <p className="text-sm text-slate-700">
              <span className="font-medium">Reason:</span> {callback.callbackReason}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={() => onAccept(callback)}
            disabled={isLoading}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Accept & Call Now
          </Button>
          <Button
            onClick={() => onSnooze(callback, 5)}
            disabled={isLoading}
            variant="outline"
            className="px-3"
            title="Snooze for 5 minutes"
          >
            <Clock className="w-4 h-4" />
          </Button>
        </div>

        {/* Priority Message */}
        <p className="text-xs text-slate-500 text-center">
          This callback will be your next call once accepted
        </p>
      </CardContent>
    </Card>
  );
} 