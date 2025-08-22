// Minimal App Router 404 page (no next/document usage)
export default function NotFound() {
  return (
    <div style={{
      minHeight: '60vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      textAlign: 'center'
    }}>
      <h1 style={{ fontSize: '28px', fontWeight: 600 }}>404: This page could not be found.</h1>
      <p style={{ color: '#666' }}>Try checking the URL, or return to the dashboard.</p>
      <a href="/" style={{
        marginTop: '8px',
        padding: '10px 14px',
        borderRadius: '8px',
        background: '#111827',
        color: '#fff',
        textDecoration: 'none'
      }}>Go to Home</a>
    </div>
  )
}

