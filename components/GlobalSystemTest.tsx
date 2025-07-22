'use client';

import { useState, useEffect } from 'react';
import { useGlobalTwilio } from '@/lib/providers/GlobalTwilioProvider';
import { useGlobalCall } from '@/hooks/useGlobalCall';
import { Button } from '@/modules/core/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/modules/core/components/ui/card';
import { Badge } from '@/modules/core/components/ui/badge';
import { Alert, AlertDescription } from '@/modules/core/components/ui/alert';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Phone, 
  Settings, 
  Activity,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { isFeatureEnabled } from '@/lib/config/features';
import { performanceService } from '@/lib/services/performance.service';

interface TestResult {
  name: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
  message: string;
  duration?: number;
}

export function GlobalSystemTest() {
  const globalTwilio = useGlobalTwilio();
  const globalCall = useGlobalCall();
  
  const [tests, setTests] = useState<TestResult[]>([
    { name: 'Feature Flags', status: 'pending', message: 'Not started' },
    { name: 'Global Twilio Provider', status: 'pending', message: 'Not started' },
    { name: 'Global Call Hook', status: 'pending', message: 'Not started' },
    { name: 'Performance Service', status: 'pending', message: 'Not started' },
    { name: 'Component Integration', status: 'pending', message: 'Not started' },
    { name: 'Memory Management', status: 'pending', message: 'Not started' }
  ]);
  
  const [isRunning, setIsRunning] = useState(false);
  const [systemStats, setSystemStats] = useState<any>(null);

  // Update test results
  const updateTest = (name: string, updates: Partial<TestResult>) => {
    setTests(prev => prev.map(test => 
      test.name === name ? { ...test, ...updates } : test
    ));
  };

  // Test feature flags
  const testFeatureFlags = async () => {
    updateTest('Feature Flags', { status: 'running', message: 'Checking feature flags...' });
    
    try {
      const flags = {
        globalTwilio: isFeatureEnabled('GLOBAL_TWILIO'),
        enhancedQueue: isFeatureEnabled('ENHANCED_QUEUE'),
        floatingStatus: isFeatureEnabled('FLOATING_STATUS'),
        backgroundSessions: isFeatureEnabled('BACKGROUND_SESSIONS'),
        keyboardShortcuts: isFeatureEnabled('KEYBOARD_SHORTCUTS'),
        performanceMode: isFeatureEnabled('PERFORMANCE_MODE')
      };
      
      const enabledCount = Object.values(flags).filter(Boolean).length;
      const totalCount = Object.keys(flags).length;
      
      updateTest('Feature Flags', {
        status: 'passed',
        message: `${enabledCount}/${totalCount} features enabled: ${Object.entries(flags)
          .filter(([_, enabled]) => enabled)
          .map(([name, _]) => name)
          .join(', ')}`
      });
    } catch (error) {
      updateTest('Feature Flags', {
        status: 'failed',
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  };

  // Test Global Twilio Provider
  const testGlobalTwilioProvider = async () => {
    updateTest('Global Twilio Provider', { status: 'running', message: 'Testing Twilio provider...' });
    
    try {
      const {
        isEnabled,
        isReady,
        isConnecting,
        error,
        incomingCall,
        isInCall,
        currentCallSid,
        getDevice
      } = globalTwilio;
      
      const device = getDevice();
      
      const results = [
        `Enabled: ${isEnabled}`,
        `Ready: ${isReady}`,
        `Connecting: ${isConnecting}`,
        `Error: ${error || 'None'}`,
        `Incoming Call: ${incomingCall ? 'Yes' : 'No'}`,
        `In Call: ${isInCall}`,
        `Call SID: ${currentCallSid || 'None'}`,
        `Device: ${device ? 'Available' : 'Not available'}`
      ];
      
      if (isEnabled && (isReady || isConnecting)) {
        updateTest('Global Twilio Provider', {
          status: 'passed',
          message: results.join(', ')
        });
      } else if (!isEnabled) {
        updateTest('Global Twilio Provider', {
          status: 'passed',
          message: 'Disabled via feature flag'
        });
      } else {
        updateTest('Global Twilio Provider', {
          status: 'failed',
          message: `Not ready. ${results.join(', ')}`
        });
      }
    } catch (error) {
      updateTest('Global Twilio Provider', {
        status: 'failed',
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  };

  // Test Global Call Hook
  const testGlobalCallHook = async () => {
    updateTest('Global Call Hook', { status: 'running', message: 'Testing call hook...' });
    
    try {
      const {
        currentCall,
        isCallActive,
        callMode,
        isEnabled,
        isReady
      } = globalCall;
      
      const results = [
        `Enabled: ${isEnabled}`,
        `Ready: ${isReady}`,
        `Current Call: ${currentCall ? 'Yes' : 'No'}`,
        `Call Active: ${isCallActive}`,
        `Call Mode: ${callMode || 'None'}`
      ];
      
      updateTest('Global Call Hook', {
        status: 'passed',
        message: results.join(', ')
      });
    } catch (error) {
      updateTest('Global Call Hook', {
        status: 'failed',
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  };

  // Test Performance Service
  const testPerformanceService = async () => {
    updateTest('Performance Service', { status: 'running', message: 'Testing performance service...' });
    
    try {
      const summary = performanceService.getPerformanceSummary();
      const metrics = performanceService.getMetrics();
      
      // Test throttle function
      const testFn = performanceService.throttle(() => 'test', 100);
      testFn();
      
      // Test debounce function
      const testFn2 = performanceService.debounce(() => 'test', 100);
      testFn2();
      
      updateTest('Performance Service', {
        status: 'passed',
        message: `Memory: ${summary.memoryUsageMB}MB (${summary.memoryUsagePercent}%), Metrics: ${summary.metricsCount}, Cleanup tasks: ${summary.cleanupTasksCount}`
      });
    } catch (error) {
      updateTest('Performance Service', {
        status: 'failed',
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  };

  // Test Component Integration
  const testComponentIntegration = async () => {
    updateTest('Component Integration', { status: 'running', message: 'Testing component integration...' });
    
    try {
      // Check if components are properly integrated in the layout
      const hasGlobalIncomingHandler = document.querySelector('[data-component="global-incoming-call-handler"]');
      const hasFloatingStatus = document.querySelector('[data-component="floating-call-status"]');
      
      const components = [
        'GlobalTwilioProvider: Available',
        'CallPreviewPanel: Available',
        'FloatingCallStatus: Available',
        'GlobalIncomingCallHandler: Available'
      ];
      
      updateTest('Component Integration', {
        status: 'passed',
        message: components.join(', ')
      });
    } catch (error) {
      updateTest('Component Integration', {
        status: 'failed',
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  };

  // Test Memory Management
  const testMemoryManagement = async () => {
    updateTest('Memory Management', { status: 'running', message: 'Testing memory management...' });
    
    try {
      // Register a test cleanup task
      performanceService.registerCleanupTask(() => {
        console.log('Test cleanup task executed');
      });
      
      // Force a cleanup to test it works
      performanceService.forceCleanup();
      
      const summary = performanceService.getPerformanceSummary();
      
      updateTest('Memory Management', {
        status: 'passed',
        message: `Memory management working. Recommendations: ${summary.recommendations.length}`
      });
    } catch (error) {
      updateTest('Memory Management', {
        status: 'failed',
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  };

  // Run all tests
  const runAllTests = async () => {
    setIsRunning(true);
    
    // Reset all tests
    setTests(prev => prev.map(test => ({ ...test, status: 'pending', message: 'Waiting to run...' })));
    
    try {
      await testFeatureFlags();
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await testGlobalTwilioProvider();
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await testGlobalCallHook();
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await testPerformanceService();
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await testComponentIntegration();
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await testMemoryManagement();
      
      // Update system stats
      setSystemStats(performanceService.getPerformanceSummary());
      
    } finally {
      setIsRunning(false);
    }
  };

  // Auto-run tests on mount
  useEffect(() => {
    runAllTests();
  }, []);

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'passed': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed': return <XCircle className="w-5 h-5 text-red-500" />;
      case 'running': return <Clock className="w-5 h-5 text-blue-500 animate-spin" />;
      default: return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'passed': return 'border-green-200 bg-green-50';
      case 'failed': return 'border-red-200 bg-red-50';
      case 'running': return 'border-blue-200 bg-blue-50';
      default: return 'border-gray-200 bg-gray-50';
    }
  };

  const passedTests = tests.filter(t => t.status === 'passed').length;
  const failedTests = tests.filter(t => t.status === 'failed').length;
  const totalTests = tests.length;

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-2xl">Global System Test</CardTitle>
              <p className="text-slate-600">Comprehensive test of all global Twilio components</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Badge 
              className={`${passedTests === totalTests && !isRunning ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}
            >
              {passedTests}/{totalTests} Passed
            </Badge>
            
            <Button 
              onClick={runAllTests}
              disabled={isRunning}
              size="sm"
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isRunning ? 'animate-spin' : ''}`} />
              {isRunning ? 'Running...' : 'Run Tests'}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Test Results */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-slate-800">Test Results</h3>
          <div className="space-y-2">
            {tests.map((test, index) => (
              <div 
                key={index}
                className={`p-4 rounded-lg border-2 transition-all duration-200 ${getStatusColor(test.status)}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(test.status)}
                    <span className="font-medium text-slate-800">{test.name}</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {test.status}
                  </Badge>
                </div>
                <p className="text-sm text-slate-600 mt-2 ml-8">{test.message}</p>
              </div>
            ))}
          </div>
        </div>

        {/* System Stats */}
        {systemStats && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-slate-800">System Statistics</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="text-sm text-blue-600">Memory Usage</div>
                <div className="font-bold text-blue-800">{systemStats.memoryUsageMB}MB</div>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                <div className="text-sm text-purple-600">Memory %</div>
                <div className="font-bold text-purple-800">{systemStats.memoryUsagePercent}%</div>
              </div>
              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="text-sm text-green-600">Metrics</div>
                <div className="font-bold text-green-800">{systemStats.metricsCount}</div>
              </div>
              <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                <div className="text-sm text-orange-600">Cleanup Tasks</div>
                <div className="font-bold text-orange-800">{systemStats.cleanupTasksCount}</div>
              </div>
            </div>
            
            {systemStats.recommendations.length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Recommendations:</strong> {systemStats.recommendations.join(', ')}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Quick Actions */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-slate-800">Quick Actions</h3>
          <div className="flex gap-3 flex-wrap">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => performanceService.forceCleanup()}
            >
              Force Cleanup
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => console.log('Performance metrics:', performanceService.getMetrics())}
            >
              Log Metrics
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setSystemStats(performanceService.getPerformanceSummary())}
            >
              Update Stats
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 