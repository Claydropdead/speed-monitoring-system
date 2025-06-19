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
      console.log('Speedometer: Pre-validating ISP before starting speed test');
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
      console.log(
        `🌐 Speedometer: Quick ISP detection - Detected: "${detectedISP}", Selected: "${selectedISP}"`
      );

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

      console.log(`ISP Validation Result:`, validation);

      // Only proceed if ISP matches exactly or partially
      if (!validation.isMatch) {
        const errorMessage = `ISP Mismatch Detected!

Selected: ${selectedISP}
Detected: ${detectedISP}

The speed test was stopped to prevent incorrect data collection.

Please select the correct ISP that matches your actual connection.`;
        setIspValidationError(errorMessage);
        setIsValidatingISP(false);
        handleErrorRef.current?.(errorMessage, {
          type: 'isp_mismatch',
          selectedISP,
          detectedISP,
          suggestedAction: 'Please select the correct ISP and try again',
        });
        return;
      }

      // Log validation result for successful matches
      const matchType = validation.confidence === 100 ? 'exact' : 'partial';
      console.log(
        `✅ Speedometer: ISP validation passed (${matchType} match, confidence: ${validation.confidence}%), starting speed test`
      );

      setIsValidatingISP(false);
      startSpeedTest();
    } catch (error) {
      console.error('❌ Speedometer: ISP pre-validation failed:', error);
      setIsValidatingISP(false);
      const errorMessage = 'Failed to validate ISP before starting test. Please try again.';
      setIspValidationError(errorMessage);
      handleErrorRef.current?.(errorMessage, { type: 'validation_error' });
    }
  };
  const startSpeedTest = () => {
    console.log('🚀 Speedometer: Starting real-time speedtest');

    // Prevent multiple EventSource connections
    if (eventSourceRef) {
      console.log('⚠️ Speedometer: EventSource already exists, closing previous connection');
      eventSourceRef.close();
      setEventSourceRef(null);
    }

    onTestStartRef.current?.();

    const eventSource = new EventSource(
      `/api/speedtest/live?officeId=${officeId}${selectedISP ? `&selectedISP=${encodeURIComponent(selectedISP)}` : ''}${selectedSection ? `&selectedSection=${encodeURIComponent(selectedSection)}` : ''}`
    );
    setEventSourceRef(eventSource);
    eventSource.onmessage = event => {
      try {
        // Validate event data before parsing
        if (!event.data || event.data.trim() === '') {
          console.log('📊 Speedometer: Received empty event data, skipping');
          return;
        }

        const data = JSON.parse(event.data);
        console.log('📊 Speedometer: Received data:', data);

        // Validate required properties
        if (!data.type) {
          console.warn('📊 Speedometer: Received data without type property, skipping');
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
          console.log('✅ Speedometer: Final result received:', data);
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
          console.log('❌ Speedometer: Error received:', data.error);
          setIsTestCompleted(true);
          eventSource.close();
          setEventSourceRef(null);
          handleErrorRef.current?.(data.error, data);
        } else {
          console.warn('📊 Speedometer: Unknown data type received:', data.type);
        }
      } catch (error) {
        console.error('❌ Speedometer: Error parsing event data:', error, 'Raw data:', event.data);
        // Don't close the connection for single parse errors, just log and continue
      }
    };

    eventSource.onerror = error => {
      console.error('❌ Speedometer: EventSource failed:', error);
      // Only close if the connection is in a failed state
      if (eventSource.readyState === EventSource.CLOSED) {
        setIsTestCompleted(true);
        setEventSourceRef(null);
        handleErrorRef.current?.('Connection to speed test failed - test was interrupted');
      } else if (eventSource.readyState === EventSource.CONNECTING) {
        console.log('🔄 Speedometer: EventSource reconnecting...');
        // Let it try to reconnect automatically
      }
    };
  };
  useEffect(() => {
    if (!isRunning || isTestCompleted || eventSourceRef) {
      return;
    }

    setHasEverStarted(true);

    if (selectedISP) {
      validateISPBeforeTest();
    } else {
      startSpeedTest();
    }
  }, [isRunning, officeId]);

  // Cleanup effect to close EventSource when component unmounts or isRunning becomes false
  useEffect(() => {
    return () => {
      if (eventSourceRef) {
        console.log('🧹 Speedometer: Cleaning up EventSource on unmount');
        eventSourceRef.close();
        setEventSourceRef(null);
      }
    };
  }, []);

  // Close EventSource when isRunning becomes false
  useEffect(() => {
    if (!isRunning && eventSourceRef) {
      console.log('🧹 Speedometer: Closing EventSource because isRunning is false');
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
  ) => {
    const percentage = Math.min((value / max) * 100, 100);
    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (circumference * percentage) / 100;

    let strokeColor = '#ef4444';
    if (color === 'text-green-500') strokeColor = '#22c55e';
    else if (color === 'text-yellow-500') strokeColor = '#eab308';

    const isActive =
      (progress.stage === 'download' && label === 'Download') ||
      (progress.stage === 'upload' && label === 'Upload') ||
      (progress.stage === 'ping' && label === 'Ping');

    return (
      <div className="flex flex-col items-center">
        <div className="relative w-36 h-36">
          <svg className="w-36 h-36" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="50" cy="50" r={radius} stroke="#e5e7eb" strokeWidth="6" fill="none" />
            <circle
              cx="50"
              cy="50"
              r={radius}
              stroke={strokeColor}
              strokeWidth="6"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              style={{
                transition: 'stroke-dashoffset 0.15s ease-out, stroke 0.15s ease-out',
                filter: isActive ? `drop-shadow(0 0 8px ${strokeColor})` : 'none',
              }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-2xl font-bold ${color}`}>{value.toFixed(1)}</span>
            <span className="text-xs text-gray-500 uppercase tracking-wide">{unit}</span>
          </div>
        </div>
        <div className="mt-2 text-center">
          <div className="text-sm font-medium text-gray-900">{label}</div>
          {isActive && <div className="text-xs text-blue-600 animate-pulse">Testing...</div>}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="text-center mb-6">
        <h3 className="text-xl font-bold text-gray-900 mb-2">Speed Test</h3>
        <p className="text-gray-600">{getStageText()}</p>

        {ispValidationError && (
          <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-300">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-sm font-medium text-red-800">Speed Test Stopped</span>
            </div>
            <div className="mt-2 text-sm text-red-700 whitespace-pre-line">
              {ispValidationError}
            </div>
            <div className="mt-3 text-xs text-red-600">
              Please select the correct ISP and try again.
            </div>
          </div>
        )}

        {isValidatingISP && (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-300">
            <div className="flex items-center justify-center space-x-2">
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
              <span className="text-sm font-medium text-blue-800">Validating ISP...</span>
            </div>
            <div className="mt-1 text-xs text-blue-600">
              Checking if your connection matches the selected ISP
            </div>
          </div>
        )}
      </div>

      <div className="mb-8">
        <div className="flex justify-between text-xs text-gray-600 mb-2">
          <span>Progress</span>
          <span>{Math.round(progress.progress)}%</span>
        </div>{' '}
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${Math.max(0, Math.min(100, progress.progress))}%`,
              transition: 'width 0.5s ease-out',
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6 mb-6">
        {renderSpeedometer(progress.download, 200, 'Download', 'Mbps', downloadColor)}
        {renderSpeedometer(progress.upload, 100, 'Upload', 'Mbps', uploadColor)}
        {renderSpeedometer(progress.ping, 100, 'Ping', 'ms', pingColor)}
      </div>

      <div className="flex justify-center space-x-4 mb-6">
        {['connecting', 'ping', 'download', 'upload', 'complete'].map((stage, index) => (
          <div
            key={stage}
            className={`flex items-center space-x-2 ${
              progress.stage === stage
                ? 'text-blue-600'
                : index <
                    ['connecting', 'ping', 'download', 'upload', 'complete'].indexOf(progress.stage)
                  ? 'text-green-600'
                  : 'text-gray-400'
            }`}
          >
            <div
              className={`w-3 h-3 rounded-full ${
                progress.stage === stage
                  ? 'bg-blue-600 animate-pulse'
                  : index <
                      ['connecting', 'ping', 'download', 'upload', 'complete'].indexOf(
                        progress.stage
                      )
                    ? 'bg-green-600'
                    : 'bg-gray-300'
              }`}
            />
            <span className="text-xs font-medium capitalize">{stage}</span>
          </div>
        ))}
      </div>

      {finalResult && progress.stage === 'complete' && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-lg font-semibold text-gray-900 mb-3">Test Results</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Download:</span>
              <span className="ml-2 font-semibold text-gray-900">
                {finalResult.download.toFixed(1)} Mbps
              </span>
            </div>
            <div>
              <span className="text-gray-600">Upload:</span>
              <span className="ml-2 font-semibold text-gray-900">
                {finalResult.upload.toFixed(1)} Mbps
              </span>
            </div>
            <div>
              <span className="text-gray-600">Ping:</span>
              <span className="ml-2 font-semibold text-gray-900">
                {finalResult.ping.toFixed(1)} ms
              </span>
            </div>
            <div>
              <span className="text-gray-600">Jitter:</span>
              <span className="ml-2 font-semibold text-gray-900">
                {finalResult.jitter?.toFixed(1) || 0} ms
              </span>
            </div>
            {finalResult.ispName && (
              <div className="col-span-2">
                <span className="text-gray-600">ISP:</span>
                <span className="ml-2 font-semibold text-blue-600">{finalResult.ispName}</span>
              </div>
            )}
            {finalResult.resultUrl && (
              <div className="col-span-2">
                <span className="text-gray-600">Ookla Result:</span>
                <a
                  href={finalResult.resultUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 font-semibold text-blue-600 hover:text-blue-800 underline"
                >
                  View on Speedtest.net
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
