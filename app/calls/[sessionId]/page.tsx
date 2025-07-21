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
            <span className="text-sm text-gray-600">Agent: Authenticated User</span>
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