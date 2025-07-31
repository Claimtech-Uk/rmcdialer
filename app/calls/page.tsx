'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/modules/core/components/ui/card';
import { Button } from '@/modules/core/components/ui/button';
import { Phone, Clock, TrendingUp, Users, ArrowRight, BarChart3, User, Mail, MapPin, ExternalLink, Calendar, FileText } from 'lucide-react';
import { api } from '@/lib/trpc/client';

export default function CallsPage() {
  const router = useRouter();
  
  // Get current call if any
  const { data: currentCall } = api.calls.getCurrentCall.useQuery();
  
  // Get today's summary
  const { data: todaysSummary } = api.calls.getTodaysSummary.useQuery();

  // End call mutation to clear stuck call state
  const endCallMutation = api.calls.updateCallStatus.useMutation({
    onSuccess: () => {
      // Refresh current call data to update UI
      window.location.reload();
    },
    onError: (error) => {
      console.error('Failed to end call:', error);
      // Force refresh anyway
      window.location.reload();
    }
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-3">
              <Phone className="w-8 h-8 text-blue-600" />
              Call Management
            </h1>
            <p className="text-slate-600 mt-2 text-lg">
              Manage your calls and view performance metrics
            </p>
          </div>
        </div>

        {/* Current Call Status */}
        {currentCall && (
          <Card className="border-0 shadow-xl bg-gradient-to-r from-blue-500 to-cyan-600 text-white">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Phone className="w-6 h-6 animate-pulse" />
                Active Call in Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Customer Information */}
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <User className="w-5 h-5 text-white" />
                  <h3 className="text-lg font-semibold text-white">Customer Information</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-2xl font-bold text-white">
                      {currentCall.userContext?.firstName} {currentCall.userContext?.lastName}
                    </div>
                    <div className="text-blue-100 flex items-center gap-2 mt-1">
                      <Phone className="w-4 h-4 flex-shrink-0" />
                      {currentCall.userContext?.phoneNumber}
                    </div>
                    {currentCall.userContext?.email && (
                      <div className="text-blue-100 flex items-center gap-2 mt-1">
                        <Mail className="w-4 h-4 flex-shrink-0" />
                        {currentCall.userContext?.email}
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <div className="text-blue-100 mb-2">
                      <span className="font-medium">Status:</span> {currentCall.status}
                    </div>
                    {currentCall.userContext?.address && (
                      <div className="text-blue-100 flex items-start gap-2">
                        <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <div className="text-sm">
                          {currentCall.userContext.address.fullAddress}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Claims Summary */}
                {currentCall.userContext?.claims && currentCall.userContext.claims.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/20">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-4 h-4 text-white" />
                      <span className="text-white font-medium">Claims ({currentCall.userContext.claims.length})</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {currentCall.userContext.claims.slice(0, 2).map((claim, index) => (
                        <div key={claim.id || index} className="bg-white/10 rounded px-3 py-2">
                          <div className="text-sm font-medium text-white">
                            {claim.type} - {claim.lender}
                          </div>
                          <div className="text-xs text-blue-100">
                            Status: {claim.status}
                            {claim.requirements && claim.requirements.length > 0 && (
                              <span> • {claim.requirements.length} requirements</span>
                            )}
                          </div>
                        </div>
                      ))}
                      {currentCall.userContext.claims.length > 2 && (
                        <div className="text-xs text-blue-100 col-span-full text-center pt-2">
                          +{currentCall.userContext.claims.length - 2} more claims
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                <Button 
                  onClick={() => {
                    const urlParams = new URLSearchParams({
                      userId: currentCall.userContext?.userId?.toString() || '',
                      phone: currentCall.userContext?.phoneNumber || '',
                      name: `${currentCall.userContext?.firstName || ''} ${currentCall.userContext?.lastName || ''}`.trim()
                    });
                    router.push(`/calls/${currentCall.id}?${urlParams.toString()}`);
                  }}
                  className="bg-white text-blue-600 hover:bg-blue-50 shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Manage Call
                </Button>
                
                {currentCall.userContext?.userId && (
                  <Button 
                    onClick={() => {
                      window.open(`https://claim.resolvemyclaim.co.uk/admin/users/${currentCall.userContext.userId}`, '_blank');
                    }}
                    className="bg-white/20 text-white border border-white/30 hover:bg-white/30 shadow-lg hover:shadow-xl transition-all duration-200"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View Profile
                  </Button>
                )}
                
                <Button 
                  onClick={() => endCallMutation.mutate({
                    sessionId: currentCall.id,
                    status: 'completed',
                    endedAt: new Date()
                  })}
                  variant="destructive"
                  className="bg-red-600 hover:bg-red-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
                  disabled={endCallMutation.isLoading}
                >
                  {endCallMutation.isLoading ? 'Ending...' : 'End Call'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Today's Summary */}
        {todaysSummary && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-500 to-cyan-600 text-white">
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-3 rounded-lg bg-white/20 backdrop-blur-sm">
                    <Phone className="h-8 w-8 text-white" />
                  </div>
                  <div className="ml-4">
                    <div className="text-3xl font-bold text-white">{todaysSummary.callsToday}</div>
                    <div className="text-sm text-blue-100">Calls Today</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-0 shadow-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-3 rounded-lg bg-white/20 backdrop-blur-sm">
                    <Users className="h-8 w-8 text-white" />
                  </div>
                  <div className="ml-4">
                    <div className="text-3xl font-bold text-white">{todaysSummary.contactsToday}</div>
                    <div className="text-sm text-emerald-100">Contacts</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-500 to-pink-600 text-white">
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-3 rounded-lg bg-white/20 backdrop-blur-sm">
                    <Clock className="h-8 w-8 text-white" />
                  </div>
                  <div className="ml-4">
                    <div className="text-3xl font-bold text-white">
                      {Math.round(todaysSummary.avgTalkTime)}m
                    </div>
                    <div className="text-sm text-purple-100">Avg Talk Time</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-0 shadow-lg bg-gradient-to-br from-orange-500 to-red-600 text-white">
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-3 rounded-lg bg-white/20 backdrop-blur-sm">
                    <TrendingUp className="h-8 w-8 text-white" />
                  </div>
                  <div className="ml-4">
                    <div className="text-3xl font-bold text-white">
                      {Math.round(todaysSummary.contactRate)}%
                    </div>
                    <div className="text-sm text-orange-100">Success Rate</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm hover:shadow-2xl transition-all duration-300">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-lg">
              <CardTitle className="flex items-center gap-2 text-slate-800">
                <BarChart3 className="w-6 h-6 text-blue-600" />
                Call History
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <p className="text-slate-600 mb-6 leading-relaxed">
                View detailed call records, analytics, and performance metrics to track your progress and improve your calling strategy.
              </p>
              <Button 
                onClick={() => router.push('/calls/history')}
                size="default"
                responsive="nowrap"
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all duration-200"
              >
                <Clock className="w-4 h-4 mr-2" />
                View Call History
              </Button>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm hover:shadow-2xl transition-all duration-300">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-lg">
              <CardTitle className="flex items-center gap-2 text-slate-800">
                <Phone className="w-6 h-6 text-emerald-600" />
                Queue Management
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <p className="text-slate-600 mb-6 leading-relaxed">
                Go to the queue to start making calls and manage your call list. Find users who need to be contacted.
              </p>
              <Button 
                onClick={() => router.push('/queue/unsigned')}
                variant="outline"
                size="default"
                responsive="nowrap"
                className="w-full border-2 border-slate-300 text-slate-700 hover:bg-slate-100 hover:border-slate-400 shadow-md hover:shadow-lg transition-all duration-200"
              >
                <Phone className="w-4 h-4 mr-2" />
                Go to Queue
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Additional Information */}
        <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-lg">
            <CardTitle className="text-slate-800">Call Management Features</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-blue-100">
                  <Phone className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 mb-1">Outbound Calling</h3>
                  <p className="text-sm text-slate-600">Make calls directly from the queue with integrated dialer</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-emerald-100">
                  <BarChart3 className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 mb-1">Performance Tracking</h3>
                  <p className="text-sm text-slate-600">Monitor call outcomes and success rates in real-time</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-purple-100">
                  <Clock className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 mb-1">Call Recording</h3>
                  <p className="text-sm text-slate-600">Automatic recording and storage for quality assurance</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 