// Voice Agent Hook
// React hook for managing AI voice agent state and operations

'use client';

import { useState, useEffect, useCallback } from 'react';
import { VoiceAgentConfig, VoiceConversation, VoiceAgentAnalytics } from '../types/ai-voice.types';

interface UseVoiceAgentReturn {
  // State
  agentConfig: VoiceAgentConfig | null;
  isEnabled: boolean;
  activeConversations: VoiceConversation[];
  analytics: VoiceAgentAnalytics | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  toggleAgent: (enabled: boolean) => Promise<void>;
  updateConfig: (config: VoiceAgentConfig) => Promise<void>;
  refreshData: () => Promise<void>;
  testAgent: () => Promise<void>;
  endConversation: (conversationId: string) => Promise<void>;
}

export function useVoiceAgent(agentId?: string): UseVoiceAgentReturn {
  const [agentConfig, setAgentConfig] = useState<VoiceAgentConfig | null>(null);
  const [isEnabled, setIsEnabled] = useState(false);
  const [activeConversations, setActiveConversations] = useState<VoiceConversation[]>([]);
  const [analytics, setAnalytics] = useState<VoiceAgentAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch agent configuration
  const fetchAgentConfig = useCallback(async () => {
    if (!agentId) return;
    
    try {
      const response = await fetch(`/api/voice-agent/config/${agentId}`);
      if (!response.ok) throw new Error('Failed to fetch agent config');
      
      const config = await response.json();
      setAgentConfig(config);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, [agentId]);

  // Fetch agent status
  const fetchAgentStatus = useCallback(async () => {
    if (!agentId) return;
    
    try {
      const response = await fetch(`/api/voice-agent/status/${agentId}`);
      if (!response.ok) throw new Error('Failed to fetch agent status');
      
      const { enabled } = await response.json();
      setIsEnabled(enabled);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, [agentId]);

  // Fetch active conversations
  const fetchActiveConversations = useCallback(async () => {
    try {
      const response = await fetch('/api/voice-agent/conversations?status=active');
      if (!response.ok) throw new Error('Failed to fetch conversations');
      
      const { conversations } = await response.json();
      setActiveConversations(conversations || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, []);

  // Fetch analytics
  const fetchAnalytics = useCallback(async () => {
    if (!agentId) return;
    
    try {
      const response = await fetch(`/api/voice-agent/analytics/${agentId}`);
      if (!response.ok) throw new Error('Failed to fetch analytics');
      
      const analyticsData = await response.json();
      setAnalytics(analyticsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, [agentId]);

  // Refresh all data
  const refreshData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      await Promise.all([
        fetchAgentConfig(),
        fetchAgentStatus(), 
        fetchActiveConversations(),
        fetchAnalytics()
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [fetchAgentConfig, fetchAgentStatus, fetchActiveConversations, fetchAnalytics]);

  // Toggle agent on/off
  const toggleAgent = useCallback(async (enabled: boolean) => {
    if (!agentId) return;
    
    try {
      const response = await fetch('/api/voice-agent/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, enabled })
      });
      
      if (!response.ok) throw new Error('Failed to toggle agent');
      
      setIsEnabled(enabled);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    }
  }, [agentId]);

  // Update agent configuration
  const updateConfig = useCallback(async (config: VoiceAgentConfig) => {
    try {
      const response = await fetch(`/api/voice-agent/config/${config.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      
      if (!response.ok) throw new Error('Failed to update config');
      
      const updatedConfig = await response.json();
      setAgentConfig(updatedConfig);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    }
  }, []);

  // Test agent functionality
  const testAgent = useCallback(async () => {
    if (!agentId) return;
    
    try {
      const response = await fetch(`/api/voice-agent/test/${agentId}`, {
        method: 'POST'
      });
      
      if (!response.ok) throw new Error('Failed to test agent');
      
      // Could return test results or just indicate success
      const result = await response.json();
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    }
  }, [agentId]);

  // End a specific conversation
  const endConversation = useCallback(async (conversationId: string) => {
    try {
      const response = await fetch(`/api/voice-agent/conversations/${conversationId}/end`, {
        method: 'POST'
      });
      
      if (!response.ok) throw new Error('Failed to end conversation');
      
      // Remove from active conversations
      setActiveConversations(prev => prev.filter(conv => conv.id !== conversationId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    }
  }, []);

  // Initial data load
  useEffect(() => {
    if (agentId) {
      refreshData();
    }
  }, [agentId, refreshData]);

  // Set up polling for active conversations and analytics
  useEffect(() => {
    if (!agentId || !isEnabled) return;

    const interval = setInterval(() => {
      fetchActiveConversations();
      fetchAnalytics();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [agentId, isEnabled, fetchActiveConversations, fetchAnalytics]);

  return {
    // State
    agentConfig,
    isEnabled,
    activeConversations,
    analytics,
    isLoading,
    error,

    // Actions
    toggleAgent,
    updateConfig,
    refreshData,
    testAgent,
    endConversation
  };
}

// Additional hook for managing multiple voice agents
export function useVoiceAgents() {
  const [agents, setAgents] = useState<VoiceAgentConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/voice-agent/agents');
      if (!response.ok) throw new Error('Failed to fetch agents');
      const data = await response.json();
      setAgents(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch agents');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createAgent = useCallback(async (config: Omit<VoiceAgentConfig, 'id'>) => {
    try {
      const response = await fetch('/api/voice-agent/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      
      if (!response.ok) throw new Error('Failed to create agent');
      
      const newAgent = await response.json();
      setAgents(prev => [...prev, newAgent]);
      return newAgent;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create agent');
      throw err;
    }
  }, []);

  const deleteAgent = useCallback(async (agentId: string) => {
    try {
      const response = await fetch(`/api/voice-agent/agents/${agentId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) throw new Error('Failed to delete agent');
      
      setAgents(prev => prev.filter(agent => agent.id !== agentId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete agent');
      throw err;
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  return {
    agents,
    isLoading,
    error,
    createAgent,
    deleteAgent,
    refreshAgents: fetchAgents
  };
} 