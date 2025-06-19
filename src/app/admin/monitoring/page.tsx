'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '../../../components/dashboard-layout';
import { format } from 'date-fns';
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Calendar,
  TrendingUp,
  Filter,
  X,
  RefreshCw,
  Search,
  BarChart3,
  Activity,
  Wifi,
  WifiOff,
  Signal,
} from 'lucide-react';

// Unit and SubUnit mapping for filtering
const UNIT_SUBUNIT_MAPPING = {
  RMFB: ['RMFB HQ', 'TSC', '401st', '402nd', '403rd', '404th', '405th'],
  'Palawan PPO': [
    'Puerto Prinsesa CHQ',
    'Puerto Prinsesa CMFC',
    'Police Station 1 Mendoza',
    'Police Station 2 Irawan',
    'Police Station 3',
    'Police Station 4',
    'Police Station 5',
    'Palawan PHQ',
    '1st PMFC',
    '2nd PMFC',
    'Aborlan MPS',
    'Agutaya MPS',
    'Araceli MPS',
    'Balabac MPS',
    'Bataraza MPS',
    "Brooke's Point MPS",
    'Busuanga MPS',
    'Cagayancillo MPS',
    'Coron MPS',
    'Culion MPS',
    'Cuyo MPS',
    'Dumaran MPS',
    'El Nido MPS',
    'Española MPS',
    'Kalayaan MPS',
    'Linapacan MPS',
    'Magsaysay MPS',
    'Narra MPS',
    'Quezon MPS',
    'Rizal MPS',
    'Roxas MPS',
    'San Vicente MPS',
    'Taytay MPS',
  ],
  'Romblon PPO': [
    'Romblon PHQ',
    'Romblon PMFC',
    'Alcantara MPS',
    'Banton MPS',
    'Cajidiocan MPS',
    'Calatrava MPS',
    'Concepcion MPS',
    'Corcuera MPS',
    'Ferrol MPS',
    'Looc MPS',
    'Magdiwang MPS',
    'Odiongan MPS',
    'Romblon MPS',
    'San Agustin MPS',
    'San Andres MPS',
    'San Fernando MPS',
    'San Jose MPS',
    'Santa Fe MPS',
    'Santa Maria MPS',
  ],
  'Marinduque PPO': [
    '1st PMFP',
    '2nd PMFP',
    'Boac MPS',
    'Buenavista MPS',
    'Gasan MPS',
    'Mogpog MPS',
    'Santa Cruz MPS',
    'Torrijos MPS',
  ],
  'Occidental Mindoro PPO': [
    '1st PMFC',
    '2nd PMFC',
    'Abra de Ilog MPS',
    'Calintaan MPS',
    'Looc MPS',
    'Lubang MPS',
    'Magsaysay MPS',
    'Mamburao MPS',
    'Paluan MPS',
    'Rizal MPS',
    'Sablayan MPS',
    'San Jose MPS',
    'Santa Cruz MPS',
  ],
  'Oriental Mindoro PPO': [
    '1st PMFC',
    '2nd PMFC',
    'PTPU',
    'Calapan CPS',
    'Baco MPS',
    'Bansud MPS',
    'Bongabong MPS',
    'Bulalacao MPS',
    'Gloria MPS',
    'Mansalay MPS',
    'Naujan MPS',
    'Pinamalayan MPS',
    'Pola MPS',
    'Puerto Galera MPS',
    'Roxas MPS',
    'San Teodoro MPS',
    'Socorro MPS',
    'Victoria MPS',
  ],
  RHQ: [
    'ORD',
    'ORDA',
    'ODRDO',
    'OCRS',
    'RPRMD',
    'RID',
    'ROMD',
    'RLRDD',
    'RCADD',
    'RCD',
    'RIDMD',
    'RICTMD',
    'RLDDD',
    'RPSMD',
    'RHSU',
    'ORESPO',
    'RHRAO',
    'RPSMU',
    'RPIO',
  ],
} as const;

