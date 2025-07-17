import React, { useState, useEffect } from 'react';
import { Send, Link, History, TrendingUp, Smartphone, Mail, MessageSquare } from 'lucide-react';
import { apiClient } from '../lib/api-client';

export type MagicLinkType = 
  | 'firstLogin' 
  | 'claimPortal' 
  | 'documentUpload' 
  | 'claimCompletion'
  | 'requirementReview'
  | 'statusUpdate'
  | 'profileUpdate';

export type DeliveryMethod = 'sms' | 'whatsapp' | 'email';

interface MagicLinkPanelProps {
  userId: number;
  userName?: string;
  phoneNumber?: string;
  email?: string;
  claimId?: number;
  callSessionId?: string;
  onLinkSent?: (result: any) => void;
  className?: string;
}

interface LinkTypeOption {
  type: MagicLinkType;
  label: string;
  description: string;
  icon: React.ReactNode;
  urgent?: boolean;
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
];

const deliveryMethods = [
  { method: 'sms' as DeliveryMethod, label: 'SMS', icon: <Smartphone className="w-4 h-4" /> },
  { method: 'whatsapp' as DeliveryMethod, label: 'WhatsApp', icon: <MessageSquare className="w-4 h-4" /> },
  { method: 'email' as DeliveryMethod, label: 'Email', icon: <Mail className="w-4 h-4" /> }
];

export const MagicLinkPanel: React.FC<MagicLinkPanelProps> = ({
  userId,
  userName,
  phoneNumber,
  email,
  claimId,
  callSessionId,
  onLinkSent,
  className = ''
}) => {
  const [selectedLinkType, setSelectedLinkType] = useState<MagicLinkType>('claimPortal');
  const [selectedDeliveryMethod, setSelectedDeliveryMethod] = useState<DeliveryMethod>('sms');
  const [customMessage, setCustomMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Load recent magic link activity for this user
  useEffect(() => {
    if (userId && showHistory) {
      loadUserHistory();
    }
  }, [userId, showHistory]);

  const loadUserHistory = async () => {
    try {
      const response = await apiClient.get(`/magic-links/history/${userId}?limit=5`) as any;
      setRecentActivity(response.activities);
    } catch (error) {
      console.error('Failed to load magic link history:', error);
    }
  };

  const handleSendMagicLink = async () => {
    if (isLoading) return;

    // Validate delivery method requirements
    if (selectedDeliveryMethod === 'email' && !email) {
      alert('Email address is required for email delivery');
      return;
    }
    if ((selectedDeliveryMethod === 'sms' || selectedDeliveryMethod === 'whatsapp') && !phoneNumber) {
      alert('Phone number is required for SMS/WhatsApp delivery');
      return;
    }

    setIsLoading(true);

    try {
      const payload = {
        userId,
        linkType: selectedLinkType,
        deliveryMethod: selectedDeliveryMethod,
        phoneNumber: selectedDeliveryMethod !== 'email' ? phoneNumber : undefined,
        email: selectedDeliveryMethod === 'email' ? email : undefined,
        userName,
        customMessage: customMessage.trim() || undefined,
        claimId,
        callSessionId
      };

      const result = await apiClient.post('/magic-links/send', payload) as any;
      
      // Show success message
      alert(`Magic link sent successfully via ${selectedDeliveryMethod.toUpperCase()}!`);
      
      // Clear custom message
      setCustomMessage('');
      
      // Refresh history if visible
      if (showHistory) {
        loadUserHistory();
      }
      
      // Notify parent component
      onLinkSent?.(result);

    } catch (error: any) {
      console.error('Failed to send magic link:', error);
      alert(`Failed to send magic link: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedLinkTypeOption = linkTypeOptions.find(opt => opt.type === selectedLinkType);

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <Link className="w-5 h-5 text-blue-600" />
          Send Magic Link
        </h3>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
        >
          <History className="w-4 h-4" />
          {showHistory ? 'Hide' : 'Show'} History
        </button>
      </div>

      <div className="space-y-4">
        {/* Link Type Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Link Type
          </label>
          <div className="grid grid-cols-2 gap-2">
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
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Delivery Method
          </label>
          <div className="flex gap-2">
            {deliveryMethods.map((method) => (
              <button
                key={method.method}
                onClick={() => setSelectedDeliveryMethod(method.method)}
                disabled={method.method === 'email' && !email || 
                         (method.method === 'sms' || method.method === 'whatsapp') && !phoneNumber}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                  selectedDeliveryMethod === method.method
                    ? 'border-blue-500 bg-blue-50 text-blue-900'
                    : 'border-gray-200 hover:border-gray-300'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {method.icon}
                <span className="text-sm font-medium">{method.label}</span>
              </button>
            ))}
          </div>
          <div className="text-xs text-gray-600 mt-1">
            {selectedDeliveryMethod === 'email' ? `Email: ${email || 'Not available'}` : 
             `Phone: ${phoneNumber || 'Not available'}`}
          </div>
        </div>

        {/* Custom Message */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Custom Message (Optional)
          </label>
          <textarea
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            placeholder="Add a personal message with the link..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none text-sm"
            rows={2}
            maxLength={300}
          />
          <div className="text-xs text-gray-500 mt-1">
            {customMessage.length}/300 characters
          </div>
        </div>

        {/* Send Button */}
        <button
          onClick={handleSendMagicLink}
          disabled={isLoading || !selectedLinkType || !selectedDeliveryMethod}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Send {selectedDeliveryMethod.toUpperCase()} Link
            </>
          )}
        </button>

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
            {recentActivity.length > 0 ? (
              <div className="space-y-2">
                {recentActivity.map((activity, index) => (
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
                      <div className={`text-xs px-2 py-1 rounded ${
                        activity.accessedAt 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {activity.accessedAt ? 'Accessed' : 'Pending'}
                      </div>
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
      </div>
    </div>
  );
}; 