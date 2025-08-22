'use client'

import * as React from 'react'

export default function Error({ error, reset }: { error: Error & { digest?: string }, reset: () => void }) {
  React.useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('Route error boundary caught:', { message: error?.message, digest: error?.digest })
  }, [error])

  return (
    <div style={{
      minHeight: '60vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '10px',
      textAlign: 'center'
    }}>
      <h1 style={{ fontSize: '24px', fontWeight: 600 }}>Something went wrong on this page</h1>
      <button onClick={() => reset()} style={{
        marginTop: '8px',
        padding: '10px 14px',
        borderRadius: '8px',
        background: '#111827',
        color: '#fff',
        cursor: 'pointer',
        border: 'none'
      }}>Try again</button>
    </div>
  )
}

