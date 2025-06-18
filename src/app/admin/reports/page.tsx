'use client';

import { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '../../../components/dashboard-layout';

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
    endDate: new Date().toISOString().split('T')[0]
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
    upload: 0,    ping: 0,
    testCount: 0
  });

  // Visibility state for chart metrics
  const [visibility, setVisibility] = useState({
    download: true,
    upload: true,
    ping: true
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
      params.append('endDate', filters.endDate);      const response = await fetch(`/api/reports/trends?${params}`);
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
  };

  // Data processing
  const aggregatedData = Array.isArray(trendData) ? trendData.reduce((acc: any[], item: TrendData) => {
    const existing = acc.find(d => d.date === item.date);
    if (existing) {
      const totalCount = existing.count + 1;
      existing.avgDownload = (existing.avgDownload * existing.count + item.avgDownload) / totalCount;
      existing.avgUpload = (existing.avgUpload * existing.count + item.avgUpload) / totalCount;
      existing.avgPing = (existing.avgPing * existing.count + item.avgPing) / totalCount;
      existing.count = totalCount;
      existing.details.push(item);
    } else {
      acc.push({
        ...item,
        count: 1,
        details: [item]
      });
    }
    return acc;
  }, []) : [];

  const sortedData = aggregatedData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());  // Chart dimensions and scaling
  const chartWidth = 1400;
  const chartHeight = 500;
  const padding = { top: 20, right: 60, bottom: 60, left: 60 };

  const downloads = sortedData.map(d => d.avgDownload);
  const uploads = sortedData.map(d => d.avgUpload);
  const pings = sortedData.map(d => d.avgPing);

  const maxDownload = Math.max(...downloads, 0);
  const maxUpload = Math.max(...uploads, 0);
  const maxPing = Math.max(...pings, 0);
  const maxSpeed = Math.max(maxDownload, maxUpload);

  const xScale = (index: number) => padding.left + (index / Math.max(sortedData.length - 1, 1)) * (chartWidth - padding.left - padding.right);
  const ySpeedScale = (value: number) => chartHeight - padding.bottom - (value / maxSpeed) * (chartHeight - padding.top - padding.bottom);
  const yPingScale = (value: number) => chartHeight - padding.bottom - (value / maxPing) * (chartHeight - padding.top - padding.bottom);

  // Event handlers
  const handleMouseMove = (event: React.MouseEvent<SVGCircleElement>, index: number) => {
    const rect = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
    if (rect && sortedData[index]) {
      const dataPoint = sortedData[index] as TrendData & { count: number; details: TrendData[] };
      
      const units = [...new Set(dataPoint.details?.map(d => d.unit).filter(Boolean) || [])];
      const subunits = [...new Set(dataPoint.details?.map(d => d.subunit).filter(Boolean) || [])];
      const sections = [...new Set(dataPoint.details?.map(d => d.section).filter(Boolean) || [])];
      const isps = [...new Set(dataPoint.details?.map(d => d.isp).filter(Boolean) || [])];
      const timeWindows = [...new Set(dataPoint.details?.map(d => d.timeOfDay).filter(Boolean) || [])];
      
      setTooltip({
        visible: true,
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        date: new Date(dataPoint.date).toLocaleDateString(),
        download: dataPoint.avgDownload,
        upload: dataPoint.avgUpload,
        ping: dataPoint.avgPing,
        unit: units.length > 0 ? units.join(', ') : undefined,
        subunit: subunits.length > 0 ? subunits.join(', ') : undefined,
        section: sections.length > 0 ? sections.join(', ') : undefined,
        isp: isps.length > 0 ? isps.join(', ') : undefined,
        time: timeWindows.length > 0 ? timeWindows.join(', ') : undefined,
        testCount: dataPoint.count || 1
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
    return [...new Set(filteredOffices.map((office: Office) => office.subUnitOffice).filter(Boolean))];
  };

  // Memoized available sections based on current unit and subunit selection
  const availableSections = useMemo(() => {
    if (!Array.isArray(offices)) return [];
    
    let filteredOffices = offices;
    if (filters.unit) {
      filteredOffices = filteredOffices.filter((office: Office) => office.unitOffice === filters.unit);
    }
    if (filters.subunit) {
      filteredOffices = filteredOffices.filter((office: Office) => office.subUnitOffice === filters.subunit);
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
  }, [offices, filters.unit, filters.subunit]);  // Memoized available ISPs based on current selections and trend data
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
        filteredTrendData = filteredTrendData.filter((item: TrendData) => item.unit === filters.unit);
      }
      if (filters.subunit) {
        filteredTrendData = filteredTrendData.filter((item: TrendData) => item.subunit === filters.subunit);
      }
      if (filters.section) {
        filteredTrendData = filteredTrendData.filter((item: TrendData) => 
          item.isp && item.isp.includes(`(${filters.section})`)
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
      section: (prev.unit && prev.subunit) ? prev.section : '',
      isp: ''
    }));
  }, [filters.unit]);

  useEffect(() => {
    setFilters(prev => ({
      ...prev,
      section: prev.subunit ? prev.section : '',
      isp: ''
    }));
  }, [filters.subunit]);

  useEffect(() => {
    setFilters(prev => ({
      ...prev,
      isp: ''
    }));
  }, [filters.section]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Network Performance Trends</h1>
        </div>

        {/* Filters */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
            <div className="text-sm text-gray-600">
              Available: {availableISPs.length} ISPs, {availableSections.length} sections
              {filters.unit && ` in ${filters.unit}`}
              {filters.subunit && ` > ${filters.subunit}`}
              {filters.section && ` > ${filters.section}`}
            </div>
          </div>

          {/* Filter Status Indicator */}
          {(filters.unit || filters.subunit || filters.section) && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-sm text-blue-800">
                <strong>Active Filters:</strong>
                {filters.unit && <span className="ml-2 px-2 py-1 bg-blue-100 rounded text-xs">Unit: {filters.unit}</span>}
                {filters.subunit && <span className="ml-2 px-2 py-1 bg-blue-100 rounded text-xs">Subunit: {filters.subunit}</span>}
                {filters.section && <span className="ml-2 px-2 py-1 bg-blue-100 rounded text-xs">Section: {filters.section}</span>}
                {filters.isp && <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 rounded text-xs">ISP: {filters.isp}</span>}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-4">
            {/* Unit Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Unit</label>
              <select
                value={filters.unit}
                onChange={(e) => {
                  setFilters(prev => ({
                    ...prev,
                    unit: e.target.value,
                    subunit: '',
                    isp: '',
                    section: ''
                  }));
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Units</option>
                {getUniqueUnits().map(unit => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
            </div>

            {/* Subunit Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Subunit</label>
              <select
                value={filters.subunit}
                onChange={(e) => {
                  setFilters(prev => ({
                    ...prev,
                    subunit: e.target.value,
                    isp: '',
                    section: ''
                  }));
                }}
                disabled={!filters.unit}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
              >
                <option value="">All Subunits</option>
                {filters.unit && getSubunitsForUnit(filters.unit).map(subunit => (
                  <option key={subunit} value={subunit}>{subunit}</option>
                ))}
              </select>
            </div>

            {/* ISP Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ISP 
                {filters.section && (
                  <span className="text-sm text-blue-600"> (for {filters.section})</span>
                )}                {availableISPs.length === 0 && filters.unit && (
                  <span className="text-sm text-gray-500"> (no ISPs available)</span>
                )}
              </label>              <select
                value={filters.isp}
                onChange={(e) => setFilters(prev => ({ ...prev, isp: e.target.value }))}
                disabled={!filters.unit || availableISPs.length === 0}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
              >
                <option value="">
                  {!filters.unit ? 'Select a unit first' : 
                   availableISPs.length === 0 ? 'No ISPs available' : 
                   filters.section ? `All ISPs (${filters.section})` : 'All ISPs'}
                </option>
                {availableISPs.map(isp => (
                  <option key={isp} value={isp}>{isp}</option>
                ))}
              </select>
            </div>

            {/* Section Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Section 
                {availableSections.length === 0 && filters.unit && (
                  <span className="text-sm text-gray-500"> (no sections available)</span>
                )}
              </label>
              <select
                value={filters.section}
                onChange={(e) => setFilters(prev => ({ ...prev, section: e.target.value, isp: '' }))}
                disabled={availableSections.length === 0}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
              >
                <option value="">
                  {availableSections.length === 0 ? 'No sections available' : 'All Sections'}
                </option>
                {availableSections.map(section => (
                  <option key={section} value={section}>{section}</option>
                ))}
              </select>
            </div>

            {/* Time of Day Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Time of Day</label>
              <select
                value={filters.timeOfDay}
                onChange={(e) => setFilters(prev => ({ ...prev, timeOfDay: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Times</option>
                <option value="morning">Morning (6:00 AM - 11:59 AM)</option>
                <option value="noon">Noon (12:00 PM - 12:59 PM)</option>
                <option value="afternoon">Afternoon (1:00 PM - 6:00 PM)</option>
              </select>
            </div>

            {/* Date Range Filters */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>        {/* Chart */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Performance Trends</h2>
          
          {loading ? (
            <div className="flex justify-center items-center h-96">
              <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
            </div>
          ) : sortedData.length === 0 ? (
            <div className="flex justify-center items-center h-96 text-gray-500">
              No data available for the selected filters
            </div>
          ) : (
            <div className="relative overflow-x-auto">
              <svg width={chartWidth} height={chartHeight} className="border border-gray-200 rounded min-w-full">
                {/* Grid lines */}
                {[0, 1, 2, 3, 4].map(i => (
                  <line
                    key={`speed-grid-${i}`}
                    x1={padding.left}
                    y1={chartHeight - padding.bottom - (i / 4) * (chartHeight - padding.top - padding.bottom)}
                    x2={chartWidth - padding.right}
                    y2={chartHeight - padding.bottom - (i / 4) * (chartHeight - padding.top - padding.bottom)}
                    stroke="#f3f4f6"
                    strokeWidth="1"
                  />
                ))}                {/* Y-axis labels for speed (left side) */}
                {[0, 1, 2, 3, 4].map(i => (
                  <text
                    key={`speed-label-${i}`}
                    x={padding.left - 10}
                    y={chartHeight - padding.bottom - (i / 4) * (chartHeight - padding.top - padding.bottom) + 5}
                    textAnchor="end"
                    className="text-xs fill-blue-600"
                  >
                    {Math.round((i / 4) * maxSpeed)}
                  </text>
                ))}

                {/* Y-axis labels for ping (right side) */}
                {[0, 1, 2, 3, 4].map(i => (
                  <text
                    key={`ping-label-${i}`}
                    x={chartWidth - padding.right + 10}
                    y={chartHeight - padding.bottom - (i / 4) * (chartHeight - padding.top - padding.bottom) + 5}
                    textAnchor="start"
                    className="text-xs fill-yellow-600"
                  >
                    {Math.round((i / 4) * maxPing)}
                  </text>
                ))}

                {/* Y-axis titles */}
                <text
                  x={padding.left - 40}
                  y={chartHeight / 2}
                  textAnchor="middle"
                  className="text-xs fill-blue-600"
                  transform={`rotate(-90, ${padding.left - 40}, ${chartHeight / 2})`}
                >
                  Speed (Mbps)
                </text>
                <text
                  x={chartWidth - padding.right + 40}
                  y={chartHeight / 2}
                  textAnchor="middle"
                  className="text-xs fill-yellow-600"
                  transform={`rotate(90, ${chartWidth - padding.right + 40}, ${chartHeight / 2})`}
                >
                  Ping (ms)
                </text>

                {/* X-axis labels */}
                {sortedData.map((item, index) => {
                  if (index % Math.ceil(sortedData.length / 8) === 0) {
                    return (
                      <text
                        key={`x-label-${index}`}
                        x={xScale(index)}
                        y={chartHeight - padding.bottom + 20}
                        textAnchor="middle"
                        className="text-xs fill-gray-600"
                      >
                        {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </text>
                    );
                  }
                  return null;
                })}                {/* Download line */}
                {visibility.download && (
                  <polyline
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2"
                    points={sortedData.map((item, index) => 
                      `${xScale(index)},${ySpeedScale(item.avgDownload)}`
                    ).join(' ')}
                  />
                )}

                {/* Upload line */}
                {visibility.upload && (
                  <polyline
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2"
                    points={sortedData.map((item, index) => 
                      `${xScale(index)},${ySpeedScale(item.avgUpload)}`
                    ).join(' ')}
                  />
                )}

                {/* Ping line */}
                {visibility.ping && (
                  <polyline
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="2"
                    points={sortedData.map((item, index) => 
                      `${xScale(index)},${yPingScale(item.avgPing)}`
                    ).join(' ')}
                  />
                )}{/* Data points */}
                {sortedData.map((item, index) => {                  const x = xScale(index);
                  const downloadY = ySpeedScale(item.avgDownload);
                  const uploadY = ySpeedScale(item.avgUpload);
                  const pingY = yPingScale(item.avgPing);
                  
                  // Debug log for positioning
                  console.log(`Chart point ${index}:`, {
                    values: { download: item.avgDownload, upload: item.avgUpload, ping: item.avgPing },
                    positions: { x, downloadY, uploadY, pingY },
                    scales: { maxSpeed, maxPing },
                    visibility: visibility
                  });                  return (
                    <g key={index}>
                      {/* Ping dot - render first with largest radius */}
                      {visibility.ping && (
                        <circle
                          cx={x}
                          cy={pingY}
                          r="6"
                          fill="#f59e0b"
                          stroke="#d97706"
                          strokeWidth="2"
                          className="cursor-pointer hover:r-8"
                          onMouseMove={(e) => handleMouseMove(e, index)}
                          onMouseLeave={handleMouseLeave}
                        />
                      )}
                      {/* Upload dot - middle layer */}
                      {visibility.upload && (
                        <circle
                          cx={x}
                          cy={uploadY}
                          r="5"
                          fill="#10b981"
                          stroke="#059669"
                          strokeWidth="2"
                          className="cursor-pointer hover:r-7"
                          onMouseMove={(e) => handleMouseMove(e, index)}
                          onMouseLeave={handleMouseLeave}
                        />
                      )}
                      {/* Download dot - top layer with smallest radius */}
                      {visibility.download && (
                        <circle
                          cx={x}
                          cy={downloadY}
                          r="4"
                          fill="#3b82f6"
                          stroke="#1e40af"
                          strokeWidth="2"
                          className="cursor-pointer hover:r-6"
                          onMouseMove={(e) => handleMouseMove(e, index)}
                          onMouseLeave={handleMouseLeave}
                        />
                      )}
                    </g>
                  );
                })}
              </svg>              {/* Interactive Legend */}
              <div className="flex items-center justify-center mt-4 space-x-6">
                <button
                  onClick={() => setVisibility(prev => ({ ...prev, download: !prev.download }))}
                  className={`flex items-center cursor-pointer transition-opacity hover:opacity-80 ${
                    !visibility.download ? 'opacity-50' : ''
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full mr-2 ${
                    visibility.download ? 'bg-blue-500' : 'bg-gray-300'
                  }`}></div>
                  <span className={`text-sm ${
                    visibility.download ? 'text-gray-700' : 'text-gray-400'
                  }`}>Download (Mbps)</span>
                </button>
                <button
                  onClick={() => setVisibility(prev => ({ ...prev, upload: !prev.upload }))}
                  className={`flex items-center cursor-pointer transition-opacity hover:opacity-80 ${
                    !visibility.upload ? 'opacity-50' : ''
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full mr-2 ${
                    visibility.upload ? 'bg-green-500' : 'bg-gray-300'
                  }`}></div>
                  <span className={`text-sm ${
                    visibility.upload ? 'text-gray-700' : 'text-gray-400'
                  }`}>Upload (Mbps)</span>
                </button>
                <button
                  onClick={() => setVisibility(prev => ({ ...prev, ping: !prev.ping }))}
                  className={`flex items-center cursor-pointer transition-opacity hover:opacity-80 ${
                    !visibility.ping ? 'opacity-50' : ''
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full mr-2 ${
                    visibility.ping ? 'bg-yellow-500' : 'bg-gray-300'
                  }`}></div>
                  <span className={`text-sm ${
                    visibility.ping ? 'text-gray-700' : 'text-gray-400'
                  }`}>Ping (ms)</span>
                </button>
              </div>

              {/* Enhanced Tooltip */}
              {tooltip.visible && (
                <div
                  className="absolute bg-white border border-gray-200 rounded-lg p-4 shadow-xl pointer-events-none z-10 min-w-[300px]"
                  style={{
                    left: Math.min(tooltip.x + 10, chartWidth - 300),
                    top: Math.max(tooltip.y - 150, 10),
                  }}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
                    <div className="text-sm font-semibold text-gray-900">{tooltip.date}</div>
                    <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      {tooltip.testCount} test{tooltip.testCount !== 1 ? 's' : ''}
                    </div>
                  </div>
                  
                  {/* Performance Metrics */}
                  <div className="space-y-1 mb-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-blue-600 font-medium">Download:</span>
                      <span className="text-sm font-semibold text-blue-700">{tooltip.download.toFixed(2)} Mbps</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-green-600 font-medium">Upload:</span>
                      <span className="text-sm font-semibold text-green-700">{tooltip.upload.toFixed(2)} Mbps</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-yellow-600 font-medium">Ping:</span>
                      <span className="text-sm font-semibold text-yellow-700">{tooltip.ping.toFixed(2)} ms</span>
                    </div>
                  </div>
                  
                  {/* Location & Context Details */}
                  {(tooltip.unit || tooltip.subunit || tooltip.section || tooltip.isp || tooltip.time) && (
                    <div className="pt-2 border-t border-gray-100">
                      <div className="text-xs font-medium text-gray-700 mb-2">Details:</div>
                      <div className="space-y-1 text-xs">
                        {tooltip.unit && (
                          <div className="flex items-center">
                            <span className="w-2 h-2 bg-purple-500 rounded-full mr-2"></span>
                            <span className="text-gray-600">Unit:</span>
                            <span className="ml-1 font-medium text-purple-700">{tooltip.unit}</span>
                          </div>
                        )}
                        {tooltip.subunit && (
                          <div className="flex items-center">
                            <span className="w-2 h-2 bg-indigo-500 rounded-full mr-2"></span>
                            <span className="text-gray-600">Subunit:</span>
                            <span className="ml-1 font-medium text-indigo-700">{tooltip.subunit}</span>
                          </div>
                        )}
                        {tooltip.section && (
                          <div className="flex items-center">
                            <span className="w-2 h-2 bg-cyan-500 rounded-full mr-2"></span>
                            <span className="text-gray-600">Section:</span>
                            <span className="ml-1 font-medium text-cyan-700">{tooltip.section}</span>
                          </div>
                        )}
                        {tooltip.isp && (
                          <div className="flex items-center">
                            <span className="w-2 h-2 bg-orange-500 rounded-full mr-2"></span>
                            <span className="text-gray-600">ISP:</span>
                            <span className="ml-1 font-medium text-orange-700">{tooltip.isp}</span>
                          </div>
                        )}
                        {tooltip.time && (
                          <div className="flex items-center">
                            <span className="w-2 h-2 bg-rose-500 rounded-full mr-2"></span>
                            <span className="text-gray-600">Time Window:</span>
                            <span className="ml-1 font-medium text-rose-700 capitalize">{tooltip.time}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}