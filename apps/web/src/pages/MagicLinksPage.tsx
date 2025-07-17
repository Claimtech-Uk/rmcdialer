import React, { useState, useEffect } from 'react';
import { Link, TrendingUp, Send, Clock, Eye, BarChart3, Filter, RefreshCw } from 'lucide-react';
import { apiClient } from '../lib/api-client';
import { useAuthStore } from '../store/auth';

interface MagicLinkAnalytics {
  totalSent: number;
  totalAccessed: number;
  accessRate: number;
  byType: Record<string, { sent: number; accessed: number; rate: number }>;
  byDeliveryMethod: Record<string, { sent: number; accessed: number; rate: number }>;
  byAgent: Array<{ agentId: number; agentName: string; sent: number; accessed: number; rate: number }>;
  recentActivity: Array<{
    id: string;
    userId: number;
    userName: string;
    linkType: string;
    sentAt: string;
    accessedAt: string | null;
    agentName: string;
  }>;
}

interface DateRange {
  startDate: string;
  endDate: string;
}

export const MagicLinksPage: React.FC = () => {
  const { agent } = useAuthStore();
  const [analytics, setAnalytics] = useState<MagicLinkAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [selectedAgent, setSelectedAgent] = useState<number | null>(null);
  const [selectedLinkType, setSelectedLinkType] = useState<string>('');

  useEffect(() => {
    loadAnalytics();
  }, [dateRange, selectedAgent, selectedLinkType]);

  const loadAnalytics = async () => {
    setIsLoading(true);
    try {
      const params: any = {
        startDate: new Date(dateRange.startDate).toISOString(),
        endDate: new Date(dateRange.endDate + 'T23:59:59').toISOString()
      };

      if (selectedAgent) {
        params.agentId = selectedAgent;
      }

      if (selectedLinkType) {
        params.linkType = selectedLinkType;
      }

      const queryString = new URLSearchParams(params).toString();
      const analytics = await apiClient.get(`/magic-links/analytics?${queryString}`) as any;
      
      setAnalytics(analytics);
    } catch (error) {
      console.error('Failed to load magic link analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const linkTypeLabels: Record<string, string> = {
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

  const StatCard: React.FC<{
    title: string;
    value: string | number;
    subtitle?: string;
    icon: React.ReactNode;
    trend?: number;
    color?: string;
  }> = ({ title, value, subtitle, icon, trend, color = 'blue' }) => (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-lg bg-${color}-100`}>
          <div className={`text-${color}-600`}>{icon}</div>
        </div>
      </div>
      {trend !== undefined && (
        <div className="mt-4 flex items-center">
          <TrendingUp className={`w-4 h-4 ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`} />
          <span className={`text-sm ml-1 ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend >= 0 ? '+' : ''}{trend}%
          </span>
          <span className="text-sm text-gray-500 ml-1">vs last period</span>
        </div>
      )}
    </div>
  );

  if (isLoading && !analytics) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading magic link analytics...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Link className="w-6 h-6 text-blue-600" />
          Magic Link Analytics
        </h1>
        <p className="text-gray-600 mt-1">
          Track magic link performance and agent activity
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters
          </h2>
          <button
            onClick={loadAnalytics}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-1 text-sm text-blue-600 hover:text-blue-700"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Link Type
            </label>
            <select
              value={selectedLinkType}
              onChange={(e) => setSelectedLinkType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">All Types</option>
              {Object.entries(linkTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Agent
            </label>
            <select
              value={selectedAgent || ''}
              onChange={(e) => setSelectedAgent(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">All Agents</option>
              {analytics?.byAgent.map((agentStat) => (
                <option key={agentStat.agentId} value={agentStat.agentId}>
                  {agentStat.agentName}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {analytics && (
        <>
          {/* Overview Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <StatCard
              title="Total Sent"
              value={analytics.totalSent.toLocaleString()}
              icon={<Send className="w-6 h-6" />}
              color="blue"
            />
            <StatCard
              title="Total Accessed"
              value={analytics.totalAccessed.toLocaleString()}
              icon={<Eye className="w-6 h-6" />}
              color="green"
            />
            <StatCard
              title="Access Rate"
              value={`${analytics.accessRate.toFixed(1)}%`}
              subtitle={`${analytics.totalAccessed} of ${analytics.totalSent} links`}
              icon={<TrendingUp className="w-6 h-6" />}
              color="purple"
            />
            <StatCard
              title="Pending"
              value={(analytics.totalSent - analytics.totalAccessed).toLocaleString()}
              icon={<Clock className="w-6 h-6" />}
              color="orange"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* By Link Type */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Performance by Link Type
              </h3>
              <div className="space-y-3">
                {Object.entries(analytics.byType).map(([type, stats]) => (
                  <div key={type}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-gray-700">
                        {linkTypeLabels[type] || type}
                      </span>
                      <span className="text-sm text-gray-600">
                        {stats.rate.toFixed(1)}% ({stats.accessed}/{stats.sent})
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${Math.max(stats.rate, 2)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* By Delivery Method */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Send className="w-5 h-5" />
                Performance by Delivery Method
              </h3>
              <div className="space-y-3">
                {Object.entries(analytics.byDeliveryMethod).map(([method, stats]) => (
                  <div key={method}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-gray-700">
                        {deliveryMethodLabels[method] || method}
                      </span>
                      <span className="text-sm text-gray-600">
                        {stats.rate.toFixed(1)}% ({stats.accessed}/{stats.sent})
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${Math.max(stats.rate, 2)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Agent Performance */}
          {agent?.role === 'supervisor' || agent?.role === 'admin' ? (
            <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
              <h3 className="font-semibold text-gray-900 mb-4">Agent Performance</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Agent</th>
                      <th className="text-right py-2 px-3 text-sm font-medium text-gray-700">Sent</th>
                      <th className="text-right py-2 px-3 text-sm font-medium text-gray-700">Accessed</th>
                      <th className="text-right py-2 px-3 text-sm font-medium text-gray-700">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.byAgent
                      .sort((a, b) => b.sent - a.sent)
                      .map((agentStat) => (
                      <tr key={agentStat.agentId} className="border-b border-gray-100">
                        <td className="py-2 px-3 text-sm text-gray-900">{agentStat.agentName}</td>
                        <td className="py-2 px-3 text-sm text-gray-600 text-right">{agentStat.sent}</td>
                        <td className="py-2 px-3 text-sm text-gray-600 text-right">{agentStat.accessed}</td>
                        <td className="py-2 px-3 text-sm text-gray-600 text-right">
                          <span className={`px-2 py-1 rounded text-xs ${
                            agentStat.rate >= 70 ? 'bg-green-100 text-green-800' :
                            agentStat.rate >= 50 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {agentStat.rate.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {/* Recent Activity */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Recent Activity
            </h3>
            {analytics.recentActivity.length > 0 ? (
              <div className="space-y-3">
                {analytics.recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{activity.userName}</span>
                        <span className="text-gray-500">•</span>
                        <span className="text-sm text-gray-600">
                          {linkTypeLabels[activity.linkType] || activity.linkType}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Sent by {activity.agentName} • {new Date(activity.sentAt).toLocaleString()}
                      </div>
                    </div>
                    <div className={`text-xs px-2 py-1 rounded ${
                      activity.accessedAt 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {activity.accessedAt ? (
                        <>Accessed {new Date(activity.accessedAt).toLocaleString()}</>
                      ) : (
                        'Pending'
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No recent activity found for the selected filters
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}; 