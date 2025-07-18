'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/trpc/client';
import { 
  Link2, 
  TrendingUp, 
  Send, 
  Clock, 
  Eye, 
  BarChart3, 
  Filter, 
  RefreshCw,
  Users
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
import type { MagicLinkType, MagicLinkAnalytics } from '@/modules/communications';

interface DateRange {
  startDate: string;
  endDate: string;
}

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: number;
  className?: string;
}

function StatCard({ title, value, subtitle, icon, trend, className = "" }: StatCardProps) {
  return (
    <Card className={className}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="p-3 rounded-lg bg-primary/10">
            <div className="text-primary">{icon}</div>
          </div>
        </div>
        {trend && (
          <div className="mt-4 flex items-center">
            <TrendingUp className="mr-1 h-4 w-4 text-green-500" />
            <span className="text-sm text-green-500">+{trend}% from last month</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function MagicLinksPage() {
  const [analytics, setAnalytics] = useState<MagicLinkAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [linkTypeFilter, setLinkTypeFilter] = useState<MagicLinkType | 'all'>('all');
  
  const { toast } = useToast();

  // Fetch analytics data
  const { data: analyticsData, refetch, isError } = api.communications.magicLinks.getAnalytics.useQuery({
    startDate: new Date(dateRange.startDate),
    endDate: new Date(dateRange.endDate),
    linkType: linkTypeFilter === 'all' ? undefined : linkTypeFilter
  }, {
    onError: (error) => {
      toast({
        title: "Failed to load analytics",
        description: error.message,
        variant: "destructive",
      });
      setIsLoading(false);
    }
  });

  useEffect(() => {
    if (analyticsData) {
      // Convert Date objects to strings for display
      const processedAnalytics: MagicLinkAnalytics = {
        ...analyticsData,
        recentActivity: analyticsData.recentActivity.map(activity => ({
          ...activity,
          sentAt: activity.sentAt instanceof Date ? activity.sentAt : new Date(activity.sentAt),
          accessedAt: activity.accessedAt instanceof Date ? activity.accessedAt : (activity.accessedAt ? new Date(activity.accessedAt) : null)
        }))
      };
      setAnalytics(processedAnalytics);
      setIsLoading(false);
    }
  }, [analyticsData]);

  const linkTypeLabels: Record<MagicLinkType, string> = {
    claimPortal: 'Claim Portal',
    documentUpload: 'Document Upload',
    claimCompletion: 'Complete Claim',
    requirementReview: 'Review Requirements',
    statusUpdate: 'Status Update',
    firstLogin: 'First Login',
    profileUpdate: 'Profile Update'
  };

  const deliveryMethodLabels: Record<string, string> = {
    sms: 'SMS',
    whatsapp: 'WhatsApp',
    email: 'Email'
  };

  const handleRefresh = () => {
    setIsLoading(true);
    refetch();
  };

  const handleDateRangeChange = (field: keyof DateRange, value: string) => {
    setDateRange(prev => ({ ...prev, [field]: value }));
  };

  if (isError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <div className="text-red-500 mb-4">
              <BarChart3 className="h-12 w-12 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to Load Analytics</h3>
            <p className="text-gray-600 mb-4">
              We couldn't load the magic link analytics data. Please try again.
            </p>
            <Button onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Magic Link Analytics</h1>
          <p className="text-gray-600 mt-1">
            Monitor magic link performance and user engagement
          </p>
        </div>
        <Button onClick={handleRefresh} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Start Date
              </label>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => handleDateRangeChange('startDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                End Date
              </label>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => handleDateRangeChange('endDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Link Type
              </label>
              <Select value={linkTypeFilter} onValueChange={(value: MagicLinkType | 'all') => setLinkTypeFilter(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Link Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Link Types</SelectItem>
                  {Object.entries(linkTypeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={handleRefresh} className="w-full">
                Apply Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading analytics...</p>
          </div>
        </div>
      )}

      {/* Analytics Content */}
      {!isLoading && analytics && (
        <>
          {/* Overview Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <StatCard
              title="Total Sent"
              value={analytics.totalSent.toLocaleString()}
              subtitle="Magic links sent"
              icon={<Send className="h-6 w-6" />}
              trend={12}
            />
            <StatCard
              title="Total Accessed"
              value={analytics.totalAccessed.toLocaleString()}
              subtitle="Links clicked"
              icon={<Eye className="h-6 w-6" />}
              trend={8}
            />
            <StatCard
              title="Access Rate"
              value={`${analytics.accessRate.toFixed(1)}%`}
              subtitle="Click-through rate"
              icon={<TrendingUp className="h-6 w-6" />}
              trend={3}
            />
            <StatCard
              title="Active Links"
              value="247"
              subtitle="Currently active"
              icon={<Link2 className="h-6 w-6" />}
            />
          </div>

          {/* Performance by Link Type */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Performance by Link Type
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(analytics.byType).map(([type, stats]) => (
                  <div key={type} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">
                        {linkTypeLabels[type as MagicLinkType] || type}
                      </h4>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-sm text-gray-600">
                          {stats.sent} sent
                        </span>
                        <span className="text-sm text-gray-600">
                          {stats.accessed} accessed
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-gray-900">
                        {stats.rate.toFixed(1)}%
                      </div>
                      <div className="text-sm text-gray-600">success rate</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Performance by Delivery Method */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Delivery Method Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(analytics.byDeliveryMethod).map(([method, stats]) => (
                    <div key={method} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {method === 'sms' && <Send className="h-4 w-4 text-green-600" />}
                        {method === 'whatsapp' && <Send className="h-4 w-4 text-green-600" />}
                        {method === 'email' && <Send className="h-4 w-4 text-blue-600" />}
                        <span className="font-medium">
                          {deliveryMethodLabels[method] || method}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">{stats.rate.toFixed(1)}%</div>
                        <div className="text-sm text-gray-600">
                          {stats.accessed}/{stats.sent}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Top Performing Agents */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Top Performing Agents
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics.byAgent.slice(0, 5).map((agent, index) => (
                    <div key={agent.agentId} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-blue-800">
                            #{index + 1}
                          </span>
                        </div>
                        <span className="font-medium">{agent.agentName}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">{agent.rate.toFixed(1)}%</div>
                        <div className="text-sm text-gray-600">
                          {agent.accessed}/{agent.sent}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analytics.recentActivity.slice(0, 10).map((activity) => (
                  <div key={activity.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                      <div>
                        <p className="font-medium text-sm">
                          {activity.userName} • {linkTypeLabels[activity.linkType as MagicLinkType] || activity.linkType}
                        </p>
                        <p className="text-xs text-gray-600">
                          Sent by {activity.agentName}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant={activity.accessedAt ? "default" : "secondary"}>
                        {activity.accessedAt ? 'Accessed' : 'Pending'}
                      </Badge>
                      <p className="text-xs text-gray-600 mt-1">
                        {new Date(activity.sentAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
} 