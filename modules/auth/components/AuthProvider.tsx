'use client'

import { useEffect, ReactNode, createContext, useContext } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/trpc/client'
import { useAuth } from '../hooks/useAuth'
import type { AgentProfile } from '../types/auth.types'

interface AuthContextType {
  agent: AgentProfile | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (credentials: { email: string; password: string }) => Promise<void>
  logout: () => void
  clearError: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const auth = useAuth()
  const router = useRouter()

  // Check authentication status on mount
  useEffect(() => {
    const token = localStorage.getItem('auth-token')
    if (token) {
      // In a real app, we'd verify the token here
      // For now, just mark as authenticated if token exists
    }
  }, [])

  // Redirect to login if not authenticated on protected routes
  useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated) {
      const currentPath = window.location.pathname
      if (currentPath.startsWith('/dashboard') || currentPath === '/') {
        router.replace('/login')
      }
    }
  }, [auth.isAuthenticated, auth.isLoading, router])

  // Show loading spinner while checking authentication
  if (auth.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Checking authentication...</p>
        </div>
      </div>
    )
  }

  const contextValue: AuthContextType = {
    agent: auth.agent,
    isAuthenticated: auth.isAuthenticated,
    isLoading: auth.isLoading,
    login: auth.login,
    logout: auth.logout,
    clearError: auth.clearError
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
}

// Hook to use auth context
export function useAuthContext() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider')
  }
  return context
} 