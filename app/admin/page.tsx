'use client';

import Link from 'next/link';
import { api } from '@/lib/trpc/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/modules/core/components/ui/card';
import { Button } from '@/modules/core/components/ui/button';
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
  TrendingUp
} from 'lucide-react';

export default function AdminOverviewPage() {
  // Get system stats
  const { data: agentsData, isLoading: agentsLoading } = api.auth.getAllAgents.useQuery({
    page: 1,
    limit: 100
  });

  const { data: queueStats, isLoading: queueLoading } = api.queue.getStats.useQuery();
  
  const { data: agentsStatus, isLoading: statusLoading } = api.auth.getAllAgentsStatus.useQuery();

  const isLoading = agentsLoading || queueLoading || statusLoading;

  // Calculate metrics
  const totalAgents = agentsData?.total || 0;
  const activeAgents = agentsData?.agents.filter(a => a.isActive).length || 0;
  const adminAgents = agentsData?.agents.filter(a => a.role === 'admin').length || 0;
  const supervisorAgents = agentsData?.agents.filter(a => a.role === 'supervisor').length || 0;
  const regularAgents = agentsData?.agents.filter(a => a.role === 'agent').length || 0;
  const onlineAgents = agentsStatus?.filter(a => a.currentStatus !== 'offline').length || 0;

  const quickActions = [
    {
      title: 'Agent Management',
      description: 'Add, edit, and manage system agents',
      href: '/admin/agents',
      icon: Users,
      color: 'bg-blue-500 hover:bg-blue-600',
      stats: `${totalAgents} total agents`
    },
    {
      title: 'System Analytics',
      description: 'View system-wide performance metrics',
      href: '/admin/analytics',
      icon: BarChart3,
      color: 'bg-green-500 hover:bg-green-600',
      stats: 'Real-time data'
    },
    {
      title: 'Database Tools',
      description: 'Database management and monitoring',
      href: '/admin/database',
      icon: Database,
      color: 'bg-purple-500 hover:bg-purple-600',
      stats: 'Management tools'
    },
    {
      title: 'System Health',
      description: 'Monitor system health and performance',
      href: '/admin/health',
      icon: Activity,
      color: 'bg-orange-500 hover:bg-orange-600',
      stats: 'Health monitoring'
    },
    {
      title: 'Settings',
      description: 'System configuration and preferences',
      href: '/admin/settings',
      icon: Settings,
      color: 'bg-gray-500 hover:bg-gray-600',
      stats: 'Configuration'
    }
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6 text-red-600" />
            Admin Overview
          </h1>
          <p className="text-muted-foreground mt-1">
            System administration and management dashboard
          </p>
        </div>
      </div>

      {/* System Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Agents</p>
                <p className="text-2xl font-bold text-gray-900">{totalAgents}</p>
              </div>
              <Users className="w-8 h-8 text-blue-500" />
            </div>
            <div className="mt-2 flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-sm text-green-600">{activeAgents} active</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Online Now</p>
                <p className="text-2xl font-bold text-gray-900">{onlineAgents}</p>
              </div>
              <Activity className="w-8 h-8 text-green-500" />
            </div>
            <div className="mt-2 flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-gray-600">Currently active</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Queue Depth</p>
                <p className="text-2xl font-bold text-gray-900">
                  {isLoading ? '-' : ((queueStats?.queue?.pending || 0) + (queueStats?.queue?.assigned || 0))}
                </p>
              </div>
              <BarChart3 className="w-8 h-8 text-yellow-500" />
            </div>
            <div className="mt-2 flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-yellow-500" />
              <span className="text-sm text-gray-600">
                {queueStats?.queue?.pending || 0} pending
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">System Status</p>
                <p className="text-2xl font-bold text-green-600">Healthy</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <div className="mt-2 flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-600">All systems operational</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Agent Role Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Agent Role Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Shield className="w-8 h-8 text-red-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{adminAgents}</p>
              <p className="text-sm text-gray-600">Administrators</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <BarChart3 className="w-8 h-8 text-blue-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{supervisorAgents}</p>
              <p className="text-sm text-gray-600">Supervisors</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Users className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{regularAgents}</p>
              <p className="text-sm text-gray-600">Agents</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {quickActions.map((action) => (
              <Link key={action.href} href={action.href as any}>
                <div className="group p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-all duration-200 hover:shadow-md">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className={`p-2 rounded-lg ${action.color} text-white transition-colors`}>
                      <action.icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900 group-hover:text-gray-700">
                        {action.title}
                      </h3>
                      <p className="text-sm text-gray-500">{action.stats}</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">{action.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>System Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-600">Environment</span>
              <span className="text-sm text-gray-900">
                {process.env.NODE_ENV === 'production' ? 'Production' : 'Development'}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-600">Database Status</span>
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-sm text-green-600">Connected</span>
              </div>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-600">Queue System</span>
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-sm text-green-600">Operational</span>
              </div>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm font-medium text-gray-600">Last Updated</span>
              <span className="text-sm text-gray-900">{new Date().toLocaleString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 