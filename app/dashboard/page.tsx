'use client';

// =============================================================================
// Enhanced Dashboard Page - Live Agent Analytics
// =============================================================================
// Comprehensive analytics dashboard for supervisors and admins with live agent metrics

// Force dynamic rendering
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useState } from 'react'
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
  ListChecks,
  Filter,
  Search,
  Timer,
  Award,
  Zap,
  Activity,
  Eye,
  RotateCcw,
  ExternalLink,
  DollarSign
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/modules/core/components/ui/card'
import { Button } from '@/modules/core/components/ui/button'
import { Input } from '@/modules/core/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/modules/core/components/ui/select'
import { Badge } from '@/modules/core/components/ui/badge'

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

interface AgentAnalyticsRow {
  agentId: number;
  agentName: string;
  status: string;
  callsToday: number;
  talkTime: number; // minutes
  avgGapTime: number; // minutes
  productivityScore: number;
  conversions: number;
  contactRate: number;
  positiveCallPercentage: number;
  currentGap?: number; // current gap in minutes
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
            <div className={`flex items-center space-x-1 ${trendColor}`}>
              {trendIcon}
              {change && <span className="text-sm font-medium">{change}</span>}
            </div>
          )}
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-white/90">{title}</h3>
          <div className="text-3xl font-bold text-white">{value}</div>
          {description && (
            <p className="text-sm text-white/70">{description}</p>
          )}
        </div>
      </div>
    </Card>
  );
}

