'use client'

import React, { useState, useCallback } from 'react'
import { Button } from '@/modules/core/components/ui/button'
import { 
  FileText, 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  Download 
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/trpc/client'
import type { 
  TranscriptionButtonProps, 
  TranscriptStatus, 
  TranscriptionState 
} from '../types/index'

/**
 * Ultra-lightweight transcription button
 * - No server dependencies in bundle
 * - No SSR/hydration issues
 * - Minimal memory footprint
 * - Smart polling only when needed
 */
export function AsyncTranscriptionButton({
  callId,
  disabled = false,
  size = 'sm',
  showText = false,
  onStatusChange,
  initialStatus,
  initialDownloadUrl
}: TranscriptionButtonProps) {
  const [state, setState] = useState<TranscriptionState>({
    status: initialStatus ?? 'idle',
    downloadUrl: initialDownloadUrl
  })
  const [pollCount, setPollCount] = useState(0)

  // tRPC mutations for transcription operations
  const queueMutation = api.transcriptionAsync.queue.useMutation()
  const downloadMutation = api.transcriptionAsync.download.useMutation()
  const utils = api.useUtils()

  // Validate callId early to prevent any URL construction issues
  const isValidCallId = callId && 
    typeof callId === 'string' && 
    callId.length > 0 && 
    callId !== 'undefined' && 
    callId !== 'null'

  // Early return for invalid callId - no hooks, no network calls
  if (!isValidCallId) {
    return (
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={true}
        className="h-6 w-6 opacity-50"
        title="Invalid call ID"
      >
        <AlertCircle className="h-3 w-3 text-red-500" />
      </Button>
    )
  }

  // If we were given initial completed state, prefer download mode immediately
  // Avoid polling unless user triggers a new transcription
  // This ensures tiles render correctly based on server data

  // Trigger transcription using tRPC (handles auth automatically)
  const triggerTranscription = useCallback(async () => {
    if (state.status === 'pending' || state.status === 'processing') return

    console.log(`🎙️ [CLIENT] Starting transcription for call ${callId}`)
    setState(prev => ({ ...prev, status: 'pending', error: undefined }))
    onStatusChange?.('pending')

    try {
      console.log(`🎙️ [CLIENT] Calling tRPC queue mutation for call ${callId}`)
      
      const result = await queueMutation.mutateAsync({ callId })
      console.log(`🎙️ [CLIENT] tRPC queue result:`, result)
      
      if (result.success) {
        if (result.alreadyCompleted) {
          console.log(`🎙️ [CLIENT] Transcription already completed`)
          setState(prev => ({ 
            ...prev, 
            status: 'completed',
            downloadUrl: result.downloadUrl 
          }))
          onStatusChange?.('completed')
        } else {
          console.log(`🎙️ [CLIENT] Job queued successfully, starting polling`)
          setState(prev => ({ ...prev, status: 'processing' }))
          onStatusChange?.('processing')
          startPolling()
        }
      } else {
        throw new Error(result.message || 'Failed to queue transcription')
      }
    } catch (error) {
      console.error('🎙️ [CLIENT] Transcription queue error:', error)
      setState(prev => ({ 
        ...prev, 
        status: 'failed', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }))
      onStatusChange?.('failed')
    }
  }, [callId, state.status, onStatusChange, queueMutation])

  // Smart polling - only when processing, with exponential backoff
  const startPolling = useCallback(() => {
    const maxPolls = 120 // 10 minutes max (5s intervals)
    setPollCount(0)

    console.log(`🔄 [CLIENT] Starting polling for call ${callId}`)

    const poll = async () => {
      if (pollCount >= maxPolls) {
        console.log(`⏰ [CLIENT] Polling timed out for call ${callId}`)
        setState(prev => ({ 
          ...prev, 
          status: 'failed', 
          error: 'Transcription timed out' 
        }))
        onStatusChange?.('failed')
        return
      }

      try {
        console.log(`🔄 [CLIENT] Polling status for call ${callId} (attempt ${pollCount + 1})`)
        
        // Use tRPC utils.fetch for status check (client-safe)
        const result = await utils.transcriptionAsync.getStatus.fetch({ callId })
        console.log(`🔄 [CLIENT] tRPC status result:`, result)
        
        setState(prev => ({ 
          ...prev, 
          status: result.status,
          progress: result.progress,
          downloadUrl: result.downloadUrl,
          error: result.error
        }))
        onStatusChange?.(result.status)

        if (result.status === 'completed' || result.status === 'failed') {
          console.log(`🎯 [CLIENT] Polling complete for call ${callId}: ${result.status}`)
          return // Stop polling
        }

        // Continue polling with smart intervals
        setPollCount(prev => prev + 1)
        const delay = Math.min(5000 + (pollCount * 1000), 15000) // 5s to 15s
        console.log(`🔄 [CLIENT] Next poll in ${delay}ms for call ${callId}`)
        setTimeout(poll, delay)

      } catch (error) {
        console.error('🔄 [CLIENT] Status polling error:', error)
        setState(prev => ({ 
          ...prev, 
          status: 'failed', 
          error: 'Failed to check status' 
        }))
        onStatusChange?.('failed')
      }
    }

    // Start polling after 2 seconds
    setTimeout(poll, 2000)
  }, [callId, pollCount, onStatusChange])

  // Download completed transcript using tRPC
  const downloadTranscript = useCallback(async () => {
    if (state.status === 'completed') {
      try {
        console.log(`📥 [CLIENT] Starting download for call ${callId}`)
        const result = await downloadMutation.mutateAsync({ callId, format: 'txt' })
        
        if (result.success && result.downloadUrl && typeof window !== 'undefined') {
          console.log(`📥 [CLIENT] Opening download URL: ${result.downloadUrl}`)
          window.open(result.downloadUrl, '_blank')
        }
      } catch (error) {
        console.error('📥 [CLIENT] Download error:', error)
        setState(prev => ({ 
          ...prev, 
          error: 'Download failed' 
        }))
      }
    }
  }, [callId, state.status, downloadMutation])

  // Get appropriate icon based on status
  const getIcon = () => {
    switch (state.status) {
      case 'pending':
        return <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
      case 'processing':
        return <Loader2 className="h-3 w-3 animate-spin text-orange-500" />
      case 'completed':
        return <CheckCircle className="h-3 w-3 text-green-600" />
      case 'failed':
        return <AlertCircle className="h-3 w-3 text-red-600" />
      default:
        return <FileText className="h-3 w-3 text-gray-600" />
    }
  }

  // Get appropriate title/tooltip
  const getTitle = () => {
    switch (state.status) {
      case 'pending':
        return 'Queuing transcription...'
      case 'processing':
        return `Transcribing audio... ${state.progress ? `(${state.progress}%)` : ''}`
      case 'completed':
        return 'Transcription ready - click to download'
      case 'failed':
        return `Transcription failed${state.error ? `: ${state.error}` : ''} - click to retry`
      default:
        return 'Start transcription'
    }
  }

  // Determine click action
  const handleClick = state.status === 'completed' ? downloadTranscript : triggerTranscription

  // Determine if button should be disabled
  const isDisabled = disabled || 
    state.status === 'pending' || 
    state.status === 'processing'

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={handleClick}
      disabled={isDisabled}
      className={cn(
        "h-6 w-6 transition-colors",
        state.status === 'completed' && "hover:bg-green-100",
        state.status === 'failed' && "hover:bg-red-100",
        state.status === 'idle' && "hover:bg-blue-100"
      )}
      title={getTitle()}
    >
      {getIcon()}
      {showText && (
        <span className="ml-1 text-xs">
          {state.status === 'completed' ? 'Download' : 'Transcribe'}
        </span>
      )}
    </Button>
  )
}
