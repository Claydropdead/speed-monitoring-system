import { NextResponse } from 'next/server';
import { getAppTimezone, getCurrentTimeSlot, getCurrentTimeInAppTimezone, getCurrentTimeSlotForTimezone } from '@/lib/timezone';

export async function GET() {
  try {
    console.log('🔍 Debug timezone endpoint called');
    
    const serverTimezone = getAppTimezone();
    const serverTime = getCurrentTimeInAppTimezone();
    const serverTimeSlot = getCurrentTimeSlot();
    
    // Also test Asia/Manila directly
    const manilaTimeSlot = getCurrentTimeSlotForTimezone('Asia/Manila');
    
    const debug = {
      serverTimezone,
      serverTime: serverTime.toISOString(),
      serverTimeFormatted: serverTime.toLocaleString('en-PH', { 
        timeZone: serverTimezone,
        year: 'numeric',
        month: '2-digit', 
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      }),
      serverTimeSlot,
      manilaTimeSlot,
      serverHour: serverTime.getHours(),
      utcTime: new Date().toISOString(),
      utcHour: new Date().getHours(),
      processEnvTZ: process.env.TZ,
      processEnvTIMEZONE: process.env.TIMEZONE,
      nodeVersion: process.version,
      platform: process.platform
    };
    
    console.log('🕐 Debug info:', debug);
    
    return NextResponse.json({
      success: true,
      debug,
      message: `Server timezone: ${serverTimezone}, Current slot: ${serverTimeSlot}`
    });
  } catch (error) {
    console.error('❌ Debug timezone error:', error);
    return NextResponse.json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
