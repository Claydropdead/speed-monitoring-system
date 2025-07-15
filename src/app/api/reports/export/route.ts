import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';

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

interface SpeedTestData {
  id: string;
  officeId: string;
  download: number;
  upload: number;
  ping: number;
  jitter: number;
  timestamp: Date;
  isp: string;
  office: {
    unitOffice: string;
    subUnitOffice?: string;
    location: string;
    section?: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const config: ReportConfig = await request.json();
    
    // Fetch data based on filters
    const speedTests = await fetchSpeedTestData(config);
    const offices = await fetchOfficesData(config);
    
    // Generate report based on format
    switch (config.format) {
      case 'csv':
        return generateCSVReport(speedTests, config);
      case 'excel':
        return generateExcelReport(speedTests, offices, config);
      case 'pdf':
        return generatePDFReport(speedTests, offices, config);
      default:
        return new NextResponse('Invalid format', { status: 400 });
    }
  } catch (error) {
    console.error('Error generating report:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

async function fetchSpeedTestData(config: ReportConfig) {
  // Build where clause for offices first
  const officeWhereClause: any = {};
  
  if (config.filters.unit) {
    officeWhereClause.unitOffice = config.filters.unit;
  }
  
  if (config.filters.subunit) {
    officeWhereClause.subUnitOffice = config.filters.subunit;
  }

  // Build speed test where clause
  const speedTestWhere: any = {
    timestamp: {
      gte: new Date(config.dateRange.start),
      lte: new Date(config.dateRange.end + 'T23:59:59.999Z'),
    },
  };

  // Apply office filters
  if (Object.keys(officeWhereClause).length > 0) {
    speedTestWhere.office = officeWhereClause;
  }

  // Build ISP filtering conditions
  const ispConditions: any[] = [];

  // Add specific ISP filter if provided
  if (config.filters.isp) {
    ispConditions.push({
      isp: config.filters.isp,
    });
  }

  // Add section-based ISP filtering
  if (config.filters.section) {
    if (config.filters.section === 'General') {
      // For "General" section, get all offices first to determine which ISPs are general
      const allOffices = await prisma.office.findMany({
        where: officeWhereClause,
        select: {
          id: true,
          isp: true,
          isps: true,
          sectionISPs: true
        }
      });
      
      const generalISPNames = new Set<string>();
      
      allOffices.forEach(office => {
        // Add primary ISP
        if (office.isp && office.isp.trim()) {
          generalISPNames.add(office.isp.trim());
        }
        
        // Add ISPs from isps field (JSON array) - these are general ISPs
        if (office.isps) {
          try {
            const ispArray = JSON.parse(office.isps);
            if (Array.isArray(ispArray)) {
              ispArray.forEach(isp => {
                if (typeof isp === 'string' && isp.trim()) {
                  generalISPNames.add(isp.trim());
                }
              });
            }
          } catch (e) {
            console.warn('Invalid ISPs JSON:', office.isps);
          }
        }
      });
      
      // Filter for general ISPs (exact match with known general ISP names)
      if (generalISPNames.size > 0) {
        ispConditions.push({
          isp: {
            in: Array.from(generalISPNames)
          }
        });
      }
    } else {
      // For specific sections, include only ISPs that contain the section name in parentheses
      ispConditions.push({
        isp: {
          contains: `(${config.filters.section})`,
        },
      });
    }
  }

  // Apply ISP conditions
  if (ispConditions.length > 0) {
    if (ispConditions.length === 1) {
      Object.assign(speedTestWhere, ispConditions[0]);
    } else {
      speedTestWhere.OR = ispConditions;
    }
  }

  console.log('🔍 Export API - SpeedTest whereClause:', JSON.stringify(speedTestWhere, null, 2));

  const speedTests = await prisma.speedTest.findMany({
    where: speedTestWhere,
    include: {
      office: {
        select: {
          unitOffice: true,
          subUnitOffice: true,
          location: true,
          section: true,
        },
      },
    },
    orderBy: { timestamp: 'desc' },
  });

  // Apply time slot filtering in post-processing
  let filteredTests = speedTests;
  if (config.filters.timeSlot) {
    filteredTests = speedTests.filter(test => {
      const testHour = new Date(test.timestamp).getHours();
      switch (config.filters.timeSlot) {
        case 'morning':
          return testHour >= 6 && testHour <= 11;
        case 'noon':
          return testHour === 12;
        case 'afternoon':
          return testHour >= 13 && testHour <= 18;
        default:
          return true;
      }
    });
  }

  console.log(`🔍 Export API - Found ${filteredTests.length} speed tests after filtering`);
  
  return filteredTests;
}

async function fetchOfficesData(config: ReportConfig) {
  const whereClause: any = {};
  
  if (config.filters.unit) {
    whereClause.unitOffice = config.filters.unit;
  }
  
  if (config.filters.subunit) {
    whereClause.subUnitOffice = config.filters.subunit;
  }

  return await prisma.office.findMany({
    where: whereClause,
    include: {
      speedTests: {
        where: {
          timestamp: {
            gte: new Date(config.dateRange.start),
            lte: new Date(config.dateRange.end + 'T23:59:59.999Z'),
          },
        },
      },
    },
  });
}

function generateCSVReport(speedTests: any[], config: ReportConfig) {
  let headers: string[] = [];
  let rows: string[][] = [];

  switch (config.type) {
    case 'summary':
      headers = [
        'Office Unit',
        'Sub Unit',
        'Location',
        'Section',
        'ISP',
        'Total Tests',
        'Avg Download (Mbps)',
        'Avg Upload (Mbps)',
        'Avg Ping (ms)',
        'Avg Jitter (ms)',
        'Min Download (Mbps)',
        'Max Download (Mbps)',
        'Min Upload (Mbps)',
        'Max Upload (Mbps)',
        'Success Rate (%)',
      ];

      // Group by office and ISP for summary
      const summaryData = new Map<string, any>();
      speedTests.forEach(test => {
        const key = `${test.office.unitOffice}-${test.office.subUnitOffice || ''}-${test.isp}`;
        if (!summaryData.has(key)) {
          summaryData.set(key, {
            office: test.office,
            isp: test.isp,
            tests: [],
            downloads: [],
            uploads: [],
            pings: [],
            jitters: [],
          });
        }
        const data = summaryData.get(key)!;
        data.tests.push(test);
        data.downloads.push(test.download);
        data.uploads.push(test.upload);
        data.pings.push(test.ping);
        data.jitters.push(test.jitter);
      });

      summaryData.forEach((data) => {
        const avgDownload = data.downloads.reduce((a: number, b: number) => a + b, 0) / data.downloads.length;
        const avgUpload = data.uploads.reduce((a: number, b: number) => a + b, 0) / data.uploads.length;
        const avgPing = data.pings.reduce((a: number, b: number) => a + b, 0) / data.pings.length;
        const avgJitter = data.jitters.reduce((a: number, b: number) => a + b, 0) / data.jitters.length;

        rows.push([
          data.office.unitOffice,
          data.office.subUnitOffice || '',
          data.office.location,
          data.office.section || '',
          data.isp,
          data.tests.length.toString(),
          avgDownload.toFixed(2),
          avgUpload.toFixed(2),
          avgPing.toFixed(2),
          avgJitter.toFixed(2),
          Math.min(...data.downloads).toFixed(2),
          Math.max(...data.downloads).toFixed(2),
          Math.min(...data.uploads).toFixed(2),
          Math.max(...data.uploads).toFixed(2),
          '100.00', // Success rate - could be calculated based on failed tests
        ]);
      });
      break;

    case 'detailed':
      headers = [
        'Date/Time',
        'Office Unit',
        'Sub Unit',
        'Location',
        'Section',
        'ISP',
        'Download (Mbps)',
        'Upload (Mbps)',
        'Ping (ms)',
        'Jitter (ms)',
        'Test ID',
        'Day of Week',
        'Time of Day',
      ];

      rows = speedTests.map(test => {
        const testDate = new Date(test.timestamp);
        const timeOfDay = testDate.getHours() < 12 ? 'Morning' : 
                         testDate.getHours() === 12 ? 'Noon' : 'Afternoon';
        
        return [
          testDate.toLocaleString(),
          test.office.unitOffice,
          test.office.subUnitOffice || '',
          test.office.location,
          test.office.section || '',
          test.isp,
          test.download.toFixed(2),
          test.upload.toFixed(2),
          test.ping.toFixed(2),
          test.jitter.toFixed(2),
          test.id,
          testDate.toLocaleDateString('en-US', { weekday: 'long' }),
          timeOfDay,
        ];
      });
      break;

    case 'compliance':
      headers = [
        'Office Unit',
        'Sub Unit',
        'Section',
        'ISP',
        'Expected Tests',
        'Actual Tests',
        'Compliance Rate (%)',
        'Missing Tests',
        'Last Test Date',
        'Status',
      ];

      // Calculate compliance for each office/ISP combination
      const complianceData = new Map<string, any>();
      const daysInRange = Math.ceil((new Date(config.dateRange.end).getTime() - new Date(config.dateRange.start).getTime()) / (24 * 60 * 60 * 1000)) + 1;
      const expectedTestsPerISP = daysInRange * 3; // 3 tests per day

      speedTests.forEach(test => {
        const key = `${test.office.unitOffice}-${test.office.subUnitOffice || ''}-${test.isp}`;
        if (!complianceData.has(key)) {
          complianceData.set(key, {
            office: test.office,
            isp: test.isp,
            actualTests: 0,
            lastTestDate: test.timestamp,
          });
        }
        const data = complianceData.get(key)!;
        data.actualTests++;
        if (new Date(test.timestamp) > new Date(data.lastTestDate)) {
          data.lastTestDate = test.timestamp;
        }
      });

      complianceData.forEach((data) => {
        const complianceRate = (data.actualTests / expectedTestsPerISP) * 100;
        const status = complianceRate >= 90 ? 'Good' : complianceRate >= 70 ? 'Warning' : 'Critical';
        
        rows.push([
          data.office.unitOffice,
          data.office.subUnitOffice || '',
          data.office.section || '',
          data.isp,
          expectedTestsPerISP.toString(),
          data.actualTests.toString(),
          complianceRate.toFixed(2),
          (expectedTestsPerISP - data.actualTests).toString(),
          new Date(data.lastTestDate).toLocaleDateString(),
          status,
        ]);
      });
      break;

    case 'performance':
      headers = [
        'Date',
        'Office Unit',
        'Sub Unit',
        'ISP',
        'Avg Download (Mbps)',
        'Avg Upload (Mbps)',
        'Avg Ping (ms)',
        'Peak Download (Mbps)',
        'Peak Upload (Mbps)',
        'Min Ping (ms)',
        'Test Count',
        'Performance Score',
      ];

      // Group by date and office/ISP for performance analysis
      const performanceData = new Map<string, any>();
      speedTests.forEach(test => {
        const date = new Date(test.timestamp).toISOString().split('T')[0];
        const key = `${date}-${test.office.unitOffice}-${test.office.subUnitOffice || ''}-${test.isp}`;
        if (!performanceData.has(key)) {
          performanceData.set(key, {
            date,
            office: test.office,
            isp: test.isp,
            downloads: [],
            uploads: [],
            pings: [],
          });
        }
        const data = performanceData.get(key)!;
        data.downloads.push(test.download);
        data.uploads.push(test.upload);
        data.pings.push(test.ping);
      });

      performanceData.forEach((data) => {
        const avgDownload = data.downloads.reduce((a: number, b: number) => a + b, 0) / data.downloads.length;
        const avgUpload = data.uploads.reduce((a: number, b: number) => a + b, 0) / data.uploads.length;
        const avgPing = data.pings.reduce((a: number, b: number) => a + b, 0) / data.pings.length;
        const peakDownload = Math.max(...data.downloads);
        const peakUpload = Math.max(...data.uploads);
        const minPing = Math.min(...data.pings);
        
        // Simple performance score (can be enhanced)
        const performanceScore = Math.min(100, (avgDownload / 10) * 0.4 + (avgUpload / 5) * 0.3 + (100 / avgPing) * 0.3);

        rows.push([
          data.date,
          data.office.unitOffice,
          data.office.subUnitOffice || '',
          data.isp,
          avgDownload.toFixed(2),
          avgUpload.toFixed(2),
          avgPing.toFixed(2),
          peakDownload.toFixed(2),
          peakUpload.toFixed(2),
          minPing.toFixed(2),
          data.downloads.length.toString(),
          performanceScore.toFixed(2),
        ]);
      });
      break;

    default:
      // Fallback to detailed report
      headers = [
        'Date/Time',
        'Office Unit',
        'Sub Unit',
        'Location',
        'Section',
        'ISP',
        'Download (Mbps)',
        'Upload (Mbps)',
        'Ping (ms)',
        'Jitter (ms)',
      ];

      rows = speedTests.map(test => [
        new Date(test.timestamp).toLocaleString(),
        test.office.unitOffice,
        test.office.subUnitOffice || '',
        test.office.location,
        test.office.section || '',
        test.isp,
        test.download.toFixed(2),
        test.upload.toFixed(2),
        test.ping.toFixed(2),
        test.jitter.toFixed(2),
      ]);
  }

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');

  return new NextResponse(csvContent, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="speed-test-report-${config.type}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}

function generateExcelReport(speedTests: any[], offices: any[], config: ReportConfig) {
  // For now, return the same structure as CSV but with Excel MIME type
  // In a real implementation, you'd use a library like 'exceljs' to create proper Excel files
  
  let headers: string[] = [];
  let rows: string[][] = [];

  switch (config.type) {
    case 'summary':
      headers = [
        'Office Unit',
        'Sub Unit',
        'Location',
        'Section',
        'ISP',
        'Total Tests',
        'Avg Download (Mbps)',
        'Avg Upload (Mbps)',
        'Avg Ping (ms)',
        'Avg Jitter (ms)',
        'Min Download (Mbps)',
        'Max Download (Mbps)',
        'Min Upload (Mbps)',
        'Max Upload (Mbps)',
        'Success Rate (%)',
      ];

      // Group by office and ISP for summary
      const summaryData = new Map<string, any>();
      speedTests.forEach(test => {
        const key = `${test.office.unitOffice}-${test.office.subUnitOffice || ''}-${test.isp}`;
        if (!summaryData.has(key)) {
          summaryData.set(key, {
            office: test.office,
            isp: test.isp,
            tests: [],
            downloads: [],
            uploads: [],
            pings: [],
            jitters: [],
          });
        }
        const data = summaryData.get(key)!;
        data.tests.push(test);
        data.downloads.push(test.download);
        data.uploads.push(test.upload);
        data.pings.push(test.ping);
        data.jitters.push(test.jitter);
      });

      summaryData.forEach((data) => {
        const avgDownload = data.downloads.reduce((a: number, b: number) => a + b, 0) / data.downloads.length;
        const avgUpload = data.uploads.reduce((a: number, b: number) => a + b, 0) / data.uploads.length;
        const avgPing = data.pings.reduce((a: number, b: number) => a + b, 0) / data.pings.length;
        const avgJitter = data.jitters.reduce((a: number, b: number) => a + b, 0) / data.jitters.length;

        rows.push([
          data.office.unitOffice,
          data.office.subUnitOffice || '',
          data.office.location,
          data.office.section || '',
          data.isp,
          data.tests.length.toString(),
          avgDownload.toFixed(2),
          avgUpload.toFixed(2),
          avgPing.toFixed(2),
          avgJitter.toFixed(2),
          Math.min(...data.downloads).toFixed(2),
          Math.max(...data.downloads).toFixed(2),
          Math.min(...data.uploads).toFixed(2),
          Math.max(...data.uploads).toFixed(2),
          '100.00',
        ]);
      });
      break;

    case 'detailed':
      headers = [
        'Date/Time',
        'Office Unit',
        'Sub Unit',
        'Location',
        'Section',
        'ISP',
        'Download (Mbps)',
        'Upload (Mbps)',
        'Ping (ms)',
        'Jitter (ms)',
        'Test ID',
        'Day of Week',
        'Time of Day',
      ];

      rows = speedTests.map(test => {
        const testDate = new Date(test.timestamp);
        const timeOfDay = testDate.getHours() < 12 ? 'Morning' : 
                         testDate.getHours() === 12 ? 'Noon' : 'Afternoon';
        
        return [
          testDate.toLocaleString(),
          test.office.unitOffice,
          test.office.subUnitOffice || '',
          test.office.location,
          test.office.section || '',
          test.isp,
          test.download.toFixed(2),
          test.upload.toFixed(2),
          test.ping.toFixed(2),
          test.jitter.toFixed(2),
          test.id,
          testDate.toLocaleDateString('en-US', { weekday: 'long' }),
          timeOfDay,
        ];
      });
      break;

    case 'compliance':
      headers = [
        'Office Unit',
        'Sub Unit',
        'Section',
        'ISP',
        'Expected Tests',
        'Actual Tests',
        'Compliance Rate (%)',
        'Missing Tests',
        'Last Test Date',
        'Status',
      ];

      const complianceData = new Map<string, any>();
      const daysInRange = Math.ceil((new Date(config.dateRange.end).getTime() - new Date(config.dateRange.start).getTime()) / (24 * 60 * 60 * 1000)) + 1;
      const expectedTestsPerISP = daysInRange * 3;

      speedTests.forEach(test => {
        const key = `${test.office.unitOffice}-${test.office.subUnitOffice || ''}-${test.isp}`;
        if (!complianceData.has(key)) {
          complianceData.set(key, {
            office: test.office,
            isp: test.isp,
            actualTests: 0,
            lastTestDate: test.timestamp,
          });
        }
        const data = complianceData.get(key)!;
        data.actualTests++;
        if (new Date(test.timestamp) > new Date(data.lastTestDate)) {
          data.lastTestDate = test.timestamp;
        }
      });

      complianceData.forEach((data) => {
        const complianceRate = (data.actualTests / expectedTestsPerISP) * 100;
        const status = complianceRate >= 90 ? 'Good' : complianceRate >= 70 ? 'Warning' : 'Critical';
        
        rows.push([
          data.office.unitOffice,
          data.office.subUnitOffice || '',
          data.office.section || '',
          data.isp,
          expectedTestsPerISP.toString(),
          data.actualTests.toString(),
          complianceRate.toFixed(2),
          (expectedTestsPerISP - data.actualTests).toString(),
          new Date(data.lastTestDate).toLocaleDateString(),
          status,
        ]);
      });
      break;

    case 'performance':
      headers = [
        'Date',
        'Office Unit',
        'Sub Unit',
        'ISP',
        'Avg Download (Mbps)',
        'Avg Upload (Mbps)',
        'Avg Ping (ms)',
        'Peak Download (Mbps)',
        'Peak Upload (Mbps)',
        'Min Ping (ms)',
        'Test Count',
        'Performance Score',
      ];

      const performanceData = new Map<string, any>();
      speedTests.forEach(test => {
        const date = new Date(test.timestamp).toISOString().split('T')[0];
        const key = `${date}-${test.office.unitOffice}-${test.office.subUnitOffice || ''}-${test.isp}`;
        if (!performanceData.has(key)) {
          performanceData.set(key, {
            date,
            office: test.office,
            isp: test.isp,
            downloads: [],
            uploads: [],
            pings: [],
          });
        }
        const data = performanceData.get(key)!;
        data.downloads.push(test.download);
        data.uploads.push(test.upload);
        data.pings.push(test.ping);
      });

      performanceData.forEach((data) => {
        const avgDownload = data.downloads.reduce((a: number, b: number) => a + b, 0) / data.downloads.length;
        const avgUpload = data.uploads.reduce((a: number, b: number) => a + b, 0) / data.uploads.length;
        const avgPing = data.pings.reduce((a: number, b: number) => a + b, 0) / data.pings.length;
        const peakDownload = Math.max(...data.downloads);
        const peakUpload = Math.max(...data.uploads);
        const minPing = Math.min(...data.pings);
        
        const performanceScore = Math.min(100, (avgDownload / 10) * 0.4 + (avgUpload / 5) * 0.3 + (100 / avgPing) * 0.3);

        rows.push([
          data.date,
          data.office.unitOffice,
          data.office.subUnitOffice || '',
          data.isp,
          avgDownload.toFixed(2),
          avgUpload.toFixed(2),
          avgPing.toFixed(2),
          peakDownload.toFixed(2),
          peakUpload.toFixed(2),
          minPing.toFixed(2),
          data.downloads.length.toString(),
          performanceScore.toFixed(2),
        ]);
      });
      break;

    default:
      headers = [
        'Date/Time',
        'Office Unit',
        'Sub Unit',
        'Location',
        'Section',
        'ISP',
        'Download (Mbps)',
        'Upload (Mbps)',
        'Ping (ms)',
        'Jitter (ms)',
      ];

      rows = speedTests.map(test => [
        new Date(test.timestamp).toLocaleString(),
        test.office.unitOffice,
        test.office.subUnitOffice || '',
        test.office.location,
        test.office.section || '',
        test.isp,
        test.download.toFixed(2),
        test.upload.toFixed(2),
        test.ping.toFixed(2),
        test.jitter.toFixed(2),
      ]);
  }

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');

  return new NextResponse(csvContent, {
    headers: {
      'Content-Type': 'application/vnd.ms-excel',
      'Content-Disposition': `attachment; filename="speed-test-report-${config.type}-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}

function generatePDFReport(speedTests: any[], offices: any[], config: ReportConfig) {
  // Generate a proper HTML report that can be printed as PDF
  
  const stats = calculateStats(speedTests);
  const complianceData = calculateCompliance(offices, speedTests, config);
  
  let reportContent = '';
  
  switch (config.type) {
    case 'summary':
      reportContent = generateSummaryReport(speedTests, stats);
      break;
    case 'detailed':
      reportContent = generateDetailedReport(speedTests, config);
      break;
    case 'compliance':
      reportContent = generateComplianceReport(speedTests, complianceData, config);
      break;
    case 'performance':
      reportContent = generatePerformanceReport(speedTests, stats);
      break;
    default:
      reportContent = generateSummaryReport(speedTests, stats);
  }
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Speed Test Report - ${getReportTypeName(config.type)}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          margin: 0; 
          padding: 20px; 
          color: #333; 
          line-height: 1.6; 
          background-color: #fff;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { 
          text-align: center; 
          border-bottom: 3px solid #2563eb; 
          padding-bottom: 20px; 
          margin-bottom: 30px; 
          background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
          padding: 30px;
          border-radius: 8px;
        }
        .title { 
          font-size: 32px; 
          font-weight: bold; 
          color: #1e293b; 
          margin-bottom: 10px; 
        }
        .subtitle { 
          font-size: 16px; 
          color: #64748b; 
          margin-bottom: 10px;
        }
        .report-meta {
          background: #f1f5f9;
          padding: 15px;
          border-radius: 6px;
          margin-top: 15px;
          font-size: 14px;
          color: #475569;
        }
        .section { 
          margin-bottom: 35px; 
          page-break-inside: avoid; 
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .section-title { 
          font-size: 22px; 
          font-weight: bold; 
          color: #1e293b; 
          margin-bottom: 20px; 
          border-bottom: 2px solid #3b82f6; 
          padding-bottom: 10px; 
          display: flex;
          align-items: center;
        }
        .section-title::before {
          content: "📊";
          margin-right: 10px;
          font-size: 20px;
        }
        .subsection-title { 
          font-size: 18px; 
          font-weight: bold; 
          color: #374151; 
          margin: 25px 0 15px 0; 
        }
        .stats-grid { 
          display: grid; 
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); 
          gap: 20px; 
          margin-bottom: 25px; 
        }
        .stat-card { 
          background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); 
          padding: 20px; 
          border-radius: 10px; 
          border: 1px solid #e2e8f0; 
          text-align: center;
          transition: transform 0.2s;
        }
        .stat-card:hover { transform: translateY(-2px); }
        .stat-label { 
          font-size: 12px; 
          color: #64748b; 
          text-transform: uppercase; 
          letter-spacing: 1px; 
          margin-bottom: 8px; 
          font-weight: 600;
        }
        .stat-value { 
          font-size: 28px; 
          font-weight: bold; 
          color: #1e293b; 
          margin-bottom: 5px;
        }
        .stat-unit { 
          font-size: 14px; 
          color: #64748b; 
        }
        .table { 
          width: 100%; 
          border-collapse: collapse; 
          margin-top: 20px; 
          font-size: 13px; 
          background: #fff;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .table th, .table td { 
          border: 1px solid #e2e8f0; 
          padding: 12px 8px; 
          text-align: left; 
        }
        .table th { 
          background: #f8fafc; 
          font-weight: bold; 
          color: #374151;
          border-bottom: 2px solid #d1d5db;
        }
        .table tr:nth-child(even) { background: #f9fafb; }
        .table tr:hover { background: #f1f5f9; }
        .page-break { page-break-before: always; }
        .summary-box { 
          background: #dbeafe; 
          border: 1px solid #93c5fd; 
          padding: 20px; 
          border-radius: 8px; 
          margin: 20px 0; 
          border-left: 4px solid #3b82f6;
        }
        .warning-box { 
          background: #fef3c7; 
          border: 1px solid #fbbf24; 
          padding: 20px; 
          border-radius: 8px; 
          margin: 20px 0; 
          border-left: 4px solid #f59e0b;
        }
        .success-box { 
          background: #d1fae5; 
          border: 1px solid #10b981; 
          padding: 20px; 
          border-radius: 8px; 
          margin: 20px 0; 
          border-left: 4px solid #059669;
        }
        .error-box { 
          background: #fee2e2; 
          border: 1px solid #ef4444; 
          padding: 20px; 
          border-radius: 8px; 
          margin: 20px 0; 
          border-left: 4px solid #dc2626;
        }
        .chart-placeholder { 
          background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%); 
          border: 2px dashed #9ca3af; 
          padding: 60px; 
          text-align: center; 
          margin: 25px 0; 
          border-radius: 10px;
          color: #6b7280;
        }
        .filter-summary { 
          background: #f8fafc; 
          border: 1px solid #e2e8f0; 
          padding: 20px; 
          border-radius: 8px; 
          margin-bottom: 25px; 
        }
        .filter-item { 
          display: inline-block; 
          background: #3b82f6; 
          color: white; 
          padding: 6px 12px; 
          border-radius: 20px; 
          margin: 3px; 
          font-size: 12px; 
          font-weight: 500;
        }
        .footer {
          margin-top: 50px;
          padding-top: 25px;
          border-top: 2px solid #e2e8f0;
          text-align: center;
          color: #64748b;
          font-size: 12px;
          background: #f8fafc;
          padding: 25px;
          border-radius: 8px;
        }
        .no-data {
          text-align: center;
          padding: 40px;
          color: #64748b;
          font-style: italic;
        }
        @media print { 
          body { 
            margin: 0; 
            font-size: 11px; 
            background: white !important;
          } 
          .section { 
            box-shadow: none; 
            border: 1px solid #ccc;
          }
          .page-break { page-break-before: always; }
          .section { page-break-inside: avoid; }
          .stat-card:hover { transform: none; }
          .table tr:hover { background: transparent; }
        }
        @media screen {
          .print-button {
            position: fixed;
            top: 20px;
            right: 20px;
            background: #3b82f6;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 500;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            z-index: 1000;
          }
          .print-button:hover {
            background: #2563eb;
          }
        }
      </style>
      <script>
        function printReport() {
          window.print();
        }
        window.onload = function() {
          document.title = "Speed Test Report - ${getReportTypeName(config.type)} - ${new Date().toLocaleDateString()}";
        }
      </script>
    </head>
    <body>
      <button class="print-button" onclick="printReport()">🖨️ Print/Save as PDF</button>
      
      <div class="container">
        <div class="header">
          <div class="title">📊 Speed Test Report</div>
          <div class="subtitle">${getReportTypeName(config.type)}</div>
          <div class="report-meta">
            <strong>Generated:</strong> ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}<br>
            <strong>Period:</strong> ${config.dateRange.start} to ${config.dateRange.end}<br>
            <strong>Total Records:</strong> ${speedTests.length} speed tests
          </div>
        </div>

        ${generateFilterSummary(config)}

        <div class="section">
          <div class="section-title">Executive Summary</div>
          ${speedTests.length === 0 ? `
            <div class="no-data">
              <h3>No Data Available</h3>
              <p>No speed test data found for the selected criteria. Please adjust your filters or date range.</p>
            </div>
          ` : `
            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-label">Total Tests</div>
                <div class="stat-value">${speedTests.length}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Avg Download</div>
                <div class="stat-value">${stats.avgDownload.toFixed(1)}</div>
                <div class="stat-unit">Mbps</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Avg Upload</div>
                <div class="stat-value">${stats.avgUpload.toFixed(1)}</div>
                <div class="stat-unit">Mbps</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Avg Ping</div>
                <div class="stat-value">${stats.avgPing.toFixed(1)}</div>
                <div class="stat-unit">ms</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Compliance Rate</div>
                <div class="stat-value">${complianceData.overallCompliance.toFixed(1)}</div>
                <div class="stat-unit">%</div>
              </div>
            </div>
          `}
        </div>

        ${speedTests.length > 0 ? reportContent : ''}

        ${config.includeCharts && speedTests.length > 0 ? `
        <div class="section">
          <div class="section-title">Performance Visualization</div>
          <div class="chart-placeholder">
            � Interactive charts available in the web application<br>
            <small>Visit the Analytics dashboard for detailed performance charts and trends</small>
          </div>
        </div>
        ` : ''}

        <div class="section">
          <div class="section-title">Report Information</div>
          <table class="table" style="max-width: 600px;">
            <tr><td><strong>Report Type</strong></td><td>${getReportTypeName(config.type)}</td></tr>
            <tr><td><strong>Export Format</strong></td><td>PDF (HTML)</td></tr>
            <tr><td><strong>Date Range</strong></td><td>${config.dateRange.start} to ${config.dateRange.end}</td></tr>
            <tr><td><strong>Filters Applied</strong></td><td>${config.filters.unit || config.filters.subunit || config.filters.isp || config.filters.section || config.filters.timeSlot ? 'Yes' : 'None'}</td></tr>
            <tr><td><strong>Include Charts</strong></td><td>${config.includeCharts ? 'Yes' : 'No'}</td></tr>
            <tr><td><strong>Include Raw Data</strong></td><td>${config.includeRawData ? 'Yes' : 'No'}</td></tr>
            <tr><td><strong>Generated By</strong></td><td>Speed Test Monitoring System</td></tr>
            <tr><td><strong>Generation Time</strong></td><td>${new Date().toLocaleString()}</td></tr>
          </table>
        </div>

        <div class="footer">
          <p><strong>Speed Test Monitoring System</strong></p>
          <p>This report was automatically generated. For questions or support, please contact your system administrator.</p>
          <p>To save as PDF: Use your browser's Print function and select "Save as PDF" as the destination.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return new NextResponse(htmlContent, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `inline; filename="speed-test-report-${config.type}-${new Date().toISOString().slice(0, 10)}.html"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    },
  });
}

function calculateStats(speedTests: any[]) {
  if (speedTests.length === 0) {
    return { avgDownload: 0, avgUpload: 0, avgPing: 0, avgJitter: 0 };
  }

  const totals = speedTests.reduce(
    (acc, test) => ({
      download: acc.download + test.download,
      upload: acc.upload + test.upload,
      ping: acc.ping + test.ping,
      jitter: acc.jitter + test.jitter,
    }),
    { download: 0, upload: 0, ping: 0, jitter: 0 }
  );

  return {
    avgDownload: totals.download / speedTests.length,
    avgUpload: totals.upload / speedTests.length,
    avgPing: totals.ping / speedTests.length,
    avgJitter: totals.jitter / speedTests.length,
  };
}

function calculateCompliance(offices: any[], speedTests: any[], config: ReportConfig) {
  // Calculate expected tests based on date range and office count
  const daysInRange = Math.ceil((new Date(config.dateRange.end).getTime() - new Date(config.dateRange.start).getTime()) / (24 * 60 * 60 * 1000)) + 1;
  const totalExpectedTests = offices.length * 3 * daysInRange; // 3 tests per day per office
  const actualTests = speedTests.length;
  const overallCompliance = totalExpectedTests > 0 ? (actualTests / totalExpectedTests) * 100 : 0;

  return {
    overallCompliance: Math.min(overallCompliance, 100),
    totalExpectedTests,
    actualTests,
    daysInRange,
  };
}

function generateFilterSummary(config: ReportConfig) {
  const hasFilters = 
    config.filters.unit ||
    config.filters.subunit ||
    config.filters.isp ||
    config.filters.section ||
    config.filters.timeSlot;

  if (!hasFilters) {
    return '<div class="summary-box"><strong>Filters:</strong> No filters applied - showing all data</div>';
  }

  return `
    <div class="filter-summary">
      <strong>Applied Filters:</strong><br>
      ${config.filters.unit ? `<span class="filter-item">Unit: ${config.filters.unit}</span>` : ''}
      ${config.filters.subunit ? `<span class="filter-item">Sub-unit: ${config.filters.subunit}</span>` : ''}
      ${config.filters.isp ? `<span class="filter-item">ISP: ${config.filters.isp}</span>` : ''}
      ${config.filters.section ? `<span class="filter-item">Section: ${config.filters.section}</span>` : ''}
      ${config.filters.timeSlot ? `<span class="filter-item">Time Slot: ${config.filters.timeSlot}</span>` : ''}
    </div>
  `;
}

function generateSummaryReport(speedTests: any[], stats: any) {
  // Group data by office and ISP for summary
  const summaryData = new Map<string, any>();
  speedTests.forEach(test => {
    const key = `${test.office.unitOffice}-${test.office.subUnitOffice || ''}-${test.isp}`;
    if (!summaryData.has(key)) {
      summaryData.set(key, {
        office: test.office,
        isp: test.isp,
        tests: [],
        downloads: [],
        uploads: [],
        pings: [],
      });
    }
    const data = summaryData.get(key)!;
    data.tests.push(test);
    data.downloads.push(test.download);
    data.uploads.push(test.upload);
    data.pings.push(test.ping);
  });

  let tableRows = '';
  summaryData.forEach((data) => {
    const avgDownload = data.downloads.reduce((a: number, b: number) => a + b, 0) / data.downloads.length;
    const avgUpload = data.uploads.reduce((a: number, b: number) => a + b, 0) / data.uploads.length;
    const avgPing = data.pings.reduce((a: number, b: number) => a + b, 0) / data.pings.length;

    tableRows += `
      <tr>
        <td>${data.office.unitOffice}</td>
        <td>${data.office.subUnitOffice || ''}</td>
        <td>${data.office.location}</td>
        <td>${data.isp}</td>
        <td>${data.tests.length}</td>
        <td>${avgDownload.toFixed(2)}</td>
        <td>${avgUpload.toFixed(2)}</td>
        <td>${avgPing.toFixed(2)}</td>
        <td>${Math.min(...data.downloads).toFixed(2)}</td>
        <td>${Math.max(...data.downloads).toFixed(2)}</td>
      </tr>
    `;
  });

  return `
    <div class="section">
      <div class="section-title">Office Performance Summary</div>
      <table class="table">
        <thead>
          <tr>
            <th>Office Unit</th>
            <th>Sub Unit</th>
            <th>Location</th>
            <th>ISP</th>
            <th>Total Tests</th>
            <th>Avg Download (Mbps)</th>
            <th>Avg Upload (Mbps)</th>
            <th>Avg Ping (ms)</th>
            <th>Min Download (Mbps)</th>
            <th>Max Download (Mbps)</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    </div>
  `;
}

function generateDetailedReport(speedTests: any[], config: ReportConfig) {
  const limitedTests = config.includeRawData ? speedTests.slice(0, 500) : speedTests.slice(0, 50);
  
  let tableRows = '';
  limitedTests.forEach(test => {
    const testDate = new Date(test.timestamp);
    const timeOfDay = testDate.getHours() < 12 ? 'Morning' : 
                     testDate.getHours() === 12 ? 'Noon' : 'Afternoon';
    
    tableRows += `
      <tr>
        <td>${testDate.toLocaleString()}</td>
        <td>${test.office.unitOffice}</td>
        <td>${test.office.subUnitOffice || ''}</td>
        <td>${test.office.location}</td>
        <td>${test.isp}</td>
        <td>${test.download.toFixed(2)}</td>
        <td>${test.upload.toFixed(2)}</td>
        <td>${test.ping.toFixed(2)}</td>
        <td>${timeOfDay}</td>
      </tr>
    `;
  });

  return `
    <div class="section page-break">
      <div class="section-title">Detailed Test Results</div>
      <table class="table">
        <thead>
          <tr>
            <th>Date/Time</th>
            <th>Office Unit</th>
            <th>Sub Unit</th>
            <th>Location</th>
            <th>ISP</th>
            <th>Download (Mbps)</th>
            <th>Upload (Mbps)</th>
            <th>Ping (ms)</th>
            <th>Time of Day</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
      ${speedTests.length > limitedTests.length ? `<p style="margin-top: 10px; font-style: italic; color: #6b7280;">Showing first ${limitedTests.length} results of ${speedTests.length} total. Full data available in CSV/Excel export.</p>` : ''}
    </div>
  `;
}

function generateComplianceReport(speedTests: any[], complianceData: any, config: ReportConfig) {
  // Calculate compliance per office/ISP
  const complianceMap = new Map<string, any>();
  const daysInRange = complianceData.daysInRange;
  const expectedTestsPerISP = daysInRange * 3;

  speedTests.forEach(test => {
    const key = `${test.office.unitOffice}-${test.office.subUnitOffice || ''}-${test.isp}`;
    if (!complianceMap.has(key)) {
      complianceMap.set(key, {
        office: test.office,
        isp: test.isp,
        actualTests: 0,
        lastTestDate: test.timestamp,
      });
    }
    const data = complianceMap.get(key)!;
    data.actualTests++;
    if (new Date(test.timestamp) > new Date(data.lastTestDate)) {
      data.lastTestDate = test.timestamp;
    }
  });

  let tableRows = '';
  complianceMap.forEach((data) => {
    const complianceRate = (data.actualTests / expectedTestsPerISP) * 100;
    const status = complianceRate >= 90 ? 'Good' : complianceRate >= 70 ? 'Warning' : 'Critical';
    const statusClass = complianceRate >= 90 ? 'success-box' : complianceRate >= 70 ? 'warning-box' : 'error-box';
    
    tableRows += `
      <tr class="${statusClass.replace('-box', '')}">
        <td>${data.office.unitOffice}</td>
        <td>${data.office.subUnitOffice || ''}</td>
        <td>${data.isp}</td>
        <td>${expectedTestsPerISP}</td>
        <td>${data.actualTests}</td>
        <td>${complianceRate.toFixed(2)}%</td>
        <td>${expectedTestsPerISP - data.actualTests}</td>
        <td>${new Date(data.lastTestDate).toLocaleDateString()}</td>
        <td><strong>${status}</strong></td>
      </tr>
    `;
  });

  return `
    <div class="section">
      <div class="section-title">Compliance Analysis</div>
      <div class="summary-box">
        <strong>Compliance Summary:</strong> Based on requirement of 3 tests per day for ${daysInRange} days (${expectedTestsPerISP} tests per ISP per office).
      </div>
      <table class="table">
        <thead>
          <tr>
            <th>Office Unit</th>
            <th>Sub Unit</th>
            <th>ISP</th>
            <th>Expected Tests</th>
            <th>Actual Tests</th>
            <th>Compliance Rate</th>
            <th>Missing Tests</th>
            <th>Last Test Date</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    </div>
  `;
}

function generatePerformanceReport(speedTests: any[], stats: any) {
  // Group by date for performance trends
  const performanceData = new Map<string, any>();
  speedTests.forEach(test => {
    const date = new Date(test.timestamp).toISOString().split('T')[0];
    if (!performanceData.has(date)) {
      performanceData.set(date, {
        date,
        downloads: [],
        uploads: [],
        pings: [],
        tests: 0,
      });
    }
    const data = performanceData.get(date)!;
    data.downloads.push(test.download);
    data.uploads.push(test.upload);
    data.pings.push(test.ping);
    data.tests++;
  });

  let tableRows = '';
  const sortedDates = Array.from(performanceData.keys()).sort();
  
  sortedDates.forEach(date => {
    const data = performanceData.get(date)!;
    const avgDownload = data.downloads.reduce((a: number, b: number) => a + b, 0) / data.downloads.length;
    const avgUpload = data.uploads.reduce((a: number, b: number) => a + b, 0) / data.uploads.length;
    const avgPing = data.pings.reduce((a: number, b: number) => a + b, 0) / data.pings.length;
    const peakDownload = Math.max(...data.downloads);
    const peakUpload = Math.max(...data.uploads);
    
    // Simple performance score calculation
    const performanceScore = Math.min(100, (avgDownload / 50) * 40 + (avgUpload / 25) * 30 + (100 / avgPing) * 30);
    
    tableRows += `
      <tr>
        <td>${new Date(date).toLocaleDateString()}</td>
        <td>${data.tests}</td>
        <td>${avgDownload.toFixed(2)}</td>
        <td>${avgUpload.toFixed(2)}</td>
        <td>${avgPing.toFixed(2)}</td>
        <td>${peakDownload.toFixed(2)}</td>
        <td>${peakUpload.toFixed(2)}</td>
        <td>${performanceScore.toFixed(1)}</td>
      </tr>
    `;
  });

  return `
    <div class="section">
      <div class="section-title">Performance Trends Analysis</div>
      <div class="summary-box">
        <strong>Performance Metrics:</strong> Daily performance analysis with peak values and calculated performance scores.
      </div>
      <table class="table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Tests</th>
            <th>Avg Download (Mbps)</th>
            <th>Avg Upload (Mbps)</th>
            <th>Avg Ping (ms)</th>
            <th>Peak Download (Mbps)</th>
            <th>Peak Upload (Mbps)</th>
            <th>Performance Score</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    </div>
  `;
}

function getReportTypeName(type: string) {
  const types = {
    summary: 'Executive Summary',
    detailed: 'Detailed Analysis',
    compliance: 'Compliance Report',
    performance: 'Performance Trends',
  };
  return types[type as keyof typeof types] || type;
}
