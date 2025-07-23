'use client';

import { useOptionalGlobalTwilio } from '@/lib/providers/GlobalTwilioProvider';
import { Button } from '@/modules/core/components/ui/button';
import { Badge } from '@/modules/core/components/ui/badge';
import { Card } from '@/modules/core/components/ui/card';

interface AudioPermissionIndicatorProps {
  variant?: 'compact' | 'expanded';
  className?: string;
}

export function AudioPermissionIndicator({ 
  variant = 'compact', 
  className = '' 
}: AudioPermissionIndicatorProps) {
  const twilioContext = useOptionalGlobalTwilio();
  
  // Don't show if Twilio is not enabled or not available
  if (!twilioContext || !twilioContext.isEnabled) {
    return null;
  }
  
  const { audioPermissionStatus, requestAudioPermission } = twilioContext;
  
  const getStatusIcon = () => {
    switch (audioPermissionStatus.status) {
      case 'granted':
        return '🎤';
      case 'denied':
        return '🔇';
      case 'prompt':
        return '❓';
      default:
        return '⏳';
    }
  };
  
  const getStatusText = () => {
    switch (audioPermissionStatus.status) {
      case 'granted':
        return 'Audio Ready';
      case 'denied':
        return 'Audio Blocked';
      case 'prompt':
        return 'Audio Needed';
      default:
        return 'Checking Audio';
    }
  };
  
  const getStatusColor = () => {
    switch (audioPermissionStatus.status) {
      case 'granted':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'denied':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'prompt':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };
  
  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Badge className={`${getStatusColor()} text-xs`}>
          {getStatusIcon()} {getStatusText()}
        </Badge>
        
        {audioPermissionStatus.status !== 'granted' && (
          <Button
            variant="outline"
            size="sm"
            onClick={requestAudioPermission}
            className="text-xs h-6 px-2"
          >
            Enable
          </Button>
        )}
      </div>
    );
  }
  
  return (
    <Card className={`p-3 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{getStatusIcon()}</span>
          <div>
            <div className="text-sm font-medium">{getStatusText()}</div>
            {audioPermissionStatus.error && (
              <div className="text-xs text-red-600 mt-1">
                {audioPermissionStatus.error}
              </div>
            )}
          </div>
        </div>
        
        {audioPermissionStatus.status !== 'granted' && (
          <Button
            variant="outline"
            size="sm"
            onClick={requestAudioPermission}
          >
            Enable Audio
          </Button>
        )}
      </div>
      
      {audioPermissionStatus.status === 'granted' && (
        <div className="mt-2 text-xs text-green-600">
          ✅ Call system ready for incoming and outgoing calls
        </div>
      )}
      
      {audioPermissionStatus.status === 'denied' && (
        <div className="mt-2 text-xs text-red-600">
          🚫 Please enable microphone access in your browser settings to use call features
        </div>
      )}
    </Card>
  );
} 