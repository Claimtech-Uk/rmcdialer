'use client'

import React, { useState } from 'react'
import { Send, Link, History, TrendingUp, Smartphone, Mail, MessageSquare, AlertCircle } from 'lucide-react'
import { Button } from '@/modules/core/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/modules/core/components/ui/card'
import { Label } from '@/modules/core/components/ui/label'
import { Badge } from '@/modules/core/components/ui/badge'
import { Alert, AlertDescription } from '@/modules/core/components/ui/alert'
import { api } from '@/lib/trpc/client'
import type { MagicLinkType, DeliveryMethod } from '../types/communications.types'

interface MagicLinkPanelProps {
  userId: number
  firstName?: string
  phoneNumber?: string
  email?: string
  claimId?: number
  callSessionId?: string
  onLinkSent?: (result: any) => void
  className?: string
}

interface LinkTypeOption {
  type: MagicLinkType
  label: string
  description: string
  icon: React.ReactNode
  urgent?: boolean
}

const linkTypeOptions: LinkTypeOption[] = [
  {
    type: 'claimPortal',
    label: 'Claim Portal Access',
    description: 'Main claim dashboard and overview',
    icon: <Link className="w-4 h-4" />
  },
  {
    type: 'documentUpload',
    label: 'Document Upload',
    description: 'Upload required documents',
    icon: <Send className="w-4 h-4" />,
    urgent: true
  },
  {
    type: 'claimCompletion',
    label: 'Complete Claim',
    description: 'Finish incomplete claim steps',
    icon: <TrendingUp className="w-4 h-4" />,
    urgent: true
  },
  {
    type: 'requirementReview',
    label: 'Review Requirements',
    description: 'Check what documents are needed',
    icon: <History className="w-4 h-4" />
  },
  {
    type: 'statusUpdate',
    label: 'Status Update',
    description: 'View current claim status',
    icon: <TrendingUp className="w-4 h-4" />
  },
  {
    type: 'firstLogin',
    label: 'First Login Setup',
    description: 'Initial account access',
    icon: <Link className="w-4 h-4" />
  },
  {
    type: 'profileUpdate',
    label: 'Update Profile',
    description: 'Update personal information',
    icon: <Send className="w-4 h-4" />
  }
]

const deliveryMethods = [
  { method: 'sms' as DeliveryMethod, label: 'SMS', icon: <Smartphone className="w-4 h-4" /> },
  { method: 'whatsapp' as DeliveryMethod, label: 'WhatsApp', icon: <MessageSquare className="w-4 h-4" /> },
  { method: 'email' as DeliveryMethod, label: 'Email', icon: <Mail className="w-4 h-4" /> }
]

