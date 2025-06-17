import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { TimeSlot } from '@prisma/client';

// Helper function to get time slot for a given hour
function getTimeSlotForHour(hour: number): TimeSlot | null {
  if (hour >= 6 && hour <= 11) return TimeSlot.MORNING;    // 6:00 AM - 11:59 AM
  if (hour === 12) return TimeSlot.NOON;                   // 12:00 PM - 12:59 PM
  if (hour >= 13 && hour <= 18) return TimeSlot.AFTERNOON; // 1:00 PM - 6:00 PM
  return null;
}

// Helper function to check if a timestamp falls within the time slot window
function isWithinTimeSlot(timestamp: Date, timeSlot: TimeSlot): boolean {
  const hour = timestamp.getHours();
  const slot = getTimeSlotForHour(hour);
  return slot === timeSlot;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');
    const unitFilter = searchParams.get('unit');
    const subunitFilter = searchParams.get('subunit');
    const targetDate = dateParam ? new Date(dateParam) : new Date();
    
    // Set to start and end of the target date
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Build the where clause for office filtering
    const officeWhereClause: any = {};
    
    if (unitFilter) {
      officeWhereClause.unitOffice = unitFilter;
    }
    
    if (subunitFilter) {
      officeWhereClause.subUnitOffice = subunitFilter;
    }

    // Get filtered offices with their ISPs
    const offices = await prisma.office.findMany({
      where: officeWhereClause,
      select: {
        id: true,
        unitOffice: true,
        subUnitOffice: true,
        location: true,
        isp: true,
        isps: true,
        sectionISPs: true,
      },
      orderBy: {
        unitOffice: 'asc',
      },
    });

    // If no offices match the filter criteria, return early
    if (offices.length === 0) {
      return NextResponse.json({
        date: targetDate.toISOString().split('T')[0],
        summary: {
          totalOffices: 0,
          fullyCompliantOffices: 0,
          partiallyCompliantOffices: 0,
          nonCompliantOffices: 0,
          overallCompliancePercentage: 0,
        },
        offices: [],
        timeSlots: {
          morning: { label: 'Morning', window: '6:00 AM - 11:59 AM' },
          noon: { label: 'Noon', window: '12:00 PM - 12:59 PM' },
          afternoon: { label: 'Afternoon', window: '1:00 PM - 6:00 PM' },
        },
      });
    }

    // Get office IDs for optimized speed test query
    const officeIds = offices.map(office => office.id);

    // Get speed tests only for filtered offices and target date
    const speedTests = await prisma.speedTest.findMany({
      where: {
        officeId: {
          in: officeIds,
        },
        timestamp: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      select: {
        id: true,
        officeId: true,
        timestamp: true,
        download: true,
        upload: true,
        ping: true,
        isp: true,
      },
      orderBy: {
        timestamp: 'desc',
      },
    });// Process monitoring data for each office
    const monitoringData = offices.map((office) => {
      const officeTests = speedTests.filter(test => test.officeId === office.id);
      let officeIsps: string[] = [];      // Safely parse ISPs and create section-specific ISP identifiers
      let allISPs: Array<{isp: string, section: string}> = [];
      
      try {
        // Add general ISPs with proper double JSON handling
        if (office.isps) {
          let generalISPs = JSON.parse(office.isps);
          
          // Handle case where JSON is double-encoded as string
          if (typeof generalISPs === 'string') {
            try {
              generalISPs = JSON.parse(generalISPs);
            } catch (e) {
              // If it fails to parse again, treat as single ISP string
              generalISPs = [generalISPs];
            }
          }
          
          if (Array.isArray(generalISPs)) {
            generalISPs.forEach(isp => {
              if (isp && isp.trim()) {
                allISPs.push({ isp: isp.trim(), section: 'General' });
              }
            });
          } else if (typeof generalISPs === 'string' && generalISPs.trim()) {
            allISPs.push({ isp: generalISPs.trim(), section: 'General' });
          }
        } else if (office.isp) {
          allISPs.push({ isp: office.isp, section: 'General' });
        }
        
        // Add section-specific ISPs
        if (office.sectionISPs) {
          const sectionISPs = JSON.parse(office.sectionISPs);
          if (typeof sectionISPs === 'object' && sectionISPs !== null) {
            Object.entries(sectionISPs).forEach(([section, isps]: [string, any]) => {
              if (Array.isArray(isps)) {
                isps.forEach(isp => {
                  if (isp && isp.trim()) {
                    allISPs.push({ isp: isp.trim(), section });
                  }
                });
              }
            });
          }
        }
        
        // Ensure we have at least one ISP
        if (allISPs.length === 0 && office.isp) {
          allISPs.push({ isp: office.isp, section: 'General' });
        }
        
      } catch (error) {
        console.warn(`Failed to parse ISPs for office ${office.id} (${office.unitOffice}):`, error);
        allISPs = office.isp ? [{ isp: office.isp, section: 'General' }] : [{ isp: 'Unknown ISP', section: 'General' }];
      }
        // Create compliance data per ISP-section combination
      const ispCompliance = allISPs.map((ispItem) => {
        // Create section-specific ISP identifier for matching against stored tests
        const ispIdentifier = `${ispItem.isp} (${ispItem.section})`;
        
        // Filter tests for this specific ISP-section combination
        const ispTests = officeTests.filter(test => {
          // Check if the stored ISP already includes section info
          const storedISP = test.isp;
          const sectionMatch = storedISP.match(/^(.+?)\s*\((.+?)\)$/);
          
          if (sectionMatch) {
            // ISP has section info: "Globe (IT)" -> compare with "Globe (IT)"
            return storedISP === ispIdentifier;
          } else {
            // Legacy ISP without section info - only match if it's a General ISP
            return ispItem.section === 'General' && storedISP === ispItem.isp;
          }
        });
        
        // Categorize tests by time slot for this ISP
        const morningTests = ispTests.filter(test => isWithinTimeSlot(test.timestamp, TimeSlot.MORNING));
        const noonTests = ispTests.filter(test => isWithinTimeSlot(test.timestamp, TimeSlot.NOON));
        const afternoonTests = ispTests.filter(test => isWithinTimeSlot(test.timestamp, TimeSlot.AFTERNOON));

        // Get the latest test for each time slot
        const latestMorning = morningTests[0] || null;
        const latestNoon = noonTests[0] || null;
        const latestAfternoon = afternoonTests[0] || null;

        // Calculate compliance for this ISP
        const completedSlots = [latestMorning, latestNoon, latestAfternoon].filter(Boolean).length;
        const compliancePercentage = Math.round((completedSlots / 3) * 100);        return {
          isp: `${ispItem.isp} (${ispItem.section})`, // Display ISP with section
          compliance: {
            percentage: compliancePercentage,
            completedSlots,
            totalSlots: 3,
          },
          tests: {
            morning: latestMorning ? {
              id: latestMorning.id,
              timestamp: latestMorning.timestamp,
              download: latestMorning.download,
              upload: latestMorning.upload,
              ping: latestMorning.ping,
              isp: latestMorning.isp,
            } : null,
            noon: latestNoon ? {
              id: latestNoon.id,
              timestamp: latestNoon.timestamp,
              download: latestNoon.download,
              upload: latestNoon.upload,
              ping: latestNoon.ping,
              isp: latestNoon.isp,
            } : null,
            afternoon: latestAfternoon ? {
              id: latestAfternoon.id,
              timestamp: latestAfternoon.timestamp,
              download: latestAfternoon.download,
              upload: latestAfternoon.upload,
              ping: latestAfternoon.ping,
              isp: latestAfternoon.isp,
            } : null,
          },
          counts: {
            morning: morningTests.length,
            noon: noonTests.length,
            afternoon: afternoonTests.length,
            total: ispTests.length,
          },
        };
      });      // Calculate overall office compliance (average across all ISPs)
      const totalRequiredSlots = allISPs.length * 3; // 3 slots per ISP-section combination
      const totalCompletedSlots = ispCompliance.reduce((sum, isp) => sum + isp.compliance.completedSlots, 0);
      const overallCompliancePercentage = totalRequiredSlots > 0 
        ? Math.round((totalCompletedSlots / totalRequiredSlots) * 100) 
        : 0;

      return {
        office: {
          id: office.id,
          unitOffice: office.unitOffice,
          subUnitOffice: office.subUnitOffice,
          location: office.location,
          isp: office.isp,
          isps: allISPs.map(item => `${item.isp} (${item.section})`), // Show section-specific ISPs
        },
        compliance: {
          percentage: overallCompliancePercentage,
          completedSlots: totalCompletedSlots,
          totalSlots: totalRequiredSlots,
        },
        ispCompliance,
        counts: {
          total: officeTests.length,
        },
      };
    });

    // Calculate overall statistics
    const totalOffices = offices.length;
    const fullyCompliantOffices = monitoringData.filter(data => data.compliance.percentage === 100).length;
    const partiallyCompliantOffices = monitoringData.filter(data => data.compliance.percentage > 0 && data.compliance.percentage < 100).length;
    const nonCompliantOffices = monitoringData.filter(data => data.compliance.percentage === 0).length;
    
    const overallCompliancePercentage = totalOffices > 0 
      ? Math.round((monitoringData.reduce((sum, data) => sum + data.compliance.percentage, 0) / totalOffices))
      : 0;

    return NextResponse.json({
      date: targetDate.toISOString().split('T')[0],
      summary: {
        totalOffices,
        fullyCompliantOffices,
        partiallyCompliantOffices,
        nonCompliantOffices,
        overallCompliancePercentage,
      },
      offices: monitoringData,
      timeSlots: {
        morning: { label: 'Morning', window: '6:00 AM - 11:59 AM' },
        noon: { label: 'Noon', window: '12:00 PM - 12:59 PM' },
        afternoon: { label: 'Afternoon', window: '1:00 PM - 6:00 PM' },
      },
    });
  } catch (error) {
    console.error('Monitoring API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
