'use client';

import { useState } from 'react';
import { useGlobalCall } from '@/hooks/useGlobalCall';
import { Button } from '@/modules/core/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/modules/core/components/ui/card';
import { Badge } from '@/modules/core/components/ui/badge';
import { 
  Phone, 
  PhoneCall,
  User, 
  MapPin, 
  FileText, 
  Clock, 
  AlertCircle,
  CheckCircle,
  Calendar,
  Maximize2,
  X
} from 'lucide-react';
import { isFeatureEnabled } from '@/lib/config/features';
import type { UserCallContext } from '@/modules/calls/types/call.types';

interface CallPreviewPanelProps {
  userContext: UserCallContext | null;
  queueInfo?: {
    queueType: string;
    position: number;
    totalInQueue: number;
  };
  onClose?: () => void;
  mode?: 'compact' | 'full';
}

export function CallPreviewPanel({ 
  userContext, 
  queueInfo,
  onClose,
  mode = 'full' 
}: CallPreviewPanelProps) {
  const { initiateCall, isReady, isEnabled: globalCallEnabled } = useGlobalCall();
  const isEnabled = isFeatureEnabled('ENHANCED_QUEUE');
  const [isInitiatingCall, setIsInitiatingCall] = useState(false);

  // Don't render if feature is disabled or no user context
  if (!isEnabled || !userContext) return null;

  const formatPhoneNumber = (phone: string) => {
    if (phone.startsWith('+44')) {
      return phone.replace('+44', '0');
    }
    return phone;
  };

  const getDisplayName = () => {
    return `${userContext.firstName} ${userContext.lastName}`;
  };

  const getAddressDisplay = () => {
    if (!userContext.address) return 'No address available';
    const addr = userContext.address;
    return [addr.fullAddress, addr.county, addr.postCode]
      .filter(Boolean)
      .join(', ');
  };

  const getPriorityBadge = () => {
    // For now, use a simple priority based on number of claims
    const claimsCount = userContext.claims?.length || 0;
    if (claimsCount >= 3) {
      return <Badge className="bg-red-100 text-red-800">High Priority</Badge>;
    } else if (claimsCount >= 2) {
      return <Badge className="bg-yellow-100 text-yellow-800">Medium Priority</Badge>;
    } else {
      return <Badge className="bg-green-100 text-green-800">Standard</Badge>;
    }
  };

  const getClaimsSummary = () => {
    if (!userContext.claims || userContext.claims.length === 0) {
      return 'No active claims';
    }
    
    const activeCount = userContext.claims.filter(c => c.status === 'active').length;
    const totalCount = userContext.claims.length;
    
    return `${activeCount} active of ${totalCount} total claim${totalCount !== 1 ? 's' : ''}`;
  };

  const handleStartCall = async (callMode: 'popup' | 'page') => {
    setIsInitiatingCall(true);
    try {
      await initiateCall({
        userContext,
        queueInfo,
        source: 'queue',
        mode: callMode,
        onCallComplete: (outcome) => {
          console.log('📞 Call completed with outcome:', outcome);
          // TODO: Handle call completion (update queue, move to next user, etc.)
        }
      });
    } catch (error) {
      console.error('❌ Failed to start call:', error);
    } finally {
      setIsInitiatingCall(false);
    }
  };

  if (mode === 'compact') {
    return (
      <Card className="border-l-4 border-l-blue-500 bg-gradient-to-r from-blue-50 to-white">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">{getDisplayName()}</h3>
                <p className="text-sm text-slate-600 font-mono">
                  {formatPhoneNumber(userContext.phoneNumber)}
                </p>
              </div>
            </div>
            
            <div className="flex gap-2">
              {globalCallEnabled && isReady ? (
                <>
                  <Button
                    size="sm"
                    onClick={() => handleStartCall('popup')}
                    disabled={isInitiatingCall}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Phone className="w-4 h-4 mr-1" />
                    Quick Call
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleStartCall('page')}
                    disabled={isInitiatingCall}
                  >
                    <Maximize2 className="w-4 h-4" />
                  </Button>
                </>
              ) : (
                <Button size="sm" disabled>
                  <Phone className="w-4 h-4 mr-1" />
                  Call System Loading...
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-l-4 border-l-blue-500 bg-gradient-to-br from-blue-50 to-white shadow-lg">
      <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl">{getDisplayName()}</CardTitle>
              <p className="text-blue-100 font-mono text-lg">
                {formatPhoneNumber(userContext.phoneNumber)}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {getPriorityBadge()}
            {onClose && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onClose}
                className="text-white hover:bg-white/20 h-8 w-8 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Address Information */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <MapPin className="w-4 h-4 text-blue-600" />
            Address
          </div>
          <p className="text-slate-600 ml-6">{getAddressDisplay()}</p>
        </div>

        {/* Claims Information */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <FileText className="w-4 h-4 text-blue-600" />
            Claims Summary
          </div>
          <div className="ml-6 space-y-2">
            <p className="text-slate-600">{getClaimsSummary()}</p>
            {userContext.claims && userContext.claims.length > 0 && (
              <div className="space-y-1">
                {userContext.claims.slice(0, 2).map((claim, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    {claim.status === 'active' ? (
                      <CheckCircle className="w-3 h-3 text-green-500" />
                    ) : (
                      <AlertCircle className="w-3 h-3 text-yellow-500" />
                    )}
                    <span className="text-slate-600">
                      Claim #{claim.id} - {claim.status}
                    </span>
                  </div>
                ))}
                {userContext.claims.length > 2 && (
                  <p className="text-xs text-slate-500">
                    +{userContext.claims.length - 2} more claims
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Queue Information */}
        {queueInfo && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Clock className="w-4 h-4 text-blue-600" />
              Queue Status
            </div>
            <div className="ml-6 text-sm text-slate-600">
              Position {queueInfo.position} of {queueInfo.totalInQueue} in {queueInfo.queueType} queue
            </div>
          </div>
        )}

        {/* Call Action Buttons */}
        <div className="pt-4 border-t space-y-3">
          <h4 className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <PhoneCall className="w-4 h-4 text-blue-600" />
            Call Options
          </h4>
          
          <div className="grid grid-cols-2 gap-3">
            {globalCallEnabled && isReady ? (
              <>
                <Button
                  onClick={() => handleStartCall('popup')}
                  disabled={isInitiatingCall}
                  className="bg-green-600 hover:bg-green-700 h-12"
                >
                  <Phone className="w-4 h-4 mr-2" />
                  {isInitiatingCall ? 'Starting...' : 'Quick Call'}
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => handleStartCall('page')}
                  disabled={isInitiatingCall}
                  className="h-12"
                >
                  <Maximize2 className="w-4 h-4 mr-2" />
                  Full Call Page
                </Button>
              </>
            ) : (
              <div className="col-span-2">
                <Button disabled className="w-full h-12">
                  <Phone className="w-4 h-4 mr-2" />
                  Call System Loading...
                </Button>
              </div>
            )}
          </div>
          
          <div className="text-xs text-slate-500 text-center">
            {globalCallEnabled 
              ? "Choose quick call for popup or full page for detailed interface"
              : "Global calling system is initializing..."
            }
          </div>
        </div>

        {/* Additional User Information */}
        <div className="pt-4 border-t">
          <div className="text-xs text-slate-500 text-center">
            User ID: {userContext.userId} • Claims: {userContext.claims?.length || 0}
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 