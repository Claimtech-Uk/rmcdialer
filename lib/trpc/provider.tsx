'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { loggerLink, unstable_httpBatchStreamLink } from '@trpc/client'
import { useState } from 'react'
import { api } from './client'
import superjson from 'superjson'

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutes
        retry: 2, // Maximum 2 retries
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 3000), // Exponential backoff
        refetchOnWindowFocus: false, // Don't refetch on window focus
        refetchOnMount: false, // Don't refetch on mount if cached
        // Global timeout for all queries - 8 seconds
        meta: {
          timeout: 8000
        }
      },
      mutations: {
        retry: 1, // Only retry mutations once
        retryDelay: 1000
      }
    },
  }))

  const [trpcClient] = useState(() =>
    api.createClient({
      transformer: superjson,
      links: [
        loggerLink({
          enabled: (op) =>
            process.env.NODE_ENV === 'development' ||
            (op.direction === 'down' && op.result instanceof Error),
        }),
        unstable_httpBatchStreamLink({
          url: '/api/trpc',
          headers() {
            const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null
            return token ? { authorization: `Bearer ${token}` } : {}
          },
          // Add comprehensive fetch configuration
          fetch(url, options) {
            // Create AbortController for timeout
            const controller = new AbortController();
            
            // Set timeout (8 seconds default)
            const timeout = 8000;
            const timeoutId = setTimeout(() => {
              console.warn(`🚨 tRPC request timeout after ${timeout}ms:`, url);
              controller.abort();
            }, timeout);

            // Enhanced fetch with timeout and error handling
            return fetch(url, {
              ...options,
              signal: controller.signal,
              // Add keepalive for better connection management
              keepalive: true,
            })
            .then((response) => {
              clearTimeout(timeoutId);
              
              // Handle authentication errors explicitly
              if (response.status === 401) {
                console.error('🚨 Authentication failed - invalid or expired token');
                // Clear invalid token
                if (typeof window !== 'undefined') {
                  localStorage.removeItem('auth-token');
                }
                throw new Error('Authentication failed. Please log in again.');
              }

              // Handle other HTTP errors
              if (!response.ok) {
                console.error(`🚨 HTTP Error ${response.status}:`, response.statusText);
                throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
              }

              return response;
            })
            .catch((error) => {
              clearTimeout(timeoutId);
              
              // Handle specific error types
              if (error.name === 'AbortError') {
                console.error(`🚨 Request aborted due to timeout (${timeout}ms):`, url);
                throw new Error(`Request timeout after ${timeout}ms. Please check your connection.`);
              }
              
              // Network errors
              if (error instanceof TypeError) {
                console.error('🚨 Network error:', error.message);
                throw new Error('Network error. Please check your connection and try again.');
              }

              // Re-throw other errors
              throw error;
            });
          },
        }),
      ],
    })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <api.Provider client={trpcClient} queryClient={queryClient}>
        {children}
      </api.Provider>
    </QueryClientProvider>
  )
} 