'use client';

import { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '../../../components/dashboard-layout';
import { Download } from 'lucide-react';

interface TrendData {
  date: string;
  office: string;
  isp?: string;
  section?: string;
  timeOfDay?: string;
  avgDownload: number;
  avgUpload: number;
  avgPing: number;
  unit?: string;
  subunit?: string;
  timestamp?: string;
  testCount?: number;
}

interface Office {
  id: string;
  unitOffice: string;
  subUnitOffice?: string;
  location: string;
  isp?: string;
  isps?: string;
  section?: string;
  sectionISPs?: string;
}

export default function ReportsPage() {
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    unit: '',
    subunit: '',
    isp: '',
    section: '',
    timeOfDay: '',
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    date: string;
    download: number;
    upload: number;
    ping: number;
    unit?: string;
    subunit?: string;
    section?: string;
    isp?: string;
    time?: string;
    testCount: number;
  }>({
    visible: false,
    x: 0,
    y: 0,
    date: '',
    download: 0,
    upload: 0,
    ping: 0,
    testCount: 0,
  });

  // Visibility state for chart metrics
  const [visibility, setVisibility] = useState({
    download: true,
    upload: true,
    ping: true,
  });

  // Effects
  useEffect(() => {
    fetchOffices();
    fetchTrendData();
  }, []);

  useEffect(() => {
    fetchTrendData();
  }, [filters]);

  // Fetch functions
  const fetchOffices = async () => {
    try {
      const response = await fetch('/api/offices');
      if (response.ok) {
        const result = await response.json();
        const data = result.offices || result;
        setOffices(Array.isArray(data) ? data : []);
      } else {
        setOffices([]);
      }
    } catch (error) {
      console.error('Error fetching offices:', error);
      setOffices([]);
    }
  };
  const fetchTrendData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.unit) params.append('unit', filters.unit);
      if (filters.subunit) params.append('subunit', filters.subunit);
      if (filters.isp) params.append('isp', filters.isp);
      if (filters.section) params.append('section', filters.section);
      if (filters.timeOfDay) params.append('timeOfDay', filters.timeOfDay);
      params.append('startDate', filters.startDate);
      params.append('endDate', filters.endDate);
      const response = await fetch(`/api/reports/trends?${params}`);
      if (response.ok) {
        const data = await response.json();
        setTrendData(Array.isArray(data) ? data : []);
      } else {
        setTrendData([]);
      }
    } catch (error) {
      console.error('Error fetching trend data:', error);
      setTrendData([]);
    } finally {
      setLoading(false);
    }
  }; // Data processing - group by office for line connections when All Units selected
  const processedData = Array.isArray(trendData)
    ? (() => {
        // If no specific unit is selected (All Units), group by office for connected lines
        if (!filters.unit) {
          const officeGroups = trendData.reduce((groups: any, item: TrendData) => {
            const officeKey = item.office || 'Unknown';
            if (!groups[officeKey]) {
              groups[officeKey] = [];
            }
            groups[officeKey].push({
              ...item,
              count: item.testCount || 1,
              details: [item],
            });
            return groups;
          }, {});
          // Sort each office's data by date and return as a flat array with office info
          return Object.entries(officeGroups).flatMap(([officeName, officeData]) =>
            (officeData as any[])
              .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
              .map(item => ({ ...item, officeName }))
          );
        }

        // If a specific unit is selected, aggregate by date
        return trendData
          .reduce((acc: any[], item: TrendData) => {
            const existing = acc.find(d => d.date === item.date);
            if (existing) {
              const totalCount = existing.count + (item.testCount || 1);
              existing.avgDownload =
                (existing.avgDownload * existing.count + item.avgDownload * (item.testCount || 1)) /
                totalCount;
              existing.avgUpload =
                (existing.avgUpload * existing.count + item.avgUpload * (item.testCount || 1)) /
                totalCount;
              existing.avgPing =
                (existing.avgPing * existing.count + item.avgPing * (item.testCount || 1)) /
                totalCount;
              existing.count = totalCount;
              existing.details.push(item);
            } else {
              acc.push({
                ...item,
                count: item.testCount || 1,
                details: [item],
              });
            }
            return acc;
          }, [])
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      })()
    : [];

  // Group data by office for rendering separate lines when All Units is selected
  const groupedByOffice = !filters.unit
    ? processedData.reduce((groups: any, item: any) => {
        const officeKey = item.officeName || 'Unknown';
        if (!groups[officeKey]) {
          groups[officeKey] = [];
        }
        groups[officeKey].push(item);
        return groups;
      }, {})
    : {};

  const sortedData = !filters.unit ? processedData : processedData; // Chart dimensions and scaling
  const chartWidth = 900; // Maximized for better space utilization
  const chartHeight = 400;
  const padding = { top: 40, right: 40, bottom: 80, left: 50 }; // Reduced padding for better space usage

  const downloads = sortedData.map(d => d.avgDownload);
  const uploads = sortedData.map(d => d.avgUpload);
  const pings = sortedData.map(d => d.avgPing);

  const maxDownload = Math.max(...downloads, 0);
  const maxUpload = Math.max(...uploads, 0);
  const maxPing = Math.max(...pings, 0);
  const maxSpeed = Math.max(maxDownload, maxUpload, 120); // Minimum 120 for better scaling
  const maxPingScale = Math.max(maxPing, 50); // Minimum 50 for better scaling

  const xScale = (index: number) =>
    padding.left +
    (index / Math.max(sortedData.length - 1, 1)) * (chartWidth - padding.left - padding.right);
  const ySpeedScale = (value: number) =>
    chartHeight -
    padding.bottom -
    (value / maxSpeed) * (chartHeight - padding.top - padding.bottom);
  const yPingScale = (value: number) =>
    chartHeight -
    padding.bottom -
    (value / maxPingScale) * (chartHeight - padding.top - padding.bottom);
  // Event handlers
  const handleMouseMove = (event: React.MouseEvent<SVGCircleElement>, index: number) => {
    const rect = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
    if (rect && sortedData[index]) {
      const dataPoint = sortedData[index] as TrendData & { count: number; details: TrendData[] };

      // Get page coordinates for tooltip positioning
      const pageX = event.pageX;
      const pageY = event.pageY;

      const units = [...new Set(dataPoint.details?.map(d => d.unit).filter(Boolean) || [])];
      const subunits = [...new Set(dataPoint.details?.map(d => d.subunit).filter(Boolean) || [])];
      const sections = [...new Set(dataPoint.details?.map(d => d.section).filter(Boolean) || [])];
      const isps = [...new Set(dataPoint.details?.map(d => d.isp).filter(Boolean) || [])];
      const timeWindows = [
        ...new Set(dataPoint.details?.map(d => d.timeOfDay).filter(Boolean) || []),
      ];

      setTooltip({
        visible: true,
        x: pageX,
        y: pageY,
        date: new Date(dataPoint.date).toLocaleDateString(),
        download: dataPoint.avgDownload,
        upload: dataPoint.avgUpload,
        ping: dataPoint.avgPing,
        unit: units.length > 0 ? units.join(', ') : undefined,
        subunit: subunits.length > 0 ? subunits.join(', ') : undefined,
        section: sections.length > 0 ? sections.join(', ') : undefined,
        isp: isps.length > 0 ? isps.join(', ') : undefined,
        time: timeWindows.length > 0 ? timeWindows.join(', ') : undefined,
        testCount: dataPoint.count || 1,
      });
    }
  };

  const handleMouseLeave = () => {
    setTooltip(prev => ({ ...prev, visible: false }));
  };

  // Helper functions
  const getUniqueUnits = () => {
    if (!Array.isArray(offices)) return [];
    return [...new Set(offices.map((office: Office) => office.unitOffice))];
  };

  const getSubunitsForUnit = (unit: string) => {
    if (!Array.isArray(offices)) return [];
    const filteredOffices = offices.filter((office: Office) => office.unitOffice === unit);
    return [
      ...new Set(filteredOffices.map((office: Office) => office.subUnitOffice).filter(Boolean)),
    ];
  };

  // Memoized available sections based on current unit and subunit selection
  const availableSections = useMemo(() => {
    if (!Array.isArray(offices)) return [];

    let filteredOffices = offices;
    if (filters.unit) {
      filteredOffices = filteredOffices.filter(
        (office: Office) => office.unitOffice === filters.unit
      );
    }
    if (filters.subunit) {
      filteredOffices = filteredOffices.filter(
        (office: Office) => office.subUnitOffice === filters.subunit
      );
    }

    const sections = new Set<string>();
    filteredOffices.forEach((office: Office) => {
      if (office.sectionISPs) {
        try {
          const sectionISPsObj = JSON.parse(office.sectionISPs);
          if (typeof sectionISPsObj === 'object') {
            Object.keys(sectionISPsObj).forEach(section => sections.add(section));
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }
      if (office.section) {
        sections.add(office.section);
      }
    });
    return Array.from(sections).sort();
  }, [offices, filters.unit, filters.subunit]); // Memoized available ISPs based on current selections and trend data
  const availableISPs = useMemo(() => {
    // Don't show ISPs when "All Units" is selected (no specific unit selected)
    if (!filters.unit) return [];

    const ispSet = new Set<string>();

    // First, get ISPs from office configuration
    const relevantOffices = offices.filter(office => {
      if (filters.unit && office.unitOffice !== filters.unit) return false;
      if (filters.subunit && office.subUnitOffice !== filters.subunit) return false;
      return true;
    });

    relevantOffices.forEach(office => {
      // Add general ISP
      if (office.isp && office.isp.trim()) {
        ispSet.add(office.isp.trim());
      }

      // Add ISPs from isps field (JSON array)
      if (office.isps) {
        try {
          const ispArray = JSON.parse(office.isps);
          if (Array.isArray(ispArray)) {
            ispArray.forEach(isp => {
              if (typeof isp === 'string' && isp.trim()) {
                ispSet.add(isp.trim());
              }
            });
          }
        } catch (e) {
          console.warn('Invalid ISPs JSON:', office.isps);
        }
      }

      // Add section-specific ISPs
      if (office.sectionISPs) {
        try {
          const sectionISPsObj = JSON.parse(office.sectionISPs);
          if (typeof sectionISPsObj === 'object') {
            Object.values(sectionISPsObj).forEach(isp => {
              if (typeof isp === 'string' && isp.trim()) {
                ispSet.add(isp.trim());
              }
            });
          }
        } catch (e) {
          console.warn('Invalid sectionISPs JSON:', office.sectionISPs);
        }
      }
    });

    // Then, add ISPs from trend data (speed test results)
    if (Array.isArray(trendData) && trendData.length > 0) {
      let filteredTrendData = trendData;
      if (filters.unit) {
        filteredTrendData = filteredTrendData.filter(
          (item: TrendData) => item.unit === filters.unit
        );
      }
      if (filters.subunit) {
        filteredTrendData = filteredTrendData.filter(
          (item: TrendData) => item.subunit === filters.subunit
        );
      }
      if (filters.section) {
        filteredTrendData = filteredTrendData.filter(
          (item: TrendData) => item.isp && item.isp.includes(`(${filters.section})`)
        );
      }

      // Extract unique ISPs from filtered data
      filteredTrendData.forEach((item: TrendData) => {
        if (item.isp && typeof item.isp === 'string' && item.isp.trim()) {
          ispSet.add(item.isp.trim());
        }
      });
    }

    // Convert set to sorted array
    return Array.from(ispSet).sort();
  }, [offices, trendData, filters.unit, filters.subunit, filters.section]);

  // Reset dependent filters when parent filter changes
  useEffect(() => {
    setFilters(prev => ({
      ...prev,
      subunit: prev.unit ? prev.subunit : '',
      section: prev.unit && prev.subunit ? prev.section : '',
      isp: '',
    }));
  }, [filters.unit]);

  useEffect(() => {
    setFilters(prev => ({
      ...prev,
      section: prev.subunit ? prev.section : '',
      isp: '',
    }));
  }, [filters.subunit]);

  useEffect(() => {
    setFilters(prev => ({
      ...prev,
      isp: '',
    }));
  }, [filters.section]);

  // CSV Export functionality
  const exportToCSV = () => {
    if (!Array.isArray(trendData) || trendData.length === 0) {
      alert('No data available to export');
      return;
    }

    // Filter data based on current filters
    let filteredData = trendData.filter(item => {
      let matches = true;

      if (filters.unit && item.unit !== filters.unit) matches = false;
      if (filters.subunit && item.subunit !== filters.subunit) matches = false;
      if (filters.section && item.section !== filters.section) matches = false;
      if (filters.isp && item.isp !== filters.isp) matches = false;
      if (filters.timeOfDay && item.timeOfDay !== filters.timeOfDay) matches = false;

      // Date filtering
      const itemDate = new Date(item.date);
      const startDate = new Date(filters.startDate);
      const endDate = new Date(filters.endDate);
      if (itemDate < startDate || itemDate > endDate) matches = false;

      return matches;
    });

    if (filteredData.length === 0) {
      alert('No data matches the current filters');
      return;
    }

    // Define CSV headers based on the required fields
    const csvHeaders = [
      'Unit',
      'Subunit', 
      'Section',
      'Location',
      'ISP',
      'Time Slot',
      'Test Time',
      'Download Speed (Mbps)',
      'Upload Speed (Mbps)',
      'Ping (ms)',
      'Date',
      'Status'
    ];

    // Convert data to CSV format
    const csvData = filteredData.map(item => {
      // Determine time slot based on timeOfDay field or timestamp
      let timeSlot = '';
      let testTime = '';
      let status = 'Conducted';
      
      if (item.timeOfDay) {
        timeSlot = item.timeOfDay;
      } else if (item.timestamp) {
        const hour = new Date(item.timestamp).getHours();
        if (hour >= 6 && hour < 12) {
          timeSlot = 'Morning';
        } else if (hour >= 12 && hour < 15) {
          timeSlot = 'Noon';
        } else if (hour >= 15 && hour < 18) {
          timeSlot = 'Afternoon';
        } else {
          timeSlot = 'Other';
        }
      } else {
        timeSlot = 'Unknown';
      }

      // Extract test time from timestamp
      if (item.timestamp) {
        const testDate = new Date(item.timestamp);
        testTime = testDate.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: false 
        });
      }

      // Check if test was conducted (has valid speed data)
      if (!item.avgDownload || item.avgDownload === 0) {
        status = 'Not Conducted';
      }

      return [
        item.unit || '',
        item.subunit || '',
        item.section || '',
        item.office || '', // Using office as location
        item.isp || '',
        timeSlot,
        testTime,
        item.avgDownload?.toFixed(2) || '0.00',
        item.avgUpload?.toFixed(2) || '0.00',
        item.avgPing?.toFixed(0) || '0',
        new Date(item.date).toLocaleDateString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }),
        status
      ];
    });

    // Create CSV content
    const csvContent = [
      csvHeaders.join(','),
      ...csvData
        .map(row =>
          row
            .map(field =>
              // Escape fields that contain commas or quotes
              typeof field === 'string' && (field.includes(',') || field.includes('"'))
                ? `"${field.replace(/"/g, '""')}"`
                : field
            )
            .join(',')
        )
    ].join('\n');

    // Create and download the file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);

    // Generate filename with current date and filters
    const dateStr = new Date().toISOString().split('T')[0];
    let filename = `speed-test-report-${dateStr}`;
    if (filters.unit) filename += `-${filters.unit.replace(/\s+/g, '-')}`;
    if (filters.subunit) filename += `-${filters.subunit.replace(/\s+/g, '-')}`;
    if (filters.section) filename += `-${filters.section.replace(/\s+/g, '-')}`;
    filename += '.csv';

    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gray-50">
        {/* Header Section */}
        <div className="bg-white border-b border-gray-200 px-6 py-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Network Performance Analytics</h1>
                <p className="mt-2 text-gray-600">
                  Monitor and analyze internet speed performance across all office locations
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <div className="text-sm text-gray-500">Data Points</div>
                  <div className="text-2xl font-bold text-blue-600">{sortedData.length}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-500">Date Range</div>
                  <div className="text-sm font-medium text-gray-900">
                    {new Date(filters.startDate).toLocaleDateString()} -{' '}
                    {new Date(filters.endDate).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>
          </div>{' '}
        </div>{' '}
        {/* Main Content Area */}
        <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
          {/* Advanced Filters Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Advanced Filters</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Customize your view by selecting specific criteria
                  </p>
                </div>
                <div className="flex items-center space-x-4">
                  <button
                    onClick={exportToCSV}
                    className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
                  >
                    <Download className="h-4 w-4" />
                    <span>Export CSV</span>
                  </button>
                  <button
                    onClick={() =>
                      setFilters({
                        unit: '',
                        subunit: '',
                        isp: '',
                        section: '',
                        timeOfDay: '',
                        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                          .toISOString()
                          .split('T')[0],
                        endDate: new Date().toISOString().split('T')[0],
                      })
                    }
                    className="px-4 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Reset Filters
                  </button>
                  <div className="text-sm text-gray-500">
                    {availableISPs.length} ISPs • {availableSections.length} Sections
                  </div>
                </div>
              </div>
            </div>
            {/* Active Filters Display */}
            {(filters.unit ||
              filters.subunit ||
              filters.section ||
              filters.isp ||
              filters.timeOfDay) && (
              <div className="px-6 py-3 bg-blue-50 border-b border-blue-100">
                <div className="flex items-center space-x-2 flex-wrap">
                  <span className="text-sm font-medium text-blue-900">Active Filters:</span>
                  {filters.unit && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      Unit: {filters.unit}
                      <button
                        onClick={() =>
                          setFilters(prev => ({
                            ...prev,
                            unit: '',
                            subunit: '',
                            section: '',
                            isp: '',
                          }))
                        }
                        className="ml-2 text-blue-600 hover:text-blue-800"
                      >
                        �
                      </button>
                    </span>
                  )}
                  {filters.subunit && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                      Subunit: {filters.subunit}
                      <button
                        onClick={() =>
                          setFilters(prev => ({ ...prev, subunit: '', section: '', isp: '' }))
                        }
                        className="ml-2 text-purple-600 hover:text-purple-800"
                      >
                        �
                      </button>
                    </span>
                  )}
                  {filters.section && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Section: {filters.section}
                      <button
                        onClick={() => setFilters(prev => ({ ...prev, section: '', isp: '' }))}
                        className="ml-2 text-green-600 hover:text-green-800"
                      >
                        �
                      </button>
                    </span>
                  )}
                  {filters.isp && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                      ISP: {filters.isp}
                      <button
                        onClick={() => setFilters(prev => ({ ...prev, isp: '' }))}
                        className="ml-2 text-orange-600 hover:text-orange-800"
                      >
                        �
                      </button>
                    </span>
                  )}
                  {filters.timeOfDay && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      Time: {filters.timeOfDay}
                      <button
                        onClick={() => setFilters(prev => ({ ...prev, timeOfDay: '' }))}
                        className="ml-2 text-yellow-600 hover:text-yellow-800"
                      >
                        �
                      </button>
                    </span>
                  )}
                </div>
              </div>
            )}{' '}
            {/* Filter Controls */}
            <div className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
                {/* Unit Filter */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    <span className="flex items-center">
                      <svg
                        className="w-4 h-4 mr-2 text-blue-500"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 0v12h8V4H6z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Unit
                    </span>
                  </label>
                  <select
                    value={filters.unit}
                    onChange={e => {
                      setFilters(prev => ({
                        ...prev,
                        unit: e.target.value,
                        subunit: '',
                        isp: '',
                        section: '',
                      }));
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  >
                    <option value="">All Units</option>
                    {getUniqueUnits().map(unit => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Subunit Filter */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    <span className="flex items-center">
                      <svg
                        className="w-4 h-4 mr-2 text-purple-500"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Subunit
                    </span>
                  </label>{' '}
                  <select
                    value={filters.subunit}
                    onChange={e => {
                      setFilters(prev => ({
                        ...prev,
                        subunit: e.target.value,
                        isp: '',
                        section: '',
                      }));
                    }}
                    disabled={!filters.unit}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors disabled:bg-gray-50 disabled:text-gray-400"
                  >
                    <option value="">{filters.unit ? 'All Subunits' : 'Select unit first'}</option>
                    {filters.unit &&
                      getSubunitsForUnit(filters.unit).map(subunit => (
                        <option key={subunit} value={subunit}>
                          {subunit}
                        </option>
                      ))}
                  </select>
                </div>

                {/* ISP Filter */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    <span className="flex items-center">
                      <svg
                        className="w-4 h-4 mr-2 text-orange-500"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z"
                          clipRule="evenodd"
                        />
                      </svg>
                      ISP
                    </span>
                  </label>
                  <select
                    value={filters.isp}
                    onChange={e => setFilters(prev => ({ ...prev, isp: e.target.value }))}
                    disabled={!filters.unit}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors disabled:bg-gray-50 disabled:text-gray-400"
                  >
                    <option value="">{filters.unit ? 'All ISPs' : 'Select unit first'}</option>
                    {availableISPs.map(isp => (
                      <option key={isp} value={isp}>
                        {isp}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Section Filter */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    <span className="flex items-center">
                      <svg
                        className="w-4 h-4 mr-2 text-green-500"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
                      </svg>
                      Section
                    </span>
                  </label>
                  <select
                    value={filters.section}
                    onChange={e =>
                      setFilters(prev => ({ ...prev, section: e.target.value, isp: '' }))
                    }
                    disabled={!filters.unit}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors disabled:bg-gray-50 disabled:text-gray-400"
                  >
                    <option value="">{filters.unit ? 'All Sections' : 'Select unit first'}</option>
                    {availableSections.map(section => (
                      <option key={section} value={section}>
                        {section}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Time of Day Filter */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    <span className="flex items-center">
                      <svg
                        className="w-4 h-4 mr-2 text-yellow-500"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Time of Day
                    </span>
                  </label>
                  <select
                    value={filters.timeOfDay}
                    onChange={e => setFilters(prev => ({ ...prev, timeOfDay: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-colors"
                  >
                    <option value="">All Times</option>
                    <option value="morning">Morning (6:00 AM - 11:59 AM)</option>
                    <option value="noon">Noon (12:00 PM - 12:59 PM)</option>
                    <option value="afternoon">Afternoon (1:00 PM - 6:00 PM)</option>
                  </select>
                </div>

                {/* Start Date Filter */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    <span className="flex items-center">
                      <svg
                        className="w-4 h-4 mr-2 text-indigo-500"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Start Date
                    </span>
                  </label>
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={e => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                  />
                </div>

                {/* End Date Filter */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    <span className="flex items-center">
                      <svg
                        className="w-4 h-4 mr-2 text-indigo-500"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
                          clipRule="evenodd"
                        />
                      </svg>
                      End Date
                    </span>
                  </label>
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={e => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>
            </div>{' '}
            {/* Chart and Visualization Section */}
            <div className="max-w-7xl mx-auto px-4 pb-8">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 overflow-hidden">
                  {loading ? (
                    <div className="flex justify-center items-center h-96">
                      <div className="flex flex-col items-center space-y-4">
                        <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600"></div>
                        <p className="text-gray-600">Loading performance data...</p>
                      </div>
                    </div>
                  ) : sortedData.length === 0 ? (
                    <div className="flex flex-col justify-center items-center h-96 text-gray-500">
                      <svg
                        className="w-16 h-16 mb-4 text-gray-300"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <p className="text-lg font-medium">No data available</p>
                      <p className="text-sm">Try adjusting your filters to see performance data</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {' '}
                      {/* Chart Container */}
                      <div className="relative bg-gray-50 rounded-lg p-2 flex justify-center w-full overflow-hidden">
                        <div className="w-full max-w-none flex justify-center">
                          <svg
                            width={chartWidth}
                            height={chartHeight}
                            className="bg-white rounded-lg shadow-sm"
                          >
                            {/* Background */}
                            <rect width={chartWidth} height={chartHeight} fill="white" />
                            {/* Horizontal grid lines */}
                            {[0, 1, 2, 3, 4, 5].map(i => (
                              <line
                                key={`grid-h-${i}`}
                                x1={padding.left}
                                y1={
                                  padding.top +
                                  (i / 5) * (chartHeight - padding.top - padding.bottom)
                                }
                                x2={chartWidth - padding.right}
                                y2={
                                  padding.top +
                                  (i / 5) * (chartHeight - padding.top - padding.bottom)
                                }
                                stroke="#e5e7eb"
                                strokeWidth="1"
                                strokeDasharray="2,2"
                              />
                            ))}
                            {/* Vertical grid lines */}
                            {sortedData.map((_, index) => {
                              const labelInterval = Math.max(1, Math.ceil(sortedData.length / 10));
                              if (index % labelInterval === 0 || index === sortedData.length - 1) {
                                return (
                                  <line
                                    key={`grid-v-${index}`}
                                    x1={xScale(index)}
                                    y1={padding.top}
                                    x2={xScale(index)}
                                    y2={chartHeight - padding.bottom}
                                    stroke="#e5e7eb"
                                    strokeWidth="1"
                                    strokeDasharray="2,2"
                                  />
                                );
                              }
                              return null;
                            })}
                            {/* Left Y-axis labels (Speed) */}
                            {[0, 1, 2, 3, 4, 5].map(i => (
                              <text
                                key={`speed-label-${i}`}
                                x={padding.left - 15}
                                y={
                                  padding.top +
                                  (i / 5) * (chartHeight - padding.top - padding.bottom) +
                                  5
                                }
                                textAnchor="end"
                                className="text-xs fill-gray-600"
                              >
                                {Math.round(maxSpeed - (i / 5) * maxSpeed)}
                              </text>
                            ))}
                            {/* Right Y-axis labels (Ping) */}
                            {[0, 1, 2, 3, 4, 5].map(i => (
                              <text
                                key={`ping-label-${i}`}
                                x={chartWidth - padding.right + 15}
                                y={
                                  padding.top +
                                  (i / 5) * (chartHeight - padding.top - padding.bottom) +
                                  5
                                }
                                textAnchor="start"
                                className="text-xs fill-gray-600"
                              >
                                {Math.round(maxPingScale - (i / 5) * maxPingScale)}
                              </text>
                            ))}{' '}
                            {/* X-axis labels */}
                            {sortedData.map((item, index) => {
                              // Show more labels for better date coverage
                              const labelInterval = Math.max(1, Math.ceil(sortedData.length / 10));
                              if (index % labelInterval === 0 || index === sortedData.length - 1) {
                                return (
                                  <text
                                    key={`x-label-${index}`}
                                    x={xScale(index)}
                                    y={chartHeight - padding.bottom + 25}
                                    textAnchor="middle"
                                    className="text-xs fill-gray-600"
                                  >
                                    {new Date(item.date).toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                    })}
                                  </text>
                                );
                              }
                              return null;
                            })}
                            {/* Connecting Lines */}
                            {filters.unit ? (
                              // Single aggregated line when a specific unit is selected
                              <>
                                {/* Download line */}
                                {visibility.download && (
                                  <polyline
                                    fill="none"
                                    stroke="#2563eb"
                                    strokeWidth="2"
                                    points={sortedData
                                      .map(
                                        (item, index) =>
                                          `${xScale(index)},${ySpeedScale(item.avgDownload)}`
                                      )
                                      .join(' ')}
                                  />
                                )}

                                {/* Upload line */}
                                {visibility.upload && (
                                  <polyline
                                    fill="none"
                                    stroke="#16a34a"
                                    strokeWidth="2"
                                    points={sortedData
                                      .map(
                                        (item, index) =>
                                          `${xScale(index)},${ySpeedScale(item.avgUpload)}`
                                      )
                                      .join(' ')}
                                  />
                                )}

                                {/* Ping line */}
                                {visibility.ping && (
                                  <polyline
                                    fill="none"
                                    stroke="#ea580c"
                                    strokeWidth="2"
                                    points={sortedData
                                      .map(
                                        (item, index) =>
                                          `${xScale(index)},${yPingScale(item.avgPing)}`
                                      )
                                      .join(' ')}
                                  />
                                )}
                              </>
                            ) : (
                              // Separate lines for each office when All Units is selected
                              Object.entries(groupedByOffice).map(([officeName, officeData]) => {
                                const officePoints = (officeData as any[])
                                  .map(item => {
                                    const dataIndex = sortedData.findIndex(
                                      d => d.date === item.date && d.office === item.office
                                    );
                                    return dataIndex !== -1 ? { item, index: dataIndex } : null;
                                  })
                                  .filter(Boolean);

                                return (
                                  <g key={`office-${officeName}`}>
                                    {/* Download line for this office */}
                                    {visibility.download && officePoints.length > 1 && (
                                      <polyline
                                        fill="none"
                                        stroke="#2563eb"
                                        strokeWidth="2"
                                        strokeOpacity="0.8"
                                        points={officePoints
                                          .map(
                                            point =>
                                              `${xScale(point!.index)},${ySpeedScale(point!.item.avgDownload)}`
                                          )
                                          .join(' ')}
                                      />
                                    )}

                                    {/* Upload line for this office */}
                                    {visibility.upload && officePoints.length > 1 && (
                                      <polyline
                                        fill="none"
                                        stroke="#16a34a"
                                        strokeWidth="2"
                                        strokeOpacity="0.8"
                                        points={officePoints
                                          .map(
                                            point =>
                                              `${xScale(point!.index)},${ySpeedScale(point!.item.avgUpload)}`
                                          )
                                          .join(' ')}
                                      />
                                    )}

                                    {/* Ping line for this office */}
                                    {visibility.ping && officePoints.length > 1 && (
                                      <polyline
                                        fill="none"
                                        stroke="#ea580c"
                                        strokeWidth="2"
                                        strokeOpacity="0.8"
                                        points={officePoints
                                          .map(
                                            point =>
                                              `${xScale(point!.index)},${yPingScale(point!.item.avgPing)}`
                                          )
                                          .join(' ')}
                                      />
                                    )}
                                  </g>
                                );
                              })
                            )}
                            {/* Data points with circles */}
                            {sortedData.map((item, index) => {
                              const x = xScale(index);
                              const downloadY = ySpeedScale(item.avgDownload);
                              const uploadY = ySpeedScale(item.avgUpload);
                              const pingY = yPingScale(item.avgPing);

                              return (
                                <g key={`points-${index}`}>
                                  {' '}
                                  {/* Download circle */}
                                  {visibility.download && (
                                    <circle
                                      cx={x}
                                      cy={downloadY}
                                      r="4"
                                      fill="#2563eb"
                                      stroke="white"
                                      strokeWidth="2"
                                      className="cursor-pointer transition-all hover:opacity-80"
                                      style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}
                                      onMouseEnter={e => {
                                        e.currentTarget.setAttribute('r', '6');
                                        handleMouseMove(e, index);
                                      }}
                                      onMouseMove={e => handleMouseMove(e, index)}
                                      onMouseLeave={e => {
                                        e.currentTarget.setAttribute('r', '4');
                                        handleMouseLeave();
                                      }}
                                    />
                                  )}
                                  {/* Upload circle */}
                                  {visibility.upload && (
                                    <circle
                                      cx={x}
                                      cy={uploadY}
                                      r="4"
                                      fill="#16a34a"
                                      stroke="white"
                                      strokeWidth="2"
                                      className="cursor-pointer transition-all hover:opacity-80"
                                      style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}
                                      onMouseEnter={e => {
                                        e.currentTarget.setAttribute('r', '6');
                                        handleMouseMove(e, index);
                                      }}
                                      onMouseMove={e => handleMouseMove(e, index)}
                                      onMouseLeave={e => {
                                        e.currentTarget.setAttribute('r', '4');
                                        handleMouseLeave();
                                      }}
                                    />
                                  )}
                                  {/* Ping circle */}
                                  {visibility.ping && (
                                    <circle
                                      cx={x}
                                      cy={pingY}
                                      r="4"
                                      fill="#ea580c"
                                      stroke="white"
                                      strokeWidth="2"
                                      className="cursor-pointer transition-all hover:opacity-80"
                                      style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}
                                      onMouseEnter={e => {
                                        e.currentTarget.setAttribute('r', '6');
                                        handleMouseMove(e, index);
                                      }}
                                      onMouseMove={e => handleMouseMove(e, index)}
                                      onMouseLeave={e => {
                                        e.currentTarget.setAttribute('r', '4');
                                        handleMouseLeave();
                                      }}
                                    />
                                  )}
                                </g>
                              );
                            })}
                          </svg>
                        </div>
                      </div>
                      {/* Enhanced Interactive Legend */}
                      <div className="bg-gray-50 rounded-lg p-6">
                        <div className="space-y-4">
                          {/* Quick Toggle Controls */}
                          <div className="flex items-center justify-center space-x-4">
                            <button
                              onClick={() =>
                                setVisibility({ download: true, upload: true, ping: true })
                              }
                              className="px-4 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
                            >
                              Show All Metrics
                            </button>
                            <button
                              onClick={() =>
                                setVisibility({ download: false, upload: false, ping: false })
                              }
                              className="px-4 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
                            >
                              Hide All Metrics
                            </button>
                            <div className="text-sm text-gray-500 font-medium">
                              {Object.values(visibility).filter(Boolean).length} of 3 metrics
                              visible
                            </div>
                          </div>

                          {/* Main Legend Buttons */}
                          <div className="flex items-center justify-center space-x-8">
                            <button
                              onClick={() =>
                                setVisibility(prev => ({ ...prev, download: !prev.download }))
                              }
                              className={`group flex items-center space-x-3 cursor-pointer transition-all duration-200 transform hover:scale-105 px-6 py-3 rounded-xl ${
                                visibility.download
                                  ? 'bg-blue-50 border-2 border-blue-200 shadow-md'
                                  : 'bg-white border-2 border-gray-200 hover:bg-gray-50'
                              }`}
                            >
                              <div
                                className={`relative w-6 h-6 rounded-full transition-all duration-200 ${
                                  visibility.download
                                    ? 'bg-blue-600 shadow-lg'
                                    : 'bg-gray-300 border-2 border-gray-400'
                                }`}
                              >
                                {visibility.download && (
                                  <div className="absolute inset-0 rounded-full bg-blue-500 animate-ping opacity-75"></div>
                                )}
                              </div>
                              <div className="text-left">
                                <div
                                  className={`text-sm font-semibold transition-colors duration-200 ${
                                    visibility.download ? 'text-blue-700' : 'text-gray-400'
                                  }`}
                                >
                                  Download Speed
                                </div>
                                <div className="text-xs text-gray-500">Mbps</div>
                              </div>
                            </button>

                            <button
                              onClick={() =>
                                setVisibility(prev => ({ ...prev, upload: !prev.upload }))
                              }
                              className={`group flex items-center space-x-3 cursor-pointer transition-all duration-200 transform hover:scale-105 px-6 py-3 rounded-xl ${
                                visibility.upload
                                  ? 'bg-green-50 border-2 border-green-200 shadow-md'
                                  : 'bg-white border-2 border-gray-200 hover:bg-gray-50'
                              }`}
                            >
                              <div
                                className={`relative w-6 h-6 rounded-full transition-all duration-200 ${
                                  visibility.upload
                                    ? 'bg-green-600 shadow-lg'
                                    : 'bg-gray-300 border-2 border-gray-400'
                                }`}
                              >
                                {visibility.upload && (
                                  <div className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-75"></div>
                                )}
                              </div>
                              <div className="text-left">
                                <div
                                  className={`text-sm font-semibold transition-colors duration-200 ${
                                    visibility.upload ? 'text-green-700' : 'text-gray-400'
                                  }`}
                                >
                                  Upload Speed
                                </div>
                                <div className="text-xs text-gray-500">Mbps</div>
                              </div>
                            </button>

                            <button
                              onClick={() => setVisibility(prev => ({ ...prev, ping: !prev.ping }))}
                              className={`group flex items-center space-x-3 cursor-pointer transition-all duration-200 transform hover:scale-105 px-6 py-3 rounded-xl ${
                                visibility.ping
                                  ? 'bg-orange-50 border-2 border-orange-200 shadow-md'
                                  : 'bg-white border-2 border-gray-200 hover:bg-gray-50'
                              }`}
                            >
                              <div
                                className={`relative w-6 h-6 rounded-full transition-all duration-200 ${
                                  visibility.ping
                                    ? 'bg-orange-600 shadow-lg'
                                    : 'bg-gray-300 border-2 border-gray-400'
                                }`}
                              >
                                {visibility.ping && (
                                  <div className="absolute inset-0 rounded-full bg-orange-500 animate-ping opacity-75"></div>
                                )}
                              </div>
                              <div className="text-left">
                                <div
                                  className={`text-sm font-semibold transition-colors duration-200 ${
                                    visibility.ping ? 'text-orange-700' : 'text-gray-400'
                                  }`}
                                >
                                  Ping Latency
                                </div>
                                <div className="text-xs text-gray-500">ms</div>
                              </div>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}{' '}
                  {/* Enhanced Tooltip */}
                  {tooltip.visible && (
                    <div
                      className="fixed bg-white border border-gray-200 rounded-xl p-4 shadow-2xl pointer-events-none z-50 min-w-[320px]"
                      style={{
                        left: Math.min(
                          tooltip.x + 10,
                          (typeof window !== 'undefined' ? window.innerWidth : 1200) - 340
                        ),
                        top: Math.max(tooltip.y - 180, 10),
                      }}
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
                        <div className="text-sm font-bold text-gray-900">{tooltip.date}</div>
                        <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                          {tooltip.testCount} test{tooltip.testCount !== 1 ? 's' : ''}
                        </div>
                      </div>

                      {/* Performance Metrics */}
                      <div className="space-y-2 mb-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-blue-600 font-medium flex items-center">
                            <div className="w-3 h-3 bg-blue-600 rounded-full mr-2"></div>
                            Download:
                          </span>
                          <span className="text-sm font-bold text-blue-700">
                            {tooltip.download.toFixed(2)} Mbps
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-green-600 font-medium flex items-center">
                            <div className="w-3 h-3 bg-green-600 rounded-full mr-2"></div>
                            Upload:
                          </span>
                          <span className="text-sm font-bold text-green-700">
                            {tooltip.upload.toFixed(2)} Mbps
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-orange-600 font-medium flex items-center">
                            <div className="w-3 h-3 bg-orange-600 rounded-full mr-2"></div>
                            Ping:
                          </span>
                          <span className="text-sm font-bold text-orange-700">
                            {tooltip.ping.toFixed(2)} ms
                          </span>
                        </div>
                      </div>

                      {/* Location & Context Details */}
                      {(tooltip.unit ||
                        tooltip.subunit ||
                        tooltip.section ||
                        tooltip.isp ||
                        tooltip.time) && (
                        <div className="pt-2 border-t border-gray-100">
                          <div className="text-xs font-semibold text-gray-700 mb-2">
                            Location Details:
                          </div>
                          <div className="space-y-1 text-xs">
                            {tooltip.unit && (
                              <div className="flex items-center">
                                <span className="w-2 h-2 bg-purple-500 rounded-full mr-2"></span>
                                <span className="text-gray-600">Unit:</span>
                                <span className="ml-1 font-medium text-purple-700">
                                  {tooltip.unit}
                                </span>
                              </div>
                            )}
                            {tooltip.subunit && (
                              <div className="flex items-center">
                                <span className="w-2 h-2 bg-indigo-500 rounded-full mr-2"></span>
                                <span className="text-gray-600">Subunit:</span>
                                <span className="ml-1 font-medium text-indigo-700">
                                  {tooltip.subunit}
                                </span>
                              </div>
                            )}
                            {tooltip.section && (
                              <div className="flex items-center">
                                <span className="w-2 h-2 bg-cyan-500 rounded-full mr-2"></span>
                                <span className="text-gray-600">Section:</span>
                                <span className="ml-1 font-medium text-cyan-700">
                                  {tooltip.section}
                                </span>
                              </div>
                            )}
                            {tooltip.isp && (
                              <div className="flex items-center">
                                <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                                <span className="text-gray-600">ISP:</span>
                                <span className="ml-1 font-medium text-yellow-700">
                                  {tooltip.isp}
                                </span>
                              </div>
                            )}
                            {tooltip.time && (
                              <div className="flex items-center">
                                <span className="w-2 h-2 bg-rose-500 rounded-full mr-2"></span>
                                <span className="text-gray-600">Time Window:</span>
                                <span className="ml-1 font-medium text-rose-700 capitalize">
                                  {tooltip.time}
                                </span>
                              </div>
                            )}
                          </div>{' '}
                        </div>
                      )}
                    </div>
                  )}
                </div>{' '}
              </div>{' '}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