type UnitType = keyof typeof UNIT_SUBUNIT_MAPPING;

interface TestResult {
  id: string;
  timestamp: string;
  download: number;
  upload: number;
  ping: number;
  isp: string;
}

interface ISPCompliance {
  isp: string;
  compliance: {
    percentage: number;
    completedSlots: number;
    totalSlots: number;
  };
  tests: {
    morning: TestResult | null;
    noon: TestResult | null;
    afternoon: TestResult | null;
  };
  counts: {
    morning: number;
    noon: number;
    afternoon: number;
    total: number;
  };
}

interface OfficeMonitoring {
  office: {
    id: string;
    unitOffice: string;
    subUnitOffice?: string;
    location: string;
    isp: string;
    isps: string[];
  };
  compliance: {
    percentage: number;
    completedSlots: number;
    totalSlots: number;
  };
  ispCompliance: ISPCompliance[];
  counts: {
    total: number;
  };
}

interface MonitoringData {
  date: string;
  summary: {
    totalOffices: number;
    fullyCompliantOffices: number;
    partiallyCompliantOffices: number;
    nonCompliantOffices: number;
    overallCompliancePercentage: number;
  };
  offices: OfficeMonitoring[];
  timeSlots: {
    morning: { label: string; window: string };
    noon: { label: string; window: string };
    afternoon: { label: string; window: string };
  };
}

