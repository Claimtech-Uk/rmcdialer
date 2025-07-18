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
      // Use less restrictive settings for Vercel deployment
      const isProduction = window.location.protocol === 'https:'
      const secureFlag = isProduction ? 'secure; ' : ''
      const sameSite = isProduction ? 'samesite=lax' : 'samesite=lax'
      document.cookie = `auth-token=${token}; path=/; max-age=${8 * 60 * 60}; ${secureFlag}${sameSite}`
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
      document.cookie = 'auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT'
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