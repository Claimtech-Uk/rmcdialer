'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/trpc/client';
import { getTeamConfig } from '@/lib/config/teams';
import { useToast } from '@/modules/core/hooks/use-toast';
import { AutoDiallerService } from '../services';
import type { 
  AutoDiallerState, 
  AutoDiallerSettings,
  AutoDiallerSessionStats,
  AutoDiallerQueueContext,
  UseAutoDiallerOptions,
  UseAutoDiallerReturn
} from '../types';
import type { UserCallContext, CallOutcomeOptions } from '@/modules/calls/types/call.types';

// Create service instance
const logger = {
  info: (message: string, meta?: any) => console.log(`[AutoDialler] ${message}`, meta),
  error: (message: string, error?: any) => console.error(`[AutoDialler ERROR] ${message}`, error),
  warn: (message: string, meta?: any) => console.warn(`[AutoDialler WARN] ${message}`, meta)
};

const autoDiallerService = new AutoDiallerService({ logger });

export function useAutoDialler(options: UseAutoDiallerOptions): UseAutoDiallerReturn {
  const { teamType, settings: initialSettings, onStateChange, onUserLoaded, onCallComplete, onSessionEnd, onError } = options;
  const { toast } = useToast();
  const teamConfig = getTeamConfig(teamType);

  // Core state
  const [state, setState] = useState<AutoDiallerState>('ready');
  const [currentUser, setCurrentUser] = useState<UserCallContext | null>(null);
  const [queueContext, setQueueContext] = useState<AutoDiallerQueueContext | null>(null);
  const [currentQueueEntryId, setCurrentQueueEntryId] = useState<string | null>(null);
  const [sessionStats, setSessionStats] = useState<AutoDiallerSessionStats>({
    callsCompleted: 0,
    successfulContacts: 0,
    startTime: new Date(),
    sessionDuration: 0,
    completionRate: 0
  });
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Refs for stable callbacks
  const stateRef = useRef(state);
  const sessionStatsRef = useRef(sessionStats);
  
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    sessionStatsRef.current = sessionStats;
  }, [sessionStats]);

  // API queries and mutations
  const { data: session } = api.auth.me.useQuery();
  const { data: queueStats } = api.queue.getStats.useQuery(undefined, {
    refetchInterval: 30000,
    enabled: isActive
  });
  const { data: settings, refetch: refetchSettings } = api.autoDialer.getSettings.useQuery();

  // Queue operations
  const getNextUserMutation = api.queue.getNextUserForCall.useMutation();
  const skipUserMutation = api.queue.skipUser.useMutation();
  const markUserCompletedMutation = api.queue.markUserCompleted.useMutation();
  const startSessionMutation = api.autoDialer.startSession.useMutation();
  const endSessionMutation = api.autoDialer.endSession.useMutation();
  const updateSettingsMutation = api.autoDialer.updateSettings.useMutation();
  const updateSessionStatsMutation = api.autoDialer.updateSessionStats.useMutation();

  // State transition helper
  const transitionTo = useCallback((newState: AutoDiallerState, reason?: string) => {
    if (!autoDiallerService.canTransitionTo(stateRef.current, newState)) {
      logger.warn(`Invalid state transition from ${stateRef.current} to ${newState}`, { reason });
      return false;
    }

    logger.info(`State transition: ${stateRef.current} → ${newState}`, { reason });
    setState(newState);
    
    // Call the state change callback
    onStateChange?.(newState);
    
    return true;
  }, [onStateChange]);

  // Update session stats helper
  const updateStats = useCallback((updates: Partial<AutoDiallerSessionStats>) => {
    setSessionStats(prev => {
      const updated = { ...prev, ...updates };
      // Recalculate computed fields
      const now = new Date();
      updated.sessionDuration = Math.round((now.getTime() - updated.startTime.getTime()) / (1000 * 60));
      updated.completionRate = updated.callsCompleted > 0 ? 
        (updated.successfulContacts / updated.callsCompleted) * 100 : 0;
      
      return updated;
    });
  }, []);

  // Load next user from queue
  const loadNextUser = useCallback(async () => {
    if (!transitionTo('loading', 'Loading next user from queue')) return;

    try {
      setError(null);
      const result = await getNextUserMutation.mutateAsync({ queueType: teamConfig.queueType });
      
      if (result) {
        setCurrentUser(result.userContext);
        setCurrentQueueEntryId(result.queueEntryId); // Store queue entry ID for skip/complete operations
        
                 // Generate queue context
         const context = autoDiallerService.generateQueueContext(
           teamType,
           (queueStats?.queue?.pending || 0) + (queueStats?.queue?.assigned || 0) + (queueStats?.queue?.completedToday || 0),
           queueStats?.queue?.pending || 0
         );
        setQueueContext(context);

        transitionTo('user_loaded', `Loaded user: ${result.userContext.firstName} ${result.userContext.lastName}`);

        // Notify callback
        onUserLoaded?.({
          userContext: result.userContext,
          queueContext: context,
          isAutoDialling: isActive,
          diallerState: 'user_loaded'
        });

        autoDiallerService.logActivity('User loaded', session?.agent?.id || 0, teamType, {
          userId: result.userContext.userId,
          userName: `${result.userContext.firstName} ${result.userContext.lastName}`
        });

      } else {
        // No users available
        transitionTo('paused', 'No more users in queue');
        setCurrentUser(null);
        setCurrentQueueEntryId(null);
        setQueueContext(null);
        
        toast({
          title: "Queue Empty",
          description: `No more users available in ${teamConfig.displayName} queue`,
        });
      }
    } catch (err: any) {
      const error = new Error(`Failed to load next user: ${err.message}`);
      setError(error);
      transitionTo('paused', `Error loading user: ${err.message}`);
      onError?.(error);
      
      toast({
        title: "Error Loading User",
        description: err.message,
        variant: "destructive"
      });
      
      autoDiallerService.logError('Failed to load next user', session?.agent?.id || 0, teamType, err);
    }
  }, [transitionTo, getNextUserMutation, teamConfig, teamType, queueStats, autoDiallerService, onUserLoaded, isActive, session, onError, toast]);

  // Skip current user and load next
  const skipUser = useCallback(async () => {
    if (currentUser && currentQueueEntryId) {
      // Mark current user as skipped in queue
      try {
        await skipUserMutation.mutateAsync({
          queueEntryId: currentQueueEntryId,
          queueType: teamConfig.queueType
        });

        autoDiallerService.logActivity('User skipped', session?.agent?.id || 0, teamType, {
          userId: currentUser.userId,
          userName: `${currentUser.firstName} ${currentUser.lastName}`
        });
        
        toast({
          title: "User Skipped",
          description: `Skipped ${currentUser.firstName} ${currentUser.lastName}`,
        });
      } catch (err: any) {
        toast({
          title: "Error Skipping User",
          description: err.message,
          variant: "destructive"
        });
      }
    }
    
    setCurrentUser(null);
    setCurrentQueueEntryId(null);
    await loadNextUser();
  }, [currentUser, currentQueueEntryId, teamConfig, session, teamType, loadNextUser, toast, autoDiallerService, skipUserMutation]);

  // Handle call completion
  const handleCallComplete = useCallback(async (outcome: CallOutcomeOptions) => {
    if (!transitionTo('disposing', `Call completed with outcome: ${outcome.outcomeType}`)) return;

    const isSuccessful = autoDiallerService.isSuccessfulContact(outcome.outcomeType);
    
    // Update stats
    updateStats({
      callsCompleted: sessionStatsRef.current.callsCompleted + 1,
      successfulContacts: sessionStatsRef.current.successfulContacts + (isSuccessful ? 1 : 0),
      lastCallAt: new Date()
    });

    // Update session stats in database
    try {
      await updateSessionStatsMutation.mutateAsync({
        callsCompleted: 1,
        lastCallAt: new Date()
      });
    } catch (err) {
      logger.warn('Failed to update session stats in database', err);
    }

    // Log the completion
    autoDiallerService.logActivity('Call completed', session?.agent?.id || 0, teamType, {
      userId: currentUser?.userId,
      outcome: outcome.outcomeType,
      isSuccessful
    });

    // Call the completion callback
    onCallComplete?.(outcome);

    // Mark user as completed in queue
    if (currentQueueEntryId) {
      try {
        await markUserCompletedMutation.mutateAsync({
          queueEntryId: currentQueueEntryId,
          queueType: teamConfig.queueType
        });
        autoDiallerService.logActivity('User marked as completed in queue', session?.agent?.id || 0, teamType, {
          queueEntryId: currentQueueEntryId,
          outcome: outcome.outcomeType
        });
      } catch (err: any) {
        logger.warn('Failed to mark user as completed in queue', err);
      }
    }

    // Clear current user
    setCurrentUser(null);
    setCurrentQueueEntryId(null);

         // Check session limits
     if (!settings) {
       logger.warn('No settings available for session limit check');
       return;
     }
     const limits = autoDiallerService.checkSessionLimits(sessionStatsRef.current, settings);
     if (limits.shouldStop) {
      transitionTo('stopped', limits.reason);
      setIsActive(false);
      
      toast({
        title: "Session Ended",
        description: limits.reason,
        variant: "default"
      });
      
      onSessionEnd?.(sessionStatsRef.current);
      return;
    }

    // No countdown needed - agent controls pacing with manual "Start Call" button
    transitionTo('loading', 'Loading next user immediately');
    
    // Load next user immediately
    await loadNextUser();

    toast({
      title: "Call Completed",
      description: `Outcome: ${outcome.outcomeType.replace('_', ' ').toUpperCase()}`,
    });
  }, [currentUser, session, teamType, settings, updateStats, updateSessionStatsMutation, onCallComplete, onSessionEnd, transitionTo, toast, currentQueueEntryId, teamConfig, markUserCompletedMutation, loadNextUser]);

  // Countdown logic removed - agent controls pacing manually

  // Start autodialler session
  const startSession = useCallback(async () => {
    if (!session?.agent) {
      throw new Error('No agent session found');
    }

    try {
      setError(null);
      await startSessionMutation.mutateAsync({ teamType, autoStart: false });
      
      setIsActive(true);
      setSessionStats({
        callsCompleted: 0,
        successfulContacts: 0,
        startTime: new Date(),
        sessionDuration: 0,
        completionRate: 0
      });
      
      transitionTo('ready', 'Session started');
      
      // Auto-load first user
      await loadNextUser();
      
      autoDiallerService.logActivity('Session started', session.agent.id, teamType);
      
      toast({
        title: "Auto-Dialler Started",
        description: `${teamConfig.displayName} session active`,
      });
      
    } catch (err: any) {
      const error = new Error(`Failed to start session: ${err.message}`);
      setError(error);
      onError?.(error);
      
      toast({
        title: "Failed to Start Session",
        description: err.message,
        variant: "destructive"
      });
    }
  }, [session, teamType, teamConfig, startSessionMutation, transitionTo, loadNextUser, onError, toast]);

  // Stop autodialler session
  const stopSession = useCallback(async () => {
    try {
      await endSessionMutation.mutateAsync();
      
      setIsActive(false);
      setCurrentUser(null);
      setQueueContext(null);
      
      transitionTo('stopped', 'Session ended by user');
      
      autoDiallerService.logActivity('Session stopped', session?.agent?.id || 0, teamType);
      
      onSessionEnd?.(sessionStatsRef.current);
      
      toast({
        title: "Auto-Dialler Stopped",
        description: "Session ended successfully",
      });
      
    } catch (err: any) {
      const error = new Error(`Failed to stop session: ${err.message}`);
      setError(error);
      onError?.(error);
      
      toast({
        title: "Failed to Stop Session",
        description: err.message,
        variant: "destructive"
      });
    }
  }, [session, teamType, endSessionMutation, transitionTo, onSessionEnd, onError, toast]);

  // Pause session
  const pauseSession = useCallback(() => {
    transitionTo('paused', 'Session paused by user');
    
    autoDiallerService.logActivity('Session paused', session?.agent?.id || 0, teamType);
    
    toast({
      title: "Auto-Dialler Paused",
      description: "You can resume manually",
    });
  }, [session, teamType, transitionTo, toast]);

  // Resume session
  const resumeSession = useCallback(() => {
    if (!currentUser) {
      loadNextUser();
    } else {
      transitionTo('user_loaded', 'Session resumed');
    }
    
    autoDiallerService.logActivity('Session resumed', session?.agent?.id || 0, teamType);
    
    toast({
      title: "Auto-Dialler Resumed",
      description: "Session is now active",
    });
  }, [currentUser, session, teamType, loadNextUser, transitionTo, toast]);

     // Update settings
   const updateSettings = useCallback(async (newSettings: Partial<AutoDiallerSettings>) => {
     try {
       // Extract only the fields that the API expects
       const apiSettings = {
         timeBetweenCallsSeconds: newSettings.timeBetweenCallsSeconds!,
         autoStartEnabled: newSettings.autoStartEnabled!,
         maxCallsPerSession: newSettings.maxCallsPerSession!,
         breakIntervalMinutes: newSettings.breakIntervalMinutes!,
         audioNotificationsEnabled: newSettings.audioNotificationsEnabled!,
         keyboardShortcutsEnabled: newSettings.keyboardShortcutsEnabled!,
       };
       await updateSettingsMutation.mutateAsync(apiSettings);
       await refetchSettings();
      
      toast({
        title: "Settings Updated",
        description: "Auto-dialler settings saved successfully",
      });
    } catch (err: any) {
      const error = new Error(`Failed to update settings: ${err.message}`);
      setError(error);
      onError?.(error);
      
      toast({
        title: "Failed to Update Settings",
        description: err.message,
        variant: "destructive"
      });
    }
  }, [updateSettingsMutation, refetchSettings, onError, toast]);

  return {
    // State
    state,
    currentUser,
    queueContext,
    sessionStats,
    isActive,
    
    // Actions
    startSession,
    stopSession,
    pauseSession,
    resumeSession,
    loadNextUser,
    skipUser,
    handleCallComplete,
    
    // Settings
    settings: settings || null,
    updateSettings,
    
    // Loading states
    isLoading: getNextUserMutation.isLoading || startSessionMutation.isLoading,
    isLoadingNextUser: getNextUserMutation.isLoading,
    error,
  };
} 