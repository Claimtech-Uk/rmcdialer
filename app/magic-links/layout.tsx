'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Calendar, 
  Phone, 
  MessageSquare, 
  BarChart3, 
  LogOut, 
  User,
  Link as LinkIcon
} from 'lucide-react';
import { api } from '@/lib/trpc/client';
import { Button } from '@/modules/core/components/ui/button';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();

  // Get current session
  const { data: session, isLoading } = api.auth.me.useQuery();

  // Logout mutation
  const logoutMutation = api.auth.logout.useMutation({
    onSuccess: () => {
      router.push('/login');
    }
  });

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  // Define navigation items
  const navigation = [
    { 
      name: 'Queue', 
              href: '/queue/unsigned', 
      icon: Calendar, 
      roles: ['agent', 'supervisor', 'admin']
    },
    { 
      name: 'Calls', 
      href: '/calls', 
      icon: Phone, 
      roles: ['agent', 'supervisor', 'admin']
    },
    { 
      name: 'SMS', 
      href: '/sms', 
      icon: MessageSquare, 
      roles: ['agent', 'supervisor', 'admin']
    },
    { 
      name: 'Magic Links', 
      href: '/magic-links', 
      icon: LinkIcon, 
      roles: ['agent', 'supervisor', 'admin']
    },
    { 
      name: 'Call History', 
      href: '/calls/history', 
      icon: Phone, 
      roles: ['agent', 'supervisor', 'admin']
    },
    { 
      name: 'Dashboard', 
      href: '/', 
      icon: BarChart3, 
      roles: ['supervisor', 'admin']
    },
  ].filter(item => session?.agent?.role && item.roles.includes(session.agent.role));

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect if not authenticated
  if (!session?.agent) {
    router.push('/login');
    return null;
  }

  const agent = session.agent;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Header */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              {/* Logo */}
              <div className="flex-shrink-0 flex items-center">
                <Link href="/" className="text-xl font-bold text-gray-900">
                  📞 RMC Dialler
                </Link>
              </div>
              
              {/* Navigation Links */}
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {navigation.map((item) => {
                  const isActive = pathname === item.href || 
                    (item.href !== '/' && pathname.startsWith(item.href));
                  const Icon = item.icon;
                  
                  return (
                    <Link
                      key={item.name}
                      href={item.href as any}
                      className={`${
                        isActive
                          ? 'border-blue-500 text-gray-900'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors`}
                    >
                      <Icon className="w-4 h-4 mr-2" />
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* User Menu */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <div className="text-sm">
                  <div className="font-medium text-gray-900">
                    {agent.firstName} {agent.lastName}
                  </div>
                  <div className="text-gray-500 capitalize">{agent.role}</div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Link href="/profile">
                  <Button variant="ghost" size="sm">
                    Profile
                  </Button>
                </Link>
                
                <button
                  onClick={handleLogout}
                  disabled={logoutMutation.isPending}
                  className="flex items-center px-3 py-2 text-sm text-red-700 hover:bg-red-50 rounded transition-colors"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  {logoutMutation.isPending ? 'Signing out...' : 'Sign out'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
} 