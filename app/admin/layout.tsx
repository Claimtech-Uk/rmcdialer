'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/trpc/client';
import { Button } from '@/modules/core/components/ui/button';
import { 
  Users, 
  Settings, 
  BarChart3, 
  LogOut, 
  User,
  Shield,
  Home,
  Database,
  Activity
} from 'lucide-react';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
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

  // Redirect if not authenticated or not admin
  if (!session?.agent || session.agent.role !== 'admin') {
    router.push('/dashboard');
    return null;
  }

  const agent = session.agent;

  // Define admin navigation items
  const navigation = [
    { 
      name: 'Dashboard', 
      href: '/dashboard', 
      icon: Home,
      description: 'System overview'
    },
    { 
      name: 'Agent Management', 
      href: '/admin/agents', 
      icon: Users,
      description: 'Manage system agents'
    },
    { 
      name: 'System Analytics', 
      href: '/admin/analytics', 
      icon: BarChart3,
      description: 'System-wide analytics'
    },
    { 
      name: 'Database Tools', 
      href: '/admin/database', 
      icon: Database,
      description: 'Database management'
    },
    { 
      name: 'System Health', 
      href: '/admin/health', 
      icon: Activity,
      description: 'System monitoring'
    },
    { 
      name: 'Settings', 
      href: '/admin/settings', 
      icon: Settings,
      description: 'System configuration'
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-sm border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Admin Panel</h1>
              <p className="text-sm text-gray-500">RMC Dialler</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 px-6 py-6">
          <nav className="space-y-2">
            {navigation.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link key={item.name} href={item.href as any}>
                  <div className={`
                    flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors
                    ${isActive 
                      ? 'bg-primary text-primary-foreground' 
                      : 'text-gray-700 hover:bg-gray-100'
                    }
                  `}>
                    <item.icon className="w-4 h-4 mr-3" />
                    <div className="flex-1">
                      <div>{item.name}</div>
                      <div className={`text-xs ${isActive ? 'text-primary-foreground/80' : 'text-gray-500'}`}>
                        {item.description}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Profile Section */}
        <div className="p-6 border-t border-gray-200">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900">
                {agent.firstName} {agent.lastName}
              </div>
              <div className="text-xs text-gray-500">
                {agent.email}
              </div>
              <div className="text-xs text-red-600 font-medium">
                Administrator
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Link href="/profile">
              <Button variant="ghost" size="sm" className="w-full justify-start">
                <User className="w-4 h-4 mr-2" />
                Profile
              </Button>
            </Link>
            
            <button
              onClick={handleLogout}
              disabled={logoutMutation.isPending}
              className="flex items-center w-full px-3 py-2 text-sm text-red-700 hover:bg-red-50 rounded transition-colors"
            >
              <LogOut className="w-4 h-4 mr-2" />
              {logoutMutation.isPending ? 'Signing out...' : 'Sign out'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {navigation.find(item => pathname === item.href || pathname.startsWith(item.href + '/'))?.name || 'Admin Panel'}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {navigation.find(item => pathname === item.href || pathname.startsWith(item.href + '/'))?.description || 'Administration interface'}
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600">
                Welcome back, {agent.firstName}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
} 