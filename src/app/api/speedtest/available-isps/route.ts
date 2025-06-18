import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { TimeSlot } from '@prisma/client';
import { normalizeISPName } from '@/lib/isp-utils';

// Helper function to get time slot for current hour
function getCurrentTimeSlot(): TimeSlot | null {
  const hour = new Date().getHours();
  if (hour >= 6 && hour <= 11) return TimeSlot.MORNING;    // 6:00 AM - 11:59 AM
  if (hour === 12) return TimeSlot.NOON;                   // 12:00 PM - 12:59 PM
  if (hour >= 13 && hour <= 18) return TimeSlot.AFTERNOON; // 1:00 PM - 6:00 PM
  return null;
}

// Helper function to check if a timestamp falls within today's time slot
function isTestFromTodayTimeSlot(timestamp: Date, timeSlot: TimeSlot): boolean {
  const today = new Date();
  const testDate = new Date(timestamp);
  
  // Check if it's from today
  if (
    testDate.getDate() !== today.getDate() ||
    testDate.getMonth() !== today.getMonth() ||
    testDate.getFullYear() !== today.getFullYear()
  ) {
    return false;
  }
  
  // Check if it's from the current time slot
  const testHour = testDate.getHours();
  const testTimeSlot = (() => {
    if (testHour >= 6 && testHour <= 11) return TimeSlot.MORNING;
    if (testHour === 12) return TimeSlot.NOON;
    if (testHour >= 13 && testHour <= 18) return TimeSlot.AFTERNOON;
    return null;
  })();
  
  return testTimeSlot === timeSlot;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Allow admin users to access this endpoint
    const isAdmin = (session.user as any)?.role === 'ADMIN';
    if (!isAdmin && !session.user?.officeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentTimeSlot = getCurrentTimeSlot();
    
    if (!currentTimeSlot) {
      return NextResponse.json({
        available: [],
        tested: [],
        currentTimeSlot: null,
        message: 'Testing is only allowed during designated time slots (6AM-11:59AM, 12PM-12:59PM, 1PM-6PM)',
      });
    }    // Get office with all ISPs using raw query to avoid TypeScript issues
    const office = await prisma.$queryRaw`
      SELECT id, isp, isps, sectionISPs FROM offices WHERE id = ${session.user.officeId}
    ` as any[];

    if (!office || office.length === 0) {
      return NextResponse.json({ error: 'Office not found' }, { status: 404 });
    }

    const officeData = office[0];
  // Combine all ISPs from general and section-specific settings with section info
    let allISPs: Array<{isp: string, section: string}> = [];
    
    try {      // Add general ISPs
      if (officeData.isps) {
        let generalISPs = JSON.parse(officeData.isps);
        
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
            allISPs.push({ isp: normalizeISPName(isp), section: 'General' });
          });
        } else if (typeof generalISPs === 'string' && generalISPs.trim()) {
          // Single ISP string case
          allISPs.push({ isp: normalizeISPName(generalISPs), section: 'General' });
        }
      } else if (officeData.isp) {
        allISPs.push({ isp: normalizeISPName(officeData.isp), section: 'General' });
      }
      
      // Add section-specific ISPs
      if (officeData.sectionISPs) {
        const sectionISPs = JSON.parse(officeData.sectionISPs);
        if (typeof sectionISPs === 'object' && sectionISPs !== null) {
          Object.entries(sectionISPs).forEach(([section, isps]: [string, any]) => {
            if (Array.isArray(isps)) {
              isps.forEach(isp => {
                allISPs.push({ isp: normalizeISPName(isp), section });
              });
            }
          });
        }
      }
      
      // Filter out any empty ISPs
      allISPs = allISPs.filter(item => item.isp && item.isp.trim());
      
    } catch (error) {
      console.error('Error parsing ISP data:', error);
      // Fallback to primary ISP
      allISPs = officeData.isp ? [{ isp: normalizeISPName(officeData.isp), section: 'General' }] : [];
    }
      // Ensure we have at least one ISP
    if (allISPs.length === 0) {
      return NextResponse.json({ error: 'No ISPs configured for this office' }, { status: 400 });
    }

    // Get tests from today for this time slot
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);    const todaysTests = await prisma.speedTest.findMany({
      where: {
        officeId: session.user.officeId,
        timestamp: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      select: {
        isp: true,
        timestamp: true,
        rawData: true, // Include rawData to extract section info
      },
    });    // Filter tests from current time slot and create section-aware ISP tracking
    const testedISPSections = todaysTests
      .filter(test => isTestFromTodayTimeSlot(test.timestamp, currentTimeSlot))
      .map(test => {
        // Check if the stored ISP already includes section info
        const storedISP = test.isp;
        const sectionMatch = storedISP.match(/^(.+?)\s*\((.+?)\)$/);
        
        if (sectionMatch) {
          // ISP already has section info: "Globe (IT)" -> {isp: "Globe", section: "IT"}
          return {
            isp: normalizeISPName(sectionMatch[1].trim()),
            section: sectionMatch[2].trim()
          };
        } else {
          // Legacy ISP without section info - try to extract section from rawData
          let testSection = 'General';
          try {
            if (test.rawData) {
              const rawData = JSON.parse(test.rawData);
              if (rawData.section) {
                testSection = rawData.section;
              }
            }
          } catch (e) {
            // If we can't parse section from rawData, default to General
          }
          
          return {
            isp: normalizeISPName(storedISP),
            section: testSection
          };
        }      });

    // Filter available ISPs using section-specific matching
    const availableISPs = allISPs.filter(item => {
      const isAlreadyTested = testedISPSections.some(tested => 
        normalizeISPName(item.isp) === tested.isp && item.section === tested.section
      );
      return !isAlreadyTested;
    });
    
    const testedDetailedISPs = allISPs.filter(item => {
      const isAlreadyTested = testedISPSections.some(tested => 
        normalizeISPName(item.isp) === tested.isp && item.section === tested.section
      );
      return isAlreadyTested;
    });

    return NextResponse.json({
      available: availableISPs,
      tested: testedDetailedISPs,
      currentTimeSlot,
      timeSlotInfo: {
        morning: '6:00 AM - 11:59 AM',
        noon: '12:00 PM - 12:59 PM',
        afternoon: '1:00 PM - 6:00 PM',
      },
    });
  } catch (error) {
    console.error('Available ISPs API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
