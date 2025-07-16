// Timezone utilities for handling time slots across different timezones
import { TimeSlot } from '@prisma/client';

/**
 * Get the configured timezone for the application
 * Defaults to UTC for Railway deployment consistency
 */
export function getAppTimezone(): string {
  return process.env.TZ || process.env.TIMEZONE || 'UTC';
}

/**
 * Get current time in the application's configured timezone
 */
export function getCurrentTimeInAppTimezone(): Date {
  const timezone = getAppTimezone();
  
  // Create a date in the app's timezone
  const now = new Date();
  
  // If UTC, return as-is
  if (timezone === 'UTC') {
    return now;
  }
  
  // For other timezones, convert properly
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    const parts = formatter.formatToParts(now);
    const dateStr = `${parts.find(p => p.type === 'year')?.value}-${parts.find(p => p.type === 'month')?.value}-${parts.find(p => p.type === 'day')?.value}T${parts.find(p => p.type === 'hour')?.value}:${parts.find(p => p.type === 'minute')?.value}:${parts.find(p => p.type === 'second')?.value}`;
    
    return new Date(dateStr);
  } catch (error) {
    console.warn(`Failed to get time in timezone ${timezone}, falling back to UTC:`, error);
    return now;
  }
}

/**
 * Get the current hour in the application's timezone
 */
export function getCurrentHourInAppTimezone(): number {
  return getCurrentTimeInAppTimezone().getHours();
}

/**
 * Get time slot for current hour in application timezone
 */
export function getCurrentTimeSlot(): TimeSlot | null {
  const hour = getCurrentHourInAppTimezone();
  
  if (hour >= 6 && hour <= 11) return TimeSlot.MORNING; // 6:00 AM - 11:59 AM
  if (hour === 12) return TimeSlot.NOON; // 12:00 PM - 12:59 PM
  if (hour >= 13 && hour <= 18) return TimeSlot.AFTERNOON; // 1:00 PM - 6:00 PM
  return null;
}

/**
 * Get time slot for a specific timezone
 */
export function getCurrentTimeSlotForTimezone(timezone: string): TimeSlot | null {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false
    });
    
    const timeString = formatter.format(now);
    const hour = parseInt(timeString);
    
    if (hour >= 6 && hour <= 11) return TimeSlot.MORNING; // 6:00 AM - 11:59 AM
    if (hour === 12) return TimeSlot.NOON; // 12:00 PM - 12:59 PM
    if (hour >= 13 && hour <= 18) return TimeSlot.AFTERNOON; // 1:00 PM - 6:00 PM
    return null;
  } catch (error) {
    console.warn(`Failed to get time slot for timezone ${timezone}:`, error);
    // Fallback to app timezone
    return getCurrentTimeSlot();
  }
}

/**
 * Check if a timestamp falls within today's time slot (in app timezone)
 */
export function isTestFromTodayTimeSlot(timestamp: Date, timeSlot: TimeSlot): boolean {
  const appTime = getCurrentTimeInAppTimezone();
  const testTime = new Date(timestamp);

  // Check if it's from today (in app timezone)
  if (
    testTime.getDate() !== appTime.getDate() ||
    testTime.getMonth() !== appTime.getMonth() ||
    testTime.getFullYear() !== appTime.getFullYear()
  ) {
    return false;
  }

  // Check if it's from the current time slot
  const testHour = testTime.getHours();
  const testTimeSlot = (() => {
    if (testHour >= 6 && testHour <= 11) return TimeSlot.MORNING;
    if (testHour === 12) return TimeSlot.NOON;
    if (testHour >= 13 && testHour <= 18) return TimeSlot.AFTERNOON;
    return null;
  })();

  return testTimeSlot === timeSlot;
}

/**
 * Get time slot info for display
 */
export function getTimeSlotInfo() {
  return {
    morning: '6:00 AM - 11:59 AM',
    noon: '12:00 PM - 12:59 PM', 
    afternoon: '1:00 PM - 6:00 PM'
  };
}

/**
 * Format time for display in app timezone
 */
export function formatTimeInAppTimezone(date: Date, format?: string): string {
  const timezone = getAppTimezone();
  
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(date);
}
