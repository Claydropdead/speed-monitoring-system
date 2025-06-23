'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DashboardLayout } from '@/components/dashboard-layout';
import {
  Building,
  Users,
  Activity,
  TrendingUp,
  Download,
  Upload,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Monitor,
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

interface AdminStats {
  totalTests: number;
  testsToday: number;
  officesCount: number;
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

interface ComplianceSummary {
  totalOffices: number;
  fullyCompliantOffices: number;
  partiallyCompliantOffices: number;
  nonCompliantOffices: number;
  overallCompliancePercentage: number;
}

interface Office {
  id: string;
  unitOffice: string;
  subUnitOffice?: string;
  location: string;
  isp: string;
  isps?: string; // JSON string containing array of all ISPs
  sectionISPs?: string; // JSON string containing section-specific ISP configuration
  _count: {
    speedTests: number;
    users: number;
  };
}

export default function AdminDashboard() {
  const { data: session } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [compliance, setCompliance] = useState<ComplianceSummary | null>(null);
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session?.user?.role !== 'ADMIN') {
      router.push('/dashboard');
      return;
    }
    fetchAdminData();
  }, [session, router]);
  const fetchAdminData = async () => {
    try {
      const [statsResponse, officesResponse, complianceResponse] = await Promise.all([
        fetch('/api/dashboard/stats?days=30'),
        fetch('/api/offices'),
        fetch('/api/monitoring'),
      ]);

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }      if (officesResponse.ok) {
        const officesData = await officesResponse.json();
        setOffices(officesData.offices);
      }

      if (complianceResponse.ok) {
        const complianceData = await complianceResponse.json();
        setCompliance(complianceData.summary);
      }
    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setLoading(false);
    }
  };  // Helper function to get all ISPs for an office
  const getOfficeISPs = (office: Office) => {
    const allISPs = new Set<string>();

    // Parse the isps JSON field (primary source)
    if (office.isps && office.isps.trim()) {
      try {
        const parsed = JSON.parse(office.isps);
        if (Array.isArray(parsed) && parsed.length > 0) {
          parsed.forEach(isp => {
            if (isp && typeof isp === 'string' && isp.trim()) {
              allISPs.add(isp.trim());
            }
          });
        }
      } catch (e) {
        console.warn('Error parsing primary ISPs for office:', office.id, e);
      }
    }

    // Add section-specific ISPs with better error handling
    if (office.sectionISPs && office.sectionISPs.trim()) {
      try {
        // Sanitize the JSON string
        let sanitizedJson = office.sectionISPs.trim().replace(/^\uFEFF/, '');
        const sectionData = JSON.parse(sanitizedJson);
          if (sectionData && typeof sectionData === 'object' && !Array.isArray(sectionData)) {
          Object.entries(sectionData).forEach(([sectionName, isps]: [string, any]) => {
            // Filter out corrupted section names (empty strings, pure numbers)
            const isValidSection = sectionName && 
                                  sectionName.trim() !== '' && 
                                  !(/^\d+$/.test(sectionName));
            
            if (isValidSection && Array.isArray(isps)) {
              isps.forEach(isp => {
                if (isp && typeof isp === 'string' && isp.trim()) {
                  allISPs.add(isp.trim());
                }
              });
            }
          });
        } else if (Array.isArray(sectionData)) {
          // Handle case where section data is mistakenly an array
          console.warn('Section ISPs is an array instead of object for office:', office.id);
          sectionData.forEach(isp => {
            if (isp && typeof isp === 'string' && isp.trim()) {
              allISPs.add(isp.trim());
            }
          });
        }
      } catch (error) {
        console.error('Error parsing section ISPs for office:', office.id, error);
        console.error('Raw section ISPs data:', office.sectionISPs);
      }
    }

    return Array.from(allISPs);
  };  // Helper function to get section-specific ISP summary
  const getSectionISPSummary = (office: Office) => {
    if (!office.sectionISPs || office.sectionISPs.trim() === '') return null;

    try {
      // Handle potential corrupted data by sanitizing the JSON string
      let sanitizedJson = office.sectionISPs.trim();
      
      // Remove any potential BOM or invisible characters
      sanitizedJson = sanitizedJson.replace(/^\uFEFF/, '');
      
      const sectionData = JSON.parse(sanitizedJson);
        // Ensure sectionData is a valid object and not an array
      if (!sectionData || typeof sectionData !== 'object' || Array.isArray(sectionData)) {
        console.warn('Invalid section data structure for office:', office.id, sectionData);
        return null;
      }
      
      // Filter out corrupted/invalid section names
      const validSections = Object.entries(sectionData).filter(([sectionName, isps]) => {
        // Filter out empty strings, pure numbers, and invalid section names
        const isValidName = sectionName && 
                           sectionName.trim() !== '' && 
                           !(/^\d+$/.test(sectionName)) && // Remove pure numeric keys like "0", "1", "2"
                           sectionName.length > 0;
        
        const hasValidISPs = Array.isArray(isps) && isps.length > 0 &&
                           isps.some(isp => isp && typeof isp === 'string' && isp.trim() !== '');
        
        return isValidName && hasValidISPs;
      });
      
      // Check for corruption warning
      const totalKeys = Object.keys(sectionData).length;
      const hasCorruption = totalKeys > validSections.length || 
                           Object.keys(sectionData).some(key => /^\d+$/.test(key) || key.trim() === '');
      
      const sectionCount = validSections.length;
      const totalSectionISPs = validSections.reduce((total: number, [, isps]: [string, any]) => {
        if (!Array.isArray(isps)) return total;
        return total + isps.filter(isp => isp && typeof isp === 'string' && isp.trim() !== '').length;
      }, 0);

      // Return even if count is 0 to indicate sections exist but might be corrupted
      return { 
        sectionCount, 
        totalSectionISPs,
        hasData: sectionCount > 0 || Object.keys(sectionData).length > 0,
        corrupted: hasCorruption
      };
    } catch (error) {
      console.error('Error parsing section ISPs for office:', office.id, error);
      console.error('Raw sectionISPs data:', office.sectionISPs);
      
      // Try to recover by checking if it's a simple array instead of object
      try {
        const fallbackData = JSON.parse(office.sectionISPs);
        if (Array.isArray(fallbackData)) {
          console.warn('Found array instead of object for section ISPs, converting...');
          return { 
            sectionCount: 1, 
            totalSectionISPs: fallbackData.length,
            hasData: fallbackData.length > 0,
            corrupted: true
          };
        }
      } catch (fallbackError) {
        console.error('Fallback parsing also failed:', fallbackError);
      }
      
      return null;
    }
  };

  if (session?.user?.role !== 'ADMIN') {
    return null;
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading admin dashboard...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Admin Dashboard</h2>
          <p className="text-gray-600 mt-1">Monitor speed test performance across all offices</p>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="stat-card">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Building className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="stat-label">Total Offices</p>
                  <p className="stat-value">{stats.officesCount}</p>
                </div>
              </div>
            </div>
            <div className="stat-card">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Activity className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="stat-label">Total Tests</p>
                  <p className="stat-value">{stats.totalTests}</p>
                </div>
              </div>
            </div>
            <div className="stat-card">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="stat-label">Tests Today</p>
                  <p className="stat-value">{stats.testsToday}</p>
                </div>
              </div>
            </div>
            <div className="stat-card">
              <div className="flex items-center">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Download className="h-6 w-6 text-orange-600" />
                </div>
                <div className="ml-4">
                  <p className="stat-label">Avg Download</p>
                  <p className="stat-value">{stats.averageDownload} Mbps</p>
                </div>
              </div>
            </div>{' '}
          </div>
        )}

        {/* Daily Compliance Overview */}
        {compliance && (
          <div className="card">
            <div className="card-header flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Today's Test Compliance</h3>
                <p className="text-sm text-gray-600">
                  Offices must complete 3 tests daily (Morning, Noon, Afternoon)
                </p>
              </div>
              <Link
                href="/admin/monitoring"
                className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Monitor className="h-4 w-4" />
                View Details
              </Link>
            </div>
            <div className="card-content">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                <div className="text-center">
                  <div className="p-3 bg-green-100 rounded-lg inline-block mb-3">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  </div>
                  <p className="stat-label">Fully Compliant</p>
                  <p className="text-2xl font-bold text-green-600">
                    {compliance.fullyCompliantOffices}
                  </p>
                  <p className="text-sm text-gray-500">3/3 slots completed</p>
                </div>

                <div className="text-center">
                  <div className="p-3 bg-yellow-100 rounded-lg inline-block mb-3">
                    <AlertTriangle className="h-8 w-8 text-yellow-600" />
                  </div>
                  <p className="stat-label">Partial Compliance</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {compliance.partiallyCompliantOffices}
                  </p>
                  <p className="text-sm text-gray-500">1-2 slots completed</p>
                </div>

                <div className="text-center">
                  <div className="p-3 bg-red-100 rounded-lg inline-block mb-3">
                    <XCircle className="h-8 w-8 text-red-600" />
                  </div>
                  <p className="stat-label">Non-Compliant</p>
                  <p className="text-2xl font-bold text-red-600">
                    {compliance.nonCompliantOffices}
                  </p>
                  <p className="text-sm text-gray-500">0 slots completed</p>
                </div>

                <div className="text-center">
                  <div className="p-3 bg-blue-100 rounded-lg inline-block mb-3">
                    <TrendingUp className="h-8 w-8 text-blue-600" />
                  </div>
                  <p className="stat-label">Overall Compliance</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {compliance.overallCompliancePercentage}%
                  </p>
                  <p className="text-sm text-gray-500">of {compliance.totalOffices} offices</p>
                </div>
              </div>

              {/* Quick compliance bar */}
              <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                <div
                  className="bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 h-3 rounded-full transition-all duration-300"
                  style={{
                    width: `${compliance.overallCompliancePercentage}%`,
                  }}
                ></div>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>0%</span>
                <span className="font-medium">
                  {compliance.overallCompliancePercentage}% Overall Compliance
                </span>
                <span>100%</span>
              </div>
            </div>
          </div>
        )}

        {/* Performance Metrics */}
        {stats && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="stat-card text-center">
              <div className="p-3 bg-blue-100 rounded-lg inline-block mb-3">
                <Download className="h-8 w-8 text-blue-600" />
              </div>
              <p className="stat-label">Network Average Download</p>
              <p className="text-3xl font-bold text-blue-600">{stats.averageDownload}</p>
              <p className="text-sm text-gray-500">Mbps</p>
            </div>

            <div className="stat-card text-center">
              <div className="p-3 bg-green-100 rounded-lg inline-block mb-3">
                <Upload className="h-8 w-8 text-green-600" />
              </div>
              <p className="stat-label">Network Average Upload</p>
              <p className="text-3xl font-bold text-green-600">{stats.averageUpload}</p>
              <p className="text-sm text-gray-500">Mbps</p>
            </div>

            <div className="stat-card text-center">
              <div className="p-3 bg-orange-100 rounded-lg inline-block mb-3">
                <Clock className="h-8 w-8 text-orange-600" />
              </div>
              <p className="stat-label">Network Average Ping</p>
              <p className="text-3xl font-bold text-orange-600">{stats.averagePing}</p>
              <p className="text-sm text-gray-500">ms</p>
            </div>
          </div>
        )}

        {/* Charts */}
        {stats?.chartData && stats.chartData.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Network Performance Trends */}
            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-semibold text-gray-900">Network Performance Trends</h3>
              </div>
              <div className="card-content">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={stats.chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={value => format(new Date(value), 'MMM dd')}
                    />
                    <YAxis />
                    <Tooltip
                      labelFormatter={value => format(new Date(value), 'MMM dd, yyyy')}
                      formatter={(value: number, name: string) => [
                        `${value} ${name === 'ping' ? 'ms' : 'Mbps'}`,
                        name.charAt(0).toUpperCase() + name.slice(1),
                      ]}
                    />
                    <Line type="monotone" dataKey="download" stroke="#3B82F6" strokeWidth={2} />
                    <Line type="monotone" dataKey="upload" stroke="#10B981" strokeWidth={2} />
                    <Line type="monotone" dataKey="ping" stroke="#F59E0B" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Daily Test Volume */}
            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-semibold text-gray-900">Daily Test Volume</h3>
              </div>
              <div className="card-content">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={stats.chartData.slice(-14)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={value => format(new Date(value), 'MM/dd')}
                    />
                    <YAxis />
                    <Tooltip labelFormatter={value => format(new Date(value), 'MMM dd, yyyy')} />
                    <Bar dataKey="download" fill="#3B82F6" opacity={0.6} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Offices Overview */}
        <div className="card">
          {' '}
          <div className="card-header flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">Offices Overview</h3>
            <Link href="/admin/offices" className="btn-primary text-sm">
              Manage Offices
            </Link>
          </div>
          <div className="card-content">
            {offices.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">                {offices.map(office => {
                  const allISPs = getOfficeISPs(office);
                  const sectionSummary = getSectionISPSummary(office);

                  return (
                    <div
                      key={office.id}
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">
                            {office.unitOffice}
                            {office.subUnitOffice && (
                              <span className="text-gray-600 ml-1">- {office.subUnitOffice}</span>
                            )}
                          </h4>
                          <p className="text-sm text-gray-600">{office.location}</p>

                          {/* ISP Information */}
                          <div className="mt-2">
                            {allISPs.length > 0 ? (
                              <div className="space-y-1">
                                <div className="flex flex-wrap gap-1">
                                  {allISPs.slice(0, 3).map((isp, index) => (
                                    <span
                                      key={index}
                                      className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                                    >
                                      {isp}
                                    </span>
                                  ))}
                                  {allISPs.length > 3 && (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                      +{allISPs.length - 3} more
                                    </span>
                                  )}
                                </div>                                {sectionSummary && sectionSummary.hasData && (
                                  <p className="text-xs text-green-600">
                                    {sectionSummary.corrupted && (
                                      <span className="text-orange-600 mr-1">⚠️</span>
                                    )}
                                    Advanced: {sectionSummary.sectionCount} section(s),{' '}
                                    {sectionSummary.totalSectionISPs} total ISPs
                                    {sectionSummary.corrupted && (
                                      <span className="text-orange-600 ml-1">(needs repair)</span>
                                    )}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <p className="text-xs text-gray-500">No ISPs configured</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          <div className="text-lg font-bold text-blue-600">
                            {office._count.speedTests}
                          </div>
                          <div className="text-xs text-gray-500">tests</div>
                        </div>
                      </div>
                      <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                        <div className="flex items-center text-sm text-gray-600">
                          <Users className="h-4 w-4 mr-1" />
                          {office._count.users} users
                        </div>
                        <Link
                          href={`/admin/speedtests?office=${office.id}`}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          View Tests
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No offices found</p>
                <p className="text-sm text-gray-400 mt-1">
                  Add your first office to start monitoring
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
