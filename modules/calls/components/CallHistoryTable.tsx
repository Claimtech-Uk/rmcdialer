'use client'

import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/modules/core/components/ui/card'
import { Badge } from '@/modules/core/components/ui/badge'
import { Button } from '@/modules/core/components/ui/button'
import { Input } from '@/modules/core/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/modules/core/components/ui/select'
import { Clock, Phone, MessageSquare, Calendar, User, Filter, ChevronDown, ChevronUp, RefreshCw, Play, Pause, Volume2, Download, PhoneIncoming, PhoneOutgoing, PhoneMissed, Send } from 'lucide-react'
import { format, subDays, isAfter, isBefore } from 'date-fns'
import { api } from '@/lib/trpc/client'
import { useToast } from '@/modules/core/hooks/use-toast'
import type { CallHistoryEntry } from '../types/call.types'

interface CallHistoryTableProps {
  userId?: number
  agentId?: number
  calls: CallHistoryEntry[]
  isLoading?: boolean
  onRefresh?: () => void
  showUserInfo?: boolean
}

interface Filters {
  outcome: string
  dateRange: string
  agent: string
  search: string
}

// Add quick filter type
type QuickFilter = 'all' | 'missed'

const OUTCOME_COLORS: Record<string, string> = {
  // New unified vocabulary
  'completed_form': 'bg-green-100 text-green-800',
  'going_to_complete': 'bg-blue-100 text-blue-800',
  'might_complete': 'bg-yellow-100 text-yellow-800',
  'call_back': 'bg-purple-100 text-purple-800',
  'no_answer': 'bg-gray-100 text-gray-800',
  'missed_call': 'bg-yellow-200 text-yellow-900', // ✅ ADDED: Yellow for missed calls
  'hung_up': 'bg-orange-100 text-orange-800',
  'bad_number': 'bg-red-100 text-red-800',
  'no_claim': 'bg-gray-200 text-gray-800',
  'not_interested': 'bg-red-100 text-red-800',
  'do_not_contact': 'bg-red-200 text-red-900',
  
  // Legacy fallbacks for backward compatibility
  'contacted': 'bg-green-100 text-green-800',
  'voicemail': 'bg-blue-100 text-blue-800',
  'busy': 'bg-orange-100 text-orange-800',
  'wrong_number': 'bg-red-100 text-red-800',
  'callback_requested': 'bg-purple-100 text-purple-800',
  'documents_discussed': 'bg-indigo-100 text-indigo-800',
  'magic_link_sent': 'bg-cyan-100 text-cyan-800',
  'left_voicemail': 'bg-blue-100 text-blue-800',
  'failed': 'bg-red-100 text-red-800'
}

