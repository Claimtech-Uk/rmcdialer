'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/modules/core/components/ui/card';
import { Button } from '@/modules/core/components/ui/button';
import { Phone, PhoneOff, ArrowRight } from 'lucide-react';

interface CallbackConfirmationDialogProps {
  isOpen: boolean;
  customerName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function CallbackConfirmationDialog({
  isOpen,
  customerName,
  onConfirm,
  onCancel
}: CallbackConfirmationDialogProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      onConfirm();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = () => {
    onCancel();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 backdrop-blur-sm flex items-center justify-center z-50">
      <Card className="w-[500px] max-w-[90vw] bg-slate-50 shadow-2xl border-0">
        <CardHeader className="bg-gradient-to-r from-orange-500 to-red-500 text-slate-900">
          <CardTitle className="flex items-center gap-3">
            <PhoneOff className="w-6 h-6" />
            Customer Hung Up
          </CardTitle>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* Customer Info */}
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {customerName} hung up during the call
            </h3>
            <p className="text-gray-600">
              Would you like to call this client back immediately?
            </p>
          </div>

          {/* Options Explanation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border rounded-lg p-4 bg-green-50 border-green-200">
              <div className="flex items-center gap-2 text-green-800 font-semibold mb-2">
                <Phone className="w-5 h-5" />
                Call Back
              </div>
              <p className="text-green-700 text-sm">
                Stay with this customer and make another call attempt
              </p>
            </div>
            
            <div className="border rounded-lg p-4 bg-blue-50 border-blue-200">
              <div className="flex items-center gap-2 text-blue-800 font-semibold mb-2">
                <ArrowRight className="w-5 h-5" />
                Next Customer
              </div>
              <p className="text-blue-700 text-sm">
                Record the outcome and move to the next customer in queue
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-center gap-4 pt-4">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isProcessing}
              className="flex items-center gap-2 min-w-[140px]"
            >
              <ArrowRight className="w-4 h-4" />
              Next Customer
            </Button>
            
            <Button
              onClick={handleConfirm}
              disabled={isProcessing}
              className="bg-green-600 hover:bg-green-700 flex items-center gap-2 min-w-[140px]"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Setting up...
                </>
              ) : (
                <>
                  <Phone className="w-4 h-4" />
                  Call Back
                </>
              )}
            </Button>
          </div>

          {/* Quick tip */}
          <div className="text-center text-sm text-gray-500">
            💡 Tip: Sometimes customers hang up accidentally or due to poor signal
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 