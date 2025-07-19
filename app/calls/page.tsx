'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/modules/core/components/ui/card';
import { Button } from '@/modules/core/components/ui/button';
import { Phone, Clock, TrendingUp, Users } from 'lucide-react';
import { api } from '@/lib/trpc/client';

export default function CallsPage() {
  const router = useRouter();
  
  // Get current call if any
  const { data: currentCall } = api.calls.getCurrentCall.useQuery();
  
  // Get today's summary
  const { data: todaysSummary } = api.calls.getTodaysSummary.useQuery();

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Phone className="w-6 h-6 text-primary" />
            Call Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your calls and view performance metrics
          </p>
        </div>
      </div>

      {/* Current Call Status */}
      {currentCall && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-blue-800">Active Call in Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">
                  {currentCall.userContext?.firstName} {currentCall.userContext?.lastName}
                </p>
                <p className="text-sm text-blue-600">
                  Status: {currentCall.status}
                </p>
              </div>
              <Button 
                onClick={() => router.push(`/calls/${currentCall.id}`)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Manage Call
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Today's Summary */}
      {todaysSummary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Phone className="h-8 w-8 text-primary mr-3" />
                <div>
                  <div className="text-2xl font-bold">{todaysSummary.callsToday}</div>
                  <div className="text-sm text-muted-foreground">Calls Today</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-green-500 mr-3" />
                <div>
                  <div className="text-2xl font-bold">{todaysSummary.contactsToday}</div>
                  <div className="text-sm text-muted-foreground">Contacts</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Clock className="h-8 w-8 text-blue-500 mr-3" />
                <div>
                  <div className="text-2xl font-bold">
                    {Math.round(todaysSummary.avgTalkTime)}m
                  </div>
                  <div className="text-sm text-muted-foreground">Avg Talk Time</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <TrendingUp className="h-8 w-8 text-purple-500 mr-3" />
                <div>
                  <div className="text-2xl font-bold">
                    {Math.round(todaysSummary.contactRate)}%
                  </div>
                  <div className="text-sm text-muted-foreground">Success Rate</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Call History</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              View detailed call records, analytics, and performance metrics.
            </p>
            <Button 
              onClick={() => router.push('/calls/history')}
              className="w-full"
            >
              <Clock className="w-4 h-4 mr-2" />
              View Call History
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Queue Management</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Go to the queue to start making calls and manage your call list.
            </p>
            <Button 
              onClick={() => router.push('/queue/unsigned')}
              variant="outline"
              className="w-full"
            >
              <Phone className="w-4 h-4 mr-2" />
              Go to Queue
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 