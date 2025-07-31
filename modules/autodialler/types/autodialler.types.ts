import type { TeamType } from '@/lib/config/teams';
import type { UserCallContext, CallOutcomeOptions } from '@/modules/calls/types/call.types';

export type AutoDiallerState = 
  | 'ready'        // Ready to load next user
  | 'loading'      // Loading next user from queue
  | 'user_loaded'  // User loaded, waiting for agent to start call
  | 'calling'      // Call in progress
  | 'disposing'    // Call ended, waiting for disposition

  | 'paused'       // Autodialler paused
  | 'stopped';     // Autodialler stopped/ended

export interface AutoDiallerSettings {
  id?: string | null;
  agentId: number;
  team: string;
  timeBetweenCallsSeconds: number;
  autoStartEnabled: boolean;
  maxCallsPerSession: number;
  breakIntervalMinutes: number;
  audioNotificationsEnabled: boolean;
  keyboardShortcutsEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AutoDiallerSessionStats {
  callsCompleted: number;
  successfulContacts: number;
  startTime: Date;
  lastCallAt?: Date;
  sessionDuration: number; // in minutes
  averageCallDuration?: number; // in seconds
  completionRate: number; // percentage
}

export interface AutoDiallerSession {
  id: string;
  agentId: number;
  teamType: TeamType;
  queueType: string;
  startedAt: Date;
  endedAt?: Date;
  isActive: boolean;
  settings: AutoDiallerSettings;
  stats: AutoDiallerSessionStats;
}

export interface AutoDiallerQueueContext {
  queueType: string;
  totalUsers: number;
  remainingUsers: number;
  currentPosition?: number;
  estimatedTimeRemaining?: number; // in minutes
}

export interface AutoDiallerCallContext {
  userContext: UserCallContext;
  queueContext: AutoDiallerQueueContext;
  isAutoDialling: boolean;
  diallerState: AutoDiallerState;
}

export interface UseAutoDiallerOptions {
  teamType: TeamType;
  settings?: Partial<AutoDiallerSettings>;
  onStateChange?: (state: AutoDiallerState) => void;
  onUserLoaded?: (context: AutoDiallerCallContext) => void;
  onCallComplete?: (outcome: CallOutcomeOptions) => void;
  onSessionEnd?: (stats: AutoDiallerSessionStats) => void;
  onError?: (error: Error) => void;
}

export interface UseAutoDiallerReturn {
  // State
  state: AutoDiallerState;
  currentUser: UserCallContext | null;
  queueContext: AutoDiallerQueueContext | null;
  sessionStats: AutoDiallerSessionStats;
  isActive: boolean;
  
  // Actions
  startSession: () => Promise<void>;
  stopSession: () => Promise<void>;
  pauseSession: () => void;
  resumeSession: () => void;
  loadNextUser: () => Promise<void>;
  skipUser: () => Promise<void>;
  handleCallStart: () => void;
  handleCallComplete: (outcome: CallOutcomeOptions) => Promise<void>;
  
  // Settings
  settings: AutoDiallerSettings | null;
  updateSettings: (settings: Partial<AutoDiallerSettings>) => Promise<void>;
  
  // Loading states
  isLoading: boolean;
  isLoadingNextUser: boolean;
  error: Error | null;
} 