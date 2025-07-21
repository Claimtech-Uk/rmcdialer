'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Phone, ArrowLeft, User } from 'lucide-react';
import { Button } from '@/modules/core/components/ui/button';
import { CallInterface } from '@/modules/calls/components/CallInterface';

// Mock user context for development
const mockUserContext = {
  userId: 5777,
  firstName: 'John',
  lastName: 'Smith', 
  phoneNumber: '+1234567890',
  claims: [{
    id: 1,
    type: 'vehicle',
    status: 'active',
    lender: 'Test Lender',
    value: 25000,
    requirements: [],
    vehiclePackages: []
  }]
}

export default function CallSessionPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const sessionId = params.sessionId as string;
  const userId = searchParams.get('userId');
  const phoneNumber = searchParams.get('phone');
  const userName = searchParams.get('name');

  // Use real user context or fall back to mock
  const userContext = userId ? {
    userId: parseInt(userId),
    firstName: userName?.split(' ')[0] || 'Unknown',
    lastName: userName?.split(' ').slice(1).join(' ') || 'User',
    email: `user${userId}@test.com`,
    phoneNumber: phoneNumber || '+1234567890',
    address: {
      fullAddress: 'Address not available',
      postCode: '',
      county: ''
    },
    claims: mockUserContext.claims,
    callScore: {
      currentScore: 75,
      totalAttempts: 1,
      lastCallAt: undefined
    }
  } : {
    ...mockUserContext,
    email: 'user@test.com',
    address: {
      fullAddress: 'Address not available',
      postCode: '',
      county: ''
    },
    callScore: {
      currentScore: 75,
      totalAttempts: 1,
      lastCallAt: undefined
    }
  }

  const handleCallComplete = (outcome: any) => {
    console.log('Call completed with outcome:', outcome);
    // Could redirect back to queue or user page
    if (userId) {
      router.push(`/users/${userId}`);
    } else {
      router.push('/queue/unsigned');
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-white/20 shadow-lg px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              size="default"
              responsive="nowrap"
              onClick={() => router.push(userId ? `/users/${userId}` : '/queue/unsigned')}
              className="border-2 border-slate-300 hover:bg-slate-100 shadow-md hover:shadow-lg transition-all duration-200"
            >
              <ArrowLeft className="w-4 h-4 mr-2 flex-shrink-0" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-3 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                <Phone className="w-6 h-6 text-blue-600" />
                Call Session: {userContext.firstName} {userContext.lastName}
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Session ID: {sessionId} • {phoneNumber}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-gradient-to-r from-green-50 to-emerald-50 px-4 py-2 rounded-lg border border-green-200 shadow-sm">
            <User className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-medium text-emerald-700">Agent: Authenticated User</span>
          </div>
        </div>
      </div>

      {/* Main Call Interface */}
      <div className="max-w-7xl mx-auto p-6">
        <CallInterface
          userContext={userContext}
          onCallComplete={handleCallComplete}
        />
      </div>
    </div>
  );
} 