function AgentAnalyticsTable({ 
  agents, 
  isLoading, 
  onRefresh, 
  searchTerm, 
  onSearchChange 
}: {
  agents: AgentAnalyticsRow[];
  isLoading: boolean;
  onRefresh: () => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
}) {
  const getProductivityColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-yellow-600 bg-yellow-100';
    if (score >= 40) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      available: { color: 'bg-green-100 text-green-800', icon: <CheckCircle className="w-3 h-3" /> },
      on_call: { color: 'bg-blue-100 text-blue-800', icon: <Phone className="w-3 h-3" /> },
      break: { color: 'bg-yellow-100 text-yellow-800', icon: <Clock className="w-3 h-3" /> },
      offline: { color: 'bg-gray-100 text-gray-800', icon: <XCircle className="w-3 h-3" /> }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.offline;
    
    return (
      <Badge className={`${config.color} flex items-center gap-1`}>
        {config.icon}
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  const filteredAgents = agents.filter(agent => 
    agent.agentName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Live Agent Analytics ({filteredAgents.length})
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search agents..."
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10 w-64"
              />
            </div>
            <Button onClick={onRefresh} size="sm" variant="outline">
              <RotateCcw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredAgents.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">No agents found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Agent</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Calls Today</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Talk Time</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Avg Gap Time</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Productivity</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Conversions</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Contact Rate</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Positive Call %</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Current Gap</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAgents.map((agent) => (
                  <tr key={agent.agentId} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-900">{agent.agentName}</div>
                    </td>
                    <td className="py-3 px-4">
                      {getStatusBadge(agent.status)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <Phone className="w-4 h-4 text-blue-500" />
                        <span className="font-medium">{agent.callsToday}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4 text-green-500" />
                        <span>{Math.round(agent.talkTime)}m</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <Timer className="w-4 h-4 text-orange-500" />
                        <span>{Math.round(agent.avgGapTime)}m</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge className={getProductivityColor(agent.productivityScore)}>
                        <Award className="w-3 h-3 mr-1" />
                        {agent.productivityScore}/100
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <Target className="w-4 h-4 text-purple-500" />
                        <span className="font-medium">{agent.conversions}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-medium">{agent.contactRate}%</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="font-medium">{agent.positiveCallPercentage}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {agent.currentGap ? (
                        <div className="flex items-center gap-1">
                          <Activity className="w-4 h-4 text-yellow-500" />
                          <span className="text-sm">{Math.round(agent.currentGap)}m</span>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <Button size="sm" variant="ghost">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Conversions Table Component
function ConversionsTable({ 
  conversions, 
  isLoading, 
  onRefresh 
}: {
  conversions: any[];
  isLoading: boolean;
  onRefresh: () => void;
}) {
  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(new Date(date));
  };

  const formatCurrency = (amount: any) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(Number(amount));
  };

  const getConversionTypeColor = (type: string) => {
    switch (type) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'signed': return 'bg-blue-100 text-blue-800';
      case 'opted_out': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl font-bold">Today's Conversions</CardTitle>
            <p className="text-sm text-slate-600 mt-1">
              Real-time conversion tracking with user and agent details
            </p>
          </div>
          <Button
            onClick={onRefresh}
            variant="outline"
            size="sm"
            disabled={isLoading}
            className="flex items-center space-x-2"
          >
            <RotateCcw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-slate-500">Loading conversions...</div>
          </div>
        ) : conversions && conversions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Time</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">User</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Agent</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Type</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Value</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {conversions.map((conversion) => (
                  <tr key={conversion.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <div className="text-sm font-medium">{formatTime(conversion.convertedAt)}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-sm font-medium">{conversion.user.name}</div>
                      {conversion.user.email && (
                        <div className="text-xs text-slate-500">{conversion.user.email}</div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-sm font-medium">{conversion.agent.name}</div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge className={`${getConversionTypeColor(conversion.conversionType)} border-0`}>
                        {conversion.conversionType}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-sm font-medium">
                        {formatCurrency(conversion.claimValue)}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Link
                        href={`/users/${conversion.user.id}`}
                        className="inline-flex items-center space-x-1 text-blue-600 hover:text-blue-800 text-sm"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>View User</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <DollarSign className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No conversions today</p>
            <p className="text-sm text-slate-400 mt-1">Conversions will appear here as they happen</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  // State for analytics controls
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  // Calculate date range based on selection
  const getDateRange = () => {
    const endDate = new Date(selectedDate);
    const startDate = new Date(selectedDate);
    
    switch (selectedPeriod) {
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setDate(startDate.getDate() - 30);
        break;
      default: // today
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
    }
    
    return { startDate, endDate };
  };

  const { startDate, endDate } = getDateRange();

  // Get real data using tRPC queries with error handling
  const { data: callAnalytics, isLoading: callsLoading, error: callsError } = api.calls.getAnalytics.useQuery({
    startDate,
    endDate
  }, {
    retry: false,
    refetchInterval: 30000, // Refresh every 30 seconds
    onError: (error) => {
      console.warn('Calls analytics failed:', error.message);
    }
  });

  const { data: queueStats, isLoading: queueLoading, error: queueError } = api.queue.getStats.useQuery(undefined, {
    retry: false,
    refetchInterval: 10000, // Refresh every 10 seconds
    onError: (error) => {
      console.warn('Queue stats failed:', error.message);
    }
  });

  const { data: agentsStatus, isLoading: agentsLoading, error: agentsError } = api.auth.getAllAgentsStatus.useQuery(undefined, {
    retry: false,
    refetchInterval: 5000, // Refresh every 5 seconds for live status
    onError: (error) => {
      console.warn('Agent status failed:', error.message);
    }
  });

  // Get live agent metrics from our new analytics module
  const { data: liveMetrics, isLoading: liveMetricsLoading, refetch: refetchLiveMetrics } = api.analytics.getLiveAgentMetrics.useQuery(undefined, {
    retry: false,
    refetchInterval: 10000, // Refresh every 10 seconds
    onError: (error) => {
      console.warn('Live metrics failed:', error.message);
    }
  });

  // Get team efficiency report
  const { data: teamReport, isLoading: teamReportLoading } = api.analytics.getTeamEfficiencyReport.useQuery({
    startDate,
    endDate
  }, {
    retry: false,
    refetchInterval: 60000, // Refresh every minute
    onError: (error) => {
      console.warn('Team report failed:', error.message);
    }
  });

  // Get today's conversions
  const { data: todayConversions, isLoading: conversionsLoading, refetch: refetchConversions } = 
    api.analytics.getTodayConversions.useQuery(undefined, {
      retry: false,
      refetchInterval: 30000,
      onError: (error) => {
        console.warn('Conversions failed:', error.message);
      }
    });

  // Loading state
  const isLoading = callsLoading || queueLoading || agentsLoading;

  // Error state - show a more user-friendly error if all data sources fail
  if (callsError && queueError && agentsError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Unable to Load Dashboard</h2>
            <p className="text-gray-600 mb-6">
              We're having trouble connecting to the system. Please check your permissions or try again.
            </p>
            <Button 
              onClick={() => window.location.reload()} 
              className="mt-6"
            >
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Construct metrics from real data with fallbacks
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
      assignmentRate: 0
    },
    agentMetrics: {
      totalAgents: agentsStatus?.length || 0,
      onlineAgents: agentsStatus?.filter(a => a.agent?.isActive)?.length || 0,
      busyAgents: agentsStatus?.filter(a => a.currentStatus === 'on_call')?.length || 0,
      availableAgents: agentsStatus?.filter(a => a.currentStatus === 'available')?.length || 0
    },
    outcomeBreakdown: [],
    hourlyData: []
  };

  // Transform live metrics data for agent analytics table
  const agentAnalyticsData: AgentAnalyticsRow[] = (liveMetrics || []).map(metric => ({
    agentId: metric.agentId,
    agentName: metric.agentName, // Now using real agent names from database
    status: metric.currentStatus,
    callsToday: metric.todayStats.callsToday,
    talkTime: Math.round(metric.todayStats.talkTimeToday / 60), // convert to minutes
    avgGapTime: Math.round(metric.todayStats.avgGapTimeToday / 60), // convert to minutes
    productivityScore: metric.sessionStats.productivity,
    conversions: metric.todayStats.conversionsToday, // Now using real conversion data
    contactRate: metric.todayStats.contactRateToday, // Now using real contact rate calculation (answered calls)
    positiveCallPercentage: metric.todayStats.positiveCallPercentageToday, // Positive calls (completed_form + going_to_complete)
    currentGap: metric.todayStats.currentGap ? Math.round(metric.todayStats.currentGap.duration / 60) : undefined
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="space-y-6 p-6">
        {/* Enhanced Header with Time Period Controls */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Live Analytics Dashboard
            </h1>
            <p className="text-slate-600 mt-2 text-lg">
              Real-time agent performance and system metrics
            </p>
          </div>
          <div className="flex items-center space-x-4">
            {/* Time Period Selector */}
            <div className="flex items-center space-x-2 bg-white/80 backdrop-blur-sm px-4 py-2 rounded-lg border border-slate-200">
              <Calendar className="w-4 h-4 text-slate-500" />
              <Select value={selectedPeriod} onValueChange={(value: any) => setSelectedPeriod(value)}>
                <SelectTrigger className="w-32 border-0 bg-transparent">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">Last 7 Days</SelectItem>
                  <SelectItem value="month">Last 30 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <span className="text-sm text-slate-500 bg-white/80 backdrop-blur-sm px-3 py-2 rounded-lg border border-slate-200">
              Auto-refreshes live data
            </span>
          </div>
        </div>

        {/* Enhanced Tab Navigation */}
        <div className="space-y-6">
          <div className="flex space-x-1 bg-white/80 backdrop-blur-sm rounded-lg p-1 border border-slate-200">
            <Button
              variant={activeTab === 'overview' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('overview')}
              className="flex-1"
            >
              System Overview
            </Button>
            <Button
              variant={activeTab === 'agents' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('agents')}
              className="flex-1"
            >
              Agent Analytics
            </Button>
            <Button
              variant={activeTab === 'performance' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('performance')}
              className="flex-1"
            >
              Performance Reports
            </Button>
            <Button
              variant={activeTab === 'conversions' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('conversions')}
              className="flex-1"
            >
              Conversions
            </Button>
          </div>

          {/* System Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
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
                title="Contact Rate"
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
              />
              <MetricCard
                title="Team Productivity"
                value={teamReport ? `${Math.round(teamReport.teamMetrics.teamProductivityScore)}/100` : "-"}
                change="Average team score"
                trend="neutral"
                icon={<Zap className="h-6 w-6" />}
                gradient="bg-gradient-to-br from-green-500 to-emerald-600"
              />
              <MetricCard
                title="Avg Gap Time"
                value={teamReport ? `${Math.round(teamReport.teamMetrics.avgGapTime / 60)}m` : "-"}
                change="Between calls"
                trend="neutral"
                icon={<Timer className="h-6 w-6" />}
                gradient="bg-gradient-to-br from-yellow-500 to-orange-600"
                             />
             </div>
           </div>
           )}

           {/* Agent Analytics Tab */}
           {activeTab === 'agents' && (
             <div className="space-y-6">
               <AgentAnalyticsTable
                 agents={agentAnalyticsData}
                 isLoading={liveMetricsLoading}
                 onRefresh={refetchLiveMetrics}
                 searchTerm={searchTerm}
                 onSearchChange={setSearchTerm}
               />
             </div>
           )}

           {/* Performance Reports Tab */}
           {activeTab === 'performance' && (
             <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Team Performance Report
                </CardTitle>
              </CardHeader>
              <CardContent>
                {teamReportLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : teamReport ? (
                  <div className="space-y-6">
                    {/* Team Insights */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <h4 className="font-semibold text-blue-900">Total Agents</h4>
                        <p className="text-2xl font-bold text-blue-700">{teamReport.teamMetrics.totalAgents}</p>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg">
                        <h4 className="font-semibold text-green-900">Avg Productivity</h4>
                        <p className="text-2xl font-bold text-green-700">{Math.round(teamReport.teamMetrics.teamProductivityScore)}/100</p>
                      </div>
                      <div className="bg-orange-50 p-4 rounded-lg">
                        <h4 className="font-semibold text-orange-900">Avg Gap Time</h4>
                        <p className="text-2xl font-bold text-orange-700">{Math.round(teamReport.teamMetrics.avgGapTime / 60)}m</p>
                      </div>
                    </div>

                    {/* Team Insights */}
                    <div>
                      <h4 className="font-semibold mb-3">Performance Insights</h4>
                      <div className="space-y-2">
                        {teamReport.insights.map((insight, index) => (
                          <div key={index} className="flex items-center gap-2 text-sm text-gray-600">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            {insight}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Top Performers */}
                    {teamReport.agentRankings.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-3">Top Performers</h4>
                        <div className="space-y-2">
                          {teamReport.agentRankings.slice(0, 5).map((agent, index) => (
                            <div key={agent.agentId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                              <div className="flex items-center gap-3">
                                <Badge className="bg-yellow-100 text-yellow-800">#{agent.rank}</Badge>
                                <span className="font-medium">{agent.agentName}</span>
                              </div>
                              <div className="text-sm text-gray-600">
                                Score: {agent.metrics.productivityScore}/100
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <BarChart3 className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500">No performance data available</p>
                  </div>
                                 )}
               </CardContent>
                         </Card>
            </div>
          )}

          {/* Conversions Tab */}
          {activeTab === 'conversions' && (
            <div className="space-y-6">
              <ConversionsTable
                conversions={todayConversions || []}
                isLoading={conversionsLoading}
                onRefresh={refetchConversions}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 