'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/modules/core/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/modules/core/components/ui/card'
import { Input } from '@/modules/core/components/ui/input'
import { Label } from '@/modules/core/components/ui/label'
import { Alert, AlertDescription } from '@/modules/core/components/ui/alert'
import { Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react'
import { api } from '@/lib/trpc/client'
import { useAuth } from '../hooks/useAuth'
import { tokenUtils } from '../utils/token.utils'

interface LoginFormData {
  email: string
  password: string
}

interface LoginFormProps {
  onSuccess?: () => void
  redirectTo?: string
}

export function LoginForm({ onSuccess, redirectTo = '/dashboard' }: LoginFormProps) {
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Partial<LoginFormData>>({})
  const [showDevButtons, setShowDevButtons] = useState(false)
  
  const router = useRouter()
  const { login } = useAuth()
  
  const loginMutation = api.auth.login.useMutation({
    onSuccess: (data) => {
      // Store token in both localStorage and cookies
      tokenUtils.store(data.accessToken)
      
      if (onSuccess) {
        onSuccess()
      } else {
        router.replace(redirectTo as any)
      }
    },
    onError: (error) => {
      console.error('Login failed:', error)
    }
  })

  const validateForm = (): boolean => {
    const errors: Partial<LoginFormData> = {}

    if (!formData.email) {
      errors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address'
    }

    if (!formData.password) {
      errors.password = 'Password is required'
    } else if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters'
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    loginMutation.mutate({
      email: formData.email,
      password: formData.password
    })
  }

  const handleInputChange = (field: keyof LoginFormData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: e.target.value
    }))
    
    // Clear validation error when user starts typing
    if (validationErrors[field]) {
      setValidationErrors(prev => ({
        ...prev,
        [field]: undefined
      }))
    }
  }

  // Development quick login options
  const devAccounts = [
    { email: 'agent@test.com', password: 'password123', role: 'Agent', description: 'Standard agent account' },
    { email: 'supervisor@test.com', password: 'password123', role: 'Supervisor', description: 'Team supervisor with analytics' },
    { email: 'admin@test.com', password: 'password123', role: 'Admin', description: 'Full system administrator' },
  ]

  const handleQuickLogin = (email: string, password: string) => {
    setFormData({ email, password })
    setValidationErrors({})
    
    // Auto-submit after a short delay
    setTimeout(() => {
      loginMutation.mutate({ email, password })
    }, 100)
  }

  // Show dev buttons for testing - can be controlled via environment
  useEffect(() => {
    // Always show on Vercel deployments and localhost for now
    setShowDevButtons(true)
  }, [])

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center">
          Sign in to RMC Dialler
        </CardTitle>
        <CardDescription className="text-center">
          Enter your credentials to access the dialler system
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Error Alert */}
          {loginMutation.error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {loginMutation.error.message || 'Login failed. Please check your credentials.'}
              </AlertDescription>
            </Alert>
          )}

          {/* Email Field */}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={formData.email}
              onChange={handleInputChange('email')}
              className={validationErrors.email ? 'border-red-500' : ''}
              disabled={loginMutation.isPending}
            />
            {validationErrors.email && (
              <p className="text-sm text-red-500">{validationErrors.email}</p>
            )}
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleInputChange('password')}
                className={validationErrors.password ? 'border-red-500 pr-10' : 'pr-10'}
                disabled={loginMutation.isPending}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
                disabled={loginMutation.isPending}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            {validationErrors.password && (
              <p className="text-sm text-red-500">{validationErrors.password}</p>
            )}
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full"
            disabled={loginMutation.isPending}
          >
            {loginMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {loginMutation.isPending ? 'Signing in...' : 'Sign in'}
          </Button>

          {/* Development Note */}
          {showDevButtons && (
            <div className="text-center text-sm text-gray-500">
              <p>Development Mode</p>
              <p className="text-xs mt-1">
                Use any valid email and password (min 8 chars)
              </p>
            </div>
          )}
        </form>

        {/* Development Quick Login Section */}
        {showDevButtons && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="text-center mb-4">
              <h3 className="text-sm font-medium text-gray-700">Quick Login (Development)</h3>
              <p className="text-xs text-gray-500 mt-1">Click to instantly sign in as different roles</p>
            </div>
            
            <div className="space-y-2">
              {devAccounts.map((account, index) => (
                <Button
                  key={index}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-left"
                  onClick={() => handleQuickLogin(account.email, account.password)}
                  disabled={loginMutation.isPending}
                >
                  <div className="flex items-center justify-between w-full">
                    <div>
                      <div className="font-medium text-sm">{account.role}</div>
                      <div className="text-xs text-gray-500">{account.description}</div>
                    </div>
                    <div className="text-xs text-gray-400">{account.email}</div>
                  </div>
                </Button>
              ))}
            </div>
            
            <div className="mt-3 text-center">
              <p className="text-xs text-gray-400">
                All accounts use password: <code className="bg-gray-100 px-1 rounded">password123</code>
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
} 