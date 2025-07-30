'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/modules/core/components/ui/card';
import { Button } from '@/modules/core/components/ui/button';
import { Badge } from '@/modules/core/components/ui/badge';
import { Clock, User, Phone, AlertTriangle, CheckCircle } from 'lucide-react';
import { useAuth } from '@/modules/auth';

interface OverdueCallback {
  id: string;
  userId: number;
  scheduledFor: Date;
  callbackReason?: string;
  userName: string;
  userPhone: string;
  minutesOverdue: number;
  preferredAgentId?: number;
  preferredAgentName?: string;
}

export function ManualCallbackHandler() {
  const { agent } = useAuth();
  const [overdueCallbacks, setOverdueCallbacks] = useState<OverdueCallback[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Poll for overdue callbacks every 30 seconds
  useEffect(() => {
    if (!agent?.id) return;

    const pollOverdueCallbacks = async () => {
      try {
        const response = await fetch('/api/callbacks/overdue');
        if (response.ok) {
          const data = await response.json();
          setOverdueCallbacks(data.callbacks || []);
        }
      } catch (error) {
        console.error('Error fetching overdue callbacks:', error);
      }
    };

    // Initial fetch
    pollOverdueCallbacks();

    // Poll every 30 seconds
    const interval = setInterval(pollOverdueCallbacks, 30000);

    return () => clearInterval(interval);
  }, [agent?.id]);

  const handleAcceptCallback = async (callback: OverdueCallback) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/callbacks/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callbackId: callback.id,
          agentId: agent?.id
        }),
      });

      if (response.ok) {
        // Remove from overdue list
        setOverdueCallbacks(prev => prev.filter(cb => cb.id !== callback.id));
        
        // Navigate to queue
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

  // Don't render if no overdue callbacks
  if (overdueCallbacks.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 left-4 z-[100] max-w-sm">
      <Card className="border-red-200 bg-red-50">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-red-800">
            <AlertTriangle className="w-5 h-5" />
            Overdue Callbacks ({overdueCallbacks.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-red-700">
            These callbacks are past their scheduled time and need immediate attention.
          </p>
          
          {overdueCallbacks.map((callback) => (
            <OverdueCallbackCard
              key={callback.id}
              callback={callback}
              onAccept={handleAcceptCallback}
              isLoading={isLoading}
              currentAgentId={agent?.id}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

interface OverdueCallbackCardProps {
  callback: OverdueCallback;
  onAccept: (callback: OverdueCallback) => void;
  isLoading: boolean;
  currentAgentId?: number;
}

function OverdueCallbackCard({ 
  callback, 
  onAccept, 
  isLoading,
  currentAgentId 
}: OverdueCallbackCardProps) {
  
  const isPreferredAgent = callback.preferredAgentId === currentAgentId;
  
  return (
    <Card className="border border-orange-200 bg-white">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <Badge variant={isPreferredAgent ? "default" : "secondary"}>
            {isPreferredAgent ? "Your Callback" : "Available"}
          </Badge>
          <Badge variant="destructive">
            {callback.minutesOverdue}m overdue
          </Badge>
        </div>

        {/* User Information */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm">
            <User className="w-4 h-4" />
            <span className="font-medium">{callback.userName}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Phone className="w-4 h-4" />
            <span>{callback.userPhone}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Clock className="w-4 h-4" />
            <span>
              Was scheduled for {new Date(callback.scheduledFor).toLocaleTimeString()}
            </span>
          </div>
        </div>

        {/* Callback Reason */}
        {callback.callbackReason && (
          <div className="bg-gray-50 rounded p-2">
            <p className="text-sm text-gray-700">
              <span className="font-medium">Reason:</span> {callback.callbackReason}
            </p>
          </div>
        )}

        {/* Action Button */}
        <Button
          onClick={() => onAccept(callback)}
          disabled={isLoading}
          className="w-full bg-green-600 hover:bg-green-700 text-white"
        >
          <CheckCircle className="w-4 h-4 mr-2" />
          Accept & Call Now
        </Button>
        
        {/* Preferred Agent Note */}
        {!isPreferredAgent && callback.preferredAgentName && (
          <p className="text-xs text-gray-500 text-center">
            Originally assigned to {callback.preferredAgentName}
          </p>
        )}
      </CardContent>
    </Card>
  );
} 