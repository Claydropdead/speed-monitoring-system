'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '../../../components/dashboard-layout';
import { format } from 'date-fns';
import { CheckCircle, XCircle, Clock, AlertTriangle, Calendar, TrendingUp, Filter, X } from 'lucide-react';

// Unit and SubUnit mapping for filtering
const UNIT_SUBUNIT_MAPPING = {
  'RMFB': [
    'RMFB HQ',
    'TSC',
    '401st',
    '402nd',
    '403rd',
    '404th',
    '405th',
  ],
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
    'Brooke\'s Point MPS',
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
  'RHQ': [
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
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading monitoring data...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex">
            <XCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error Loading Data</h3>
              <div className="mt-2 text-sm text-red-700">{error}</div>
              <button
                onClick={fetchMonitoringData}
                className="mt-3 bg-red-600 text-white px-4 py-2 rounded-md text-sm hover:bg-red-700"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!monitoringData) {
    return <DashboardLayout><div>No data available</div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Daily Speed Test Monitoring</h1>
            <p className="text-gray-600 mt-1">
              Monitor office compliance with required daily speed tests (3x per day)
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
            >
              <Filter className="h-4 w-4" />
              Filters
              {(selectedUnit || selectedSubUnit) && (
                <span className="ml-1 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">
                  {selectedUnit ? (selectedSubUnit ? '2' : '1') : '0'}
                </span>
              )}
            </button>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <button
              onClick={fetchMonitoringData}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="card">
            <div className="card-header">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Filters</h3>
                <button
                  onClick={() => setShowFilters(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="card-content">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Unit
                  </label>
                  <select
                    value={selectedUnit}
                    onChange={(e) => handleUnitChange(e.target.value as UnitType | '')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Units</option>
                    {Object.keys(UNIT_SUBUNIT_MAPPING).map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sub Unit
                  </label>
                  <select
                    value={selectedSubUnit}
                    onChange={(e) => setSelectedSubUnit(e.target.value)}
                    disabled={!selectedUnit}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="">All Sub Units</option>
                    {availableSubUnits.map((subUnit) => (
                      <option key={subUnit} value={subUnit}>
                        {subUnit}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={clearFilters}
                    disabled={!selectedUnit && !selectedSubUnit}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    Clear Filters
                  </button>
                </div>
              </div>
              {(selectedUnit || selectedSubUnit) && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Active Filters:</strong>
                    {selectedUnit && ` Unit: ${selectedUnit}`}
                    {selectedSubUnit && `, Sub Unit: ${selectedSubUnit}`}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <div className="card">
            <div className="card-content">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <TrendingUp className="h-8 w-8 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Overall Compliance</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {monitoringData.summary.overallCompliancePercentage}%
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-content">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Fully Compliant</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {monitoringData.summary.fullyCompliantOffices}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-content">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <AlertTriangle className="h-8 w-8 text-yellow-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Partial Compliance</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {monitoringData.summary.partiallyCompliantOffices}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-content">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <XCircle className="h-8 w-8 text-red-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Non-Compliant</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {monitoringData.summary.nonCompliantOffices}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-content">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Clock className="h-8 w-8 text-gray-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total Offices</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {monitoringData.summary.totalOffices}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Time Slot Information */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium">Required Testing Windows</h3>
          </div>
          <div className="card-content">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="font-medium text-blue-900">Morning</h4>
                <p className="text-sm text-blue-700">{monitoringData.timeSlots.morning.window}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <h4 className="font-medium text-green-900">Noon</h4>
                <p className="text-sm text-green-700">{monitoringData.timeSlots.noon.window}</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <h4 className="font-medium text-purple-900">Afternoon</h4>
                <p className="text-sm text-purple-700">{monitoringData.timeSlots.afternoon.window}</p>
              </div>
            </div>
          </div>
        </div>        {/* Office Monitoring Table */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium">Office Compliance Details</h3>
            <p className="text-sm text-gray-600">
              Showing test results for {format(new Date(selectedDate), 'MMMM dd, yyyy')}
            </p>
          </div>
          <div className="card-content p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Office
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Overall Compliance
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ISP Details
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {monitoringData.offices.map((officeData) => {
                    return (
                      <tr key={officeData.office.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {officeData.office.unitOffice}
                              {officeData.office.subUnitOffice && (
                                <span className="text-gray-600 ml-1">- {officeData.office.subUnitOffice}</span>
                              )}
                            </div>
                            <div className="text-sm text-gray-500">
                              {officeData.office.location}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {getComplianceIcon(officeData.compliance.percentage)}
                            <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${getComplianceColor(officeData.compliance.percentage)}`}>
                              {officeData.compliance.percentage}% ({officeData.compliance.completedSlots}/{officeData.compliance.totalSlots})
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-3">
                            {officeData.ispCompliance.map((ispData) => {
                              const morningResult = formatTestResult(ispData.tests.morning);
                              const noonResult = formatTestResult(ispData.tests.noon);
                              const afternoonResult = formatTestResult(ispData.tests.afternoon);

                              return (
                                <div key={ispData.isp} className="border rounded-lg p-3 bg-gray-50">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="font-medium text-sm text-gray-900">{ispData.isp}</span>
                                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getComplianceColor(ispData.compliance.percentage)}`}>
                                      {ispData.compliance.percentage}% ({ispData.compliance.completedSlots}/3)
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-3 gap-2 text-xs">
                                    <div>
                                      <div className="font-medium text-gray-700">Morning</div>
                                      <div className={morningResult.className}>
                                        {morningResult.display}
                                      </div>
                                      {ispData.counts.morning > 1 && (
                                        <div className="text-gray-500">
                                          +{ispData.counts.morning - 1} more
                                        </div>
                                      )}
                                    </div>
                                    <div>
                                      <div className="font-medium text-gray-700">Noon</div>
                                      <div className={noonResult.className}>
                                        {noonResult.display}
                                      </div>
                                      {ispData.counts.noon > 1 && (
                                        <div className="text-gray-500">
                                          +{ispData.counts.noon - 1} more
                                        </div>
                                      )}
                                    </div>
                                    <div>
                                      <div className="font-medium text-gray-700">Afternoon</div>
                                      <div className={afternoonResult.className}>
                                        {afternoonResult.display}
                                      </div>
                                      {ispData.counts.afternoon > 1 && (
                                        <div className="text-gray-500">
                                          +{ispData.counts.afternoon - 1} more
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
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
