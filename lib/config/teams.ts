import { QueueType } from '@/modules/queue/types/queue.types';

export type TeamType = 'unsigned' | 'requirements';

export interface TeamConfig {
  team: TeamType;
  queueType: QueueType;
  displayName: string;
  description: string;
  shortName: string;
  icon: string;
  color: {
    primary: string;
    gradient: string;
    badge: string;
    background: string;
  };
  callSettings: {
    defaultTimeBetweenCalls: number; // seconds
    maxCallsPerSession: number;
    breakIntervalMinutes: number;
    avgCallTargetSeconds: number;
    maxDailyCallsTarget: number;
  };
  scripts: {
    opening: string;
    voicemail: string;
    callback: string;
    success: string;
  };
  successMetrics: string[];
  routes: {
    autoDialer: string;
    manual: string;
    reports: string;
  };
  features: {
    magicLinkEnabled: boolean;
    documentUploadEnabled: boolean;
    signatureRequestEnabled: boolean;
    smsEnabled: boolean;
  };
  outcomes: {
    primary: string[];
    secondary: string[];
  };
}

export const TEAM_CONFIGS: Record<TeamType, TeamConfig> = {
  unsigned: {
    team: 'unsigned',
    queueType: 'unsigned_users',
    displayName: 'Signature Collection Team',
    description: 'Collect missing digital signatures to unblock claims',
    shortName: 'Signatures',
    icon: '🖊️',
    color: {
      primary: 'orange-600',
      gradient: 'from-orange-500 to-red-600',
      badge: 'bg-orange-100 text-orange-800 border-orange-200',
      background: 'bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50'
    },
    callSettings: {
      defaultTimeBetweenCalls: 30,
      maxCallsPerSession: 80,
      breakIntervalMinutes: 120,
      avgCallTargetSeconds: 120,
      maxDailyCallsTarget: 50
    },
    scripts: {
      opening: "Hi {firstName}, this is {agentName} calling about your claim with {lender}. We need your digital signature to proceed with your case.",
      voicemail: "Hi {firstName}, this is {agentName} from RMC regarding your {lender} claim. We need your signature to move forward. Please call us back at our office number when convenient.",
      callback: "Perfect, I'll schedule a callback for {callbackTime}. We'll call you then to complete your signature process.",
      success: "Great! Your signature has been received. Your claim can now proceed to the next stage."
    },
    successMetrics: ['signature_obtained', 'signed', 'contacted'],
    routes: {
      autoDialer: '/queue/unsigned/auto-dialer',
      manual: '/queue/unsigned',
      reports: '/reports/signatures'
    },
    features: {
      magicLinkEnabled: true,
      documentUploadEnabled: false,
      signatureRequestEnabled: true,
      smsEnabled: true
    },
    outcomes: {
      primary: ['signature_obtained', 'signed', 'contacted'],
      secondary: ['callback_requested', 'left_voicemail', 'no_answer']
    }
  },
  
  requirements: {
    team: 'requirements',
    queueType: 'outstanding_requests',
    displayName: 'Requirements Follow-up Team',
    description: 'Chase outstanding document requirements',
    shortName: 'Documents',
    icon: '📋',
    color: {
      primary: 'blue-600',
      gradient: 'from-blue-500 to-cyan-600',
      badge: 'bg-blue-100 text-blue-800 border-blue-200',
      background: 'bg-gradient-to-br from-blue-50 via-indigo-50 to-cyan-50'
    },
    callSettings: {
      defaultTimeBetweenCalls: 45,
      maxCallsPerSession: 60,
      breakIntervalMinutes: 90,
      avgCallTargetSeconds: 180,
      maxDailyCallsTarget: 35
    },
    scripts: {
      opening: "Hi {firstName}, this is {agentName} calling about your {lender} claim. We need some additional documents to complete your case.",
      voicemail: "Hi {firstName}, this is {agentName} from RMC regarding your {lender} claim. We need some documents from you to proceed. Please call us back at our office number.",
      callback: "Great, I'll schedule a callback for {callbackTime} to discuss the required documents and help you upload them.",
      success: "Perfect! All required documents have been received. Your claim is now complete and will be processed."
    },
    successMetrics: ['documents_received', 'requirements_completed', 'contacted'],
    routes: {
      autoDialer: '/queue/requirements/auto-dialer',
      manual: '/queue/requirements',
      reports: '/reports/requirements'
    },
    features: {
      magicLinkEnabled: true,
      documentUploadEnabled: true,
      signatureRequestEnabled: false,
      smsEnabled: true
    },
    outcomes: {
      primary: ['documents_received', 'requirements_completed', 'contacted'],
      secondary: ['callback_requested', 'left_voicemail', 'no_answer']
    }
  }
};

export function getTeamConfig(team: TeamType): TeamConfig {
  const config = TEAM_CONFIGS[team];
  if (!config) {
    throw new Error(`Team config not found for team: ${team}`);
  }
  return config;
}

export function getTeamForQueue(queueType: QueueType): TeamType {
  return queueType === 'unsigned_users' ? 'unsigned' : 'requirements';
}

export function getTeamFromAgent(agent: { team?: string; allowedQueues?: string[] }): TeamType | null {
  if (agent.team && (agent.team === 'unsigned' || agent.team === 'requirements')) {
    return agent.team as TeamType;
  }
  
  // Fallback: infer from allowed queues
  if (agent.allowedQueues) {
    const queues = Array.isArray(agent.allowedQueues) ? agent.allowedQueues : JSON.parse(agent.allowedQueues as string);
    if (queues.includes('unsigned_users') && !queues.includes('outstanding_requests')) {
      return 'unsigned';
    }
    if (queues.includes('outstanding_requests') && !queues.includes('unsigned_users')) {
      return 'requirements';
    }
  }
  
  return null;
}

export function validateTeamAccess(agentTeam: string | null | undefined, requiredTeam: TeamType): boolean {
  return agentTeam === requiredTeam;
}

export function formatScript(script: string, variables: Record<string, string>): string {
  let formatted = script;
  for (const [key, value] of Object.entries(variables)) {
    formatted = formatted.replace(new RegExp(`{${key}}`, 'g'), value || `{${key}}`);
  }
  return formatted;
}

// Team-specific styling helpers
export function getTeamThemeClasses(teamType: TeamType) {
  const config = getTeamConfig(teamType);
  return {
    primary: `text-${config.color.primary}`,
    gradient: `bg-gradient-to-r ${config.color.gradient}`,
    badge: config.color.badge,
    background: config.color.background,
    button: `bg-${config.color.primary} hover:bg-${config.color.primary.replace('-600', '-700')} text-white`,
    border: `border-${config.color.primary.replace('-600', '-200')}`
  };
} 