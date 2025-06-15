import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { TimeSlot } from '@prisma/client';

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
    
    if (!session || !session.user?.officeId) {
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
    }

    // Get office with all ISPs using raw query to avoid TypeScript issues
    const office = await prisma.$queryRaw`
      SELECT id, isp, isps FROM offices WHERE id = ${session.user.officeId}
    ` as any[];

    if (!office || office.length === 0) {
      return NextResponse.json({ error: 'Office not found' }, { status: 404 });
    }

    const officeData = office[0];
    const allISPs = JSON.parse(officeData.isps || `["${officeData.isp}"]`) as string[];

    // Get tests from today for this time slot
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const todaysTests = await prisma.speedTest.findMany({
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
      },
    });

    // Filter tests from current time slot
    const testedISPs = todaysTests
      .filter(test => isTestFromTodayTimeSlot(test.timestamp, currentTimeSlot))
      .map(test => test.isp);

    const uniqueTestedISPs = [...new Set(testedISPs)];
    const availableISPs = allISPs.filter(isp => !uniqueTestedISPs.includes(isp));

    return NextResponse.json({
      available: availableISPs,
      tested: uniqueTestedISPs,
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
