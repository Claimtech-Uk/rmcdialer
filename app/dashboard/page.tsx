'use client';

// =============================================================================
// Dashboard Page - Next.js App Router  
// =============================================================================
// Main analytics dashboard for supervisors and admins

// Force dynamic rendering
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { 
  Phone, 
  Users, 
  MessageSquare, 
  TrendingUp, 
  TrendingDown,
  Clock, 
  PhoneCall,
  Link2,
  BarChart3,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Calendar,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  ListChecks
} from 'lucide-react'
import { Card } from '@/modules/core/components/ui/card'
import { Button } from '@/modules/core/components/ui/button'
import { api } from '@/lib/trpc/client'

// Types
interface DashboardMetrics {
  callMetrics: {
    totalCalls: number;
    completedCalls: number;
    averageDuration: number;
    totalTalkTime: number;
    completionRate: number;
  };
  queueMetrics: {
    currentDepth: number;
    averageWaitTime: number;
    assignmentRate: number;
  };
  agentMetrics: {
    totalAgents: number;
    onlineAgents: number;
    busyAgents: number;
    availableAgents: number;
  };
  outcomeBreakdown: Array<{
    outcome: string;
    count: number;
    percentage: number;
  }>;
  hourlyData: Array<{
    hour: number;
    calls: number;
    averageDuration: number;
  }>;
}

interface AgentStatus {
  id: number;
  name: string;
  email: string;
  status: 'available' | 'on_call' | 'break' | 'offline';
  callsToday?: number;
  totalTalkTime?: number;
  currentCallDuration?: number;
  lastActivity: string;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon: React.ReactNode;
  gradient: string;
  description?: string;
}

function MetricCard({ title, value, change, trend, icon, gradient, description }: MetricCardProps) {
  const trendIcon = trend === 'up' ? <ArrowUpRight className="h-4 w-4" /> :
                   trend === 'down' ? <ArrowDownRight className="h-4 w-4" /> : null;

  const trendColor = trend === 'up' ? 'text-emerald-100' :
                    trend === 'down' ? 'text-red-100' : 'text-slate-100';

  return (
    <Card className={`border-0 shadow-lg ${gradient} text-white`}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="p-2 rounded-lg bg-white/20 backdrop-blur-sm">
            {icon}
          </div>
          {trendIcon && (
            <div className={`flex items-center ${trendColor}`}>
              {trendIcon}
            </div>
          )}
        </div>
        
        <div>
          <p className="text-sm font-medium text-white/80 mb-1">{title}</p>
          <p className="text-3xl font-bold text-white mb-2">{value}</p>
          {change && (
            <p className="text-xs text-white/80">{change}</p>
          )}
          {description && (
            <p className="text-xs text-white/60 mt-1">{description}</p>
          )}
        </div>
      </div>
    </Card>
  );
}

interface OutcomeChartProps {
  data: Array<{
    outcome: string;
    count: number;
    percentage: number;
  }>;
}

