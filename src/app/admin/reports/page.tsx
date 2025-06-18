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
  }>({
    visible: false,
    x: 0,
    y: 0,
    date: '',
    download: 0,
    upload: 0,
    ping: 0
  });  useEffect(() => {
    fetchOffices();
    fetchTrendData();
  }, []);

  useEffect(() => {
    fetchTrendData();
  }, [filters]);

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
  };
  const getUniqueUnits = () => {
    if (!Array.isArray(offices)) return [];
    return [...new Set(offices.map((office: Office) => office.unitOffice))];
  };

  const getSubunitsForUnit = (unit: string) => {
    if (!Array.isArray(offices)) return [];
    const filteredOffices = offices.filter((office: Office) => office.unitOffice === unit);
    return [...new Set(filteredOffices.map((office: Office) => office.subUnitOffice).filter(Boolean))];
  };  // Memoized available ISPs based on current unit, subunit, and section selection
  const availableISPs = useMemo(() => {
    if (!Array.isArray(offices)) return [];
    
    console.log('All offices data:', offices);
    
    // Filter offices based on selected unit and subunit
    let filteredOffices = offices;
    if (filters.unit) {
      filteredOffices = filteredOffices.filter((office: Office) => office.unitOffice === filters.unit);
    }
    if (filters.subunit) {
      filteredOffices = filteredOffices.filter((office: Office) => office.subUnitOffice === filters.subunit);
    }
    
    console.log('Filtered offices for ISPs:', filteredOffices);
    
    const isps = new Set<string>();
    filteredOffices.forEach((office: Office) => {
      // If a section is selected, prioritize section-specific ISPs
      if (filters.section && office.sectionISPs) {
        try {
          const sectionISPsObj = JSON.parse(office.sectionISPs);
          if (typeof sectionISPsObj === 'object' && sectionISPsObj[filters.section]) {
            const sectionSpecificISPs = sectionISPsObj[filters.section];
            if (Array.isArray(sectionSpecificISPs)) {
              sectionSpecificISPs.forEach(isp => {
                isps.add(isp);
                console.log('Added section-specific ISP:', isp, 'for section:', filters.section);
              });
            } else if (typeof sectionSpecificISPs === 'string') {
              isps.add(sectionSpecificISPs);
              console.log('Added section-specific ISP:', sectionSpecificISPs, 'for section:', filters.section);
            }
            return; // Skip other ISPs if we have section-specific ones
          }
        } catch (e) {
          console.warn('Error parsing sectionISPs for office:', office.unitOffice, e);
        }
      }
      
      // Add primary ISP
      if (office.isp) {
        isps.add(office.isp);
        console.log('Added primary ISP:', office.isp, 'from office:', office.unitOffice);
      }
      
      // Add ISPs from the isps JSON array
      if (office.isps) {
        try {
          const ispArray = JSON.parse(office.isps);
          if (Array.isArray(ispArray)) {
            ispArray.forEach(isp => {
              isps.add(isp);
              console.log('Added ISP from array:', isp, 'from office:', office.unitOffice);
            });
          }
        } catch (e) {
          // If not valid JSON, treat as single ISP
          if (office.isps) {
            isps.add(office.isps);
            console.log('Added ISP as string:', office.isps, 'from office:', office.unitOffice);
          }
        }
      }
      
      // Add all ISPs from sectionISPs mapping if no specific section is selected
      if (!filters.section && office.sectionISPs) {
        try {
          const sectionISPsObj = JSON.parse(office.sectionISPs);
          if (typeof sectionISPsObj === 'object') {
            Object.values(sectionISPsObj).forEach((isp: any) => {
              if (typeof isp === 'string') {
                isps.add(isp);
                console.log('Added ISP from section mapping:', isp, 'from office:', office.unitOffice);
              } else if (Array.isArray(isp)) {
                isp.forEach(subIsp => {
                  isps.add(subIsp);
                  console.log('Added ISP from section array:', subIsp, 'from office:', office.unitOffice);
                });
              }
            });
          }
        } catch (e) {
          console.warn('Error parsing sectionISPs for office:', office.unitOffice, e);
        }
      }
    });
    
    const result = Array.from(isps);
    console.log('Final ISP list:', result);
    return result;
  }, [offices, filters.unit, filters.subunit, filters.section]);
  // Memoized available sections based on current unit and subunit selection
  const availableSections = useMemo(() => {
    if (!Array.isArray(offices)) return [];
    
    console.log('All offices for sections:', offices.map(o => ({ 
      unitOffice: o.unitOffice, 
      subUnitOffice: o.subUnitOffice, 
      section: o.section 
    })));
    
    // Filter offices based on selected unit and subunit
    let filteredOffices = offices;
    if (filters.unit) {
      filteredOffices = filteredOffices.filter((office: Office) => office.unitOffice === filters.unit);
      console.log('Offices after unit filter:', filteredOffices.map(o => ({ 
        unitOffice: o.unitOffice, 
        subUnitOffice: o.subUnitOffice, 
        section: o.section 
      })));
    }
    if (filters.subunit) {
      filteredOffices = filteredOffices.filter((office: Office) => office.subUnitOffice === filters.subunit);
      console.log('Offices after subunit filter:', filteredOffices.map(o => ({ 
        unitOffice: o.unitOffice, 
        subUnitOffice: o.subUnitOffice, 
        section: o.section 
      })));
    }
    
    const sections = new Set<string>();
    filteredOffices.forEach((office: Office) => {
      if (office.section) {
        sections.add(office.section);
        console.log('Added section:', office.section, 'from office:', office.unitOffice, office.subUnitOffice);
      }
      
      // Also check if there are sections in the sectionISPs mapping
      if (office.sectionISPs) {
        try {
          const sectionISPsObj = JSON.parse(office.sectionISPs);
          if (typeof sectionISPsObj === 'object') {
            Object.keys(sectionISPsObj).forEach(section => {
              sections.add(section);
              console.log('Added section from ISP mapping:', section, 'from office:', office.unitOffice);
            });
          }
        } catch (e) {
          console.warn('Error parsing sectionISPs for sections in office:', office.unitOffice, e);
        }
      }
    });
    
    const result = Array.from(sections);
    console.log('Final sections list:', result);
    return result;
  }, [offices, filters.unit, filters.subunit]);
  const getUniqueISPs = () => {
    return availableISPs;
  };

  const getUniqueSections = () => {
    return availableSections;
  };
  // Reset invalid filter selections when available options change
  useEffect(() => {
    if (filters.isp && !availableISPs.includes(filters.isp)) {
      setFilters(prev => ({ ...prev, isp: '' }));
    }
    if (filters.section && !availableSections.includes(filters.section)) {
      setFilters(prev => ({ ...prev, section: '' }));
    }
  }, [availableISPs, availableSections, filters.isp, filters.section]);

  // Aggregate data by date
  const aggregatedData = Array.isArray(trendData) ? trendData.reduce((acc: Array<TrendData & { count: number }>, item: TrendData) => {
    const existing = acc.find((d: TrendData & { count: number }) => d.date === item.date);
    if (existing) {
      existing.avgDownload = (existing.avgDownload + item.avgDownload) / 2;
      existing.avgUpload = (existing.avgUpload + item.avgUpload) / 2;
      existing.avgPing = (existing.avgPing + item.avgPing) / 2;
      existing.count++;
    } else {
      acc.push({
        ...item,
        count: 1
      });
    }
    return acc;
  }, []) : [];

  // Sort by date
  const sortedData = aggregatedData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Chart dimensions
  const chartWidth = 800;
  const chartHeight = 400;
  const padding = { top: 20, right: 100, bottom: 60, left: 60 };

  // Get data ranges for scaling
  const downloads = sortedData.map(d => d.avgDownload);
  const uploads = sortedData.map(d => d.avgUpload);
  const pings = sortedData.map(d => d.avgPing);

  const maxDownload = Math.max(...downloads, 0);
  const maxUpload = Math.max(...uploads, 0);
  const maxPing = Math.max(...pings, 0);
  const maxSpeed = Math.max(maxDownload, maxUpload);

  // Create scales
  const xScale = (index: number) => padding.left + (index / Math.max(sortedData.length - 1, 1)) * (chartWidth - padding.left - padding.right);
  const ySpeedScale = (value: number) => chartHeight - padding.bottom - (value / maxSpeed) * (chartHeight - padding.top - padding.bottom);
  const yPingScale = (value: number) => chartHeight - padding.bottom - (value / maxPing) * (chartHeight - padding.top - padding.bottom);

  const handleMouseMove = (event: React.MouseEvent<SVGCircleElement>, index: number) => {
    const rect = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
    if (rect && sortedData[index]) {
      setTooltip({
        visible: true,
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        date: new Date(sortedData[index].date).toLocaleDateString(),
        download: sortedData[index].avgDownload,
        upload: sortedData[index].avgUpload,
        ping: sortedData[index].avgPing
      });
    }
  };

  const handleMouseLeave = () => {
    setTooltip(prev => ({ ...prev, visible: false }));
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Network Performance Trends</h1>
        </div>        {/* Filters */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">          <div className="flex justify-between items-center mb-4">
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Unit</label>              <select
                value={filters.unit}
                onChange={(e) => {
                  setFilters(prev => ({
                    ...prev,
                    unit: e.target.value,
                    subunit: '', // Reset subunit when unit changes
                    isp: '', // Reset ISP when unit changes
                    section: '' // Reset section when unit changes
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
                    isp: '', // Reset ISP when subunit changes
                    section: '' // Reset section when subunit changes
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
            </div>            {/* ISP Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ISP 
                {filters.section && (
                  <span className="text-sm text-blue-600"> (for {filters.section})</span>
                )}
                {availableISPs.length === 0 && filters.unit && (
                  <span className="text-sm text-gray-500"> (no ISPs available)</span>
                )}
              </label>
              <select
                value={filters.isp}
                onChange={(e) => setFilters(prev => ({ ...prev, isp: e.target.value }))}
                disabled={availableISPs.length === 0}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
              >
                <option value="">
                  {availableISPs.length === 0 ? 'No ISPs available' : 
                   filters.section ? `All ISPs for ${filters.section}` : 'All ISPs'}
                </option>
                {availableISPs.map(isp => (
                  <option key={isp} value={isp}>{isp}</option>
                ))}
              </select>
            </div>

            {/* Section Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Section {availableSections.length === 0 && filters.unit && (
                  <span className="text-sm text-gray-500">(no sections available)</span>
                )}
              </label>              <select
                value={filters.section}
                onChange={(e) => {
                  setFilters(prev => ({
                    ...prev,
                    section: e.target.value,
                    isp: '' // Reset ISP when section changes to show section-specific ISPs
                  }));
                }}
                disabled={availableSections.length === 0}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
              >
                <option value="">
                  {availableSections.length === 0 ? 'No sections available' : 'All Sections'}
                </option>
                {availableSections.map(section => (
                  <option key={section} value={section}>{section}</option>
                ))}
              </select>
            </div>            {/* Time of Day Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Testing Window</label>
              <select
                value={filters.timeOfDay}
                onChange={(e) => setFilters(prev => ({ ...prev, timeOfDay: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Testing Windows</option>
                <option value="morning">Morning (6:00 AM - 11:59 AM)</option>
                <option value="noon">Noon (12:00 PM - 12:59 PM)</option>
                <option value="afternoon">Afternoon (1:00 PM - 6:00 PM)</option>
              </select>
            </div>

            {/* Date Range */}
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
        </div>

        {/* Chart */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance Trends</h2>
          
          {loading ? (
            <div className="flex items-center justify-center h-96">
              <div className="text-gray-500">Loading chart data...</div>
            </div>
          ) : sortedData.length === 0 ? (
            <div className="flex items-center justify-center h-96">
              <div className="text-gray-500">No data available for the selected filters</div>
            </div>
          ) : (
            <div className="relative">
              {/* Legend */}
              <div className="flex items-center space-x-6 mb-4">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-1 bg-blue-500"></div>
                  <span className="text-sm text-gray-600">Download (Mbps)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-1 bg-green-500"></div>
                  <span className="text-sm text-gray-600">Upload (Mbps)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-1 bg-yellow-500"></div>
                  <span className="text-sm text-gray-600">Ping (ms)</span>
                </div>
              </div>

              <svg
                width={chartWidth}
                height={chartHeight}
                className="border border-gray-200 rounded"
                onMouseLeave={handleMouseLeave}
              >
                {/* Grid lines */}
                <defs>
                  <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                    <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#f3f4f6" strokeWidth="1"/>
                  </pattern>
                </defs>
                <rect width={chartWidth} height={chartHeight} fill="url(#grid)" />

                {/* Y-axis labels for speed */}
                {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
                  const value = maxSpeed * ratio;
                  const y = ySpeedScale(value);
                  return (
                    <g key={`speed-${ratio}`}>
                      <line
                        x1={padding.left}
                        y1={y}
                        x2={chartWidth - padding.right}
                        y2={y}
                        stroke="#e5e7eb"
                        strokeWidth="1"
                      />
                      <text
                        x={padding.left - 10}
                        y={y + 4}
                        textAnchor="end"
                        fontSize="12"
                        fill="#6b7280"
                      >
                        {value.toFixed(0)}
                      </text>
                    </g>
                  );
                })}

                {/* X-axis labels */}
                {sortedData.map((item, index) => {
                  if (index % Math.ceil(sortedData.length / 8) === 0) {
                    const x = xScale(index);
                    return (
                      <text
                        key={`date-${index}`}
                        x={x}
                        y={chartHeight - padding.bottom + 20}
                        textAnchor="middle"
                        fontSize="12"
                        fill="#6b7280"
                      >
                        {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </text>
                    );
                  }
                  return null;
                })}

                {/* Download line */}
                <polyline
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="2"
                  points={sortedData.map((item, index) => 
                    `${xScale(index)},${ySpeedScale(item.avgDownload)}`
                  ).join(' ')}
                />

                {/* Upload line */}
                <polyline
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2"
                  points={sortedData.map((item, index) => 
                    `${xScale(index)},${ySpeedScale(item.avgUpload)}`
                  ).join(' ')}
                />

                {/* Ping line */}
                <polyline
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="2"
                  points={sortedData.map((item, index) => 
                    `${xScale(index)},${yPingScale(item.avgPing)}`
                  ).join(' ')}
                />

                {/* Data points */}
                {sortedData.map((item, index) => {
                  const x = xScale(index);
                  const downloadY = ySpeedScale(item.avgDownload);
                  const uploadY = ySpeedScale(item.avgUpload);
                  const pingY = yPingScale(item.avgPing);
                  
                  return (
                    <g key={index}>
                      <circle
                        cx={x}
                        cy={downloadY}
                        r="4"
                        fill="#3b82f6"
                        stroke="white"
                        strokeWidth="2"
                        className="cursor-pointer hover:r-5"
                        onMouseMove={(e) => handleMouseMove(e, index)}
                      />
                      <circle
                        cx={x}
                        cy={uploadY}
                        r="4"
                        fill="#10b981"
                        stroke="white"
                        strokeWidth="2"
                        className="cursor-pointer hover:r-5"
                        onMouseMove={(e) => handleMouseMove(e, index)}
                      />
                      <circle
                        cx={x}
                        cy={pingY}
                        r="4"
                        fill="#f59e0b"
                        stroke="white"
                        strokeWidth="2"
                        className="cursor-pointer hover:r-5"
                        onMouseMove={(e) => handleMouseMove(e, index)}
                      />
                    </g>
                  );
                })}
              </svg>

              {/* Tooltip */}
              {tooltip.visible && (
                <div
                  className="absolute bg-white border border-gray-200 rounded-lg p-3 shadow-lg pointer-events-none z-10"
                  style={{
                    left: Math.min(tooltip.x + 10, chartWidth - 220),
                    top: Math.max(tooltip.y - 100, 10),
                  }}
                >
                  <div className="text-sm font-semibold text-gray-900 mb-2">{tooltip.date}</div>
                  <div className="text-sm text-blue-600 font-medium">Download: {tooltip.download.toFixed(2)} Mbps</div>
                  <div className="text-sm text-green-600 font-medium">Upload: {tooltip.upload.toFixed(2)} Mbps</div>
                  <div className="text-sm text-yellow-600 font-medium">Ping: {tooltip.ping.toFixed(2)} ms</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
