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
  color: 'blue' | 'green' | 'yellow' | 'purple' | 'red';
  description?: string;
}

function MetricCard({ title, value, change, trend, icon, color, description }: MetricCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-600',
    green: 'bg-green-50 border-green-200 text-green-600',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-600',
    purple: 'bg-purple-50 border-purple-200 text-purple-600',
    red: 'bg-red-50 border-red-200 text-red-600'
  };

  const trendIcon = trend === 'up' ? <ArrowUpRight className="h-4 w-4" /> :
                   trend === 'down' ? <ArrowDownRight className="h-4 w-4" /> : null;

  const trendColor = trend === 'up' ? 'text-green-600' :
                    trend === 'down' ? 'text-red-600' : 'text-gray-600';

  return (
    <Card className={`p-6 border-2 ${colorClasses[color]}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
            {icon}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
          </div>
        </div>
      </div>
      
      {change && (
        <div className={`flex items-center mt-2 ${trendColor}`}>
          {trendIcon}
          <span className="text-sm font-medium ml-1">{change}</span>
        </div>
      )}
      
      {description && (
        <p className="text-xs text-gray-500 mt-2">{description}</p>
      )}
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
    contacted: { label: 'Successfully Contacted', color: 'bg-green-500', icon: <CheckCircle className="h-4 w-4" /> },
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
          color: 'bg-gray-500',
          icon: <AlertCircle className="h-4 w-4" />
        };

        return (
          <div key={item.outcome} className="flex items-center justify-between py-2">
            <div className="flex items-center space-x-3">
              <div className={`p-1 rounded ${config.color} text-white`}>
                {config.icon}
              </div>
              <span className="text-sm font-medium text-gray-700">{config.label}</span>
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-sm font-bold text-gray-900">{item.count}</span>
              <span className="text-sm text-gray-500">{item.percentage}%</span>
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
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-gray-500 mb-4">
        <span>00</span>
        <span>06</span>
        <span>12</span>
        <span>18</span>
        <span>23</span>
      </div>
      
      <div className="flex items-end space-x-1 h-32">
        {data.map((item) => {
          const height = maxCalls > 0 ? (item.calls / maxCalls) * 100 : 0;
          const intensity = height > 75 ? 'bg-blue-600' : 
                           height > 50 ? 'bg-blue-500' : 
                           height > 25 ? 'bg-blue-400' : 'bg-blue-200';
          
          return (
            <div key={item.hour} className="flex-1 flex flex-col items-center">
              <div 
                className={`w-full ${intensity} rounded-t`}
                style={{ height: `${height}%` }}
                title={`${String(item.hour).padStart(2, '0')}:00 - ${item.calls} calls`}
              />
            </div>
          );
        })}
      </div>
      
      <div className="text-center text-xs text-gray-500 mt-2">
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
      case 'available': return { label: 'Available', color: 'bg-green-100 text-green-800', dot: 'bg-green-500' };
      case 'on_call': return { label: 'On Call', color: 'bg-blue-100 text-blue-800', dot: 'bg-blue-500' };
      case 'break': return { label: 'On Break', color: 'bg-yellow-100 text-yellow-800', dot: 'bg-yellow-500' };
      case 'offline': return { label: 'Offline', color: 'bg-gray-100 text-gray-800', dot: 'bg-gray-500' };
      default: return { label: status, color: 'bg-gray-100 text-gray-800', dot: 'bg-gray-500' };
    }
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 px-4 font-semibold text-gray-700">Agent</th>
            <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
            <th className="text-left py-3 px-4 font-semibold text-gray-700">Calls Today</th>
            <th className="text-left py-3 px-4 font-semibold text-gray-700">Talk Time</th>
            <th className="text-left py-3 px-4 font-semibold text-gray-700">Last Activity</th>
          </tr>
        </thead>
        <tbody>
          {agents.map((agent) => {
            const statusConfig = getStatusConfig(agent.status);
            return (
              <tr key={agent.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4">
                  <div>
                    <div className="font-medium text-gray-900">{agent.name}</div>
                    <div className="text-sm text-gray-500">{agent.email}</div>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${statusConfig.dot}`}></div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}>
                      {statusConfig.label}
                    </span>
                  </div>
                  {agent.currentCallDuration && (
                    <div className="text-xs text-gray-500 mt-1">
                      Call: {formatTime(agent.currentCallDuration)}
                    </div>
                  )}
                </td>
                <td className="py-3 px-4 text-gray-900">{agent.callsToday || 0}</td>
                <td className="py-3 px-4 text-gray-900">
                  {agent.totalTalkTime ? formatTime(agent.totalTalkTime) : '0m'}
                </td>
                <td className="py-3 px-4 text-gray-500">
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
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard data...</p>
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
    outcomeBreakdown: callAnalytics?.outcomeBreakdown || [],
    hourlyData: [] // Will need to implement hourly analytics endpoint
  };

  // Transform agent status data
  const agents: AgentStatus[] = (agentsStatus || []).map(agentSession => ({
    id: agentSession.agentId,
    name: `${agentSession.agent.firstName} ${agentSession.agent.lastName}`,
    email: agentSession.agent.email,
    status: agentSession.currentStatus as AgentStatus['status'],
    callsToday: agentSession.totalCallsToday,
    totalTalkTime: agentSession.totalTalkTimeSeconds,
    lastActivity: agentSession.lastStatusChange.toISOString()
  }));

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">📊 Supervisor Dashboard</h1>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-500">
              Data refreshes automatically every 30 seconds
            </span>
          </div>
        </div>
        <p className="text-gray-600 mt-1">Real-time agent performance and system metrics</p>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <MetricCard
          title="Total Calls"
          value={metrics.callMetrics.totalCalls}
          change="Real-time data"
          trend="neutral"
          icon={<Phone className="h-6 w-6" />}
          color="blue"
        />
        <MetricCard
          title="Completion Rate"
          value={`${metrics.callMetrics.completionRate.toFixed(1)}%`}
          change="Real-time data"
          trend="neutral"
          icon={<CheckCircle className="h-6 w-6" />}
          color="green"
        />
        <MetricCard
          title="Queue Depth"
          value={metrics.queueMetrics.currentDepth}
          change="Current pending"
          trend="neutral"
          icon={<ListChecks className="h-6 w-6" />}
          color="yellow"
        />
        <MetricCard
          title="Active Agents"
          value={`${metrics.agentMetrics.onlineAgents}/${metrics.agentMetrics.totalAgents}`}
          change={`${metrics.agentMetrics.availableAgents} available`}
          trend="neutral"
          icon={<Users className="h-6 w-6" />}
          color="purple"
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <MetricCard
          title="Talk Time"
          value={`${Math.floor(metrics.callMetrics.totalTalkTime / 3600)}h ${Math.floor((metrics.callMetrics.totalTalkTime % 3600) / 60)}m`}
          change="Total talk time today"
          trend="neutral"
          icon={<Clock className="h-6 w-6" />}
          color="blue"
          description="Total talk time today"
        />
        <MetricCard
          title="Avg Call Duration"
          value={`${Math.floor(metrics.callMetrics.averageDuration / 60)}:${String(Math.floor(metrics.callMetrics.averageDuration % 60)).padStart(2, '0')}`}
          change="Average duration per call"
          trend="neutral"
          icon={<PhoneCall className="h-6 w-6" />}
          color="green"
          description="Average duration per call"
        />
        <MetricCard
          title="Queue Wait Time"
          value={`${Math.floor(metrics.queueMetrics.averageWaitTime / 60)}:${String(Math.floor(metrics.queueMetrics.averageWaitTime % 60)).padStart(2, '0')}`}
          change="Average wait time"
          trend="neutral"
          icon={<Clock className="h-6 w-6" />}
          color="yellow"
          description="Average wait time"
        />
      </div>

      {/* Charts and Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Call Outcomes */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Call Outcomes</h3>
          {metrics.outcomeBreakdown.length > 0 ? (
            <>
              <OutcomeChart data={metrics.outcomeBreakdown} />
              {/* Progress bars */}
              <div className="mt-6 space-y-2">
                {metrics.outcomeBreakdown.map((item) => (
                  <div key={item.outcome} className="flex items-center space-x-3">
                    <span className="text-sm font-medium text-gray-600 w-20">
                      {item.outcome === 'contacted' ? 'Successfully' :
                       item.outcome === 'callback_requested' ? 'Callback' :
                       item.outcome === 'no_answer' ? 'No' :
                       item.outcome === 'not_interested' ? 'Not' :
                       'Left'}
                    </span>
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          item.outcome === 'contacted' ? 'bg-green-500' :
                          item.outcome === 'callback_requested' ? 'bg-blue-500' :
                          item.outcome === 'no_answer' ? 'bg-yellow-500' :
                          item.outcome === 'not_interested' ? 'bg-red-500' :
                          'bg-purple-500'
                        }`}
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-500 w-12">{item.percentage.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center text-gray-500 py-8">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No call outcome data available</p>
            </div>
          )}
        </Card>

        {/* Hourly Call Activity */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Hourly Call Activity</h3>
          {metrics.hourlyData.length > 0 ? (
            <HourlyActivityChart data={metrics.hourlyData} />
          ) : (
            <div className="text-center text-gray-500 py-8">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>Hourly activity data coming soon</p>
            </div>
          )}
        </Card>
      </div>

      {/* Agent Status Table */}
      <Card className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Agent Status</h3>
          <Button variant="outline" size="sm">
            <Link2 className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
        
        {agents.length > 0 ? (
          <AgentStatusTable agents={agents} />
        ) : (
          <div className="text-center text-gray-500 py-8">
            <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No agent data available</p>
          </div>
        )}
      </Card>

      {/* Quick Actions */}
      <div className="mt-8 flex justify-center space-x-4">
        <Link href="/queue/unsigned">
          <Button className="bg-blue-600 hover:bg-blue-700">
            <ListChecks className="h-4 w-4 mr-2" />
            View Unsigned Queue
          </Button>
        </Link>
        <Link href="/queue/requirements">
          <Button variant="outline">
            <Calendar className="h-4 w-4 mr-2" />
            View Requirements Queue
          </Button>
        </Link>
        <Link href="/calls/history">
          <Button variant="outline">
            <BarChart3 className="h-4 w-4 mr-2" />
            View Call Analytics
          </Button>
        </Link>
      </div>
    </div>
  );
} 