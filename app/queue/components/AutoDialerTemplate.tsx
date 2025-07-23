'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/trpc/client';
import { useToast } from '@/modules/core/hooks/use-toast';
import { 
  TeamType, 
  getTeamConfig, 
  validateTeamAccess,
  formatScript 
} from '@/lib/config/teams';
import type { UserCallContext } from '@/modules/calls/types/call.types';
import type { CallOutcomeOptions } from '@/modules/calls/types/call.types';
import { CountdownTimer } from './CountdownTimer';
import { EmptyQueueState } from './EmptyQueueState';
import { CallInterface } from '@/modules/calls/components/CallInterface';

interface AutoDialerTemplateProps {
  teamType: TeamType;
}

interface SessionStats {
  callsCompleted: number;
  startTime: Date;
  successfulContacts: number;
  lastCallAt?: Date;
}

type DialerState = 'ready' | 'loading' | 'calling' | 'disposing' | 'countdown' | 'paused';

export function AutoDialerTemplate({ teamType }: AutoDialerTemplateProps) {
  const teamConfig = getTeamConfig(teamType);
  const { toast } = useToast();
  const router = useRouter();

  // Core state
  const [currentUser, setCurrentUser] = useState<UserCallContext | null>(null);
  const [dialerState, setDialerState] = useState<DialerState>('ready');
  const [countdown, setCountdown] = useState(0);
  const [sessionStats, setSessionStats] = useState<SessionStats>({
    callsCompleted: 0,
    startTime: new Date(),
    successfulContacts: 0
  });

  // User session and settings
  const { data: session } = api.auth.me.useQuery();
  const { data: queueStats } = api.queue.getStats.useQuery(undefined, {
    refetchInterval: 30000
  });
  const { data: autoDialerSettings } = api.autoDialer.getSettings.useQuery();

  // Auto-dialer session management
  const startSessionMutation = api.autoDialer.startSession.useMutation();
  const updateSessionStatsMutation = api.autoDialer.updateSessionStats.useMutation();

  // Validate team access
  useEffect(() => {
    if (session?.agent) {
      const hasAccess = validateTeamAccess(session.agent.team, teamType);
      if (!hasAccess) {
        toast({
          title: "Access Denied",
          description: `You don't have access to the ${teamConfig.displayName}`,
          variant: "destructive"
        });
        router.push('/dashboard');
      }
    }
  }, [session, teamType, teamConfig, toast, router]);

  // Get next user mutation
  const getNextUserMutation = api.queue.getNextUserForCall.useMutation({
    onSuccess: (result) => {
      if (result) {
        setCurrentUser(result.userContext);
        setDialerState('ready');
        toast({
          title: "Next User Loaded",
          description: `${result.userContext.firstName} ${result.userContext.lastName} - Ready to call`,
        });
      } else {
        setCurrentUser(null);
        setDialerState('paused');
        toast({
          title: "Queue Empty",
          description: `No more users in ${teamConfig.displayName} queue`,
        });
      }
    },
    onError: (error) => {
      setDialerState('paused');
      toast({
        title: "Error Loading Next User",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Load next user function
  const loadNextUser = useCallback(() => {
    if (dialerState === 'ready' || dialerState === 'loading') return;
    
    setDialerState('loading');
    getNextUserMutation.mutate({ queueType: teamConfig.queueType });
  }, [dialerState, teamConfig.queueType, getNextUserMutation]);

  // Handle call completion
  const handleCallComplete = useCallback((outcome: CallOutcomeOptions) => {
    // Update session stats
    setSessionStats(prev => ({
      ...prev,
      callsCompleted: prev.callsCompleted + 1,
      successfulContacts: prev.successfulContacts + (outcome.outcomeType === 'contacted' ? 1 : 0),
      lastCallAt: new Date()
    }));

    // Clear current user and start countdown
    setCurrentUser(null);
    setDialerState('countdown');
    
    // Use default time between calls for now (will be configurable later)
    const delaySeconds = teamConfig.callSettings.defaultTimeBetweenCalls;
    setCountdown(delaySeconds);

    toast({
      title: "Call Completed",
      description: `Outcome: ${outcome.outcomeType.replace('_', ' ').toUpperCase()}`,
    });
  }, [teamConfig]);

  // Countdown timer effect
  useEffect(() => {
    if (countdown > 0 && dialerState === 'countdown') {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0 && dialerState === 'countdown') {
      // Countdown finished, load next user
      loadNextUser();
    }
  }, [countdown, dialerState, loadNextUser]);

  // Initialize: Load first user
  useEffect(() => {
    if (session?.agent && dialerState === 'ready' && !currentUser && !getNextUserMutation.isLoading) {
      loadNextUser();
    }
  }, [session, dialerState, currentUser, getNextUserMutation.isLoading, loadNextUser]);

  // Handler functions
  const handleStartCall = () => {
    setDialerState('calling');
  };

  const handlePauseDialer = () => {
    setDialerState('paused');
    setCountdown(0);
    toast({
      title: "Auto-Dialer Paused",
      description: "You can resume by clicking 'Load Next User'",
    });
  };

  const handleResumeDialer = () => {
    if (!currentUser) {
      loadNextUser();
    } else {
      setDialerState('ready');
    }
  };

  const handleSkipCountdown = () => {
    setCountdown(0);
    setDialerState('ready');
  };

  // Get formatted scripts for current user
  const getFormattedScripts = () => {
    if (!currentUser || !session?.agent) return teamConfig.scripts;
    
    const variables = {
      firstName: currentUser.firstName,
      lastName: currentUser.lastName,
      agentName: `${session.agent.firstName} ${session.agent.lastName}`,
      lender: currentUser.claims[0]?.lender || 'your lender'
    };

    return {
      opening: formatScript(teamConfig.scripts.opening, variables),
      voicemail: formatScript(teamConfig.scripts.voicemail, variables),
      callback: formatScript(teamConfig.scripts.callback, variables),
      success: formatScript(teamConfig.scripts.success, variables)
    };
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
          <p className="text-slate-600 text-lg">Loading session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`auto-dialer-dashboard min-h-screen ${teamConfig.color.background}`}>
      {/* Team Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 ${teamConfig.color.gradient} rounded-xl flex items-center justify-center shadow-lg`}>
                <span className="text-2xl">{teamConfig.icon}</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  {teamConfig.displayName}
                </h1>
                <p className="text-slate-600">{teamConfig.description}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              {/* Session Stats */}
              <div className="text-sm text-slate-600">
                <div className="flex items-center gap-4">
                  <span>Calls: <strong>{sessionStats.callsCompleted}</strong></span>
                  <span>Contacts: <strong>{sessionStats.successfulContacts}</strong></span>
                                     <span>Queue: <strong>{queueStats?.queue?.pending || 0}</strong></span>
                </div>
              </div>
              
              {/* Pause/Resume Button */}
              <button
                onClick={dialerState === 'paused' ? handleResumeDialer : handlePauseDialer}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  dialerState === 'paused' 
                    ? 'bg-green-600 hover:bg-green-700 text-white' 
                    : 'bg-yellow-600 hover:bg-yellow-700 text-white'
                }`}
              >
                {dialerState === 'paused' ? 'Resume' : 'Pause'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto p-6">
        {/* State-based rendering */}
        {dialerState === 'countdown' && countdown > 0 && (
          <CountdownTimer
            seconds={countdown}
            teamConfig={teamConfig}
            onComplete={() => setCountdown(0)}
            onSkip={handleSkipCountdown}
            showPauseButton={true}
            onPause={() => setDialerState('paused')}
            onResume={() => {
              setDialerState('countdown');
              // Resume countdown where it left off
            }}
          />
        )}

        {dialerState === 'loading' && (
          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-xl shadow-lg p-8 text-center">
              <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
              <p className="text-slate-600 text-lg">Loading next user...</p>
            </div>
          </div>
        )}

        {dialerState === 'paused' && (
          <EmptyQueueState
            teamConfig={teamConfig}
            onRefresh={handleResumeDialer}
            isLoading={getNextUserMutation.isLoading}
            queueStats={{
              totalProcessedToday: sessionStats.callsCompleted,
              lastUserProcessedAt: sessionStats.lastCallAt,
              avgProcessingTime: sessionStats.callsCompleted > 0 ? 
                Math.round((Date.now() - sessionStats.startTime.getTime()) / (sessionStats.callsCompleted * 60000)) : 
                undefined
            }}
          />
        )}

        {(dialerState === 'ready' || dialerState === 'calling') && currentUser && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              {/* User Info Header */}
              <div className={`p-6 ${teamConfig.color.gradient} text-white`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold">
                      {currentUser.firstName} {currentUser.lastName}
                    </h2>
                    <p className="text-white/80">{currentUser.phoneNumber}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-white/80">Claims</div>
                    <div className="text-xl font-semibold">{currentUser.claims.length}</div>
                  </div>
                </div>
              </div>

              {/* User Details */}
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Contact Info */}
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800 mb-3">Contact Information</h3>
                    <div className="space-y-2 text-sm">
                      <p><strong>Phone:</strong> {currentUser.phoneNumber}</p>
                      <p><strong>Email:</strong> {currentUser.email || 'Not provided'}</p>
                      {currentUser.address && (
                        <p><strong>Address:</strong> {currentUser.address.fullAddress}</p>
                      )}
                    </div>
                  </div>

                  {/* Claims Info */}
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800 mb-3">Claims Summary</h3>
                    {currentUser.claims.slice(0, 2).map((claim, index) => (
                      <div key={index} className="mb-3 p-3 bg-slate-50 rounded-lg">
                        <p className="text-sm"><strong>Lender:</strong> {claim.lender}</p>
                        <p className="text-sm"><strong>Status:</strong> {claim.status}</p>
                        {claim.requirements && (
                          <p className="text-sm"><strong>Requirements:</strong> {claim.requirements.length} pending</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Script Helper */}
                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">Opening Script:</h4>
                  <p className="text-blue-800 text-sm italic">
                    {getFormattedScripts().opening}
                  </p>
                </div>

                {/* Enhanced Call Controls */}
                <div className="mt-6">
                  {dialerState === 'ready' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <button
                        onClick={handleStartCall}
                        className={`px-8 py-4 ${teamConfig.color.gradient} text-white rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105`}
                      >
                        📞 Start Call
                      </button>
                      <button
                        onClick={() => loadNextUser()}
                        className="px-8 py-4 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-semibold text-lg transition-all duration-200"
                      >
                        ⏭️ Skip User
                      </button>
                    </div>
                  )}
                  {dialerState === 'calling' && (
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-3 text-green-600 font-semibold text-lg mb-4">
                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                        📞 Call in Progress...
                      </div>
                      <button
                        onClick={handlePauseDialer}
                        className="px-6 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
                      >
                        Pause Auto-Dialer
                      </button>
                    </div>
                  )}
                </div>

                {/* Quick Actions */}
                <div className="mt-4 flex justify-center gap-2">
                  <button
                    onClick={handlePauseDialer}
                    className="px-4 py-2 text-sm bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
                  >
                    ⏸️ Pause Session
                  </button>
                  <button
                    onClick={() => window.open(`/users/${currentUser.userId}`, '_blank')}
                    className="px-4 py-2 text-sm bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
                  >
                    👤 View Full Profile
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 