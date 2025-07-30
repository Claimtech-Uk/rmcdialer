'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Bell, Calendar, Clock, User, Phone, CheckCircle, AlertTriangle, ChevronDown } from 'lucide-react';
import { Button } from '@/modules/core/components/ui/button';
import { Badge } from '@/modules/core/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/modules/core/components/ui/card';
import { api } from '@/lib/trpc/client';

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

export function CallbackIcon() {
  const { agent } = useAuth();
  const [callbacks, setCallbacks] = useState<CallbackItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

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
        setIsOpen(false);
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

  const overdueCount = callbacks.filter(cb => cb.status === 'overdue').length;
  const dueSoonCount = callbacks.filter(cb => cb.status === 'due_soon').length;
  const totalCount = callbacks.length;

  // Determine icon color based on urgency
  const getIconStyle = () => {
    if (overdueCount > 0) return 'text-red-600 bg-red-100 border-red-300';
    if (dueSoonCount > 0) return 'text-yellow-600 bg-yellow-100 border-yellow-300';
    if (totalCount > 0) return 'text-blue-600 bg-blue-100 border-blue-300';
    return 'text-gray-400 bg-gray-100 border-gray-300';
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Always visible callback icon */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        variant="outline"
        size="sm"
        className={`relative ${getIconStyle()} hover:opacity-80`}
      >
        <Calendar className="w-4 h-4" />
        {agent?.id && totalCount > 0 && (
          <Badge 
            variant={overdueCount > 0 ? "destructive" : dueSoonCount > 0 ? "default" : "secondary"}
            className="absolute -top-2 -right-2 min-w-[20px] h-5 flex items-center justify-center text-xs"
          >
            {totalCount}
          </Badge>
        )}
        <ChevronDown className="w-3 h-3 ml-1" />
      </Button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 max-h-96 overflow-y-auto z-[200]">
          <Card className="border shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>Your Callbacks</span>
                </div>
                <div className="flex gap-1">
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
                </div>
              </CardTitle>
            </CardHeader>
            
            <CardContent className="space-y-2">
              {!agent?.id ? (
                <div className="text-center py-4 text-gray-500">
                  <User className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Please log in to view callbacks</p>
                </div>
              ) : callbacks.length === 0 ? (
                <div className="text-center py-4 text-gray-500">
                  <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No callbacks scheduled</p>
                </div>
              ) : (
                callbacks.map((callback) => (
                  <CallbackDropdownCard
                    key={callback.id}
                    callback={callback}
                    onAccept={handleAcceptCallback}
                    isLoading={isLoading}
                  />
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

interface CallbackDropdownCardProps {
  callback: CallbackItem;
  onAccept: (callback: CallbackItem) => void;
  isLoading: boolean;
}

function CallbackDropdownCard({ callback, onAccept, isLoading }: CallbackDropdownCardProps) {
  const getStatusBadge = () => {
    switch (callback.status) {
      case 'overdue':
        return <Badge variant="destructive" className="text-xs">{callback.minutesOverdue}m overdue</Badge>;
      case 'due_soon':
        return <Badge variant="default" className="bg-yellow-600 text-xs">Due in {callback.minutesUntil}m</Badge>;
      case 'upcoming':
        return <Badge variant="outline" className="text-xs">In {callback.minutesUntil}m</Badge>;
    }
  };

  const shouldShowAcceptButton = callback.status === 'overdue' || callback.status === 'due_soon';

  return (
    <Card className={`border ${callback.status === 'overdue' ? 'border-red-200 bg-red-50' : callback.status === 'due_soon' ? 'border-yellow-200 bg-yellow-50' : 'border-gray-200'}`}>
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
          <div className="bg-white rounded p-2 border">
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
            className="w-full text-xs bg-green-600 hover:bg-green-700"
          >
            <CheckCircle className="w-3 h-3 mr-1" />
            Accept & Call Now
          </Button>
        )}
      </CardContent>
    </Card>
  );
} 