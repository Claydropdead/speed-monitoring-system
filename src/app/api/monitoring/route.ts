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
    }

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');
    const targetDate = dateParam ? new Date(dateParam) : new Date();
    
    // Set to start and end of the target date
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);    // Get all offices with their ISPs
    const offices = await prisma.office.findMany({
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

    // Get all speed tests for the target date
    const speedTests = await prisma.speedTest.findMany({
      where: {
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
        isp: true,      },
      orderBy: {
        timestamp: 'desc',
      },
    });    // Process monitoring data for each office
    const monitoringData = offices.map((office) => {
      const officeTests = speedTests.filter(test => test.officeId === office.id);
      let officeIsps: string[] = [];
        // Safely parse ISPs array and combine with section-specific ISPs
      try {
        // Start with general ISPs
        if (office.isps) {
          const parsed = JSON.parse(office.isps);
          officeIsps = Array.isArray(parsed) ? parsed : [office.isp].filter(Boolean);
        } else {
          officeIsps = office.isp ? [office.isp] : [];
        }
        
        // Add section-specific ISPs
        if (office.sectionISPs) {
          const sectionISPs = JSON.parse(office.sectionISPs);
          if (typeof sectionISPs === 'object' && sectionISPs !== null) {
            Object.values(sectionISPs).forEach((isps: any) => {
              if (Array.isArray(isps)) {
                officeIsps = [...officeIsps, ...isps];
              }
            });
          }
        }
        
        // Remove duplicates and filter out empty strings
        officeIsps = [...new Set(officeIsps)].filter(isp => isp && isp.trim());
        
      } catch (error) {
        console.warn(`Failed to parse ISPs for office ${office.id} (${office.unitOffice}), using primary ISP:`, error);
        officeIsps = office.isp ? [office.isp] : [];
      }
      
      // Ensure officeIsps is always an array with at least one entry
      if (!Array.isArray(officeIsps) || officeIsps.length === 0) {
        officeIsps = office.isp ? [office.isp] : ['Unknown ISP'];
      }
      
      // Create compliance data per ISP
      const ispCompliance = officeIsps.map((isp) => {
        const ispTests = officeTests.filter(test => test.isp === isp);
        
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
        const compliancePercentage = Math.round((completedSlots / 3) * 100);

        return {
          isp,
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
      });

      // Calculate overall office compliance (average across all ISPs)
      const totalRequiredSlots = officeIsps.length * 3; // 3 slots per ISP
      const totalCompletedSlots = ispCompliance.reduce((sum, isp) => sum + isp.compliance.completedSlots, 0);
      const overallCompliancePercentage = totalRequiredSlots > 0 
        ? Math.round((totalCompletedSlots / totalRequiredSlots) * 100) 
        : 0;

      return {        office: {
          id: office.id,
          unitOffice: office.unitOffice,
          subUnitOffice: office.subUnitOffice,
          location: office.location,
          isp: office.isp,
          isps: officeIsps, // Use the processed array instead of raw string
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
