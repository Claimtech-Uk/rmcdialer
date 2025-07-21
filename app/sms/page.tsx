'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useMemo, useRef } from 'react'
import { Plus, Send, MessageSquare, Phone, Users, Clock, TrendingUp, Search, Filter, CheckCheck, Check, User, ExternalLink, Sparkles, Loader2 } from 'lucide-react'
import { Button } from '@/modules/core/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/modules/core/components/ui/card'
import { Badge } from '@/modules/core/components/ui/badge'
import { Input } from '@/modules/core/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/modules/core/components/ui/select'
import { useToast } from '@/modules/core/hooks/use-toast'
import { api } from '@/lib/trpc/client'
import { useRouter } from 'next/navigation'
import type { SMSConversation, SMSMessage } from '@/modules/communications'

export default function SMSPage() {
  const [selectedConversation, setSelectedConversation] = useState<string>('')
  const [newMessage, setNewMessage] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'closed'>('all')
  
  // AI Enhancement state
  const [aiEnhancing, setAiEnhancing] = useState(false)
  
  const { toast } = useToast()
  const router = useRouter()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Memoize stats query parameters to prevent constant re-renders
  const statsParams = useMemo(() => ({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
    endDate: new Date()
  }), [])

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

  // Fetch SMS stats with memoized parameters (FIXED: was causing constant requests)
  const { data: statsData } = api.communications.sms.getStats.useQuery(
    statsParams,
    {
      refetchInterval: false, // DISABLED - was causing 300ms request loops
      refetchOnWindowFocus: false, // Don't refresh stats on window focus
      staleTime: 5 * 60 * 1000, // Cache for 5 minutes
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

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

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

  // Navigate to user details page
  const handleViewUserDetails = () => {
    if (selectedConv?.userId) {
      router.push(`/users/${selectedConv.userId}`)
    }
  }

  // AI Enhancement function
  const handleEnhanceMessage = async () => {
    if (!newMessage.trim()) {
      toast({
        title: "No message to enhance",
        description: "Please enter a message first",
        variant: "destructive",
      })
      return
    }

    // Store original message in case we need to revert
    const originalMessage = newMessage
    setAiEnhancing(true)

    try {
      const response = await fetch('/api/enhance-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: newMessage,
          context: {
            userName: selectedConv?.user ? getUserDisplayName(selectedConv) : undefined,
            userStatus: selectedConv?.status,
            isFollowUp: messages.length > 0,
            tone: 'professional'
          }
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to enhance message')
      }

      // Directly replace the message with the enhanced version
      setNewMessage(result.data.enhancedMessage)
      
      toast({
        title: "✨ Message enhanced!",
        description: "Your message has been improved with AI",
      })
    } catch (error) {
      console.error('AI Enhancement error:', error)
      toast({
        title: "Enhancement failed",
        description: error instanceof Error ? error.message : "Failed to enhance message with AI",
        variant: "destructive",
      })
    } finally {
      setAiEnhancing(false)
    }
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

  // Helper function to get status color with improved padding
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200 px-3 py-1'
      case 'closed':
        return 'bg-slate-100 text-slate-600 border-slate-200 px-3 py-1'
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200 px-3 py-1'
    }
  }

  // Helper function to get conversation item styling (NEW: adds colored border for active conversations)
  const getConversationItemStyling = (conversation: SMSConversation): string => {
    const baseClasses = 'p-4 border-b border-slate-100 cursor-pointer transition-all duration-200 relative'
    
    // Selected conversation styling
    if (selectedConversation === conversation.id) {
      return `${baseClasses} bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-l-blue-500`
    }
    
    // Active conversation styling (prominent left border)
    if (conversation.status === 'active') {
      return `${baseClasses} hover:bg-emerald-50 border-l-4 border-l-emerald-500 bg-emerald-50/50`
    }
    
    // Default styling
    return `${baseClasses} hover:bg-slate-50`
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

  // Calculate active conversations count
  const activeConversationsCount = conversations.filter(c => c.status === 'active').length

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
          <Button 
            size="default"
            responsive="nowrap"
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Conversation
          </Button>
        </div>

        {/* Stats Cards - Using real data, removing hardcoded values */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="border-0 shadow-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-emerald-100">Active Conversations</CardTitle>
              <MessageSquare className="h-4 w-4 text-emerald-200" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {activeConversationsCount}
              </div>
              <p className="text-xs text-emerald-100">
                Currently active
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-500 to-cyan-600 text-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-100">Messages Sent</CardTitle>
              <Send className="h-4 w-4 text-blue-200" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statsData?.messages?.sent || 0}
              </div>
              <p className="text-xs text-blue-100">
                Total sent messages
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-500 to-pink-600 text-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-purple-100">Messages Received</CardTitle>
              <TrendingUp className="h-4 w-4 text-purple-200" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statsData?.messages?.received || 0}
              </div>
              <p className="text-xs text-purple-100">
                Total received
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-orange-500 to-red-600 text-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-orange-100">Auto Responses</CardTitle>
              <Clock className="h-4 w-4 text-orange-200" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statsData?.messages?.autoResponses || 0}
              </div>
              <p className="text-xs text-orange-100">
                Automated replies
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
                <Badge variant="secondary" className="bg-slate-200 text-slate-700 px-3 py-1">
                  {filteredConversations.length}
                </Badge>
              </div>
              
              {/* Search and Enhanced Filter */}
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
                
                {/* Quick Filter Buttons */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    responsive="nowrap"
                    onClick={() => setStatusFilter('all')}
                    className={`flex-1 text-xs transition-all duration-200 ${
                      statusFilter === 'all' 
                        ? 'bg-blue-500 text-white border-blue-500 hover:bg-blue-600 shadow-md' 
                        : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    All ({conversations.length})
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    responsive="nowrap"
                    onClick={() => setStatusFilter('active')}
                    className={`flex-1 text-xs transition-all duration-200 ${
                      statusFilter === 'active' 
                        ? 'bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-600 shadow-md' 
                        : 'border-emerald-300 text-emerald-600 hover:bg-emerald-50'
                    }`}
                  >
                    Active ({activeConversationsCount})
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    responsive="nowrap"
                    onClick={() => setStatusFilter('closed')}
                    className={`flex-1 text-xs transition-all duration-200 ${
                      statusFilter === 'closed' 
                        ? 'bg-slate-500 text-white border-slate-500 hover:bg-slate-600 shadow-md' 
                        : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Closed ({conversations.filter(c => c.status === 'closed').length})
                  </Button>
                </div>
                
                {/* Dropdown Filter (Alternative) */}
                <Select value={statusFilter} onValueChange={(value: 'all' | 'active' | 'closed') => setStatusFilter(value)}>
                  <SelectTrigger className="border-slate-200 bg-white/80">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Conversations</SelectItem>
                    <SelectItem value="active">Active Only</SelectItem>
                    <SelectItem value="closed">Closed Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            
            <CardContent className="p-0">
              <div className="overflow-y-auto h-[500px]">
                {filteredConversations.map((conversation) => (
                  <div
                    key={conversation.id}
                    className={getConversationItemStyling(conversation)}
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
                    <p className="text-sm mt-1">
                      {statusFilter === 'active' ? 'No active conversations at the moment' : 
                       statusFilter === 'closed' ? 'No closed conversations found' : 
                       'Start a new conversation to get started'}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Chat Area */}
          <Card className="lg:col-span-2 border-0 shadow-xl bg-white/80 backdrop-blur-sm">
            {selectedConv ? (
              <>
                {/* Darker header background */}
                <CardHeader className="bg-gradient-to-r from-slate-100 to-slate-200 rounded-t-lg border-b border-slate-300">
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
                    <div className="flex items-center gap-3">
                      <Badge className={`border ${getStatusColor(selectedConv.status)}`}>
                        {selectedConv.status}
                      </Badge>
                      
                      {/* View Details Button */}
                      {selectedConv.userId && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleViewUserDetails}
                          className="border-slate-300 hover:bg-slate-100 flex items-center gap-2"
                        >
                          <User className="h-4 w-4" />
                          View Details
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      )}
                      
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
                  {/* Messages with auto-scroll */}
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
                          
                          {/* Message type indicator */}
                          {(message.isAutoResponse || (message.messageType && message.messageType !== 'manual')) && (
                            <div className="mt-2">
                              <Badge 
                                variant="outline"
                                className={`text-xs ${
                                  message.direction === 'outbound' 
                                    ? 'bg-white/20 text-blue-100 border-blue-200' 
                                    : 'bg-slate-200 text-slate-600 border-slate-300'
                                }`}
                              >
                                {message.isAutoResponse 
                                  ? '🤖 Auto Response' 
                                  : message.messageType === 'magic_link' 
                                    ? '🔗 Magic Link' 
                                    : message.messageType === 'callback_confirmation'
                                      ? '📞 Callback'
                                      : message.messageType === 'auto_response'
                                        ? '🤖 Auto Response'
                                        : '🏷️ Automated'
                                }
                              </Badge>
                            </div>
                          )}
                          
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
                    
                    {/* Auto-scroll anchor */}
                    <div ref={messagesEndRef} />
                    
                    {messages.length === 0 && (
                      <div className="text-center text-slate-500 py-12">
                        <MessageSquare className="h-16 w-16 mx-auto mb-4 text-slate-300" />
                        <p className="font-medium text-lg">No messages yet</p>
                        <p className="text-sm mt-1">Send a message to start the conversation</p>
                      </div>
                    )}
                  </div>
                  
                  {/* Message Input */}
                  <div className="flex gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <textarea
                      placeholder="Type a message... (Enter to send, Cmd+Enter for new line)"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (e.metaKey || e.ctrlKey) {
                            // Cmd+Enter or Ctrl+Enter: insert new line
                            e.preventDefault();
                            const target = e.target as HTMLTextAreaElement;
                            const start = target.selectionStart;
                            const end = target.selectionEnd;
                            const newValue = newMessage.substring(0, start) + '\n' + newMessage.substring(end);
                            setNewMessage(newValue);
                            // Set cursor position after the new line
                            setTimeout(() => {
                              target.selectionStart = target.selectionEnd = start + 1;
                            }, 0);
                          } else {
                            // Regular Enter: send message
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }
                      }}
                      disabled={sendMessageMutation.isPending || aiEnhancing}
                      rows={1}
                      className="flex-1 resize-none border-0 bg-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent rounded-lg px-3 py-2 text-sm min-h-[40px] max-h-32 overflow-y-auto"
                      style={{ 
                        height: 'auto',
                        minHeight: '40px'
                      }}
                      onInput={(e) => {
                        const target = e.target as HTMLTextAreaElement;
                        target.style.height = 'auto';
                        target.style.height = Math.min(target.scrollHeight, 128) + 'px';
                      }}
                    />
                    <Button
                      onClick={handleEnhanceMessage}
                      disabled={!newMessage.trim() || aiEnhancing}
                      variant="outline"
                      size="sm"
                      responsive="nowrap"
                      className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-400 px-3"
                      title={aiEnhancing ? "Improving message with AI..." : "Improve message with AI"}
                    >
                      {aiEnhancing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim() || sendMessageMutation.isPending}
                      size="sm"
                      responsive="nowrap"
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-md px-4"
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