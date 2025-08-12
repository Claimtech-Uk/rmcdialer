'use client'

import { useState } from 'react'

const behaviours = [
  { label: 'user (clear override)', value: 'user' },
  { label: 'unsigned', value: 'unsigned' },
  { label: 'outstanding info', value: 'outstanding info' },
  { label: 'reviews', value: 'reviews' },
  { label: 'customer service', value: 'customer service' }
]

export default function AiBehaviourPage() {
  const [phone, setPhone] = useState('')
  const [behaviour, setBehaviour] = useState('user')
  const [ttl, setTtl] = useState(7200)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setStatus(null)
    setError(null)
    try {
      const res = await fetch('/api/ai-behaviour/override', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Optional header auth; provide ADMIN_CONTROL_TOKEN in env for prod use
          ...(process.env.NEXT_PUBLIC_ADMIN_CONTROL_TOKEN
            ? { 'x-admin-token': process.env.NEXT_PUBLIC_ADMIN_CONTROL_TOKEN as string }
            : {})
        },
        body: JSON.stringify({ phone, behaviour, ttlSeconds: ttl })
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || 'Failed')
      setStatus(`Saved: ${json.behaviour || 'cleared'} for ${json.phone || phone}`)
    } catch (err: any) {
      setError(err?.message || 'Unknown error')
    }
  }

  return (
    <div style={{ maxWidth: 560, margin: '32px auto', padding: 16, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto' }}>
      <h2 style={{ marginBottom: 8 }}>AI Behaviour Override</h2>
      <p style={{ color: '#666', marginBottom: 16 }}>Temporarily force the agent into a specific behaviour for the given phone. Choose "user" to clear override.</p>

      <label style={{ display: 'block', marginTop: 8 }}>Phone (E164 or local)</label>
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="+447..."
        style={{ width: '100%', padding: 10, border: '1px solid #ccc', borderRadius: 6 }}
      />

      <label style={{ display: 'block', marginTop: 12 }}>Behaviour</label>
      <select value={behaviour} onChange={(e) => setBehaviour(e.target.value)} style={{ width: '100%', padding: 10, border: '1px solid #ccc', borderRadius: 6 }}>
        {behaviours.map(b => (
          <option key={b.value} value={b.value}>{b.label}</option>
        ))}
      </select>

      <label style={{ display: 'block', marginTop: 12 }}>TTL (seconds)</label>
      <input type="number" value={ttl} onChange={(e) => setTtl(Number(e.target.value || 0))} style={{ width: '100%', padding: 10, border: '1px solid #ccc', borderRadius: 6 }} />

      <button onClick={submit} style={{ marginTop: 16, padding: '10px 16px', borderRadius: 6, border: 'none', background: '#0A84FF', color: '#fff', cursor: 'pointer' }}>Save</button>

      {status && <div style={{ marginTop: 12, color: '#0A7B34' }}>{status}</div>}
      {error && <div style={{ marginTop: 12, color: '#B00020' }}>{error}</div>}

      <div style={{ marginTop: 24, color: '#666', fontSize: 13 }}>
        <div>Options map:</div>
        <ul>
          <li>user → clear override</li>
          <li>unsigned → unsigned_chase</li>
          <li>outstanding info → requirements</li>
          <li>reviews → review_collection</li>
          <li>customer service → customer_service</li>
        </ul>
      </div>
    </div>
  )
}


