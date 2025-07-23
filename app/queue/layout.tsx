'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/modules/core/components/ui/sidebar';
import { api } from '@/lib/trpc/client';
import { getTeamFromAgent } from '@/lib/config/teams';

interface QueueLayoutProps {
  children: React.ReactNode;
}

function QueueNavigation() {
  const pathname = usePathname();
  const { data: session } = api.auth.me.useQuery();
  
  if (!session?.agent) return null;

  const agentTeam = getTeamFromAgent(session.agent);
  const canAccessUnsigned = session.agent.allowedQueues.includes('unsigned_users');
  const canAccessRequirements = session.agent.allowedQueues.includes('outstanding_requests');
  
  const currentTeam = pathname.includes('/unsigned') ? 'unsigned' : 
                    pathname.includes('/requirements') ? 'requirements' : null;

  return (
    <div className="bg-white border-b shadow-sm mb-6">
      <div className="container mx-auto px-6">
        <div className="flex items-center gap-8 py-4">
          <Link 
            href="/dashboard" 
            className="text-slate-600 hover:text-slate-900 transition-colors font-medium"
          >
            ← Dashboard
          </Link>

          <div className="text-slate-400">|</div>

          {canAccessUnsigned && (
            <div className={`flex items-center gap-4 ${currentTeam === 'unsigned' ? 'text-orange-600' : 'text-slate-600'}`}>
              <div className="flex items-center gap-2">
                <span className="text-lg">🖊️</span>
                <span className="font-medium">Signature Team</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Link 
                  href="/queue/unsigned"
                  className={`px-3 py-1 rounded-lg transition-colors ${
                    pathname === '/queue/unsigned' 
                      ? 'bg-orange-100 text-orange-700 font-medium' 
                      : 'hover:bg-slate-100'
                  }`}
                >
                  Manual Queue
                </Link>
                <Link 
                  href="/queue/unsigned/auto-dialer"
                  className={`px-3 py-1 rounded-lg transition-colors ${
                    pathname.includes('/queue/unsigned/auto-dialer')
                      ? 'bg-orange-600 text-white font-medium' 
                      : 'hover:bg-orange-50 text-orange-600'
                  }`}
                >
                  Auto-Dialer
                </Link>
              </div>
            </div>
          )}

          {canAccessUnsigned && canAccessRequirements && (
            <div className="text-slate-400">|</div>
          )}

          {canAccessRequirements && (
            <div className={`flex items-center gap-4 ${currentTeam === 'requirements' ? 'text-blue-600' : 'text-slate-600'}`}>
              <div className="flex items-center gap-2">
                <span className="text-lg">📋</span>
                <span className="font-medium">Requirements Team</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Link 
                  href="/queue/requirements"
                  className={`px-3 py-1 rounded-lg transition-colors ${
                    pathname === '/queue/requirements'
                      ? 'bg-blue-100 text-blue-700 font-medium' 
                      : 'hover:bg-slate-100'
                  }`}
                >
                  Manual Queue
                </Link>
                <Link 
                  href="/queue/requirements/auto-dialer"
                  className={`px-3 py-1 rounded-lg transition-colors ${
                    pathname.includes('/queue/requirements/auto-dialer')
                      ? 'bg-blue-600 text-white font-medium' 
                      : 'hover:bg-blue-50 text-blue-600'
                  }`}
                >
                  Auto-Dialer
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function QueueLayout({ children }: QueueLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <Sidebar>
        <QueueNavigation />
        {children}
      </Sidebar>
    </div>
  );
}
