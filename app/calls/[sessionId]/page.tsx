'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/trpc/client';
import { CallInterface } from '@/modules/calls/components/CallInterface';
import { Button } from '@/modules/core/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/modules/core/components/ui/card';
import { Alert, AlertDescription } from '@/modules/core/components/ui/alert';
import { ArrowLeft, Phone, User, AlertTriangle } from 'lucide-react';
import { useToast } from '@/modules/core/hooks/use-toast';
import type { UserCallContext, CallOutcomeOptions } from '@/modules/calls/types/call.types';

export default function CallSessionPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  const sessionId = params.sessionId as string;
  const userId = searchParams.get('userId');
  const phoneNumber = searchParams.get('phone');
  const userName = searchParams.get('name');

  // Get complete user details for the call interface
  const { 
    data: userDetailsResponse, 
    isLoading: userLoading,
    error: userError 
  } = api.users.getCompleteUserDetails.useQuery(
    { userId: parseInt(userId || '0') },
    { enabled: !!userId && !isNaN(parseInt(userId)) }
  );

  const userDetails = userDetailsResponse?.data;

  // Handle call completion
  const handleCallComplete = async (outcome: CallOutcomeOptions) => {
    try {
      console.log('Call completed with outcome:', outcome);
      
      toast({
        title: "Call Completed",
        description: `Call outcome: ${outcome.outcomeType.replace('_', ' ')}`,
      });

      // Navigate back to user detail page or queue
      if (userId) {
        router.push(`/users/${userId}`);
      } else {
        router.push('/queue/unsigned');
      }
    } catch (error: any) {
      console.error('Failed to handle call completion:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save call outcome",
        variant: "destructive"
      });
    }
  };

  // Loading state
  if (userLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="p-6 text-center">
            <Phone className="w-8 h-8 animate-pulse text-blue-600 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Loading Call Session</h2>
            <p className="text-gray-600">Preparing call interface...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (userError || !userDetails || !userId || !phoneNumber) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="w-8 h-8 text-red-600 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Session Error</h2>
            <p className="text-gray-600 mb-4">
              {userError?.message || 'Unable to load user details for call session'}
            </p>
            <Button onClick={() => router.push('/queue/unsigned')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Queue
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Build user context for CallInterface
  const userContext: UserCallContext = {
    userId: userDetails.user.id,
    firstName: userDetails.user.firstName || 'Unknown',
    lastName: userDetails.user.lastName || 'User',
    email: userDetails.user.email || `user${userDetails.user.id}@unknown.com`,
    phoneNumber: phoneNumber,
    address: {
      fullAddress: userDetails.addresses?.[0]?.fullAddress || 'Address not available',
      postCode: userDetails.addresses?.[0]?.postCode || '',
      county: userDetails.addresses?.[0]?.county || ''
    },
    claims: userDetails.claims.map(claim => ({
      id: claim.id,
      type: claim.type || 'unknown',
      status: claim.status || 'pending',
      lender: claim.lender || 'Unknown Lender',
      value: 0, // Default value since not in API response
      requirements: claim.requirements.map(req => ({
        id: req.id,
        type: req.type,
        status: req.status,
        reason: req.reason || 'No reason provided'
      })),
      vehiclePackages: claim.vehiclePackages.map(vp => ({
        registration: vp.registration || '',
        make: vp.make || '',
        model: vp.model || '',
        dealershipName: vp.dealership || '',
        monthlyPayment: vp.monthlyPayment || undefined
      }))
    })),
    callScore: {
      currentScore: 75, // Default score
      totalAttempts: 1, // Default attempts
      lastCallAt: undefined
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => router.push(userId ? `/users/${userId}` : '/queue/unsigned')}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-xl font-semibold flex items-center gap-2">
                <Phone className="w-5 h-5 text-blue-600" />
                Call Session: {userContext.firstName} {userContext.lastName}
              </h1>
              <p className="text-sm text-gray-600">
                Session ID: {sessionId} • {phoneNumber}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-600">Agent: agent@rmcdialer.app</span>
          </div>
        </div>
      </div>

      {/* Main Call Interface */}
      <div className="max-w-7xl mx-auto p-6">
        <CallInterface
          userContext={userContext}
          onCallComplete={handleCallComplete}
          agentId="agent_1"
          agentEmail="agent@rmcdialer.app"
        />
      </div>
    </div>
  );
} 