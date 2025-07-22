'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/modules/core/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/modules/core/components/ui/card';
import { Volume2, VolumeX, X } from 'lucide-react';

export function AudioUnlockHelper() {
  const [showHelper, setShowHelper] = useState(false);
  const [isAudioBlocked, setIsAudioBlocked] = useState(false);

  useEffect(() => {
    // Check for AudioContext support and state
    const checkAudioState = () => {
      if (typeof window === 'undefined') return;
      
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      try {
        const testContext = new AudioContextClass();
        const blocked = testContext.state === 'suspended';
        setIsAudioBlocked(blocked);
        setShowHelper(blocked);
        testContext.close();
      } catch (error) {
        console.warn('Could not check audio state:', error);
      }
    };

    // Check initially
    checkAudioState();
    
    // Check periodically in case state changes
    const interval = setInterval(checkAudioState, 2000);
    
    // Listen for console errors that might indicate audio blocking
    const originalError = console.error;
    const originalWarn = console.warn;
    
    const audioErrorHandler = (...args: any[]) => {
      const message = args.join(' ');
      if (message.includes('AudioContext') && message.includes('user gesture')) {
        setIsAudioBlocked(true);
        setShowHelper(true);
      }
      originalError.apply(console, args);
    };
    
    const audioWarnHandler = (...args: any[]) => {
      const message = args.join(' ');
      if (message.includes('AudioContext') && message.includes('user gesture')) {
        setIsAudioBlocked(true);
        setShowHelper(true);
      }
      originalWarn.apply(console, args);
    };
    
    console.error = audioErrorHandler;
    console.warn = audioWarnHandler;

    return () => {
      clearInterval(interval);
      console.error = originalError;
      console.warn = originalWarn;
    };
  }, []);

  const unlockAudio = async () => {
    try {
      console.log('🎵 Manual audio unlock attempt...');
      
      // Try to unlock all AudioContext instances
      if ((window as any).__audioContextInstances) {
        const promises = (window as any).__audioContextInstances.map((ctx: AudioContext) => {
          if (ctx.state === 'suspended') {
            return ctx.resume();
          }
          return Promise.resolve();
        });
        
        await Promise.all(promises);
        console.log('✅ All AudioContext instances unlocked');
      }
      
      // Create a test context to trigger unlock
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const testContext = new AudioContextClass();
        if (testContext.state === 'suspended') {
          await testContext.resume();
        }
        testContext.close();
      }
      
      setIsAudioBlocked(false);
      setShowHelper(false);
      
    } catch (error) {
      console.warn('Failed to unlock audio:', error);
    }
  };

  if (!showHelper) return null;

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm">
      <Card className="border-orange-200 bg-orange-50">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-sm text-orange-800">
            <div className="flex items-center gap-2">
              <VolumeX className="h-4 w-4" />
              Audio Blocked
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHelper(false)}
              className="h-6 w-6 p-0 text-orange-600 hover:text-orange-800"
            >
              <X className="h-3 w-3" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-xs text-orange-700 mb-3">
            Your browser is blocking audio for incoming calls. Click below to enable call audio.
          </p>
          <Button
            onClick={unlockAudio}
            size="sm"
            className="w-full bg-orange-600 hover:bg-orange-700 text-white"
          >
            <Volume2 className="h-4 w-4 mr-2" />
            Enable Call Audio
          </Button>
        </CardContent>
      </Card>
    </div>
  );
} 