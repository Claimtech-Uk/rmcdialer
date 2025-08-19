// Client-only transcription module exports
// Zero server dependencies - safe for browser bundle

import dynamic from 'next/dynamic'
import React from 'react'

// Dynamic import with SSR disabled to prevent hydration issues
export const AsyncTranscriptionButton = dynamic(
  () => import('./components/AsyncTranscriptionButton').then(mod => ({ 
    default: mod.AsyncTranscriptionButton 
  })),
  {
    ssr: false, // Critical: prevents SSR/hydration issues
    loading: () => React.createElement('div', {
      className: 'h-6 w-6 bg-gray-100 rounded animate-pulse',
      title: 'Loading transcription...'
    })
  }
)

// Export types for external use
export type { 
  TranscriptStatus, 
  TranscriptionButtonProps, 
  TranscriptionState 
} from './types/index'
