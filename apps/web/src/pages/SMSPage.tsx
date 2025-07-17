import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { 
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon,
  UserGroupIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';

interface SMSConversation {
  id: string;
  phoneNumber: string;
  status: string;
  lastMessageAt: string;
  assignedAgent?: {
    id: number;
    firstName: string;
    lastName: string;
  };
  user?: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
  };
  latestMessage?: {
    body: string;
    direction: string;
    createdAt: string;
    isAutoResponse: boolean;
  };
  messageCount: number;
  unreadCount: number;
}

interface SMSMessage {
  id: string;
  body: string;
  direction: string;
  isAutoResponse: boolean;
  sentAt?: string;
  receivedAt?: string;
  createdAt: string;
}

export default function SMSPage() {
  const queryClient = useQueryClient();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [showNeedingAttention, setShowNeedingAttention] = useState(false);

  // Fetch SMS conversations
  const { data: conversationsData, isLoading: conversationsLoading } = useQuery({
    queryKey: ['sms-conversations', statusFilter, searchTerm, showNeedingAttention],
    queryFn: async () => {
      const params = new URLSearchParams({
        status: statusFilter,
        ...(searchTerm && { phoneNumber: searchTerm })
      });
      
      const endpoint = showNeedingAttention ? '/sms/conversations/attention' : '/sms/conversations';
      const response = await apiClient.get(`${endpoint}?${params}`) as any;
      return response.data;
    },
    refetchInterval: 10000 // Refresh every 10 seconds
  });

  // Fetch conversation details
  const { data: conversationData, isLoading: conversationLoading } = useQuery({
    queryKey: ['sms-conversation', selectedConversation],
    queryFn: async () => {
      if (!selectedConversation) return null;
      const response = await apiClient.get(`/sms/conversations/${selectedConversation}`) as any;
      return response.data;
    },
    enabled: !!selectedConversation,
    refetchInterval: 5000 // Refresh messages every 5 seconds
  });

  // Fetch SMS stats
  const { data: statsData } = useQuery({
    queryKey: ['sms-stats'],
    queryFn: async () => {
      const response = await apiClient.get('/sms/stats') as any;
      return response.data;
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({ phoneNumber, message, userId }: { phoneNumber: string; message: string; userId?: number }) => {
      const response = await apiClient.post('/sms/send', {
        phoneNumber,
        message,
        userId,
        messageType: 'manual'
      }) as any;
      return response.data;
    },
    onSuccess: () => {
      setNewMessage('');
      queryClient.invalidateQueries({ queryKey: ['sms-conversation', selectedConversation] });
      queryClient.invalidateQueries({ queryKey: ['sms-conversations'] });
    }
  });

  // Send magic link mutation
  const sendMagicLinkMutation = useMutation({
    mutationFn: async ({ userId, phoneNumber }: { userId: number; phoneNumber: string }) => {
      const response = await apiClient.post('/sms/magic-link', {
        userId,
        phoneNumber,
        linkType: 'claimPortal'
      }) as any;
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sms-conversation', selectedConversation] });
      queryClient.invalidateQueries({ queryKey: ['sms-conversations'] });
    }
  });

  // Close conversation mutation
  const closeConversationMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      const response = await apiClient.post(`/sms/conversations/${conversationId}/close`, {
        reason: 'Completed by agent'
      }) as any;
      return response.data;
    },
    onSuccess: () => {
      setSelectedConversation(null);
      queryClient.invalidateQueries({ queryKey: ['sms-conversations'] });
    }
  });

  const conversations: SMSConversation[] = conversationsData?.data || [];
  const selectedConv = conversations.find(c => c.id === selectedConversation);
  const messages: SMSMessage[] = conversationData?.data?.messages || [];

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedConv) return;
    
    sendMessageMutation.mutate({
      phoneNumber: selectedConv.phoneNumber,
      message: newMessage.trim(),
      userId: selectedConv.user?.id
    });
  };

  const handleSendMagicLink = () => {
    if (!selectedConv?.user?.id) return;
    
    sendMagicLinkMutation.mutate({
      userId: selectedConv.user.id,
      phoneNumber: selectedConv.phoneNumber
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Sidebar - Conversation List */}
      <div className="w-1/3 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold text-gray-900 flex items-center">
              <ChatBubbleLeftRightIcon className="h-6 w-6 mr-2 text-blue-600" />
              SMS Conversations
            </h1>
          </div>

          {/* Stats Cards */}
          {statsData && (
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="bg-blue-50 p-2 rounded-lg">
                <div className="text-xs text-blue-600 font-medium">Active</div>
                <div className="text-lg font-semibold text-blue-900">
                  {statsData.data.metrics.conversations.total}
                </div>
              </div>
              <div className="bg-green-50 p-2 rounded-lg">
                <div className="text-xs text-green-600 font-medium">Messages</div>
                <div className="text-lg font-semibold text-green-900">
                  {statsData.data.metrics.messages.total}
                </div>
              </div>
            </div>
          )}

          {/* Search and Filters */}
          <div className="space-y-2">
            <div className="relative">
              <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="Search by phone number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="flex space-x-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="active">Active</option>
                <option value="closed">Closed</option>
              </select>
              
              <button
                onClick={() => setShowNeedingAttention(!showNeedingAttention)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  showNeedingAttention
                    ? 'bg-red-100 text-red-700 border border-red-200'
                    : 'bg-gray-100 text-gray-700 border border-gray-200'
                }`}
              >
                <ExclamationTriangleIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
          {conversationsLoading ? (
            <div className="p-4 text-center text-gray-500">Loading conversations...</div>
          ) : conversations.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              {showNeedingAttention ? 'No conversations need attention' : 'No conversations found'}
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  onClick={() => setSelectedConversation(conversation.id)}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedConversation === conversation.id
                      ? 'bg-blue-50 border border-blue-200'
                      : 'hover:bg-gray-50 border border-transparent'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-900">
                          {conversation.user ? 
                            `${conversation.user.firstName} ${conversation.user.lastName}` : 
                            conversation.phoneNumber
                          }
                        </span>
                        {conversation.unreadCount > 0 && (
                          <span className="bg-blue-600 text-white text-xs rounded-full px-1.5 py-0.5">
                            {conversation.unreadCount}
                          </span>
                        )}
                      </div>
                      
                      <div className="text-sm text-gray-600 mt-1">
                        {conversation.phoneNumber}
                      </div>
                      
                      {conversation.latestMessage && (
                        <div className="text-sm text-gray-600 mt-2 truncate">
                          <span className={`${
                            conversation.latestMessage.direction === 'outbound' ? 'text-blue-600' : 'text-gray-800'
                          }`}>
                            {conversation.latestMessage.direction === 'outbound' ? 'You: ' : ''}
                          </span>
                          {conversation.latestMessage.body}
                          {conversation.latestMessage.isAutoResponse && (
                            <span className="text-xs text-green-600 ml-1">(Auto)</span>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div className="text-xs text-gray-500 flex flex-col items-end space-y-1">
                      <span>{formatTime(conversation.lastMessageAt)}</span>
                      {conversation.assignedAgent && (
                        <span className="text-green-600 flex items-center">
                          <UserGroupIcon className="h-3 w-3 mr-1" />
                          {conversation.assignedAgent.firstName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Content - Conversation View */}
      <div className="flex-1 flex flex-col">
        {selectedConversation && selectedConv ? (
          <>
            {/* Conversation Header */}
            <div className="bg-white border-b border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {selectedConv.user ? 
                      `${selectedConv.user.firstName} ${selectedConv.user.lastName}` : 
                      selectedConv.phoneNumber
                    }
                  </h2>
                  <p className="text-sm text-gray-600">{selectedConv.phoneNumber}</p>
                  {selectedConv.user && (
                    <p className="text-sm text-gray-600">{selectedConv.user.email}</p>
                  )}
                </div>
                
                <div className="flex space-x-2">
                  {selectedConv.user && (
                    <button
                      onClick={handleSendMagicLink}
                      disabled={sendMagicLinkMutation.isPending}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
                    >
                      Send Magic Link
                    </button>
                  )}
                  
                  <button
                    onClick={() => closeConversationMutation.mutate(selectedConversation)}
                    disabled={closeConversationMutation.isPending}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 text-sm font-medium"
                  >
                    Close Conversation
                  </button>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {conversationLoading ? (
                <div className="text-center text-gray-500">Loading messages...</div>
              ) : messages.length === 0 ? (
                <div className="text-center text-gray-500">No messages yet</div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        message.direction === 'outbound'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-900'
                      }`}
                    >
                      <p className="text-sm">{message.body}</p>
                      <div className={`text-xs mt-1 flex items-center justify-between ${
                        message.direction === 'outbound' ? 'text-blue-100' : 'text-gray-500'
                      }`}>
                        <span>{formatTime(message.sentAt || message.receivedAt || message.createdAt)}</span>
                        {message.isAutoResponse && (
                          <span className="ml-2 px-1 py-0.5 bg-green-500 text-white rounded text-xs">
                            Auto
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Message Input */}
            <div className="bg-white border-t border-gray-200 p-4">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={sendMessageMutation.isPending}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || sendMessageMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <PaperAirplaneIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          /* No Conversation Selected */
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <ChatBubbleLeftRightIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No conversation selected</h3>
              <p className="mt-1 text-sm text-gray-500">
                Choose a conversation from the list to start messaging
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 