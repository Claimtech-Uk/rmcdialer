'use client';

import { useState } from 'react';
import { api } from '@/lib/trpc/client';
import { Button } from '@/modules/core/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/modules/core/components/ui/dialog';
import { Plus } from 'lucide-react';

export default function AddAgentTest() {
  const [isOpen, setIsOpen] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  // Test auth state
  const { data: currentUser, isLoading: userLoading, error: userError } = api.auth.me.useQuery();

  // Test create agent mutation
  const createAgentMutation = api.auth.createAgent.useMutation({
    onSuccess: (data) => {
      setTestResult({ success: true, data });
      alert('Agent created successfully!');
    },
    onError: (error) => {
      setTestResult({ success: false, error: error.message });
      alert(`Error: ${error.message}`);
    }
  });

  const handleTestCreate = () => {
    console.log('Testing agent creation...');
    createAgentMutation.mutate({
      email: 'test@example.com',
      password: 'password123',
      firstName: 'Test',
      lastName: 'Agent',
      role: 'agent',
      isAiAgent: false
    });
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Add Agent Debug Test</h1>
      
      {/* Auth Status */}
      <div className="bg-gray-100 p-4 rounded">
        <h3 className="font-semibold">Auth Status:</h3>
        {userLoading && <p>Loading user...</p>}
        {userError && <p className="text-red-600">Auth Error: {userError.message}</p>}
        {currentUser && (
          <pre className="text-sm">
            {JSON.stringify({
              role: currentUser.agent?.role,
              email: currentUser.agent?.email,
              isAdmin: currentUser.agent?.role === 'admin'
            }, null, 2)}
          </pre>
        )}
      </div>

      {/* Test Buttons */}
      <div className="space-y-4">
        <Button 
          onClick={() => {
            console.log('Simple button test');
            alert('Button works!');
          }}
        >
          Test Simple Button
        </Button>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Test Dialog Button
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Test Dialog</DialogTitle>
            </DialogHeader>
            <p>If you can see this, the Dialog component is working!</p>
            <Button onClick={() => setIsOpen(false)}>Close</Button>
          </DialogContent>
        </Dialog>

        {currentUser?.agent?.role === 'admin' && (
          <Button 
            onClick={handleTestCreate}
            disabled={createAgentMutation.isPending}
          >
            {createAgentMutation.isPending ? 'Creating...' : 'Test Create Agent'}
          </Button>
        )}
      </div>

      {/* Test Results */}
      {testResult && (
        <div className="bg-gray-100 p-4 rounded">
          <h3 className="font-semibold">Test Result:</h3>
          <pre className="text-sm">
            {JSON.stringify(testResult, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
} 