'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '../../../components/dashboard-layout';
import { 
  FileText, 
  Download, 
  Calendar, 
  Building2, 
  Wifi, 
  Clock, 
  Filter,
  FileSpreadsheet,
  FileImage,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Users,
  Activity
} from 'lucide-react';

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

interface ReportConfig {
  type: 'summary' | 'detailed' | 'compliance' | 'performance';
  format: 'pdf' | 'excel' | 'csv';
  dateRange: {
    start: string;
    end: string;
  };
  filters: {
    unit: string;
    subunit: string;
    isp: string;
    section: string;
    timeSlot: string;
  };
  includeCharts: boolean;
  includeRawData: boolean;
}

export default function ExportReportsPage() {
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(false);
  const [reportConfig, setReportConfig] = useState<ReportConfig>({
    type: 'summary',
    format: 'pdf',
    dateRange: {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      end: new Date().toISOString().split('T')[0],
    },
    filters: {
      unit: '',
      subunit: '',
      isp: '',
      section: '',
      timeSlot: '',
    },
    includeCharts: true,
    includeRawData: false,
  });
  const [exportStatus, setExportStatus] = useState<{
    status: 'idle' | 'generating' | 'success' | 'error';
    message: string;
  }>({ status: 'idle', message: '' });

  // Fetch offices data
  useEffect(() => {
    fetchOffices();
  }, []);

  const fetchOffices = async () => {
    try {
      const response = await fetch('/api/offices');
      if (response.ok) {
        const result = await response.json();
        const data = result.offices || result;
        setOffices(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error fetching offices:', error);
    }
  };

  // Get unique values for filters
  const getUniqueUnits = () => [...new Set(offices.map(o => o.unitOffice))];
  const getUniqueSubunits = () => [...new Set(offices.map(o => o.subUnitOffice).filter(Boolean))];
  const getUniqueISPs = () => {
    const isps = new Set<string>();
    offices.forEach(office => {
      if (office.isp) isps.add(office.isp);
      if (office.isps) {
        try {
          const ispArray = JSON.parse(office.isps);
          if (Array.isArray(ispArray)) {
            ispArray.forEach(isp => isps.add(isp));
          }
        } catch (e) {
          // Ignore invalid JSON
        }
      }
    });
    return Array.from(isps);
  };

  const getUniqueSections = () => {
    const sections = new Set<string>();
    offices.forEach(office => {
      // Add section if it exists
      if (office.section) {
        sections.add(office.section);
      }
      
      // Parse sectionISPs to get section names
      try {
        if (office.sectionISPs) {
          const sectionISPData = JSON.parse(office.sectionISPs);
          if (typeof sectionISPData === 'object' && sectionISPData !== null) {
            Object.keys(sectionISPData).forEach(section => {
              if (section && section !== 'general') {
                sections.add(section);
              }
            });
          }
        }
      } catch (e) {
        // Ignore invalid JSON
      }
    });
    
    // Always include General section
    sections.add('General');
    
    return Array.from(sections).sort();
  };

  const handleGenerateReport = async () => {
    setLoading(true);
    setExportStatus({ status: 'generating', message: 'Generating report...' });

    try {
      const response = await fetch('/api/reports/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reportConfig),
      });

      if (response.ok) {
        // For PDF reports, open in new tab instead of downloading
        if (reportConfig.format === 'pdf') {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          window.open(url, '_blank');
          window.URL.revokeObjectURL(url);
          
          setExportStatus({ 
            status: 'success', 
            message: 'PDF report opened in new tab. Use browser\'s print function to save as PDF.' 
          });
        } else {
          // For Excel and CSV, download as usual
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          
          // Generate filename based on report config
          const timestamp = new Date().toISOString().slice(0, 10);
          const filename = `speed-test-report-${reportConfig.type}-${timestamp}.${reportConfig.format}`;
          a.download = filename;
          
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);

          setExportStatus({ 
            status: 'success', 
            message: 'Report generated and downloaded successfully!' 
          });
        }
      } else {
        throw new Error('Failed to generate report');
      }
    } catch (error) {
      console.error('Error generating report:', error);
      setExportStatus({ 
        status: 'error', 
        message: 'Failed to generate report. Please try again.' 
      });
    } finally {
      setLoading(false);
      // Clear status after 5 seconds
      setTimeout(() => {
        setExportStatus({ status: 'idle', message: '' });
      }, 5000);
    }
  };

  const reportTypes = [
    {
      id: 'summary',
      name: 'Executive Summary',
      description: 'High-level overview with key metrics and compliance rates',
      icon: FileText,
    },
    {
      id: 'detailed',
      name: 'Detailed Analysis',
      description: 'Comprehensive report with all test results and trends',
      icon: Activity,
    },
    {
      id: 'compliance',
      name: 'Compliance Report',
      description: 'Focus on SLA compliance and missed test requirements',
      icon: CheckCircle2,
    },
    {
      id: 'performance',
      name: 'Performance Trends',
      description: 'Speed and latency trends over time with comparisons',
      icon: Users,
    },
  ];

  const formatOptions = [
    {
      id: 'pdf',
      name: 'PDF Report',
      description: 'Opens in browser - use print function to save as PDF',
      icon: FileText,
      color: 'text-red-600',
    },
    {
      id: 'excel',
      name: 'Excel Workbook',
      description: 'Spreadsheet with multiple sheets and raw data',
      icon: FileSpreadsheet,
      color: 'text-green-600',
    },
    {
      id: 'csv',
      name: 'CSV Data',
      description: 'Raw data export for further analysis',
      icon: FileImage,
      color: 'text-blue-600',
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Export Reports</h1>
            <p className="text-gray-600 mt-2">Generate comprehensive speed test reports and analytics</p>
          </div>
          <div className="flex items-center space-x-4">
            {exportStatus.status !== 'idle' && (
              <div className={`flex items-center space-x-2 px-4 py-2 rounded-lg ${
                exportStatus.status === 'generating' ? 'bg-blue-50 text-blue-700' :
                exportStatus.status === 'success' ? 'bg-green-50 text-green-700' :
                'bg-red-50 text-red-700'
              }`}>
                {exportStatus.status === 'generating' && <Loader2 className="h-4 w-4 animate-spin" />}
                {exportStatus.status === 'success' && <CheckCircle2 className="h-4 w-4" />}
                {exportStatus.status === 'error' && <AlertCircle className="h-4 w-4" />}
                <span className="text-sm font-medium">{exportStatus.message}</span>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Configuration Panel */}
          <div className="xl:col-span-2 space-y-6">
            {/* Report Type Selection */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Report Type</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {reportTypes.map((type) => {
                  const IconComponent = type.icon;
                  return (
                    <div
                      key={type.id}
                      className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        reportConfig.type === type.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setReportConfig(prev => ({ ...prev, type: type.id as any }))}
                    >
                      <div className="flex items-start space-x-3">
                        <IconComponent className={`h-5 w-5 mt-0.5 ${
                          reportConfig.type === type.id ? 'text-blue-600' : 'text-gray-400'
                        }`} />
                        <div>
                          <h3 className="font-medium text-gray-900">{type.name}</h3>
                          <p className="text-sm text-gray-600 mt-1">{type.description}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Export Format */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Export Format</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {formatOptions.map((format) => {
                  const IconComponent = format.icon;
                  return (
                    <div
                      key={format.id}
                      className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        reportConfig.format === format.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setReportConfig(prev => ({ ...prev, format: format.id as any }))}
                    >
                      <div className="text-center">
                        <IconComponent className={`h-8 w-8 mx-auto ${
                          reportConfig.format === format.id ? 'text-blue-600' : format.color
                        }`} />
                        <h3 className="font-medium text-gray-900 mt-2">{format.name}</h3>
                        <p className="text-xs text-gray-600 mt-1">{format.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Date Range */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Date Range</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Calendar className="h-4 w-4 inline mr-1" />
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={reportConfig.dateRange.start}
                    onChange={(e) => setReportConfig(prev => ({
                      ...prev,
                      dateRange: { ...prev.dateRange, start: e.target.value }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Calendar className="h-4 w-4 inline mr-1" />
                    End Date
                  </label>
                  <input
                    type="date"
                    value={reportConfig.dateRange.end}
                    onChange={(e) => setReportConfig(prev => ({
                      ...prev,
                      dateRange: { ...prev.dateRange, end: e.target.value }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Advanced Options */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Advanced Options</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900">Include Charts & Visualizations</h3>
                    <p className="text-sm text-gray-600">Add performance charts and graphs to the report</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={reportConfig.includeCharts}
                      onChange={(e) => setReportConfig(prev => ({
                        ...prev,
                        includeCharts: e.target.checked
                      }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900">Include Raw Test Data</h3>
                    <p className="text-sm text-gray-600">Include detailed test results and timestamps</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={reportConfig.includeRawData}
                      onChange={(e) => setReportConfig(prev => ({
                        ...prev,
                        includeRawData: e.target.checked
                      }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Filters & Action Panel */}
          <div className="space-y-6">
            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                <Filter className="h-5 w-5 inline mr-2" />
                Filters
              </h2>
              
              <div className="space-y-4">
                {/* Units Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Building2 className="h-4 w-4 inline mr-1" />
                    Unit
                  </label>
                  <select
                    value={reportConfig.filters.unit}
                    onChange={(e) => {
                      setReportConfig(prev => ({
                        ...prev,
                        filters: { ...prev.filters, unit: e.target.value, subunit: '' } // Clear subunit when unit changes
                      }));
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Units</option>
                    {getUniqueUnits().map(unit => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                </div>

                {/* Sub-units Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Building2 className="h-4 w-4 inline mr-1" />
                    Sub-unit
                  </label>
                  <select
                    value={reportConfig.filters.subunit}
                    onChange={(e) => {
                      setReportConfig(prev => ({
                        ...prev,
                        filters: { ...prev.filters, subunit: e.target.value }
                      }));
                    }}
                    disabled={!reportConfig.filters.unit}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="">All Sub-units</option>
                    {reportConfig.filters.unit && getUniqueSubunits()
                      .filter(subunit => {
                        // Filter subunits based on selected unit
                        return offices.some(office => 
                          office.unitOffice === reportConfig.filters.unit && 
                          office.subUnitOffice === subunit
                        );
                      })
                      .map(subunit => (
                        <option key={subunit} value={subunit}>{subunit}</option>
                      ))
                    }
                  </select>
                </div>

                {/* ISPs Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Wifi className="h-4 w-4 inline mr-1" />
                    ISP
                  </label>
                  <select
                    value={reportConfig.filters.isp}
                    onChange={(e) => {
                      setReportConfig(prev => ({
                        ...prev,
                        filters: { ...prev.filters, isp: e.target.value }
                      }));
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All ISPs</option>
                    {getUniqueISPs().map(isp => (
                      <option key={isp} value={isp}>{isp}</option>
                    ))}
                  </select>
                </div>

                {/* Sections Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Building2 className="h-4 w-4 inline mr-1" />
                    Section
                  </label>
                  <select
                    value={reportConfig.filters.section}
                    onChange={(e) => {
                      setReportConfig(prev => ({
                        ...prev,
                        filters: { ...prev.filters, section: e.target.value }
                      }));
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Sections</option>
                    {getUniqueSections().map(section => (
                      <option key={section} value={section}>{section}</option>
                    ))}
                  </select>
                </div>

                {/* Time Slots Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Clock className="h-4 w-4 inline mr-1" />
                    Time Slot
                  </label>
                  <select
                    value={reportConfig.filters.timeSlot}
                    onChange={(e) => {
                      setReportConfig(prev => ({
                        ...prev,
                        filters: { ...prev.filters, timeSlot: e.target.value }
                      }));
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Time Slots</option>
                    <option value="morning">Morning (6:00 AM - 11:59 AM)</option>
                    <option value="noon">Noon (12:00 PM - 12:59 PM)</option>
                    <option value="afternoon">Afternoon (1:00 PM - 6:00 PM)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Generate Report Action */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Generate Report</h2>
              
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-2">Report Summary</h3>
                  <div className="space-y-1 text-sm text-gray-600">
                    <p><strong>Type:</strong> {reportTypes.find(t => t.id === reportConfig.type)?.name}</p>
                    <p><strong>Format:</strong> {formatOptions.find(f => f.id === reportConfig.format)?.name}</p>
                    <p><strong>Date Range:</strong> {reportConfig.dateRange.start} to {reportConfig.dateRange.end}</p>
                    <p><strong>Charts:</strong> {reportConfig.includeCharts ? 'Included' : 'Not included'}</p>
                    <p><strong>Raw Data:</strong> {reportConfig.includeRawData ? 'Included' : 'Not included'}</p>
                  </div>
                </div>

                <button
                  onClick={handleGenerateReport}
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <Download className="h-5 w-5" />
                      <span>Generate & Download Report</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
