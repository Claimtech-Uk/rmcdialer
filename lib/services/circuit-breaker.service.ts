/**
 * Circuit Breaker Service
 * Prevents cascade failures by failing fast when database is struggling
 * Implements the Circuit Breaker pattern with automatic recovery
 */

export enum CircuitBreakerState {
  CLOSED = 'closed',     // Normal operation
  OPEN = 'open',         // Failing fast
  HALF_OPEN = 'half_open' // Testing recovery
}

interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringWindow: number;
  halfOpenMaxCalls: number;
}

interface CallRecord {
  timestamp: number;
  success: boolean;
  duration: number;
}

export class CircuitBreakerService {
  private state = CircuitBreakerState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;
  private halfOpenCalls = 0;
  private callHistory: CallRecord[] = [];

  private readonly config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      failureThreshold: 5, // Open circuit after 5 failures
      recoveryTimeout: 30000, // 30 seconds before trying half-open
      monitoringWindow: 60000, // 1 minute monitoring window
      halfOpenMaxCalls: 3, // Max calls to test in half-open state
      ...config
    };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(
    operation: () => Promise<T>,
    operationName: string = 'operation'
  ): Promise<T> {
    // Check if circuit is open
    if (this.state === CircuitBreakerState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.transitionToHalfOpen();
      } else {
        throw new CircuitBreakerOpenError(operationName, this.getTimeUntilRetry());
      }
    }

    // Check if we're in half-open and hit max calls
    if (this.state === CircuitBreakerState.HALF_OPEN && this.halfOpenCalls >= this.config.halfOpenMaxCalls) {
      throw new CircuitBreakerOpenError(operationName, this.getTimeUntilRetry());
    }

    // Execute the operation
    const startTime = Date.now();
    let success = false;
    
    try {
      if (this.state === CircuitBreakerState.HALF_OPEN) {
        this.halfOpenCalls++;
      }

      const result = await operation();
      success = true;
      
      this.onSuccess(Date.now() - startTime);
      return result;
      
    } catch (error) {
      this.onFailure(Date.now() - startTime);
      throw error;
    }
  }

  /**
   * Handle successful operation
   */
  private onSuccess(duration: number): void {
    this.addCallRecord(true, duration);
    
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      // If we're half-open and got a success, consider closing
      if (this.halfOpenCalls >= this.config.halfOpenMaxCalls) {
        this.transitionToClosed();
        console.log('🔄 Circuit breaker: Transitioned to CLOSED after successful half-open test');
      }
    } else if (this.state === CircuitBreakerState.CLOSED) {
      // Reset failure count on success
      this.failureCount = 0;
    }
  }

  /**
   * Handle failed operation
   */
  private onFailure(duration: number): void {
    this.addCallRecord(false, duration);
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      // Failed during half-open test, go back to open
      this.transitionToOpen();
      console.log('🚨 Circuit breaker: Failed during half-open test, returning to OPEN');
    } else if (this.state === CircuitBreakerState.CLOSED && this.failureCount >= this.config.failureThreshold) {
      // Too many failures, open the circuit
      this.transitionToOpen();
      console.log(`🚨 Circuit breaker: OPENED after ${this.failureCount} failures`);
    }
  }

  /**
   * Add call record and clean old ones
   */
  private addCallRecord(success: boolean, duration: number): void {
    const now = Date.now();
    this.callHistory.push({ timestamp: now, success, duration });
    
    // Remove old records outside monitoring window
    this.callHistory = this.callHistory.filter(
      record => now - record.timestamp < this.config.monitoringWindow
    );
  }

  /**
   * Check if we should attempt to reset from open to half-open
   */
  private shouldAttemptReset(): boolean {
    return Date.now() - this.lastFailureTime >= this.config.recoveryTimeout;
  }

  /**
   * Get time until next retry attempt
   */
  private getTimeUntilRetry(): number {
    if (this.state !== CircuitBreakerState.OPEN) return 0;
    return Math.max(0, this.config.recoveryTimeout - (Date.now() - this.lastFailureTime));
  }

  /**
   * State transitions
   */
  private transitionToOpen(): void {
    this.state = CircuitBreakerState.OPEN;
    this.halfOpenCalls = 0;
  }

  private transitionToHalfOpen(): void {
    this.state = CircuitBreakerState.HALF_OPEN;
    this.halfOpenCalls = 0;
    console.log('🔄 Circuit breaker: Transitioned to HALF_OPEN for testing');
  }

  private transitionToClosed(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.halfOpenCalls = 0;
  }

  /**
   * Get current statistics
   */
  getStats() {
    const recentCalls = this.callHistory.filter(
      record => Date.now() - record.timestamp < this.config.monitoringWindow
    );
    
    const successfulCalls = recentCalls.filter(r => r.success).length;
    const totalCalls = recentCalls.length;
    const successRate = totalCalls > 0 ? (successfulCalls / totalCalls) * 100 : 100;
    
    const avgDuration = totalCalls > 0 
      ? recentCalls.reduce((sum, r) => sum + r.duration, 0) / totalCalls 
      : 0;

    return {
      state: this.state,
      failureCount: this.failureCount,
      successRate: Math.round(successRate * 100) / 100,
      avgDuration: Math.round(avgDuration),
      totalCalls,
      successfulCalls,
      timeUntilRetry: this.getTimeUntilRetry(),
      config: this.config
    };
  }

  /**
   * Manual circuit breaker control (for admin/emergency use)
   */
  forceOpen(): void {
    this.transitionToOpen();
    console.log('🚨 Circuit breaker: Manually forced to OPEN');
  }

  forceClosed(): void {
    this.transitionToClosed();
    console.log('🔄 Circuit breaker: Manually forced to CLOSED');
  }

  reset(): void {
    this.transitionToClosed();
    this.callHistory = [];
    console.log('🔄 Circuit breaker: Reset to initial state');
  }
}

