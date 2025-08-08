'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Bell, Calendar, Clock, User, Phone, CheckCircle, AlertTriangle, ChevronDown, UserCheck } from 'lucide-react';
import { Button } from '@/modules/core/components/ui/button';
import { Badge } from '@/modules/core/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/modules/core/components/ui/card';
import { api } from '@/lib/trpc/client';
import { useRouter } from 'next/navigation';
import { formatTimeUntil } from '@/lib/utils/time.utils';

interface CallbackItem {
  id: string;
  userId: number;
  scheduledFor: Date;
  callbackReason?: string;
  userName: string;
  userPhone: string;
  status: 'upcoming' | 'due_soon' | 'overdue';
  timeFormatted: string;
  isOverdue: boolean;
  isPreferred: boolean;
  bookingAgent?: {
    id: number;
    firstName: string;
    lastName: string;
  };
}

export function CallbackIcon() {
  // Get current agent data using tRPC (same pattern as profile page and CallInterface)
  const { data: session } = api.auth.me.useQuery(undefined, {
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    refetchOnWindowFocus: false,
  });
  
  const agent = session?.agent;
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Get callbacks using authenticated tRPC query instead of raw fetch
  const { data: callbacksData, refetch } = api.calls.getCallbacks.useQuery(
    {
      status: 'pending',
      limit: 50, // Get more callbacks to show in dashboard
    },
    {
      enabled: !!agent?.id,
      refetchInterval: 30000, // Poll every 30 seconds
      staleTime: 30000, // Consider data stale after 30 seconds
    }
  );

  // Process callbacks to add status categorization and time formatting
  const allCallbacks: CallbackItem[] = callbacksData?.callbacks ? callbacksData.callbacks.map((cb: any) => {
    const scheduledTime = new Date(cb.scheduledFor);
    const timeInfo = formatTimeUntil(scheduledTime);
    
    return {
      id: cb.id,
      userId: Number(cb.userId),
      scheduledFor: scheduledTime,
      callbackReason: cb.callbackReason,
      userName: `${cb.user.firstName || 'Unknown'} ${cb.user.lastName || 'User'}`.trim(),
      userPhone: cb.user.phoneNumber || 'Unknown',
      status: timeInfo.status,
      timeFormatted: timeInfo.formatted,
      isOverdue: timeInfo.isOverdue,
      isPreferred: cb.preferredAgentId === agent?.id,
      bookingAgent: cb.bookingAgent ? {
        id: cb.bookingAgent.id,
        firstName: cb.bookingAgent.firstName,
        lastName: cb.bookingAgent.lastName
      } : undefined
    };
  }) : [];

  // Show all callbacks for agent role too; server already filters appropriately
  const callbacks = allCallbacks;

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

  // Handle callback acceptance
  const handleAcceptCallback = async (callback: CallbackItem) => {
    try {
      const response = await fetch('/api/callbacks/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callbackId: callback.id, agentId: agent?.id })
      });

      if (response.ok) {
        // Refresh the callbacks
        refetch();
      }
    } catch (error) {
      console.error('Error accepting callback:', error);
    }
  };

  // Handle call initiation
  const handleCallNow = (callback: CallbackItem) => {
    // Close dropdown
    setIsOpen(false);
    
    // Navigate to call page with user context
    router.push(`/calls/new?userId=${callback.userId}&phone=${encodeURIComponent(callback.userPhone)}&name=${encodeURIComponent(callback.userName)}&callbackId=${callback.id}`);
  };

  // Calculate summary counts
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
      {/* Always visible callback icon - made less transparent */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        variant="outline"
        size="sm"
        className={`relative ${getIconStyle()} hover:opacity-90 bg-white border-2`}
      >
        <Calendar className="w-4 h-4" />
        {agent?.id && totalCount > 0 && (
          <Badge 
            variant={overdueCount > 0 ? "destructive" : dueSoonCount > 0 ? "default" : "secondary"}
            className="absolute -top-2 -right-2 min-w-[20px] h-5 flex items-center justify-center text-xs font-semibold"
          >
            {totalCount}
          </Badge>
        )}
        <ChevronDown className="w-3 h-3 ml-1" />
      </Button>

      {/* Dropdown menu - made more opaque */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 max-h-96 overflow-y-auto z-[200]">
          <Card className="border-2 shadow-xl bg-white">
            <CardHeader className="pb-2 bg-gradient-to-r from-slate-50 to-white">
              <CardTitle className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <span className="font-semibold">
                    {agent?.role === 'admin' ? 'All Callbacks' : 'Your Callbacks'}
                  </span>
                </div>
                <div className="flex gap-1">
                  {overdueCount > 0 && (
                    <Badge variant="destructive" className="text-xs font-semibold">
                      {overdueCount} overdue
                    </Badge>
                  )}
                  {dueSoonCount > 0 && (
                    <Badge variant="default" className="bg-yellow-600 text-xs font-semibold">
                      {dueSoonCount} due soon
                    </Badge>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            
            <CardContent className="space-y-3 p-4">
              {!agent?.id ? (
                <div className="text-center py-6 text-gray-600">
                  <User className="w-10 h-10 mx-auto mb-3 text-gray-400" />
                  <p className="text-sm font-medium">Please log in to view callbacks</p>
                </div>
              ) : callbacks.length === 0 ? (
                <div className="text-center py-6 text-gray-600">
                  <Calendar className="w-10 h-10 mx-auto mb-3 text-gray-400" />
                  <p className="text-sm font-medium">No callbacks scheduled</p>
                </div>
              ) : (
                callbacks.map((callback) => (
                  <CallbackDropdownCard
                    key={callback.id}
                    callback={callback}
                    onAccept={handleAcceptCallback}
                    onCallNow={handleCallNow}
                    isLoading={false}
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
  onCallNow: (callback: CallbackItem) => void;
  isLoading: boolean;
}

function CallbackDropdownCard({ callback, onAccept, onCallNow, isLoading }: CallbackDropdownCardProps) {
  const getStatusBadge = () => {
    switch (callback.status) {
      case 'overdue':
        return <Badge variant="destructive" className="text-xs font-semibold">{callback.timeFormatted} overdue</Badge>;
      case 'due_soon':
        return <Badge variant="default" className="bg-yellow-600 text-xs font-semibold">Due in {callback.timeFormatted}</Badge>;
      case 'upcoming':
        return <Badge variant="outline" className="text-xs font-semibold">In {callback.timeFormatted}</Badge>;
    }
  };

  const shouldShowAcceptButton = callback.status === 'overdue' || callback.status === 'due_soon';

  return (
    <Card className={`border-2 ${callback.status === 'overdue' ? 'border-red-300 bg-red-50' : callback.status === 'due_soon' ? 'border-yellow-300 bg-yellow-50' : 'border-gray-300 bg-white'} hover:shadow-md transition-shadow`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {callback.status === 'overdue' && <AlertTriangle className="w-4 h-4 text-red-500" />}
            <span className="font-semibold text-sm">{callback.userName}</span>
          </div>
          {getStatusBadge()}
        </div>

        <div className="space-y-2 text-xs text-gray-700">
          <div className="flex items-center gap-2">
            <Phone className="w-3 h-3 text-blue-600" />
            <span className="font-medium">{callback.userPhone}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-3 h-3 text-gray-500" />
            <span>
              {callback.status === 'overdue' ? 'Was scheduled for' : 'Scheduled for'}{' '}
              {new Date(callback.scheduledFor).toLocaleTimeString()}
            </span>
          </div>
          {callback.bookingAgent && (
            <div className="flex items-center gap-2">
              <UserCheck className="w-3 h-3 text-green-600" />
              <span>
                Booked by <span className="font-medium">{callback.bookingAgent.firstName} {callback.bookingAgent.lastName}</span>
              </span>
            </div>
          )}
        </div>

        {callback.callbackReason && (
          <div className="bg-white rounded-md p-3 border border-gray-200">
            <p className="text-xs text-gray-700">
              <span className="font-semibold text-gray-900">Reason:</span> {callback.callbackReason}
            </p>
          </div>
        )}

        {/* Always show Call Now button, plus Accept button for urgent callbacks */}
        <div className="flex gap-2">
          <Button
            onClick={() => onCallNow(callback)}
            disabled={isLoading}
            size="sm"
            className="flex-1 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold"
          >
            <Phone className="w-3 h-3 mr-1" />
            Call Now
          </Button>
          
          {shouldShowAcceptButton && (
            <Button
              onClick={() => onAccept(callback)}
              disabled={isLoading}
              size="sm"
              variant="outline"
              className="text-xs border-green-600 text-green-600 hover:bg-green-50 font-semibold"
            >
              <CheckCircle className="w-3 h-3 mr-1" />
              Accept
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
} 