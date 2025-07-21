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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="space-y-6 p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-3">
              <LinkIcon className="w-8 h-8 text-blue-600" />
              Magic Links
            </h1>
            <p className="text-slate-600 mt-2 text-lg">
              Send secure links to users for passwordless access to their claims
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm hover:shadow-2xl transition-all duration-300">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-t-lg">
              <CardTitle className="flex items-center gap-3 text-blue-800">
                <div className="p-2 rounded-lg bg-blue-500 text-white">
                  <Send className="w-6 h-6" />
                </div>
                Send Magic Link
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <p className="text-slate-600 mb-6 leading-relaxed">
                Send a secure link to a user via SMS or WhatsApp for passwordless access to their claim portal.
              </p>
              <Button className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all duration-200" disabled>
                <Send className="w-4 h-4 mr-2" />
                Coming Soon
              </Button>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm hover:shadow-2xl transition-all duration-300">
            <CardHeader className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-t-lg">
              <CardTitle className="flex items-center gap-3 text-emerald-800">
                <div className="p-2 rounded-lg bg-emerald-500 text-white">
                  <Clock className="w-6 h-6" />
                </div>
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <p className="text-slate-600 mb-6 leading-relaxed">
                View recently sent magic links and their status, including click-through rates and user engagement.
              </p>
              <Button variant="outline" className="w-full border-2 border-slate-300 text-slate-700 hover:bg-slate-100 hover:border-slate-400 shadow-md hover:shadow-lg transition-all duration-200" disabled>
                <Clock className="w-4 h-4 mr-2" />
                View Activity
              </Button>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm hover:shadow-2xl transition-all duration-300">
            <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-t-lg">
              <CardTitle className="flex items-center gap-3 text-purple-800">
                <div className="p-2 rounded-lg bg-purple-500 text-white">
                  <User className="w-6 h-6" />
                </div>
                User Analytics
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <p className="text-slate-600 mb-6 leading-relaxed">
                Track magic link usage and user engagement metrics to optimize your communication strategy.
              </p>
              <Button variant="outline" className="w-full border-2 border-slate-300 text-slate-700 hover:bg-slate-100 hover:border-slate-400 shadow-md hover:shadow-lg transition-all duration-200" disabled>
                <User className="w-4 h-4 mr-2" />
                View Analytics
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Info Card */}
        <Card className="border-0 shadow-xl bg-gradient-to-r from-blue-500 to-cyan-600 text-white">
          <CardHeader>
            <CardTitle className="text-white text-xl flex items-center gap-2">
              <LinkIcon className="w-6 h-6" />
              Magic Links Feature
            </CardTitle>
          </CardHeader>
          <CardContent className="text-white">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-white/20 backdrop-blur-sm">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <span>Secure, time-limited links for user authentication</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-white/20 backdrop-blur-sm">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <span>Send via SMS or WhatsApp directly from call interface</span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-white/20 backdrop-blur-sm">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <span>Track when users access their claims portal</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-white/20 backdrop-blur-sm">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <span>Compatible with existing claim portal system</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Placeholder for future development */}
        <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-lg">
            <CardTitle className="text-slate-800">Magic Links Management</CardTitle>
          </CardHeader>
          <CardContent className="p-8">
            <div className="text-center py-12">
              <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center">
                <LinkIcon className="w-12 h-12 text-blue-600" />
              </div>
              <h3 className="text-2xl font-semibold text-slate-800 mb-4">
                Magic Links Interface
              </h3>
              <p className="text-slate-600 mb-8 text-lg leading-relaxed max-w-2xl mx-auto">
                This feature is currently being developed. You can send magic links directly 
                from the call interface during conversations with users.
              </p>
              
              <div className="flex justify-center gap-4">
                <Button asChild className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all duration-200">
                  <a href="/calls/test">
                    <Phone className="w-4 h-4 mr-2" />
                    Test Call Interface
                  </a>
                </Button>
                <Button variant="outline" asChild className="border-2 border-slate-300 text-slate-700 hover:bg-slate-100 hover:border-slate-400 shadow-md hover:shadow-lg transition-all duration-200">
                  <a href="/queue">
                    <User className="w-4 h-4 mr-2" />
                    Go to Queue
                  </a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Feature Preview */}
        <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-lg">
            <CardTitle className="text-slate-800">How Magic Links Work</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-6 rounded-lg bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200">
                <div className="w-16 h-16 mx-auto mb-4 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-xl">1</span>
                </div>
                <h4 className="font-semibold text-slate-800 mb-2">Generate Link</h4>
                <p className="text-sm text-slate-600">Create a secure, time-limited link for the user during your call</p>
              </div>
              
              <div className="text-center p-6 rounded-lg bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200">
                <div className="w-16 h-16 mx-auto mb-4 bg-emerald-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-xl">2</span>
                </div>
                <h4 className="font-semibold text-slate-800 mb-2">Send via SMS</h4>
                <p className="text-sm text-slate-600">Link is automatically sent to the user's phone via SMS or WhatsApp</p>
              </div>
              
              <div className="text-center p-6 rounded-lg bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200">
                <div className="w-16 h-16 mx-auto mb-4 bg-purple-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-xl">3</span>
                </div>
                <h4 className="font-semibold text-slate-800 mb-2">User Access</h4>
                <p className="text-sm text-slate-600">User clicks link to access their claim portal without passwords</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 