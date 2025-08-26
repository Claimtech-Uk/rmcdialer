'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { api } from '@/lib/trpc/client'
import { useToast } from '@/modules/core/hooks/use-toast'
import type {
  TranscriptStatus,
  TranscriptionResult,
  TranscriptionError,
  UseTranscriptionOptions,
  UseTranscriptionReturn
} from '../types/transcription.types'

export function useTranscription(options: UseTranscriptionOptions): UseTranscriptionReturn {
  const {
    callSessionId,
    autoRefresh = false,
    refreshInterval = 3000, // 3 seconds
    initialFetch = false,
    onStatusChange,
    onComplete,
    onError
  } = options

  // State management
  const [status, setStatus] = useState<TranscriptStatus>(null)
  const [transcriptionResult, setTranscriptionResult] = useState<TranscriptionResult | undefined>()
  const [error, setError] = useState<TranscriptionError | undefined>()
  const [progress, setProgress] = useState<number | undefined>()
  const [isManualLoading, setIsManualLoading] = useState(false)

  // Refs for cleanup and interval management
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const mountedRef = useRef(true)

  // Toast for user feedback
  const { toast } = useToast()

  // tRPC mutations and queries
  const triggerTranscriptionMutation = api.transcription.trigger.useMutation({
    onSuccess: (response) => {
      if (!mountedRef.current) return
      
      if (response.success) {
        setStatus(response.status)
        setError(undefined)
        onStatusChange?.(response.status)
        
        toast({
          title: 'Transcription Started',
          description: `Processing audio... ${response.estimatedWaitTimeSeconds ? `Estimated time: ${Math.round(response.estimatedWaitTimeSeconds / 60)} minutes` : ''}`
        })

        // Start auto-refresh for processing status
        if (response.status === 'processing' && autoRefresh) {
          startStatusPolling()
        }
      } else {
        const errorObj: TranscriptionError = {
          code: 'WHISPER_API_ERROR',
          message: response.message,
          retryable: true
        }
        setError(errorObj)
        onError?.(errorObj)
        
        toast({
          title: 'Transcription Failed',
          description: response.message,
          variant: 'destructive'
        })
      }
      setIsManualLoading(false)
    },
    onError: (error) => {
      if (!mountedRef.current) return
      
      const transcriptionError: TranscriptionError = {
        code: 'NETWORK_ERROR',
        message: error.message || 'Failed to start transcription',
        retryable: true
      }
      setError(transcriptionError)
      onError?.(transcriptionError)
      setIsManualLoading(false)
      
      toast({
        title: 'Network Error',
        description: 'Failed to connect to transcription service',
        variant: 'destructive'
      })
    }
  })

  const statusQuery = api.transcription.status.useQuery(
    { callSessionId },
    {
      enabled: false, // Manual control
      retry: (failureCount, error) => {
        // Retry network errors but not client errors
        return failureCount < 3 && !error.message.includes('not found')
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
      onSuccess: (data) => {
        if (!mountedRef.current) return
        
        if (data) {
          const previousStatus = status
          setStatus(data.status)
          setTranscriptionResult(data)
          setError(undefined)
          
          // Update progress based on status
          if (data.status === 'processing') {
            setProgress(data.progress || 50) // Default to 50% if no specific progress
          } else if (data.status === 'completed') {
            setProgress(100)
            stopStatusPolling() // Stop polling when complete
          } else if (data.status === 'failed') {
            setProgress(0)
            stopStatusPolling()
          }
          
          // Trigger callbacks
          onStatusChange?.(data.status)
          
          if (data.status === 'completed' && previousStatus === 'processing') {
            onComplete?.(data)
            toast({
              title: 'Transcription Complete! 🎉',
              description: `Generated ${data.wordCount || 0} words in transcript`
            })
          }
          
          if (data.status === 'failed' && data.failureReason) {
            const errorObj: TranscriptionError = {
              code: 'WHISPER_API_ERROR',
              message: data.failureReason,
              retryable: true
            }
            setError(errorObj)
            onError?.(errorObj)
            
            toast({
              title: 'Transcription Failed',
              description: data.failureReason,
              variant: 'destructive'
            })
          }
        }
      },
      onError: (error) => {
        if (!mountedRef.current) return
        
        const transcriptionError: TranscriptionError = {
          code: 'NETWORK_ERROR',
          message: error.message || 'Failed to check transcription status',
          retryable: true
        }
        setError(transcriptionError)
        onError?.(transcriptionError)
      }
    }
  )

  const downloadMutation = api.transcription.download.useMutation({
    onSuccess: (response) => {
      // Validate response and URL before attempting download
      if (response?.downloadUrl && typeof response.downloadUrl === 'string' && response.downloadUrl.trim()) {
        try {
          // Ensure we're in browser environment
          if (typeof window !== 'undefined' && typeof document !== 'undefined') {
            // Smart URL construction: handle both absolute and relative URLs safely
            let finalUrl: URL
            try {
              // First, try to parse as an absolute URL
              finalUrl = new URL(response.downloadUrl)
            } catch {
              // If that fails, treat as relative and resolve against origin
              if (window.location?.origin) {
                finalUrl = new URL(response.downloadUrl, window.location.origin)
              } else {
                throw new Error('Unable to resolve download URL: no window.location.origin available')
              }
            }
            
            // Trigger download
            const link = document.createElement('a')
            link.href = finalUrl.href
            link.download = `transcript-${callSessionId}.${response.format || 'txt'}`
            link.style.display = 'none' // Hide the link
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            
            toast({
              title: 'Download Started',
              description: 'Transcript file is downloading...'
            })
          } else {
            throw new Error('Download not available during server-side rendering')
          }
        } catch (urlError) {
          console.error('Download URL error:', urlError)
          toast({
            title: 'Download Failed',
            description: 'Invalid download URL received',
            variant: 'destructive'
          })
        }
      } else {
        toast({
          title: 'Download Failed',
          description: 'No download URL provided',
          variant: 'destructive'
        })
      }
    },
    onError: (error) => {
      toast({
        title: 'Download Failed',
        description: error.message || 'Could not download transcript',
        variant: 'destructive'
      })
    }
  })

  // Polling management (browser-only)
  const startStatusPolling = useCallback(() => {
    // Only start polling in browser environment
    if (typeof window === 'undefined') return
    
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current)
    }
    
    refreshIntervalRef.current = setInterval(() => {
      if (mountedRef.current && (status === 'processing' || status === 'pending')) {
        statusQuery.refetch()
      } else {
        stopStatusPolling()
      }
    }, refreshInterval)
  }, [refreshInterval, status]) // Removed statusQuery from deps

  const stopStatusPolling = useCallback(() => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current)
      refreshIntervalRef.current = null
    }
  }, [])

  // Action functions
  const triggerTranscription = useCallback(async (forceRetranscribe: boolean = false) => {
    setIsManualLoading(true)
    setError(undefined)
    
    await triggerTranscriptionMutation.mutateAsync({
      callSessionId,
      forceRetranscribe
    })
  }, [callSessionId, triggerTranscriptionMutation])

  const refreshStatus = useCallback(async () => {
    await statusQuery.refetch()
  }, []) // Removed statusQuery from deps - it's stable from useQuery

  const downloadTranscript = useCallback(async (format: 'txt' | 'json' | 'srt' = 'txt') => {
    await downloadMutation.mutateAsync({
      callSessionId,
      format
    })
  }, [callSessionId, downloadMutation])

  const clearError = useCallback(() => {
    setError(undefined)
  }, [])

  // Initial status check (opt-in) to prevent N requests on large tables
  useEffect(() => {
    if (initialFetch && callSessionId && typeof window !== 'undefined') {
      const timeoutId = setTimeout(() => {
        statusQuery.refetch()
      }, 100)
      return () => clearTimeout(timeoutId)
    }
  }, [initialFetch, callSessionId]) // Removed statusQuery from deps to prevent infinite re-renders

  // Auto-refresh management (only in browser environment)
  useEffect(() => {
    if (typeof window !== 'undefined' && autoRefresh && (status === 'processing' || status === 'pending')) {
      startStatusPolling()
    } else {
      stopStatusPolling()
    }

    return () => {
      stopStatusPolling()
    }
  }, [autoRefresh, status, startStatusPolling, stopStatusPolling])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false
      stopStatusPolling()
    }
  }, [stopStatusPolling])

  // Computed state
  const isLoading = statusQuery.isLoading || triggerTranscriptionMutation.isPending || isManualLoading
  const canTrigger = !isLoading && status !== 'processing'
  const isProcessing = status === 'processing'
  const isCompleted = status === 'completed'
  const hasFailed = status === 'failed'

  return {
    // Current state
    status,
    transcriptionResult,
    isLoading,
    error,
    progress,
    
    // Actions
    triggerTranscription,
    refreshStatus,
    downloadTranscript,
    clearError,
    
    // State checks
    canTrigger,
    isProcessing,
    isCompleted,
    hasFailed
  }
}
