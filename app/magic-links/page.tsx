'use client';

import { useState } from 'react';
import { api } from '@/lib/trpc/client';
import { 
  Link as LinkIcon, 
  Send, 
  Copy, 
  ExternalLink,
  Clock,
  User,
  Phone,
  CheckCircle
} from 'lucide-react';
import { Button } from '@/modules/core/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/modules/core/components/ui/card';

export default function MagicLinksPage() {
  const [selectedUser, setSelectedUser] = useState<any>(null);

  // Get current session for user info
  const { data: session } = api.auth.me.useQuery();
  
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <LinkIcon className="w-8 h-8 text-blue-600" />
            Magic Links
          </h1>
          <p className="text-muted-foreground">
            Send secure links to users for passwordless access to their claims
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-blue-500" />
              Send Magic Link
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Send a secure link to a user via SMS or WhatsApp
            </p>
            <Button className="w-full" disabled>
              <Send className="w-4 h-4 mr-2" />
              Coming Soon
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-green-500" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              View recently sent magic links and their status
            </p>
            <Button variant="outline" className="w-full" disabled>
              <Clock className="w-4 h-4 mr-2" />
              View Activity
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-purple-500" />
              User Analytics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Track magic link usage and user engagement
            </p>
            <Button variant="outline" className="w-full" disabled>
              <User className="w-4 h-4 mr-2" />
              View Analytics
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-blue-800">Magic Links Feature</CardTitle>
        </CardHeader>
        <CardContent className="text-blue-700">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <span>Secure, time-limited links for user authentication</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <span>Send via SMS or WhatsApp directly from call interface</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <span>Track when users access their claims portal</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <span>Compatible with existing claim portal system</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Placeholder for future development */}
      <Card>
        <CardHeader>
          <CardTitle>Magic Links Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <LinkIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Magic Links Interface
            </h3>
            <p className="text-gray-500 mb-6">
              This feature is currently being developed. You can send magic links directly 
              from the call interface during conversations with users.
            </p>
            
            <div className="flex justify-center gap-4">
              <Button asChild>
                <a href="/calls/test">
                  <Phone className="w-4 h-4 mr-2" />
                  Test Call Interface
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a href="/queue">
                  <User className="w-4 h-4 mr-2" />
                  Go to Queue
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 