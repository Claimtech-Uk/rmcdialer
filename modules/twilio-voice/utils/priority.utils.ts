/**
 * Calculate caller priority based on their context
 * Higher scores indicate higher priority callers
 */
export function calculateCallerPriority(claims: any[], requirements: any[], callHistory: any[]): number {
  let score = 50; // Base score
  
  // Active claims boost priority
  score += claims.length * 10;
  
  // Recent call activity boosts priority
  const recentCalls = callHistory.filter(call => 
    new Date(call.startedAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
  );
  
  // Recent missed calls boost priority significantly
  const recentMissedCalls = recentCalls.filter(call => call.status === 'missed_call');
  score += recentMissedCalls.length * 20;
  
  // Multiple recent calls indicate urgency
  if (recentCalls.length >= 3) {
    score += 15;
  }
  
  // Cap the score
  return Math.min(score, 100);
} 