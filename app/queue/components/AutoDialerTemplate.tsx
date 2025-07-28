'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/trpc/client';
import { useToast } from '@/modules/core/hooks/use-toast';
import { validateTeamAccess } from '@/lib/config/teams';
import { AutoDiallerDashboard } from '@/modules/autodialler/components/AutoDiallerDashboard';
import type { TeamType } from '@/lib/config/teams';

interface AutoDialerTemplateProps {
  teamType: TeamType;
}

interface SessionStats {
  callsCompleted: number;
  startTime: Date;
  successfulContacts: number;
  lastCallAt?: Date;
}

type DialerState = 'ready' | 'loading' | 'calling' | 'disposing' | 'countdown' | 'paused';

export function AutoDialerTemplate({ teamType }: AutoDialerTemplateProps) {
  const { toast } = useToast();
  const router = useRouter();

  // Get current session for access validation
  const { data: session } = api.auth.me.useQuery();

  // Validate team access
  useEffect(() => {
    if (session?.agent) {
      const hasAccess = validateTeamAccess(session.agent.team, teamType);
      if (!hasAccess) {
        toast({
          title: "Access Denied",
          description: `You don't have access to this auto-dialler`,
          variant: "destructive"
        });
        router.push('/dashboard');
      }
    }
  }, [session, teamType, toast, router]);

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
          <p className="text-slate-600 text-lg">Loading session...</p>
        </div>
      </div>
    );
  }

  // Use the new AutoDiallerDashboard component
  return <AutoDiallerDashboard teamType={teamType} />;
} 