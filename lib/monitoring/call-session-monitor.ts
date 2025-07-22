import { callSessionValidation } from '@/lib/validation/call-session';

interface InvalidSessionAttempt {
  sessionId: string;
  timestamp: Date;
  source: string;
  userAgent?: string;
  userId?: number;
  agentId?: number;
  error: string;
}

interface MonitoringStats {
  totalInvalidAttempts: number;
  legacyFormatAttempts: number;
  otherInvalidAttempts: number;
  lastAttempt?: Date;
  topSources: Record<string, number>;
}

class CallSessionMonitor {
  private invalidAttempts: InvalidSessionAttempt[] = [];
  private readonly maxStoredAttempts = 1000;

  /**
   * Record an invalid session ID attempt
   */
  recordInvalidAttempt(attempt: Omit<InvalidSessionAttempt, 'timestamp'>): void {
    const fullAttempt: InvalidSessionAttempt = {
      ...attempt,
      timestamp: new Date()
    };

    this.invalidAttempts.push(fullAttempt);

    // Keep only the most recent attempts
    if (this.invalidAttempts.length > this.maxStoredAttempts) {
      this.invalidAttempts = this.invalidAttempts.slice(-this.maxStoredAttempts);
    }

    // Log the attempt
    console.warn('🚨 [CALL MONITOR] Invalid session ID attempt:', {
      sessionId: attempt.sessionId,
      source: attempt.source,
      isLegacyFormat: callSessionValidation.detectLegacyFormat(attempt.sessionId),
      userId: attempt.userId,
      agentId: attempt.agentId,
      error: attempt.error
    });

    // Check if we should alert (e.g., too many recent attempts)
    this.checkForAlerts();
  }

  /**
   * Check if we should trigger alerts based on recent activity
   */
  private checkForAlerts(): void {
    const recentAttempts = this.getRecentAttempts(5); // Last 5 minutes
    
    if (recentAttempts.length >= 10) {
      console.error('🚨 [ALERT] High volume of invalid session ID attempts:', {
        count: recentAttempts.length,
        timeframe: '5 minutes',
        sources: this.getTopSources(recentAttempts)
      });
    }

    // Alert on legacy format usage
    const legacyAttempts = recentAttempts.filter(a => 
      callSessionValidation.detectLegacyFormat(a.sessionId)
    );

    if (legacyAttempts.length > 0) {
      console.error('🚨 [ALERT] Legacy call session ID format still being used:', {
        count: legacyAttempts.length,
        examples: legacyAttempts.slice(0, 3).map(a => ({
          sessionId: a.sessionId,
          source: a.source,
          userId: a.userId
        }))
      });
    }
  }

  /**
   * Get attempts from the last N minutes
   */
  private getRecentAttempts(minutes: number): InvalidSessionAttempt[] {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    return this.invalidAttempts.filter(attempt => attempt.timestamp >= cutoff);
  }

  /**
   * Get top sources of invalid attempts
   */
  private getTopSources(attempts: InvalidSessionAttempt[]): Record<string, number> {
    return attempts.reduce((acc, attempt) => {
      acc[attempt.source] = (acc[attempt.source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  /**
   * Get monitoring statistics
   */
  getStats(): MonitoringStats {
    const legacyFormatAttempts = this.invalidAttempts.filter(a => 
      callSessionValidation.detectLegacyFormat(a.sessionId)
    ).length;

    return {
      totalInvalidAttempts: this.invalidAttempts.length,
      legacyFormatAttempts,
      otherInvalidAttempts: this.invalidAttempts.length - legacyFormatAttempts,
      lastAttempt: this.invalidAttempts.length > 0 
        ? this.invalidAttempts[this.invalidAttempts.length - 1].timestamp 
        : undefined,
      topSources: this.getTopSources(this.invalidAttempts)
    };
  }

  /**
   * Get recent invalid attempts for debugging
   */
  getRecentInvalidAttempts(count: number = 10): InvalidSessionAttempt[] {
    return this.invalidAttempts.slice(-count).reverse();
  }

  /**
   * Clear old attempts (useful for cleanup)
   */
  clearOldAttempts(olderThanDays: number = 7): number {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    const initialCount = this.invalidAttempts.length;
    this.invalidAttempts = this.invalidAttempts.filter(attempt => attempt.timestamp >= cutoff);
    return initialCount - this.invalidAttempts.length;
  }
}

// Create singleton monitor instance
export const callSessionMonitor = new CallSessionMonitor();

/**
 * Convenience function to record invalid session attempts
 */
export function recordInvalidSessionAttempt(
  sessionId: string,
  source: string,
  error: string,
  context?: {
    userAgent?: string;
    userId?: number;
    agentId?: number;
  }
): void {
  callSessionMonitor.recordInvalidAttempt({
    sessionId,
    source,
    error,
    ...context
  });
}

/**
 * Enhanced validation that includes monitoring
 */
export function validateAndMonitorSessionId(
  sessionId: string,
  source: string,
  context?: {
    userAgent?: string;
    userId?: number;
    agentId?: number;
  }
): string {
  try {
    return callSessionValidation.validateWithContext(sessionId, source);
  } catch (error: any) {
    // Record the invalid attempt
    recordInvalidSessionAttempt(sessionId, source, error.message, context);
    
    // Re-throw the error
    throw error;
  }
}

// Export for external use
export type { InvalidSessionAttempt, MonitoringStats }; 