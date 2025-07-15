import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { TimeSlot } from '@prisma/client';
import { normalizeISPName, parseISPsFromOffice, getISPDisplayName } from '@/lib/isp-utils';

// Helper function to get time slot for current hour
function getCurrentTimeSlot(): TimeSlot | null {
  const hour = new Date().getHours();
  if (hour >= 6 && hour <= 11) return TimeSlot.MORNING; // 6:00 AM - 11:59 AM
  if (hour === 12) return TimeSlot.NOON; // 12:00 PM - 12:59 PM
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

    // Get the correct office ID - for admin users, they can query any office
    // For regular users, use their assigned office
    const { searchParams } = new URL(request.url);
    const requestedOfficeId = searchParams.get('officeId');
    
    let targetOfficeId: string;
    if (isAdmin && requestedOfficeId) {
      targetOfficeId = requestedOfficeId;
    } else {
      targetOfficeId = session.user.officeId!;
    }

    const currentTimeSlot = getCurrentTimeSlot();

    if (!currentTimeSlot) {
      return NextResponse.json({
        available: [],
        tested: [],
        currentTimeSlot: null,
        message:
          'Testing is only allowed during designated time slots (6AM-11:59AM, 12PM-12:59PM, 1PM-6PM)',
      });
    } // Get office with all ISPs using raw query to avoid TypeScript issues
    const office = (await prisma.$queryRaw`
      SELECT id, isp, isps, sectionISPs FROM offices WHERE id = ${targetOfficeId}
    `) as any[];

    if (!office || office.length === 0) {
      return NextResponse.json({ error: 'Office not found' }, { status: 404 });
    }

    const officeData = office[0];
    
    // Use the new ISP parsing utility to get properly structured ISPs
    const parsedISPs = parseISPsFromOffice(officeData);
    
    // Convert to the format expected by the frontend
    let allISPs: Array<{ isp: string; section: string; id: string; displayName: string }> = [];
    
    parsedISPs.forEach(ispProvider => {
      allISPs.push({
        isp: ispProvider.name, // Original ISP name for matching
        section: ispProvider.section || 'General', // Use actual section name, fallback to 'General'
        id: ispProvider.id, // Unique identifier
        displayName: getISPDisplayName(ispProvider) // Display name with description
      });
    });

    // Ensure we have at least one ISP
    if (allISPs.length === 0) {
      return NextResponse.json({ error: 'No ISPs configured for this office' }, { status: 400 });
    }

    // Get tests from today for this time slot
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    const todaysTests = await prisma.speedTest.findMany({
      where: {
        officeId: targetOfficeId,
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
    }); // Filter tests from current time slot and create section-aware ISP tracking
    console.log(`🔍 Available ISPs API: Processing ${todaysTests.length} today's tests`);
    console.log(`🔍 Parsed ISPs:`, parsedISPs.map(isp => ({ 
      id: isp.id, 
      name: isp.name, 
      description: isp.description, 
      section: isp.section,
      displayName: getISPDisplayName(isp)
    }))); // Process today's tests to determine which ISPs have been tested
    const testedISPSections = todaysTests
      .filter(test => isTestFromTodayTimeSlot(test.timestamp, currentTimeSlot))
      .map(test => {
        // The stored ISP might be in our new format with descriptions
        // e.g., "PLDT (Backup Line)" or just "PLDT"
        const storedISP = test.isp;
        
        // PRIORITY 1: Try to extract section from rawData if available
        let sectionFromRawData = null;
        if (test.rawData) {
          try {
            const rawData = JSON.parse(test.rawData);
            if (rawData.section) {
              sectionFromRawData = rawData.section;
              console.log(`🔍 Found section in rawData: "${sectionFromRawData}"`);
            }
          } catch (e) {
            console.log(`🔍 Could not parse rawData for test`);
          }
        }
        
        // PRIORITY 2: If we have section from rawData, find exact section + display name match
        if (sectionFromRawData) {
          const sectionISP = parsedISPs.find(isp => 
            isp.section === sectionFromRawData && getISPDisplayName(isp) === storedISP
          );
          if (sectionISP) {
            console.log(`🔍 Matched with section ISP from rawData:`, { id: sectionISP.id, section: sectionISP.section });
            return {
              isp: sectionISP.name,
              section: sectionISP.section,
              id: sectionISP.id,
              displayName: getISPDisplayName(sectionISP)
            };
          }
        }
        
        // PRIORITY 3: Try to find exact display name match (this will find the first match)
        const matchingISP = parsedISPs.find(isp => {
          const displayMatch = getISPDisplayName(isp) === storedISP;
          const nameMatch = isp.name === storedISP;
          if (displayMatch || nameMatch) {
            console.log(`🔍 Found display/name match: ISP ID ${isp.id}, section: ${isp.section}, displayName: "${getISPDisplayName(isp)}"`);
          }
          return displayMatch || nameMatch;
        });
        
        if (matchingISP) {
          console.log(`🔍 Using first matching ISP:`, { id: matchingISP.id, section: matchingISP.section });
          return {
            isp: matchingISP.name,
            section: matchingISP.section || 'General',
            id: matchingISP.id,
            displayName: getISPDisplayName(matchingISP)
          };
        }
        
        // Fallback: try to parse section from ISP name if it has parentheses
        const sectionMatch = storedISP.match(/^(.+?)\s*\((.+?)\)$/);
        if (sectionMatch) {
          return {
            isp: normalizeISPName(sectionMatch[1].trim()),
            section: sectionMatch[2].trim(),
            id: `${normalizeISPName(sectionMatch[1].trim())}-${sectionMatch[2].trim()}`,
            displayName: storedISP
          };
        }

        // Legacy format without section
        return {
          isp: normalizeISPName(storedISP),
          section: 'General',
          id: normalizeISPName(storedISP),
          displayName: storedISP
        };
      });

    // Filter available ISPs using ID-based matching for accuracy
    const availableISPs = allISPs.filter(item => {
      const isAlreadyTested = testedISPSections.some(tested => tested.id === item.id);
      return !isAlreadyTested;
    });

    const testedDetailedISPs = allISPs.filter(item => {
      const isAlreadyTested = testedISPSections.some(tested => tested.id === item.id);
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
