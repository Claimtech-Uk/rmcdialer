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
  CheckCircle2
} from 'lucide-react';
import { CallInterface } from '@/modules/calls/components/CallInterface';
import { CountdownTimer } from '../../../app/queue/components/CountdownTimer';
import { EmptyQueueState } from '../../../app/queue/components/EmptyQueueState';
import { useAutoDialler } from '../hooks';
import { getTeamConfig } from '@/lib/config/teams';
import type { TeamType } from '@/lib/config/teams';

interface AutoDiallerDashboardProps {
  teamType: TeamType;
}

export function AutoDiallerDashboard({ teamType }: AutoDiallerDashboardProps) {
  const teamConfig = getTeamConfig(teamType);
  const [showSettings, setShowSettings] = useState(false);
  const [isCallInterfaceActive, setIsCallInterfaceActive] = useState(false);

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
    handleCallComplete,
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
            <Card>
              <CardHeader>
                <CardTitle className="text-center">Auto-Dialler Ready</CardTitle>
              </CardHeader>
              <CardContent className="text-center space-y-4">
                <p className="text-slate-600">
                  Start your auto-dialler session to begin calling users from the {teamConfig.displayName} queue.
                </p>
                <Button 
                  onClick={startSession} 
                  disabled={isLoading}
                  className={`w-full ${teamConfig.color.gradient} text-white`}
                >
                  {isLoading ? 'Starting...' : 'Start Auto-Dialler Session'}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {isActive && state === 'loading' && (
          <div className="max-w-md mx-auto">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <h3 className="text-lg font-semibold">Loading Next User</h3>
                  <p className="text-slate-600">Finding the next user to call from the queue...</p>
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
           <div className="max-w-4xl mx-auto">
             <Card>
               <CardHeader className={`${teamConfig.color.gradient} text-white`}>
                 <div className="flex items-center justify-between">
                   <div>
                     <CardTitle className="text-2xl">
                       {currentUser.firstName} {currentUser.lastName}
                     </CardTitle>
                     <p className="text-white/80">{currentUser.phoneNumber}</p>
                   </div>
                   <div className="text-right">
                     <div className="text-sm text-white/80">Claims</div>
                     <div className="text-xl font-semibold">{currentUser.claims.length}</div>
                   </div>
                 </div>
               </CardHeader>
               <CardContent className="p-6">
                 {/* User Details */}
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
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

                 {/* Call Controls */}
                 <div className="flex items-center justify-center gap-4">
                   <Button
                     onClick={() => {
                       console.log('Activating call interface for:', currentUser.firstName, currentUser.lastName);
                       setIsCallInterfaceActive(true);
                     }}
                     className={`px-8 py-4 ${teamConfig.color.gradient} text-white`}
                     size="lg"
                   >
                     <Phone className="w-5 h-5 mr-2" />
                     Start Call Interface
                   </Button>
                   <Button
                     onClick={skipUser}
                     variant="outline"
                     size="lg"
                     className="px-8 py-4"
                   >
                     <SkipForward className="w-5 h-5 mr-2" />
                     Skip User
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
                   onCallComplete={(outcome) => {
                     setIsCallInterfaceActive(false);
                     handleCallComplete(outcome);
                   }}
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
                  onCallComplete={handleCallComplete}
                />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Countdown removed - agent controls pacing with manual "Start Call" button */}
      </div>
    </div>
  );
} 