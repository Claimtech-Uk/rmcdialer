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

  // 🚀 CRITICAL: Regular heartbeat interval - THE MISSING PIECE!
  useEffect(() => {
    if (!enabled) return;

    console.log('💓 Starting regular heartbeat interval for agent', agentId);

    // Send initial heartbeat immediately
    const sendHeartbeat = async (reason = 'regular_interval') => {
      try {
        const response = await fetch('/api/agent-heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentId,
            deviceConnected: true,
            currentStatus: lastStatusRef.current,
            metadata: {
              reason,
              timestamp: new Date().toISOString(),
              userAgent: navigator.userAgent
            }
          })
        });

        if (response.ok) {
          console.log(`💓 Heartbeat sent successfully: ${reason}`);
        } else {
          console.warn(`⚠️ Heartbeat failed: ${reason}`, response.status);
        }
      } catch (error) {
        console.error(`❌ Heartbeat error: ${reason}`, error);
      }
    };

    // Send initial heartbeat
    sendHeartbeat('interval_start');

    // Set up regular heartbeat interval (every 2 minutes - well within 5 minute timeout)
    const heartbeatInterval = setInterval(() => {
      sendHeartbeat('regular_interval');
    }, 2 * 60 * 1000); // 2 minutes

    return () => {
      console.log('💓 Stopping heartbeat interval for agent', agentId);
      clearInterval(heartbeatInterval);
    };
  }, [agentId, enabled]);

  // 🚀 AVAILABILITY-PRESERVING: Session recovery on page load/navigation
  useEffect(() => {
    if (!enabled) return;

    // Check if we need to recover agent status on page load
    const recoverAgentSession = async () => {
      try {
        console.log('🔄 Checking for session recovery on page load...');
        
        // Send heartbeat to check current status and potentially restore session
        const response = await fetch('/api/agent-heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentId,
            deviceConnected: true,
            currentStatus: 'available', // Try to restore to available
            metadata: {
              reason: 'session_recovery_page_load',
              timestamp: new Date().toISOString(),
              userAgent: navigator.userAgent
            }
          })
        });
        
        if (response.ok) {
          console.log('✅ Session recovery heartbeat sent successfully');
          lastStatusRef.current = 'available';
        } else {
          console.warn('⚠️ Session recovery heartbeat failed, will retry');
        }
      } catch (error) {
        console.error('❌ Session recovery failed:', error);
      }
    };

    // Trigger recovery on mount
    recoverAgentSession();

    // 🎯 FIXED: TAB CLOSE / BROWSER CLOSE - Less aggressive, preserve session
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      console.log('🚪 Browser closing - checking for active calls before cleanup');
      
      // 🚀 AVAILABILITY-PRESERVING: Check for active calls before sending offline signal
      const hasActiveCall = 
        (window as any).twilioDevice?.state === 'connected' ||
        document.querySelector('[data-call-active="true"]') ||
        document.querySelector('.call-interface')?.getAttribute('data-in-call') === 'true';
      
      if (hasActiveCall) {
        console.log('📞 Active call detected - NOT sending offline signal on tab close');
        // Don't set offline if agent is on a call - let the call system handle it
        return;
      }
      
      // For regular tab closes without active calls, use break instead of offline
      // This allows easier recovery when agent returns
      console.log('🔄 Setting to break (not offline) for easier session recovery');
      updateStatusImmediate('break', 'tab_closed');
    };

      // 🎯 FIXED: PAGE VISIBILITY CHANGES - Tab switching, minimizing
  const handleVisibilityChange = () => {
    if (document.hidden) {
      console.log('👁️ Page hidden - checking if agent can go on break');
      
      // 🚨 CRITICAL FIX: Don't set to break if agent is currently on a call
      // Check for active call indicators in the DOM or global state
      const hasActiveCall = 
        // Check for Twilio device connection state
        (window as any).twilioDevice?.state === 'connected' ||
        // Check for active call UI indicators
        document.querySelector('[data-call-active="true"]') ||
        // Check for any element indicating call in progress
        document.querySelector('.call-interface')?.getAttribute('data-in-call') === 'true';
      
      if (hasActiveCall) {
        console.log('📞 Active call detected - NOT setting to break during page visibility change');
        return; // Don't change status during active calls
      }
      
      console.log('📱 No active call detected - setting to break for page hidden');
      updateStatusImmediate('break', 'page_hidden');
    } else {
      console.log('👁️ Page visible - agent potentially available');
      // Don't automatically set to available - let agent choose
      // updateStatusImmediate('available', 'page_visible');
    }
  };

    // 🎯 FIXED: NETWORK CONNECTION CHANGES - Preserve availability preference
    const handleOffline = () => {
      console.log('📡 Network offline - marking as break instead of offline to preserve session');
      // 🚀 AVAILABILITY-PRESERVING: Use 'break' instead of 'offline' for temporary network issues
      // This preserves the agent session and allows automatic recovery when network returns
      updateStatusImmediate('break', 'network_offline');
    };

    const handleOnline = () => {
      console.log('📡 Network online - attempting to restore agent availability');
      // 🚀 AVAILABILITY-PRESERVING: Try to restore available status when network returns
      // Only do this if we were previously on break due to network issues
      if (lastStatusRef.current === 'break') {
        console.log('🔄 Restoring available status after network recovery');
        updateStatusImmediate('available', 'network_restored');
      }
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