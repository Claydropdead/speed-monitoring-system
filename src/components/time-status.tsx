'use client';

import { useEffect, useState } from 'react';
import { Clock, AlertTriangle, Info } from 'lucide-react';

interface TimeInfo {
  currentTime: string;
  currentTimeFormatted: string;
  currentTimeSlot: string | null;
  timezone: string;
  serverTime: string;
  timeSlots: {
    morning: string;
    noon: string;
    afternoon: string;
  };
  debug: {
    hour: number;
    date: string;
    nodeEnv: string;
    tzEnv: string;
  };
}

export default function TimeStatus() {
  const [timeInfo, setTimeInfo] = useState<TimeInfo | null>(null);
  const [clientTime, setClientTime] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Update client time every second
    const timer = setInterval(() => {
      setClientTime(new Date());
    }, 1000);

    // Fetch server time info
    const fetchTimeInfo = async () => {
      try {
        const response = await fetch('/api/time');
        if (response.ok) {
          const data = await response.json();
          setTimeInfo(data);
        }
      } catch (error) {
        console.error('Failed to fetch time info:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTimeInfo();
    return () => clearInterval(timer);
  }, []);

  if (loading) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-blue-600" />
          <span className="text-blue-800">Loading time information...</span>
        </div>
      </div>
    );
  }

  if (!timeInfo) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <span className="text-red-800">Failed to load time information</span>
        </div>
      </div>
    );
  }

  const clientHour = clientTime.getHours();
  const serverHour = timeInfo.debug.hour;
  const timeDifference = Math.abs(clientHour - serverHour);
  
  const getClientTimeSlot = () => {
    if (clientHour >= 6 && clientHour <= 11) return 'MORNING';
    if (clientHour === 12) return 'NOON';
    if (clientHour >= 13 && clientHour <= 18) return 'AFTERNOON';
    return null;
  };

  const clientTimeSlot = getClientTimeSlot();
  const hasTimeMismatch = clientTimeSlot !== timeInfo.currentTimeSlot || timeDifference > 1;

  return (
    <div className={`border rounded-lg p-4 ${hasTimeMismatch ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          {hasTimeMismatch ? (
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
          ) : (
            <Clock className="h-5 w-5 text-green-600" />
          )}
        </div>
        
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <h3 className={`font-medium ${hasTimeMismatch ? 'text-yellow-800' : 'text-green-800'}`}>
              Time Status
            </h3>
            {hasTimeMismatch && (
              <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                Time Mismatch Detected
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="font-medium text-gray-700">Your Local Time</div>
              <div className="text-gray-600">
                {clientTime.toLocaleString()} 
                <span className="ml-2 text-xs text-gray-500">
                  (Slot: {clientTimeSlot || 'Outside testing hours'})
                </span>
              </div>
            </div>

            <div>
              <div className="font-medium text-gray-700">Server Time ({timeInfo.timezone})</div>
              <div className="text-gray-600">
                {timeInfo.currentTimeFormatted}
                <span className="ml-2 text-xs text-gray-500">
                  (Slot: {timeInfo.currentTimeSlot || 'Outside testing hours'})
                </span>
              </div>
            </div>
          </div>

          <div className="text-xs text-gray-500 space-y-1">
            <div><strong>Testing Hours:</strong></div>
            <div>• Morning: {timeInfo.timeSlots.morning}</div>
            <div>• Noon: {timeInfo.timeSlots.noon}</div>
            <div>• Afternoon: {timeInfo.timeSlots.afternoon}</div>
          </div>

          {hasTimeMismatch && (
            <div className="bg-green-100 border border-green-200 rounded p-3 text-sm">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="text-green-800">
                  <strong>Good News:</strong> Your local time differs from the server time, but 
                  speed tests now use <strong>your local time</strong> for validation! 
                  You can run tests during your local testing hours regardless of server time.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