export default function MonitoringPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [monitoringData, setMonitoringData] = useState<MonitoringData | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedUnit, setSelectedUnit] = useState<UnitType | ''>('');
  const [selectedSubUnit, setSelectedSubUnit] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get available subunits based on selected unit
  const availableSubUnits = selectedUnit ? UNIT_SUBUNIT_MAPPING[selectedUnit] : [];
  useEffect(() => {
    if (status === 'loading') return;

    if (!session) {
      router.push('/auth/signin');
      return;
    }

    if (session.user?.role !== 'ADMIN') {
      router.push('/dashboard');
      return;
    }

    fetchMonitoringData();
  }, [session, status, selectedDate, selectedUnit, selectedSubUnit, router]);

  const fetchMonitoringData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append('date', selectedDate);
      if (selectedUnit) params.append('unit', selectedUnit);
      if (selectedSubUnit) params.append('subunit', selectedSubUnit);

      const response = await fetch(`/api/monitoring?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch monitoring data');
      }
      const data = await response.json();
      setMonitoringData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load monitoring data');
    } finally {
      setLoading(false);
    }
  };

  const handleUnitChange = (unit: UnitType | '') => {
    setSelectedUnit(unit);
    setSelectedSubUnit(''); // Reset subunit when unit changes
  };

  const clearFilters = () => {
    setSelectedUnit('');
    setSelectedSubUnit('');
  };

  const getComplianceColor = (percentage: number) => {
    if (percentage === 100) return 'text-green-600 bg-green-50';
    if (percentage >= 67) return 'text-yellow-600 bg-yellow-50';
    if (percentage > 0) return 'text-orange-600 bg-orange-50';
    return 'text-red-600 bg-red-50';
  };

  const getComplianceIcon = (percentage: number) => {
    if (percentage === 100) return <CheckCircle className="h-5 w-5 text-green-600" />;
    if (percentage > 0) return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
    return <XCircle className="h-5 w-5 text-red-600" />;
  };

  const formatTestResult = (test: TestResult | null) => {
    if (!test) return { display: 'Not Conducted', className: 'text-red-600' };
    return {
      display: `${format(new Date(test.timestamp), 'h:mm a')} | ${test.download.toFixed(1)}↓ ${test.upload.toFixed(1)}↑ ${test.ping.toFixed(0)}ms`,
      className: 'text-green-600',
    };
  };
  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
          <div className="text-center">
            <div className="relative">
              <div className="w-20 h-20 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
              <div
                className="absolute inset-0 w-20 h-20 border-4 border-transparent border-t-blue-400 rounded-full animate-spin mx-auto"
                style={{ animationDirection: 'reverse', animationDuration: '1s' }}
              ></div>
            </div>
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Loading Monitoring Data</h3>
              <p className="text-gray-600">Fetching speed test compliance information...</p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }
  if (error) {
    return (
      <DashboardLayout>
        <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-2xl border border-red-200 p-8 max-w-md w-full mx-4">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <XCircle className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-red-800 mb-2">Error Loading Data</h3>
              <p className="text-red-600 mb-6 text-sm">{error}</p>
              <button
                onClick={fetchMonitoringData}
                className="w-full flex items-center justify-center gap-2 bg-red-600 text-white px-6 py-3 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors duration-200"
              >
                <RefreshCw className="h-4 w-4" />
                Try Again
              </button>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }
  if (!monitoringData) {
    return (
      <DashboardLayout>
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
          <div className="text-center">
            <div className="w-24 h-24 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center mx-auto mb-4">
              <Activity className="h-12 w-12 text-gray-500" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Data Available</h3>
            <p className="text-gray-600">Unable to load monitoring information at this time.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }
  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
        <div className="space-y-8 p-6">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-6 text-white shadow-lg">
            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Activity className="h-8 w-8" />
                  <h1 className="text-3xl font-bold">Daily Speed Test Monitoring</h1>
                </div>
                <p className="text-blue-100 text-lg">
                  Monitor office compliance with required daily speed tests (3x per day)
                </p>
                <div className="flex items-center gap-4 mt-3 text-sm text-blue-100">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span>Last updated: {format(new Date(), 'h:mm a')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>Today: {format(new Date(), 'MMMM dd, yyyy')}</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg text-sm hover:bg-white/20 transition-all duration-200"
                >
                  <Filter className="h-4 w-4" />
                  Filters
                  {(selectedUnit || selectedSubUnit) && (
                    <span className="ml-1 px-2 py-0.5 bg-yellow-400 text-yellow-900 text-xs rounded-full font-medium">
                      {selectedUnit ? (selectedSubUnit ? '2' : '1') : '0'}
                    </span>
                  )}
                </button>
                <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg px-3 py-2">
                  <Calendar className="h-4 w-4" />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                    className="bg-transparent text-white placeholder-blue-100 border-none text-sm focus:outline-none focus:ring-0"
                  />
                </div>{' '}
                <button
                  onClick={fetchMonitoringData}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-white text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-50 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-all duration-200"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  {loading ? 'Loading...' : 'Refresh'}
                </button>
              </div>
            </div>
          </div>
          {/* Filter Panel */}
          {showFilters && (
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden animate-fade-in">
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Search className="h-5 w-5 text-gray-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Advanced Filters</h3>
                  </div>
                  <button
                    onClick={() => setShowFilters(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-200 rounded-full"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">Unit</label>
                    <select
                      value={selectedUnit}
                      onChange={e => handleUnitChange(e.target.value as UnitType | '')}
                      disabled={loading}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed transition-all duration-200 bg-white"
                    >
                      <option value="">🏢 All Units</option>
                      {Object.keys(UNIT_SUBUNIT_MAPPING).map(unit => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">Sub Unit</label>
                    <select
                      value={selectedSubUnit}
                      onChange={e => setSelectedSubUnit(e.target.value)}
                      disabled={!selectedUnit || loading}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed transition-all duration-200 bg-white"
                    >
                      <option value="">🏬 All Sub Units</option>
                      {availableSubUnits.map(subUnit => (
                        <option key={subUnit} value={subUnit}>
                          {subUnit}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={clearFilters}
                      disabled={(!selectedUnit && !selectedSubUnit) || loading}
                      className="w-full px-4 py-3 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:text-gray-900 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed transition-all duration-200"
                    >
                      🗑️ Clear Filters
                    </button>
                  </div>
                </div>
                {(selectedUnit || selectedSubUnit) && (
                  <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                    <div className="flex items-start gap-3">
                      <Filter className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-blue-900 mb-1">Active Filters</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedUnit && (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              Unit: {selectedUnit}
                            </span>
                          )}
                          {selectedSubUnit && (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                              Sub Unit: {selectedSubUnit}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          {/* Time Slot Information */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <Clock className="h-6 w-6 text-gray-600" />
                <h3 className="text-lg font-semibold text-gray-900">Required Testing Windows</h3>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="relative">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200 hover:shadow-md transition-shadow duration-200">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                        <Activity className="h-5 w-5 text-white" />
                      </div>
                      <h4 className="font-semibold text-blue-900 text-lg">Morning</h4>
                    </div>
                    <p className="text-blue-700 font-medium">
                      {monitoringData.timeSlots.morning.window}
                    </p>
                    <p className="text-xs text-blue-600 mt-2">Peak business hours</p>
                  </div>
                </div>
                <div className="relative">
                  <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200 hover:shadow-md transition-shadow duration-200">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                        <Wifi className="h-5 w-5 text-white" />
                      </div>
                      <h4 className="font-semibold text-green-900 text-lg">Noon</h4>
                    </div>
                    <p className="text-green-700 font-medium">
                      {monitoringData.timeSlots.noon.window}
                    </p>
                    <p className="text-xs text-green-600 mt-2">Lunch hour check</p>
                  </div>
                </div>
                <div className="relative">
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border border-purple-200 hover:shadow-md transition-shadow duration-200">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
                        <Signal className="h-5 w-5 text-white" />
                      </div>
                      <h4 className="font-semibold text-purple-900 text-lg">Afternoon</h4>
                    </div>
                    <p className="text-purple-700 font-medium">
                      {monitoringData.timeSlots.afternoon.window}
                    </p>
                    <p className="text-xs text-purple-600 mt-2">End of day validation</p>
                  </div>
                </div>
              </div>
            </div>
          </div>{' '}
          {/* Office Monitoring Table */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <BarChart3 className="h-6 w-6 text-gray-600" />
                    <h3 className="text-lg font-semibold text-gray-900">
                      Office Compliance Details
                    </h3>
                  </div>
                  <p className="text-sm text-gray-600">
                    Showing test results for {format(new Date(selectedDate), 'MMMM dd, yyyy')}
                    {selectedUnit && ` - Unit: ${selectedUnit}`}
                    {selectedSubUnit && ` - Sub Unit: ${selectedSubUnit}`}
                    {monitoringData.offices.length > 0 && (
                      <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {monitoringData.offices.length} office
                        {monitoringData.offices.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </p>
                </div>
                {monitoringData.offices.length === 0 && (selectedUnit || selectedSubUnit) && (
                  <div className="text-sm text-gray-500 bg-gray-100 px-3 py-2 rounded-lg">
                    No offices found matching the selected filters
                  </div>
                )}
              </div>
            </div>{' '}
            <div className="overflow-hidden">
              {monitoringData.offices.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          <div className="flex items-center gap-2">
                            <Activity className="h-4 w-4" />
                            Office
                          </div>
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          <div className="flex items-center gap-2">
                            <BarChart3 className="h-4 w-4" />
                            Overall Compliance
                          </div>
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          <div className="flex items-center gap-2">
                            <Signal className="h-4 w-4" />
                            ISP Details
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {monitoringData.offices.map((officeData, index) => {
                        return (
                          <tr
                            key={officeData.office.id}
                            className={`hover:bg-gray-50 transition-colors duration-150 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-25'}`}
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-3">
                                <div className="flex-shrink-0">
                                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                                    <Activity className="h-5 w-5 text-white" />
                                  </div>
                                </div>
                                <div>
                                  <div className="text-sm font-semibold text-gray-900">
                                    {officeData.office.unitOffice}
                                    {officeData.office.subUnitOffice && (
                                      <span className="text-gray-600 ml-2 font-normal">
                                        - {officeData.office.subUnitOffice}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-sm text-gray-500 flex items-center gap-1">
                                    <span>📍</span>
                                    {officeData.office.location}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-3">
                                {getComplianceIcon(officeData.compliance.percentage)}
                                <div>
                                  <span
                                    className={`inline-flex items-center px-3 py-1 text-sm font-semibold rounded-full ${getComplianceColor(officeData.compliance.percentage)}`}
                                  >
                                    {officeData.compliance.percentage}%
                                  </span>
                                  <div className="text-xs text-gray-500 mt-1">
                                    {officeData.compliance.completedSlots}/
                                    {officeData.compliance.totalSlots} slots
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="space-y-4">
                                {officeData.ispCompliance.map(ispData => {
                                  const morningResult = formatTestResult(ispData.tests.morning);
                                  const noonResult = formatTestResult(ispData.tests.noon);
                                  const afternoonResult = formatTestResult(ispData.tests.afternoon);

                                  return (
                                    <div
                                      key={ispData.isp}
                                      className="border border-gray-200 rounded-xl p-4 bg-gradient-to-br from-gray-50 to-white hover:shadow-md transition-shadow duration-200"
                                    >
                                      <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                          <Wifi className="h-4 w-4 text-gray-600" />
                                          <span className="font-semibold text-sm text-gray-900">
                                            {ispData.isp}
                                          </span>
                                        </div>
                                        <span
                                          className={`inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full ${getComplianceColor(ispData.compliance.percentage)}`}
                                        >
                                          {ispData.compliance.percentage}% (
                                          {ispData.compliance.completedSlots}/3)
                                        </span>
                                      </div>
                                      <div className="grid grid-cols-3 gap-3 text-xs">
                                        <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                                          <div className="flex items-center gap-1 font-semibold text-blue-800 mb-2">
                                            <Activity className="h-3 w-3" />
                                            Morning
                                          </div>
                                          <div className={`font-medium ${morningResult.className}`}>
                                            {morningResult.display}
                                          </div>
                                          {ispData.counts.morning > 1 && (
                                            <div className="text-blue-600 mt-1 text-xs">
                                              +{ispData.counts.morning - 1} more tests
                                            </div>
                                          )}
                                        </div>
                                        <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                                          <div className="flex items-center gap-1 font-semibold text-green-800 mb-2">
                                            <Wifi className="h-3 w-3" />
                                            Noon
                                          </div>
                                          <div className={`font-medium ${noonResult.className}`}>
                                            {noonResult.display}
                                          </div>
                                          {ispData.counts.noon > 1 && (
                                            <div className="text-green-600 mt-1 text-xs">
                                              +{ispData.counts.noon - 1} more tests
                                            </div>
                                          )}
                                        </div>
                                        <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                                          <div className="flex items-center gap-1 font-semibold text-purple-800 mb-2">
                                            <Signal className="h-3 w-3" />
                                            Afternoon
                                          </div>
                                          <div
                                            className={`font-medium ${afternoonResult.className}`}
                                          >
                                            {afternoonResult.display}
                                          </div>
                                          {ispData.counts.afternoon > 1 && (
                                            <div className="text-purple-600 mt-1 text-xs">
                                              +{ispData.counts.afternoon - 1} more tests
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-16">
                  <div className="text-gray-500">
                    <div className="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center">
                      <WifiOff className="h-12 w-12 text-gray-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">No offices found</h3>
                    <p className="text-sm max-w-md mx-auto">
                      {selectedUnit || selectedSubUnit
                        ? 'No offices match your current filter criteria. Try adjusting your filters or selecting a different date.'
                        : 'No offices are available for the selected date. This might be a system configuration issue.'}
                    </p>
                    {(selectedUnit || selectedSubUnit) && (
                      <button
                        onClick={clearFilters}
                        className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors duration-200"
                      >
                        <Filter className="h-4 w-4" />
                        Clear All Filters
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
