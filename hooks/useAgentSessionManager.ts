'use client';

import { useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/trpc/client';

interface AgentSessionManagerOptions {
  agentId: number;
  enabled?: boolean;
}

export function useAgentSessionManager({ agentId, enabled = true }: AgentSessionManagerOptions) {
  const lastStatusRef = useRef<string>('available');
  const cleanupSentRef = useRef<boolean>(false);
  
  const updateStatusMutation = api.auth.updateStatus.useMutation();

  // Send final offline signal using sendBeacon for reliability
  const sendOfflineSignal = useCallback((reason: string) => {
    if (cleanupSentRef.current) return;
    cleanupSentRef.current = true;

    const payload = JSON.stringify({
      agentId,
      deviceConnected: false,
      currentStatus: 'offline',
      metadata: { 
        reason,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent
      }
    });

    console.log(`🔚 Sending offline signal: ${reason}`);

    // Try sendBeacon first (most reliable for page unload)
    if (navigator.sendBeacon) {
      const sent = navigator.sendBeacon('/api/agent-heartbeat', payload);
      if (sent) {
        console.log('✅ Offline signal sent via sendBeacon');
        return;
      }
    }

    // Fallback to synchronous fetch for immediate scenarios
    try {
      fetch('/api/agent-heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true // Attempt to keep request alive during page unload
      });
      console.log('✅ Offline signal sent via fetch');
    } catch (error) {
      console.error('❌ Failed to send offline signal:', error);
    }
  }, [agentId]);

  // Update status immediately for user-initiated changes
  const updateStatusImmediate = useCallback((status: string, reason?: string) => {
    if (!enabled) return;
    
    lastStatusRef.current = status;
    updateStatusMutation.mutate({ 
      status: status as any
    });
  }, [enabled, updateStatusMutation]);

  useEffect(() => {
    if (!enabled) return;

    // 1. TAB CLOSE / BROWSER CLOSE - Most critical
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      console.log('🚪 Browser closing - sending offline signal');
      sendOfflineSignal('tab_closed');
      
      // Don't show confirmation dialog for agent status changes
      // Just ensure cleanup happens
    };

    // 2. PAGE VISIBILITY CHANGES - Tab switching, minimizing
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('👁️ Page hidden - agent potentially unavailable');
        updateStatusImmediate('break', 'page_hidden');
      } else {
        console.log('👁️ Page visible - agent potentially available');
        // Don't automatically set to available - let agent choose
        // updateStatusImmediate('available', 'page_visible');
      }
    };

    // 3. NETWORK CONNECTION CHANGES
    const handleOffline = () => {
      console.log('📡 Network offline - agent unavailable');
      updateStatusImmediate('offline', 'network_offline');
    };

    const handleOnline = () => {
      console.log('📡 Network online - agent needs to set status manually');
      // Don't auto-set to available, let agent decide
    };

    // 4. WINDOW FOCUS CHANGES - App losing focus
    const handleBlur = () => {
      console.log('🔍 Window lost focus - agent distracted');
      // Could set to 'busy' but might be too aggressive
      // updateStatusImmediate('busy', 'window_blur');
    };

    const handleFocus = () => {
      console.log('🔍 Window gained focus - agent attention back');
      // Don't automatically change status
    };

    // 5. PAGE UNLOAD - Final cleanup chance
    const handleUnload = () => {
      console.log('🔄 Page unloading - final cleanup');
      sendOfflineSignal('page_unload');
    };

    // 6. BROWSER FREEZE/CRASH DETECTION (via page lifecycle API)
    const handleFreeze = () => {
      console.log('🧊 Page frozen - agent temporarily unavailable');
      sendOfflineSignal('page_frozen');
    };

    const handleResume = () => {
      console.log('🔄 Page resumed from freeze');
      // Don't auto-set status, let agent decide
    };

    // 7. TAB MEMORY PRESSURE (page might be discarded)
    const handlePageHide = () => {
      console.log('💾 Page might be discarded - sending offline signal');
      sendOfflineSignal('page_discarded');
    };

    // Add event listeners
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('unload', handleUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    
    // Page Lifecycle API (if supported)
    if ('onfreeze' in document) {
      document.addEventListener('freeze', handleFreeze);
      document.addEventListener('resume', handleResume);
    }
    if ('onpagehide' in window) {
      window.addEventListener('pagehide', handlePageHide);
    }

    // Cleanup
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('unload', handleUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      
      if ('onfreeze' in document) {
        document.removeEventListener('freeze', handleFreeze);
        document.removeEventListener('resume', handleResume);
      }
      if ('onpagehide' in window) {
        window.removeEventListener('pagehide', handlePageHide);
      }
    };
  }, [enabled, sendOfflineSignal, updateStatusImmediate]);

  return {
    sendOfflineSignal,
    updateStatusImmediate
  };
}