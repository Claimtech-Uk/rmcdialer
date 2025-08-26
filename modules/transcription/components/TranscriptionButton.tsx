'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/modules/core/components/ui/button'
import { Badge } from '@/modules/core/components/ui/badge'
import { 
  FileText, 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  Download,
  RotateCcw
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranscription } from '../hooks/useTranscription'
import type { 
  TranscriptionButtonProps,
  TranscriptStatus 
} from '../types/transcription.types'

export function TranscriptionButton({
  callSessionId,
  currentStatus,
  onStatusChange,
  disabled = false,
  size = 'sm',
  showText = false
}: TranscriptionButtonProps) {
  const [showDetails, setShowDetails] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  
  // Prevent SSR/hydration issues by only initializing after mount
  useEffect(() => {
    setIsMounted(true)
  }, [])
  
  // Validate callSessionId to prevent URL construction errors
  const isValidCallSessionId = callSessionId && 
    typeof callSessionId === 'string' && 
    callSessionId.length > 0 && 
    callSessionId !== 'undefined' && 
    callSessionId !== 'null'

  // ALWAYS call the hook (React Rules of Hooks - must be unconditional)
  // But pass a safe dummy ID when not ready to prevent errors
  const transcriptionHook = useTranscription({
    callSessionId: (isMounted && isValidCallSessionId) ? callSessionId : 'dummy-id-not-ready',
    // Start with no auto-refresh or initial fetch to prevent N requests on large tables.
    // We'll enable auto-refresh after a user action (trigger/retranscribe).
    autoRefresh: false,
    initialFetch: false,
    onStatusChange: (isMounted && isValidCallSessionId) ? onStatusChange : undefined
  })

  // Show loading state until mounted to prevent hydration issues
  if (!isMounted) {
    return (
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={true}
        className="h-6 w-6 opacity-50"
        title="Loading transcription status..."
      >
        <Loader2 className="h-3 w-3 animate-spin" />
      </Button>
    )
  }

  // Return safe fallback if callSessionId is invalid to prevent URL errors
  if (!isValidCallSessionId) {
    return (
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={true}
        className="h-6 w-6 opacity-30"
        title="Invalid call session ID"
      >
        <FileText className="h-3 w-3 text-gray-400" />
      </Button>
    )
  }

  // Now we can safely destructure
  const {
    status,
    transcriptionResult,
    isLoading,
    error,
    progress,
    triggerTranscription,
    refreshStatus,
    downloadTranscript,
    clearError,
    canTrigger,
    isProcessing,
    isCompleted,
    hasFailed
  } = transcriptionHook

  // Use hook status or prop status
  const currentTranscriptStatus = status || currentStatus

  // Handle transcription trigger with double-click prevention
  const handleTriggerTranscription = async () => {
    if (!canTrigger || disabled) return
    
    try {
      // Refresh status once on demand to show latest before starting
      await refreshStatus()
      await triggerTranscription(false) // Don't force retranscribe by default
    } catch (error) {
      console.error('Failed to trigger transcription:', error)
    }
  }

  // Handle force retranscription
  const handleRetranscribe = async () => {
    if (disabled) return
    
    try {
      await refreshStatus()
      await triggerTranscription(true) // Force retranscribe
    } catch (error) {
      console.error('Failed to retranscribe:', error)
    }
  }

  // Handle download
  const handleDownload = async () => {
    if (!isCompleted) return
    
    try {
      await downloadTranscript('txt')
    } catch (error) {
      console.error('Failed to download transcript:', error)
    }
  }

  // Get appropriate icon based on status
  const getStatusIcon = () => {
    if (isLoading || isProcessing) {
      return <Loader2 className="h-3 w-3 animate-spin" />
    }
    
    if (isCompleted) {
      return <CheckCircle className="h-3 w-3" />
    }
    
    if (hasFailed) {
      return <AlertCircle className="h-3 w-3" />
    }
    
    return <FileText className="h-3 w-3" />
  }

  // Get status color classes
  const getStatusClasses = () => {
    if (isProcessing) {
      return 'hover:bg-blue-100 text-blue-600'
    }
    
    if (isCompleted) {
      return 'hover:bg-green-100 text-green-600'
    }
    
    if (hasFailed) {
      return 'hover:bg-red-100 text-red-600'
    }
    
    return 'hover:bg-purple-100 text-purple-600'
  }

  // Get tooltip text
  const getTooltipText = () => {
    if (disabled) return 'No recording available'
    if (isLoading) return 'Loading transcription status...'
    if (isProcessing) return `Transcribing audio... ${progress ? `${progress}%` : ''}`
    if (isCompleted) return 'Transcription completed - Click to download'
    if (hasFailed) return `Transcription failed${error ? `: ${error.message}` : ''} - Click to retry`
    return 'Generate transcript using AI'
  }

  // Render main button
  const renderMainButton = () => {
    // If completed, show download button
    if (isCompleted) {
      return (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleDownload}
          disabled={disabled}
          className={cn("h-6 w-6 transition-colors", getStatusClasses())}
          title={getTooltipText()}
        >
          <Download className="h-3 w-3" />
        </Button>
      )
    }

    // If failed, show retry button
    if (hasFailed) {
      return (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => {
            clearError()
            handleTriggerTranscription()
          }}
          disabled={disabled || isLoading}
          className={cn("h-6 w-6 transition-colors", getStatusClasses())}
          title={getTooltipText()}
        >
          <RotateCcw className="h-3 w-3" />
        </Button>
      )
    }

    // Default: trigger transcription button
    return (
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={handleTriggerTranscription}
        disabled={disabled || !canTrigger}
        className={cn("h-6 w-6 transition-colors", getStatusClasses())}
        title={getTooltipText()}
      >
        {getStatusIcon()}
      </Button>
    )
  }

  // Render with text version
  if (showText) {
    return (
      <div className="flex items-center gap-2">
        {renderMainButton()}
        
        {/* Status text and progress */}
        <div className="flex flex-col">
          <div className="text-xs font-medium">
            {isProcessing && 'Transcribing...'}
            {isCompleted && 'Transcript Ready'}
            {hasFailed && 'Failed'}
            {!currentTranscriptStatus && 'Generate Transcript'}
          </div>
          
          {/* Progress bar for processing */}
          {isProcessing && progress && (
            <div className="w-16 h-1 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
          
          {/* Word count for completed */}
          {isCompleted && transcriptionResult?.wordCount && (
            <div className="text-xs text-gray-500">
              {transcriptionResult.wordCount} words
            </div>
          )}
        </div>
        
        {/* Additional actions when completed */}
        {isCompleted && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleRetranscribe}
            disabled={disabled || isLoading}
            className="h-6 w-6 hover:bg-gray-100 transition-colors"
            title="Re-transcribe audio"
          >
            <RotateCcw className="h-3 w-3 text-gray-600" />
          </Button>
        )}
      </div>
    )
  }

  // Compact icon-only version (default)
  return (
    <div className="flex items-center gap-1">
      {renderMainButton()}
      
      {/* Status badge for processing/completed */}
      {(isProcessing || isCompleted) && (
        <div className="flex items-center">
          {isProcessing && progress && (
            <Badge variant="secondary" className="text-xs px-1 py-0 h-4">
              {Math.round(progress)}%
            </Badge>
          )}
          
          {isCompleted && transcriptionResult?.wordCount && (
            <Badge variant="secondary" className="text-xs px-1 py-0 h-4">
              {Math.round(transcriptionResult.wordCount / 100)}k
            </Badge>
          )}
        </div>
      )}
    </div>
  )
}

