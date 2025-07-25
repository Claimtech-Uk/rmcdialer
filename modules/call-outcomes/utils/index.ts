import type { 
  CallOutcomeType, 
  CallOutcomeHandler, 
  CallOutcomeValidation, 
  CallOutcomeContext 
} from '../types/call-outcome.types';

// Registry of outcome handlers
const outcomeHandlers = new Map<CallOutcomeType, CallOutcomeHandler>();

/**
 * Get the handler for a specific outcome type
 */
export function getOutcomeHandler(outcomeType: CallOutcomeType): CallOutcomeHandler | undefined {
  return outcomeHandlers.get(outcomeType);
}

/**
 * Register an outcome handler
 */
export function registerOutcomeHandler(handler: CallOutcomeHandler): void {
  outcomeHandlers.set(handler.type, handler);
}

/**
 * Get all registered outcome handlers
 */
export function getAllOutcomeHandlers(): CallOutcomeHandler[] {
  return Array.from(outcomeHandlers.values());
}

/**
 * Validate outcome data using the appropriate handler
 */
export async function validateOutcomeData(
  outcomeType: CallOutcomeType,
  context: CallOutcomeContext,
  data?: any
): Promise<CallOutcomeValidation> {
  const handler = getOutcomeHandler(outcomeType);
  
  if (!handler) {
    return {
      isValid: false,
      errors: [`No handler found for outcome type: ${outcomeType}`],
      warnings: [],
      requiredFields: []
    };
  }
  
  return handler.validate(context, data);
}

/**
 * Format outcome type for display
 */
export function formatOutcomeDisplay(outcomeType: CallOutcomeType): string {
  const handler = getOutcomeHandler(outcomeType);
  return handler?.displayName || outcomeType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Get outcome category color for UI
 */
export function getOutcomeCategoryColor(outcomeType: CallOutcomeType): string {
  const handler = getOutcomeHandler(outcomeType);
  
  switch (handler?.category) {
    case 'positive':
      return 'text-green-600 bg-green-50 border-green-200';
    case 'negative':
      return 'text-red-600 bg-red-50 border-red-200';
    case 'neutral':
      return 'text-blue-600 bg-blue-50 border-blue-200';
    case 'administrative':
      return 'text-gray-600 bg-gray-50 border-gray-200';
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200';
  }
}

/**
 * Sort outcomes by priority/category
 */
export function sortOutcomesByPriority(outcomes: CallOutcomeType[]): CallOutcomeType[] {
  const priorityOrder = ['positive', 'neutral', 'negative', 'administrative'];
  
  return outcomes.sort((a, b) => {
    const handlerA = getOutcomeHandler(a);
    const handlerB = getOutcomeHandler(b);
    
    const priorityA = handlerA ? priorityOrder.indexOf(handlerA.category) : 999;
    const priorityB = handlerB ? priorityOrder.indexOf(handlerB.category) : 999;
    
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    
    // Secondary sort by display name
    const nameA = handlerA?.displayName || a;
    const nameB = handlerB?.displayName || b;
    return nameA.localeCompare(nameB);
  });
} 