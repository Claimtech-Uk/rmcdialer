'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/trpc/client';
import { 
  Phone, 
  Mail, 
  Calendar, 
  MapPin, 
  Building, 
  User,
  X,
  Copy,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/modules/core/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/modules/core/components/ui/card';
import { Badge } from '@/modules/core/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/modules/core/components/ui/dialog';
import { useToast } from '@/modules/core/hooks/use-toast';

interface UserDetailsModalProps {
  userId: number | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function UserDetailsModal({ userId, isOpen, onClose }: UserDetailsModalProps) {
  const { toast } = useToast();
  
  // Fetch user details when modal opens
  const { 
    data: userResponse, 
    isLoading, 
    error 
  } = api.users.getCompleteUserDetails.useQuery(
    { userId: userId! },
    { 
      enabled: !!userId && isOpen,
      refetchOnWindowFocus: false
    }
  );

  const copyPhoneNumber = async (phoneNumber: string) => {
    try {
      await navigator.clipboard.writeText(phoneNumber);
      toast({
        title: "Phone number copied",
        description: `${phoneNumber} copied to clipboard`,
      });
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Unable to copy phone number to clipboard",
        variant: "destructive",
      });
    }
  };

  const startCall = () => {
    if (userId) {
      // Open call interface in new tab to keep queue open
      window.open(`/calls/${userId}`, '_blank');
    }
  };

  const openFullDetails = () => {
    if (userId) {
      // Open full user page in new tab
      window.open(`/users/${userId}`, '_blank');
    }
  };

  // Always render the dialog when isOpen is true, even if data is loading
  if (!isOpen) {
    return null;
  }

  // Extract user data
  const userDetails = userResponse?.data;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <User className="w-6 h-6" />
              {isLoading ? (
                <span>Loading user details...</span>
              ) : userDetails ? (
                <span>{userDetails.user.firstName} {userDetails.user.lastName}</span>
              ) : (
                <span>User Details</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={openFullDetails}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Full Details
              </Button>
            </div>
          </DialogTitle>
          <DialogDescription>
            View detailed user information, claims, and requirements for calling preparation.
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading user details...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="text-center py-8">
            <p className="text-red-600">Failed to load user details</p>
            <p className="text-sm text-gray-500 mt-2">{error.message}</p>
          </div>
        )}

        {userDetails && (
          <div className="space-y-6">
            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <User className="w-5 h-5" />
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Mail className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-medium">Email</span>
                    </div>
                    <p className="text-sm text-gray-700">{userDetails.user.email}</p>
                  </div>
                  
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Phone className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-medium">Phone</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono">{userDetails.user.phoneNumber}</span>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => copyPhoneNumber(userDetails.user.phoneNumber)}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>

                {userDetails.user.dateOfBirth && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-medium">Date of Birth</span>
                    </div>
                    <p className="text-sm text-gray-700">
                      {new Date(userDetails.user.dateOfBirth).toLocaleDateString()}
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Badge className={userDetails.user.isEnabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                    {userDetails.user.status || 'Unknown'}
                  </Badge>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button 
                    onClick={startCall}
                    className="bg-green-600 hover:bg-green-700 flex-1"
                  >
                    <Phone className="w-4 h-4 mr-2" />
                    Start Call
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={openFullDetails}
                    className="flex-1"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View Full Profile
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-blue-600">{userDetails.claims.length}</div>
                    <div className="text-xs text-gray-500">Claims</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-orange-600">
                      {userDetails.claims.reduce((acc, claim) => acc + claim.requirements.length, 0)}
                    </div>
                    <div className="text-xs text-gray-500">Requirements</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-purple-600">{userDetails.addresses.length}</div>
                    <div className="text-xs text-gray-500">Addresses</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Current Claims */}
            {userDetails.claims.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Active Claims</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {userDetails.claims.slice(0, 3).map((claim) => (
                      <div key={claim.id} className="border-b last:border-b-0 pb-3 last:pb-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm">{claim.type} Claim</span>
                          <Badge variant="outline" className="text-xs">
                            {claim.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-600">Lender: {claim.lender}</p>
                        {claim.requirements.length > 0 && (
                          <p className="text-xs text-orange-600 mt-1">
                            {claim.requirements.length} pending requirement(s)
                          </p>
                        )}
                      </div>
                    ))}
                    {userDetails.claims.length > 3 && (
                      <p className="text-xs text-gray-500 text-center pt-2">
                        +{userDetails.claims.length - 3} more claims
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
} 