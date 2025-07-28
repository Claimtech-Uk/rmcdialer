import { getTeamConfig } from '@/lib/config/teams';
import type { TeamType } from '@/lib/config/teams';
import type { UserCallContext, CallOutcomeOptions } from '@/modules/calls/types/call.types';
import type { 
  AutoDiallerState, 
  AutoDiallerSettings, 
  AutoDiallerSessionStats,
  AutoDiallerQueueContext 
} from '../types';

export interface AutoDiallerServiceDependencies {
  logger: {
    info: (message: string, meta?: any) => void;
    error: (message: string, error?: any) => void;
    warn: (message: string, meta?: any) => void;
  };
}

export class AutoDiallerService {
  constructor(private deps: AutoDiallerServiceDependencies) {}

  /**
   * Calculate session statistics
   */
  calculateSessionStats(
    startTime: Date,
    callsCompleted: number,
    successfulContacts: number,
    lastCallAt?: Date
  ): AutoDiallerSessionStats {
    const now = new Date();
    const sessionDuration = Math.round((now.getTime() - startTime.getTime()) / (1000 * 60)); // minutes
    const completionRate = callsCompleted > 0 ? (successfulContacts / callsCompleted) * 100 : 0;

    return {
      callsCompleted,
      successfulContacts,
      startTime,
      lastCallAt,
      sessionDuration,
      completionRate: Math.round(completionRate * 100) / 100, // round to 2 decimal places
    };
  }

  /**
   * Determine if a call outcome counts as successful contact
   * Based on customer engagement regardless of score changes
   */
  isSuccessfulContact(outcomeType: string): boolean {
    const successfulOutcomes = [
      'completed_form',      // 0: Form completed - user will be removed if signature validates
      'going_to_complete',   // 0: User will complete - callback time set by agent
      'call_back',          // -15: User requested callback (unchanged)
      'might_complete',     // 0: Might complete - 5-day delay prevents over-calling
      'missed_call'         // 0: Customer called us - immediate callback scheduled
    ];
    return successfulOutcomes.includes(outcomeType);
  }

  /**
   * Calculate countdown time based on settings and previous call outcome
   */
  calculateCountdownTime(
    settings: AutoDiallerSettings,
    lastOutcome?: CallOutcomeOptions
  ): number {
    let baseTime = settings.timeBetweenCallsSeconds;

    // Adjust time based on last outcome
    if (lastOutcome) {
      switch (lastOutcome.outcomeType) {
        case 'completed_form':
          // Longest break after form completion (major success)
          baseTime = Math.max(baseTime, 90);
          break;
        case 'going_to_complete':
          // Long break for committed users
          baseTime = Math.max(baseTime, 60);
          break;
        case 'call_back':
          // Medium break for callbacks
          baseTime = Math.max(baseTime, 45);
          break;
        case 'missed_call':
          // Quick turnaround - customer tried to reach us!
          baseTime = Math.min(baseTime, 15);
          break;
        case 'no_answer':
        case 'hung_up':
          // Quick retry for non-answers
          baseTime = Math.min(baseTime, 25);
          break;
        case 'not_interested':
        case 'no_claim':
        case 'do_not_contact':
          // Longer break before moving to next (major negatives)
          baseTime = Math.max(baseTime, 45);
          break;
        default:
          // Use default time
          break;
      }
    }

    return baseTime;
  }

  /**
   * Check if session limits have been reached
   */
  checkSessionLimits(
    stats: AutoDiallerSessionStats,
    settings: AutoDiallerSettings
  ): { 
    shouldStop: boolean; 
    reason?: string; 
    timeUntilBreak?: number;
  } {
    // Check max calls per session
    if (stats.callsCompleted >= settings.maxCallsPerSession) {
      return {
        shouldStop: true,
        reason: `Maximum calls per session reached (${settings.maxCallsPerSession})`
      };
    }

    // Check if break interval has been reached
    const breakIntervalMs = settings.breakIntervalMinutes * 60 * 1000;
    const sessionDurationMs = stats.sessionDuration * 60 * 1000;
    
    if (sessionDurationMs >= breakIntervalMs) {
      return {
        shouldStop: true,
        reason: `Break interval reached (${settings.breakIntervalMinutes} minutes)`
      };
    }

    // Calculate time until next break
    const timeUntilBreak = Math.round((breakIntervalMs - sessionDurationMs) / (1000 * 60));

    return {
      shouldStop: false,
      timeUntilBreak: Math.max(0, timeUntilBreak)
    };
  }

  /**
   * Validate autodialler state transition
   */
  canTransitionTo(currentState: AutoDiallerState, newState: AutoDiallerState): boolean {
    const validTransitions: Record<AutoDiallerState, AutoDiallerState[]> = {
      ready: ['loading', 'paused', 'stopped'],
      loading: ['user_loaded', 'paused', 'stopped', 'ready'],
      user_loaded: ['calling', 'loading', 'paused', 'stopped'],
      calling: ['disposing', 'paused', 'stopped'],
      disposing: ['loading', 'paused', 'stopped'], // Direct to loading - no countdown needed
      paused: ['ready', 'loading', 'user_loaded', 'stopped'],
      stopped: ['ready'], // Can restart
    };

    return validTransitions[currentState]?.includes(newState) ?? false;
  }

  /**
   * Generate queue context from team configuration
   */
  generateQueueContext(
    teamType: TeamType,
    totalUsers: number,
    remainingUsers: number,
    avgCallDuration?: number
  ): AutoDiallerQueueContext {
    const config = getTeamConfig(teamType);
    
    // Estimate time remaining based on average call duration and remaining users
    let estimatedTimeRemaining: number | undefined;
    if (avgCallDuration && remainingUsers > 0) {
      // Factor in call duration + time between calls
      const avgTimeBetweenCalls = config.callSettings.defaultTimeBetweenCalls;
      const avgTimePerUser = avgCallDuration + avgTimeBetweenCalls;
      estimatedTimeRemaining = Math.round((remainingUsers * avgTimePerUser) / 60); // minutes
    }

    return {
      queueType: config.queueType,
      totalUsers,
      remainingUsers,
      currentPosition: totalUsers - remainingUsers + 1,
      estimatedTimeRemaining,
    };
  }

  /**
   * Log autodialler activity
   */
  logActivity(
    action: string,
    agentId: number,
    teamType: TeamType,
    meta?: any
  ): void {
    this.deps.logger.info(`AutoDialler: ${action}`, {
      agentId,
      teamType,
      timestamp: new Date().toISOString(),
      ...meta,
    });
  }

  /**
   * Log autodialler error
   */
  logError(
    error: string,
    agentId: number,
    teamType: TeamType,
    errorDetails?: any
  ): void {
    this.deps.logger.error(`AutoDialler Error: ${error}`, {
      agentId,
      teamType,
      timestamp: new Date().toISOString(),
      error: errorDetails,
    });
  }
} 