/**
 * Custom error for circuit breaker open state
 */
export class CircuitBreakerOpenError extends Error {
  constructor(operationName: string, retryInMs: number) {
    const retryInSeconds = Math.ceil(retryInMs / 1000);
    super(`Circuit breaker is OPEN for ${operationName}. Retry in ${retryInSeconds} seconds.`);
    this.name = 'CircuitBreakerOpenError';
  }
}

// Lazy-loaded global instances (build-safe)
let _databaseCircuitBreaker: CircuitBreakerService | null = null;
let _replicaDatabaseCircuitBreaker: CircuitBreakerService | null = null;

export function getDatabaseCircuitBreaker(): CircuitBreakerService {
  if (!_databaseCircuitBreaker) {
    _databaseCircuitBreaker = new CircuitBreakerService({
      failureThreshold: 5,
      recoveryTimeout: 30000, // 30 seconds
      monitoringWindow: 60000, // 1 minute
      halfOpenMaxCalls: 3
    });
  }
  return _databaseCircuitBreaker;
}

export function getReplicaDatabaseCircuitBreaker(): CircuitBreakerService {
  if (!_replicaDatabaseCircuitBreaker) {
    _replicaDatabaseCircuitBreaker = new CircuitBreakerService({
      failureThreshold: 8, // More lenient for replica
      recoveryTimeout: 20000, // 20 seconds
      monitoringWindow: 60000, // 1 minute
      halfOpenMaxCalls: 5
    });
  }
  return _replicaDatabaseCircuitBreaker;
}

// Backwards compatibility - lazy getters
export const databaseCircuitBreaker = {
  execute: (operation: string, fn: () => Promise<any>) => getDatabaseCircuitBreaker().execute(operation, fn),
  getStats: () => getDatabaseCircuitBreaker().getStats(),
  reset: () => getDatabaseCircuitBreaker().reset()
};

export const replicaDatabaseCircuitBreaker = {
  execute: (operation: string, fn: () => Promise<any>) => getReplicaDatabaseCircuitBreaker().execute(operation, fn),
  getStats: () => getReplicaDatabaseCircuitBreaker().getStats(),
  reset: () => getReplicaDatabaseCircuitBreaker().reset()
};
