'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DashboardLayout } from '../../../components/dashboard-layout';

interface SpeedTest {
  id: string;
  download: number;
  upload: number;
  ping: number;
  jitter?: number;
  packetLoss?: number;
  timestamp: string;
  isp: string; // ISP detected during the speed test
  office: {
    id: string;
    unitOffice: string;
    subUnitOffice?: string;
    isp: string; // Office's default ISP
    location: string;
  };
}

interface Office {
  id: string;
  unitOffice: string;
  subUnitOffice?: string;
  isp: string;
  location: string;
}

function AdminSpeedTestsContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [speedTests, setSpeedTests] = useState<SpeedTest[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOffice, setSelectedOffice] = useState<string>('all');

  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session) {
      router.push('/auth/signin');
      return;
    }

    const userRole = session.user?.role;
    
    if (userRole !== 'ADMIN') {
      router.push('/dashboard');
      return;
    }

    // Set initial office filter from URL params
    const officeParam = searchParams.get('office');
    if (officeParam) {
      setSelectedOffice(officeParam);
    }

    fetchSpeedTests();
    fetchOffices();
  }, [session, status, searchParams]);

  const fetchOffices = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/offices');
      if (response.ok) {
        const data = await response.json();
        setOffices(data.offices || []);
      }
    } catch (error) {
      // Error handling could be added here if needed
    } finally {
      setLoading(false);
    }
  };
  
  const fetchSpeedTests = async () => {
    setLoading(true);
    try {
      const url = selectedOffice === 'all' 
        ? '/api/speedtest?admin=true' 
        : `/api/speedtest?admin=true&officeId=${selectedOffice}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch speed tests: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      const testsArray = data.tests || [];
      setSpeedTests(testsArray);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch speed tests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (offices.length > 0) {
      fetchSpeedTests();
    }
  }, [selectedOffice]);

  if (status === 'loading' || loading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-2">Error</h1>
            <p className="text-gray-600">{error}</p>
          </div>
        </div>
      </DashboardLayout>    );
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">All Speed Tests</h1>
          <p className="text-gray-600">Monitor speed test results across all offices</p>
        </div>

        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">              <h2 className="text-lg font-medium text-gray-900">
                Speed Tests ({Array.isArray(speedTests) ? speedTests.length : 0})
              </h2>
              
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Office Filter */}
                <select
                  value={selectedOffice}
                  onChange={(e) => setSelectedOffice(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >                  <option value="all">All Offices</option>
                  {Array.isArray(offices) && offices.map((office) => (                    <option key={office.id} value={office.id}>
                      {office.unitOffice}
                      {office.subUnitOffice && ` - ${office.subUnitOffice}`} - {office.location}
                    </option>
                  ))}
                </select>                {/* Refresh Button */}
                <button
                  onClick={fetchSpeedTests}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Loading...' : 'Refresh'}
                </button>
              </div>
            </div>
          </div>          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Office
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ISP
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Details
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Timestamp
                  </th>
                </tr>              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {Array.isArray(speedTests) && speedTests.map((test) => (
                  <tr key={test.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {test.office.unitOffice}
                          {test.office.subUnitOffice && (
                            <span className="text-gray-600 ml-1">- {test.office.subUnitOffice}</span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          {test.office.location}                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {test.isp}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 font-medium">
                        {test.download.toFixed(2)} Mbps
                      </div>
                      <div className={`text-xs ${
                        test.download >= 25 ? 'text-green-600' : 
                        test.download >= 10 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {test.download >= 25 ? 'Excellent' : 
                         test.download >= 10 ? 'Good' : 'Poor'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 font-medium">
                        {test.upload.toFixed(2)} Mbps
                      </div>
                      <div className={`text-xs ${
                        test.upload >= 3 ? 'text-green-600' : 
                        test.upload >= 1 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {test.upload >= 3 ? 'Excellent' : 
                         test.upload >= 1 ? 'Good' : 'Poor'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 font-medium">
                        {test.ping.toFixed(0)} ms
                      </div>
                      <div className={`text-xs ${
                        test.ping <= 50 ? 'text-green-600' : 
                        test.ping <= 100 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {test.ping <= 50 ? 'Excellent' : 
                         test.ping <= 100 ? 'Good' : 'Poor'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {test.jitter && (
                        <div>Jitter: {test.jitter.toFixed(1)}ms</div>
                      )}
                      {test.packetLoss !== undefined && test.packetLoss > 0 && (
                        <div>Loss: {test.packetLoss.toFixed(1)}%</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {new Date(test.timestamp).toLocaleDateString()}
                      </div>
                      <div className="text-sm text-gray-500">
                        {new Date(test.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true
                        })}
                      </div>
                    </td>
                  </tr>
                ))}
                {(!Array.isArray(speedTests) || speedTests.length === 0) && (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                      <div className="text-lg">No speed tests found</div>
                      <div className="text-sm mt-1">
                        {selectedOffice !== 'all' 
                          ? 'Try selecting a different office or run a new test'
                          : 'Run your first speed test to see results here'
                        }
                      </div>                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>    </DashboardLayout>
  );
}

export default function AdminSpeedTestsPage() {
  return (
    <Suspense fallback={
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
        </div>
      </DashboardLayout>
    }>
      <AdminSpeedTestsContent />
    </Suspense>
  );
}