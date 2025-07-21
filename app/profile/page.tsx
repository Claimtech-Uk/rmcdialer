'use client';
export const dynamic = 'force-dynamic'

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
  Target,
  UserX,
  CircleSlash
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
    { value: 'available', label: 'Available', icon: CheckCircle, color: 'text-emerald-600', gradient: 'bg-gradient-to-r from-emerald-500 to-teal-600' },
    { value: 'break', label: 'On Break', icon: Clock, color: 'text-yellow-600', gradient: 'bg-gradient-to-r from-yellow-500 to-orange-600' },
    { value: 'busy', label: 'Busy', icon: UserX, color: 'text-red-600', gradient: 'bg-gradient-to-r from-red-500 to-pink-600' },
    { value: 'offline', label: 'Offline', icon: CircleSlash, color: 'text-slate-600', gradient: 'bg-gradient-to-r from-slate-500 to-slate-600' },
  ];

  return (
    <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
      <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-lg">
        <CardTitle className="flex items-center gap-2 text-slate-800">
          <Activity className="w-6 h-6 text-blue-600" /> Agent Status
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-3">
          {statusOptions.map((option) => {
            const Icon = option.icon;
            const isSelected = currentStatus === option.value;
            
            return (
              <Button
                key={option.value}
                variant={isSelected ? "default" : "outline"}
                size="default"
                responsive="nowrap"
                className={`w-full justify-start h-12 transition-all duration-200 ${
                  isSelected 
                    ? `${option.gradient} text-white shadow-lg hover:shadow-xl border-0` 
                    : 'border-2 border-slate-300 text-slate-700 hover:bg-slate-100 hover:border-slate-400'
                }`}
                onClick={() => !isUpdating && onStatusChange(option.value)}
                disabled={isUpdating}
              >
                <Icon className={`w-5 h-5 mr-3 flex-shrink-0 ${isSelected ? 'text-white' : option.color}`} />
                <span className="flex-1 text-left">{option.label}</span>
                {isSelected && <Badge className="ml-auto bg-white/20 text-white border-white/30">Current</Badge>}
              </Button>
            );
          })}
        </div>
        {isUpdating && (
          <div className="mt-4 text-sm text-slate-500 text-center bg-slate-50 p-3 rounded-lg">
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
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
      <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-500 to-cyan-600 text-white">
        <CardContent className="p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-white/20 backdrop-blur-sm">
              <Phone className="h-8 w-8 text-white" />
            </div>
            <div className="ml-4">
              <div className="text-3xl font-bold text-white">{performance.callsToday}</div>
              <div className="text-sm text-blue-100">Calls Today</div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="border-0 shadow-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
        <CardContent className="p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-white/20 backdrop-blur-sm">
              <Target className="h-8 w-8 text-white" />
            </div>
            <div className="ml-4">
              <div className="text-3xl font-bold text-white">{performance.contactsToday}</div>
              <div className="text-sm text-emerald-100">Contacts</div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-500 to-pink-600 text-white">
        <CardContent className="p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-white/20 backdrop-blur-sm">
              <Clock className="h-8 w-8 text-white" />
            </div>
            <div className="ml-4">
              <div className="text-3xl font-bold text-white">{formatTime(performance.avgTalkTime)}</div>
              <div className="text-sm text-purple-100">Avg Talk Time</div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="border-0 shadow-lg bg-gradient-to-br from-orange-500 to-red-600 text-white">
        <CardContent className="p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-white/20 backdrop-blur-sm">
              <TrendingUp className="h-8 w-8 text-white" />
            </div>
            <div className="ml-4">
              <div className="text-3xl font-bold text-white">{performance.contactRate.toFixed(1)}%</div>
              <div className="text-sm text-orange-100">Success Rate</div>
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
            <p className="text-slate-600 text-lg">Loading profile...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-3">
              <User className="w-8 h-8 text-blue-600" />
              Agent Profile
            </h1>
            <p className="text-slate-600 mt-2 text-lg">
              Manage your profile and view performance metrics
            </p>
          </div>
          <Button
            onClick={() => setIsEditing(!isEditing)}
            variant="outline"
            size="default"
            responsive="nowrap"
            className="border-2 border-slate-300 hover:bg-slate-100 hover:border-slate-400 shadow-md hover:shadow-lg transition-all duration-200"
          >
            <Edit className="w-4 h-4 mr-2" />
            {isEditing ? 'Cancel' : 'Edit Profile'}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Profile Info & Status */}
          <div className="space-y-6">
            {/* Profile Information */}
            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-lg">
                <CardTitle className="flex items-center gap-2 text-slate-800">
                  <User className="w-6 h-6 text-blue-600" />
                  Profile Information
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="flex items-center space-x-4">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                    <User className="w-10 h-10 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900">
                      {agent.firstName} {agent.lastName}
                    </h3>
                    <p className="text-slate-600 text-lg">{agent.role}</p>
                    <div className="flex items-center mt-2">
                      <Badge className={`${agent.isActive 
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-200' 
                        : 'bg-red-100 text-red-800 border-red-200'
                      } border`}>
                        {agent.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <Mail className="w-5 h-5 text-slate-500" />
                    <span className="text-slate-700">{agent.email}</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <Calendar className="w-5 h-5 text-slate-500" />
                    <span className="text-slate-700">
                      Joined {new Date(agent.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {isEditing && (
                  <div className="space-y-4 pt-4 border-t border-slate-200">
                    <div>
                      <label className="block text-sm font-medium mb-2 text-slate-700">First Name</label>
                      <input
                        type="text"
                        defaultValue={agent.firstName}
                        className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2 text-slate-700">Last Name</label>
                      <input
                        type="text"
                        defaultValue={agent.lastName}
                        className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      />
                    </div>
                    <Button 
                      size="default"
                      responsive="nowrap"
                      className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all duration-200"
                    >
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
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-slate-800">
                <TrendingUp className="w-6 h-6 text-emerald-600" />
                Today's Performance
              </h3>
              <PerformanceStats performance={performance} />
            </div>

            {/* Session Information */}
            {agentStatus && (
              <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
                <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-lg">
                  <CardTitle className="flex items-center gap-2 text-slate-800">
                    <Activity className="w-6 h-6 text-purple-600" />
                    Current Session
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="p-4 rounded-lg bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200">
                      <p className="text-sm text-blue-600 font-medium">Login Time</p>
                      <p className="font-bold text-xl text-blue-800">
                        {new Date(agentStatus.loginTime).toLocaleTimeString()}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200">
                      <p className="text-sm text-emerald-600 font-medium">Calls Completed</p>
                      <p className="font-bold text-xl text-emerald-800">{agentStatus.totalCallsToday}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200">
                      <p className="text-sm text-purple-600 font-medium">Talk Time Today</p>
                      <p className="font-bold text-xl text-purple-800">
                        {Math.floor(agentStatus.totalTalkTimeSeconds / 60)}m
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200">
                      <p className="text-sm text-orange-600 font-medium">Current Status</p>
                      <Badge className={`mt-1 ${
                        agentStatus.currentStatus === 'available' 
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-200' 
                          : 'bg-slate-100 text-slate-800 border-slate-200'
                      } border text-sm px-3 py-1`}>
                        {agentStatus.currentStatus.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Settings */}
            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-lg">
                <CardTitle className="flex items-center gap-2 text-slate-800">
                  <Settings className="w-6 h-6 text-slate-600" />
                  Preferences
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200">
                    <div>
                      <p className="font-medium text-slate-800">Call Notifications</p>
                      <p className="text-sm text-slate-600">
                        Get notified when new calls are assigned
                      </p>
                    </div>
                    <Button variant="outline" size="sm" className="border-slate-300 hover:bg-slate-100">
                      <Settings className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200">
                    <div>
                      <p className="font-medium text-slate-800">Email Notifications</p>
                      <p className="text-sm text-slate-600">
                        Receive daily performance summaries
                      </p>
                    </div>
                    <Button variant="outline" size="sm" className="border-slate-300 hover:bg-slate-100">
                      <Settings className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200">
                    <div>
                      <p className="font-medium text-slate-800">Auto Break Duration</p>
                      <p className="text-sm text-slate-600">
                        Automatic break after continuous calls
                      </p>
                    </div>
                    <Select defaultValue="30">
                      <SelectTrigger className="w-32 border-slate-300">
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
    </div>
  );
} 