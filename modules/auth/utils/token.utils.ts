// =============================================================================
// Token Utilities - Auth Module
// =============================================================================
// Utilities for managing authentication tokens across localStorage and cookies

export const tokenUtils = {
  /**
   * Store authentication token in both localStorage and cookies
   */
  store: (token: string): void => {
    // Store in localStorage (for client-side access)
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth-token', token)
    }
    
    // Store in cookies (for middleware access)
    if (typeof document !== 'undefined') {
      // Always use secure settings for both dev and prod (both use HTTPS)
      const isHttps = window.location.protocol === 'https:'
      
      // More explicit cookie settings
      const cookieOptions = [
        `auth-token=${token}`,
        'path=/',
        `max-age=${8 * 60 * 60}`, // 8 hours
        'samesite=lax',
        isHttps ? 'secure' : ''
      ].filter(Boolean).join('; ')
      
      document.cookie = cookieOptions
    }
  },

  /**
   * Clear authentication token from both localStorage and cookies
   */
  clear: (): void => {
    // Clear from localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth-token')
    }
    
    // Clear from cookies by setting expired date
    if (typeof document !== 'undefined') {
      // Clear with multiple variations to ensure removal
      const clearCookies = [
        'auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT',
        'auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT; secure',
        'auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT; samesite=lax'
      ]
      clearCookies.forEach(cookie => {
        document.cookie = cookie
      })
    }
  },

  /**
   * Get authentication token from localStorage
   */
  get: (): string | null => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('auth-token')
    }
    return null
  },

  /**
   * Check if user is authenticated (has valid token)
   */
  isAuthenticated: (): boolean => {
    const token = tokenUtils.get()
    return !!token && token !== ''
  }
} 