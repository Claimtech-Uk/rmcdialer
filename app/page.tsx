'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/trpc/client';
import { RefreshCw } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const { data: session, isLoading, error } = api.auth.me.useQuery();

  useEffect(() => {
    if (isLoading) return; // Wait for auth check

    if (error || !session?.agent) {
      // Not authenticated, middleware should handle redirect to /login
      // But as backup, redirect here too
      router.push('/login');
      return;
    }

    // Smart redirect based on role
    const { role } = session.agent;
    
    if (role === 'agent') {
      // Agents now have two queue options - redirect to unsigned queue by default
      // (Most urgent - signatures block claim progress)
      router.push('/queue/unsigned');
    } else if (role === 'supervisor' || role === 'admin') {
      // Supervisors and admins go to the analytics dashboard
      router.push('/dashboard');
    } else {
      // Fallback for unknown roles - go to unsigned queue
      router.push('/queue/unsigned');
    }
  }, [session, isLoading, error, router]);

  // Show loading state while determining redirect
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <RefreshCw className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">RMC Dialler</h1>
        <p className="text-gray-600">Redirecting to your workspace...</p>
      </div>
    </div>
  );
} 