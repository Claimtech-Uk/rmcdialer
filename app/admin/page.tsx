'use client';

import Link from 'next/link';
import { api } from '@/lib/trpc/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/modules/core/components/ui/card';
import { Button } from '@/modules/core/components/ui/button';
import { Alert, AlertDescription } from '@/modules/core/components/ui/alert';
import { 
  Users, 
  Settings, 
  BarChart3, 
  Shield,
  Database,
  Activity,
  UserPlus,
  CheckCircle,
  XCircle,
  AlertTriangle,
  TrendingUp,
  Loader2,
  RotateCcw
} from 'lucide-react';

export default function AdminOverviewPage() {
  // Get system stats with proper error handling
  const { data: agentsData, isLoading: agentsLoading, error: agentsError } = api.auth.getAllAgents.useQuery({
    page: 1,
    limit: 100
  });

  const { data: queueStats, isLoading: queueLoading, error: queueError } = api.queue.getStats.useQuery();

  // Calculate system metrics
  const systemMetrics = {
    totalAgents: agentsData?.agents?.length || 0,
    activeAgents: agentsData?.agents?.filter(agent => agent.isActive)?.length || 0,
    adminAgents: agentsData?.agents?.filter(agent => agent.role === 'admin')?.length || 0,
    supervisorAgents: agentsData?.agents?.filter(agent => agent.role === 'supervisor')?.length || 0,
    regularAgents: agentsData?.agents?.filter(agent => agent.role === 'agent')?.length || 0,
    queuePending: queueStats?.queue?.pending || 0,
    queueAssigned: queueStats?.queue?.assigned || 0,
    queueCompletedToday: queueStats?.queue?.completedToday || 0
  };

  // Show loading state
  if (agentsLoading || queueLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm text-gray-500">Loading system data...</span>
          </div>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-4 w-4 bg-gray-200 rounded animate-pulse"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 w-16 bg-gray-200 rounded animate-pulse mb-1"></div>
                <div className="h-3 w-24 bg-gray-100 rounded animate-pulse"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Show error state
  if (agentsError || queueError) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
        </div>
        
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Failed to load admin dashboard data. Please check your database connection and try again.
            <details className="mt-2 text-xs">
              <summary>Error details:</summary>
              {agentsError?.message || queueError?.message || 'Unknown error'}
            </details>
          </AlertDescription>
        </Alert>

        <div className="flex flex-col sm:flex-row gap-4">
          <Button 
            onClick={() => window.location.reload()}
            size="default"
            responsive="nowrap"
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all duration-200"
          >
            <RotateCcw className="w-4 h-4 mr-2 flex-shrink-0" />
            Retry
          </Button>
          <Button 
            variant="outline" 
            asChild
            size="default"
            responsive="nowrap"
            className="border-slate-300 hover:bg-slate-100 shadow-md hover:shadow-lg transition-all duration-200"
          >
            <Link href="/admin/agents">
              <Users className="w-4 h-4 mr-2 flex-shrink-0" />
              Go to Agent Management
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  // Calculate metrics
  const totalAgents = systemMetrics.totalAgents;
  const activeAgents = systemMetrics.activeAgents;
  const adminAgents = systemMetrics.adminAgents;
  const supervisorAgents = systemMetrics.supervisorAgents;
  const regularAgents = systemMetrics.regularAgents;
  const onlineAgents = systemMetrics.activeAgents; // Assuming active agents are online for now
  const queueDepth = systemMetrics.queuePending + systemMetrics.queueAssigned;
  const queuePending = systemMetrics.queuePending;
  const queueAssigned = systemMetrics.queueAssigned;
  const queueCompletedToday = systemMetrics.queueCompletedToday;

  const quickActions = [
    {
      title: 'Manage Agents',
      description: 'Add, edit, or remove agents',
      href: '/admin/agents',
      icon: Users,
      color: 'bg-blue-50 text-blue-700 border-blue-200'
    },
    {
      title: 'System Settings',
      description: 'Configure system parameters',
      href: '/admin/settings',
      icon: Settings,
      color: 'bg-green-50 text-green-700 border-green-200'
    },
    {
      title: 'Queue Management',
      description: 'Monitor and manage call queues',
      href: '/queue/unsigned',
      icon: Activity,
      color: 'bg-purple-50 text-purple-700 border-purple-200'
    },
    {
      title: 'Analytics',
      description: 'View system performance',
      href: '/dashboard',
      icon: BarChart3,
      color: 'bg-orange-50 text-orange-700 border-orange-200'
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
        <Button asChild>
          <Link href="/admin/agents">
            <UserPlus className="w-4 h-4 mr-2" />
            Manage Agents
          </Link>
        </Button>
      </div>

      {/* System Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Agents */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Agents</CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAgents}</div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <CheckCircle className="w-3 h-3 text-green-500" />
              <span>{activeAgents} active</span>
            </div>
          </CardContent>
        </Card>

        {/* Online Agents */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Online Agents</CardTitle>
            <Activity className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{onlineAgents}</div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Available</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Queue Depth */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Queue Depth</CardTitle>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{queueDepth}</div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <TrendingUp className="w-3 h-3 text-yellow-500" />
              <span>{queuePending} pending</span>
            </div>
          </CardContent>
        </Card>

        {/* Today's Calls */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Calls Today</CardTitle>
            <CheckCircle className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{queueCompletedToday}</div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <CheckCircle className="w-3 h-3 text-green-500" />
              <span>Completed</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Agent Breakdown */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Agent Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Shield className="w-4 h-4 text-red-500" />
                <span className="text-sm font-medium">Administrators</span>
              </div>
              <span className="text-sm font-bold">{adminAgents}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-medium">Supervisors</span>
              </div>
              <span className="text-sm font-bold">{supervisorAgents}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium">Agents</span>
              </div>
              <span className="text-sm font-bold">{regularAgents}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Database className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium">Database</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-xs text-green-600">Connected</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Activity className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium">Queue System</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-xs text-green-600">Active</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Shield className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium">Authentication</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-xs text-green-600">Secure</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {quickActions.map((action) => (
              <Link key={action.href} href={action.href as any}>
                <div className={`relative group p-4 rounded-lg border-2 border-dashed transition-colors hover:border-solid ${action.color}`}>
                  <action.icon className="w-6 h-6 mb-2" />
                  <h3 className="font-medium mb-1">{action.title}</h3>
                  <p className="text-xs opacity-90">{action.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 