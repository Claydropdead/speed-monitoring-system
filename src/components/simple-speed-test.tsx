/**
 * Simple client-side speed test using iframe to speedtest.net
 * This ensures the test runs from the user's actual connection
 */

'use client';

import { useEffect, useState, useRef } from 'react';

interface SimpleSpeedTestResult {
  download: number;
  upload: number;
  ping: number;
  isp: string;
  location: string;
  testUrl: string;
}

interface SimpleSpeedTestProps {
  onComplete?: (result: SimpleSpeedTestResult) => void;
  onError?: (error: string) => void;
  onStart?: () => void;
}

export default function SimpleSpeedTest({ onComplete, onError, onStart }: SimpleSpeedTestProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);
  const [testUrl, setTestUrl] = useState<string>('');
  const windowRef = useRef<Window | null>(null);

  const startTest = () => {
    try {
      setIsRunning(true);
      setShowInstructions(false);
      onStart?.();

      // Open Speedtest.net in a new window
      const speedtestUrl = 'https://www.speedtest.net/';
      windowRef.current = window.open(
        speedtestUrl, 
        'speedtest',
        'width=1200,height=800,scrollbars=yes,resizable=yes'
      );

      setTestUrl(speedtestUrl);

      // Check periodically if the window is closed
      const checkWindow = setInterval(() => {
        if (windowRef.current?.closed) {
          clearInterval(checkWindow);
          
          // When user closes the speedtest window, show input form
          setIsRunning(false);
          setShowInstructions(false);
          
          // For now, we'll ask the user to manually enter the results
          // In a future version, we could try to extract results automatically
          setTimeout(() => {
            showResultsInputForm();
          }, 500);
        }
      }, 1000);

    } catch (error) {
      console.error('Failed to open speedtest window:', error);
      onError?.('Failed to open speed test. Please check your popup blocker settings.');
      setIsRunning(false);
    }
  };

  const showResultsInputForm = () => {
    const download = prompt('Please enter your Download speed (Mbps) from the speed test:');
    const upload = prompt('Please enter your Upload speed (Mbps) from the speed test:');
    const ping = prompt('Please enter your Ping (ms) from the speed test:');
    const isp = prompt('Please enter your ISP name from the speed test:');

    if (download && upload && ping) {
      const result: SimpleSpeedTestResult = {
        download: parseFloat(download),
        upload: parseFloat(upload),
        ping: parseFloat(ping),
        isp: isp || 'Unknown ISP',
        location: 'Unknown',
        testUrl: testUrl
      };

      console.log('📊 User entered speed test results:', result);
      onComplete?.(result);
    } else {
      onError?.('Speed test cancelled or incomplete results provided.');
    }
  };

  const handleCancel = () => {
    if (windowRef.current && !windowRef.current.closed) {
      windowRef.current.close();
    }
    setIsRunning(false);
    setShowInstructions(true);
    onError?.('Speed test cancelled by user.');
  };

  return (
    <div className="space-y-4">
      {showInstructions && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-bold">!</span>
              </div>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-blue-800">Client-Side Speed Test</h3>
              <div className="mt-2 text-sm text-blue-700">
                <p className="mb-2">
                  This will open Speedtest.net in a new window to test your <strong>actual internet connection</strong> 
                  (not the server's connection).
                </p>
                <ul className="list-disc list-inside space-y-1 mb-3">
                  <li>Click "Start Test" to open the speed test</li>
                  <li>Run the test on Speedtest.net</li>
                  <li>Note down the results (Download, Upload, Ping, ISP)</li>
                  <li>Close the window when done</li>
                  <li>Enter the results when prompted</li>
                </ul>
                <p className="text-xs text-blue-600">
                  💡 This method ensures we get your real ISP and connection speeds, not Railway's.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {isRunning && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-500"></div>
              <span className="ml-3 text-sm font-medium text-green-800">
                Speed test window is open. Complete the test and close the window when done.
              </span>
            </div>
            <button
              onClick={handleCancel}
              className="text-green-600 hover:text-green-800 text-sm font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showInstructions && (
        <div className="flex justify-center">
          <button
            onClick={startTest}
            disabled={isRunning}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <span>🚀</span>
            Start Speed Test
          </button>
        </div>
      )}
    </div>
  );
}