// Helper component for displaying transcript content
export function TranscriptDisplay({ 
  transcriptionResult,
  onDownload,
  onRetranscribe,
  showSummary = true,
  showSegments = false
}: {
  transcriptionResult: any
  onDownload?: (format: 'txt' | 'json' | 'srt') => void
  onRetranscribe?: () => void
  showSummary?: boolean
  showSegments?: boolean
}) {
  const [selectedFormat, setSelectedFormat] = useState<'txt' | 'json' | 'srt'>('txt')

  if (!transcriptionResult || !transcriptionResult.transcriptText) {
    return (
      <div className="text-center py-4 text-gray-500">
        <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No transcript available</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Call Transcript</h3>
        <div className="flex items-center gap-2">
          <select 
            value={selectedFormat}
            onChange={(e) => setSelectedFormat(e.target.value as any)}
            className="text-xs border rounded px-2 py-1"
          >
            <option value="txt">Text (.txt)</option>
            <option value="json">JSON (.json)</option>
            <option value="srt">Subtitles (.srt)</option>
          </select>
          
          <Button
            size="sm"
            onClick={() => onDownload?.(selectedFormat)}
            className="flex items-center gap-1"
          >
            <Download className="h-3 w-3" />
            Download
          </Button>
          
          {onRetranscribe && (
            <Button
              size="sm"
              variant="outline"
              onClick={onRetranscribe}
              className="flex items-center gap-1"
            >
              <RotateCcw className="h-3 w-3" />
              Re-transcribe
            </Button>
          )}
        </div>
      </div>

      {/* Summary section */}
      {showSummary && transcriptionResult.transcriptSummary && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">AI Summary</h4>
          <p className="text-blue-800 text-sm">{transcriptionResult.transcriptSummary}</p>
        </div>
      )}

      {/* Transcript text */}
      <div className="bg-gray-50 border rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-2">Full Transcript</h4>
        <div className="text-sm text-gray-700 whitespace-pre-wrap max-h-96 overflow-y-auto">
          {transcriptionResult.transcriptText}
        </div>
      </div>

      {/* Metadata */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        {transcriptionResult.wordCount && (
          <span>{transcriptionResult.wordCount} words</span>
        )}
        {transcriptionResult.language && (
          <span>Language: {transcriptionResult.language}</span>
        )}
        {transcriptionResult.confidence && (
          <span>Confidence: {Math.round(transcriptionResult.confidence * 100)}%</span>
        )}
        {transcriptionResult.completedAt && (
          <span>Completed: {new Date(transcriptionResult.completedAt).toLocaleString()}</span>
        )}
      </div>
    </div>
  )
}
