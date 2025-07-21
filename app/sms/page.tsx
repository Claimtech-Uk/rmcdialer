'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { Plus, Send, MessageSquare, Phone, Users, Clock, TrendingUp, Search, Filter, CheckCheck, Check, User } from 'lucide-react'
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

  // Fetch conversations with reduced polling (much more reasonable)
  const { data: conversationsData, refetch: refetchConversations } = api.communications.sms.getConversations.useQuery(
    {
      status: statusFilter === 'all' ? undefined : statusFilter,
      page: 1,
      limit: 50
    },
    {
      refetchInterval: false, // TEMPORARILY DISABLED - was 15000
      refetchOnWindowFocus: true, // Refresh when user returns to tab
    }
  )

  // Fetch messages for selected conversation with reduced polling
  const { data: conversationData, refetch: refetchMessages } = api.communications.sms.getConversation.useQuery(
    {
      conversationId: selectedConversation,
      page: 1,
      limit: 100
    },
    {
      enabled: !!selectedConversation,
      refetchInterval: false, // TEMPORARILY DISABLED - was 10000
      refetchOnWindowFocus: true, // Refresh when user returns to tab
    }
  )

  // Fetch SMS stats much less frequently
  const { data: statsData } = api.communications.sms.getStats.useQuery(
    {
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
      endDate: new Date()
    },
    {
      refetchInterval: false, // TEMPORARILY DISABLED - was 60000
      refetchOnWindowFocus: false, // Don't refresh stats on window focus
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

  // Helper function to get user initials
  const getUserInitials = (conversation: SMSConversation): string => {
    if (conversation.user) {
      const firstName = conversation.user.firstName || ''
      const lastName = conversation.user.lastName || ''
      return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || 'U'
    }
    return '?'
  }

  // Helper function to get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200'
      case 'closed':
        return 'bg-slate-100 text-slate-600 border-slate-200'
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200'
    }
  }

  // Helper function to get message status icon
  const getMessageStatusIcon = (status?: string) => {
    switch (status) {
      case 'delivered':
        return <CheckCheck className="h-3 w-3" />
      case 'sent':
        return <Check className="h-3 w-3" />
      default:
        return null
    }
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              SMS Conversations
            </h1>
            <p className="text-slate-600 mt-2 text-lg">
              Manage two-way SMS conversations with users
            </p>
          </div>
          <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg">
            <Plus className="h-4 w-4 mr-2" />
            New Conversation
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="border-0 shadow-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-emerald-100">Active Conversations</CardTitle>
              <MessageSquare className="h-4 w-4 text-emerald-200" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statsData?.conversations?.active || 0}
              </div>
              <p className="text-xs text-emerald-100">
                +12% from yesterday
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-500 to-cyan-600 text-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-100">Messages Today</CardTitle>
              <Send className="h-4 w-4 text-blue-200" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statsData?.messages?.sent || 0}
              </div>
              <p className="text-xs text-blue-100">
                +8% from yesterday
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-500 to-pink-600 text-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-purple-100">Response Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-purple-200" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">89%</div>
              <p className="text-xs text-purple-100">
                +2% from yesterday
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-orange-500 to-red-600 text-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-orange-100">Avg Response Time</CardTitle>
              <Clock className="h-4 w-4 text-orange-200" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">2.3min</div>
              <p className="text-xs text-orange-100">
                -15s from yesterday
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Chat Interface */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[700px]">
          {/* Conversations List */}
          <Card className="lg:col-span-1 border-0 shadow-xl bg-white/80 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-lg">
              <div className="flex items-center justify-between">
                <CardTitle className="text-slate-700">Conversations</CardTitle>
                <Badge variant="secondary" className="bg-slate-200 text-slate-700">
                  {filteredConversations.length}
                </Badge>
              </div>
              
              {/* Search and Filter */}
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search conversations..."
                    className="pl-10 border-slate-200 bg-white/80 focus:bg-white transition-colors"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                
                <Select value={statusFilter} onValueChange={(value: 'all' | 'active' | 'closed') => setStatusFilter(value)}>
                  <SelectTrigger className="border-slate-200 bg-white/80">
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
              <div className="overflow-y-auto h-[500px]">
                {filteredConversations.map((conversation) => (
                  <div
                    key={conversation.id}
                    className={`p-4 border-b border-slate-100 cursor-pointer transition-all duration-200 ${
                      selectedConversation === conversation.id 
                        ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-l-blue-500' 
                        : 'hover:bg-slate-50'
                    }`}
                    onClick={() => setSelectedConversation(conversation.id)}
                  >
                    <div className="flex items-start gap-3">
                      {/* User Avatar */}
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold ${
                        conversation.user ? 'bg-gradient-to-br from-blue-500 to-purple-600 text-white' : 'bg-slate-300 text-slate-600'
                      }`}>
                        {getUserInitials(conversation)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-sm truncate text-slate-800">
                            {getUserDisplayName(conversation)}
                          </p>
                          <Badge 
                            className={`text-xs border ${getStatusColor(conversation.status)}`}
                          >
                            {conversation.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500 mb-2">
                          {conversation.phoneNumber}
                        </p>
                        <p className="text-xs text-slate-600 truncate">
                          {conversation.latestMessage?.body || 'No messages yet'}
                        </p>
                      </div>
                      
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-xs text-slate-400">
                          {formatMessageTime(conversation.lastMessageAt)}
                        </span>
                        {conversation.messageCount && conversation.messageCount > 0 && (
                          <Badge className="bg-red-500 text-white text-xs h-5 w-5 rounded-full p-0 flex items-center justify-center">
                            {conversation.messageCount}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                
                {filteredConversations.length === 0 && (
                  <div className="p-8 text-center text-slate-500">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                    <p className="font-medium">No conversations found</p>
                    <p className="text-sm mt-1">Start a new conversation to get started</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Chat Area */}
          <Card className="lg:col-span-2 border-0 shadow-xl bg-white/80 backdrop-blur-sm">
            {selectedConv ? (
              <>
                <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${
                        selectedConv.user ? 'bg-gradient-to-br from-blue-500 to-purple-600 text-white' : 'bg-slate-300 text-slate-600'
                      }`}>
                        {getUserInitials(selectedConv)}
                      </div>
                      <div>
                        <CardTitle className="flex items-center gap-2 text-slate-800">
                          {getUserDisplayName(selectedConv)}
                        </CardTitle>
                        <p className="text-sm text-slate-600 mt-1">
                          {selectedConv.phoneNumber}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={`border ${getStatusColor(selectedConv.status)}`}>
                        {selectedConv.status}
                      </Badge>
                      {selectedConv.status === 'active' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCloseConversation}
                          disabled={closeConversationMutation.isPending}
                          className="border-slate-300 hover:bg-slate-100"
                        >
                          Close
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="flex flex-col h-[500px] p-4">
                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl shadow-sm ${
                            message.direction === 'outbound'
                              ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white'
                              : 'bg-slate-100 text-slate-800 border border-slate-200'
                          }`}
                        >
                          <p className="text-sm leading-relaxed">{message.body}</p>
                          <div className={`flex items-center justify-between mt-2 text-xs ${
                            message.direction === 'outbound' ? 'text-blue-100' : 'text-slate-500'
                          }`}>
                            <span>
                              {formatMessageTime(message.sentAt || new Date())}
                            </span>
                            {message.direction === 'outbound' && (
                              <div className="flex items-center gap-1">
                                {getMessageStatusIcon(message.status)}
                                <span>{message.status || 'sending'}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {messages.length === 0 && (
                      <div className="text-center text-slate-500 py-12">
                        <MessageSquare className="h-16 w-16 mx-auto mb-4 text-slate-300" />
                        <p className="font-medium text-lg">No messages yet</p>
                        <p className="text-sm mt-1">Send a message to start the conversation</p>
                      </div>
                    )}
                  </div>
                  
                  {/* Message Input */}
                  <div className="flex gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <Input
                      placeholder="Type a message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                      disabled={sendMessageMutation.isPending}
                      className="border-0 bg-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim() || sendMessageMutation.isPending}
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-md"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </>
            ) : (
              <CardContent className="flex items-center justify-center h-full">
                <div className="text-center text-slate-500">
                  <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full flex items-center justify-center">
                    <MessageSquare className="h-12 w-12 text-slate-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-700 mb-2">Select a conversation</h3>
                  <p className="text-slate-500">Choose a conversation from the list to start messaging</p>
                </div>
              </CardContent>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
} 