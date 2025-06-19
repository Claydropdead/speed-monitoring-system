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
} from 'lucide-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close user menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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
    { name: 'Speed Tests', href: isAdmin ? '/admin/speedtests' : '/tests', icon: Zap },    ...(isAdmin
      ? [
          { name: 'Monitoring', href: '/admin/monitoring', icon: Monitor },
          { name: 'Offices', href: '/admin/offices', icon: Building },
          { name: 'Users', href: '/admin/users', icon: Users },
          { name: 'Reports', href: '/admin/reports', icon: FileText },
          { name: 'Settings', href: '/admin/settings', icon: Settings },
        ]
      : [{ name: 'Settings', href: '/settings', icon: Settings }]),
  ];

  const handleSignOut = () => {
    signOut({ callbackUrl: '/' });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
          <div className="fixed inset-y-0 left-0 flex w-64 flex-col bg-white">
            <div className="flex h-16 shrink-0 items-center px-6 border-b border-gray-200">
              <Activity className="h-8 w-8 text-blue-600" />
              <span className="ml-2 text-lg font-semibold text-gray-900">Speed Monitor</span>
            </div>
            <nav className="flex flex-1 flex-col px-4 py-4">
              <ul className="space-y-1">
                {navigation.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className={`${
                          isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
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
                  {navigation.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                      <li key={item.name}>
                        <Link
                          href={item.href}
                          className={`${
                            isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
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
                      session.user.office.subUnitOffice ? ` > ${session.user.office.subUnitOffice}` : ''
                    }`
                  : 'Dashboard'}
              </h1>
            </div>            <div className="flex items-center gap-x-4 lg:gap-x-6">
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
      </div>
    </div>
  );
}
