'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/modules/core/components/ui/dialog';
import { Button } from '@/modules/core/components/ui/button';
import { Alert, AlertDescription } from '@/modules/core/components/ui/alert';
import { Badge } from '@/modules/core/components/ui/badge';

export interface AudioPermissionStatus {
  status: 'unknown' | 'granted' | 'denied' | 'prompt';
  hasAudio: boolean;
  error?: string;
}

interface AudioPermissionModalProps {
  isOpen: boolean;
  onPermissionGranted: () => void;
  onPermissionDenied: () => void;
}

export function AudioPermissionModal({
  isOpen,
  onPermissionGranted,
  onPermissionDenied,
}: AudioPermissionModalProps) {
  const [permissionStatus, setPermissionStatus] = useState<AudioPermissionStatus>({
    status: 'unknown',
    hasAudio: false,
  });
  const [isRequesting, setIsRequesting] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  // Check initial permission status
  useEffect(() => {
    if (isOpen) {
      checkPermissionStatus();
    }
  }, [isOpen]);

  const checkPermissionStatus = async () => {
    try {
      // Check if navigator.mediaDevices is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setPermissionStatus({
          status: 'denied',
          hasAudio: false,
          error: 'Media devices not supported by this browser',
        });
        return;
      }

      // Try to check permission status via Permissions API (if available)
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const permission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          console.log('🎤 Microphone permission status:', permission.state);
          
          if (permission.state === 'granted') {
            // Double-check by actually requesting audio
            await verifyAudioAccess();
          } else {
            setPermissionStatus({
              status: permission.state as any,
              hasAudio: false,
            });
          }
        } catch (err) {
          console.warn('⚠️ Permissions API not available, falling back to getUserMedia test');
          await verifyAudioAccess();
        }
      } else {
        // Fallback: Try to access audio directly
        await verifyAudioAccess();
      }
    } catch (error) {
      console.error('❌ Error checking permission status:', error);
      setPermissionStatus({
        status: 'denied',
        hasAudio: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const verifyAudioAccess = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Success - we have audio access
      stream.getTracks().forEach(track => track.stop());
      
      setPermissionStatus({
        status: 'granted',
        hasAudio: true,
      });
      
      // Auto-close modal and notify parent
      onPermissionGranted();
    } catch (error: any) {
      console.warn('⚠️ Audio access denied:', error);
      
      setPermissionStatus({
        status: 'denied',
        hasAudio: false,
        error: error.name === 'NotAllowedError' ? 'Permission denied' : error.message,
      });
    }
  };

  const requestPermission = async () => {
    setIsRequesting(true);
    
    try {
      console.log('🎤 Requesting microphone permission...');
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      // Stop the stream immediately after getting permission
      stream.getTracks().forEach(track => track.stop());
      
      // ALSO unlock AudioContext as part of permission grant
      await unlockAudioContext();
      
      setPermissionStatus({
        status: 'granted',
        hasAudio: true,
      });
      
      console.log('✅ Microphone permission granted and AudioContext unlocked');
      onPermissionGranted();
      
    } catch (error: any) {
      console.error('❌ Failed to get microphone permission:', error);
      
      setPermissionStatus({
        status: 'denied',
        hasAudio: false,
        error: error.name === 'NotAllowedError' ? 'Permission denied by user' : error.message,
      });
      
      if (error.name === 'NotAllowedError') {
        setShowInstructions(true);
      }
      
      onPermissionDenied();
    } finally {
      setIsRequesting(false);
    }
  };

  // Function to unlock AudioContext
  const unlockAudioContext = async () => {
    try {
      console.log('🎵 Unlocking AudioContext...');
      
      // Try to unlock all existing AudioContext instances
      if ((window as any).__audioContextInstances) {
        const promises = (window as any).__audioContextInstances.map((ctx: AudioContext) => {
          if (ctx.state === 'suspended') {
            console.log('🎵 Resuming suspended AudioContext');
            return ctx.resume();
          }
          return Promise.resolve();
        });
        
        await Promise.all(promises);
      }
      
      // Create and immediately unlock a test AudioContext to trigger the gesture unlock
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const testContext = new AudioContextClass();
        
        if (testContext.state === 'suspended') {
          console.log('🎵 Test AudioContext suspended, unlocking...');
          await testContext.resume();
          console.log('✅ Test AudioContext unlocked successfully');
        }
        
        // Clean up test context
        testContext.close();
      }
      
      console.log('✅ AudioContext unlock completed');
      
    } catch (error) {
      console.warn('⚠️ AudioContext unlock failed (but microphone still works):', error);
      // Don't fail the entire permission process for AudioContext issues
    }
  };

  const getStatusBadge = () => {
    switch (permissionStatus.status) {
      case 'granted':
        return <Badge className="bg-green-100 text-green-800">✅ Granted</Badge>;
      case 'denied':
        return <Badge className="bg-red-100 text-red-800">❌ Denied</Badge>;
      case 'prompt':
        return <Badge className="bg-yellow-100 text-yellow-800">⏳ Prompt Required</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">❓ Unknown</Badge>;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" aria-describedby="audio-permission-description">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            🎤 Audio Permission Required
            {getStatusBadge()}
          </DialogTitle>
        </DialogHeader>
        
        <div id="audio-permission-description" className="space-y-4">
          <p className="text-sm text-gray-600">
            This application requires microphone access to make and receive phone calls. 
            Please grant audio permissions to continue.
          </p>
          
          {permissionStatus.error && (
            <Alert className="border-red-200 bg-red-50">
              <AlertDescription className="text-red-800">
                <strong>Error:</strong> {permissionStatus.error}
              </AlertDescription>
            </Alert>
          )}
          
          {permissionStatus.status === 'granted' ? (
            <Alert className="border-green-200 bg-green-50">
              <AlertDescription className="text-green-800">
                ✅ Audio permission granted! The calling system is ready.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3">
              <Button
                onClick={requestPermission}
                disabled={isRequesting}
                className="w-full"
                size="lg"
              >
                {isRequesting ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span>
                    Requesting Permission...
                  </>
                ) : (
                  <>
                    🎤 Enable Call Audio
                  </>
                )}
              </Button>
              
              {showInstructions && (
                <Alert className="border-orange-200 bg-orange-50">
                  <AlertDescription className="text-orange-800 text-sm">
                    <strong>Permission Blocked?</strong> If you accidentally denied permission:
                    <ol className="list-decimal list-inside mt-2 space-y-1">
                      <li>Look for the 🔒 or 🎤 icon in your browser's address bar</li>
                      <li>Click it and select "Allow" for microphone access</li>
                      <li>Refresh the page and try again</li>
                    </ol>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
          
          <div className="text-xs text-gray-500 border-t pt-3">
            <p><strong>Why do we need this?</strong></p>
            <ul className="list-disc list-inside space-y-1 mt-1">
              <li>Make outbound calls to customers</li>
              <li>Receive inbound calls through the browser</li>
              <li>Ensure clear audio quality during conversations</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Hook to check audio permission status
export function useAudioPermission() {
  const [permissionStatus, setPermissionStatus] = useState<AudioPermissionStatus>({
    status: 'unknown',
    hasAudio: false,
  });

  const checkPermission = async (): Promise<AudioPermissionStatus> => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const status = {
          status: 'denied' as const,
          hasAudio: false,
          error: 'Media devices not supported',
        };
        setPermissionStatus(status);
        return status;
      }

      // Try to access audio to verify current permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      
      const status = {
        status: 'granted' as const,
        hasAudio: true,
      };
      setPermissionStatus(status);
      return status;
      
    } catch (error: any) {
      const status = {
        status: 'denied' as const,
        hasAudio: false,
        error: error.message,
      };
      setPermissionStatus(status);
      return status;
    }
  };

  return {
    permissionStatus,
    checkPermission,
  };
} 