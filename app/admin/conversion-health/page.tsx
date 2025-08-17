'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/modules/core/components/ui/card';
import { Button } from '@/modules/core/components/ui/button';
import { Badge } from '@/modules/core/components/ui/badge';
import { Alert, AlertDescription } from '@/modules/core/components/ui/alert';

interface ConversionHealth {
  totalTransitions: number;
  totalLeaks: number;
  totalRecovered: number;
  recoveryRate: number;
  avgExecutionTime: number;
}

interface LeakDetectionResult {
  potentialLeaks: number;
  recovered: number;
  unrecovered: number;
  executionTimeMs: number;
  timestamp: string;
}

interface RecentTransition {
  user_id: string;
  from_queue: string | null;
  to_queue: string | null;
  reason: string;
  source: string;
  conversion_logged: boolean;
  timestamp: string;
}

interface PotentialLeak {
  user_id: string;
  from_queue: string;
  to_queue: string | null;
  timestamp: string;
  source: string;
  leak_type: string;
}

export default function ConversionHealthPage() {
  const [health, setHealth] = useState<ConversionHealth | null>(null);
  const [currentStatus, setCurrentStatus] = useState<LeakDetectionResult | null>(null);
  const [recentTransitions, setRecentTransitions] = useState<RecentTransition[]>([]);
  const [potentialLeaks, setPotentialLeaks] = useState<PotentialLeak[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'transitions' | 'leaks' | 'system'>('overview');

  // Fetch health data
  const fetchHealthData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/conversion-leak-monitor');
      const data = await response.json();
      
      if (data.success) {
        setHealth(data.data.health);
        setCurrentStatus(data.data.currentStatus);
        setLastUpdate(new Date());
      }
    } catch (error) {
      console.error('Failed to fetch health data:', error);
    }
  };

  // Fetch recent transitions
  const fetchRecentTransitions = async () => {
    try {
      const response = await fetch('/api/admin/queue-transitions/recent');
      const data = await response.json();
      
      if (data.success) {
        setRecentTransitions(data.transitions);
      }
    } catch (error) {
      console.error('Failed to fetch recent transitions:', error);
    }
  };

  // Fetch potential leaks
  const fetchPotentialLeaks = async () => {
    try {
      const response = await fetch('/api/admin/queue-transitions/leaks');
      const data = await response.json();
      
      if (data.success) {
        setPotentialLeaks(data.leaks);
      }
    } catch (error) {
      console.error('Failed to fetch potential leaks:', error);
    } finally {
      setLoading(false);
    }
  };

  // Manual leak detection
  const runManualDetection = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/conversion-leak-monitor', {
        method: 'POST'
      });
      const data = await response.json();
      
      if (data.success) {
        setCurrentStatus(data.data);
        await fetchHealthData();
        await fetchPotentialLeaks();
      }
    } catch (error) {
      console.error('Failed to run manual detection:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthData();
    fetchRecentTransitions();
    fetchPotentialLeaks();
    
    // Auto-refresh every 2 minutes
    const interval = setInterval(() => {
      fetchHealthData();
      fetchPotentialLeaks();
    }, 2 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  const getHealthStatus = () => {
    if (!health) return 'unknown';
    if (health.recoveryRate >= 95) return 'excellent';
    if (health.recoveryRate >= 85) return 'good';
    if (health.recoveryRate >= 70) return 'warning';
    return 'critical';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'bg-green-500';
      case 'good': return 'bg-blue-500';
      case 'warning': return 'bg-yellow-500';
      case 'critical': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">🔍 Conversion Tracking Health</h1>
          <p className="text-gray-600 mt-2">Monitor and detect conversion tracking leaks in real-time</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={runManualDetection} disabled={loading}>
            {loading ? 'Scanning...' : '🔍 Run Detection'}
          </Button>
          <Button variant="outline" onClick={fetchHealthData}>
            🔄 Refresh
          </Button>
        </div>
      </div>

      {lastUpdate && (
        <p className="text-sm text-gray-500">
          Last updated: {lastUpdate.toLocaleTimeString()}
        </p>
      )}

      {/* Health Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${getStatusColor(getHealthStatus())}`} />
              <span className="text-2xl font-bold">
                {health?.recoveryRate.toFixed(1) || '0'}%
              </span>
            </div>
            <p className="text-xs text-gray-600 mt-1">Recovery Rate</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Current Scan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {currentStatus?.potentialLeaks || 0}
            </div>
            <p className="text-xs text-gray-600 mt-1">Potential Leaks Found</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Auto-Recovered</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {currentStatus?.recovered || 0}
            </div>
            <p className="text-xs text-gray-600 mt-1">Conversions Recovered</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">⚠️ Unrecovered</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {currentStatus?.unrecovered || 0}
            </div>
            <p className="text-xs text-gray-600 mt-1">Need Investigation</p>
          </CardContent>
        </Card>
      </div>

      {/* Navigation */}
      <div className="flex space-x-4 border-b">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-2 px-1 ${activeTab === 'overview' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('transitions')}
          className={`pb-2 px-1 ${activeTab === 'transitions' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}
        >
          Recent Transitions
        </button>
        <button
          onClick={() => setActiveTab('leaks')}
          className={`pb-2 px-1 ${activeTab === 'leaks' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}
        >
          Potential Leaks
        </button>
        <button
          onClick={() => setActiveTab('system')}
          className={`pb-2 px-1 ${activeTab === 'system' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}
        >
          System Status
        </button>
      </div>

      {/* Content Sections */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>24-Hour Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-lg font-semibold">{health?.totalTransitions || 0}</div>
                  <div className="text-sm text-gray-600">Total Transitions</div>
                </div>
                <div>
                  <div className="text-lg font-semibold">{health?.totalLeaks || 0}</div>
                  <div className="text-sm text-gray-600">Leaks Detected</div>
                </div>
                <div>
                  <div className="text-lg font-semibold">{health?.totalRecovered || 0}</div>
                  <div className="text-sm text-gray-600">Auto-Recovered</div>
                </div>
                <div>
                  <div className="text-lg font-semibold">{health?.avgExecutionTime.toFixed(0) || 0}ms</div>
                  <div className="text-sm text-gray-600">Avg Detection Time</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'transitions' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Queue Transitions</CardTitle>
              <p className="text-sm text-gray-600">All queue changes in the last 24 hours</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {recentTransitions.length === 0 ? (
                  <p className="text-gray-500">No recent transitions (or data not available)</p>
                ) : (
                  recentTransitions.map((transition, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                      <div className="flex items-center space-x-3">
                        <Badge variant={transition.conversion_logged ? 'success' : 'secondary'}>
                          User {transition.user_id}
                        </Badge>
                        <span className="text-sm">
                          {transition.from_queue || 'null'} → {transition.to_queue || 'null'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-gray-500">{transition.source}</span>
                        {transition.conversion_logged ? (
                          <Badge className="bg-green-100 text-green-800">✓ Tracked</Badge>
                        ) : (
                          <Badge variant="outline">⚠ Not Tracked</Badge>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'leaks' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>🚨 Potential Conversion Leaks</CardTitle>
              <p className="text-sm text-gray-600">Queue transitions that may have missed conversion tracking</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {potentialLeaks.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-green-600 text-2xl mb-2">🎉</div>
                    <p className="text-green-600 font-medium">No potential leaks detected!</p>
                    <p className="text-sm text-gray-500">System is healthy</p>
                  </div>
                ) : (
                  potentialLeaks.map((leak, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded">
                      <div className="flex items-center space-x-3">
                        <Badge variant="destructive">User {leak.user_id}</Badge>
                        <span className="text-sm font-medium">
                          {leak.from_queue} → {leak.to_queue || 'null'}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {leak.leak_type}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-gray-500">{leak.source}</span>
                        <span className="text-xs text-gray-500">
                          {new Date(leak.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'system' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium">✅ Active Components</h4>
                  <ul className="text-sm space-y-1 text-gray-600">
                    <li>• Universal Queue Transition Service</li>
                    <li>• Real-time Leak Detection</li>
                    <li>• Database Audit Triggers</li>
                    <li>• Conversion Recovery System</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">📊 Monitoring Views</h4>
                  <ul className="text-sm space-y-1 text-gray-600">
                    <li>• recent_queue_transitions</li>
                    <li>• potential_conversion_leaks</li>
                    <li>• conversion_tracking_health</li>
                    <li>• queue_transition_audit</li>
                  </ul>
                </div>
              </div>
              
              <div className="pt-4 border-t">
                <h4 className="font-medium mb-2">🎯 Next Steps</h4>
                <ul className="text-sm space-y-1 text-gray-600">
                  <li>1. Deploy Layer 3 (Batch Recovery) for historical cleanup</li>
                  <li>2. Deploy Layer 4 (Advanced Health Dashboard) for detailed analytics</li>
                  <li>3. Set up Slack/email alerts for critical leaks</li>
                  <li>4. Run historical backfill for past 30 days</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
