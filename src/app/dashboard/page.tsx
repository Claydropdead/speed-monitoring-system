'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard-layout';
import { 
  Download, 
  Upload, 
  Clock, 
  TrendingUp, 
  AlertCircle,
  Calendar
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { format } from 'date-fns';

interface DashboardStats {
  totalTests: number;
  testsToday: number;
  averageDownload: number;
  averageUpload: number;
  averagePing: number;
  chartData: Array<{
    date: string;
    download: number;
    upload: number;
    ping: number;
  }>;
}

interface SpeedTest {
  id: string;
  download: number;
  upload: number;
  ping: number;
  timestamp: string;
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentTests, setRecentTests] = useState<SpeedTest[]>([]);
  const [loading, setLoading] = useState(true);

  // Redirect admins to admin dashboard
  useEffect(() => {
    if (status === 'loading') return; // Still loading
    
    if (session?.user?.role === 'ADMIN') {
      router.replace('/admin/dashboard');
      return;
    }
    
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }
  }, [session, status, router]);

  useEffect(() => {
    if (session?.user?.role !== 'ADMIN') {
      fetchDashboardData();
      fetchRecentTests();
    }
  }, [session]);

  const fetchDashboardData = async () => {
    if (!session?.user?.officeId) return;

    try {
      const response = await fetch(`/api/dashboard/stats?officeId=${session.user.officeId}&days=30`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentTests = async () => {
    if (!session?.user?.officeId) return;    try {
      const response = await fetch(`/api/speedtest?officeId=${session.user.officeId}&limit=10`);
      if (response.ok) {
        const data = await response.json();
        setRecentTests(data.tests || []);
      }
    } catch (error) {
      console.error('Error fetching recent tests:', error);
    }  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading dashboard...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Speed Test Dashboard</h2>
            <p className="text-gray-600 mt-1">
              Monitor your office internet performance
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            <div className="stat-card">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Download className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="stat-label">Avg Download</p>
                  <p className="stat-value">{stats.averageDownload} Mbps</p>
                </div>
              </div>
            </div>

            <div className="stat-card">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Upload className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="stat-label">Avg Upload</p>
                  <p className="stat-value">{stats.averageUpload} Mbps</p>
                </div>
              </div>
            </div>

            <div className="stat-card">
              <div className="flex items-center">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Clock className="h-6 w-6 text-orange-600" />
                </div>
                <div className="ml-4">
                  <p className="stat-label">Avg Ping</p>
                  <p className="stat-value">{stats.averagePing} ms</p>
                </div>
              </div>
            </div>

            <div className="stat-card">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="stat-label">Total Tests</p>
                  <p className="stat-value">{stats.totalTests}</p>
                </div>
              </div>
            </div>

            <div className="stat-card">
              <div className="flex items-center">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <Calendar className="h-6 w-6 text-indigo-600" />
                </div>
                <div className="ml-4">
                  <p className="stat-label">Today's Tests</p>
                  <p className="stat-value">{stats.testsToday}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Charts */}
        {stats?.chartData && stats.chartData.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Line Chart */}
            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-semibold text-gray-900">Speed Trends (Last 30 Days)</h3>
              </div>
              <div className="card-content">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={stats.chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(value) => format(new Date(value), 'MMM dd')}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(value) => format(new Date(value), 'MMM dd, yyyy')}
                      formatter={(value: number, name: string) => [
                        `${value} ${name === 'ping' ? 'ms' : 'Mbps'}`,
                        name.charAt(0).toUpperCase() + name.slice(1)
                      ]}
                    />
                    <Line type="monotone" dataKey="download" stroke="#3B82F6" strokeWidth={2} />
                    <Line type="monotone" dataKey="upload" stroke="#10B981" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Bar Chart for Ping */}
            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-semibold text-gray-900">Ping Performance</h3>
              </div>
              <div className="card-content">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={stats.chartData.slice(-10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(value) => format(new Date(value), 'MM/dd')}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(value) => format(new Date(value), 'MMM dd, yyyy')}
                      formatter={(value: number) => [`${value} ms`, 'Ping']}
                    />
                    <Bar dataKey="ping" fill="#F59E0B" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Recent Tests */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-gray-900">Recent Speed Tests</h3>          </div>
          <div className="card-content">
            {Array.isArray(recentTests) && recentTests.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date & Time
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Download
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Upload
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ping
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {recentTests.map((test) => (
                      <tr key={test.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {format(new Date(test.timestamp), 'MMM dd, yyyy h:mm a')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {test.download} Mbps
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {test.upload} Mbps
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {test.ping} ms
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No speed tests found</p>
                <p className="text-sm text-gray-400 mt-1">Run your first speed test to see results here</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
