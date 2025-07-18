'use client';

import { useState, useEffect } from 'react';
import { useTwilioVoice } from '@/modules/calls/hooks/useTwilioVoice';
import { CallInterface } from '@/modules/calls';
import { api } from '@/lib/trpc/client';
import type { UserCallContext } from '@/modules/users';
import type { CallOutcomeOptions, UserCallContext as CallUserContext } from '@/modules/calls';

// Format duration from seconds to MM:SS
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export default function TestCallPage() {
  const [selectedUser, setSelectedUser] = useState<UserCallContext | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('+447738585850'); // Your test number
  const [showProfessionalUI, setShowProfessionalUI] = useState(false);
  
  // Mock agent info (in production, get from auth context)
  const agentId = 'test_agent_1';
  const agentEmail = 'test@rmcdialer.app';
  
  // Initialize Twilio Voice
  const {
    isReady,
    isConnecting,
    isInCall,
    callStatus,
    error,
    makeCall,
    hangUp,
    toggleMute,
    sendDigits,
    callDuration,
    isMuted
  } = useTwilioVoice({
    agentId,
    agentEmail,
    autoConnect: true
  });
  
  // Fetch eligible users with real data
  const { data: eligibleUsers, isLoading } = api.users.getEligibleUsers.useQuery({
    limit: 10,
    filters: { hasRequirements: true }
  });

  // Fetch the specific test user (James Campbell ID 5777) for testing
  const { data: testUser, isLoading: isLoadingTestUser } = api.users.getTestUser.useQuery();
  
  // Handle making a call
  const handleMakeCall = async () => {
    if (!selectedUser && !phoneNumber) {
      alert('Please enter a phone number or select a user');
      return;
    }
    
    try {
      await makeCall({
        phoneNumber: phoneNumber,
        userContext: selectedUser ? {
          userId: selectedUser.user.id,
          firstName: selectedUser.user.firstName || 'Unknown',
          lastName: selectedUser.user.lastName || 'User',
          claimId: selectedUser.claims[0]?.id
        } : undefined
      });
    } catch (err) {
      console.error('Failed to make call:', err);
    }
  };
  
  // Handle DTMF pad
  const handleDigit = (digit: string) => {
    sendDigits(digit);
  };

  // Handle call outcome completion
  const handleCallComplete = (outcome: CallOutcomeOptions) => {
    console.log('Call completed with outcome:', outcome);
    // In production, this would trigger navigation to next user or dashboard
  };

  // Convert between UserCallContext types (users module vs calls module)
  const convertToCallUserContext = (user: UserCallContext): CallUserContext => {
    return {
      userId: user.user.id,
      firstName: user.user.firstName || 'Unknown',
      lastName: user.user.lastName || 'User',
      email: user.user.email || '',
      phoneNumber: user.user.phoneNumber || '',
      address: user.user.address ? {
        fullAddress: user.user.address.fullAddress || '',
        postCode: user.user.address.postCode || '',
        county: user.user.address.county || ''
      } : undefined,
      claims: user.claims.map(claim => ({
        id: claim.id,
        type: claim.type || 'Unknown',
        status: claim.status || 'Unknown',
        lender: claim.lender || 'Unknown',
        value: 0, // Remove claim.value as it doesn't exist in ClaimContext
        requirements: claim.requirements.map(req => ({
          id: req.id,
          type: req.type || 'Unknown',
          status: req.status || 'Unknown',
          reason: req.reason || 'No reason provided'
        })),
        vehiclePackages: claim.vehiclePackages?.map(vp => ({
          registration: vp.registration || '',
          make: vp.make || '',
          model: vp.model || '',
          dealershipName: vp.dealership || '',
          monthlyPayment: vp.monthlyPayment || undefined
        }))
      })),
      callScore: user.callScore ? {
        currentScore: user.callScore.currentScore || 50,
        lastOutcome: user.callScore.lastOutcome || undefined,
        totalAttempts: user.callScore.totalAttempts || 0,
        lastCallAt: user.callScore.lastCallAt || undefined
      } : {
        currentScore: 50,
        totalAttempts: 0
      }
    };
  };
  
  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <h1 className="text-3xl font-bold mb-8">🎧 Twilio Voice SDK Test</h1>
      
      {/* Status Banner */}
      <div className={`p-4 rounded-lg mb-6 ${
        isReady ? 'bg-green-100 text-green-800' : 
        isConnecting ? 'bg-yellow-100 text-yellow-800' : 
        'bg-gray-100 text-gray-800'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <span className="font-medium">Twilio Status: </span>
            {isConnecting ? 'Connecting...' : isReady ? 'Ready' : 'Not Connected'}
          </div>
          {callStatus && (
            <div className="text-sm">
              Call State: <span className="font-medium">{callStatus.state}</span>
              {callStatus.callSid && <span className="ml-2 text-xs">({callStatus.callSid})</span>}
            </div>
          )}
        </div>
        {error && (
          <div className="mt-2 text-sm text-red-600">Error: {error}</div>
        )}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Call Controls */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">📞 Call Controls</h2>
          
          {/* Phone Number Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Phone Number</label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+447738585850"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isInCall}
            />
          </div>
          
          {/* Call Duration Display */}
          {isInCall && (
            <div className="mb-4 text-center">
              <div className="text-3xl font-mono font-bold text-blue-600">
                {formatDuration(callDuration)}
              </div>
              <div className="text-sm text-gray-500">Call Duration</div>
            </div>
          )}
          
          {/* Main Call Button */}
          <div className="flex justify-center mb-6">
            {!isInCall ? (
              <button
                onClick={handleMakeCall}
                disabled={!isReady || !phoneNumber}
                className={`px-8 py-4 rounded-full text-white font-medium transition-all ${
                  isReady && phoneNumber
                    ? 'bg-green-500 hover:bg-green-600 shadow-lg hover:shadow-xl'
                    : 'bg-gray-400 cursor-not-allowed'
                }`}
              >
                <span className="flex items-center gap-2">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  Make Call
                </span>
              </button>
            ) : (
              <button
                onClick={hangUp}
                className="px-8 py-4 rounded-full bg-red-500 hover:bg-red-600 text-white font-medium shadow-lg hover:shadow-xl transition-all"
              >
                <span className="flex items-center gap-2">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Hang Up
                </span>
              </button>
            )}
          </div>
          
          {/* In-Call Controls */}
          {isInCall && (
            <div className="flex justify-center gap-4">
              <button
                onClick={toggleMute}
                className={`p-3 rounded-full transition-all ${
                  isMuted ? 'bg-red-500 text-white' : 'bg-gray-200 hover:bg-gray-300'
                }`}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {isMuted ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15L4.172 13.586A2 2 0 013 11.172V9a5 5 0 0110 0v2.172a2 2 0 01-1.172 2.414L10.414 15M19 9v2a7 7 0 01-14 0V9m14 0a3 3 0 00-3-3m-5 3a3 3 0 00-3-3" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  )}
                </svg>
              </button>
            </div>
          )}
          
          {/* DTMF Keypad (for in-call) */}
          {isInCall && (
            <div className="mt-6">
              <h3 className="text-sm font-medium mb-2 text-center">Dial Pad</h3>
              <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((digit) => (
                  <button
                    key={digit}
                    onClick={() => handleDigit(digit)}
                    className="p-3 bg-gray-100 hover:bg-gray-200 rounded-lg font-mono text-lg transition-colors"
                  >
                    {digit}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* User Selection */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">👥 Select User (Real Data)</h2>
          
          {/* Test User Button */}
          {testUser?.data && (
            <div className="mb-6 p-4 bg-blue-50 border-l-4 border-blue-500 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-blue-900">🎯 Production Test User</div>
                  <div className="text-sm text-blue-700 mt-1">
                    {testUser.data.user.firstName} {testUser.data.user.lastName} - {testUser.data.user.phoneNumber}
                  </div>
                  <div className="text-xs text-blue-600 mt-1">
                    {testUser.data.claims.length} claims, {testUser.data.claims.reduce((acc, c) => acc + c.requirements.length, 0)} requirements
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedUser(testUser.data);
                    setPhoneNumber(testUser.data.user.phoneNumber || '');
                  }}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    selectedUser?.user.id === testUser.data.user.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                  }`}
                >
                  {selectedUser?.user.id === testUser.data.user.id ? '✓ Selected' : 'Use Test User'}
                </button>
              </div>
            </div>
          )}

          {/* Database Status */}
          <div className="mb-4 text-sm">
            <div className="flex items-center gap-4">
              <div className={`flex items-center gap-2 ${eligibleUsers ? 'text-green-600' : 'text-red-600'}`}>
                <div className={`w-2 h-2 rounded-full ${eligibleUsers ? 'bg-green-500' : 'bg-red-500'}`}></div>
                Replica DB: {eligibleUsers ? 'Connected' : 'Disconnected'}
              </div>
              <div className={`flex items-center gap-2 ${testUser ? 'text-green-600' : 'text-yellow-600'}`}>
                <div className={`w-2 h-2 rounded-full ${testUser ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                Test User: {testUser ? 'Loaded' : isLoadingTestUser ? 'Loading...' : 'Failed'}
              </div>
            </div>
          </div>
          
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading users...</div>
          ) : eligibleUsers?.data && eligibleUsers.data.length > 0 ? (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {eligibleUsers.data.map((user) => (
                <div
                  key={user.user.id}
                  onClick={() => {
                    setSelectedUser(user);
                    setPhoneNumber(user.user.phoneNumber || '');
                  }}
                  className={`p-3 rounded-lg cursor-pointer transition-all ${
                    selectedUser?.user.id === user.user.id
                      ? 'bg-blue-100 border-2 border-blue-500'
                      : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                  }`}
                >
                  <div className="font-medium">
                    {user.user.firstName} {user.user.lastName}
                  </div>
                  <div className="text-sm text-gray-600">
                    📱 {user.user.phoneNumber || 'No phone'}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {user.claims.length} claims, {user.claims.reduce((acc, c) => acc + c.requirements.length, 0)} requirements
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">No eligible users found</div>
          )}
          
          {selectedUser && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <div className="text-sm font-medium">Selected User:</div>
              <div className="text-sm mt-1">
                {selectedUser.user.firstName} {selectedUser.user.lastName} - {selectedUser.user.phoneNumber}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* UI Mode Toggle */}
      <div className="mt-8 flex justify-center">
        <div className="bg-white rounded-lg border p-1 flex">
          <button
            onClick={() => setShowProfessionalUI(false)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              !showProfessionalUI 
                ? 'bg-blue-500 text-white' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Test Interface
          </button>
          <button
            onClick={() => setShowProfessionalUI(true)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              showProfessionalUI 
                ? 'bg-blue-500 text-white' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Professional Interface
          </button>
        </div>
      </div>

      {/* Professional Call Interface */}
      {showProfessionalUI && selectedUser && (
        <div className="mt-8">
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h2 className="text-xl font-semibold text-blue-800 mb-2">
              🎯 Professional Call Interface
            </h2>
            <p className="text-blue-700">
              This is the production-ready interface that agents will use. It includes user context, 
              call controls, and automatic outcome recording after each call.
            </p>
          </div>
          
          <CallInterface
            userContext={convertToCallUserContext(selectedUser)}
            onCallComplete={handleCallComplete}
            agentId={agentId}
            agentEmail={agentEmail}
          />
        </div>
      )}
      
      {/* Instructions */}
      <div className={`mt-8 bg-gray-50 rounded-lg p-6 ${showProfessionalUI ? 'hidden' : ''}`}>
        <h3 className="font-semibold mb-2">📋 Test Instructions:</h3>
        <ul className="space-y-1 text-sm text-gray-700">
          <li>• Twilio Device will auto-connect when page loads</li>
          <li>• Enter a phone number or select a user from the list</li>
          <li>• Click "Make Call" to initiate an outbound call</li>
          <li>• Use the mute button and dial pad during calls</li>
          <li>• Your test number is pre-filled: +447738585850</li>
          <li>• Call status and duration will update in real-time</li>
        </ul>
      </div>
    </div>
  );
} 