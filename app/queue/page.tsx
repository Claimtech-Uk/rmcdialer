'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { api } from '@/lib/trpc/client';
import { 
  PenTool, 
  FileText, 
  Users,
  ArrowRight,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/modules/core/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/modules/core/components/ui/card';
import { Alert, AlertDescription } from '@/modules/core/components/ui/alert';

export default function QueueSelectionPage() {
  const router = useRouter();
  const { data: session, isLoading } = api.auth.me.useQuery();

  // Auto-redirect agents to their primary queue (unsigned users - highest priority)
  useEffect(() => {
    if (session?.agent?.role === 'agent') {
      router.push('/queue/unsigned');
    }
  }, [session, router]);

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Users className="h-8 w-8 animate-pulse text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading queue options...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Please log in to access the queue system.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight flex items-center justify-center gap-3 mb-2">
          <Users className="w-8 h-8 text-blue-600" />
          Call Queue Selection
        </h1>
        <p className="text-muted-foreground">
          Choose your specialized queue to start making calls
        </p>
      </div>

      {/* Queue Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Unsigned Users Queue */}
        <Card className="hover:shadow-lg transition-shadow cursor-pointer border-orange-200 hover:border-orange-300">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <PenTool className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <CardTitle className="text-xl text-orange-700">Unsigned Users</CardTitle>
                <p className="text-sm text-gray-600">Highest Priority</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-gray-700">
              <p className="mb-3">
                <strong>Focus:</strong> Users who need to provide their digital signature to proceed with their claim.
              </p>
              <ul className="space-y-1 text-gray-600">
                <li>• Missing signatures block claim progress</li>
                <li>• Critical for claim completion</li>
                <li>• Quick resolution potential</li>
              </ul>
            </div>
            
            <Button 
              onClick={() => router.push('/queue/unsigned')}
              className="w-full bg-orange-600 hover:bg-orange-700"
            >
              Start Calling Unsigned Users
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>

        {/* Requirements Queue */}
        <Card className="hover:shadow-lg transition-shadow cursor-pointer border-blue-200 hover:border-blue-300">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-xl text-blue-700">Requirements</CardTitle>
                <p className="text-sm text-gray-600">Important Follow-ups</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-gray-700">
              <p className="mb-3">
                <strong>Focus:</strong> Users with pending document requirements who already have signatures.
              </p>
              <ul className="space-y-1 text-gray-600">
                <li>• Outstanding document requests</li>
                <li>• Evidence gathering phase</li>
                <li>• Claim refinement needed</li>
              </ul>
            </div>
            
            <Button 
              onClick={() => router.push('/queue/requirements')}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              Start Calling Requirements
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Agent Guidance */}
      <Card className="bg-gray-50">
        <CardContent className="p-4">
          <div className="text-sm text-gray-600">
            <h3 className="font-medium text-gray-900 mb-2">💡 Agent Guidance</h3>
            <ul className="space-y-1">
              <li>• <strong>New agents:</strong> Start with Unsigned Users - they're typically quicker calls</li>
              <li>• <strong>Experienced agents:</strong> Requirements calls may involve more complex document discussions</li>
              <li>• <strong>Focus on one queue:</strong> Specializing helps you become more effective at that call type</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 