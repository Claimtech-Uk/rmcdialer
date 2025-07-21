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
  BarChart3,
  Send
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

  // Fetch SMS conversations for this user - TEMPORARILY DISABLED
  const { data: smsConversationsResponse, isLoading: smsLoading } = api.communications.sms.getConversations.useQuery(
    { 
      userId: parseInt(userId),
      limit: 20,
      page: 1,
      status: 'active'
    },
    { 
      enabled: false, // TEMPORARILY DISABLED - was: !!userId && !isNaN(parseInt(userId))
      refetchInterval: false
    }
  );

  // Fetch magic link history for this user
  const { data: magicLinkHistoryResponse, isLoading: magicLinkLoading } = api.communications.magicLinks.getUserHistory.useQuery(
    { userId: parseInt(userId) },
    { enabled: !!userId && !isNaN(parseInt(userId)) }
  );

  // Call functionality now handled by dedicated call session page

  // Magic link sending mutation
  const sendMagicLinkMutation = api.communications.sendMagicLinkSMS.useMutation({
    onSuccess: () => {
      toast({ 
        title: "Link Sent!", 
        description: "Magic link has been sent to the user via SMS",
      });
    },
    onError: (error) => {
      console.error('Failed to send magic link:', error);
      toast({ 
        title: "Send Failed", 
        description: error.message || "Failed to send magic link",
        variant: "destructive"
      });
    }
  });

  const handleStartCall = async () => {
    if (!user.phoneNumber) {
      toast({ 
        title: "No Phone Number", 
        description: "User doesn't have a phone number",
        variant: "destructive"
      });
      return;
    }

    try {
      // Generate a unique session ID for this call
      const sessionId = `call_${Date.now()}_${parseInt(userId)}`;
      
      // Navigate to the dedicated call session page
      router.push(`/calls/${sessionId}?userId=${userId}&phone=${encodeURIComponent(user.phoneNumber)}&name=${encodeURIComponent(`${user.firstName} ${user.lastName}`)}`);
      
      toast({
        title: "Starting Call Session",
        description: `Preparing to call ${user.firstName} ${user.lastName}`,
      });
    } catch (error: any) {
      console.error('Failed to start call session:', error);
      toast({
        title: "Session Failed",
        description: error.message || "Failed to start call session",
        variant: "destructive"
      });
    }
  };

  const handleSendLink = () => {
    if (!user.phoneNumber) {
      toast({ 
        title: "No Phone Number", 
        description: "User doesn't have a phone number",
        variant: "destructive"
      });
      return;
    }

    sendMagicLinkMutation.mutate({
      userId: parseInt(userId),
      phoneNumber: user.phoneNumber,
      linkType: 'claimPortal'
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="p-6 max-w-6xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                <User className="h-8 w-8 text-white" />
              </div>
              <p className="text-slate-600 text-lg">Loading user details...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !userDetails) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="p-6 max-w-6xl mx-auto">
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <AlertDescription className="text-red-800">
              {error?.message || 'User not found'}
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  const user = userDetails.user;

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'completed': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      case 'signed': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => router.back()}
              className="border-2 border-slate-300 hover:bg-slate-100 shadow-md hover:shadow-lg transition-all duration-200"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                {user.firstName} {user.lastName}
              </h1>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-slate-600 text-lg">User ID: {user.id}</span>
                {queueType?.data?.queueType && (
                  <Badge className="border border-blue-200 bg-blue-50 text-blue-700">
                    {queueType.data.queueType === 'unsigned_users' ? 'Needs Signature' : 
                     queueType.data.queueType === 'outstanding_requests' ? 'Has Requirements' : 
                     'Callback Queue'}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          
          {/* Action buttons with improved responsive layout */}
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <Button 
              variant="outline"
              size="default"
              responsive="truncate"
              onClick={() => {
                navigator.clipboard.writeText(user.phoneNumber || '');
                toast({ title: "Phone number copied to clipboard" });
              }}
              className="border-2 border-slate-300 hover:bg-slate-100 hover:border-slate-400 shadow-md hover:shadow-lg transition-all duration-200 max-w-[200px]"
              title={user.phoneNumber || 'No phone number'}
            >
              <Phone className="w-4 h-4 mr-2 flex-shrink-0" />
              <span className="overflow-hidden text-ellipsis">{user.phoneNumber}</span>
            </Button>
            <Button 
              onClick={handleStartCall}
              size="default"
              responsive="nowrap"
              className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-lg hover:shadow-xl transition-all duration-200 text-white"
            >
              <Phone className="w-4 h-4 mr-2 flex-shrink-0" />
              Start Call
            </Button>
            <Button 
              onClick={handleSendLink}
              disabled={sendMagicLinkMutation.isPending}
              size="default"
              responsive="nowrap"
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg hover:shadow-xl transition-all duration-200 text-white"
            >
              <Send className="w-4 h-4 mr-2 flex-shrink-0" />
              {sendMagicLinkMutation.isPending ? 'Sending...' : 'Send Link'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Personal Info */}
          <div className="space-y-6">
            {/* Contact Information */}
            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-lg">
                <CardTitle className="flex items-center gap-2 text-slate-800">
                  <User className="w-6 h-6 text-blue-600" />
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200">
                    <Mail className="w-5 h-5 text-slate-500" />
                    <div>
                      <div className="text-sm text-slate-500 font-medium">Email</div>
                      <div className="font-semibold text-slate-800">{user.email || 'Not provided'}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200">
                    <Phone className="w-5 h-5 text-slate-500" />
                    <div>
                      <div className="text-sm text-slate-500 font-medium">Phone</div>
                      <div className="font-semibold text-slate-800">{user.phoneNumber || 'Not provided'}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200">
                    <Calendar className="w-5 h-5 text-slate-500" />
                    <div>
                      <div className="text-sm text-slate-500 font-medium">Date of Birth</div>
                      <div className="font-semibold text-slate-800">
                        {user.dateOfBirth ? new Date(user.dateOfBirth).toLocaleDateString() : 'Not provided'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200">
                    <Shield className="w-5 h-5 text-slate-500" />
                    <div>
                      <div className="text-sm text-slate-500 font-medium">Status</div>
                      <Badge className={`border ${getStatusColor(user.status)} mt-1`}>
                        {user.status || 'Unknown'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Addresses Information */}
            {userDetails.addresses && userDetails.addresses.length > 0 && (
              <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
                <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-lg">
                  <CardTitle className="flex items-center gap-2 text-slate-800">
                    <MapPin className="w-6 h-6 text-emerald-600" />
                    Addresses ({userDetails.addresses.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  {/* Sort addresses: current first, then previous */}
                  {userDetails.addresses
                    .sort((a, b) => (b.isCurrent ? 1 : 0) - (a.isCurrent ? 1 : 0))
                    .map((address, index) => (
                    <div key={address.id} className="border-b border-slate-200 last:border-b-0 pb-4 last:pb-0">
                      <div className="flex items-center justify-between mb-3">
                        <Badge 
                          className={`border ${address.isCurrent 
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-200' 
                            : 'bg-slate-100 text-slate-800 border-slate-200'
                          }`}
                        >
                          {address.isCurrent ? 'Current Address' : 'Previous Address'}
                        </Badge>
                        {address.createdAt && (
                          <div className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                            Added {new Date(address.createdAt).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <div className="font-semibold text-slate-800">{address.fullAddress}</div>
                        <div className="text-sm text-slate-600 flex items-center gap-2">
                          <span className="bg-slate-100 px-2 py-1 rounded text-xs">{address.postCode}</span>
                          <span>•</span>
                          <span>{address.county}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Account Details */}
            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-lg">
                <CardTitle className="flex items-center gap-2 text-slate-800">
                  <Building className="w-6 h-6 text-purple-600" />
                  Account Details
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-4">
                  <div className="p-3 rounded-lg bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200">
                    <div className="text-sm text-slate-500 font-medium">Introducer</div>
                    <div className="font-semibold text-slate-800">{user.introducer}</div>
                  </div>
                  {user.solicitor && (
                    <div className="p-3 rounded-lg bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200">
                      <div className="text-sm text-slate-500 font-medium">Solicitor</div>
                      <div className="font-semibold text-slate-800">{user.solicitor}</div>
                    </div>
                  )}
                  <div className="p-3 rounded-lg bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200">
                    <div className="text-sm text-slate-500 font-medium">Account Created</div>
                    <div className="font-semibold text-slate-800">
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200">
                    <div className="text-sm text-slate-500 font-medium">Last Login</div>
                    <div className="font-semibold text-slate-800">
                      {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Middle and Right Columns - Dialer History */}
          <div className="lg:col-span-2 space-y-6">
            {/* Call History */}
            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-lg">
                <CardTitle className="flex items-center gap-2 text-slate-800">
                  <Phone className="w-6 h-6 text-blue-600" />
                  Call History
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {callHistoryLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
                      <p className="text-slate-600 text-lg">Loading call history...</p>
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
                  <div className="text-center py-12 text-slate-500">
                    <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full flex items-center justify-center">
                      <Phone className="h-8 w-8 text-slate-400" />
                    </div>
                    <p className="font-medium text-lg">No call history found for this user</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* SMS History */}
            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-lg">
                <CardTitle className="flex items-center gap-2 text-slate-800">
                  <MessageSquare className="w-6 h-6 text-emerald-600" />
                  SMS Conversations
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {smsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
                      <p className="text-slate-600 text-lg">Loading SMS history...</p>
                    </div>
                  </div>
                ) : (smsConversationsResponse as any)?.data?.length ? (
                  <div className="space-y-4">
                    {(smsConversationsResponse as any).data.map((conversation: any) => (
                      <div key={conversation.id} className="border border-slate-200 rounded-xl p-4 space-y-3 bg-gradient-to-r from-slate-50 to-slate-100">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <MessageSquare className="h-5 w-5 text-emerald-600" />
                            <span className="font-semibold text-slate-800">{conversation.phoneNumber}</span>
                            <Badge 
                              className={`border ${conversation.status === 'active' 
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-200' 
                                : 'bg-slate-100 text-slate-800 border-slate-200'
                              }`}
                            >
                              {conversation.status}
                            </Badge>
                          </div>
                          <span className="text-sm text-slate-500 bg-slate-200 px-2 py-1 rounded">
                            {conversation.lastMessageAt ? 
                              new Date(conversation.lastMessageAt).toLocaleDateString() : 
                              'No messages'
                            }
                          </span>
                        </div>
                        
                        {conversation.lastMessage && (
                          <div className="bg-white rounded-lg p-4 border border-slate-200">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded">
                                {conversation.lastMessage.direction === 'inbound' ? 'Received' : 'Sent'}
                              </span>
                              <span className="text-xs text-slate-500">
                                {new Date(conversation.lastMessage.sentAt).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-sm text-slate-800">{conversation.lastMessage.message}</p>
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between text-sm text-slate-600">
                          <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">
                            {conversation.messageCount || 0} messages
                          </span>
                          {conversation.assignedAgentId && (
                            <span className="text-xs text-slate-500">
                              Agent: {conversation.assignedAgentId}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-500">
                    <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full flex items-center justify-center">
                      <MessageSquare className="h-8 w-8 text-slate-400" />
                    </div>
                    <p className="font-medium text-lg">No SMS conversations found for this user</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Claims Overview */}
            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-lg">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-800">
                    <FileText className="w-6 h-6 text-purple-600" />
                    Claims ({userDetails.claims.length})
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {userDetails.claims.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full flex items-center justify-center">
                      <FileText className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="font-medium text-lg text-slate-500">No claims found</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {userDetails.claims.map((claim: any) => (
                      <div key={claim.id} className="border border-slate-200 rounded-xl p-6 bg-gradient-to-r from-slate-50 to-slate-100">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <div className="flex items-center gap-3 mb-3">
                              <h3 className="text-xl font-semibold text-slate-800">
                                {claim.type} Claim
                              </h3>
                              <Badge className={`border ${getStatusColor(claim.status)}`}>
                                {claim.status}
                              </Badge>
                            </div>
                            <div className="space-y-2">
                              <div className="text-slate-700">
                                <strong>Lender:</strong> {claim.lender}
                              </div>
                              {claim.solicitor && (
                                <div className="text-slate-700">
                                  <strong>Solicitor:</strong> {claim.solicitor}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="text-right text-sm text-slate-500 bg-white px-3 py-2 rounded-lg border border-slate-200">
                            <div>Created: {claim.createdAt ? new Date(claim.createdAt).toLocaleDateString() : 'Unknown'}</div>
                            {claim.lastUpdated && (
                              <div>Updated: {new Date(claim.lastUpdated).toLocaleDateString()}</div>
                            )}
                          </div>
                        </div>
                        
                        {/* Requirements */}
                        {claim.requirements && claim.requirements.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-slate-200">
                            <h4 className="font-semibold mb-3 flex items-center gap-2 text-slate-800">
                              <AlertTriangle className="w-5 h-5 text-yellow-600" />
                              Requirements ({claim.requirements.length})
                            </h4>
                            <div className="space-y-3">
                              {claim.requirements.map((req: any) => (
                                <div key={req.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200">
                                  <div>
                                    <div className="font-medium text-slate-800">{req.type}</div>
                                    {req.reason && (
                                      <div className="text-sm text-slate-600 mt-1">{req.reason}</div>
                                    )}
                                    {req.rejectionReason && (
                                      <div className="text-sm text-red-600 mt-1">
                                        <strong>Rejected:</strong> {req.rejectionReason}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <Badge 
                                      className={`border ${req.status === 'PENDING' 
                                        ? 'bg-red-100 text-red-800 border-red-200' 
                                        : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                      }`}
                                    >
                                      {req.status}
                                    </Badge>
                                    <div className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                                      {req.createdAt ? new Date(req.createdAt).toLocaleDateString() : 'Unknown'}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Activity */}
            {userDetails.activityLogs && userDetails.activityLogs.length > 0 && (
              <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
                <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-lg">
                  <CardTitle className="flex items-center gap-2 text-slate-800">
                    <Clock className="w-6 h-6 text-orange-600" />
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    {userDetails.activityLogs.slice(0, 5).map((log: any) => (
                      <div key={log.id} className="flex items-start gap-4 p-4 bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg border border-slate-200">
                        <div className="w-3 h-3 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                        <div className="flex-1">
                          <div className="font-semibold text-slate-800">{log.action}</div>
                          <div className="text-slate-600 mt-1">{log.message}</div>
                          {log.createdAt && (
                            <div className="text-xs text-slate-500 mt-2 bg-slate-200 px-2 py-1 rounded inline-block">
                              {new Date(log.createdAt).toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 