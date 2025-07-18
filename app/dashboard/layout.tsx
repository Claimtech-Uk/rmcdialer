'use client';

// =============================================================================
// Dashboard Layout - Next.js App Router
// =============================================================================
// Protected layout with navigation for all dashboard pages

// Force dynamic rendering
export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  ChevronDown,
  LogOut,
  User,
  BarChart3,
  MessageSquare,
  Link as LinkIcon,
  Phone,
  Calendar,
  Settings,
  Users
} from 'lucide-react';
import { api } from '@/lib/trpc/client'
import { tokenUtils } from '@/modules/auth'

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get current agent session
  const { data: session, isLoading } = api.auth.me.useQuery();
  const logoutMutation = api.auth.logout.useMutation({
    onSuccess: () => {
      // Clear tokens from localStorage and cookies
      tokenUtils.clear()
      router.push('/login')
    }
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync()
    } catch (error) {
      console.error('Logout error:', error)
      // Force navigation and clear tokens even if logout fails
      tokenUtils.clear()
      router.push('/login')
    }
  };

  // Define navigation items with role-based access
  const navigation = [
    { 
      name: 'Queue', 
      href: '/queue', 
      icon: Calendar, 
      roles: ['agent', 'supervisor', 'admin'],
      description: 'Manage call queue'
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

  // Redirect if not authenticated (should be handled by middleware, but as backup)
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
                <Link href={"/" as any} className="text-xl font-bold text-gray-900">
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
                      title={item.description}
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
              {/* Agent Status Indicator */}
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-gray-600">Online</span>
              </div>

              {/* User Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center space-x-2 text-sm text-gray-700 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md px-2 py-1 transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="text-left">
                      <div className="font-medium">
                        {agent.firstName} {agent.lastName}
                      </div>
                      <div className="text-xs text-gray-500 capitalize">
                        {agent.role}
                      </div>
                    </div>
                  </div>
                  <ChevronDown 
                    className={`w-4 h-4 text-gray-400 transition-transform ${
                      userDropdownOpen ? 'rotate-180' : ''
                    }`} 
                  />
                </button>

                {/* Dropdown Menu */}
                {userDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                    <div className="py-1">
                      {/* User Info */}
                      <div className="px-4 py-3 border-b border-gray-100">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <User className="w-6 h-6 text-blue-600" />
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">
                              {agent.firstName} {agent.lastName}
                            </div>
                            <div className="text-sm text-gray-500">{agent.email}</div>
                            <div className="flex items-center space-x-2 mt-1">
                              <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full capitalize">
                                {agent.role}
                              </span>
                              {agent.isAiAgent && (
                                <span className="text-xs px-2 py-1 bg-purple-100 text-purple-800 rounded-full">
                                  AI Agent
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Profile Link - Available to all users */}
                      <Link
                        href={"/profile" as any}
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        onClick={() => setUserDropdownOpen(false)}
                      >
                        <User className="w-4 h-4 mr-3" />
                        Profile & Settings
                      </Link>

                      {/* Role-based menu items */}
                      {(agent.role === 'supervisor' || agent.role === 'admin') && (
                        <Link
                          href={"/" as any}
                          className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                          onClick={() => setUserDropdownOpen(false)}
                        >
                          <BarChart3 className="w-4 h-4 mr-3" />
                          Dashboard
                        </Link>
                      )}

                      {agent.role === 'admin' && (
                        <button
                          className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                          onClick={() => setUserDropdownOpen(false)}
                        >
                          <Settings className="w-4 h-4 mr-3" />
                          Settings
                        </button>
                      )}

                      {/* Logout */}
                      <div className="border-t border-gray-100">
                        <button
                          onClick={handleLogout}
                          disabled={logoutMutation.isPending}
                          className="flex items-center w-full px-4 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50 transition-colors"
                        >
                          <LogOut className="w-4 h-4 mr-3" />
                          {logoutMutation.isPending ? 'Signing out...' : 'Sign out'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Navigation (simplified for now) */}
        <div className="sm:hidden">
          <div className="pt-2 pb-3 space-y-1">
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
                      ? 'bg-blue-50 border-blue-500 text-blue-700'
                      : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
                  } block pl-3 pr-4 py-2 border-l-4 text-base font-medium transition-colors`}
                >
                  <div className="flex items-center">
                    <Icon className="w-4 h-4 mr-3" />
                    {item.name}
                  </div>
                </Link>
              );
            })}
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