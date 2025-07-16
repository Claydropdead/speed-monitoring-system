'use client';

import { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';
import ClientSpeedTest from './client-speed-test';

interface SpeedTestResult {
  download: number;
  upload: number;
  ping: number;
  jitter?: number;
  packetLoss?: number;
  serverId?: string;
  serverName?: string;
  resultUrl?: string; // Ookla result URL
  isp?: string; // ISP detected from test
  ispName?: string; // ISP name from server-side test
  clientIP?: string; // Client IP from test
  clientIp?: string; // Alternative naming from server-side
  serverLocation?: string; // Server location from test
  rawData?: string; // Raw test data
  ispValidation?: { // ISP validation from server-side
    isMatch: boolean;
    confidence: number;
    detectedCanonical: string;
    selectedCanonical: string;
    suggestion?: string;
  };
}

interface SpeedTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  officeId: string;
  selectedISP?: string;
  selectedSection?: string; // Add section prop
  onComplete?: (result: SpeedTestResult) => void;
  onError?: (error: string, errorData?: any) => void;
}

export default function SpeedTestModal({
  isOpen,
  onClose,
  officeId,
  selectedISP,
  selectedSection,
  onComplete,
  onError,
}: SpeedTestModalProps) {
  const [showResults, setShowResults] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [hasCompletedTest, setHasCompletedTest] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      // Reset all states when modal opens
      setShowResults(false);
      setError(null);
      setHasCompletedTest(false);
      setIsTestRunning(false);
    }
  }, [isOpen]);
  // Auto-start test when modal opens and states are reset
  useEffect(() => {
    if (isOpen && !isTestRunning && !hasCompletedTest && !error) {
      // Use a small delay to ensure state is settled
      const startTimeout = setTimeout(() => {
        setIsTestRunning(true);
      }, 100);

      return () => clearTimeout(startTimeout);
    }
  }, [isOpen]); // Remove other dependencies to prevent re-triggering

  const handleComplete = async (result: SpeedTestResult) => {
    setIsTestRunning(false);
    setHasCompletedTest(true);
    setShowResults(true);
    setError(null);

    // Save the result to database
    try {
      const body = {
        officeId,
        runTest: true,
        selectedISP,
        testResult: {
          download: result.download,
          upload: result.upload,
          ping: result.ping,
          jitter: result.jitter || 0,
          packetLoss: result.packetLoss || 0,
          serverId: result.serverId || 'server-side',
          serverName: result.serverName || 'Server-Side Test',
          ispName: result.isp || result.ispName || 'Server-Detected', // Use ISP from server-side test
          rawData: JSON.stringify({
            testType: 'server-side-ookla-cli',
            section: selectedSection,
            timestamp: new Date().toISOString(),
            source: 'ookla-speedtest-cli',
            clientIP: result.clientIP,
            serverLocation: result.serverLocation,
            originalRawData: result.rawData,
            ispValidation: result.ispValidation // Include ISP validation from server
          })
        },
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      };

      const response = await fetch('/api/speedtest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Failed to save speed test result:', errorData);
      } else {
        console.log('✅ Client-side speed test result saved successfully');
      }
    } catch (error) {
      console.error('❌ Error saving speed test result:', error);
      // Don't fail the UI if saving fails
    }

    onComplete?.(result);
  };
  const handleError = (errorMessage: string, errorData?: any) => {
    setIsTestRunning(false);
    setError(errorMessage);

    // Check if this is an ISP mismatch error that should be handled by parent
    if (errorData?.type === 'isp_mismatch') {
      // Call parent error handler for ISP mismatch
      onError?.(errorMessage, errorData);
      return; // Don't show error in modal, let parent handle it
    }

    // Add helpful context for specific error types
    if (errorData?.networkError || errorMessage.includes('socket')) {
      setError(
        errorMessage +
          '\n\nTip: Check your firewall settings or try again with a different network connection.'
      );
    } else if (errorData?.retryable || errorMessage.includes('Unknown error')) {
      setError(
        errorMessage +
          '\n\nTip: This error is often temporary. Wait a moment and try running the test again.'
      );
    }

    // Call parent error handler for other errors too
    onError?.(errorMessage, errorData);
  };
  const handleClose = () => {
    // Prevent closing during active test (but allow closing after completion)
    if (isTestRunning && !hasCompletedTest) {
      return;
    }

    // Reset all states when closing
    setShowResults(false);
    setError(null);
    setHasCompletedTest(false);
    setIsTestRunning(false);
    onClose();
  };
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                {' '}
                <div className="flex justify-between items-center mb-4">
                  {' '}
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                    {error
                      ? 'Speed Test Error'
                      : showResults
                        ? 'Speed Test Complete!'
                        : isTestRunning
                          ? 'Speed Test in Progress'
                          : 'Speed Test'}
                  </Dialog.Title>
                  {!isTestRunning && (
                    <button
                      type="button"
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                      onClick={handleClose}
                    >
                      <X className="h-6 w-6" />
                    </button>
                  )}
                  {isTestRunning && (
                    <div className="text-sm text-blue-600 font-medium">
                      Test running... Please wait
                    </div>
                  )}
                </div>{' '}
                {error ? (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <X className="h-5 w-5 text-red-400" />
                      </div>
                      <div className="ml-3 flex-1">
                        <h3 className="text-sm font-medium text-red-800">Speed Test Failed</h3>
                        <div className="mt-2 text-sm text-red-700">
                          <div className="whitespace-pre-line">{error}</div>
                          {error &&
                            (error.includes('temporary') ||
                              error.includes('Try again') ||
                              error.includes('socket')) && (
                              <div className="mt-3 p-3 bg-orange-100 rounded-md border border-orange-300">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium text-orange-800">
                                    🔄 Ready to retry
                                  </span>
                                  <button
                                    onClick={() => {
                                      // Reset states and restart test
                                      setError(null);
                                      setIsTestRunning(true);
                                      setHasCompletedTest(false);
                                      setShowResults(false);
                                    }}
                                    className="bg-orange-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-orange-700 transition-colors"
                                  >
                                    Retry Test
                                  </button>
                                </div>
                                <p className="text-xs text-orange-700 mt-1">
                                  This type of error is often temporary. Click "Retry Test" to try
                                  again.
                                </p>
                              </div>
                            )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <ClientSpeedTest
                      officeId={officeId}
                      selectedISP={selectedISP}
                      selectedSection={selectedSection}
                      onComplete={(result) => {
                        // Convert client-side result to our format
                        const speedTestResult: SpeedTestResult = {
                          download: result.download,
                          upload: result.upload,
                          ping: result.ping,
                          jitter: result.jitter || 0,
                          packetLoss: result.packetLoss || 0,
                          serverId: result.serverId || 'client-side',
                          serverName: result.serverName || 'Client-Side Test',
                          isp: result.ispName,
                          clientIP: result.clientIp,
                          serverLocation: result.serverLocation,
                          rawData: JSON.stringify(result)
                        };
                        handleComplete(speedTestResult);
                      }}
                      onError={(error, errorData) => {
                        handleError(error, errorData);
                      }}
                    />
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
