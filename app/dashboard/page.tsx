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
  currentCallDuration?: number;
  callsToday: number;
  totalTalkTime: number;
  lastActivity: string;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
}

function MetricCard({ title, value, change, trend, icon, color }: MetricCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    yellow: 'bg-yellow-50 text-yellow-600 border-yellow-200',
    red: 'bg-red-50 text-red-600 border-red-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200'
  };

  const trendIcon = trend === 'up' ? (
    <TrendingUp className="h-4 w-4 text-green-500" />
  ) : trend === 'down' ? (
    <TrendingDown className="h-4 w-4 text-red-500" />
  ) : null;

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
          {change && (
            <div className="flex items-center mt-2">
              {trendIcon}
              <span className={`text-sm ml-1 ${
                trend === 'up' ? 'text-green-600' :
                trend === 'down' ? 'text-red-600' : 'text-gray-600'
              }`}>
                {change}
              </span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-lg border ${colorClasses[color]}`}>
          {icon}
        </div>
      </div>
    </Card>
  );
}

interface CallOutcomeChartProps {
  data: Array<{ outcome: string; count: number; percentage: number }>;
}

function CallOutcomeChart({ data }: CallOutcomeChartProps) {
  const outcomeColors: Record<string, string> = {
    contacted: 'bg-green-500',
    callback_requested: 'bg-blue-500',
    not_interested: 'bg-red-500',
    no_answer: 'bg-yellow-500',
    voicemail: 'bg-purple-500',
    wrong_number: 'bg-gray-500',
    busy: 'bg-orange-500'
  };

  const outcomeLabels: Record<string, string> = {
    contacted: 'Successfully Contacted',
    callback_requested: 'Callback Requested',
    not_interested: 'Not Interested',
    no_answer: 'No Answer',
    voicemail: 'Left Voicemail',
    wrong_number: 'Wrong Number',
    busy: 'Line Busy'
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Call Outcomes</h3>
      
      <div className="space-y-4">
        {data.map((item) => (
          <div key={item.outcome} className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${outcomeColors[item.outcome] || 'bg-gray-400'}`} />
              <span className="text-sm font-medium text-gray-700">
                {outcomeLabels[item.outcome] || item.outcome}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">{item.count}</span>
              <span className="text-sm font-medium text-gray-900">{item.percentage}%</span>
            </div>
          </div>
        ))}
      </div>

      {/* Visual Bar Chart */}
      <div className="mt-6 space-y-2">
        {data.map((item) => (
          <div key={item.outcome} className="flex items-center space-x-2">
            <div className="w-20 text-xs text-gray-600 truncate">
              {outcomeLabels[item.outcome]?.split(' ')[0] || item.outcome}
            </div>
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${outcomeColors[item.outcome] || 'bg-gray-400'}`}
                style={{ width: `${item.percentage}%` }}
              />
            </div>
            <div className="w-10 text-xs text-gray-600 text-right">
              {item.percentage}%
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

interface HourlyActivityChartProps {
  data: Array<{ hour: number; calls: number; averageDuration: number }>;
}

function HourlyActivityChart({ data }: HourlyActivityChartProps) {
  const maxCalls = Math.max(...data.map(d => d.calls));

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Hourly Call Activity</h3>
      
      <div className="flex items-end space-x-1 h-40">
        {data.map((item) => (
          <div key={item.hour} className="flex-1 flex flex-col items-center">
            <div
              className="w-full bg-blue-500 rounded-t transition-all hover:bg-blue-600"
              style={{ 
                height: `${(item.calls / maxCalls) * 100}%`,
                minHeight: item.calls > 0 ? '8px' : '2px'
              }}
              title={`${item.calls} calls at ${item.hour}:00`}
            />
            <div className="text-xs text-gray-600 mt-1">
              {item.hour.toString().padStart(2, '0')}
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-4 text-center text-xs text-gray-500">
        Hours of the day (24-hour format)
      </div>
    </Card>
  );
}

interface AgentStatusListProps {
  agents: AgentStatus[];
}

function AgentStatusList({ agents }: AgentStatusListProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'available':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'on_call':
        return <Phone className="h-5 w-5 text-blue-500" />;
      case 'break':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'offline':
        return <XCircle className="h-5 w-5 text-gray-400" />;
      default:
        return <XCircle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusLabel = (status: string) => {
    return status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  return (
    <Card>
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Agent Status</h3>
      </div>
      
      <div className="divide-y divide-gray-200">
        {agents.map((agent) => (
          <div key={agent.id} className="p-4 hover:bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {getStatusIcon(agent.status)}
                <div>
                  <div className="font-medium text-gray-900">{agent.name}</div>
                  <div className="text-sm text-gray-600">{agent.email}</div>
                </div>
              </div>
              
              <div className="text-right">
                <div className="text-sm font-medium text-gray-900">
                  {getStatusLabel(agent.status)}
                </div>
                {agent.currentCallDuration && (
                  <div className="text-sm text-blue-600">
                    Call: {formatDuration(agent.currentCallDuration)}
                  </div>
                )}
              </div>
            </div>
            
            <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Calls Today:</span>
                <span className="ml-1 font-medium text-gray-900">{agent.callsToday}</span>
              </div>
              <div>
                <span className="text-gray-600">Talk Time:</span>
                <span className="ml-1 font-medium text-gray-900">
                  {formatDuration(agent.totalTalkTime)}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Last Active:</span>
                <span className="ml-1 font-medium text-gray-900">
                  {new Date(agent.lastActivity).toLocaleTimeString()}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  // Mock data for development - will be replaced with real tRPC queries
  const mockMetrics: DashboardMetrics = {
    callMetrics: {
      totalCalls: 247,
      completedCalls: 186,
      averageDuration: 180,
      totalTalkTime: 33480,
      completionRate: 75.3
    },
    queueMetrics: {
      currentDepth: 12,
      averageWaitTime: 145,
      assignmentRate: 92.1
    },
    agentMetrics: {
      totalAgents: 8,
      onlineAgents: 6,
      busyAgents: 2,
      availableAgents: 4
    },
    outcomeBreakdown: [
      { outcome: 'contacted', count: 142, percentage: 57.5 },
      { outcome: 'callback_requested', count: 44, percentage: 17.8 },
      { outcome: 'no_answer', count: 38, percentage: 15.4 },
      { outcome: 'not_interested', count: 15, percentage: 6.1 },
      { outcome: 'voicemail', count: 8, percentage: 3.2 }
    ],
    hourlyData: Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      calls: Math.floor(Math.random() * 20) + 5,
      averageDuration: Math.floor(Math.random() * 60) + 120
    }))
  };

  const mockAgents: AgentStatus[] = [
    {
      id: 1,
      name: 'Sarah Johnson',
      email: 'sarah.j@company.com',
      status: 'available',
      callsToday: 23,
      totalTalkTime: 4680,
      lastActivity: new Date().toISOString()
    },
    {
      id: 2,
      name: 'Mike Brown',
      email: 'mike.b@company.com',
      status: 'on_call',
      currentCallDuration: 245,
      callsToday: 18,
      totalTalkTime: 3240,
      lastActivity: new Date().toISOString()
    },
    {
      id: 3,
      name: 'Emma Wilson',
      email: 'emma.w@company.com',
      status: 'break',
      callsToday: 15,
      totalTalkTime: 2700,
      lastActivity: new Date(Date.now() - 300000).toISOString()
    }
  ];

  const metrics = mockMetrics;
  const agents = mockAgents;

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
          change="+12% vs yesterday"
          trend="up"
          icon={<Phone className="h-6 w-6" />}
          color="blue"
        />
        <MetricCard
          title="Completion Rate"
          value={`${metrics.callMetrics.completionRate}%`}
          change="+5% vs yesterday"
          trend="up"
          icon={<CheckCircle className="h-6 w-6" />}
          color="green"
        />
        <MetricCard
          title="Queue Depth"
          value={metrics.queueMetrics.currentDepth}
          change="-3 from 1hr ago"
          trend="down"
          icon={<ListChecks className="h-6 w-6" />}
          color="yellow"
        />
        <MetricCard
          title="Active Agents"
          value={`${metrics.agentMetrics.onlineAgents}/${metrics.agentMetrics.totalAgents}`}
          change="2 online"
          trend="neutral"
          icon={<Users className="h-6 w-6" />}
          color="purple"
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Talk Time</h3>
          <div className="text-3xl font-bold text-gray-900">
            {`${Math.floor(metrics.callMetrics.totalTalkTime / 3600)}h ${Math.floor((metrics.callMetrics.totalTalkTime % 3600) / 60)}m`}
          </div>
          <p className="text-sm text-gray-600 mt-1">Total talk time today</p>
        </Card>
        
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Avg Call Duration</h3>
          <div className="text-3xl font-bold text-gray-900">
            {`${Math.floor(metrics.callMetrics.averageDuration / 60)}:${(metrics.callMetrics.averageDuration % 60).toString().padStart(2, '0')}`}
          </div>
          <p className="text-sm text-gray-600 mt-1">Average duration per call</p>
        </Card>
        
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Queue Wait Time</h3>
          <div className="text-3xl font-bold text-gray-900">
            {`${Math.floor(metrics.queueMetrics.averageWaitTime / 60)}:${(metrics.queueMetrics.averageWaitTime % 60).toString().padStart(2, '0')}`}
          </div>
          <p className="text-sm text-gray-600 mt-1">Average wait time</p>
        </Card>
      </div>

      {/* Charts and Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Call Outcomes Chart */}
        <CallOutcomeChart data={metrics.outcomeBreakdown} />
        
        {/* Hourly Activity Chart */}
        <HourlyActivityChart data={metrics.hourlyData} />
      </div>

      {/* Agent Status */}
      <AgentStatusList agents={agents} />

      {/* Performance Alerts */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-yellow-50 border-yellow-200 p-6">
          <div className="flex items-center">
            <AlertTriangle className="h-6 w-6 text-yellow-600 mr-2" />
            <h3 className="text-lg font-semibold text-yellow-800">Performance Alerts</h3>
          </div>
          <div className="mt-4 space-y-2 text-sm text-yellow-700">
            {metrics.queueMetrics.currentDepth > 50 && (
              <div>• Queue depth is high ({metrics.queueMetrics.currentDepth} users waiting)</div>
            )}
            {metrics.callMetrics.completionRate < 70 && (
              <div>• Call completion rate is below target ({metrics.callMetrics.completionRate}%)</div>
            )}
            {metrics.queueMetrics.averageWaitTime > 300 && (
              <div>• Average wait time is high ({Math.floor(metrics.queueMetrics.averageWaitTime / 60)} minutes)</div>
            )}
            {metrics.queueMetrics.currentDepth <= 50 && metrics.callMetrics.completionRate >= 70 && (
              <div>• No performance issues detected</div>
            )}
          </div>
        </Card>
        
        <Card className="bg-blue-50 border-blue-200 p-6">
          <div className="flex items-center">
            <TrendingUp className="h-6 w-6 text-blue-600 mr-2" />
            <h3 className="text-lg font-semibold text-blue-800">Quick Actions</h3>
          </div>
          <div className="mt-4 space-y-2">
            <Link 
              href="/queue/unsigned" 
              className="block w-full text-left px-3 py-2 bg-white border border-blue-200 rounded text-sm text-blue-700 hover:bg-blue-100"
            >
              🔄 View Call Queue
            </Link>
            <Link 
              href="/calls/history" 
              className="block w-full text-left px-3 py-2 bg-white border border-blue-200 rounded text-sm text-blue-700 hover:bg-blue-100"
            >
              📊 View Call History
            </Link>
            <Link 
              href="/sms" 
              className="block w-full text-left px-3 py-2 bg-white border border-blue-200 rounded text-sm text-blue-700 hover:bg-blue-100"
            >
              💬 SMS Conversations
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
} 