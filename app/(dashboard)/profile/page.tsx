'use client';

import { useState } from 'react';
import { api } from '@/lib/trpc/client';
import { 
  User,
  Phone,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  Edit,
  Mail,
  Calendar,
  Activity,
  Settings,
  TrendingUp,
  Target
} from 'lucide-react';
import { Button } from '@/modules/core/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/modules/core/components/ui/card';
import { Badge } from '@/modules/core/components/ui/badge';
import { useToast } from '@/modules/core/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/modules/core/components/ui/select';

// Types for profile data
interface StatusControlsProps {
  currentStatus: string;
  onStatusChange: (status: string) => void;
  isUpdating: boolean;
}

function StatusControls({ currentStatus, onStatusChange, isUpdating }: StatusControlsProps) {
  const statusOptions = [
    { value: 'available', label: 'Available', icon: CheckCircle, color: 'text-green-600' },
    { value: 'break', label: 'On Break', icon: Clock, color: 'text-yellow-600' },
    { value: 'offline', label: 'Offline', icon: XCircle, color: 'text-gray-600' }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Agent Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {statusOptions.map((option) => {
            const Icon = option.icon;
            const isSelected = currentStatus === option.value;
            
            return (
              <Button
                key={option.value}
                variant={isSelected ? "default" : "outline"}
                className={`w-full justify-start ${isSelected ? '' : 'hover:bg-muted'}`}
                onClick={() => !isUpdating && onStatusChange(option.value)}
                disabled={isUpdating}
              >
                <Icon className={`w-4 h-4 mr-2 ${option.color}`} />
                {option.label}
                {isSelected && <Badge variant="secondary" className="ml-auto">Current</Badge>}
              </Button>
            );
          })}
        </div>
        {isUpdating && (
          <div className="mt-4 text-sm text-muted-foreground text-center">
            Updating status...
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface PerformanceStatsProps {
  performance: {
    callsToday: number;
    contactsToday: number;
    avgTalkTime: number;
    contactRate: number;
  };
}

function PerformanceStats({ performance }: PerformanceStatsProps) {
  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center">
            <Phone className="h-8 w-8 text-primary mr-3" />
            <div>
              <div className="text-2xl font-bold">{performance.callsToday}</div>
              <div className="text-sm text-muted-foreground">Calls Today</div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center">
            <Target className="h-8 w-8 text-green-500 mr-3" />
            <div>
              <div className="text-2xl font-bold">{performance.contactsToday}</div>
              <div className="text-sm text-muted-foreground">Contacts</div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center">
            <Clock className="h-8 w-8 text-purple-500 mr-3" />
            <div>
              <div className="text-2xl font-bold">{formatTime(performance.avgTalkTime)}</div>
              <div className="text-sm text-muted-foreground">Avg Talk Time</div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center">
            <TrendingUp className="h-8 w-8 text-orange-500 mr-3" />
            <div>
              <div className="text-2xl font-bold">{performance.contactRate.toFixed(1)}%</div>
              <div className="text-sm text-muted-foreground">Success Rate</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ProfilePage() {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);

  // Get current agent session and profile
  const { data: session, refetch: refetchSession } = api.auth.me.useQuery();

  // Get agent status
  const { data: agentStatus } = api.auth.getStatus.useQuery(undefined, {
    refetchInterval: 10000 // Refresh every 10 seconds
  });

  // Get today's performance summary
  const { data: todaysSummary } = api.calls.getTodaysSummary.useQuery(undefined, {
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Update status mutation
  const updateStatusMutation = api.auth.updateStatus.useMutation({
    onSuccess: () => {
      toast({
        title: "Status Updated",
        description: "Your status has been updated successfully",
      });
      refetchSession();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleStatusChange = (status: string) => {
    updateStatusMutation.mutate({ 
      status: status as 'available' | 'on_call' | 'break' | 'offline'
    });
  };

  const agent = session?.agent;
  const performance = todaysSummary || {
    callsToday: 0,
    contactsToday: 0,
    avgTalkTime: 0,
    contactRate: 0
  };

  if (!agent) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading profile...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <User className="w-6 h-6 text-primary" />
            Agent Profile
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your profile and view performance metrics
          </p>
        </div>
        <Button
          onClick={() => setIsEditing(!isEditing)}
          variant="outline"
        >
          <Edit className="w-4 h-4 mr-2" />
          {isEditing ? 'Cancel' : 'Edit Profile'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Profile Info & Status */}
        <div className="space-y-6">
          {/* Profile Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Profile Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">
                    {agent.firstName} {agent.lastName}
                  </h3>
                  <p className="text-muted-foreground">{agent.role}</p>
                  <div className="flex items-center mt-1">
                    <Badge variant={agent.isActive ? "default" : "destructive"}>
                      {agent.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{agent.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">
                    Joined {new Date(agent.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {isEditing && (
                <div className="space-y-4 pt-4 border-t">
                  <div>
                    <label className="block text-sm font-medium mb-1">First Name</label>
                    <input
                      type="text"
                      defaultValue={agent.firstName}
                      className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Last Name</label>
                    <input
                      type="text"
                      defaultValue={agent.lastName}
                      className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <Button className="w-full">
                    Save Changes
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Status Controls */}
          <StatusControls
            currentStatus={agentStatus?.currentStatus || 'offline'}
            onStatusChange={handleStatusChange}
            isUpdating={updateStatusMutation.isPending}
          />
        </div>

        {/* Right Column - Performance & Settings */}
        <div className="lg:col-span-2 space-y-6">
          {/* Performance Stats */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Today's Performance
            </h3>
            <PerformanceStats performance={performance} />
          </div>

          {/* Session Information */}
          {agentStatus && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Current Session
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Login Time</p>
                    <p className="font-medium">
                      {new Date(agentStatus.loginTime).toLocaleTimeString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Calls Completed</p>
                    <p className="font-medium">{agentStatus.totalCallsToday}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Talk Time Today</p>
                    <p className="font-medium">
                      {Math.floor(agentStatus.totalTalkTimeSeconds / 60)}m
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Current Status</p>
                    <Badge variant={agentStatus.currentStatus === 'available' ? 'default' : 'secondary'}>
                      {agentStatus.currentStatus.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Preferences
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Call Notifications</p>
                    <p className="text-sm text-muted-foreground">
                      Get notified when new calls are assigned
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    <Settings className="w-4 h-4" />
                  </Button>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Email Notifications</p>
                    <p className="text-sm text-muted-foreground">
                      Receive daily performance summaries
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    <Settings className="w-4 h-4" />
                  </Button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Auto Break Duration</p>
                    <p className="text-sm text-muted-foreground">
                      Automatic break after continuous calls
                    </p>
                  </div>
                  <Select defaultValue="30">
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 min</SelectItem>
                      <SelectItem value="30">30 min</SelectItem>
                      <SelectItem value="60">60 min</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 