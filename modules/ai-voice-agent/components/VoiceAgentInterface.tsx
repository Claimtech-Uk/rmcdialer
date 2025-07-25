// Voice Agent Interface Component
// Main dashboard for managing AI voice agents

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Phone, 
  Bot, 
  Activity, 
  Settings, 
  PlayCircle, 
  PauseCircle,
  TrendingUp,
  Users,
  Clock,
  CheckCircle
} from 'lucide-react';
import { VoiceAgentConfig, VoiceConversation, VoiceAgentAnalytics } from '../types/ai-voice.types';

interface VoiceAgentInterfaceProps {
  agentConfig: VoiceAgentConfig;
  onConfigUpdate: (config: VoiceAgentConfig) => void;
  onToggleAgent: (enabled: boolean) => void;
}

export function VoiceAgentInterface({ 
  agentConfig, 
  onConfigUpdate, 
  onToggleAgent 
}: VoiceAgentInterfaceProps) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [activeConversations, setActiveConversations] = useState<VoiceConversation[]>([]);
  const [analytics, setAnalytics] = useState<VoiceAgentAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchVoiceAgentStatus();
    fetchActiveConversations();
    fetchAnalytics();
  }, []);

  const fetchVoiceAgentStatus = async () => {
    try {
      const response = await fetch(`/api/voice-agent/status/${agentConfig.id}`);
      const data = await response.json();
      setIsEnabled(data.enabled);
    } catch (error) {
      console.error('Failed to fetch voice agent status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchActiveConversations = async () => {
    try {
      const response = await fetch(`/api/voice-agent/conversations?status=active`);
      const data = await response.json();
      setActiveConversations(data.conversations || []);
    } catch (error) {
      console.error('Failed to fetch active conversations:', error);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const response = await fetch(`/api/voice-agent/analytics/${agentConfig.id}`);
      const data = await response.json();
      setAnalytics(data);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    }
  };

  const handleToggleAgent = async (enabled: boolean) => {
    setIsLoading(true);
    try {
      await fetch(`/api/voice-agent/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: agentConfig.id, enabled })
      });
      setIsEnabled(enabled);
      onToggleAgent(enabled);
    } catch (error) {
      console.error('Failed to toggle voice agent:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getProviderBadgeColor = (provider: string) => {
    switch (provider) {
      case 'twilio-ai-assistants': return 'bg-blue-100 text-blue-800';
      case 'conversation-relay': return 'bg-green-100 text-green-800';
      case 'gemini-live': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Bot className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">{agentConfig.name}</h2>
            <p className="text-gray-500">AI Voice Assistant</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <Badge className={getProviderBadgeColor(agentConfig.provider)}>
            {agentConfig.provider}
          </Badge>
          <div className="flex items-center space-x-2">
            <Switch 
              checked={isEnabled}
              onCheckedChange={handleToggleAgent}
              disabled={isLoading}
            />
            <span className="text-sm font-medium">
              {isEnabled ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Activity className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-sm text-gray-500">Active Calls</p>
                <p className="text-2xl font-bold">{activeConversations.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-sm text-gray-500">Today's Calls</p>
                <p className="text-2xl font-bold">{analytics?.todaysCalls || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-sm text-gray-500">Success Rate</p>
                <p className="text-2xl font-bold">{analytics?.successRate || 0}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-purple-500" />
              <div>
                <p className="text-sm text-gray-500">Avg Duration</p>
                <p className="text-2xl font-bold">{analytics?.avgDuration || '0'}m</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="conversations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="conversations">Active Conversations</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        
        <TabsContent value="conversations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Live Conversations</CardTitle>
              <CardDescription>
                Real-time view of active AI voice conversations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activeConversations.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Phone className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No active conversations</p>
                  <p className="text-sm">AI voice agent is ready to handle incoming calls</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeConversations.map((conversation) => (
                    <div key={conversation.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-green-100 rounded-full">
                          <Phone className="h-4 w-4 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium">{conversation.callerInfo?.name || 'Unknown Caller'}</p>
                          <p className="text-sm text-gray-500">
                            {conversation.callerInfo?.phone} • {conversation.currentTurn?.duration || '0:00'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className="text-green-600">
                          {conversation.status}
                        </Badge>
                        <Button size="sm" variant="outline">
                          Monitor
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle>Performance Analytics</CardTitle>
              <CardDescription>
                Voice agent performance metrics and insights
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Analytics dashboard coming soon</p>
                <p className="text-sm">Track conversation quality, resolution rates, and more</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Agent Configuration</CardTitle>
              <CardDescription>
                Customize your AI voice agent behavior and capabilities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Settings panel coming soon</p>
                <p className="text-sm">Configure personality, capabilities, and workflows</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 