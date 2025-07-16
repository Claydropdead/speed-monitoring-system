import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getCurrentTimeInAppTimezone, getCurrentTimeSlot, getAppTimezone, formatTimeInAppTimezone } from '@/lib/timezone';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentTime = getCurrentTimeInAppTimezone();
    const currentTimeSlot = getCurrentTimeSlot();
    const timezone = getAppTimezone();

    return NextResponse.json({
      currentTime: currentTime.toISOString(),
      currentTimeFormatted: formatTimeInAppTimezone(currentTime),
      currentTimeSlot,
      timezone,
      serverTime: new Date().toISOString(),
      manilaTime: currentTime.toLocaleString('en-PH', { 
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit', 
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      }),
      message: `Server timezone is now set to: ${timezone}`,
      timeSlots: {
        morning: '6:00 AM - 11:59 AM',
        noon: '12:00 PM - 12:59 PM', 
        afternoon: '1:00 PM - 6:00 PM'
      },
      debug: {
        hour: currentTime.getHours(),
        date: currentTime.toDateString(),
        nodeEnv: process.env.NODE_ENV,
        tzEnv: process.env.TZ || 'not set'
      }
    });
  } catch (error) {
    console.error('Time info API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
