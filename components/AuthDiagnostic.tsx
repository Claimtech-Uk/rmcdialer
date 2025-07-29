'use client'

import { useEffect, useState } from 'react'

interface DiagnosticInfo {
  localStorage: {
    hasToken: boolean
    tokenLength: number
    tokenPreview: string
  }
  cookies: {
    authToken: string | null
    allCookies: string[]
  }
  domain: {
    hostname: string
    protocol: string
    origin: string
    pathname: string
  }
  browser: {
    userAgent: string
    cookiesEnabled: boolean
  }
}

export function AuthDiagnostic() {
  const [info, setInfo] = useState<DiagnosticInfo | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const gatherInfo = () => {
      const token = localStorage.getItem('auth-token')
      const authCookie = document.cookie
        .split('; ')
        .find(row => row.startsWith('auth-token='))
        ?.split('=')[1] || null

      const allCookies = document.cookie.split('; ').map(c => c.split('=')[0])

      setInfo({
        localStorage: {
          hasToken: !!token,
          tokenLength: token?.length || 0,
          tokenPreview: token ? `${token.substring(0, 10)}...${token.substring(token.length - 10)}` : 'none'
        },
        cookies: {
          authToken: authCookie,
          allCookies
        },
        domain: {
          hostname: window.location.hostname,
          protocol: window.location.protocol,
          origin: window.location.origin,
          pathname: window.location.pathname
        },
        browser: {
          userAgent: navigator.userAgent.substring(0, 100),
          cookiesEnabled: navigator.cookieEnabled
        }
      })
    }

    gatherInfo()
    const interval = setInterval(gatherInfo, 3000)
    return () => clearInterval(interval)
  }, [])

  // Show/hide with Ctrl+Shift+D
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        setVisible(!visible)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [visible])

  if (!visible || !info) return null

  const isIssue = !info.localStorage.hasToken || !info.cookies.authToken

  return (
    <div className="fixed bottom-4 right-4 z-[9999] bg-gray-800 text-white p-4 rounded-lg text-xs max-w-md max-h-96 overflow-auto shadow-2xl">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-bold text-sm">🔐 Auth Diagnostic</h3>
        <button 
          onClick={() => setVisible(false)}
          className="text-gray-400 hover:text-white"
        >
          ✕
        </button>
      </div>

      <div className={`mb-3 p-2 rounded ${isIssue ? 'bg-red-900' : 'bg-green-900'}`}>
        <strong>{isIssue ? '❌ Auth Issue Detected' : '✅ Auth OK'}</strong>
      </div>

      <div className="space-y-3">
        <div>
          <strong className="text-blue-300">localStorage:</strong>
          <div className="ml-2">
            <div>Token: {info.localStorage.hasToken ? '✅' : '❌'}</div>
            <div>Length: {info.localStorage.tokenLength}</div>
            <div>Preview: {info.localStorage.tokenPreview}</div>
          </div>
        </div>

        <div>
          <strong className="text-green-300">Cookies:</strong>
          <div className="ml-2">
            <div>auth-token: {info.cookies.authToken ? '✅' : '❌'}</div>
            <div>All cookies: {info.cookies.allCookies.join(', ')}</div>
          </div>
        </div>

        <div>
          <strong className="text-yellow-300">Domain:</strong>
          <div className="ml-2">
            <div>Host: {info.domain.hostname}</div>
            <div>Protocol: {info.domain.protocol}</div>
            <div>Path: {info.domain.pathname}</div>
          </div>
        </div>

        <div>
          <strong className="text-purple-300">Browser:</strong>
          <div className="ml-2">
            <div>Cookies: {info.browser.cookiesEnabled ? '✅' : '❌'}</div>
            <div>UA: {info.browser.userAgent}...</div>
          </div>
        </div>
      </div>

      <div className="mt-3 pt-2 border-t border-gray-600 text-xs text-gray-400">
        Press Ctrl+Shift+D to toggle
      </div>
    </div>
  )
} 