'use client';

import { useState, useEffect } from 'react';
import { TeamConfig } from '@/lib/config/teams';
import { SkipForward, Play, Pause } from 'lucide-react';

interface CountdownTimerProps {
  seconds: number;
  teamConfig: TeamConfig;
  onComplete: () => void;
  onSkip: () => void;
  onPause?: () => void;
  onResume?: () => void;
  isPaused?: boolean;
  showPauseButton?: boolean;
  title?: string;
  subtitle?: string;
}

export function CountdownTimer({
  seconds: initialSeconds,
  teamConfig,
  onComplete,
  onSkip,
  onPause,
  onResume,
  isPaused = false,
  showPauseButton = false,
  title = "Next Call In",
  subtitle = "seconds until next call"
}: CountdownTimerProps) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(!isPaused);

  // Reset timer when initialSeconds changes
  useEffect(() => {
    setSeconds(initialSeconds);
    setIsRunning(!isPaused);
  }, [initialSeconds, isPaused]);

  // Timer effect
  useEffect(() => {
    if (!isRunning || seconds <= 0) return;

    const timer = setInterval(() => {
      setSeconds(prev => {
        if (prev <= 1) {
          setIsRunning(false);
          onComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isRunning, seconds, onComplete]);

  const handlePause = () => {
    setIsRunning(false);
    onPause?.();
  };

  const handleResume = () => {
    setIsRunning(true);
    onResume?.();
  };

  const handleSkip = () => {
    setSeconds(0);
    setIsRunning(false);
    onSkip();
  };

  // Calculate progress percentage
  const progress = initialSeconds > 0 ? ((initialSeconds - seconds) / initialSeconds) * 100 : 100;

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white rounded-xl shadow-lg p-8 text-center">
        {/* Team Icon */}
        <div className={`w-16 h-16 mx-auto mb-4 ${teamConfig.color.gradient} rounded-full flex items-center justify-center shadow-lg`}>
          <span className="text-2xl">{teamConfig.icon}</span>
        </div>

        {/* Title */}
        <h3 className="text-xl font-semibold text-slate-800 mb-2">{title}</h3>

        {/* Countdown Display */}
        <div className="relative mb-6">
          {/* Progress Ring */}
          <div className="relative w-32 h-32 mx-auto">
            <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 36 36">
              {/* Background circle */}
              <path
                className="text-slate-200"
                stroke="currentColor"
                strokeWidth="2"
                fill="transparent"
                d="M18 2.0845
                   a 15.9155 15.9155 0 0 1 0 31.831
                   a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              {/* Progress circle */}
              <path
                className={`transition-all duration-1000 ease-linear`}
                stroke={teamConfig.color.primary === 'orange-600' ? '#ea580c' : '#2563eb'}
                strokeWidth="2"
                strokeLinecap="round"
                fill="transparent"
                strokeDasharray={`${progress}, 100`}
                d="M18 2.0845
                   a 15.9155 15.9155 0 0 1 0 31.831
                   a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            
            {/* Timer Number */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-4xl font-bold text-slate-800 mb-1">{seconds}</div>
                <div className="text-xs text-slate-500">seconds</div>
              </div>
            </div>
          </div>
        </div>

        {/* Subtitle */}
        <p className="text-slate-600 mb-6">{subtitle}</p>

        {/* Control Buttons */}
        <div className="flex items-center justify-center gap-3">
          {/* Pause/Resume Button */}
          {showPauseButton && (
            <button
              onClick={isRunning ? handlePause : handleResume}
              className="px-4 py-2 rounded-lg font-medium transition-colors bg-slate-100 hover:bg-slate-200 text-slate-700"
            >
              {isRunning ? (
                <>
                  <Pause className="w-4 h-4 mr-2 inline" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2 inline" />
                  Resume
                </>
              )}
            </button>
          )}

          {/* Skip Button */}
          <button
            onClick={handleSkip}
            className={`px-6 py-3 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 ${teamConfig.color.gradient} text-white shadow-lg hover:shadow-xl`}
          >
            <SkipForward className="w-4 h-4 mr-2 inline" />
            Skip Wait
          </button>
        </div>

        {/* Status Indicator */}
        <div className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-500">
          <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-green-500' : 'bg-yellow-500'} ${isRunning ? 'animate-pulse' : ''}`}></div>
          <span>{isRunning ? 'Timer Running' : 'Timer Paused'}</span>
        </div>

        {/* Team Context */}
        <div className="mt-4 pt-4 border-t border-slate-200">
          <div className="text-xs text-slate-500">
            {teamConfig.displayName}
          </div>
        </div>
      </div>
    </div>
  );
} 