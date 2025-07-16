'use client';

import { useSession } from 'next-auth/react';
import { DashboardLayout } from '@/components/dashboard-layout';
import SpeedTestModal from '@/components/speed-test-modal';
import TimeStatus from '@/components/time-status';
import { useEffect, useState, useRef } from 'react';
import { format } from 'date-fns';
import { Zap, Download, Upload, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { normalizeISPName } from '@/lib/isp-utils';

interface SpeedTest {
  id: string;
  download: number;
  upload: number;
  ping: number;
  jitter?: number;
  packetLoss?: number;
  timestamp: string;
  isp: string; // ISP detected during the speed test
  rawData?: string; // Raw test data including section info
  office: {
    unitOffice: string;
    subUnitOffice?: string;
    location: string;
    isp: string; // Office's default ISP
  };
}

interface SpeedTestResult {
  download: number;
  upload: number;
  ping: number;
  jitter?: number;
  packetLoss?: number;
  serverId?: string;
  serverName?: string;
}

interface AvailableISPs {
  available: Array<{ isp: string; section: string; id: string; displayName: string }>;
  tested: Array<{ isp: string; section: string; id: string; displayName: string }>;
  currentTimeSlot: string | null;
  timeSlotInfo: {
    morning: string;
    noon: string;
    afternoon: string;
  };
}

export default function Tests() {
  const { data: session } = useSession();
  const [tests, setTests] = useState<SpeedTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showSpeedometer, setShowSpeedometer] = useState(false);
  const [availableISPs, setAvailableISPs] = useState<AvailableISPs | null>(null);
  const [selectedISP, setSelectedISP] = useState<string>('');
  const [selectedSection, setSelectedSection] = useState<string>(''); // Add section tracking
  const [showISPSelector, setShowISPSelector] = useState(false);
  const [loadingISPs, setLoadingISPs] = useState(false);
  const [showISPMismatchModal, setShowISPMismatchModal] = useState(false);
  const [mismatchData, setMismatchData] = useState<{
    selectedISP: string;
    detectedISP: string;
  } | null>(null);
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchTests();
    fetchAvailableISPs(); // Fetch available ISPs when component loads
  }, [session, currentPage]);

  const fetchAvailableISPs = async () => {
    if (!session?.user?.officeId) return;

    setLoadingISPs(true);
    try {
      // Get client timezone
      const clientTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      console.log('🌍 Client timezone detected:', clientTimezone);
      
      const response = await fetch(`/api/speedtest/available-isps?timezone=${encodeURIComponent(clientTimezone)}`);
      if (response.ok) {
        const data = await response.json();
        console.log('📡 API Response:', data);
        console.log('⏰ Current Time Slot from API:', data.currentTimeSlot);
        setAvailableISPs(data);
      } else {
        console.error('Failed to fetch available ISPs:', response.status, response.statusText);
        const errorData = await response.text();
        console.error('Error response:', errorData);
      }
    } catch (error) {
      console.error('Error fetching available ISPs:', error);
    } finally {
      setLoadingISPs(false);
    }
  };

  const fetchTests = async () => {
    if (!session) return;

    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
      });

      if (session.user.role !== 'ADMIN' && session.user.officeId) {
        params.append('officeId', session.user.officeId);
      }

      const response = await fetch(`/api/speedtest?${params}`);

      if (response.ok) {
        const data = await response.json();
        setTests(data.tests || []);
        setTotalPages(data.pagination?.pages || 1);
      }
    } catch (error) {
      console.error('Error fetching tests:', error);
    } finally {
      setLoading(false);
    }
  };

  const runSpeedTest = async () => {
    if (!session?.user?.officeId) return;

    // Check available ISPs first
    await fetchAvailableISPs();

    if (!availableISPs?.currentTimeSlot) {
      alert(
        'Testing is not available at this time.\n\nYour Local Time: Currently outside testing hours\nTesting Hours:\n- Morning: 6:00 AM - 11:59 AM\n- Noon: 12:00 PM - 12:59 PM\n- Afternoon: 1:00 PM - 6:00 PM\n\nNote: The system now uses your local timezone for validation.'
      );
      return;
    }
    if (availableISPs.available.length === 0) {
      const testedISPNames = availableISPs.tested
        .map(item => `${item.isp} (${item.section})`)
        .join(', ');
      alert(
        `All ISPs have been tested in the current time slot (${availableISPs.currentTimeSlot}).\n\nTested ISPs: ${testedISPNames}\n\nPlease wait for the next time slot to continue testing.`
      );
      return;
    }
    if (availableISPs.available.length === 1) {
      // Only one ISP available, select it automatically
      const selectedItem = availableISPs.available[0];
      setSelectedISP(selectedItem.id); // Use ID for unique identification (Fixed!)
      setSelectedSection(selectedItem.section);
      setShowSpeedometer(true);
    } else {
      // Multiple ISPs available, show selector
      setShowISPSelector(true);
    }
  };

  const handleISPSelection = (ispId: string, ispName: string, section: string) => {
    setSelectedISP(ispId); // Use ID for unique identification
    setSelectedSection(section);
    setShowISPSelector(false);
    setShowSpeedometer(true);
  };

  const handleSpeedTestComplete = (result: SpeedTestResult) => {
    // Refresh the tests list and available ISPs to show the new result
    fetchTests();
    fetchAvailableISPs();
  };
  const handleSpeedTestClose = () => {
    setShowSpeedometer(false);
    setSelectedISP('');
    setSelectedSection(''); // Clear section selection

    // Clear any pending restart timeouts
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
  };

  const handleSpeedTestError = (error: string, errorData?: any) => {
    console.error('Speed test error:', error, errorData);

    if (errorData?.type === 'isp_mismatch') {
      // ISP mismatch - show custom modal with better options
      setMismatchData({
        selectedISP: errorData.selectedISP,
        detectedISP: errorData.detectedISP,
      });
      setShowISPMismatchModal(true);
    } else {
      // Other errors - just close the speedometer
      setShowSpeedometer(false);
      setSelectedISP('');
      alert(`Speed test failed: ${error}`);
    }
  };

  const handleISPMismatchOK = () => {
    if (mismatchData && availableISPs) {
      // Use proper ISP normalization to check if detected ISP matches any available ISP
      const detectedNormalized = normalizeISPName(mismatchData.detectedISP);
      const matchingISP = availableISPs.available.find(item => {
        const availableNormalized = normalizeISPName(item.isp);
        return detectedNormalized === availableNormalized;
      });

      if (matchingISP) {
        // Clear any existing timeout first
        if (restartTimeoutRef.current) {
          clearTimeout(restartTimeoutRef.current);
        }

        // Close the mismatch modal
        setShowISPMismatchModal(false);
        setMismatchData(null);

        // Close speedometer first to ensure clean state
        setShowSpeedometer(false);
        // Wait a moment for cleanup, then restart with new ISP
        restartTimeoutRef.current = setTimeout(() => {
          setSelectedISP(matchingISP.id); // Use ID for unique identification (Fixed!)
          setSelectedSection(matchingISP.section); // Set the correct section
          setShowSpeedometer(true);
          restartTimeoutRef.current = null;
        }, 300); // Slightly longer delay for better cleanup
      } else {
        // Detected ISP not in office list - show manual selection
        alert(
          `The detected ISP "${mismatchData.detectedISP}" is not configured for your office. Please select from available ISPs.`
        );
        setShowISPMismatchModal(false);
        setShowSpeedometer(false);
        setSelectedISP('');
        setShowISPSelector(true);
      }
    }
  };
  const handleISPMismatchCancel = () => {
    // User wants to manually select ISP
    setShowISPMismatchModal(false);
    setShowSpeedometer(false);
    setSelectedISP('');
    setSelectedSection(''); // Clear section selection
    setShowISPSelector(true);
    setMismatchData(null);
  };

  const getSpeedColor = (speed: number, type: 'download' | 'upload') => {
    const threshold = type === 'download' ? 100 : 50;
    if (speed >= threshold) return 'text-green-600';
    if (speed >= threshold * 0.7) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getPingColor = (ping: number) => {
    if (ping <= 20) return 'text-green-600';
    if (ping <= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Speed Tests</h2>
            <p className="text-gray-600 mt-1">
              {session?.user?.role === 'ADMIN'
                ? 'All speed test results across offices'
                : 'Your office speed test history'}
            </p>
          </div>
          {session?.user?.officeId && (
            <button
              onClick={runSpeedTest}
              disabled={showSpeedometer}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Zap className="h-4 w-4" />
              {showSpeedometer ? 'Running Test...' : 'Run Speed Test'}
            </button>
          )}
        </div>

        {/* Time Status Information */}
        <TimeStatus />

        {/* Current Time Slot Status */}
        {availableISPs && session?.user?.officeId && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Today's Testing Status</h3>

            {availableISPs.currentTimeSlot ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="font-medium">
                    Current Time Slot: {availableISPs.currentTimeSlot}
                  </span>
                  <span className="text-sm text-gray-600">
                    (
                    {
                      availableISPs.timeSlotInfo[
                        availableISPs.currentTimeSlot.toLowerCase() as keyof typeof availableISPs.timeSlotInfo
                      ]
                    }
                    )
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Available ISPs */}
                  <div>
                    <h4 className="font-medium text-green-600 mb-2 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      Available for Testing ({availableISPs.available.length})
                    </h4>
                    {availableISPs.available.length > 0 ? (
                      <ul className="space-y-1">
                        {availableISPs.available.map((item, index) => (
                          <li
                            key={`${item.isp}-${item.section}-${index}`}
                            className="text-sm bg-green-50 text-green-800 px-2 py-1 rounded flex justify-between items-center"
                          >
                            <div className="flex flex-col">
                              <span className="font-medium">{item.displayName || item.isp}</span>
                              {item.section && item.section !== 'General' && (
                                <span className="text-xs text-green-600 font-medium">Section: {item.section}</span>
                              )}
                            </div>
                            <div className="flex flex-col items-end">
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                                {item.displayName && item.displayName.includes('(') ? item.displayName.match(/\(([^)]+)\)/)?.[1] || item.section : item.section}
                              </span>
                              {item.section && item.section !== 'General' && (
                                <span className="text-xs text-green-500 mt-1">{item.section} ISP</span>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-500">All ISPs tested for this time slot</p>
                    )}
                  </div>

                  {/* Tested ISPs */}
                  <div>
                    <h4 className="font-medium text-blue-600 mb-2 flex items-center gap-2">
                      <XCircle className="h-4 w-4" />
                      Already Tested ({availableISPs.tested.length})
                    </h4>
                    {availableISPs.tested.length > 0 ? (
                      <ul className="space-y-1">
                        {availableISPs.tested.map((item, index) => (
                          <li
                            key={`${item.isp}-${item.section}-${index}`}
                            className="text-sm bg-blue-50 text-blue-800 px-2 py-1 rounded flex justify-between items-center"
                          >
                            <div className="flex flex-col">
                              <span className="font-medium">{item.displayName || item.isp}</span>
                              {item.section && item.section !== 'General' && (
                                <span className="text-xs text-blue-600 font-medium">Section: {item.section}</span>
                              )}
                            </div>
                            <div className="flex flex-col items-end">
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                {item.displayName && item.displayName.includes('(') ? item.displayName.match(/\(([^)]+)\)/)?.[1] || item.section : item.section}
                              </span>
                              {item.section && item.section !== 'General' && (
                                <span className="text-xs text-blue-500 mt-1">{item.section} ISP</span>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-500">No tests completed yet</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-orange-600">
                <AlertTriangle className="h-4 w-4" />
                <span>Testing is only available during designated time slots (using your local time)</span>
                <div className="ml-4 text-sm text-gray-600">
                  <div>Morning: 6:00 AM - 11:59 AM</div>
                  <div>Noon: 12:00 PM - 12:59 PM</div>
                  <div>Afternoon: 1:00 PM - 6:00 PM</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tests Table */}
        <div className="card">
          <div className="card-content p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-gray-600">Loading tests...</p>
                </div>
              </div>
            ) : Array.isArray(tests) && tests.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date & Time
                      </th>
                      {session?.user?.role === 'ADMIN' && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Office
                        </th>
                      )}
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <div className="flex items-center gap-1">
                          <Download className="h-4 w-4" />
                          Download
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <div className="flex items-center gap-1">
                          <Upload className="h-4 w-4" />
                          Upload
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          Ping
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        ISP
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {Array.isArray(tests) &&
                      tests.map(test => (
                        <tr key={test.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {format(new Date(test.timestamp), 'MMM dd, yyyy h:mm a')}
                          </td>
                          {session?.user?.role === 'ADMIN' && (
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              <div>
                                <div className="font-medium">
                                  {test.office.unitOffice}
                                  {test.office.subUnitOffice && (
                                    <span className="text-gray-600 ml-1">
                                      - {test.office.subUnitOffice}
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-gray-500">{test.office.location}</div>
                              </div>
                            </td>
                          )}
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span
                              className={`font-medium ${getSpeedColor(test.download, 'download')}`}
                            >
                              {test.download} Mbps
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={`font-medium ${getSpeedColor(test.upload, 'upload')}`}>
                              {test.upload} Mbps
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={`font-medium ${getPingColor(test.ping)}`}>
                              {test.ping} ms
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div className="flex flex-col">
                              <span className="font-medium">{test.isp}</span>
                              {(() => {
                                // Try to extract section from rawData
                                try {
                                  if (test.rawData) {
                                    const rawData = JSON.parse(test.rawData);
                                    if (rawData.section && rawData.section !== 'General') {
                                      return (
                                        <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full w-fit mt-1">
                                          {rawData.section} Section
                                        </span>
                                      );
                                    }
                                  }
                                } catch (e) {
                                  // Ignore parsing errors
                                }
                                return null;
                              })()}
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <Zap className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No speed tests found</p>
                <p className="text-sm text-gray-400 mt-1">
                  Run your first speed test to see results here
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="btn-secondary disabled:opacity-50"
            >
              Previous
            </button>
            <span className="flex items-center px-4 py-2 text-sm text-gray-600">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="btn-secondary disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Speed Test Modal */}
      {session?.user?.officeId && (
        <SpeedTestModal
          isOpen={showSpeedometer}
          onClose={handleSpeedTestClose}
          officeId={session.user.officeId}
          selectedISP={selectedISP}
          selectedSection={selectedSection}
          onComplete={handleSpeedTestComplete}
          onError={handleSpeedTestError}
        />
      )}

      {/* ISP Mismatch Modal */}
      {showISPMismatchModal && mismatchData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">ISP Mismatch Detected!</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <p>
                  <span className="font-medium">You selected:</span> {mismatchData.selectedISP}
                </p>
                <p>
                  <span className="font-medium">We detected:</span> {mismatchData.detectedISP}
                </p>
              </div>
            </div>

            {(() => {
              // Check if detected ISP is available in office ISPs using proper normalization
              if (!availableISPs) return null;
              const detectedNormalized = normalizeISPName(mismatchData.detectedISP);
              const matchingISP = availableISPs.available.find(
                item => normalizeISPName(item.isp) === detectedNormalized
              );

              if (matchingISP) {
                // ISP is available - show positive message
                return (
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-green-600 text-lg">✅</span>
                      <span className="font-medium text-green-700">ISP Match Found!</span>
                    </div>{' '}
                    <div className="bg-green-50 border border-green-200 rounded-md p-3 mb-3">
                      <p className="text-sm text-green-800">
                        <span className="font-medium">
                          "{matchingISP.isp} ({matchingISP.section})"
                        </span>{' '}
                        is available in your office ISP list.
                      </p>
                      <p className="text-xs text-green-600 mt-1">
                        Detected: "{mismatchData.detectedISP}" → Matches: "{matchingISP.isp}"
                      </p>
                    </div>
                    <p className="text-sm text-gray-700">Would you like to:</p>
                    <div className="mt-2 space-y-1 text-sm text-gray-600">
                      <p>
                        1. Proceed with{' '}
                        <span className="font-medium">
                          {matchingISP.isp} ({matchingISP.section})
                        </span>
                      </p>
                      <p>2. Cancel and select a different ISP</p>
                    </div>
                  </div>
                );
              } else {
                // ISP not available - show warning message
                return (
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-yellow-600 text-lg">⚠️</span>
                      <span className="font-medium text-yellow-700">ISP Not Available</span>
                    </div>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-3">
                      <p className="text-sm text-yellow-800">
                        <span className="font-medium">"{mismatchData.detectedISP}"</span> is not
                        configured for your office.
                      </p>
                    </div>
                    <p className="text-sm text-gray-700">
                      Available ISPs:{' '}
                      {availableISPs.available
                        .map(item => `${item.isp} (${item.section})`)
                        .join(', ')}
                    </p>
                    <p className="text-sm text-gray-600 mt-2">
                      Please select a different ISP manually.
                    </p>
                  </div>
                );
              }
            })()}

            <p className="text-xs text-gray-500 mb-4">
              Click OK to proceed, Cancel to select different ISP
            </p>

            <div className="flex gap-3 justify-end">
              <button
                onClick={handleISPMismatchCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                onClick={handleISPMismatchOK}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                {(() => {
                  if (!availableISPs) return 'OK';
                  const detectedNormalized = normalizeISPName(mismatchData.detectedISP);
                  const matchingISP = availableISPs.available.find(
                    item => normalizeISPName(item.isp) === detectedNormalized
                  );

                  return matchingISP
                    ? `Proceed with ${matchingISP.isp} (${matchingISP.section})`
                    : 'OK';
                })()}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ISP Selector Modal */}
      {showISPSelector && availableISPs && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Select ISP to Test</h3>
            <p className="text-sm text-gray-600 mb-4">
              Choose which ISP you want to test in the current time slot (
              {availableISPs.currentTimeSlot}).
            </p>{' '}
            <div className="space-y-2">
              {availableISPs.available.map((item, index) => (
                <button
                  key={`${item.id}-${index}`}
                  onClick={() => handleISPSelection(item.id, item.isp, item.section)}
                  className="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-medium">{item.displayName || item.isp}</div>
                      {item.section && item.section !== 'General' && (
                        <div className="text-xs text-blue-600 font-medium mt-1">Section: {item.section}</div>
                      )}
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                        {item.displayName && item.displayName.includes('(') ? item.displayName.match(/\(([^)]+)\)/)?.[1] || item.section : item.section}
                      </span>
                      {item.section && item.section !== 'General' && (
                        <span className="text-xs text-blue-500 mt-1">{item.section} ISP</span>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-gray-500 mt-2">
                    {item.section && item.section !== 'General' 
                      ? `Available for testing in ${item.section} section`
                      : 'Available for general office testing'
                    }
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowISPSelector(false)}
              className="mt-4 w-full p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