export function CallHistoryTable({ 
  userId, 
  agentId, 
  calls, 
  isLoading, 
  onRefresh, 
  showUserInfo = true 
}: CallHistoryTableProps) {
  const [filters, setFilters] = useState<Filters>({
    outcome: 'all',
    dateRange: 'all',
    agent: 'all',
    search: ''
  })
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all')
  const [sortBy, setSortBy] = useState<'date' | 'duration' | 'outcome'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [expandedCall, setExpandedCall] = useState<string | null>(null)
  const [playingRecording, setPlayingRecording] = useState<string | null>(null)
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null)
  
  const { toast } = useToast()

  // Magic link sending mutation
  const sendMagicLinkMutation = api.communications.sendMagicLinkSMS.useMutation({
    onSuccess: (result) => {
      console.log('✅ Magic link sent successfully from call history:', result);
      toast({ 
        title: "Portal Link Sent!", 
        description: "User will receive the claim portal link via SMS" 
      });
    },
    onError: (error) => {
      console.error('❌ Magic link failed from call history:', error);
      toast({
        title: "Failed to Send Portal Link",
        description: error.message || "Could not send magic link",
        variant: "destructive"
      });
    }
  });

  // Review SMS sending mutation
  const sendReviewSMSMutation = api.communications.sendReviewSMS.useMutation({
    onSuccess: (result) => {
      console.log('✅ Review SMS sent successfully from call history:', result);
      toast({ 
        title: "Review Request Sent!", 
        description: "User will receive a Trustpilot review request via SMS" 
      });
    },
    onError: (error) => {
      console.error('❌ Review SMS failed from call history:', error);
      toast({
        title: "Failed to Send Review Request",
        description: error.message || "Could not send review request",
        variant: "destructive"
      });
    }
  });

  // Handle sending magic link for a specific call
  const handleSendMagicLink = (call: CallHistoryEntry) => {
    if (!call.userPhone) {
      toast({
        title: "No Phone Number",
        description: "This call record doesn't have a phone number on file",
        variant: "destructive"
      });
      return;
    }

    // Extract user ID from the call record
    const userIdToUse = call.userId || userId;
    
    if (!userIdToUse) {
      toast({
        title: "No User ID",
        description: "Cannot determine user ID for this call",
        variant: "destructive"
      });
      return;
    }

    const payload = {
      userId: userIdToUse,
      phoneNumber: call.userPhone,
      linkType: 'claimPortal' as const
    };
    
    console.log('📤 Sending magic link from call history with payload:', payload);
    sendMagicLinkMutation.mutate(payload);
  };

  // Handle sending review SMS for a specific call
  const handleSendReviewSMS = (call: CallHistoryEntry) => {
    if (!call.userPhone) {
      toast({
        title: "No Phone Number",
        description: "This call record doesn't have a phone number on file",
        variant: "destructive"
      });
      return;
    }

    // Extract user ID from the call record
    const userIdToUse = call.userId || userId;
    
    if (!userIdToUse) {
      toast({
        title: "No User ID",
        description: "Cannot determine user ID for this call",
        variant: "destructive"
      });
      return;
    }

    const payload = {
      userId: userIdToUse,
      phoneNumber: call.userPhone,
      callSessionId: call.id
    };
    
    console.log('📤 Sending review SMS from call history with payload:', payload);
    sendReviewSMSMutation.mutate(payload);
  };

  // Recording Player Component
  const RecordingPlayer = ({ call }: { call: CallHistoryEntry }) => {
    const { data: recordingData, isLoading: recordingLoading, error: recordingError } = api.calls.getRecording.useQuery(
      { sessionId: call.id },
      { 
        enabled: !!call.twilioCallSid,
        staleTime: 10 * 60 * 1000 // Cache for 10 minutes
      }
    )

    const handlePlayRecording = async () => {
      console.log('🎵 RecordingPlayer: Play recording clicked for call:', call.id)
      console.log('🎵 Recording data:', recordingData)
      
      if (!recordingData?.hasRecording || !recordingData.recording?.streamUrl) {
        console.warn('🎵 No recording data available:', { hasRecording: recordingData?.hasRecording, streamUrl: recordingData?.recording?.streamUrl })
        return
      }

      if (playingRecording === call.id) {
        // Stop current recording
        if (audioElement) {
          console.log('🎵 Stopping current recording')
          audioElement.pause()
          audioElement.currentTime = 0
        }
        setPlayingRecording(null)
        setAudioElement(null)
        return
      }

      // Create new audio element with enhanced compatibility
      const audio = new Audio()
      
      // Set audio properties for better compatibility
      audio.preload = 'auto'
      audio.crossOrigin = 'anonymous'
      
      // Add comprehensive event listeners for debugging
      audio.addEventListener('loadstart', () => console.log('🎵 Audio loadstart'))
      audio.addEventListener('canplay', () => console.log('🎵 Audio canplay'))
      audio.addEventListener('canplaythrough', () => console.log('🎵 Audio canplaythrough'))
      audio.addEventListener('playing', () => console.log('🎵 Audio playing'))
      audio.addEventListener('ended', () => {
        console.log('🎵 Audio ended')
        setPlayingRecording(null)
        setAudioElement(null)
      })
      
      audio.addEventListener('error', (e) => {
        console.error('🎵 Audio error event:', e)
        const error = audio.error
        if (error) {
          console.error('🎵 Audio error details:', {
            code: error.code,
            message: error.message
          })
          
          let errorMessage = 'Failed to play recording'
          const { MEDIA_ERR_ABORTED, MEDIA_ERR_NETWORK, MEDIA_ERR_DECODE, MEDIA_ERR_SRC_NOT_SUPPORTED } = error
          
          switch (error.code) {
            case MEDIA_ERR_ABORTED:
              errorMessage = 'Recording playback was aborted'
              break
            case MEDIA_ERR_NETWORK:
              errorMessage = 'Network error while loading recording'
              break
            case MEDIA_ERR_DECODE:
              errorMessage = 'Recording format not supported by your browser'
              break
            case MEDIA_ERR_SRC_NOT_SUPPORTED:
              errorMessage = 'Recording format not supported. Try downloading instead.'
              break
          }
          
          // Show user-friendly error with format-specific advice
          const toast = (window as any).__toast__ || console.error
          if (typeof toast === 'function') {
            toast({
              title: "Recording Playback Error",
              description: errorMessage,
              variant: "destructive"
            })
          }
        }
        setPlayingRecording(null)
        setAudioElement(null)
      })

      // Try to set the audio source with the stream URL
      console.log('🎵 Setting audio source:', recordingData.recording.streamUrl)
      audio.src = recordingData.recording.streamUrl
      
      // Set as currently playing and store reference
      setPlayingRecording(call.id)
      setAudioElement(audio)

      // Attempt to play with comprehensive error handling
      try {
        console.log('🎵 Attempting to play audio...')
        const playPromise = audio.play()
        
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log('🎵 Audio playback started successfully')
            })
            .catch((error: unknown) => {
              console.error('🎵 Play promise rejected:', error)
              setPlayingRecording(null)
              setAudioElement(null)
              
              const errorMessage = error instanceof Error ? error.message : String(error)
              const toast = (window as any).__toast__ || console.error
              if (typeof toast === 'function') {
                toast({
                  title: "Recording Playback Failed",
                  description: `Unable to play recording: ${errorMessage}. Try downloading the recording instead.`,
                  variant: "destructive"
                })
              }
            })
        }
        
      } catch (error: unknown) {
        console.error('🎵 Error calling play():', error)
        setPlayingRecording(null)
        setAudioElement(null)
        
        const errorMessage = error instanceof Error ? error.message : String(error)
        const toast = (window as any).__toast__ || console.error
        if (typeof toast === 'function') {
          toast({
            title: "Recording Playback Error",
            description: `Failed to start playback: ${errorMessage}`,
            variant: "destructive"
          })
        }
      }
    }

    const handleDownloadRecording = () => {
      console.log('🎵 Download recording clicked')
      if (recordingData?.hasRecording && recordingData.recording?.downloadUrl) {
        console.log('🎵 Opening download URL:', recordingData.recording.downloadUrl)
        // Use our proxied download URL - this will trigger a file download
        window.open(recordingData.recording.downloadUrl, '_blank')
      } else {
        console.warn('🎵 No download URL available:', recordingData)
      }
    }

    if (recordingLoading) {
      return (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Volume2 className="h-3 w-3 animate-pulse" />
          <span>Checking...</span>
        </div>
      )
    }

    if (recordingError) {
      console.error('🎵 Recording query error:', recordingError)
      return (
        <div className="flex items-center gap-2 text-xs text-red-500">
          <Volume2 className="h-3 w-3" />
          <span>Error loading</span>
        </div>
      )
    }

    if (!recordingData?.hasRecording) {
      return (
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Volume2 className="h-3 w-3" />
          <span>No recording</span>
        </div>
      )
    }

    return (
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handlePlayRecording}
          className="h-6 w-6 hover:bg-blue-100 transition-colors"
          title={playingRecording === call.id ? 'Stop recording' : 'Play recording'}
        >
          {playingRecording === call.id ? (
            <Pause className="h-3 w-3 text-blue-600" />
          ) : (
            <Play className="h-3 w-3 text-green-600" />
          )}
        </Button>
        
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleDownloadRecording}
          className="h-6 w-6 hover:bg-gray-100 transition-colors"
          title="Download recording"
        >
          <Download className="h-3 w-3 text-gray-600" />
        </Button>

        <span className="text-xs text-green-600 font-medium">
          {recordingData.recording?.durationSeconds ? 
            formatDuration(recordingData.recording.durationSeconds) : 
            'Available'
          }
        </span>
      </div>
    )
  }

  // Filter and sort calls
  const filteredAndSortedCalls = useMemo(() => {
    let filtered = calls.filter(call => {
      // Quick filter
      if (quickFilter === 'missed' && !isMissedCall(call)) {
        return false
      }

      // Outcome filter
      if (filters.outcome !== 'all' && call.outcome !== filters.outcome) {
        return false
      }

      // Date range filter
      if (filters.dateRange !== 'all') {
        const callDate = new Date(call.startedAt)
        const now = new Date()
        
        switch (filters.dateRange) {
          case 'today':
            if (!isAfter(callDate, subDays(now, 1))) return false
            break
          case 'week':
            if (!isAfter(callDate, subDays(now, 7))) return false
            break
          case 'month':
            if (!isAfter(callDate, subDays(now, 30))) return false
            break
        }
      }

      // Agent filter
      if (filters.agent !== 'all' && call.agentName !== filters.agent) {
        return false
      }

      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase()
        return (
          call.userName?.toLowerCase().includes(searchLower) ||
          call.userPhone?.toLowerCase().includes(searchLower) ||
          call.outcomeNotes?.toLowerCase().includes(searchLower) ||
          call.agentName?.toLowerCase().includes(searchLower)
        )
      }

      return true
    })

    // Sort calls
    filtered.sort((a, b) => {
      let comparison = 0
      
      switch (sortBy) {
        case 'date':
          comparison = new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
          break
        case 'duration':
          comparison = (a.durationSeconds || 0) - (b.durationSeconds || 0)
          break
        case 'outcome':
          comparison = a.outcome.localeCompare(b.outcome)
          break
      }

      return sortOrder === 'desc' ? -comparison : comparison
    })

    return filtered
  }, [calls, filters, sortBy, sortOrder, quickFilter])

  const formatDuration = (seconds: number | null | undefined) => {
    if (!seconds || seconds === 0) return 'N/A'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatTalkTime = (talkTimeSeconds: number | null | undefined, durationSeconds: number | null | undefined) => {
    // If we have talk time, use it
    if (talkTimeSeconds && talkTimeSeconds > 0) {
      return formatDuration(talkTimeSeconds)
    }
    
    // If we have duration but no talk time, and duration > 0, assume it was connected
    if (durationSeconds && durationSeconds > 0) {
      return formatDuration(durationSeconds) + ' (est.)'
    }
    
    // Don't show anything if no duration - we'll handle this with call status instead
    return null
  }

  // Helper function to determine if call was missed
  const isMissedCall = (call: CallHistoryEntry) => {
    return (
      (!call.durationSeconds || call.durationSeconds === 0) &&
      (call.outcome === 'no_answer' || call.status === 'no_answer')
    )
  }

  // Helper function to get direction icon and label
  const getDirectionInfo = (call: CallHistoryEntry) => {
    const missed = isMissedCall(call)
    
    if (missed) {
      return {
        icon: PhoneMissed,
        label: 'Missed',
        color: 'text-red-500',
        bgColor: 'bg-red-50'
      }
    }
    
    if (call.direction === 'inbound') {
      return {
        icon: PhoneIncoming,
        label: 'Inbound',
        color: 'text-blue-500',
        bgColor: 'bg-blue-50'
      }
    }
    
    return {
      icon: PhoneOutgoing,
      label: 'Outbound', 
      color: 'text-green-500',
      bgColor: 'bg-green-50'
    }
  }

  const getOutcomeDisplay = (outcome: string) => {
    // Handle the case where outcome is 'no_outcome' or empty
    if (!outcome || outcome === 'no_outcome') {
      return 'No Outcome'
    }
    
    // Map common outcomes to better display names
    const outcomeMap: Record<string, string> = {
      // New unified vocabulary
      'completed_form': 'Completed Form',
      'going_to_complete': 'Going to Complete',
      'might_complete': 'Might Complete',
      'call_back': 'Callback Requested',
      'no_answer': 'No Answer',
      'missed_call': 'Missed Call', // ✅ ADDED
      'hung_up': 'Hung Up',
      'bad_number': 'Bad Number',
      'no_claim': 'No Claim',
      'not_interested': 'Not Interested',
      'do_not_contact': 'Do Not Contact',
      
      // Legacy fallbacks
      'contacted': 'Contacted',
      'voicemail': 'Voicemail',
      'busy': 'Busy',
      'wrong_number': 'Wrong Number',
      'callback_requested': 'Callback Requested',
      'documents_discussed': 'Documents Discussed',
      'magic_link_sent': 'Magic Link Sent',
      'left_voicemail': 'Left Voicemail',
      'failed': 'Failed'
    }
    
    return outcomeMap[outcome] || outcome.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  const uniqueOutcomes = Array.from(new Set(calls.map(call => call.outcome)))
  const uniqueAgents = Array.from(new Set(calls.map(call => call.agentName).filter(Boolean)))

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Call History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2">Loading call history...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Call History
            <Badge variant="secondary">
              {filteredAndSortedCalls.length} {quickFilter === 'missed' ? 'missed' : ''} calls
            </Badge>
            {quickFilter === 'missed' && (
              <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50">
                <PhoneMissed className="h-3 w-3 mr-1" />
                Missed Only
              </Badge>
            )}
          </CardTitle>
          {onRefresh && (
            <Button 
              variant="outline" 
              size="default" 
              responsive="nowrap"
              onClick={onRefresh}
              className="border-slate-300 hover:bg-slate-100 shadow-md hover:shadow-lg transition-all duration-200"
            >
              <RefreshCw className="h-4 w-4 mr-2 flex-shrink-0" />
              Refresh
            </Button>
          )}
        </div>

        {/* Quick Filter Tabs */}
        <div className="flex gap-2 mt-4">
          <Button
            variant={quickFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setQuickFilter('all')}
            className={`transition-all duration-200 ${
              quickFilter === 'all'
                ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-md text-white'
                : 'hover:bg-blue-50 border-blue-200 text-blue-700'
            }`}
          >
            <Phone className="h-4 w-4 mr-1" />
            All Calls
          </Button>
          <Button
            variant={quickFilter === 'missed' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setQuickFilter('missed')}
            className={`transition-all duration-200 ${
              quickFilter === 'missed'
                ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-md text-white'
                : 'hover:bg-red-50 border-red-200 text-red-700'
            }`}
          >
            <PhoneMissed className="h-4 w-4 mr-1" />
            Missed Calls
          </Button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
          <div>
            <Input
              placeholder="Search calls..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="w-full"
            />
          </div>
          
          <Select value={filters.outcome} onValueChange={(value) => setFilters(prev => ({ ...prev, outcome: value }))}>
            <SelectTrigger>
              <SelectValue placeholder="All Outcomes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Outcomes</SelectItem>
              {uniqueOutcomes.map(outcome => (
                <SelectItem key={outcome} value={outcome}>
                  {getOutcomeDisplay(outcome)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.dateRange} onValueChange={(value) => setFilters(prev => ({ ...prev, dateRange: value }))}>
            <SelectTrigger>
              <SelectValue placeholder="All Time" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
            </SelectContent>
          </Select>

          {uniqueAgents.length > 1 && (
            <Select value={filters.agent} onValueChange={(value) => setFilters(prev => ({ ...prev, agent: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="All Agents" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Agents</SelectItem>
                {uniqueAgents.map(agent => (
                  <SelectItem key={agent} value={agent!}>
                    {agent}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {filteredAndSortedCalls.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Phone className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No call history found</p>
            <p className="text-sm">Try adjusting your filters or make some calls!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Sort Controls */}
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="text-slate-500 font-medium">Sort by:</span>
              <div className="flex flex-wrap gap-2">
                {(['date', 'duration', 'outcome'] as const).map(option => (
                  <Button
                    key={option}
                    variant={sortBy === option ? 'default' : 'ghost'}
                    size="sm"
                    responsive="nowrap"
                    onClick={() => {
                      if (sortBy === option) {
                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
                      } else {
                        setSortBy(option)
                        setSortOrder('desc')
                      }
                    }}
                    className={`flex items-center gap-1 transition-all duration-200 ${
                      sortBy === option 
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-md text-white' 
                        : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                    {sortBy === option && (
                      sortOrder === 'asc' ? <ChevronUp className="h-3 w-3 flex-shrink-0" /> : <ChevronDown className="h-3 w-3 flex-shrink-0" />
                    )}
                  </Button>
                ))}
              </div>
            </div>

            {/* Call List */}
            <div className="space-y-3">
              {filteredAndSortedCalls.map((call) => (
                <div key={call.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {showUserInfo && (
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            <User className="h-4 w-4" />
                            {call.userName || 'Unknown User'}
                          </div>
                          <div className="text-sm text-gray-500">{call.userPhone}</div>
                        </div>
                      )}
                      
                      <div>
                        <div className="text-sm text-gray-500">
                          {format(new Date(call.startedAt), 'MMM d, yyyy HH:mm')}
                        </div>
                        <div className="text-sm font-medium">{call.agentName}</div>
                      </div>
                      
                      {/* Last Outcome Notes */}
                      {call.outcomeNotes && (
                        <div className="max-w-xs">
                          <div className="text-xs text-gray-500 mb-1">Last Notes:</div>
                          <div className="text-sm text-gray-700 bg-gray-50 p-2 rounded text-left break-words overflow-hidden" 
                               style={{ 
                                 display: '-webkit-box',
                                 WebkitLineClamp: 2,
                                 WebkitBoxOrient: 'vertical' as any,
                                 maxHeight: '2.5rem'
                               }}>
                            {call.outcomeNotes}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-sm font-medium">
                          {formatDuration(call.durationSeconds)}
                        </div>
                        {formatTalkTime(call.talkTimeSeconds, call.durationSeconds) && (
                          <div className="text-xs text-gray-500">
                            {formatTalkTime(call.talkTimeSeconds, call.durationSeconds)}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        {/* Direction Indicator */}
                        {(() => {
                          const directionInfo = getDirectionInfo(call)
                          const DirectionIcon = directionInfo.icon
                          return (
                            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${directionInfo.bgColor} ${directionInfo.color}`}>
                              <DirectionIcon className="h-3 w-3" />
                              <span>{directionInfo.label}</span>
                            </div>
                          )
                        })()}
                        
                        <Badge className={OUTCOME_COLORS[call.outcome] || 'bg-gray-100 text-gray-800'}>
                          {getOutcomeDisplay(call.outcome)}
                        </Badge>
                        
                        {/* Action Buttons */}
                        <div className="flex items-center gap-2">
                          {/* Recording Player */}
                          <RecordingPlayer call={call} />
                          
                          {/* Portal Link Button */}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleSendMagicLink(call)}
                            disabled={sendMagicLinkMutation.isPending || !call.userPhone}
                            className="h-6 w-6 hover:bg-emerald-100 transition-colors"
                            title={call.userPhone ? 'Send portal link to user' : 'No phone number available'}
                          >
                            <Send className="h-3 w-3 text-emerald-600" />
                          </Button>
                          
                          {/* Review SMS Button */}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleSendReviewSMS(call)}
                            disabled={sendReviewSMSMutation.isPending || !call.userPhone}
                            className="h-6 w-6 hover:bg-purple-100 transition-colors"
                            title={call.userPhone ? 'Send review request to user' : 'No phone number available'}
                          >
                            <MessageSquare className="h-3 w-3 text-purple-600" />
                          </Button>
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="hover:bg-slate-100 transition-all duration-200"
                        onClick={() => setExpandedCall(expandedCall === call.id ? null : call.id)}
                      >
                        {expandedCall === call.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {expandedCall === call.id && (
                    <div className="mt-4 pt-4 border-t space-y-3">
                      {call.outcomeNotes && (
                        <div>
                          <div className="text-sm font-medium text-gray-700 mb-1">Notes:</div>
                          <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                            {call.outcomeNotes}
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        {call.magicLinkSent && (
                          <div className="flex items-center gap-1 text-blue-600">
                            <MessageSquare className="h-3 w-3" />
                            Magic Link Sent
                          </div>
                        )}
                        
                        {call.smsSent && (
                          <div className="flex items-center gap-1 text-green-600">
                            <MessageSquare className="h-3 w-3" />
                            SMS Sent
                          </div>
                        )}

                        {call.nextCallDelay && (
                          <div className="flex items-center gap-1 text-purple-600">
                            <Calendar className="h-3 w-3" />
                            Next call in {call.nextCallDelay}h
                          </div>
                        )}

                        {call.documentsRequested && call.documentsRequested.length > 0 && (
                          <div className="col-span-2">
                            <div className="text-sm font-medium text-gray-700 mb-1">Documents Requested:</div>
                            <div className="flex flex-wrap gap-1">
                              {call.documentsRequested.map((doc, index) => (
                                <Badge key={index} variant="outline" className="text-xs">
                                  {doc}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
} 