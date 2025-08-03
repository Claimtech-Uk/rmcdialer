'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/trpc/client';
import { useToast } from '@/modules/core/hooks/use-toast';
import { useAgentSessionManager } from '@/hooks/useAgentSessionManager';

type AgentStatus = 'available' | 'break' | 'offline' | 'on_call';

interface StatusOption {
  value: AgentStatus;
  label: string;
  color: string;
  icon: string;
  description: string;
  disabled?: boolean;
}

const statusOptions: StatusOption[] = [
  { 
    value: 'available', 
    label: 'Available', 
    color: 'bg-green-500', 
    icon: '🟢', 
    description: 'Ready for calls' 
  },
  { 
    value: 'break', 
    label: 'On Break', 
    color: 'bg-yellow-500', 
    icon: '🟡', 
    description: 'Taking a break' 
  },
  { 
    value: 'offline', 
    label: 'Offline', 
    color: 'bg-red-500', 
    icon: '🔴', 
    description: 'End of shift' 
  }
];

export function AgentStatusControl() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Get current agent session status
  const { data: agentData, isLoading } = api.auth.me.useQuery();
  
  // Initialize session manager for browser event handling
  const sessionManager = useAgentSessionManager({
    agentId: agentData?.agent?.id || 0,
    enabled: !!agentData?.agent?.id
  });
  
  // Update agent status mutation
  const updateStatusMutation = api.auth.updateStatus.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [['auth', 'me']] });
      toast({
        title: "Status Updated",
        description: "Your availability status has been updated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  const currentStatus = agentData?.session?.currentStatus || 'offline';
  const isOnCall = currentStatus === 'on_call';
  
  const handleStatusChange = (newStatus: AgentStatus) => {
    if (isOnCall && newStatus !== 'on_call') {
      toast({
        title: "Cannot Change Status",
        description: "End your current call before changing status.",
        variant: "destructive"
      });
      return;
    }
    
    updateStatusMutation.mutate({ status: newStatus });
  };
  
  const getCurrentStatusOption = () => {
    if (isOnCall) {
      return { 
        value: 'on_call', 
        label: 'On Call', 
        color: 'bg-blue-500', 
        icon: '📞', 
        description: 'Currently in a call',
        disabled: true
      };
    }
    return statusOptions.find(option => option.value === currentStatus) || statusOptions[2];
  };
  
  const currentOption = getCurrentStatusOption();
  
  if (isLoading) {
    return (
      <div className="p-4 border-t border-gray-200">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
          <div className="h-8 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-4 border-t border-gray-200 bg-gray-50">
      <div className="mb-3">
        <h3 className="text-sm font-medium text-gray-700 mb-1">Your Status</h3>
        <div className="flex items-center space-x-2 p-2 rounded-lg bg-white border">
          <span className="text-lg">{currentOption.icon}</span>
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-900">{currentOption.label}</div>
            <div className="text-xs text-gray-500">{currentOption.description}</div>
          </div>
          <div className={`w-3 h-3 rounded-full ${currentOption.color}`}></div>
        </div>
      </div>
      
      {!isOnCall && (
        <div className="space-y-1">
          <div className="text-xs text-gray-600 mb-2">Change Status:</div>
          {statusOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => handleStatusChange(option.value)}
              disabled={updateStatusMutation.isPending}
              className={`w-full flex items-center space-x-2 p-2 rounded-md text-left transition-colors ${
                currentStatus === option.value
                  ? 'bg-blue-50 border border-blue-200 text-blue-900'
                  : 'hover:bg-gray-100 text-gray-700'
              } ${updateStatusMutation.isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span className="text-sm">{option.icon}</span>
              <span className="text-sm font-medium">{option.label}</span>
            </button>
          ))}
        </div>
      )}
      
      {isOnCall && (
        <div className="mt-2 p-2 bg-blue-50 rounded-md">
          <div className="text-xs text-blue-700">
            You cannot change status during a call
          </div>
        </div>
      )}
    </div>
  );
}