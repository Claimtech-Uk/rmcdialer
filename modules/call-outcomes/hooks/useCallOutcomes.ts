'use client';

import { useState, useCallback } from 'react';
import type { 
  CallOutcomeType, 
  CallOutcomeContext, 
  CallOutcomeResult,
  OutcomeProcessingOptions 
} from '../types/call-outcome.types';

export function useCallOutcomes() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<CallOutcomeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const processOutcome = useCallback(async (
    outcomeType: CallOutcomeType,
    context: CallOutcomeContext,
    data?: any,
    options?: OutcomeProcessingOptions
  ): Promise<CallOutcomeResult | null> => {
    setIsProcessing(true);
    setError(null);
    
    try {
      // TODO: Implement actual outcome processing
      const result: CallOutcomeResult = {
        success: true,
        outcomeType,
        nextActions: [],
        scoreAdjustment: 0
      };
      
      setLastResult(result);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clearLastResult = useCallback(() => {
    setLastResult(null);
  }, []);

  return {
    processOutcome,
    isProcessing,
    lastResult,
    error,
    clearError,
    clearLastResult
  };
} 