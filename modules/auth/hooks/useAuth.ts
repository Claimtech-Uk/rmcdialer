'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/trpc/client'
import type { AgentProfile } from '../types/auth.types'

interface AuthState {
  agent: AgentProfile | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    agent: null,
    isAuthenticated: false,
    isLoading: true,
    error: null
  })
  
  const router = useRouter()
  
  // Check if user is authenticated on mount
  useEffect(() => {
    const token = localStorage.getItem('auth-token')
    if (token) {
      // Verify token validity by fetching profile
      // This will be implemented when we have the profile endpoint
      setAuthState(prev => ({
        ...prev,
        isAuthenticated: true,
        isLoading: false
      }))
    } else {
      setAuthState(prev => ({
        ...prev,
        isLoading: false
      }))
    }
  }, [])
  
  const login = async (credentials: { email: string; password: string }) => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }))
    
    try {
      // This will be called by the LoginForm component using tRPC
      // We just need to provide the interface here
      setAuthState(prev => ({
        ...prev,
        isAuthenticated: true,
        isLoading: false
      }))
    } catch (error) {
      setAuthState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Login failed',
        isLoading: false
      }))
    }
  }
  
  const logout = () => {
    localStorage.removeItem('auth-token')
    setAuthState({
      agent: null,
      isAuthenticated: false,
      isLoading: false,
      error: null
    })
    router.push('/login')
  }
  
  const clearError = () => {
    setAuthState(prev => ({ ...prev, error: null }))
  }
  
  return {
    ...authState,
    login,
    logout,
    clearError
  }
} 