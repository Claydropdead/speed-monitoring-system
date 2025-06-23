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
  ChevronDown,
  ChevronUp,
  List,
  Grid,
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
  const [expandedOffices, setExpandedOffices] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'table' | 'list'>('list');

  // Add custom styles for animations
  const customStyles = `
    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    @keyframes slideInFromTop {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    .animate-in {
      animation: slideInFromTop 0.3s ease-out forwards;
    }
    
    .slide-in-from-top {
      animation-name: slideInFromTop;
    }
  `;

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

  const toggleOfficeExpansion = (officeId: string) => {
    const newExpanded = new Set(expandedOffices);
    if (newExpanded.has(officeId)) {
      newExpanded.delete(officeId);
    } else {
      newExpanded.add(officeId);
    }
    setExpandedOffices(newExpanded);
  };

  const expandAllOffices = () => {
    if (monitoringData) {
      setExpandedOffices(new Set(monitoringData.offices.map(office => office.office.id)));
    }
  };

  const collapseAllOffices = () => {
    setExpandedOffices(new Set());
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
      <style dangerouslySetInnerHTML={{ __html: customStyles }} />
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
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            <div className="group bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-2xl hover:scale-105 transition-all duration-500 cursor-pointer">
              <div className="p-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-50/0 to-blue-100/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1 group-hover:text-blue-600 transition-colors duration-300">Total Offices</p>
                    <p className="text-3xl font-bold text-gray-900 group-hover:text-blue-800 group-hover:scale-110 transition-all duration-300">
                      {monitoringData.summary.totalOffices}
                    </p>
                  </div>
                  <div className="p-3 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl group-hover:from-blue-200 group-hover:to-blue-300 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                    <Activity className="h-8 w-8 text-blue-600 group-hover:text-blue-700" />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="group bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-2xl hover:scale-105 transition-all duration-500 cursor-pointer">
              <div className="p-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-green-50/0 to-green-100/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1 group-hover:text-green-600 transition-colors duration-300">Fully Compliant</p>
                    <p className="text-3xl font-bold text-green-600 group-hover:text-green-700 group-hover:scale-110 transition-all duration-300">
                      {monitoringData.summary.fullyCompliantOffices}
                    </p>
                    <p className="text-xs text-green-600 font-medium group-hover:text-green-700 transition-colors duration-300">100% Tests</p>
                  </div>
                  <div className="p-3 bg-gradient-to-br from-green-100 to-green-200 rounded-xl group-hover:from-green-200 group-hover:to-green-300 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                    <CheckCircle className="h-8 w-8 text-green-600 group-hover:text-green-700" />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="group bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-2xl hover:scale-105 transition-all duration-500 cursor-pointer">
              <div className="p-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-50/0 to-yellow-100/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1 group-hover:text-yellow-600 transition-colors duration-300">Partial Compliance</p>
                    <p className="text-3xl font-bold text-yellow-600 group-hover:text-yellow-700 group-hover:scale-110 transition-all duration-300">
                      {monitoringData.summary.partiallyCompliantOffices}
                    </p>
                    <p className="text-xs text-yellow-600 font-medium group-hover:text-yellow-700 transition-colors duration-300">Some Tests</p>
                  </div>
                  <div className="p-3 bg-gradient-to-br from-yellow-100 to-yellow-200 rounded-xl group-hover:from-yellow-200 group-hover:to-yellow-300 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                    <AlertTriangle className="h-8 w-8 text-yellow-600 group-hover:text-yellow-700" />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="group bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-2xl hover:scale-105 transition-all duration-500 cursor-pointer">
              <div className="p-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-red-50/0 to-red-100/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1 group-hover:text-red-600 transition-colors duration-300">Non-Compliant</p>
                    <p className="text-3xl font-bold text-red-600 group-hover:text-red-700 group-hover:scale-110 transition-all duration-300">
                      {monitoringData.summary.nonCompliantOffices}
                    </p>
                    <p className="text-xs text-red-600 font-medium group-hover:text-red-700 transition-colors duration-300">No Tests</p>
                  </div>
                  <div className="p-3 bg-gradient-to-br from-red-100 to-red-200 rounded-xl group-hover:from-red-200 group-hover:to-red-300 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                    <XCircle className="h-8 w-8 text-red-600 group-hover:text-red-700" />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="group bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg overflow-hidden hover:shadow-2xl hover:scale-105 hover:from-indigo-600 hover:to-purple-700 transition-all duration-500 cursor-pointer relative">
              <div className="absolute inset-0 bg-gradient-to-br from-white/0 to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="p-6 text-white relative">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-indigo-100 mb-1 group-hover:text-white transition-colors duration-300">Overall Rate</p>
                    <p className="text-3xl font-bold group-hover:scale-110 transition-transform duration-300">
                      {monitoringData.summary.overallCompliancePercentage}%
                    </p>
                    <p className="text-xs text-indigo-100 font-medium group-hover:text-white transition-colors duration-300">System Wide</p>
                  </div>
                  <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl group-hover:bg-white/30 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                    <TrendingUp className="h-8 w-8 text-white" />
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
                <div className="flex items-center gap-3">
                  {monitoringData.offices.length > 0 && (
                    <>
                      {/* View Mode Toggle */}
                      <div className="flex items-center bg-gray-100 rounded-lg p-1">
                        <button
                          onClick={() => setViewMode('list')}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                            viewMode === 'list'
                              ? 'bg-white text-gray-900 shadow-sm'
                              : 'text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          <List className="h-4 w-4" />
                          List
                        </button>
                        <button
                          onClick={() => setViewMode('table')}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                            viewMode === 'table'
                              ? 'bg-white text-gray-900 shadow-sm'
                              : 'text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          <Grid className="h-4 w-4" />
                          Table
                        </button>
                      </div>

                      {/* Expand/Collapse Controls */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={expandAllOffices}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                        >
                          <ChevronDown className="h-3 w-3" />
                          Expand All
                        </button>
                        <button
                          onClick={collapseAllOffices}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          <ChevronUp className="h-3 w-3" />
                          Collapse All
                        </button>
                      </div>
                    </>
                  )}
                  {monitoringData.offices.length === 0 && (selectedUnit || selectedSubUnit) && (
                    <div className="text-sm text-gray-500 bg-gray-100 px-3 py-2 rounded-lg">
                      No offices found matching the selected filters
                    </div>
                  )}
                </div>
              </div>
            </div>{' '}
            <div className="overflow-hidden">
              {monitoringData.offices.length > 0 ? (
                viewMode === 'list' ? (
                  /* List View */
                  <div className="divide-y divide-gray-200">
                    {monitoringData.offices.map((officeData, index) => {
                      const isExpanded = expandedOffices.has(officeData.office.id);
                      return (
                        <div
                          key={officeData.office.id}
                          className={`group transition-all duration-300 hover:shadow-lg ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} ${
                            isExpanded ? 'ring-2 ring-blue-200 shadow-lg' : ''
                          }`}
                        >
                          {/* Office Header - Always Visible */}
                          <div className="px-6 py-4 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-300 cursor-pointer relative overflow-hidden">
                            {/* Subtle background animation on hover */}
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-100/0 via-blue-100/20 to-blue-100/0 transform translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-in-out"></div>
                            
                            <div className="relative flex items-center justify-between">
                              <div className="flex items-center gap-4 flex-1">
                                <div className="flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl group-hover:from-blue-600 group-hover:to-blue-700 transition-all duration-300">
                                    <Activity className="h-6 w-6 text-white group-hover:scale-110 transition-transform duration-300" />
                                  </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex flex-col space-y-1">
                                    <h3 className="text-lg font-bold text-gray-900 truncate group-hover:text-blue-800 transition-colors duration-300">
                                      {officeData.office.unitOffice}
                                    </h3>
                                    {officeData.office.subUnitOffice && (
                                      <p className="text-sm font-medium text-blue-600 group-hover:text-blue-700 transition-colors duration-300">
                                        {officeData.office.subUnitOffice}
                                      </p>
                                    )}
                                    <div className="flex items-center gap-2 text-sm text-gray-500 group-hover:text-gray-700 transition-colors duration-300">
                                      <div className="w-2 h-2 bg-green-400 rounded-full group-hover:bg-green-500 group-hover:scale-125 transition-all duration-300"></div>
                                      <span className="truncate">{officeData.office.location}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-gray-400 group-hover:text-gray-600 transition-colors duration-300">
                                      <Wifi className="h-3 w-3 group-hover:text-blue-500 transition-colors duration-300" />
                                      <span>{officeData.office.isps.length} ISP{officeData.office.isps.length !== 1 ? 's' : ''} configured</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Compliance Status */}
                              <div className="flex items-center gap-4 mr-4 group-hover:scale-105 transition-transform duration-300">
                                <div className="text-center">
                                  <div className="flex items-center gap-2 mb-1">
                                    <div className="group-hover:scale-110 transition-transform duration-300">
                                      {getComplianceIcon(officeData.compliance.percentage)}
                                    </div>
                                    <span
                                      className={`inline-flex items-center px-4 py-2 text-lg font-bold rounded-xl ${getComplianceColor(officeData.compliance.percentage)} shadow-sm group-hover:shadow-md transition-shadow duration-300`}
                                    >
                                      {officeData.compliance.percentage}%
                                    </span>
                                  </div>
                                  <div className="text-xs text-gray-600 font-medium group-hover:text-gray-800 transition-colors duration-300">
                                    {officeData.compliance.completedSlots}/{officeData.compliance.totalSlots} completed
                                  </div>
                                </div>
                              </div>

                              {/* Expand Button */}
                              <button
                                onClick={() => toggleOfficeExpansion(officeData.office.id)}
                                className="flex items-center justify-center w-10 h-10 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all duration-300 group-hover:scale-110 hover:shadow-md"
                              >
                                {isExpanded ? (
                                  <ChevronUp className="h-5 w-5 text-gray-600 hover:text-blue-600 transition-colors duration-300" />
                                ) : (
                                  <ChevronDown className="h-5 w-5 text-gray-600 hover:text-blue-600 transition-colors duration-300" />
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Expanded ISP Details */}
                          {isExpanded && (
                            <div className="px-6 pb-6 bg-gradient-to-br from-gray-50/50 to-blue-50/30 border-t border-gray-200 animate-in slide-in-from-top duration-300">
                              <div className="grid grid-cols-1 gap-4 mt-4">
                                {officeData.ispCompliance.map((ispData, ispIndex) => {
                                  const morningResult = formatTestResult(ispData.tests.morning);
                                  const noonResult = formatTestResult(ispData.tests.noon);
                                  const afternoonResult = formatTestResult(ispData.tests.afternoon);

                                  return (
                                    <div
                                      key={ispData.isp}
                                      className="group bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all duration-500 hover:scale-[1.02] relative overflow-hidden"
                                      style={{ 
                                        animationDelay: `${ispIndex * 100}ms`,
                                        animation: `fadeInUp 0.6s ease-out forwards ${ispIndex * 100}ms`
                                      }}
                                    >
                                      {/* Subtle background gradient on hover */}
                                      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/0 via-blue-50/30 to-indigo-50/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                                      
                                      {/* ISP Header */}
                                      <div className="relative flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-3 group-hover:scale-105 transition-transform duration-300">
                                          <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg group-hover:from-blue-600 group-hover:to-blue-700 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                                            <Wifi className="h-5 w-5 text-white group-hover:scale-110 transition-transform duration-300" />
                                          </div>
                                          <div>
                                            <h4 className="font-bold text-gray-900 text-base group-hover:text-blue-800 transition-colors duration-300">
                                              {ispData.isp}
                                            </h4>
                                            <p className="text-xs text-gray-500 group-hover:text-blue-600 transition-colors duration-300">
                                              Internet Service Provider
                                            </p>
                                          </div>
                                        </div>
                                        <div className="text-right group-hover:scale-105 transition-transform duration-300">
                                          <span
                                            className={`inline-flex items-center px-4 py-2 text-sm font-bold rounded-xl ${getComplianceColor(ispData.compliance.percentage)} shadow-sm group-hover:shadow-lg transition-shadow duration-300`}
                                          >
                                            {ispData.compliance.percentage}%
                                          </span>
                                          <p className="text-xs text-gray-500 mt-1 group-hover:text-gray-700 transition-colors duration-300">
                                            {ispData.compliance.completedSlots}/3 tests completed
                                          </p>
                                        </div>
                                      </div>

                                      {/* Test Results Grid */}
                                      <div className="relative grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {/* Morning Test */}
                                        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200 group-hover:shadow-lg group-hover:border-blue-300 hover:scale-105 transition-all duration-300">
                                          <div className="flex items-center gap-2 mb-3">
                                            <div className="p-1.5 bg-blue-500 rounded-lg hover:bg-blue-600 hover:scale-110 transition-all duration-300">
                                              <Activity className="h-4 w-4 text-white" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                              <h5 className="font-bold text-blue-800 text-sm truncate hover:text-blue-900 transition-colors duration-300">Morning</h5>
                                              <p className="text-xs text-blue-600 truncate hover:text-blue-700 transition-colors duration-300">
                                                {monitoringData.timeSlots.morning.window}
                                              </p>
                                            </div>
                                          </div>
                                          <div className="space-y-2">
                                            <div className={`font-semibold text-sm ${morningResult.className} leading-relaxed break-words hover:scale-105 transition-transform duration-300`}>
                                              {morningResult.display}
                                            </div>
                                            {ispData.counts.morning > 1 && (
                                              <div className="flex items-center gap-1 text-blue-600 text-xs hover:text-blue-700 transition-colors duration-300">
                                                <BarChart3 className="h-3 w-3 flex-shrink-0 hover:scale-110 transition-transform duration-300" />
                                                <span>+{ispData.counts.morning - 1} additional tests</span>
                                              </div>
                                            )}
                                          </div>
                                        </div>

                                        {/* Noon Test */}
                                        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200 group-hover:shadow-lg group-hover:border-green-300 hover:scale-105 transition-all duration-300">
                                          <div className="flex items-center gap-2 mb-3">
                                            <div className="p-1.5 bg-green-500 rounded-lg hover:bg-green-600 hover:scale-110 transition-all duration-300">
                                              <Wifi className="h-4 w-4 text-white" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                              <h5 className="font-bold text-green-800 text-sm truncate hover:text-green-900 transition-colors duration-300">Noon</h5>
                                              <p className="text-xs text-green-600 truncate hover:text-green-700 transition-colors duration-300">
                                                {monitoringData.timeSlots.noon.window}
                                              </p>
                                            </div>
                                          </div>
                                          <div className="space-y-2">
                                            <div className={`font-semibold text-sm ${noonResult.className} leading-relaxed break-words hover:scale-105 transition-transform duration-300`}>
                                              {noonResult.display}
                                            </div>
                                            {ispData.counts.noon > 1 && (
                                              <div className="flex items-center gap-1 text-green-600 text-xs hover:text-green-700 transition-colors duration-300">
                                                <BarChart3 className="h-3 w-3 flex-shrink-0 hover:scale-110 transition-transform duration-300" />
                                                <span>+{ispData.counts.noon - 1} additional tests</span>
                                              </div>
                                            )}
                                          </div>
                                        </div>

                                        {/* Afternoon Test */}
                                        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200 group-hover:shadow-lg group-hover:border-purple-300 hover:scale-105 transition-all duration-300">
                                          <div className="flex items-center gap-2 mb-3">
                                            <div className="p-1.5 bg-purple-500 rounded-lg hover:bg-purple-600 hover:scale-110 transition-all duration-300">
                                              <Signal className="h-4 w-4 text-white" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                              <h5 className="font-bold text-purple-800 text-sm truncate hover:text-purple-900 transition-colors duration-300">Afternoon</h5>
                                              <p className="text-xs text-purple-600 truncate hover:text-purple-700 transition-colors duration-300">
                                                {monitoringData.timeSlots.afternoon.window}
                                              </p>
                                            </div>
                                          </div>
                                          <div className="space-y-2">
                                            <div className={`font-semibold text-sm ${afternoonResult.className} leading-relaxed break-words hover:scale-105 transition-transform duration-300`}>
                                              {afternoonResult.display}
                                            </div>
                                            {ispData.counts.afternoon > 1 && (
                                              <div className="flex items-center gap-1 text-purple-600 text-xs hover:text-purple-700 transition-colors duration-300">
                                                <BarChart3 className="h-3 w-3 flex-shrink-0 hover:scale-110 transition-transform duration-300" />
                                                <span>+{ispData.counts.afternoon - 1} additional tests</span>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Table View */
                  <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gradient-to-r from-slate-100 to-gray-100 border-b-2 border-gray-200">
                        <tr>
                          <th className="px-6 py-5 text-left text-sm font-bold text-gray-700 uppercase tracking-wider min-w-[300px]">
                            <div className="flex items-center gap-3">
                              <Activity className="h-5 w-5 text-blue-600" />
                              <span>Office Information</span>
                            </div>
                          </th>
                          <th className="px-6 py-5 text-left text-sm font-bold text-gray-700 uppercase tracking-wider min-w-[200px]">
                            <div className="flex items-center gap-3">
                              <BarChart3 className="h-5 w-5 text-green-600" />
                              <span>Compliance Status</span>
                            </div>
                          </th>
                          <th className="px-6 py-5 text-left text-sm font-bold text-gray-700 uppercase tracking-wider min-w-[800px]">
                            <div className="flex items-center gap-3">
                              <Signal className="h-5 w-5 text-purple-600" />
                              <span>ISP Test Results</span>
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y-2 divide-gray-100">
                        {monitoringData.offices.map((officeData, index) => {
                          return (
                            <tr
                              key={officeData.office.id}
                              className={`hover:bg-slate-50 transition-all duration-200 border-b border-gray-100 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                            >
                              <td className="px-6 py-6 whitespace-nowrap">
                                <div className="flex items-center gap-4">
                                  <div className="flex-shrink-0">
                                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                                      <Activity className="h-6 w-6 text-white" />
                                    </div>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex flex-col space-y-1">
                                      <h3 className="text-base font-bold text-gray-900 truncate">
                                        {officeData.office.unitOffice}
                                      </h3>
                                      {officeData.office.subUnitOffice && (
                                        <p className="text-sm font-medium text-blue-600">
                                          {officeData.office.subUnitOffice}
                                        </p>
                                      )}
                                      <div className="flex items-center gap-2 text-sm text-gray-500">
                                        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                                        <span className="truncate">{officeData.office.location}</span>
                                      </div>
                                      <div className="flex items-center gap-2 text-xs text-gray-400">
                                        <Wifi className="h-3 w-3" />
                                        <span>{officeData.office.isps.length} ISP{officeData.office.isps.length !== 1 ? 's' : ''} configured</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-6 whitespace-nowrap">
                                <div className="flex items-center gap-4">
                                  <div className="flex-shrink-0">
                                    {getComplianceIcon(officeData.compliance.percentage)}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2 mb-1">
                                      <span
                                        className={`inline-flex items-center px-4 py-2 text-lg font-bold rounded-xl ${getComplianceColor(officeData.compliance.percentage)} shadow-sm`}
                                      >
                                        {officeData.compliance.percentage}%
                                      </span>
                                    </div>
                                    <div className="text-sm text-gray-600 font-medium">
                                      {officeData.compliance.completedSlots} of {officeData.compliance.totalSlots} test slots completed
                                    </div>
                                    <div className="mt-2">
                                      <div className="w-24 bg-gray-200 rounded-full h-2">
                                        <div 
                                          className={`h-2 rounded-full ${
                                            officeData.compliance.percentage === 100 ? 'bg-green-500' :
                                            officeData.compliance.percentage >= 67 ? 'bg-yellow-500' :
                                            officeData.compliance.percentage > 0 ? 'bg-orange-500' : 'bg-red-500'
                                          }`}
                                          style={{ width: `${officeData.compliance.percentage}%` }}
                                        ></div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-6">
                                <div className="space-y-3">
                                  {officeData.ispCompliance.map(ispData => {
                                    const morningResult = formatTestResult(ispData.tests.morning);
                                    const noonResult = formatTestResult(ispData.tests.noon);
                                    const afternoonResult = formatTestResult(ispData.tests.afternoon);

                                    return (
                                      <div
                                        key={ispData.isp}
                                        className="bg-gradient-to-r from-slate-50 to-gray-50 border border-gray-200 rounded-2xl p-5 hover:shadow-lg hover:border-gray-300 transition-all duration-300"
                                      >
                                        {/* ISP Header */}
                                        <div className="flex items-center justify-between mb-4">
                                          <div className="flex items-center gap-3">
                                            <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
                                              <Wifi className="h-5 w-5 text-white" />
                                            </div>
                                            <div>
                                              <h4 className="font-bold text-gray-900 text-base">
                                                {ispData.isp}
                                              </h4>
                                              <p className="text-xs text-gray-500">
                                                Internet Service Provider
                                              </p>
                                            </div>
                                          </div>
                                          <div className="text-right">
                                            <span
                                              className={`inline-flex items-center px-4 py-2 text-sm font-bold rounded-xl ${getComplianceColor(ispData.compliance.percentage)} shadow-sm`}
                                            >
                                              {ispData.compliance.percentage}%
                                            </span>
                                            <p className="text-xs text-gray-500 mt-1">
                                              {ispData.compliance.completedSlots}/3 tests completed
                                            </p>
                                          </div>
                                        </div>

                                        {/* Test Results Grid */}
                                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                                          {/* Morning Test */}
                                          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200 hover:shadow-md transition-all duration-200">
                                            <div className="flex items-center gap-2 mb-3">
                                              <div className="p-1.5 bg-blue-500 rounded-lg">
                                                <Activity className="h-4 w-4 text-white" />
                                              </div>
                                              <div className="flex-1 min-w-0">
                                                <h5 className="font-bold text-blue-800 text-sm truncate">Morning</h5>
                                                <p className="text-xs text-blue-600 truncate">
                                                  {monitoringData.timeSlots.morning.window}
                                                </p>
                                              </div>
                                            </div>
                                            <div className="space-y-2">
                                              <div className={`font-semibold text-sm ${morningResult.className} leading-relaxed break-words`}>
                                                {morningResult.display}
                                              </div>
                                              {ispData.counts.morning > 1 && (
                                                <div className="flex items-center gap-1 text-blue-600 text-xs">
                                                  <BarChart3 className="h-3 w-3 flex-shrink-0" />
                                                  <span>+{ispData.counts.morning - 1} additional tests</span>
                                                </div>
                                              )}
                                            </div>
                                          </div>

                                          {/* Noon Test */}
                                          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200 hover:shadow-md transition-all duration-200">
                                            <div className="flex items-center gap-2 mb-3">
                                              <div className="p-1.5 bg-green-500 rounded-lg">
                                                <Wifi className="h-4 w-4 text-white" />
                                              </div>
                                              <div className="flex-1 min-w-0">
                                                <h5 className="font-bold text-green-800 text-sm truncate">Noon</h5>
                                                <p className="text-xs text-green-600 truncate">
                                                  {monitoringData.timeSlots.noon.window}
                                                </p>
                                              </div>
                                            </div>
                                            <div className="space-y-2">
                                              <div className={`font-semibold text-sm ${noonResult.className} leading-relaxed break-words`}>
                                                {noonResult.display}
                                              </div>
                                              {ispData.counts.noon > 1 && (
                                                <div className="flex items-center gap-1 text-green-600 text-xs">
                                                  <BarChart3 className="h-3 w-3 flex-shrink-0" />
                                                  <span>+{ispData.counts.noon - 1} additional tests</span>
                                                </div>
                                              )}
                                            </div>
                                          </div>

                                          {/* Afternoon Test */}
                                          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200 hover:shadow-md transition-all duration-200">
                                            <div className="flex items-center gap-2 mb-3">
                                              <div className="p-1.5 bg-purple-500 rounded-lg">
                                                <Signal className="h-4 w-4 text-white" />
                                              </div>
                                              <div className="flex-1 min-w-0">
                                                <h5 className="font-bold text-purple-800 text-sm truncate">Afternoon</h5>
                                                <p className="text-xs text-purple-600 truncate">
                                                  {monitoringData.timeSlots.afternoon.window}
                                                </p>
                                              </div>
                                            </div>
                                            <div className="space-y-2">
                                              <div className={`font-semibold text-sm ${afternoonResult.className} leading-relaxed break-words`}>
                                                {afternoonResult.display}
                                              </div>
                                              {ispData.counts.afternoon > 1 && (
                                                <div className="flex items-center gap-1 text-purple-600 text-xs">
                                                  <BarChart3 className="h-3 w-3 flex-shrink-0" />
                                                  <span>+{ispData.counts.afternoon - 1} additional tests</span>
                                                </div>
                                              )}
                                            </div>
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
                )
              ) : (
                <div className="text-center py-20">
                  <div className="text-gray-500">
                    <div className="w-32 h-32 mx-auto mb-6 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center shadow-inner">
                      <WifiOff className="h-16 w-16 text-gray-400" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-3">No Office Data Available</h3>
                    <p className="text-base max-w-md mx-auto mb-6 text-gray-600">
                      {selectedUnit || selectedSubUnit
                        ? 'No offices match your current filter criteria. Try adjusting your filters or selecting a different date.'
                        : 'No offices are available for the selected date. This might be a system configuration issue or no speed tests have been configured yet.'}
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                      {(selectedUnit || selectedSubUnit) && (
                        <button
                          onClick={clearFilters}
                          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors duration-200 shadow-lg hover:shadow-xl"
                        >
                          <Filter className="h-4 w-4" />
                          Clear All Filters
                        </button>
                      )}
                      <button
                        onClick={fetchMonitoringData}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-gray-600 text-white rounded-xl text-sm font-semibold hover:bg-gray-700 transition-colors duration-200 shadow-lg hover:shadow-xl"
                      >
                        <RefreshCw className="h-4 w-4" />
                        Refresh Data
                      </button>
                    </div>
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
