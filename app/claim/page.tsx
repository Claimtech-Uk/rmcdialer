'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { RefreshCw, Shield, CheckCircle, AlertCircle } from 'lucide-react';

export default function ClaimPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'validating' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processing your secure link...');

  useEffect(() => {
    const handleMagicLink = async () => {
      // Get the token from URL parameters
      const token = searchParams.get('t');
      
      if (!token) {
        setStatus('error');
        setMessage('Invalid link - missing authentication token');
        return;
      }

      try {
        setStatus('validating');
        setMessage('Validating your secure link...');

        // Validate the magic link via API
        const response = await fetch('/api/validate-magic-link', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            token,
            userAgent: navigator.userAgent,
          }),
        });

        const result = await response.json();
        
        if (!response.ok) {
          throw new Error(result.error || 'Failed to validate link');
        }

        const validation = result.data;
        
        if (validation.isValid) {
          setStatus('success');
          setMessage('Link validated successfully! Redirecting you...');

          // Redirect based on link type
          let redirectUrl = '/dashboard'; // Default fallback
          
          switch (validation.linkType) {
            case 'firstLogin':
              redirectUrl = '/profile';
              break;
            case 'claimPortal':
              redirectUrl = `/users/${validation.userId}`;
              break;
            case 'documentUpload':
              redirectUrl = `/users/${validation.userId}?tab=documents`;
              break;
            case 'claimCompletion':
              redirectUrl = `/users/${validation.userId}?tab=requirements`;
              break;
            case 'requirementReview':
              redirectUrl = `/users/${validation.userId}?tab=requirements`;
              break;
            case 'statusUpdate':
              redirectUrl = `/users/${validation.userId}?tab=status`;
              break;
            case 'profileUpdate':
              redirectUrl = '/profile';
              break;
            default:
              redirectUrl = '/dashboard';
          }

          // Add claim ID if available
          const claimId = searchParams.get('c');
          if (claimId && redirectUrl.includes('/users/')) {
            redirectUrl += redirectUrl.includes('?') ? `&claim=${claimId}` : `?claim=${claimId}`;
          }

          // Redirect after a short delay for user feedback
          setTimeout(() => {
            window.location.href = redirectUrl;
          }, 1500);

        } else {
          setStatus('error');
          setMessage('This link has expired or is no longer valid. Please request a new link.');
        }

      } catch (error) {
        console.error('Magic link validation error:', error);
        setStatus('error');
        setMessage('Unable to validate your link. Please try again or request a new link.');
      }
    };

    handleMagicLink();
  }, [searchParams, router]);

  const getIcon = () => {
    switch (status) {
      case 'loading':
      case 'validating':
        return <RefreshCw className="h-12 w-12 animate-spin text-blue-600" />;
      case 'success':
        return <CheckCircle className="h-12 w-12 text-green-600" />;
      case 'error':
        return <AlertCircle className="h-12 w-12 text-red-600" />;
      default:
        return <Shield className="h-12 w-12 text-blue-600" />;
    }
  };

  const getBackgroundColor = () => {
    switch (status) {
      case 'success':
        return 'bg-gradient-to-br from-green-50 to-green-100';
      case 'error':
        return 'bg-gradient-to-br from-red-50 to-red-100';
      default:
        return 'bg-gradient-to-br from-blue-50 to-indigo-100';
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center ${getBackgroundColor()}`}>
      <div className="max-w-md w-full p-6">
        <div className="bg-white rounded-xl shadow-xl p-8 text-center">
          <div className="mb-6">
            {getIcon()}
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            {status === 'loading' && 'Secure Access'}
            {status === 'validating' && 'Validating Link'}
            {status === 'success' && 'Access Granted'}
            {status === 'error' && 'Access Denied'}
          </h1>
          
          <p className="text-gray-600 mb-6 leading-relaxed">
            {message}
          </p>

          {status === 'error' && (
            <div className="mt-6">
              <button
                onClick={() => window.location.href = '/login'}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Go to Login
              </button>
            </div>
          )}

          <div className="mt-6 text-xs text-gray-400">
            <div className="flex items-center justify-center gap-1">
              <Shield className="w-3 h-3" />
              <span>Secure access by RMC</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 