'use client'

// Minimal App Router global error page (client component required)
import * as React from 'react'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }, reset: () => void }) {
  React.useEffect(() => {
    // Log the error to an error reporting service if desired
    // eslint-disable-next-line no-console
    console.error('Global error boundary caught:', { message: error?.message, digest: error?.digest })
  }, [error])

  return (
    <html>
      <body style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        textAlign: 'center'
      }}>
        <h1 style={{ fontSize: '26px', fontWeight: 600 }}>Something went wrong</h1>
        <p style={{ color: '#666' }}>An unexpected error occurred. You can try again.</p>
        <button onClick={() => reset()} style={{
          marginTop: '8px',
          padding: '10px 14px',
          borderRadius: '8px',
          background: '#111827',
          color: '#fff',
          cursor: 'pointer',
          border: 'none'
        }}>Try again</button>
      </body>
    </html>
  )
}

