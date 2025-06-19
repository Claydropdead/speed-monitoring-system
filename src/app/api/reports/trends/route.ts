import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';
import { startOfDay, endOfDay, parseISO, format, eachDayOfInterval } from 'date-fns';

interface TrendDataPoint {
  date: string;
  download: number;
  upload: number;
  ping: number;
}

interface OfficeData {
  office: {
    id: string;
    unitOffice: string;
    subUnitOffice?: string;
    location: string;
    section?: string;
  };
  data: TrendDataPoint[];
  latestValues: {
    download: number;
    upload: number;
    ping: number;
    date: string;
  };
}

// Type for the final API response expected by frontend
interface TrendResponse {
  date: string;
  office: string;
  unit: string;
  subunit?: string;
  section?: string;
  isp?: string;
  timeOfDay?: string;
  avgDownload: number;
  avgUpload: number;
  avgPing: number;
  testCount: number;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if ((session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const unit = searchParams.get('unit');
    const subunit = searchParams.get('subunit');
    const isp = searchParams.get('isp');
    const section = searchParams.get('section');
    const timeOfDay = searchParams.get('timeOfDay');

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      );
    }    const start = startOfDay(parseISO(startDate));
    const end = endOfDay(parseISO(endDate));

    // Build where clause for office filtering
    const whereClause: any = {};
    if (unit) {
      whereClause.unitOffice = unit;
    }
    if (subunit) {
      whereClause.subUnitOffice = subunit;
    }
    if (section) {
      whereClause.section = section;
    }

    // Build speed test where clause
    const speedTestWhere: any = {
      timestamp: {
        gte: start,
        lte: end,
      },
    };

    // Add ISP filter - handle partial matches for ISPs with sections like "PLDT (IT)"
    if (isp) {
      speedTestWhere.isp = {
        contains: isp
      };
    }    // Fetch offices with their speed tests
    const offices = await prisma.office.findMany({
      where: whereClause,
      include: {
        speedTests: {
          where: speedTestWhere,
          orderBy: {
            timestamp: 'asc',
          },
        },
      },
    });
    
    // Return individual data points with office and ISP details for granular tooltips
    const detailedTrendData: TrendResponse[] = [];
    
    offices.forEach((office: any) => {
      // Filter speed tests by time of day if specified
      let filteredTests = office.speedTests;
      if (timeOfDay) {
        let hourStart = 0, hourEnd = 23;
        switch (timeOfDay) {
          case 'morning':
            hourStart = 6; hourEnd = 11; // 6:00 AM - 11:59 AM
            break;
          case 'noon':
            hourStart = 12; hourEnd = 12; // 12:00 PM - 12:59 PM
            break;
          case 'afternoon':
            hourStart = 13; hourEnd = 18; // 1:00 PM - 6:00 PM
            break;
        }
          filteredTests = office.speedTests.filter((test: any) => {
          const testHour = new Date(test.timestamp).getHours();
          return testHour >= hourStart && testHour <= hourEnd;
        });
      }

      // Group speed tests by date and ISP
      const testsByDateAndISP = new Map<string, Map<string, any[]>>();
      
      filteredTests.forEach((test: any) => {
        const testDate = format(test.timestamp, 'yyyy-MM-dd');
        const testISP = test.isp || 'Unknown';
        
        if (!testsByDateAndISP.has(testDate)) {
          testsByDateAndISP.set(testDate, new Map<string, any[]>());
        }
        
        const dateMap = testsByDateAndISP.get(testDate)!;
        if (!dateMap.has(testISP)) {
          dateMap.set(testISP, []);
        }
        
        dateMap.get(testISP)!.push(test);
      });

      // Create data points for each date-ISP combination
      testsByDateAndISP.forEach((ispMap, date) => {
        ispMap.forEach((tests, ispName) => {
          if (tests.length > 0) {
            // Calculate averages for this date-ISP combination
            const totals = tests.reduce(
              (acc: any, test: any) => ({
                download: acc.download + test.download,
                upload: acc.upload + test.upload,
                ping: acc.ping + test.ping,
              }),
              { download: 0, upload: 0, ping: 0 }
            );

            const avgDownload = totals.download / tests.length;
            const avgUpload = totals.upload / tests.length;
            const avgPing = totals.ping / tests.length;

            // Only add if we have meaningful data
            if (avgDownload > 0 || avgUpload > 0 || avgPing > 0) {
              detailedTrendData.push({
                date,
                office: `${office.unitOffice}${office.subUnitOffice ? ' > ' + office.subUnitOffice : ''}`,
                unit: office.unitOffice,
                subunit: office.subUnitOffice || undefined,
                section: office.section || undefined,
                isp: ispName,
                timeOfDay: timeOfDay || undefined,
                avgDownload,
                avgUpload,
                avgPing,
                testCount: tests.length
              });
            }
          }
        });
      });
    });    // Sort detailed data by date
    detailedTrendData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return NextResponse.json(detailedTrendData);
  } catch (error) {
    console.error('Error fetching trend data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
