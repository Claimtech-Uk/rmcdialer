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
import { normalizePhoneNumber } from '@/modules/twilio-voice/utils/phone.utils'
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
  
  // 🚀 LAZY LOADING: Progressive loading state
  const [allConversations, setAllConversations] = useState<SMSConversation[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMoreConversations, setHasMoreConversations] = useState(true)
  
  const { toast } = useToast()
  const router = useRouter()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Memoize stats query parameters to prevent constant re-renders
  const statsParams = useMemo(() => ({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
    endDate: new Date()
  }), [])

  // ⚡ FAST INITIAL LOAD: Lightweight conversation list  
  const { 
    data: initialConversationsData, 
    refetch: refetchInitialConversations, 
    isLoading: conversationsLoading,
    error: conversationsError,
    isRefetching: conversationsRefetching
  } = api.communications.sms.getConversationsList.useQuery(
    {
      status: statusFilter === 'all' ? undefined : statusFilter,
      page: 1,
      limit: 10 // Ultra-small initial load for instant response
    },
    {
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 30 * 1000,
      cacheTime: 5 * 60 * 1000,
      retry: 1, // Fewer retries for faster failure handling
      onSuccess: (data) => {
        // Initialize conversations state on first load
        setAllConversations(data.data);
        setHasMoreConversations(data.pagination.hasMore);
        setCurrentPage(1);
        console.log('⚡ Initial SMS conversations loaded:', {
          count: data.data.length,
          hasMore: data.pagination.hasMore,
          total: data.pagination.total
        });
      },
      onError: (error) => {
        console.error('⚡ Initial SMS conversations fetch error:', error);
        toast({
          title: "Loading Error",
          description: "Failed to load SMS conversations. Please refresh the page.",
          variant: "destructive",
        });
      }
    }
  )

  // 🔄 PAGINATION: Load more conversations query (disabled initially)
  const { 
    refetch: fetchMoreConversations,
    isFetching: isFetchingMore
  } = api.communications.sms.getConversationsList.useQuery(
    {
      status: statusFilter === 'all' ? undefined : statusFilter,
      page: currentPage + 1,
      limit: 10
    },
    {
      enabled: false, // Only trigger manually
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 30 * 1000,
      onSuccess: (data) => {
        // Append new conversations to existing list
        setAllConversations(prev => [...prev, ...data.data]);
        setCurrentPage(prev => prev + 1);
        setHasMoreConversations(data.pagination.hasMore);
        setIsLoadingMore(false);
        console.log('📄 More SMS conversations loaded:', {
          newCount: data.data.length,
          totalCount: allConversations.length + data.data.length,
          hasMore: data.pagination.hasMore
        });
      },
      onError: (error) => {
        console.error('📄 Load more conversations error:', error);
        setIsLoadingMore(false);
        toast({
          title: "Loading Error",
          description: "Failed to load more conversations. Please try again.",
          variant: "destructive",
        });
      }
    }
  )

  // 💬 MESSAGES: Load full message history only when conversation is selected
  const { 
    data: conversationData, 
    refetch: refetchMessages, 
    isLoading: messagesLoading,
    error: messagesError
  } = api.communications.sms.getConversation.useQuery(
    {
      conversationId: selectedConversation,
      page: 1,
      limit: 50 // Start with reasonable limit, can be increased later
    },
    {
      enabled: !!selectedConversation, // Only load when conversation is selected
      refetchInterval: false,
      refetchOnWindowFocus: false, // Don't auto-refresh messages to prevent interruption
      staleTime: 1 * 60 * 1000, // Cache messages for 1 minute
      cacheTime: 5 * 60 * 1000,
      retry: 2,
      onError: (error) => {
        console.error('💬 Messages fetch error:', error);
        toast({
          title: "Message Loading Error",
          description: "Failed to load message history for this conversation.",
          variant: "destructive",
        });
      }
    }
  )

  // ✅ OPTIMIZED: Fetch SMS stats with loading states and smart caching
  const { data: statsData, isLoading: statsLoading } = api.communications.sms.getStats.useQuery(
    statsParams,
    {
      refetchInterval: false, // Keep disabled for performance
      refetchOnWindowFocus: false, // Don't refresh stats on window focus
      staleTime: 5 * 60 * 1000, // Cache for 5 minutes
      cacheTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
      // Only load stats after conversations are loaded to prevent race conditions
      enabled: !conversationsLoading,
      retry: 1 // Fewer retries for stats since they're less critical
    }
  )

  // Send message mutation
  const sendMessageMutation = api.communications.sms.send.useMutation({
    onSuccess: () => {
      setNewMessage('')
      refetchMessages()
      refetchInitialConversations() // Refresh the conversations list
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
      refetchInitialConversations() // Refresh the conversations list
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

  // 🚀 LAZY LOADING: Use state-managed conversations for progressive loading
  const conversations: SMSConversation[] = allConversations
  const selectedConv = conversations.find(c => c.id === selectedConversation)
  const messages: SMSMessage[] = conversationData?.messages || []

  // 🔄 INFINITE SCROLL: Load more conversations when scrolling
  const handleLoadMoreConversations = async () => {
    if (isLoadingMore || !hasMoreConversations || conversationsLoading) {
      return;
    }

    console.log('📄 Loading more conversations...', {
      currentPage,
      currentCount: allConversations.length,
      hasMore: hasMoreConversations
    });

    setIsLoadingMore(true);
    try {
      await fetchMoreConversations();
    } catch (error) {
      console.error('📄 Failed to load more conversations:', error);
      setIsLoadingMore(false);
    }
  }

  // 🔄 RESET: Handle filter changes
  const handleFilterChange = (newFilter: 'all' | 'active' | 'closed') => {
    if (newFilter !== statusFilter) {
      console.log('🔄 Filter changed, resetting conversations:', { oldFilter: statusFilter, newFilter });
      setStatusFilter(newFilter);
      setAllConversations([]);
      setCurrentPage(1);
      setHasMoreConversations(true);
      // The useQuery will automatically refetch due to input change
    }
  }

  // 📱 SCROLL DETECTION: Detect when user scrolls near bottom
  const handleConversationScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    const { scrollTop, scrollHeight, clientHeight } = element;
    
    // Trigger load more when 200px from bottom
    const nearBottom = scrollTop + clientHeight >= scrollHeight - 200;
    
    if (nearBottom && hasMoreConversations && !isLoadingMore && !conversationsLoading) {
      handleLoadMoreConversations();
    }
  }

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
    if (!searchTerm) return true
    const displayName = getUserDisplayName(conversation)

    // Case-insensitive name match
    const nameMatch = displayName.toLowerCase().includes(searchTerm.toLowerCase())

    // Flexible phone search: allow +44 / 44 / 07 / last digits
    const convVariants = normalizePhoneNumber(conversation.phoneNumber)
    const searchDigits = searchTerm.replace(/\D/g, '')
    const convDigits = conversation.phoneNumber.replace(/\D/g, '')

    const phoneMatch =
      // direct includes on raw phone
      conversation.phoneNumber.includes(searchTerm) ||
      // digits-substring match
      (searchDigits.length >= 3 && (convDigits.includes(searchDigits))) ||
      // variant match (e.g. search 07... against stored 447...)
      convVariants.some(v => v.includes(searchTerm) || v.replace(/\D/g, '').includes(searchDigits))

    return nameMatch || phoneMatch
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
            <div className="flex items-center gap-3 mt-2">
              <p className="text-slate-600 text-lg">
                Manage two-way SMS conversations with users
              </p>
              {conversationsLoading && (
                <div className="flex items-center gap-2 text-blue-600">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
                  <span className="text-sm font-medium">Loading conversations...</span>
                </div>
              )}
              {conversationsRefetching && !conversationsLoading && (
                <div className="flex items-center gap-2 text-green-600">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-green-600 border-t-transparent"></div>
                  <span className="text-sm font-medium">Refreshing...</span>
                </div>
              )}
              {conversationsError && (
                <div className="flex items-center gap-2 text-red-600">
                  <span className="text-sm font-medium">⚠️ Failed to load conversations</span>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => refetchInitialConversations()}
                    className="text-xs"
                  >
                    Retry
                  </Button>
                </div>
              )}
            </div>
          </div>
          <Button 
            size="default"
            responsive="nowrap"
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg"
            disabled={conversationsLoading}
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
                {conversationsLoading ? (
                  <div className="animate-pulse bg-emerald-400/30 rounded h-8 w-12"></div>
                ) : (
                  activeConversationsCount
                )}
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
                {statsLoading ? (
                  <div className="animate-pulse bg-blue-400/30 rounded h-8 w-12"></div>
                ) : (
                  statsData?.messages?.sent || 0
                )}
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
                {statsLoading ? (
                  <div className="animate-pulse bg-purple-400/30 rounded h-8 w-12"></div>
                ) : (
                  statsData?.messages?.received || 0
                )}
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
                {statsLoading ? (
                  <div className="animate-pulse bg-orange-400/30 rounded h-8 w-12"></div>
                ) : (
                  statsData?.messages?.autoResponses || 0
                )}
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
                  {conversationsLoading ? (
                    <div className="animate-pulse bg-slate-300 rounded h-4 w-6"></div>
                  ) : (
                    filteredConversations.length
                  )}
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
                    onClick={() => handleFilterChange('all')}
                    disabled={conversationsLoading}
                    className={`flex-1 text-xs transition-all duration-200 ${
                      statusFilter === 'all' 
                        ? 'bg-blue-500 text-white border-blue-500 hover:bg-blue-600 shadow-md' 
                        : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    All ({conversationsLoading ? '...' : initialConversationsData?.pagination.total || 0})
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    responsive="nowrap"
                    onClick={() => handleFilterChange('active')}
                    disabled={conversationsLoading}
                    className={`flex-1 text-xs transition-all duration-200 ${
                      statusFilter === 'active' 
                        ? 'bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-600 shadow-md' 
                        : 'border-emerald-300 text-emerald-600 hover:bg-emerald-50'
                    }`}
                  >
                    Active ({conversationsLoading ? '...' : activeConversationsCount})
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    responsive="nowrap"
                    onClick={() => handleFilterChange('closed')}
                    disabled={conversationsLoading}
                    className={`flex-1 text-xs transition-all duration-200 ${
                      statusFilter === 'closed' 
                        ? 'bg-slate-500 text-white border-slate-500 hover:bg-slate-600 shadow-md' 
                        : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Closed ({conversationsLoading ? '...' : conversations.filter(c => c.status === 'closed').length})
                  </Button>
                </div>
                
                {/* Dropdown Filter (Alternative) */}
                <Select 
                  value={statusFilter} 
                  onValueChange={(value: 'all' | 'active' | 'closed') => handleFilterChange(value)}
                  disabled={conversationsLoading}
                >
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
              <div 
                className="overflow-y-auto h-[500px]" 
                onScroll={handleConversationScroll}
              >
                {conversationsLoading ? (
                  // ⚡ INITIAL LOADING STATE: Show skeleton loaders while fetching first batch
                  <div className="space-y-1">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div key={index} className="p-4 border-b border-slate-100 animate-pulse">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-200"></div>
                          <div className="flex-1 space-y-2">
                            <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                            <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                            <div className="h-3 bg-slate-200 rounded w-full"></div>
                          </div>
                          <div className="space-y-1">
                            <div className="h-3 bg-slate-200 rounded w-12"></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : conversationsError ? (
                  // ❌ ERROR STATE: Show error with retry option
                  <div className="p-8 text-center">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                      <div className="text-red-500 mb-4">
                        <svg className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-red-800 mb-2">Failed to load conversations</h3>
                      <p className="text-red-600 text-sm mb-4">
                        {conversationsError instanceof Error ? conversationsError.message : 'An unexpected error occurred'}
                      </p>
                      <div className="flex flex-col sm:flex-row gap-2 justify-center">
                        <Button 
                          variant="outline" 
                          onClick={() => refetchInitialConversations()}
                          className="border-red-300 text-red-700 hover:bg-red-50"
                        >
                          <span className="mr-2">🔄</span>
                          Try Again
                        </Button>
                        <Button 
                          variant="ghost" 
                          onClick={() => window.location.reload()}
                          className="text-red-600 hover:bg-red-50"
                        >
                          Refresh Page
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : filteredConversations.length > 0 ? (
                  // ✅ SUCCESS STATE: Show conversations with infinite scroll
                  <>
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
                    
                    {/* 🔄 INFINITE SCROLL LOADING INDICATOR */}
                    {(isLoadingMore || isFetchingMore) && (
                      <div className="p-4 text-center border-b border-slate-100">
                        <div className="flex items-center justify-center gap-2 text-blue-600">
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
                          <span className="text-sm font-medium">Loading more conversations...</span>
                        </div>
                      </div>
                    )}
                    
                    {/* 📄 MANUAL LOAD MORE BUTTON */}
                    {hasMoreConversations && !isLoadingMore && !isFetchingMore && (
                      <div className="p-4 text-center border-b border-slate-100">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={handleLoadMoreConversations}
                          className="border-blue-300 text-blue-700 hover:bg-blue-50 px-6"
                        >
                          <span className="mr-2">⬇️</span>
                          Load More Conversations
                        </Button>
                        <p className="text-xs text-slate-400 mt-2">
                          Scroll down or click to load more
                        </p>
                      </div>
                    )}
                    
                    {/* 🏁 END INDICATOR */}
                    {!hasMoreConversations && conversations.length > 5 && (
                      <div className="p-4 text-center text-slate-400 border-b border-slate-100">
                        <span className="text-xs">
                          ✅ All conversations loaded ({conversations.length} total)
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  // 📭 EMPTY STATE: No conversations found
                  <div className="p-8 text-center text-slate-500">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                    <p className="font-medium">No conversations found</p>
                    <p className="text-sm mt-1">
                      {statusFilter === 'active' ? 'No active conversations at the moment' : 
                       statusFilter === 'closed' ? 'No closed conversations found' : 
                       'Start a new conversation to get started'}
                    </p>
                    {!conversationsLoading && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => refetchInitialConversations()}
                        className="mt-4 border-slate-300 text-slate-600 hover:bg-slate-50"
                      >
                        <span className="mr-2">🔄</span>
                        Refresh
                      </Button>
                    )}
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
                  {/* Messages with auto-scroll and loading states */}
                  <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
                    {messagesLoading ? (
                      // 💬 MESSAGE LOADING STATE: Show while fetching conversation messages
                      <div className="space-y-4">
                        <div className="text-center py-4">
                          <div className="flex items-center justify-center gap-2 text-blue-600 mb-4">
                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent"></div>
                            <span className="text-sm font-medium">Loading message history...</span>
                          </div>
                        </div>
                        {/* Message skeleton loaders */}
                        {Array.from({ length: 4 }).map((_, index) => (
                          <div key={index} className={`flex ${index % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                            <div className="animate-pulse">
                              <div className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl ${
                                index % 2 === 0 
                                  ? 'bg-slate-200' 
                                  : 'bg-slate-100 border border-slate-200'
                              }`}>
                                <div className="h-4 bg-slate-300 rounded mb-2"></div>
                                <div className="h-3 bg-slate-300 rounded w-3/4"></div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : messagesError ? (
                      // ❌ MESSAGES ERROR STATE
                      <div className="flex-1 flex items-center justify-center">
                        <div className="text-center">
                          <div className="text-red-500 mb-4">
                            <svg className="h-8 w-8 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01" />
                            </svg>
                          </div>
                          <p className="text-red-600 font-medium mb-2">Failed to load messages</p>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => refetchMessages()}
                            className="border-red-300 text-red-700 hover:bg-red-50"
                          >
                            <span className="mr-2">🔄</span>
                            Retry Loading Messages
                          </Button>
                        </div>
                      </div>
                    ) : messages.length > 0 ? (
                      // ✅ MESSAGES SUCCESS STATE
                      messages.map((message) => (
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
                      ))
                    ) : (
                      // 📭 NO MESSAGES STATE: Conversation selected but no messages
                      <div className="text-center text-slate-500 py-12">
                        <MessageSquare className="h-16 w-16 mx-auto mb-4 text-slate-300" />
                        <p className="font-medium text-lg">No messages yet</p>
                        <p className="text-sm mt-1">Send a message to start the conversation</p>
                      </div>
                    )}
                    
                    {/* Auto-scroll anchor */}
                    <div ref={messagesEndRef} />
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