'use client';

import { useState, useEffect } from 'react';
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
  Activity,
  Phone,
  MessageSquare,
  PenTool,
  FileText,
  Menu,
  X
} from 'lucide-react';

interface SidebarProps {
  children: React.ReactNode;
}

export default function Sidebar({ children }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

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
  const isAdmin = agent.role === 'admin';
  const isSupervisor = agent.role === 'supervisor' || agent.role === 'admin';

  // Define main navigation items with role-based access
  const mainNavigation = [
    { 
      name: 'Unsigned', 
      href: '/queue/unsigned', 
      icon: PenTool, 
      roles: ['agent', 'supervisor', 'admin'],
      description: 'Users needing signatures'
    },
    { 
      name: 'Requirements', 
      href: '/queue/requirements', 
      icon: FileText, 
      roles: ['agent', 'supervisor', 'admin'],
      description: 'Users with pending documents'
    },
    { 
      name: 'Calls', 
      href: '/calls', 
      icon: Phone, 
      roles: ['agent', 'supervisor', 'admin'],
      description: 'Active and recent calls'
    },
    { 
      name: 'Call History', 
      href: '/calls/history', 
      icon: Phone, 
      roles: ['agent', 'supervisor', 'admin'],
      description: 'Call records and analytics'
    },
    { 
      name: 'SMS', 
      href: '/sms', 
      icon: MessageSquare, 
      roles: ['agent', 'supervisor', 'admin'],
      description: 'SMS conversations'
    },
    { 
      name: 'Dashboard', 
      href: '/dashboard', 
      icon: BarChart3, 
      roles: ['supervisor', 'admin'],
      description: 'Analytics and reports'
    },
  ].filter(item => agent.role && item.roles.includes(agent.role));

  // Define admin navigation items
  const adminNavigation = isAdmin ? [
    { 
      name: 'Agent Management', 
      href: '/admin/agents', 
      icon: Users,
      description: 'Manage system agents'
    },
  ] : [];

  const NavContent = () => (
    <>
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
            <Phone className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">RMC Dialler</h1>
            <p className="text-sm text-gray-500">Call Management System</p>
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 px-6 py-6">
        <div className="space-y-8">
          {/* Main Features */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Main Features
            </h3>
            <nav className="space-y-1">
              {mainNavigation.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <Link key={item.name} href={item.href as any}>
                    <div className={`
                      flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors
                      ${isActive 
                        ? 'bg-blue-600 text-white' 
                        : 'text-gray-700 hover:bg-gray-100'
                      }
                    `}>
                      <item.icon className="w-4 h-4 mr-2 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="truncate">{item.name}</div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Admin Features */}
          {adminNavigation.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Administration
              </h3>
              <nav className="space-y-1">
                {adminNavigation.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                  return (
                    <Link key={item.name} href={item.href as any}>
                      <div className={`
                        flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors
                        ${isActive 
                          ? 'bg-red-600 text-white' 
                          : 'text-gray-700 hover:bg-gray-100'
                        }
                      `}>
                        <item.icon className="w-4 h-4 mr-2 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="truncate">{item.name}</div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </nav>
            </div>
          )}
        </div>
      </div>

      {/* User Profile Section */}
      <div className="p-6 border-t border-gray-200">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
            <User className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900 truncate">
              {agent.firstName} {agent.lastName}
            </div>
            <div className="text-xs text-gray-500 truncate">
              {agent.email}
            </div>
            <div className={`text-xs font-medium capitalize ${
              agent.role === 'admin' ? 'text-red-600' : 
              agent.role === 'supervisor' ? 'text-blue-600' : 'text-green-600'
            }`}>
              {agent.role}
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <Link href="/profile">
            <Button variant="ghost" size="sm" className="w-full justify-start">
              <User className="w-4 h-4 mr-2 flex-shrink-0" />
              Profile
            </Button>
          </Link>
          
          <button
            onClick={handleLogout}
            disabled={logoutMutation.isPending}
            className="flex items-center w-full px-3 py-2 text-sm text-red-700 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
          >
            <LogOut className="w-4 h-4 mr-2 flex-shrink-0" />
            {logoutMutation.isPending ? 'Signing out...' : 'Sign out'}
          </button>
        </div>
      </div>
    </>
  );

  // Get current page title
  const currentPage = [...mainNavigation, ...adminNavigation].find(
    item => pathname === item.href || pathname.startsWith(item.href + '/')
  );

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0">
        <div className="bg-white shadow-sm border-r border-gray-200 flex flex-col h-full">
          <NavContent />
        </div>
      </div>

      {/* Mobile Sidebar */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-gray-600 bg-opacity-75"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          
          {/* Sidebar */}
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white">
            <div className="absolute top-0 right-0 -mr-12 pt-2">
              <button
                className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <X className="h-6 w-6 text-white" />
              </button>
            </div>
            <NavContent />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="lg:pl-64 flex flex-col flex-1" id="main-content-container">
        {/* Mobile Header */}
        <div className="lg:hidden bg-white shadow-sm border-b border-gray-200 px-4 py-2 flex items-center justify-between">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
          >
            <Menu className="h-6 w-6" />
          </button>
          
          <h1 className="text-lg font-semibold text-gray-900">
            {currentPage?.name || 'RMC Dialler'}
          </h1>
          
          <div className="w-10" /> {/* Spacer for centering */}
        </div>

        {/* Desktop Header */}
        <header className="hidden lg:block bg-white shadow-sm border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {currentPage?.name || 'Dashboard'}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {currentPage?.description || 'Welcome to RMC Dialler'}
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