'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/modules/core/components/ui/card';
import { Button } from '@/modules/core/components/ui/button';
import { Badge } from '@/modules/core/components/ui/badge';
import { Alert, AlertDescription } from '@/modules/core/components/ui/alert';
import { 
  Phone, 
  Play, 
  Pause, 
  Square, 
  SkipForward, 
  Settings, 
  TrendingUp,
  Clock,
  User,
  AlertCircle,
  CheckCircle2,
  FileText,
  RefreshCw,
  Mail,
  MapPin,
  Loader2
} from 'lucide-react';
import { CallInterface } from '@/modules/calls/components/CallInterface';
import { CountdownTimer } from '../../../app/queue/components/CountdownTimer';
import { EmptyQueueState } from '../../../app/queue/components/EmptyQueueState';
import { CallbackConfirmationDialog } from './CallbackConfirmationDialog';
import { useAutoDialler } from '../hooks';
import { getTeamConfig } from '@/lib/config/teams';
import type { TeamType } from '@/lib/config/teams';
import type { CallOutcomeOptions } from '@/modules/calls/types/call.types';

interface AutoDiallerDashboardProps {
  teamType: TeamType;
}

export function AutoDiallerDashboard({ teamType }: AutoDiallerDashboardProps) {
  const teamConfig = getTeamConfig(teamType);
  const [showSettings, setShowSettings] = useState(false);
  const [isCallInterfaceActive, setIsCallInterfaceActive] = useState(false);
  const [isActivatingInterface, setIsActivatingInterface] = useState(false);
  
  // Callback confirmation dialog state
  const [showCallbackConfirmation, setShowCallbackConfirmation] = useState(false);
  const [pendingOutcome, setPendingOutcome] = useState<CallOutcomeOptions | null>(null);

  const {
    state,
    currentUser,
    queueContext,
    sessionStats,
    isActive,
    startSession,
    stopSession,
    pauseSession,
    resumeSession,
    loadNextUser,
    skipUser,
    handleCallStart,
    handleCallComplete,
    resetToUserLoaded,
    settings,
    updateSettings,
    isLoading,
    isLoadingNextUser,
    error,
  } = useAutoDialler({
    teamType,
    onStateChange: (newState) => {
      console.log('AutoDialler state changed:', newState);
    },
    onUserLoaded: (context) => {
      console.log('User loaded for autodialler:', context.userContext.firstName, context.userContext.lastName);
    },
    onCallComplete: (outcome) => {
      console.log('AutoDialler call completed:', outcome.outcomeType);
    },
    onSessionEnd: (stats) => {
      console.log('AutoDialler session ended:', stats);
    },
    onError: (error) => {
      console.error('AutoDialler error:', error);
    },
  });

  // Callback confirmation handlers
  const handleCallCompleteWithConfirmation = (outcome: CallOutcomeOptions) => {
    setIsCallInterfaceActive(false);
    
    // Intercept hung_up outcomes for callback confirmation
    if (outcome.outcomeType === 'hung_up') {
      setPendingOutcome(outcome);
      setShowCallbackConfirmation(true);
      return;
    }
    
    // Normal flow for all other outcomes
    handleCallComplete(outcome);
  };

  const handleConfirmCallback = () => {
    setShowCallbackConfirmation(false);
    setPendingOutcome(null);
    // Reset to user_loaded state for immediate callback
    resetToUserLoaded();
  };

  const handleSkipCallback = () => {
    setShowCallbackConfirmation(false);
    // Proceed with normal flow - record outcome and move to next user
    if (pendingOutcome) {
      handleCallComplete(pendingOutcome);
    }
    setPendingOutcome(null);
  };

  const getStateDisplay = () => {
    switch (state) {
      case 'ready':
        return { text: 'Ready', color: 'bg-blue-100 text-blue-800', icon: <Play className="w-4 h-4" /> };
      case 'loading':
        return { text: 'Loading User', color: 'bg-yellow-100 text-yellow-800', icon: <Clock className="w-4 h-4" /> };
      case 'user_loaded':
        return { text: 'User Ready', color: 'bg-green-100 text-green-800', icon: <User className="w-4 h-4" /> };
      case 'calling':
        return { text: 'Call Active', color: 'bg-emerald-100 text-emerald-800', icon: <Phone className="w-4 h-4" /> };
      case 'disposing':
        return { text: 'Call Ending', color: 'bg-orange-100 text-orange-800', icon: <CheckCircle2 className="w-4 h-4" /> };

      case 'paused':
        return { text: 'Paused', color: 'bg-gray-100 text-gray-800', icon: <Pause className="w-4 h-4" /> };
      case 'stopped':
        return { text: 'Stopped', color: 'bg-red-100 text-red-800', icon: <Square className="w-4 h-4" /> };
      default:
        return { text: 'Unknown', color: 'bg-gray-100 text-gray-800', icon: <AlertCircle className="w-4 h-4" /> };
    }
  };

  const stateDisplay = getStateDisplay();

  // ✅ DYNAMIC MISSED CALL REASON MAPPING
  const getMissedCallReason = (reason: string): string => {
    switch (reason) {
      case 'out_of_hours':
        return 'Called outside business hours';
      case 'agents_busy':
        return 'All agents were busy';
      case 'no_agents_available':
        return 'No agents available';
      case 'handler_error':
        return 'System error occurred';
      case 'a.i sms agent callback':
        return 'AI SMS agent scheduled callback';
      default:
        return reason.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  // ✅ CALLBACK TIME FORMATTING
  const formatCallbackTime = (scheduledFor: string): { timeAgo: string, urgency: 'overdue' | 'urgent' | 'due_soon' } => {
    const scheduled = new Date(scheduledFor);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - scheduled.getTime()) / (1000 * 60));
    
    if (diffMinutes > 0) {
      // Overdue
      const hours = Math.floor(diffMinutes / 60);
      const minutes = diffMinutes % 60;
      return {
        timeAgo: hours > 0 ? `${hours}h ${minutes}m overdue` : `${minutes}m overdue`,
        urgency: 'overdue'
      };
    } else {
      // Future or current
      const absMinutes = Math.abs(diffMinutes);
      const hours = Math.floor(absMinutes / 60);
      return {
        timeAgo: hours > 0 ? `scheduled for ${hours}h ${absMinutes % 60}m from now` : 
                absMinutes < 5 ? 'due now' : `due in ${absMinutes}m`,
        urgency: absMinutes < 15 ? 'urgent' : 'due_soon'
      };
    }
  };

  return (
    <div className={`autodialler-dashboard min-h-screen ${teamConfig.color.background}`}>
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 ${teamConfig.color.gradient} rounded-xl flex items-center justify-center shadow-lg`}>
                <span className="text-2xl">{teamConfig.icon}</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  {teamConfig.displayName} Auto-Dialler
                </h1>
                <p className="text-slate-600">{teamConfig.description}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Current State Badge */}
              <Badge className={`flex items-center gap-2 px-3 py-1 ${stateDisplay.color} border-0`}>
                {stateDisplay.icon}
                {stateDisplay.text}
              </Badge>
              
              {/* Session Controls */}
              {!isActive ? (
                <Button onClick={startSession} disabled={isLoading} className="flex items-center gap-2">
                  <Play className="w-4 h-4" />
                  Start Session
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  {state === 'paused' ? (
                    <Button onClick={resumeSession} variant="outline" className="flex items-center gap-2">
                      <Play className="w-4 h-4" />
                      Resume
                    </Button>
                  ) : (
                    <Button onClick={pauseSession} variant="outline" className="flex items-center gap-2">
                      <Pause className="w-4 h-4" />
                      Pause
                    </Button>
                  )}
                  <Button onClick={stopSession} variant="destructive" className="flex items-center gap-2">
                    <Square className="w-4 h-4" />
                    Stop
                  </Button>
                </div>
              )}
              
              {/* Settings Button */}
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowSettings(!showSettings)}
                className="flex items-center gap-2"
              >
                <Settings className="w-4 h-4" />
                Settings
              </Button>
            </div>
          </div>
          
          {/* Session Stats */}
          {isActive && (
            <div className="mt-4 flex items-center gap-6 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                <span>Calls: <strong>{sessionStats.callsCompleted}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>Contacts: <strong>{sessionStats.successfulContacts}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>Duration: <strong>{sessionStats.sessionDuration}m</strong></span>
              </div>
              {sessionStats.completionRate > 0 && (
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  <span>Rate: <strong>{sessionStats.completionRate.toFixed(1)}%</strong></span>
                </div>
              )}
              {queueContext && (
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  <span>Queue: <strong>{queueContext.remainingUsers}</strong> remaining</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto p-6">
        {/* Error Display */}
        {error && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-red-800">
              {error.message}
            </AlertDescription>
          </Alert>
        )}

        {/* State-based Content */}
        {!isActive && (
          <div className="max-w-md mx-auto">
            <Card className="border-2 border-slate-300 shadow-2xl bg-white backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-slate-100 via-blue-50 to-slate-100 border-b-2 border-slate-300">
                <CardTitle className="text-center text-2xl font-bold text-slate-900">Auto-Dialler Ready</CardTitle>
              </CardHeader>
              <CardContent className="text-center space-y-6 p-8">
                <p className="text-slate-700 font-medium text-lg leading-relaxed">
                  Start your auto-dialler session to begin calling users from the <strong className="text-slate-900">{teamConfig.displayName}</strong> queue.
                </p>
                <Button 
                  onClick={startSession} 
                  disabled={isLoading}
                  className={`w-full bg-gradient-to-r ${teamConfig.color.gradient} text-white font-bold text-lg py-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 border-2 border-slate-400`}
                >
                  {isLoading ? 'Starting...' : 'Start Auto-Dialler Session'}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {isActive && state === 'loading' && (
          <div className="max-w-md mx-auto">
            <Card className="border-2 border-slate-300 shadow-2xl bg-white backdrop-blur-sm">
              <CardContent className="pt-8 pb-8">
                <div className="text-center space-y-6">
                  <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <h3 className="text-xl font-bold text-slate-900">Loading Next User</h3>
                  <p className="text-slate-700 font-medium">Finding the next user to call from the queue...</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {isActive && state === 'paused' && (
          <EmptyQueueState
            teamConfig={teamConfig}
            onRefresh={resumeSession}
            isLoading={isLoadingNextUser}
            queueStats={{
              totalProcessedToday: sessionStats.callsCompleted,
              lastUserProcessedAt: sessionStats.lastCallAt,
              avgProcessingTime: sessionStats.sessionDuration
            }}
          />
        )}

        {isActive && state === 'user_loaded' && currentUser && !isCallInterfaceActive && (
          <div className="max-w-5xl mx-auto space-y-6">
            {/* 🚨 MISSED CALL PRIORITY ALERT - UNIFIED COLOR THEME */}
            {(currentUser as any)?.isMissedCallCallback && (
              <div className="bg-gradient-to-r from-amber-500 to-red-500 text-white p-4 rounded-xl shadow-xl border-2 border-amber-300">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-amber-100/30 p-2 rounded-full">
                      <RefreshCw className="w-6 h-6 text-white animate-spin-slow" />
                    </div>
                    <div>
                      <div className="text-xl font-bold uppercase tracking-wide">
                        🚨 PRIORITY: MISSED CALL CALLBACK
                      </div>
                      <div className="text-sm font-medium mt-1 opacity-90">
                        Customer called {(currentUser as any)?.missedCallData?.missedAt && 
                          `${Math.round((Date.now() - new Date((currentUser as any).missedCallData.missedAt).getTime()) / (1000 * 60))} minutes ago`}
                        {' '}• Reason: {getMissedCallReason((currentUser as any)?.missedCallData?.reason || 'unknown')}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="bg-amber-100/30 px-4 py-2 rounded-lg border border-amber-200/50">
                      <div className="text-sm font-bold uppercase tracking-wider">URGENT</div>
                      <div className="text-xs font-medium opacity-90">Call Back Now</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 📅 SCHEDULED CALLBACK ALERT */}
            {(currentUser as any)?.isCallbackCall && (
              (() => {
                const callbackInfo = formatCallbackTime((currentUser as any)?.callbackData?.scheduledFor);
                const isOverdue = callbackInfo.urgency === 'overdue';
                const isUrgent = callbackInfo.urgency === 'urgent';
                
                return (
                  <div className={`text-white p-4 rounded-xl shadow-xl border-2 ${
                    isOverdue 
                      ? 'bg-gradient-to-r from-red-600 to-red-700 border-red-400' 
                      : isUrgent 
                        ? 'bg-gradient-to-r from-blue-500 to-purple-600 border-blue-300'
                        : 'bg-gradient-to-r from-green-500 to-blue-500 border-green-300'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${
                          isOverdue 
                            ? 'bg-red-100/30' 
                            : isUrgent 
                              ? 'bg-blue-100/30'
                              : 'bg-green-100/30'
                        }`}>
                          <Clock className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <div className="text-xl font-bold uppercase tracking-wide">
                            {isOverdue ? '🔴 OVERDUE: SCHEDULED CALLBACK' : '📅 SCHEDULED CALLBACK'}
                          </div>
                          <div className="text-sm font-medium mt-1 opacity-90">
                            {callbackInfo.timeAgo}
                            {(currentUser as any)?.callbackData?.reason && 
                              ` • Reason: ${(currentUser as any).callbackData.reason}`
                            }
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`px-4 py-2 rounded-lg border ${
                          isOverdue 
                            ? 'bg-red-100/30 border-red-200/50' 
                            : isUrgent 
                              ? 'bg-blue-100/30 border-blue-200/50'
                              : 'bg-green-100/30 border-green-200/50'
                        }`}>
                          <div className="text-sm font-bold uppercase tracking-wider">
                            {isOverdue ? 'OVERDUE' : isUrgent ? 'URGENT' : 'SCHEDULED'}
                          </div>
                          <div className="text-xs font-medium opacity-90">
                            {isOverdue ? 'Call Now' : 'Callback Due'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()
            )}

            {/* User Header Card */}
            <Card className="border-2 border-slate-200 shadow-2xl bg-white backdrop-blur-sm">
              <CardHeader
                className={`bg-gradient-to-r ${
                  (currentUser as any)?.isMissedCallCallback ? 'from-red-700 to-red-800' : teamConfig.color.gradient
                } text-white py-10 border-b-2 border-white/20 relative overflow-hidden`}
              >
                {/* Enhanced background overlay for better contrast */}
                <div className={`absolute inset-0 ${
                  (currentUser as any)?.isMissedCallCallback ? 'bg-red-900/30' : 'bg-black/20'
                } backdrop-blur-sm`}></div>
                <div className="relative z-10 flex items-center justify-between">
                  <div className="flex items-center space-x-6">
                      <div className={`w-20 h-20 ${
                        (currentUser as any)?.isMissedCallCallback ? 'bg-amber-100 border-amber-300' : 'bg-white/40'
                      } rounded-2xl flex items-center justify-center shadow-2xl backdrop-blur-sm border-3 border-white/50`}>
                        <Phone className={`w-10 h-10 ${
                          (currentUser as any)?.isMissedCallCallback ? 'text-red-600' : 'text-white'
                        } drop-shadow-lg`} />
                    </div>
                    <div>
                      <CardTitle className="text-3xl font-black mb-2 text-white drop-shadow-xl tracking-wide">
                        {currentUser.firstName} {currentUser.lastName}
                      </CardTitle>
                      <p className={`text-xl font-bold mb-1 drop-shadow-lg tracking-wide ${
                        (currentUser as any)?.isMissedCallCallback ? 'text-white' : 'text-white'
                      }`}>
                        {currentUser.phoneNumber}
                      </p>
                      <div className="flex items-center gap-3">
                        {currentUser.email && (
                          <p className="text-white font-semibold text-base drop-shadow-lg">{currentUser.email}</p>
                        )}
                        <div className="bg-white/30 px-4 py-2 rounded-xl border-2 border-white/40 shadow-lg backdrop-blur-sm">
                          <span className="text-white font-bold text-sm uppercase tracking-wider drop-shadow-md">ID: {currentUser.userId}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Quick Stats - No overlap now that missed call banner is separate */}
                  <div className="text-right">
                    <div className="bg-white/40 rounded-2xl p-6 backdrop-blur-sm shadow-2xl border-3 border-white/50">
                      <div className="text-sm text-white font-black mb-2 uppercase tracking-wider drop-shadow-lg">Active Claims</div>
                      <div className="text-4xl font-black text-white drop-shadow-xl">{currentUser.claims.length}</div>
                      <div className="text-white text-sm font-bold mt-1 drop-shadow-lg">pending review</div>
                    </div>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Contact Information */}
              <Card className="border-2 border-slate-300 shadow-2xl bg-white backdrop-blur-sm hover:shadow-3xl transition-all duration-300">
                <CardHeader className="bg-gradient-to-r from-blue-100 via-slate-100 to-blue-100 border-b-2 border-slate-300 pb-3">
                  <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg">
                      <Phone className="w-5 h-5 text-white" />
                    </div>
                    Contact Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="space-y-5">
                    <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 hover:border-blue-400 transition-all duration-200 shadow-sm hover:shadow-md">
                      <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg">
                        <Phone className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="text-xs text-blue-800 font-bold uppercase tracking-wider">Phone Number</div>
                        <div className="font-bold text-base text-slate-900 mt-1">{currentUser.phoneNumber}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-emerald-50 to-green-50 border-2 border-emerald-300 hover:border-emerald-400 transition-all duration-200 shadow-sm hover:shadow-md">
                      <div className="w-10 h-10 bg-gradient-to-r from-emerald-600 to-emerald-700 rounded-xl flex items-center justify-center shadow-lg">
                        <Mail className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="text-xs text-emerald-800 font-bold uppercase tracking-wider">Email Address</div>
                        <div className="font-bold text-base text-slate-900 mt-1">{currentUser.email || 'Not provided'}</div>
                      </div>
                    </div>
                    
                    {currentUser.createdAt && (
                      <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-300 hover:border-amber-400 transition-all duration-200 shadow-sm hover:shadow-md">
                        <div className="w-10 h-10 bg-gradient-to-r from-amber-600 to-amber-700 rounded-xl flex items-center justify-center shadow-lg">
                          <User className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="text-xs text-amber-800 font-bold uppercase tracking-wider">Account Created</div>
                          <div className="font-bold text-base text-slate-900 mt-1">
                            {new Date(currentUser.createdAt).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: '2-digit', 
                              year: 'numeric'
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {currentUser.address && (
                      <div className="flex items-start gap-4 p-4 rounded-xl bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-300 hover:border-purple-400 transition-all duration-200 shadow-sm hover:shadow-md">
                        <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-purple-700 rounded-xl flex items-center justify-center shadow-lg">
                          <MapPin className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="text-xs text-purple-800 font-bold uppercase tracking-wider">Address</div>
                          <div className="font-bold text-base text-slate-900 mt-1 leading-relaxed">{currentUser.address.fullAddress}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Claims Summary */}
              <Card className="border-2 border-slate-300 shadow-2xl bg-white backdrop-blur-sm hover:shadow-3xl transition-all duration-300 lg:col-span-2">
                <CardHeader className="bg-gradient-to-r from-orange-100 via-slate-100 to-orange-100 border-b-2 border-slate-300 pb-3">
                  <CardTitle className="text-lg font-bold text-slate-900 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-r from-orange-600 to-orange-700 rounded-xl flex items-center justify-center shadow-lg">
                        <FileText className="w-5 h-5 text-white" />
                      </div>
                      Claims Summary
                    </div>
                    <Badge className="bg-gradient-to-r from-orange-200 to-orange-300 text-orange-900 border-2 border-orange-400 font-bold text-xs px-2 py-1">
                      {currentUser.claims.length} pending
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  {currentUser.claims.length > 0 ? (
                    <div className="space-y-6">
                      {currentUser.claims.slice(0, 3).map((claim, index) => (
                        <div key={index} className="border-2 border-slate-300 rounded-xl p-6 bg-gradient-to-r from-white to-slate-50 hover:border-slate-400 transition-all duration-300 shadow-lg hover:shadow-xl">
                          <div className="flex items-center gap-4 mb-4">
                            <div className="w-8 h-8 bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl flex items-center justify-center shadow-lg text-white font-bold text-sm">
                              {index + 1}
                            </div>
                            <span className={`inline-flex px-3 py-1 rounded-xl text-xs font-bold border-2 ${
                              claim.status === 'active' ? 'bg-emerald-200 text-emerald-900 border-emerald-400' :
                              claim.status === 'pending' ? 'bg-yellow-200 text-yellow-900 border-yellow-400' :
                              'bg-slate-200 text-slate-900 border-slate-400'
                            }`}>
                              {claim.status}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="p-3 rounded-xl bg-white border-2 border-slate-300 shadow-sm">
                              <div className="text-xs text-slate-700 font-bold uppercase tracking-wider mb-1">Lender</div>
                              <div className="font-bold text-sm text-slate-900">{claim.lender}</div>
                            </div>
                            <div className="p-3 rounded-xl bg-white border-2 border-slate-300 shadow-sm">
                              <div className="text-xs text-slate-700 font-bold uppercase tracking-wider mb-1">Status</div>
                              <div className="font-bold text-sm text-slate-900 capitalize">{claim.status}</div>
                            </div>
                            <div className="p-3 rounded-xl bg-white border-2 border-slate-300 shadow-sm">
                              <div className="text-xs text-slate-700 font-bold uppercase tracking-wider mb-1">Requirements</div>
                              <div className="font-bold text-sm text-slate-900">
                                {claim.requirements ? claim.requirements.length : 0} pending
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {currentUser.claims.length > 3 && (
                        <div className="text-center py-4">
                          <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-200 rounded-xl border-2 border-slate-400">
                            <FileText className="w-4 h-4 text-slate-700" />
                            <span className="text-sm font-bold text-slate-800">
                              +{currentUser.claims.length - 3} more claims available
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-16">
                      <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-slate-300 to-slate-400 rounded-2xl flex items-center justify-center shadow-lg">
                        <FileText className="w-10 h-10 text-slate-600" />
                      </div>
                      <p className="font-bold text-xl text-slate-800 mb-2">No claims found</p>
                      <p className="text-slate-600 font-medium">This user hasn't submitted any claims yet.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Action Buttons - Prominent and Accessible */}
            <Card className="border-2 border-slate-300 shadow-2xl bg-white backdrop-blur-sm hover:shadow-3xl transition-all duration-300">
              <CardContent className="py-10 px-8">
                <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                  <Button
                    onClick={async () => {
                      // Prevent double-clicking during interface activation
                      if (isActivatingInterface) {
                        console.log('🚫 Interface already activating, ignoring duplicate click');
                        return;
                      }
                      
                      setIsActivatingInterface(true);
                      
                      try {
                        console.log('Activating call interface for:', currentUser.firstName, currentUser.lastName);
                        
                        // Small delay to show loading state (interface activation is usually instant)
                        await new Promise(resolve => setTimeout(resolve, 300));
                        
                        setIsCallInterfaceActive(true);
                      } finally {
                        setIsActivatingInterface(false);
                      }
                    }}
                    disabled={isActivatingInterface}
                    className={`px-12 py-6 text-lg font-bold bg-gradient-to-r ${teamConfig.color.gradient} text-white hover:shadow-2xl transform hover:scale-105 transition-all duration-300 border-0 rounded-2xl shadow-lg`}
                    size="lg"
                  >
                    {isActivatingInterface ? (
                      <>
                        <Loader2 className="w-6 h-6 mr-3 animate-spin" />
                        Activating...
                      </>
                    ) : (
                      <>
                        <Phone className="w-6 h-6 mr-3" />
                        Start Call Interface
                      </>
                    )}
                  </Button>
                  
                  <Button
                    onClick={skipUser}
                    variant="outline"
                    size="lg"
                    className="px-12 py-6 text-lg font-bold border-3 border-slate-600 bg-slate-700 text-white hover:bg-slate-800 hover:border-slate-700 hover:shadow-2xl transform hover:scale-105 transition-all duration-300 rounded-2xl shadow-lg"
                  >
                    <SkipForward className="w-6 h-6 mr-3" />
                    Skip User
                  </Button>
                </div>
                
                {/* Quick Actions */}
                <div className="flex justify-center gap-4 mt-8 pt-8 border-t-2 border-slate-300">
                  <Button
                    onClick={() => {
                      // Refresh current user data by loading them again
                      console.log('🔄 Refreshing current user data...');
                      loadNextUser(); // This will reload the current user with fresh data
                    }}
                    variant="outline"
                    size="default"
                    className="px-4 py-3 text-blue-700 bg-blue-50 hover:text-white hover:bg-blue-600 rounded-xl font-bold transition-all duration-200 border-2 border-blue-200 hover:border-blue-600 shadow-lg hover:shadow-xl"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh Data
                  </Button>
                  <Button
                    onClick={loadNextUser}
                    variant="outline"
                    size="default"
                    className="px-4 py-3 text-slate-800 bg-white hover:text-white hover:bg-slate-700 rounded-xl font-bold transition-all duration-200 border-2 border-slate-600 hover:border-slate-700 shadow-lg hover:shadow-xl"
                  >
                    <SkipForward className="w-4 h-4 mr-2" />
                    Load Next User
                  </Button>
                  <Button
                    onClick={pauseSession}
                    variant="outline"
                    size="default"
                    className="px-4 py-3 text-slate-800 bg-white hover:text-white hover:bg-slate-700 rounded-xl font-bold transition-all duration-200 border-2 border-slate-600 hover:border-slate-700 shadow-lg hover:shadow-xl"
                  >
                    <Pause className="w-4 h-4 mr-2" />
                    Pause Session
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

         {isActive && state === 'user_loaded' && currentUser && isCallInterfaceActive && (
           <div className="max-w-4xl mx-auto space-y-4">
             {/* Auto-dialler Status */}
             <Card>
               <CardContent className="pt-6">
                 <div className="text-center">
                   <div className="flex items-center justify-center gap-3 text-green-600 font-semibold text-lg mb-4">
                     <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                     📞 Auto-Dialler Active - Call Interface Ready
                   </div>
                   <div className="flex items-center justify-center gap-2">
                     <Button onClick={pauseSession} variant="outline">
                       <Pause className="w-4 h-4 mr-2" />
                       Pause Auto-Dialler
                     </Button>
                     <Button 
                       onClick={() => setIsCallInterfaceActive(false)} 
                       variant="outline"
                     >
                       Back to User Details
                     </Button>
                   </div>
                 </div>
               </CardContent>
             </Card>
             
             {/* Integrated Call Interface */}
             <Card>
               <CardContent className="p-6">
                                 <CallInterface 
                  userContext={currentUser}
                  onCallStart={handleCallStart}
                  onCallComplete={handleCallCompleteWithConfirmation}
                />
               </CardContent>
             </Card>
           </div>
         )}

        {isActive && state === 'calling' && currentUser && (
          <div className="max-w-4xl mx-auto space-y-4">
            {/* Auto-dialler Status */}
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-3 text-green-600 font-semibold text-lg mb-4">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                    📞 Auto-Dialler Active - Call in Progress
                  </div>
                  <Button onClick={pauseSession} variant="outline">
                    <Pause className="w-4 h-4 mr-2" />
                    Pause Auto-Dialler
                  </Button>
                </div>
              </CardContent>
            </Card>
            
            {/* Integrated Call Interface */}
            <Card>
              <CardContent className="p-6">
                            <CallInterface 
              userContext={currentUser}
              onCallStart={handleCallStart}
              onCallComplete={handleCallCompleteWithConfirmation}
            />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Countdown removed - agent controls pacing with manual "Start Call" button */}
      </div>

      {/* Callback Confirmation Dialog */}
      <CallbackConfirmationDialog
        isOpen={showCallbackConfirmation}
        customerName={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : ''}
        onConfirm={handleConfirmCallback}
        onCancel={handleSkipCallback}
      />
    </div>
  );
} 