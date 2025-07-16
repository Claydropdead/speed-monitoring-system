'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { Wifi } from 'lucide-react';
import { normalizeISPName, validateISPMatch } from '@/lib/isp-utils';

interface SpeedTestResult {
  download: number;
  upload: number;
  ping: number;
  jitter?: number;
  packetLoss?: number;
  serverId?: string;
  serverName?: string;
  ispName?: string;
  clientIp?: string;
  serverLocation?: string;
  resultUrl?: string;
  ispValidation?: {
    isMatch: boolean;
    confidence: number;
    detectedCanonical: string;
    selectedCanonical: string;
    suggestion?: string;
  };
}

interface SpeedometerProps {
  isRunning: boolean;
  onComplete?: (result: SpeedTestResult) => void;
  onError?: (error: string, errorData?: any) => void;
  onTestStart?: () => void;
  officeId: string;
  selectedISP?: string;
  selectedSection?: string; // Add section prop
}

interface TestProgress {
  stage: 'connecting' | 'download' | 'upload' | 'ping' | 'complete';
  download: number;
  upload: number;
  ping: number;
  progress: number;
}

export default function Speedometer({
  isRunning,
  onComplete,
  onError,
  onTestStart,
  officeId,
  selectedISP,
  selectedSection,
}: SpeedometerProps) {
  const [progress, setProgress] = useState<TestProgress>({
    stage: 'connecting',
    download: 0,
    upload: 0,
    ping: 0,
    progress: 0,
  });
  const [finalResult, setFinalResult] = useState<SpeedTestResult | null>(null);
  const [isTestCompleted, setIsTestCompleted] = useState(false);
  const [hasEverStarted, setHasEverStarted] = useState(false);
  const [eventSourceRef, setEventSourceRef] = useState<EventSource | null>(null);
  const [isValidatingISP, setIsValidatingISP] = useState(false);
  const [ispValidationError, setIspValidationError] = useState<string | null>(null);

  const handleCompleteRef = useRef(onComplete);
  const handleErrorRef = useRef(onError);
  const onTestStartRef = useRef(onTestStart);

  useEffect(() => {
    handleCompleteRef.current = onComplete;
    handleErrorRef.current = onError;
    onTestStartRef.current = onTestStart;
  }, [onComplete, onError, onTestStart]);

  const validateISPBeforeTest = async () => {
    setIsValidatingISP(true);
    setIspValidationError(null);

    try {
      setProgress({
        stage: 'connecting',
        download: 0,
        upload: 0,
        ping: 0,
        progress: 5,
      });

      const response = await fetch('/api/speedtest/detect-isp');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to detect ISP');
      }

      const detectedISP = data.detectedISP;

      if (detectedISP === 'Unknown ISP - Please select manually') {
        const errorMessage =
          'Unable to detect your ISP. Please verify your connection or try again.';
        setIspValidationError(errorMessage);
        setIsValidatingISP(false);
        handleErrorRef.current?.(errorMessage, {
          type: 'detection_failed',
          suggestion: 'Check your internet connection and try again',
        });
        return;
      } // Use strict ISP validation - ISP must match before proceeding
      const validation = validateISPMatch(selectedISP!, detectedISP, false); // relaxed mode = false (strict)

      // Only proceed if ISP matches exactly or partially
      if (!validation.isMatch) {
        const errorMessage = `ISP Mismatch Detected!

Selected: ${selectedISP}
Detected: ${detectedISP}

The speed test was stopped to prevent incorrect data collection.

Please select the correct ISP that matches your actual connection.`;
        setIspValidationError(errorMessage);
        setIsValidatingISP(false);
        setIsTestCompleted(true); // Mark test as completed to prevent re-triggering
        handleErrorRef.current?.(errorMessage, {
          type: 'isp_mismatch',
          selectedISP,
          detectedISP,
          suggestedAction: 'Please select the correct ISP and try again',
        });
        return;
      }

      // Validation passed, start the test
      setIsValidatingISP(false);
      startSpeedTest();
    } catch (error) {
      setIsValidatingISP(false);
      setIsTestCompleted(true); // Mark test as completed to prevent re-triggering
      const errorMessage = 'Failed to validate ISP before starting test. Please try again.';
      setIspValidationError(errorMessage);
      handleErrorRef.current?.(errorMessage, { type: 'validation_error' });
    }
  };  const startSpeedTest = () => {
    // Prevent multiple EventSource connections
    if (eventSourceRef) {
      eventSourceRef.close();
      setEventSourceRef(null);
    }
    
    onTestStartRef.current?.();

    // Build query parameters more safely
    const queryParams = new URLSearchParams({
      officeId,
      useValidatedISP: 'true'
    });
    
    if (selectedISP) {
      queryParams.set('selectedISP', selectedISP);
    }
    
    if (selectedSection) {
      queryParams.set('selectedSection', selectedSection);
    }    // Pass the validated ISP from pre-validation to maintain consistency
    const speedTestUrl = `/api/speedtest/live?${queryParams.toString()}`;
    const eventSource = new EventSource(speedTestUrl);
    setEventSourceRef(eventSource);
    eventSource.onmessage = event => {
      try {
        // Validate event data before parsing
        if (!event.data || event.data.trim() === '') {
          return;
        }

        const data = JSON.parse(event.data);
        // Validate required properties
        if (!data.type) {
          return;
        }
        if (data.type === 'progress') {
          const stage = data.stage || 'connecting';
          const rawProgress = data.progress || 0;
          const download = Math.max(0, data.download || 0);
          const upload = Math.max(0, data.upload || 0);
          const ping = Math.max(0, data.ping || 0);

          // More flexible progress handling - allow natural progression
          let normalizedProgress = rawProgress;

          // Only clamp extreme values, allow natural progression within reasonable bounds
          if (stage === 'connecting') {
            normalizedProgress = Math.max(0, Math.min(25, rawProgress)); // Allow up to 25% for connecting
          } else if (stage === 'ping') {
            normalizedProgress = Math.max(5, Math.min(30, rawProgress)); // Allow 5-30% for ping
          } else if (stage === 'download') {
            normalizedProgress = Math.max(20, Math.min(70, rawProgress)); // Allow 20-70% for download
          } else if (stage === 'upload') {
            normalizedProgress = Math.max(60, Math.min(95, rawProgress)); // Allow 60-95% for upload
          } else if (stage === 'complete') {
            normalizedProgress = 100;
          }

          // Ensure progress never goes backwards (except for stage changes)
          const currentStageIndex = [
            'connecting',
            'ping',
            'download',
            'upload',
            'complete',
          ].indexOf(progress.stage);
          const newStageIndex = ['connecting', 'ping', 'download', 'upload', 'complete'].indexOf(
            stage
          );

          if (newStageIndex >= currentStageIndex) {
            // Same stage or advancing - ensure progress doesn't go backwards
            if (newStageIndex === currentStageIndex) {
              normalizedProgress = Math.max(progress.progress, normalizedProgress);
            }
          }

          setProgress({
            stage: stage as any,
            download,
            upload,
            ping,
            progress: normalizedProgress,
          });
        } else if (data.type === 'result') {
          setIsTestCompleted(true);

          const result: SpeedTestResult = {
            download: data.download || 0,
            upload: data.upload || 0,
            ping: data.ping || 0,
            jitter: data.jitter || 0,
            packetLoss: data.packetLoss || 0,
            serverId: data.serverId,
            serverName: data.serverName,
            ispName: data.ispName || 'Unknown ISP',
            clientIp: data.clientIp || 'Unknown',
            serverLocation: data.serverLocation || 'Unknown',
            resultUrl: data.resultUrl,
            ispValidation: data.ispValidation,
          };

          setProgress({
            stage: 'complete',
            download: result.download,
            upload: result.upload,
            ping: result.ping,
            progress: 100,
          });

          setFinalResult(result);
          eventSource.close();
          setEventSourceRef(null);
          handleCompleteRef.current?.(result);
        } else if (data.type === 'error') {
          setIsTestCompleted(true);
          eventSource.close();
          setEventSourceRef(null);
          handleErrorRef.current?.(data.error, data);
        }
      } catch (error) {
        // Don't close the connection for single parse errors, just continue
      }
    };

    eventSource.onerror = error => {
      // Only close if the connection is in a failed state
      if (eventSource.readyState === EventSource.CLOSED) {
        setIsTestCompleted(true);
        setEventSourceRef(null);
        handleErrorRef.current?.('Connection to speed test failed - test was interrupted');
      }
      // Let it try to reconnect automatically for other states
    };
  };
  useEffect(() => {
    if (!isRunning || isTestCompleted || eventSourceRef || isValidatingISP || ispValidationError) {
      return;
    }

    setHasEverStarted(true);

    if (selectedISP) {
      validateISPBeforeTest();
    } else {
      startSpeedTest();
    }
  }, [isRunning, officeId, isValidatingISP, ispValidationError]);

  // Reset validation state when ISP or section changes
  useEffect(() => {
    setIspValidationError(null);
    setIsValidatingISP(false);
    setIsTestCompleted(false);
    setHasEverStarted(false);
    setFinalResult(null);
    setProgress({
      stage: 'connecting',
      download: 0,
      upload: 0,
      ping: 0,
      progress: 0,
    });
  }, [selectedISP, selectedSection]);

  // Cleanup effect to close EventSource when component unmounts or isRunning becomes false
  useEffect(() => {
    return () => {
      if (eventSourceRef) {
        eventSourceRef.close();
        setEventSourceRef(null);
      }
    };
  }, []);

  // Close EventSource when isRunning becomes false
  useEffect(() => {
    if (!isRunning && eventSourceRef) {
      eventSourceRef.close();
      setEventSourceRef(null);
    }
  }, [isRunning, eventSourceRef]);

  const downloadColor = useMemo(() => {
    const threshold = 100;
    if (progress.download >= threshold) return 'text-green-500';
    if (progress.download >= threshold * 0.7) return 'text-yellow-500';
    return 'text-red-500';
  }, [progress.download]);

  const uploadColor = useMemo(() => {
    const threshold = 50;
    if (progress.upload >= threshold) return 'text-green-500';
    if (progress.upload >= threshold * 0.7) return 'text-yellow-500';
    return 'text-red-500';
  }, [progress.upload]);

  const pingColor = useMemo(() => {
    if (progress.ping <= 20) return 'text-green-500';
    if (progress.ping <= 50) return 'text-yellow-500';
    return 'text-red-500';
  }, [progress.ping]);

  const getStageText = () => {
    if (isValidatingISP) return 'Validating ISP...';
    if (ispValidationError) return 'Test Stopped';

    switch (progress.stage) {
      case 'connecting':
        return 'Connecting to server...';
      case 'ping':
        return 'Testing latency...';
      case 'download':
        return 'Testing download speed...';
      case 'upload':
        return 'Testing upload speed...';
      case 'complete':
        return 'Test completed!';
      default:
        return 'Initializing...';
    }
  };
  const renderSpeedometer = (
    value: number,
    max: number,
    label: string,
    unit: string,
    color: string
  ) => {    const percentage = Math.min((value / max) * 100, 100);
    const radius = 35; // Smaller radius
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (circumference * percentage) / 100;

    let strokeColor = '#ef4444';
    let gradientColors = 'from-red-400 to-red-600';
    if (color === 'text-green-500') {
      strokeColor = '#22c55e';
      gradientColors = 'from-green-400 to-green-600';
    } else if (color === 'text-yellow-500') {
      strokeColor = '#eab308';
      gradientColors = 'from-yellow-400 to-orange-500';
    }

    const isActive =
      (progress.stage === 'download' && label === 'Download') ||
      (progress.stage === 'upload' && label === 'Upload') ||
      (progress.stage === 'ping' && label === 'Ping');    return (
      <div className="flex flex-col items-center group">
        <div className={`relative w-32 h-32 transition-transform duration-300 ${isActive ? 'scale-105' : 'hover:scale-105'}`}>
          {/* Background glow effect */}
          <div className={`absolute inset-0 rounded-full blur-xl opacity-20 ${isActive ? 'animate-pulse' : ''}`} 
               style={{ backgroundColor: strokeColor }}></div>
          
          {/* Main speedometer */}
          <div className="relative w-full h-full bg-white rounded-full shadow-2xl border-4 border-gray-100">
            <svg className="w-full h-full" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
              {/* Background circle */}
              <circle 
                cx="50" 
                cy="50" 
                r={radius} 
                stroke="#f3f4f6" 
                strokeWidth="8" 
                fill="none" 
                className="drop-shadow-sm"
              />
              {/* Progress circle */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                stroke={strokeColor}
                strokeWidth="8"
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="drop-shadow-lg transition-all duration-700 ease-out"
                style={{
                  filter: isActive ? `drop-shadow(0 0 12px ${strokeColor}) brightness(1.1)` : 'none',
                }}
              />
              {/* Inner glow circle */}
              {isActive && (
                <circle
                  cx="50"
                  cy="50"
                  r={radius - 4}
                  stroke={strokeColor}
                  strokeWidth="2"
                  fill="none"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  className="opacity-30 animate-pulse"
                />
              )}
            </svg>
              {/* Center content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-2xl font-bold transition-all duration-300 ${color} ${isActive ? 'scale-110' : ''}`}>
                {value.toFixed(1)}
              </span>
              <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
                {unit}
              </span>
              {isActive && (
                <div className="mt-1 flex space-x-1">
                  <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              )}
            </div>
          </div>
        </div>        
        {/* Label */}
        <div className="mt-3 text-center">
          <div className={`text-base font-bold transition-colors duration-300 ${
            isActive ? 'text-blue-600' : 'text-gray-900'
          }`}>
            {label}
          </div>
          {isActive && (
            <div className="text-xs text-blue-600 font-medium animate-pulse mt-1">
              ⚡ Testing...
            </div>
          )}
        </div>
      </div>
    );
  };  return (
    <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-xl border border-gray-100 p-6 max-h-[90vh] overflow-y-auto">
      <div className="text-center mb-6">
        <div className="flex items-center justify-center mb-3">
          <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full shadow-lg">
            <Wifi className="h-6 w-6 text-white" />
          </div>
        </div>
        <h3 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-1">
          Internet Speed Test
        </h3>
        <p className="text-gray-600 text-base">{getStageText()}</p>        {ispValidationError && (
          <div className="mt-4 p-4 bg-gradient-to-r from-red-50 to-red-100 rounded-xl border-l-4 border-red-500 shadow-md">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="text-base font-semibold text-red-800">Speed Test Stopped</h4>
                <div className="mt-1 text-sm text-red-700 whitespace-pre-line leading-relaxed">
                  {ispValidationError}
                </div>
                <div className="mt-2 p-2 bg-red-100 rounded-lg">
                  <p className="text-xs text-red-600 font-medium">
                    💡 Please select the correct ISP and try again.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {isValidatingISP && (
          <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-100 rounded-xl border-l-4 border-blue-500 shadow-md">
            <div className="flex items-center justify-center space-x-3">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              </div>
              <div className="text-center">
                <h4 className="text-base font-semibold text-blue-800">Validating ISP Connection</h4>
                <p className="mt-1 text-sm text-blue-600">
                  🔍 Checking if your connection matches the selected ISP...
                </p>
              </div>
            </div>
          </div>
        )}
      </div>      <div className="mb-6">
        <div className="flex justify-between items-center text-sm font-medium text-gray-700 mb-2">
          <span className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <span>Progress</span>
          </span>
          <span className="text-base font-bold text-blue-600">{Math.round(progress.progress)}%</span>
        </div>
        <div className="relative w-full bg-gray-200 rounded-full h-3 shadow-inner">
          <div
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 via-purple-500 to-blue-600 rounded-full shadow-lg transition-all duration-700 ease-out"
            style={{
              width: `${Math.max(0, Math.min(100, progress.progress))}%`,
              boxShadow: '0 2px 10px rgba(59, 130, 246, 0.5)',
            }}
          >
            <div className="absolute inset-0 bg-white opacity-30 rounded-full animate-pulse"></div>
          </div>
        </div>
      </div>      <div className="grid grid-cols-3 gap-4 mb-6">
        {renderSpeedometer(progress.download, 200, 'Download', 'Mbps', downloadColor)}
        {renderSpeedometer(progress.upload, 100, 'Upload', 'Mbps', uploadColor)}
        {renderSpeedometer(progress.ping, 100, 'Ping', 'ms', pingColor)}
      </div>      <div className="flex flex-wrap justify-center gap-2 mb-6">
        {['connecting', 'ping', 'download', 'upload', 'complete'].map((stage, index) => {
          const isActive = progress.stage === stage;
          const isCompleted = index < ['connecting', 'ping', 'download', 'upload', 'complete'].indexOf(progress.stage);
          
          return (
            <div
              key={stage}
              className={`flex items-center space-x-2 px-3 py-1 rounded-full transition-all duration-300 text-sm ${
                isActive
                  ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg scale-105'
                  : isCompleted
                    ? 'bg-gradient-to-r from-green-100 to-green-200 text-green-700 shadow-md'
                    : 'bg-gray-100 text-gray-500'
              }`}
            >
              <div
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  isActive
                    ? 'bg-white animate-pulse shadow-lg'
                    : isCompleted
                      ? 'bg-green-500 shadow-md'
                      : 'bg-gray-300'
                }`}
              />
              <span className="font-semibold capitalize tracking-wide">{stage}</span>
              {isActive && (
                <div className="flex space-x-1">
                  <div className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              )}
            </div>
          );
        })}
      </div>      {finalResult && progress.stage === 'complete' && (
        <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-4 shadow-lg border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-lg font-bold text-gray-900">🎉 Test Results</h4>
            <div className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
              Complete
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3 text-sm mb-4">
            <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center space-x-2">
                <div className="p-1 bg-blue-100 rounded-lg">
                  <div className="w-3 h-3 bg-blue-500 rounded"></div>
                </div>
                <div>
                  <span className="text-gray-600 text-xs">Download</span>
                  <div className="text-lg font-bold text-gray-900">
                    {finalResult.download.toFixed(1)} <span className="text-sm text-gray-500">Mbps</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center space-x-2">
                <div className="p-1 bg-green-100 rounded-lg">
                  <div className="w-3 h-3 bg-green-500 rounded"></div>
                </div>
                <div>
                  <span className="text-gray-600 text-xs">Upload</span>
                  <div className="text-lg font-bold text-gray-900">
                    {finalResult.upload.toFixed(1)} <span className="text-sm text-gray-500">Mbps</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center space-x-2">
                <div className="p-1 bg-yellow-100 rounded-lg">
                  <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                </div>
                <div>
                  <span className="text-gray-600 text-xs">Ping</span>
                  <div className="text-lg font-bold text-gray-900">
                    {finalResult.ping.toFixed(1)} <span className="text-sm text-gray-500">ms</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center space-x-2">
                <div className="p-1 bg-purple-100 rounded-lg">
                  <div className="w-3 h-3 bg-purple-500 rounded"></div>
                </div>
                <div>
                  <span className="text-gray-600 text-xs">Average Speed</span>
                  <div className="text-lg font-bold text-purple-600">
                    {((finalResult.download + finalResult.upload) / 2).toFixed(1)} <span className="text-sm text-gray-500">Mbps</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="bg-white p-2 rounded-lg shadow-sm border border-gray-100 flex justify-between">
              <span className="text-gray-600 text-sm">Jitter:</span>
              <span className="font-semibold text-gray-900 text-sm">
                {finalResult.jitter?.toFixed(1) || 0} ms
              </span>
            </div>
            
            {finalResult.ispName && (
              <div className="bg-white p-2 rounded-lg shadow-sm border border-gray-100 flex justify-between">
                <span className="text-gray-600 text-sm">ISP:</span>
                <span className="font-semibold text-blue-600 text-sm">{finalResult.ispName}</span>
              </div>
            )}
            
            {finalResult.resultUrl && (
              <div className="bg-white p-2 rounded-lg shadow-sm border border-gray-100">
                <span className="text-gray-600 text-sm">Ookla Result: </span>
                <a
                  href={finalResult.resultUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-blue-600 hover:text-blue-800 underline transition-colors duration-200 text-sm"
                >
                  🔗 View on Speedtest.net
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
