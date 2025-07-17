import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDownIcon, ArrowLeftOnRectangleIcon, UserIcon } from '@heroicons/react/24/outline';
import { useAuthStore } from '../store/auth';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { agent, logout, isLoading } = useAuthStore();
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      // Force navigation even if logout fails
      navigate('/login');
    }
  };

  const navigation = [
    { name: 'Queue', href: '/queue', icon: '📋', roles: ['agent', 'supervisor', 'admin'] },
    { name: 'SMS', href: '/sms', icon: '💬', roles: ['agent', 'supervisor', 'admin'] },
    { name: 'Magic Links', href: '/magic-links', icon: '🔗', roles: ['agent', 'supervisor', 'admin'] },
    { name: 'Call History', href: '/calls', icon: '📞', roles: ['agent', 'supervisor', 'admin'] },
    { name: 'Dashboard', href: '/dashboard', icon: '📊', roles: ['supervisor', 'admin'] },
  ].filter(item => agent?.role && item.roles.includes(agent.role));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Header */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              {/* Logo */}
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-xl font-bold text-gray-900">
                  📞 RMC Dialler
                </h1>
              </div>
              
              {/* Navigation Links */}
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {navigation.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`${
                        isActive
                          ? 'border-blue-500 text-gray-900'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                    >
                      <span className="mr-2">{item.icon}</span>
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
                  className="flex items-center space-x-2 text-sm text-gray-700 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md px-2 py-1"
                >
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <UserIcon className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="text-left">
                      <div className="font-medium">
                        {agent?.firstName} {agent?.lastName}
                      </div>
                      <div className="text-xs text-gray-500 capitalize">
                        {agent?.role}
                      </div>
                    </div>
                  </div>
                  <ChevronDownIcon 
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
                            <UserIcon className="w-6 h-6 text-blue-600" />
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">
                              {agent?.firstName} {agent?.lastName}
                            </div>
                            <div className="text-sm text-gray-500">{agent?.email}</div>
                            <div className="flex items-center space-x-2 mt-1">
                              <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full capitalize">
                                {agent?.role}
                              </span>
                              {agent?.isAiAgent && (
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
                        to="/profile"
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => setUserDropdownOpen(false)}
                      >
                        <span className="mr-3">👤</span>
                        Profile & Settings
                      </Link>

                      {/* Role-based menu items */}
                      {(agent?.role === 'supervisor' || agent?.role === 'admin') && (
                        <>
                          <Link
                            to="/dashboard"
                            className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            onClick={() => setUserDropdownOpen(false)}
                          >
                            <span className="mr-3">📊</span>
                            Dashboard
                          </Link>
                        </>
                      )}

                      {agent?.role === 'admin' && (
                        <>
                          <button
                            className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            onClick={() => setUserDropdownOpen(false)}
                          >
                            <span className="mr-3">⚙️</span>
                            Settings
                          </button>
                        </>
                      )}

                      {/* Logout */}
                      <div className="border-t border-gray-100">
                        <button
                          onClick={handleLogout}
                          disabled={isLoading}
                          className="flex items-center w-full px-4 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          <ArrowLeftOnRectangleIcon className="w-4 h-4 mr-3" />
                          {isLoading ? 'Signing out...' : 'Sign out'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
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