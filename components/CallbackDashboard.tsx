'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/modules/core/components/ui/card';
import { Button } from '@/modules/core/components/ui/button';
import { Badge } from '@/modules/core/components/ui/badge';
import { Clock, User, Phone, Calendar, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/modules/auth';

interface CallbackItem {
  id: string;
  userId: number;
  scheduledFor: Date;
  callbackReason?: string;
  userName: string;
  userPhone: string;
  status: 'upcoming' | 'due_soon' | 'overdue';
  minutesUntil?: number;
  minutesOverdue?: number;
  isPreferred: boolean;
}

export function CallbackDashboard() {
  const { agent } = useAuth();
  const [callbacks, setCallbacks] = useState<CallbackItem[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Poll for all callbacks every 30 seconds
  useEffect(() => {
    if (!agent?.id) return;

    const fetchAllCallbacks = async () => {
      try {
        // Fetch both upcoming and overdue callbacks
        const [upcomingRes, overdueRes] = await Promise.all([
          fetch(`/api/agents/${agent.id}/pending-callbacks`),
          fetch('/api/callbacks/overdue')
        ]);

        const upcoming = upcomingRes.ok ? (await upcomingRes.json()).callbacks || [] : [];
        const overdue = overdueRes.ok ? (await overdueRes.json()).callbacks || [] : [];

        // Combine and categorize callbacks
        const now = new Date();
        const allCallbacks: CallbackItem[] = [
          // Overdue callbacks
          ...overdue.map((cb: any) => ({
            id: cb.id,
            userId: cb.userId,
            scheduledFor: new Date(cb.scheduledFor),
            callbackReason: cb.callbackReason,
            userName: cb.userName,
            userPhone: cb.userPhone,
            status: 'overdue' as const,
            minutesOverdue: cb.minutesOverdue,
            isPreferred: cb.preferredAgentId === agent.id
          })),
          // Upcoming callbacks (categorize as due soon or upcoming)
          ...upcoming.map((cb: any) => {
            const scheduledTime = new Date(cb.scheduledFor);
            const minutesUntil = Math.floor((scheduledTime.getTime() - now.getTime()) / (1000 * 60));
            
            return {
              id: cb.id,
              userId: cb.userId,
              scheduledFor: scheduledTime,
              callbackReason: cb.callbackReason,
              userName: cb.userName,
              userPhone: cb.userPhone,
              status: minutesUntil <= 10 ? 'due_soon' as const : 'upcoming' as const,
              minutesUntil,
              isPreferred: true // These are assigned to the agent
            };
          })
        ];

        // Sort by urgency: overdue first, then due soon, then upcoming
        allCallbacks.sort((a, b) => {
          if (a.status === 'overdue' && b.status !== 'overdue') return -1;
          if (b.status === 'overdue' && a.status !== 'overdue') return 1;
          if (a.status === 'due_soon' && b.status === 'upcoming') return -1;
          if (b.status === 'due_soon' && a.status === 'upcoming') return 1;
          
          // Within same category, sort by time
          return a.scheduledFor.getTime() - b.scheduledFor.getTime();
        });

        setCallbacks(allCallbacks);
      } catch (error) {
        console.error('Error fetching callbacks:', error);
      }
    };

    // Initial fetch
    fetchAllCallbacks();

    // Poll every 30 seconds
    const interval = setInterval(fetchAllCallbacks, 30000);

    return () => clearInterval(interval);
  }, [agent?.id]);

  const handleAcceptCallback = async (callback: CallbackItem) => {
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
        // Remove from list and navigate to queue
        setCallbacks(prev => prev.filter(cb => cb.id !== callback.id));
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

  // Don't render if no callbacks
  if (callbacks.length === 0) {
    return null;
  }

  const overdueCount = callbacks.filter(cb => cb.status === 'overdue').length;
  const dueSoonCount = callbacks.filter(cb => cb.status === 'due_soon').length;
  const upcomingCount = callbacks.filter(cb => cb.status === 'upcoming').length;

  return (
    <div className="fixed bottom-4 right-4 z-[90] max-w-sm">
      <Card className={`border-2 ${overdueCount > 0 ? 'border-red-300 bg-red-50' : dueSoonCount > 0 ? 'border-yellow-300 bg-yellow-50' : 'border-blue-300 bg-blue-50'}`}>
        <CardHeader 
          className="pb-2 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <CardTitle className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>Your Callbacks ({callbacks.length})</span>
            </div>
            <div className="flex items-center gap-2">
              {overdueCount > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {overdueCount} overdue
                </Badge>
              )}
              {dueSoonCount > 0 && (
                <Badge variant="default" className="bg-yellow-600 text-xs">
                  {dueSoonCount} due soon
                </Badge>
              )}
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </CardTitle>
        </CardHeader>
        
        {isExpanded && (
          <CardContent className="space-y-2 max-h-96 overflow-y-auto">
            {callbacks.map((callback) => (
              <CallbackCard
                key={callback.id}
                callback={callback}
                onAccept={handleAcceptCallback}
                isLoading={isLoading}
              />
            ))}
          </CardContent>
        )}
      </Card>
    </div>
  );
}

interface CallbackCardProps {
  callback: CallbackItem;
  onAccept: (callback: CallbackItem) => void;
  isLoading: boolean;
}

function CallbackCard({ callback, onAccept, isLoading }: CallbackCardProps) {
  const getStatusBadge = () => {
    switch (callback.status) {
      case 'overdue':
        return <Badge variant="destructive">{callback.minutesOverdue}m overdue</Badge>;
      case 'due_soon':
        return <Badge variant="default" className="bg-yellow-600">Due in {callback.minutesUntil}m</Badge>;
      case 'upcoming':
        return <Badge variant="outline">In {callback.minutesUntil}m</Badge>;
    }
  };

  const shouldShowAcceptButton = callback.status === 'overdue' || callback.status === 'due_soon';

  return (
    <Card className={`border ${callback.status === 'overdue' ? 'border-red-200' : callback.status === 'due_soon' ? 'border-yellow-200' : 'border-gray-200'}`}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {callback.status === 'overdue' && <AlertTriangle className="w-3 h-3 text-red-500" />}
            <span className="font-medium text-sm">{callback.userName}</span>
          </div>
          {getStatusBadge()}
        </div>

        <div className="space-y-1 text-xs text-gray-600">
          <div className="flex items-center gap-1">
            <Phone className="w-3 h-3" />
            <span>{callback.userPhone}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>
              {callback.status === 'overdue' ? 'Was scheduled for' : 'Scheduled for'}{' '}
              {new Date(callback.scheduledFor).toLocaleTimeString()}
            </span>
          </div>
        </div>

        {callback.callbackReason && (
          <div className="bg-gray-50 rounded p-2">
            <p className="text-xs text-gray-700">
              <span className="font-medium">Reason:</span> {callback.callbackReason}
            </p>
          </div>
        )}

        {shouldShowAcceptButton && (
          <Button
            onClick={() => onAccept(callback)}
            disabled={isLoading}
            size="sm"
            className="w-full text-xs"
          >
            Accept & Call Now
          </Button>
        )}
      </CardContent>
    </Card>
  );
} 