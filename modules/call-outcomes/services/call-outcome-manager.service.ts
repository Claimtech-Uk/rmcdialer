import type { 
  CallOutcomeType, 
  CallOutcomeHandler, 
  CallOutcomeContext, 
  CallOutcomeResult,
  OutcomeProcessingOptions 
} from '../types/call-outcome.types';

// Main service to coordinate all call outcome processing
export class CallOutcomeManager {
  private handlers: Map<CallOutcomeType, CallOutcomeHandler> = new Map();
  
  constructor() {
    // TODO: Register all outcome handlers
  }
  
  registerHandler(handler: CallOutcomeHandler): void {
    this.handlers.set(handler.type, handler);
  }
  
  async processOutcome(
    outcomeType: CallOutcomeType,
    context: CallOutcomeContext,
    data?: any,
    options?: OutcomeProcessingOptions
  ): Promise<CallOutcomeResult> {
    // TODO: Implement outcome processing logic
    throw new Error('Not implemented yet');
  }
  
  getHandler(outcomeType: CallOutcomeType): CallOutcomeHandler | undefined {
    return this.handlers.get(outcomeType);
  }
  
  getAllHandlers(): CallOutcomeHandler[] {
    return Array.from(this.handlers.values());
  }
} 