export function MagicLinkPanel({
  userId,
  firstName,
  phoneNumber,
  email,
  claimId,
  callSessionId,
  onLinkSent,
  className = ''
}: MagicLinkPanelProps) {
  const [selectedLinkType, setSelectedLinkType] = useState<MagicLinkType>('claimPortal')
  const [selectedDeliveryMethod, setSelectedDeliveryMethod] = useState<DeliveryMethod>('sms')
  const [customMessage, setCustomMessage] = useState('')
  const [showHistory, setShowHistory] = useState(false)

  // Load recent magic link activity for this user
  const { data: recentActivity, refetch: refetchHistory } = api.communications.magicLinks.getUserHistory.useQuery(
    { userId, limit: 5 },
    { enabled: showHistory }
  )

  const sendMagicLinkMutation = api.communications.magicLinks.send.useMutation({
    onSuccess: (result) => {
      // Clear custom message
      setCustomMessage('')
      
      // Refresh history if visible
      if (showHistory) {
        refetchHistory()
      }
      
      // Notify parent component
      onLinkSent?.(result)
    }
  })

  const handleSendMagicLink = async () => {
    // Validate delivery method requirements
    if (selectedDeliveryMethod === 'email' && !email) {
      alert('Email address is required for email delivery')
      return
    }
    if ((selectedDeliveryMethod === 'sms' || selectedDeliveryMethod === 'whatsapp') && !phoneNumber) {
      alert('Phone number is required for SMS/WhatsApp delivery')
      return
    }

    sendMagicLinkMutation.mutate({
      userId,
      linkType: selectedLinkType,
      deliveryMethod: selectedDeliveryMethod,
      phoneNumber: selectedDeliveryMethod !== 'email' ? phoneNumber : undefined,
      email: selectedDeliveryMethod === 'email' ? email : undefined,
      firstName,
      customMessage: customMessage.trim() || undefined,
      claimId,
      callSessionId
    })
  }

  const selectedLinkTypeOption = linkTypeOptions.find(opt => opt.type === selectedLinkType)

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Link className="w-5 h-5 text-blue-600" />
            Send Magic Link
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
            className="text-sm"
          >
            <History className="w-4 h-4 mr-1" />
            {showHistory ? 'Hide' : 'Show'} History
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Error Alert */}
        {sendMagicLinkMutation.error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {sendMagicLinkMutation.error.message || 'Failed to send magic link'}
            </AlertDescription>
          </Alert>
        )}

        {/* Success Alert */}
        {sendMagicLinkMutation.isSuccess && (
          <Alert>
            <AlertDescription>
              Magic link sent successfully via {selectedDeliveryMethod.toUpperCase()}!
            </AlertDescription>
          </Alert>
        )}

        {/* Link Type Selection */}
        <div>
          <Label className="text-base font-medium">Link Type</Label>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {linkTypeOptions.map((option) => (
              <button
                key={option.type}
                onClick={() => setSelectedLinkType(option.type)}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  selectedLinkType === option.type
                    ? 'border-blue-500 bg-blue-50 text-blue-900'
                    : 'border-gray-200 hover:border-gray-300'
                } ${option.urgent ? 'ring-2 ring-orange-200' : ''}`}
              >
                <div className="flex items-start gap-2">
                  {option.icon}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">
                      {option.label}
                      {option.urgent && <span className="text-orange-600 ml-1">*</span>}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {option.description}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Delivery Method Selection */}
        <div>
          <Label className="text-base font-medium">Delivery Method</Label>
          <div className="flex gap-2 mt-2">
            {deliveryMethods.map((method) => (
              <Button
                key={method.method}
                variant={selectedDeliveryMethod === method.method ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedDeliveryMethod(method.method)}
                disabled={method.method === 'email' && !email || 
                         (method.method === 'sms' || method.method === 'whatsapp') && !phoneNumber}
                className="flex items-center gap-2"
              >
                {method.icon}
                {method.label}
              </Button>
            ))}
          </div>
          <div className="text-xs text-gray-600 mt-1">
            {selectedDeliveryMethod === 'email' ? `Email: ${email || 'Not available'}` : 
             `Phone: ${phoneNumber || 'Not available'}`}
          </div>
        </div>

        {/* Custom Message */}
        <div>
          <Label htmlFor="customMessage" className="text-base font-medium">
            Custom Message (Optional)
          </Label>
          <textarea
            id="customMessage"
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            placeholder="Add a personal message with the link..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none text-sm mt-2"
            rows={2}
            maxLength={300}
          />
          <div className="text-xs text-gray-500 mt-1">
            {customMessage.length}/300 characters
          </div>
        </div>

        {/* Send Button */}
        <Button
          onClick={handleSendMagicLink}
          disabled={sendMagicLinkMutation.isPending || !selectedLinkType || !selectedDeliveryMethod}
          className="w-full"
        >
          {sendMagicLinkMutation.isPending ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              Sending...
            </>
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              Send {selectedDeliveryMethod.toUpperCase()} Link
            </>
          )}
        </Button>

        {/* Link Preview */}
        {selectedLinkTypeOption && (
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-sm text-gray-700">
              <strong>Sending:</strong> {selectedLinkTypeOption.label}
            </div>
            <div className="text-xs text-gray-600 mt-1">
              {selectedLinkTypeOption.description}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Target: claim.resolvemyclaim.co.uk
            </div>
          </div>
        )}

        {/* Recent Activity */}
        {showHistory && (
          <div className="border-t pt-4">
            <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
              <History className="w-4 h-4" />
              Recent Magic Links
            </h4>
            {recentActivity && recentActivity.data && recentActivity.data.length > 0 ? (
              <div className="space-y-2">
                {recentActivity.data.map((activity: any, index: number) => (
                  <div key={index} className="bg-gray-50 rounded-lg p-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {linkTypeOptions.find(opt => opt.type === activity.linkType)?.label || activity.linkType}
                        </div>
                        <div className="text-xs text-gray-600">
                          Sent via {activity.sentVia} • {new Date(activity.sentAt).toLocaleString()}
                        </div>
                      </div>
                      <Badge variant={activity.accessedAt ? "default" : "secondary"}>
                        {activity.accessedAt ? 'Accessed' : 'Pending'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-600 py-2">
                No recent magic links for this user
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
} 