'use client';

import { useSession } from 'next-auth/react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '../../../components/dashboard-layout';
import { Settings, Clock, Bell, Database, Shield, Globe, AlertCircle } from 'lucide-react';

export default function AdminSettingsPage() {
  const { data: session } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session?.user?.role !== 'ADMIN') {
      router.push('/dashboard');
      return;
    }
  }, [session, router]);

  if (session?.user?.role !== 'ADMIN') {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900">System Settings</h2>
          <p className="text-gray-600 mt-1">Configure system-wide settings and preferences</p>
        </div>

        {/* Coming Soon Card */}
        <div className="bg-white shadow rounded-lg p-8">
          <div className="text-center">
            <div className="p-3 bg-blue-100 rounded-full inline-block mb-4">
              <Settings className="h-8 w-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">System Settings Coming Soon</h3>
            <p className="text-gray-500 max-w-md mx-auto">
              Advanced system configuration options are under development. This will include
              scheduling settings, notification preferences, and system maintenance tools.
            </p>

            {/* Feature Preview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-8 max-w-4xl mx-auto">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <Clock className="h-6 w-6 text-gray-400 mx-auto mb-2" />
                <h4 className="text-sm font-medium text-gray-900">Test Scheduling</h4>
                <p className="text-xs text-gray-500 mt-1">
                  Configure automated speed test intervals
                </p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <Bell className="h-6 w-6 text-gray-400 mx-auto mb-2" />
                <h4 className="text-sm font-medium text-gray-900">Notifications</h4>
                <p className="text-xs text-gray-500 mt-1">Set up alerts and email notifications</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <Database className="h-6 w-6 text-gray-400 mx-auto mb-2" />
                <h4 className="text-sm font-medium text-gray-900">Data Retention</h4>
                <p className="text-xs text-gray-500 mt-1">
                  Manage historical data storage policies
                </p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <Shield className="h-6 w-6 text-gray-400 mx-auto mb-2" />
                <h4 className="text-sm font-medium text-gray-900">Security</h4>
                <p className="text-xs text-gray-500 mt-1">
                  Configure authentication and access controls
                </p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <Globe className="h-6 w-6 text-gray-400 mx-auto mb-2" />
                <h4 className="text-sm font-medium text-gray-900">Speed Test Servers</h4>
                <p className="text-xs text-gray-500 mt-1">
                  Manage Ookla server selection and preferences
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Current Configuration Notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-blue-400 mt-0.5" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">Current Configuration</h3>
              <div className="text-sm text-blue-700 mt-1 space-y-1">
                <p>• Speed tests are automatically scheduled 3 times daily for each office</p>
                <p>• Tests use Ookla Speedtest CLI with automatic server selection</p>
                <p>• All test results are stored indefinitely in the SQLite database</p>
                <p>
                  • Manual configuration can be done through environment variables and code changes
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Environment Variables Reference */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Environment Configuration</h3>
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-900 mb-2">
              Available Environment Variables:
            </h4>
            <div className="text-xs text-gray-600 font-mono space-y-1">
              <div>NEXTAUTH_SECRET - Authentication secret key</div>
              <div>NEXTAUTH_URL - Application base URL</div>
              <div>DATABASE_URL - Database connection string</div>
              <div>SPEEDTEST_SERVER_ID - Optional: Force specific Ookla server</div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
