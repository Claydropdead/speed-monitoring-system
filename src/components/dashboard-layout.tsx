'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import {
  Activity,
  BarChart3,
  Building,
  FileText,
  LogOut,
  Menu,
  Monitor,
  Settings,
  Users,
  Zap,
  Key,
  ChevronDown,
  Clock,
  AlertTriangle,
  Download,
} from 'lucide-react';
import { Footer } from '@/components/footer';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [showLogoutWarning, setShowLogoutWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(15 * 60); // Session time in seconds
  const userMenuRef = useRef<HTMLDivElement>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const sessionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-logout functionality
  const SESSION_TIMEOUT = 15 * 60; // 15 minutes for production
  const WARNING_TIME = 14 * 60; // Show warning at 14 minutes

  const clearAllTimers = () => {
    if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
  };

  const startLogoutWarning = () => {
    setShowLogoutWarning(true);
    setTimeRemaining(60); // 1 minute remaining

    // Start countdown timer
    countdownIntervalRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        const newTime = prev - 1;
        
        if (newTime <= 0) {
          clearAllTimers();
          signOut({ callbackUrl: '/' });
          return 0;
        }
        return newTime;
      });
    }, 1000);
  };

  const resetActivityTimer = () => {
    // Clear all existing timers
    clearAllTimers();
    
    // Reset state
    setShowLogoutWarning(false);
    setTimeRemaining(SESSION_TIMEOUT);
    lastActivityRef.current = Date.now();

    // Set warning timer (show warning at 14 minutes)
    warningTimerRef.current = setTimeout(startLogoutWarning, WARNING_TIME * 1000);
  };

  const extendSession = () => {
    resetActivityTimer();
  };

  // Close user menu when clicking outside and activity tracking
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);

    if (status === 'authenticated') {
      // Initial timer setup
      resetActivityTimer();

      // Track user activity
      const activities = ['mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
      
      const handleActivity = () => {
        // Check if we're not currently showing the warning
        if (!showLogoutWarning) {
          resetActivityTimer();
        }
      };

      activities.forEach(activity => {
        document.addEventListener(activity, handleActivity, true);
      });

      return () => {
        // Cleanup timers
        clearAllTimers();

        // Remove event listeners
        activities.forEach(activity => {
          document.removeEventListener(activity, handleActivity, true);
        });
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [status]);

  const handleSignOut = () => {
    signOut({ callbackUrl: '/' });
  };

  // Main effect for activity tracking and session management
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);

    if (status === 'authenticated') {
      // Initial timer setup
      resetActivityTimer();

      // Track user activity
      const activities = ['mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
      
      const handleActivity = () => {
        if (!showLogoutWarning) {
          resetActivityTimer();
        }
      };

      activities.forEach(activity => {
        document.addEventListener(activity, handleActivity, true);
      });

      return () => {
        // Cleanup timers
        clearAllTimers();

        // Remove event listeners
        activities.forEach(activity => {
          document.removeEventListener(activity, handleActivity, true);
        });
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [status]);

  // Update session timer display
  useEffect(() => {
    if (status === 'authenticated' && !showLogoutWarning) {
      const updateInterval = setInterval(() => {
        const elapsed = (Date.now() - lastActivityRef.current) / 1000;
        const remaining = Math.max(0, SESSION_TIMEOUT - elapsed);
        setTimeRemaining(Math.floor(remaining));
      }, 5000); // Update every 5 seconds for 15-minute session

      return () => clearInterval(updateInterval);
    }
  }, [status, showLogoutWarning]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Activity className="h-8 w-8 text-blue-600 mx-auto animate-pulse" />
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    router.push('/auth/signin');
    return null;
  }

  const isAdmin = session?.user?.role === 'ADMIN';
  const navigation = [
    { name: 'Dashboard', href: isAdmin ? '/admin/dashboard' : '/dashboard', icon: BarChart3 },
    { name: 'Speed Tests', href: isAdmin ? '/admin/speedtests' : '/tests', icon: Zap },
    ...(isAdmin
      ? [
          { name: 'Monitoring', href: '/admin/monitoring', icon: Monitor },
          { name: 'Offices', href: '/admin/offices', icon: Building },
          { name: 'Users', href: '/admin/users', icon: Users },
          { name: 'Analytics', href: '/admin/reports', icon: FileText },
          { name: 'Export Reports', href: '/admin/export', icon: Download },
          { name: 'Settings', href: '/admin/settings', icon: Settings },
        ]
      : [{ name: 'Settings', href: '/settings', icon: Settings }]),
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="fixed inset-0 bg-gray-600 bg-opacity-75"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 flex w-64 flex-col bg-white">
            <div className="flex h-16 shrink-0 items-center px-6 border-b border-gray-200">
              <Activity className="h-8 w-8 text-blue-600" />
              <span className="ml-2 text-lg font-semibold text-gray-900">Speed Monitor</span>
            </div>
            <nav className="flex flex-1 flex-col px-4 py-4">
              <ul className="space-y-1">
                {navigation.map(item => {
                  const isActive = pathname === item.href;
                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className={`${
                          isActive
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                        } group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-medium`}
                        onClick={() => setSidebarOpen(false)}
                      >
                        <item.icon className="h-5 w-5 shrink-0" />
                        {item.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white border-r border-gray-200 px-6">
          <div className="flex h-16 shrink-0 items-center">
            <Activity className="h-8 w-8 text-blue-600" />
            <span className="ml-2 text-lg font-semibold text-gray-900">Speed Monitor</span>
          </div>
          <nav className="flex flex-1 flex-col">
            <ul className="flex flex-1 flex-col gap-y-7">
              <li>
                <ul className="-mx-2 space-y-1">
                  {navigation.map(item => {
                    const isActive = pathname === item.href;
                    return (
                      <li key={item.name}>
                        <Link
                          href={item.href}
                          className={`${
                            isActive
                              ? 'bg-blue-50 text-blue-700'
                              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                          } group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-medium`}
                        >
                          <item.icon className="h-5 w-5 shrink-0" />
                          {item.name}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </li>
            </ul>
          </nav>
        </div>
      </div>

      <div className="lg:pl-64">
        {/* Top bar */}
        <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
          <button
            type="button"
            className="-m-2.5 p-2.5 text-gray-700 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
            <div className="flex flex-1 items-center">
              <h1 className="text-lg font-semibold text-gray-900">
                {isAdmin
                  ? 'Admin Dashboard'
                  : session?.user?.office
                    ? `${session.user.office.unitOffice}${
                        session.user.office.subUnitOffice
                          ? ` > ${session.user.office.subUnitOffice}`
                          : ''
                      }`
                    : 'Dashboard'}
              </h1>
            </div>

            <div className="flex items-center gap-x-4 lg:gap-x-6">
              {/* Session Timer Indicator */}
              {status === 'authenticated' && !showLogoutWarning && (
                <div className="hidden sm:flex items-center text-xs text-gray-500">
                  <Clock className="h-3 w-3 mr-1" />
                  <span>
                    Session: {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
                  </span>
                </div>
              )}
              
              {/* User menu */}
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-x-3 text-sm focus:outline-none"
                >
                  <div className="text-right">
                    <p className="font-medium text-gray-900">{session?.user?.name}</p>
                    <p className="text-gray-500">{session?.user?.email}</p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                </button>
                {/* Dropdown menu */}
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
                    {/* Change Password - Smart routing based on role */}
                    <Link
                      href={isAdmin ? '/admin/users' : '/settings'}
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <Key className="h-4 w-4 mr-2" />
                      Change Password
                    </Link>
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        handleSignOut();
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Main content */}
        <main className="py-8">
          <div className="px-4 sm:px-6 lg:px-8">{children}</div>
        </main>

        <Footer variant="dashboard" />
      </div>

      {/* Auto-logout warning modal */}
      {showLogoutWarning && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="relative bg-white rounded-lg shadow-xl p-6 m-4 max-w-md w-full">
            <div className="flex items-center mb-4">
              <AlertTriangle className="h-6 w-6 text-yellow-500 mr-3" />
              <h3 className="text-lg font-medium text-gray-900">Session Timeout Warning</h3>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-600 mb-4">
                Your session will expire due to inactivity. You will be automatically logged out in:
              </p>
              
              <div className="flex items-center justify-center bg-red-50 rounded-lg p-4">
                <Clock className="h-5 w-5 text-red-500 mr-2" />
                <span className="text-2xl font-bold text-red-600">
                  {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
                </span>
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={extendSession}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 font-medium"
              >
                Stay Logged In
              </button>
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 font-medium"
              >
                Logout Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
