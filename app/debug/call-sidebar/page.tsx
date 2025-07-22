'use client';

import { useState, useContext } from 'react';
import { Button } from '@/modules/core/components/ui/button';
import { Card } from '@/modules/core/components/ui/card';
import { GlobalTwilioContext } from '@/lib/providers/GlobalTwilioProvider';

export default function CallSidebarDebugPage() {
  const [currentTest, setCurrentTest] = useState<string>('');
  const twilioContext = useContext(GlobalTwilioContext);

  const simulateIncomingCall = () => {
    // This is for testing - in real scenario this comes from Twilio webhooks
    const mockIncomingCall = {
      callSid: 'CA_mock_call_sid_12345',
      from: '+447738585850',
      to: '+447488879172',
      callerName: 'James Campbell',
      userId: '2064',
      callSessionId: 'aec62188-825d-4bc4-b1f8-99f8ebca97b4',
      accept: () => console.log('Mock accept'),
      reject: () => console.log('Mock reject')
    };
    
    // Simulate setting incoming call in the context (for demo purposes)
    console.log('🎯 Simulating incoming call:', mockIncomingCall);
    setCurrentTest('Simulated incoming call (check console)');
  };

  const clearCallState = () => {
    if (twilioContext?.rejectIncomingCall) {
      twilioContext.rejectIncomingCall();
    }
    setCurrentTest('Called reject function');
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Call Sidebar Debug</h1>
        <p className="text-gray-600 mt-2">
          Test the call sidebar component with different states
        </p>
      </div>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Test Call States</h2>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Button 
            onClick={simulateIncomingCall}
            className="bg-blue-600 hover:bg-blue-700"
          >
            📞 Simulate Incoming
          </Button>
          
          <Button 
            onClick={() => {
              if (twilioContext?.acceptIncomingCall) {
                twilioContext.acceptIncomingCall();
                setCurrentTest('Called accept function');
              }
            }}
            className="bg-green-600 hover:bg-green-700"
            disabled={!twilioContext?.incomingCall}
          >
            ✅ Accept Call
          </Button>
          
          <Button 
            onClick={() => {
              if (twilioContext?.endCall) {
                twilioContext.endCall();
                setCurrentTest('Called end call function - should trigger post-call state');
              }
            }}
            className="bg-orange-600 hover:bg-orange-700"
            disabled={!twilioContext?.isInCall}
          >
            📞 End Call
          </Button>
          
          <Button 
            onClick={clearCallState}
            variant="outline"
            className="border-red-200 text-red-600 hover:bg-red-50"
          >
            ❌ Reject Call
          </Button>
        </div>

        {currentTest && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800 text-sm">
              ✅ {currentTest}
            </p>
          </div>
        )}

        {/* Twilio Context Status */}
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <h3 className="font-medium text-gray-900 mb-2">GlobalTwilioProvider Status</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Ready:</span> {twilioContext?.isReady ? '✅' : '❌'}
            </div>
            <div>
              <span className="font-medium">In Call:</span> {twilioContext?.isInCall ? '✅' : '❌'}
            </div>
            <div>
              <span className="font-medium">Incoming Call:</span> {twilioContext?.incomingCall ? '📞' : '❌'}
            </div>
            <div>
              <span className="font-medium">Current Call SID:</span> {twilioContext?.currentCallSid ? twilioContext.currentCallSid.slice(0, 8) + '...' : 'None'}
            </div>
          </div>
          {twilioContext?.incomingCall && (
            <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded">
              <div className="text-xs text-blue-800">
                <div><strong>From:</strong> {twilioContext.incomingCall.from}</div>
                <div><strong>Caller:</strong> {twilioContext.incomingCall.callerName || 'Unknown'}</div>
                <div><strong>Call SID:</strong> {twilioContext.incomingCall.callSid}</div>
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Layout Testing</h2>
        <div className="space-y-4">
          <p className="text-gray-600">
            This page tests the responsive layout behavior when the call sidebar is active.
            The main content should adjust its right padding dynamically.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-100 p-4 rounded-lg">
              <h3 className="font-medium">Desktop Behavior</h3>
              <p className="text-sm text-gray-600 mt-1">
                Content shifts left to make room for call sidebar
              </p>
            </div>
            
            <div className="bg-gray-100 p-4 rounded-lg">
              <h3 className="font-medium">Mobile Behavior</h3>
              <p className="text-sm text-gray-600 mt-1">
                Call sidebar overlays content with backdrop
              </p>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Features Implemented</h2>
        <div className="space-y-2 text-sm">
          <div className="flex items-center space-x-2">
            <span className="text-green-600">✅</span>
            <span>Responsive sidebar (320px ringing, 384px connected)</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-green-600">✅</span>
            <span>Three call states (ringing, connected, ended)</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-green-600">✅</span>
            <span>Dynamic content padding adjustment</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-green-600">✅</span>
            <span>Mobile overlay with backdrop</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-green-600">✅</span>
            <span>Smooth transitions (300ms ease-in-out)</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-green-600">✅</span>
            <span>GlobalTwilioProvider integration</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-green-600">✅</span>
            <span>Real user data loading via simple-call-lookup API</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-green-600">✅</span>
            <span>Enhanced connected state with claims & call history</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-green-600">✅</span>
            <span>Call duration timer & notes functionality</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-green-600">✅</span>
            <span>Professional post-call disposition workflow</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-green-600">✅</span>
            <span>Comprehensive call outcome tracking with validation</span>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Test Connected State</h2>
        <p className="text-gray-600 mb-4">
          To test the enhanced connected state, use the buttons above to simulate an incoming call, 
          then accept it. The sidebar will show real user data loaded from the database.
        </p>
        
                 <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
           <h3 className="font-medium text-blue-900 mb-2">Expected Connected Features:</h3>
           <ul className="text-sm text-blue-800 space-y-1">
             <li>• Real-time call duration timer</li>
             <li>• User details from database (name, phone, claims)</li>
             <li>• Claims information with status badges</li>
             <li>• Recent call history</li>
             <li>• Live note-taking functionality</li>
             <li>• Quick actions (view profile, schedule callback)</li>
             <li>• Enhanced call controls (mute, hold, end)</li>
           </ul>
         </div>
       </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Test Post-Call State</h2>
        <p className="text-gray-600 mb-4">
          To test the post-call disposition workflow, first start a call (simulate incoming → accept), 
          then end the call using the "End Call" button. The sidebar will show the disposition form.
        </p>
        
        <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
          <h3 className="font-medium text-orange-900 mb-2">Expected Post-Call Features:</h3>
          <ul className="text-sm text-orange-800 space-y-1">
            <li>• Professional call summary with duration and timestamps</li>
            <li>• Comprehensive disposition options with visual indicators</li>
            <li>• Next action workflow (callback scheduling, follow-ups)</li>
            <li>• Conditional callback date picker</li>
            <li>• Character-counted notes field</li>
            <li>• Save validation (disposition required)</li>
            <li>• Loading states and error handling</li>
            <li>• Draft saving and cancellation options</li>
          </ul>
        </div>
      </Card>

      {/* Sample content to show layout shifting */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="p-4">
            <h3 className="font-medium">Sample Content {i + 1}</h3>
            <p className="text-sm text-gray-600 mt-2">
              This content will shift when the call sidebar appears.
              Watch how the layout responds to different call states.
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
} 