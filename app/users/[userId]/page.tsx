'use client';

import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/trpc/client';
import { 
  ArrowLeft,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  FileText,
  AlertTriangle,
  Clock,
  Building,
  Shield,
  MessageSquare,
  History,
  Link2,
  BarChart3
} from 'lucide-react';
import { Button } from '@/modules/core/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/modules/core/components/ui/card';
import { Badge } from '@/modules/core/components/ui/badge';
import { Alert, AlertDescription } from '@/modules/core/components/ui/alert';
import { useToast } from '@/modules/core/hooks/use-toast';
import { CallHistoryTable } from '@/modules/calls/components/CallHistoryTable';

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const userId = params.userId as string;

  // Fetch user details
  const { 
    data: userDetailsResponse, 
    isLoading, 
    error 
  } = api.users.getCompleteUserDetails.useQuery(
    { userId: parseInt(userId) },
    { enabled: !!userId && !isNaN(parseInt(userId)) }
  );

  const userDetails = userDetailsResponse?.data;

  // Determine queue type for this user
  const { data: queueType } = api.users.determineUserQueueType.useQuery(
    { userId: parseInt(userId) },
    { enabled: !!userId && !isNaN(parseInt(userId)) }
  );

  // Fetch call history for this user
  const { data: callHistoryResponse, isLoading: callHistoryLoading } = api.calls.getCallHistoryTable.useQuery(
    { 
      userId: parseInt(userId),
      limit: 50,
      page: 1
    },
    { enabled: !!userId && !isNaN(parseInt(userId)) }
  );

  // Fetch SMS conversations for this user
  const { data: smsConversationsResponse, isLoading: smsLoading } = api.communications.sms.getConversations.useQuery(
    { 
      userId: parseInt(userId),
      limit: 20,
      page: 1,
      status: 'active'
    },
    { enabled: !!userId && !isNaN(parseInt(userId)) }
  );

  // Fetch magic link history for this user
  const { data: magicLinkHistoryResponse, isLoading: magicLinkLoading } = api.communications.magicLinks.getUserHistory.useQuery(
    { userId: parseInt(userId) },
    { enabled: !!userId && !isNaN(parseInt(userId)) }
  );

  if (isLoading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <User className="h-8 w-8 animate-pulse text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading user details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !userDetails) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {error?.message || 'User not found'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const user = userDetails.user;

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => router.back()}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {user.firstName} {user.lastName}
            </h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-gray-600">User ID: {user.id}</span>
              {queueType?.data?.queueType && (
                <Badge variant="outline" className="text-xs">
                  {queueType.data.queueType === 'unsigned_users' ? 'Needs Signature' : 
                   queueType.data.queueType === 'outstanding_requests' ? 'Has Requirements' : 
                   'Callback Queue'}
                </Badge>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex gap-3">
          <Button 
            variant="outline"
            onClick={() => {
              navigator.clipboard.writeText(user.phoneNumber || '');
              toast({ title: "Phone number copied to clipboard" });
            }}
          >
            <Phone className="w-4 h-4 mr-2" />
            {user.phoneNumber}
          </Button>
          <Button 
            onClick={() => router.push(`/calls/${user.id}`)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Phone className="w-4 h-4 mr-2" />
            Start Call
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Personal Info */}
        <div className="space-y-6">
          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-gray-500" />
                  <div>
                    <div className="text-sm text-gray-500">Email</div>
                    <div className="font-medium">{user.email || 'Not provided'}</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-gray-500" />
                  <div>
                    <div className="text-sm text-gray-500">Phone</div>
                    <div className="font-medium">{user.phoneNumber || 'Not provided'}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <div>
                    <div className="text-sm text-gray-500">Date of Birth</div>
                    <div className="font-medium">
                      {user.dateOfBirth ? new Date(user.dateOfBirth).toLocaleDateString() : 'Not provided'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Shield className="w-4 h-4 text-gray-500" />
                  <div>
                    <div className="text-sm text-gray-500">Status</div>
                    <Badge className={getStatusColor(user.status)}>
                      {user.status || 'Unknown'}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Addresses Information */}
          {userDetails.addresses && userDetails.addresses.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Addresses ({userDetails.addresses.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Sort addresses: current first, then previous */}
                {userDetails.addresses
                  .sort((a, b) => (b.isCurrent ? 1 : 0) - (a.isCurrent ? 1 : 0))
                  .map((address, index) => (
                  <div key={address.id} className="border-b last:border-b-0 pb-4 last:pb-0">
                    <div className="flex items-center justify-between mb-2">
                      <Badge 
                        variant={address.isCurrent ? 'default' : 'outline'} 
                        className={`text-xs ${address.isCurrent ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}
                      >
                        {address.type || 'Unknown Type'}
                      </Badge>
                      {address.createdAt && (
                        <div className="text-xs text-gray-500">
                          Added {new Date(address.createdAt).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="font-medium">{address.fullAddress}</div>
                      <div className="text-sm text-gray-600">
                        {address.postCode} • {address.county}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Account Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="w-5 h-5" />
                Account Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-sm text-gray-500">Introducer</div>
                <div className="font-medium">{user.introducer}</div>
              </div>
              {user.solicitor && (
                <div>
                  <div className="text-sm text-gray-500">Solicitor</div>
                  <div className="font-medium">{user.solicitor}</div>
                </div>
              )}
              <div>
                <div className="text-sm text-gray-500">Account Created</div>
                <div className="font-medium">
                  {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Last Login</div>
                <div className="font-medium">
                  {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Middle and Right Columns - Dialer History */}
        <div className="lg:col-span-2 space-y-6">
          {/* Call History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="w-5 h-5" />
                Call History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {callHistoryLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <History className="h-8 w-8 animate-pulse text-blue-600 mx-auto mb-4" />
                    <p className="text-gray-600">Loading call history...</p>
                  </div>
                </div>
              ) : callHistoryResponse?.calls?.length ? (
                <CallHistoryTable 
                  userId={parseInt(userId)}
                  calls={callHistoryResponse.calls}
                  isLoading={callHistoryLoading}
                  showUserInfo={false}
                />
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Phone className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No call history found for this user</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* SMS History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                SMS Conversations
              </CardTitle>
            </CardHeader>
            <CardContent>
              {smsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <MessageSquare className="h-8 w-8 animate-pulse text-blue-600 mx-auto mb-4" />
                    <p className="text-gray-600">Loading SMS history...</p>
                  </div>
                </div>
              ) : (smsConversationsResponse as any)?.data?.length ? (
                <div className="space-y-4">
                  {(smsConversationsResponse as any).data.map((conversation: any) => (
                    <div key={conversation.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4 text-blue-600" />
                          <span className="font-medium">{conversation.phoneNumber}</span>
                          <Badge 
                            variant={conversation.status === 'active' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {conversation.status}
                          </Badge>
                        </div>
                        <span className="text-sm text-gray-500">
                          {conversation.lastMessageAt ? 
                            new Date(conversation.lastMessageAt).toLocaleDateString() : 
                            'No messages'
                          }
                        </span>
                      </div>
                      
                      {conversation.lastMessage && (
                        <div className="bg-gray-50 rounded p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-gray-600">
                              {conversation.lastMessage.direction === 'inbound' ? 'Received' : 'Sent'}
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date(conversation.lastMessage.sentAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm">{conversation.lastMessage.message}</p>
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between text-sm text-gray-600">
                        <span>{conversation.messageCount || 0} messages</span>
                        {conversation.assignedAgentId && (
                          <span>Agent: {conversation.assignedAgentId}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No SMS conversations found for this user</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Magic Link History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="w-5 h-5" />
                Magic Link History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {magicLinkLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <Link2 className="h-8 w-8 animate-pulse text-blue-600 mx-auto mb-4" />
                    <p className="text-gray-600">Loading magic link history...</p>
                  </div>
                </div>
              ) : (magicLinkHistoryResponse as any)?.data?.length ? (
                <div className="space-y-3">
                  {(magicLinkHistoryResponse as any).data.map((link: any) => (
                    <div key={link.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Link2 className="h-4 w-4 text-blue-600" />
                          <span className="font-medium capitalize">{link.type}</span>
                          <Badge 
                            variant={link.status === 'active' ? 'default' : 
                                   link.status === 'used' ? 'secondary' : 'destructive'}
                            className="text-xs"
                          >
                            {link.status}
                          </Badge>
                        </div>
                        <span className="text-sm text-gray-500">
                          {new Date(link.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Delivery:</span>
                          <span className="ml-2 capitalize">{link.deliveryMethod}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Expires:</span>
                          <span className="ml-2">
                            {link.expiresAt ? new Date(link.expiresAt).toLocaleDateString() : 'Never'}
                          </span>
                        </div>
                        {link.accessedAt && (
                          <div className="col-span-2">
                            <span className="text-gray-600">Last accessed:</span>
                            <span className="ml-2">{new Date(link.accessedAt).toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Link2 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No magic links sent to this user</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 