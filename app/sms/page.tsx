'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { Plus, Send, MessageSquare, Phone, Users, Clock, TrendingUp, Search, Filter } from 'lucide-react'
import { Button } from '@/modules/core/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/modules/core/components/ui/card'
import { Badge } from '@/modules/core/components/ui/badge'
import { Input } from '@/modules/core/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/modules/core/components/ui/select'
import { useToast } from '@/modules/core/hooks/use-toast'
import { api } from '@/lib/trpc/client'
import type { SMSConversation, SMSMessage } from '@/modules/communications'

export default function SMSPage() {
  const [selectedConversation, setSelectedConversation] = useState<string>('')
  const [newMessage, setNewMessage] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'closed'>('all')
  const { toast } = useToast()

  // Fetch conversations with real-time updates
  const { data: conversationsData, refetch: refetchConversations } = api.communications.sms.getConversations.useQuery(
    {
      status: statusFilter === 'all' ? undefined : statusFilter,
      page: 1,
      limit: 50
    },
    {
      refetchInterval: 5000, // Poll every 5 seconds for new messages
    }
  )

  // Fetch messages for selected conversation
  const { data: conversationData, refetch: refetchMessages } = api.communications.sms.getConversation.useQuery(
    {
      conversationId: selectedConversation,
      page: 1,
      limit: 100
    },
    {
      enabled: !!selectedConversation,
      refetchInterval: 3000, // Poll every 3 seconds for new messages
    }
  )

  // Fetch SMS stats
  const { data: statsData } = api.communications.sms.getStats.useQuery(
    {
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
      endDate: new Date()
    },
    {
      refetchInterval: 30000, // Update every 30 seconds
    }
  )

  // Send message mutation
  const sendMessageMutation = api.communications.sms.send.useMutation({
    onSuccess: () => {
      setNewMessage('')
      refetchMessages()
      refetchConversations()
      toast({
        title: "Message sent",
        description: "Your message has been sent successfully.",
      })
    },
    onError: (error) => {
      toast({
        title: "Failed to send message",
        description: error.message,
        variant: "destructive",
      })
    }
  })

  // Close conversation mutation
  const closeConversationMutation = api.communications.sms.closeConversation.useMutation({
    onSuccess: () => {
      refetchConversations()
      toast({
        title: "Conversation closed",
        description: "The conversation has been marked as closed.",
      })
    },
    onError: (error) => {
      toast({
        title: "Failed to close conversation",
        description: error.message,
        variant: "destructive",
      })
    }
  })

  const conversations: SMSConversation[] = conversationsData?.data || []
  const selectedConv = conversations.find(c => c.id === selectedConversation)
  const messages: SMSMessage[] = conversationData?.messages || []

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedConv) return
    
    sendMessageMutation.mutate({
      phoneNumber: selectedConv.phoneNumber,
      message: newMessage.trim(),
      userId: selectedConv.userId || undefined,
      messageType: 'manual'
    })
  }

  const handleCloseConversation = () => {
    if (!selectedConversation) return
    
    closeConversationMutation.mutate({
      conversationId: selectedConversation,
      reason: 'Resolved by agent'
    })
  }

  // Helper function to get user display name
  const getUserDisplayName = (conversation: SMSConversation): string => {
    if (conversation.user) {
      return `${conversation.user.firstName} ${conversation.user.lastName}`.trim()
    }
    return 'Unknown User'
  }

  // Filter conversations based on search
  const filteredConversations = conversations.filter(conversation => {
    const displayName = getUserDisplayName(conversation)
    const matchesSearch = !searchTerm || 
      conversation.phoneNumber.includes(searchTerm) ||
      displayName.toLowerCase().includes(searchTerm.toLowerCase())
    
    return matchesSearch
  })

  // Format last message time
  const formatMessageTime = (date: Date | string) => {
    const messageDate = typeof date === 'string' ? new Date(date) : date
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - messageDate.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 1) return 'Just now'
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`
    return messageDate.toLocaleDateString()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">SMS Conversations</h1>
          <p className="text-gray-600 mt-1">
            Manage two-way SMS conversations with users
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Conversation
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Conversations</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsData?.conversations?.active || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              +12% from yesterday
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Messages Today</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsData?.messages?.sent || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              +8% from yesterday
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Response Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">89%</div>
            <p className="text-xs text-muted-foreground">
              +2% from yesterday
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2.3min</div>
            <p className="text-xs text-muted-foreground">
              -15s from yesterday
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Chat Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
        {/* Conversations List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Conversations</CardTitle>
              <Badge variant="secondary">
                {filteredConversations.length}
              </Badge>
            </div>
            
            {/* Search and Filter */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search conversations..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <Select value={statusFilter} onValueChange={(value: 'all' | 'active' | 'closed') => setStatusFilter(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Conversations</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          
          <CardContent className="p-0">
            <div className="overflow-y-auto h-[400px]">
              {filteredConversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className={`p-4 border-b cursor-pointer hover:bg-gray-50 transition-colors ${
                    selectedConversation === conversation.id ? 'bg-blue-50 border-blue-200' : ''
                  }`}
                  onClick={() => setSelectedConversation(conversation.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">
                          {getUserDisplayName(conversation)}
                        </p>
                        <Badge 
                          variant={conversation.status === 'active' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {conversation.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">
                        {conversation.phoneNumber}
                      </p>
                      <p className="text-xs text-gray-500 mt-1 truncate">
                        {conversation.latestMessage?.body || 'No messages yet'}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-xs text-gray-500">
                        {formatMessageTime(conversation.lastMessageAt)}
                      </span>
                      {conversation.messageCount && conversation.messageCount > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          {conversation.messageCount}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {filteredConversations.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No conversations found</p>
                  <p className="text-sm mt-1">Start a new conversation to get started</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Chat Area */}
        <Card className="lg:col-span-2">
          {selectedConv ? (
            <>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Phone className="h-5 w-5" />
                      {getUserDisplayName(selectedConv)}
                    </CardTitle>
                    <p className="text-sm text-gray-600 mt-1">
                      {selectedConv.phoneNumber}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={selectedConv.status === 'active' ? 'default' : 'secondary'}>
                      {selectedConv.status}
                    </Badge>
                    {selectedConv.status === 'active' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCloseConversation}
                        disabled={closeConversationMutation.isPending}
                      >
                        Close
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="flex flex-col h-[400px]">
                {/* Messages */}
                <div className="flex-1 overflow-y-auto space-y-4 mb-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                          message.direction === 'outbound'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-900'
                        }`}
                      >
                        <p className="text-sm">{message.body}</p>
                        <p className={`text-xs mt-1 ${
                          message.direction === 'outbound' ? 'text-blue-100' : 'text-gray-500'
                        }`}>
                          {formatMessageTime(message.sentAt || new Date())}
                          {message.direction === 'outbound' && message.status && (
                            <span className="ml-2">• {message.status}</span>
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                  
                  {messages.length === 0 && (
                    <div className="text-center text-gray-500 py-8">
                      <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>No messages in this conversation</p>
                      <p className="text-sm mt-1">Send a message to get started</p>
                    </div>
                  )}
                </div>
                
                {/* Message Input */}
                <div className="flex gap-2">
                  <Input
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    disabled={sendMessageMutation.isPending}
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || sendMessageMutation.isPending}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </>
          ) : (
            <CardContent className="flex items-center justify-center h-full">
              <div className="text-center text-gray-500">
                <MessageSquare className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium">Select a conversation</h3>
                <p className="text-sm mt-1">Choose a conversation from the list to start messaging</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  )
} 