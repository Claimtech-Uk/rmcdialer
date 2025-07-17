import { useEffect, ReactNode } from 'react';
import { useAuthStore } from '../store/auth';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { initializeAuth, isLoading } = useAuthStore();

  useEffect(() => {
    // Initialize authentication when the app starts
    initializeAuth();
  }, [initializeAuth]);

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
} 