function OutcomeChart({ data }: OutcomeChartProps) {
  const outcomeConfig = {
    contacted: { label: 'Successfully Contacted', color: 'bg-emerald-500', icon: <CheckCircle className="h-4 w-4" /> },
    callback_requested: { label: 'Callback Requested', color: 'bg-blue-500', icon: <Phone className="h-4 w-4" /> },
    no_answer: { label: 'No Answer', color: 'bg-yellow-500', icon: <AlertTriangle className="h-4 w-4" /> },
    not_interested: { label: 'Not Interested', color: 'bg-red-500', icon: <XCircle className="h-4 w-4" /> },
    voicemail: { label: 'Left Voicemail', color: 'bg-purple-500', icon: <MessageSquare className="h-4 w-4" /> }
  };

  return (
    <div className="space-y-4">
      {data.map((item) => {
        const config = outcomeConfig[item.outcome as keyof typeof outcomeConfig] || {
          label: item.outcome,
          color: 'bg-slate-500',
          icon: <AlertCircle className="h-4 w-4" />
        };

        return (
          <div key={item.outcome} className="flex items-center justify-between py-3 px-4 rounded-lg bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200">
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-lg ${config.color} text-white shadow-sm`}>
                {config.icon}
              </div>
              <span className="text-sm font-medium text-slate-800">{config.label}</span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-lg font-bold text-slate-900">{item.count}</span>
              <span className="text-sm text-slate-600 bg-slate-200 px-2 py-1 rounded-full">{item.percentage}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface HourlyActivityChartProps {
  data: Array<{
    hour: number;
    calls: number;
    averageDuration: number;
  }>;
}

function HourlyActivityChart({ data }: HourlyActivityChartProps) {
  const maxCalls = Math.max(...data.map(d => d.calls));
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between text-xs text-slate-500 mb-4">
        <span>00</span>
        <span>06</span>
        <span>12</span>
        <span>18</span>
        <span>23</span>
      </div>
      
      <div className="flex items-end space-x-1 h-40 bg-gradient-to-t from-slate-50 to-transparent p-4 rounded-lg border border-slate-200">
        {data.map((item) => {
          const height = maxCalls > 0 ? (item.calls / maxCalls) * 100 : 0;
          
          return (
            <div key={item.hour} className="flex-1 flex flex-col items-center">
              <div 
                className="w-full bg-gradient-to-t from-blue-600 to-purple-600 rounded-t-lg shadow-sm transition-all duration-300 hover:shadow-md"
                style={{ height: `${height}%` }}
                title={`${String(item.hour).padStart(2, '0')}:00 - ${item.calls} calls`}
              />
            </div>
          );
        })}
      </div>
      
      <div className="text-center text-xs text-slate-500 mt-2">
        Hours of the day (24-hour format)
      </div>
    </div>
  );
}

interface AgentStatusTableProps {
  agents: AgentStatus[];
}

function AgentStatusTable({ agents }: AgentStatusTableProps) {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'available': return { label: 'Available', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', dot: 'bg-emerald-500' };
      case 'on_call': return { label: 'On Call', color: 'bg-blue-100 text-blue-800 border-blue-200', dot: 'bg-blue-500' };
      case 'break': return { label: 'On Break', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', dot: 'bg-yellow-500' };
      case 'offline': return { label: 'Offline', color: 'bg-slate-100 text-slate-800 border-slate-200', dot: 'bg-slate-500' };
      default: return { label: status, color: 'bg-slate-100 text-slate-800 border-slate-200', dot: 'bg-slate-500' };
    }
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  return (
    <div className="overflow-x-auto bg-white/80 backdrop-blur-sm rounded-lg border border-slate-200">
      <table className="w-full">
        <thead className="bg-gradient-to-r from-slate-50 to-slate-100">
          <tr>
            <th className="text-left py-4 px-6 font-semibold text-slate-700">Agent</th>
            <th className="text-left py-4 px-6 font-semibold text-slate-700">Status</th>
            <th className="text-left py-4 px-6 font-semibold text-slate-700">Calls Today</th>
            <th className="text-left py-4 px-6 font-semibold text-slate-700">Talk Time</th>
            <th className="text-left py-4 px-6 font-semibold text-slate-700">Last Activity</th>
          </tr>
        </thead>
        <tbody>
          {agents.map((agent) => {
            const statusConfig = getStatusConfig(agent.status);
            return (
              <tr key={agent.id} className="border-b border-slate-100 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-200">
                <td className="py-4 px-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white flex items-center justify-center text-sm font-bold">
                      {agent.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <div className="font-medium text-slate-900">{agent.name}</div>
                      <div className="text-sm text-slate-500">{agent.email}</div>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-6">
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${statusConfig.dot}`}></div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${statusConfig.color}`}>
                      {statusConfig.label}
                    </span>
                  </div>
                  {agent.currentCallDuration && (
                    <div className="text-xs text-slate-500 mt-1">
                      Call: {formatTime(agent.currentCallDuration)}
                    </div>
                  )}
                </td>
                <td className="py-4 px-6">
                  <span className="text-lg font-bold text-slate-900">{agent.callsToday || 0}</span>
                </td>
                <td className="py-4 px-6">
                  <span className="text-lg font-bold text-slate-900">
                    {agent.totalTalkTime ? formatTime(agent.totalTalkTime) : '0m'}
                  </span>
                </td>
                <td className="py-4 px-6 text-slate-600">
                  {new Date(agent.lastActivity).toLocaleTimeString()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function DashboardPage() {
  // Get real data using tRPC queries
  const { data: callAnalytics, isLoading: callsLoading } = api.calls.getAnalytics.useQuery({
    startDate: new Date(new Date().setHours(0, 0, 0, 0)),
    endDate: new Date()
  });

  const { data: queueStats, isLoading: queueLoading } = api.queue.getStats.useQuery();
  
  const { data: agentsStatus, isLoading: agentsLoading } = api.auth.getAllAgentsStatus.useQuery();
  
  const { data: communicationStats, isLoading: commLoading } = api.communications.getDashboardStats.useQuery({
    startDate: new Date(new Date().setHours(0, 0, 0, 0)),
    endDate: new Date()
  });

  // Show loading state
  if (callsLoading || queueLoading || agentsLoading || commLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="max-w-7xl mx-auto py-12 px-6">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
            <p className="text-slate-600 text-lg">Loading dashboard data...</p>
          </div>
        </div>
      </div>
    );
  }

  // Construct metrics from real data
  const metrics: DashboardMetrics = {
    callMetrics: {
      totalCalls: callAnalytics?.totalCalls || 0,
      completedCalls: callAnalytics?.successfulContacts || 0,
      averageDuration: callAnalytics?.avgTalkTimeMinutes ? callAnalytics.avgTalkTimeMinutes * 60 : 0,
      totalTalkTime: (callAnalytics?.avgTalkTimeMinutes || 0) * (callAnalytics?.totalCalls || 0) * 60,
      completionRate: callAnalytics?.contactRate || 0
    },
    queueMetrics: {
      currentDepth: (queueStats?.queue?.pending || 0) + (queueStats?.queue?.assigned || 0),
      averageWaitTime: queueStats?.averageWaitTime || 0,
      assignmentRate: 0 // Will calculate when we have the data
    },
    agentMetrics: {
      totalAgents: agentsStatus?.length || 0,
      onlineAgents: agentsStatus?.filter(a => a.agent?.isActive)?.length || 0,
      busyAgents: agentsStatus?.filter(a => a.currentStatus === 'on_call')?.length || 0,
      availableAgents: agentsStatus?.filter(a => a.currentStatus === 'available')?.length || 0
    },
    outcomeBreakdown: [], // TODO: Add outcomeBreakdown to CallAnalytics type
    hourlyData: [] // Will need to implement hourly analytics endpoint
  };

  // Transform agent status data
  const agents: AgentStatus[] = (agentsStatus || []).filter(session => session.agent).map(agentSession => ({
    id: agentSession.agentId,
    name: `${agentSession.agent?.firstName || ''} ${agentSession.agent?.lastName || ''}`,
    email: agentSession.agent?.email || '',
    status: agentSession.currentStatus as AgentStatus['status'],
    callsToday: agentSession.totalCallsToday,
    totalTalkTime: agentSession.totalTalkTimeSeconds,
    lastActivity: agentSession.lastStatusChange.toISOString()
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Supervisor Dashboard
            </h1>
            <p className="text-slate-600 mt-2 text-lg">
              Real-time agent performance and system metrics
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-slate-500 bg-white/80 backdrop-blur-sm px-3 py-2 rounded-lg border border-slate-200">
              Data refreshes automatically every 30 seconds
            </span>
          </div>
        </div>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Total Calls"
            value={metrics.callMetrics.totalCalls}
            change="Real-time data"
            trend="neutral"
            icon={<Phone className="h-6 w-6" />}
            gradient="bg-gradient-to-br from-blue-500 to-cyan-600"
          />
          <MetricCard
            title="Completion Rate"
            value={`${metrics.callMetrics.completionRate.toFixed(1)}%`}
            change="Real-time data"
            trend="neutral"
            icon={<CheckCircle className="h-6 w-6" />}
            gradient="bg-gradient-to-br from-emerald-500 to-teal-600"
          />
          <MetricCard
            title="Queue Depth"
            value={metrics.queueMetrics.currentDepth}
            change="Current pending"
            trend="neutral"
            icon={<ListChecks className="h-6 w-6" />}
            gradient="bg-gradient-to-br from-orange-500 to-red-600"
          />
          <MetricCard
            title="Active Agents"
            value={`${metrics.agentMetrics.onlineAgents}/${metrics.agentMetrics.totalAgents}`}
            change={`${metrics.agentMetrics.availableAgents} available`}
            trend="neutral"
            icon={<Users className="h-6 w-6" />}
            gradient="bg-gradient-to-br from-purple-500 to-pink-600"
          />
        </div>

        {/* Secondary Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <MetricCard
            title="Talk Time"
            value={`${Math.floor(metrics.callMetrics.totalTalkTime / 3600)}h ${Math.floor((metrics.callMetrics.totalTalkTime % 3600) / 60)}m`}
            change="Total talk time today"
            trend="neutral"
            icon={<Clock className="h-6 w-6" />}
            gradient="bg-gradient-to-br from-indigo-500 to-purple-600"
            description="Total talk time today"
          />
          <MetricCard
            title="Avg Call Duration"
            value={`${Math.floor(metrics.callMetrics.averageDuration / 60)}:${String(Math.floor(metrics.callMetrics.averageDuration % 60)).padStart(2, '0')}`}
            change="Average duration per call"
            trend="neutral"
            icon={<PhoneCall className="h-6 w-6" />}
            gradient="bg-gradient-to-br from-green-500 to-emerald-600"
            description="Average duration per call"
          />
          <MetricCard
            title="Queue Wait Time"
            value={`${Math.floor(metrics.queueMetrics.averageWaitTime / 60)}:${String(Math.floor(metrics.queueMetrics.averageWaitTime % 60)).padStart(2, '0')}`}
            change="Average wait time"
            trend="neutral"
            icon={<Clock className="h-6 w-6" />}
            gradient="bg-gradient-to-br from-yellow-500 to-orange-600"
            description="Average wait time"
          />
        </div>

        {/* Charts and Details */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Call Outcomes */}
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
            <div className="p-6">
              <h3 className="text-xl font-semibold text-slate-800 mb-6 flex items-center gap-2">
                <BarChart3 className="w-6 h-6 text-blue-600" />
                Call Outcomes
              </h3>
              {metrics.outcomeBreakdown.length > 0 ? (
                <OutcomeChart data={metrics.outcomeBreakdown} />
              ) : (
                <div className="text-center text-slate-500 py-12">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full flex items-center justify-center">
                    <AlertCircle className="h-8 w-8 text-slate-400" />
                  </div>
                  <p className="font-medium text-lg">No call outcome data available</p>
                  <p className="text-sm mt-1">Data will appear as calls are completed</p>
                </div>
              )}
            </div>
          </Card>

          {/* Hourly Call Activity */}
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
            <div className="p-6">
              <h3 className="text-xl font-semibold text-slate-800 mb-6 flex items-center gap-2">
                <Clock className="w-6 h-6 text-purple-600" />
                Hourly Call Activity
              </h3>
              {metrics.hourlyData.length > 0 ? (
                <HourlyActivityChart data={metrics.hourlyData} />
              ) : (
                <div className="text-center text-slate-500 py-12">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full flex items-center justify-center">
                    <BarChart3 className="h-8 w-8 text-slate-400" />
                  </div>
                  <p className="font-medium text-lg">Hourly activity data coming soon</p>
                  <p className="text-sm mt-1">Analytics will be available as data is collected</p>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Agent Status Table */}
        <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
                <Users className="w-6 h-6 text-emerald-600" />
                Agent Status
              </h3>
              <Button 
                variant="outline" 
                size="sm"
                className="border-slate-300 hover:bg-slate-100"
              >
                <Link2 className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
            
            {agents.length > 0 ? (
              <AgentStatusTable agents={agents} />
            ) : (
              <div className="text-center text-slate-500 py-12">
                <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full flex items-center justify-center">
                  <Users className="h-8 w-8 text-slate-400" />
                </div>
                <p className="font-medium text-lg">No agent data available</p>
                <p className="text-sm mt-1">Agent information will appear when agents are online</p>
              </div>
            )}
          </div>
        </Card>

        {/* Quick Actions */}
        <div className="flex justify-center space-x-4">
          <Link href="/queue/unsigned">
            <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all duration-200">
              <ListChecks className="h-4 w-4 mr-2" />
              View Unsigned Queue
            </Button>
          </Link>
          <Link href="/queue/requirements">
            <Button 
              variant="outline"
              className="border-slate-300 text-slate-700 hover:bg-slate-100 hover:border-slate-400 shadow-md"
            >
              <Calendar className="h-4 w-4 mr-2" />
              View Requirements Queue
            </Button>
          </Link>
          <Link href="/calls/history">
            <Button 
              variant="outline"
              className="border-slate-300 text-slate-700 hover:bg-slate-100 hover:border-slate-400 shadow-md"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              View Call Analytics
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
} 