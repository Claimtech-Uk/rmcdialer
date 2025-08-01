// Analytics Module Types
// Performance analytics, call efficiency, and operational metrics

// Agent Performance Analytics
export interface AgentEfficiencyMetrics {
  agentId: number;
  date: Date;
  callMetrics: {
    totalCalls: number;
    totalCallTime: number; // seconds
    totalTalkTime: number; // seconds
    avgCallDuration: number; // seconds
    avgTalkTime: number; // seconds
  };
  gapMetrics: {
    totalGapTime: number; // seconds between calls
    avgGapTime: number; // average seconds between calls
    gapCount: number; // number of gaps (calls - 1)
    minGapTime: number;
    maxGapTime: number;
    medianGapTime: number;
  };
  efficiency: {
    callsPerHour: number;
    talkTimePercentage: number; // talk time / total logged time
    productivityScore: number; // calculated efficiency score
    gapTimePercentage: number; // gap time / total work time
  };
  timeDistribution: {
    loginTime: Date;
    logoutTime: Date | null;
    totalLoggedTime: number; // seconds
    totalWorkTime: number; // talk time + gap time
    utilization: number; // work time / logged time percentage
  };
}

export interface CallGapAnalysis {
  agentId: number;
  callSessionId: string;
  callEndedAt: Date;
  nextCallStartedAt: Date | null;
  gapDuration: number; // seconds
  gapType: 'normal' | 'extended' | 'break' | 'end_of_day';
  hourOfDay: number;
  dayOfWeek: number;
}

export interface AgentProductivityComparison {
  agentId: number;
  agentName: string;
  rank: number;
  metrics: {
    avgGapTime: number;
    callsPerHour: number;
    talkTimeRatio: number;
    productivityScore: number;
  };
  percentileRanks: {
    gapTime: number; // lower is better
    callVolume: number; // higher is better
    efficiency: number; // higher is better
  };
}

// Team and Operational Analytics
export interface TeamEfficiencyReport {
  date: Date;
  teamMetrics: {
    totalAgents: number;
    activeAgents: number;
    totalCalls: number;
    totalTalkTime: number;
    avgGapTime: number;
    teamProductivityScore: number;
  };
  agentRankings: AgentProductivityComparison[];
  trends: {
    gapTimeChange: number; // percentage change from previous period
    productivityChange: number;
    volumeChange: number;
  };
  insights: string[]; // Generated insights about performance
}

export interface CallPatternAnalysis {
  hourlyDistribution: { hour: number; callCount: number; avgGapTime: number }[];
  dailyTrends: { date: Date; totalCalls: number; avgGapTime: number }[];
  peakEfficiencyHours: { hour: number; efficiency: number }[];
  bottleneckPeriods: { period: string; avgGapTime: number; reason: string }[];
}

// Query and Filter Types
export interface AnalyticsDateRange {
  startDate: Date;
  endDate: Date;
}

export interface AgentAnalyticsFilters extends AnalyticsDateRange {
  agentIds?: number[];
  teamFilter?: string;
  includeBreaks?: boolean;
  minCallsThreshold?: number;
}

export interface EfficiencyBenchmarks {
  excellent: { maxGapTime: number; minCallsPerHour: number };
  good: { maxGapTime: number; minCallsPerHour: number };
  average: { maxGapTime: number; minCallsPerHour: number };
  needsImprovement: { maxGapTime: number; minCallsPerHour: number };
}

// Dashboard and Reporting Types
export interface AnalyticsDashboardData {
  summary: TeamEfficiencyReport;
  topPerformers: AgentProductivityComparison[];
  callPatterns: CallPatternAnalysis;
  alerts: PerformanceAlert[];
  recommendations: string[];
}

export interface PerformanceAlert {
  id: string;
  type: 'efficiency_drop' | 'extended_gaps' | 'low_volume' | 'system_issue';
  agentId?: number;
  severity: 'low' | 'medium' | 'high';
  message: string;
  detectedAt: Date;
  metrics: Record<string, number>;
}

// Real-time Analytics
export interface LiveAgentMetrics {
  agentId: number;
  agentName: string; // Added: Real agent name
  currentStatus: string;
  todayStats: {
    callsToday: number;
    talkTimeToday: number;
    avgGapTimeToday: number;
    conversionsToday: number; // Added: Number of conversions today
    contactRateToday: number; // Added: Contact rate percentage today (answered calls)
    positiveCallPercentageToday: number; // Added: Positive call percentage (completed_form + going_to_complete)
    currentGap?: {
      startedAt: Date;
      duration: number 
    };
  };
  sessionStats: {
    loginTime: Date;
    timeOnline: number;
    productivity: number;
  };
}

export interface SystemEfficiencyMetrics {
  timestamp: Date;
  globalMetrics: {
    activeAgents: number;
    avgSystemGapTime: number;
    totalCallsInProgress: number;
    queueDepth: number;
    systemEfficiencyScore: number;
  };
  bottlenecks: {
    queueBottleneck?: { severity: number; details: string };
    agentBottleneck?: { severity: number; details: string };
    systemBottleneck?: { severity: number; details: string };
  };
} 