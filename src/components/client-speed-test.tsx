'use client';

import { useState, useEffect, useRef } from 'react';

interface SpeedTestProgress {
  type: 'progress' | 'result' | 'error';
  stage: 'connecting' | 'ping' | 'download' | 'upload' | 'complete';
  progress: number;
  download: number;
  upload: number;
  ping: number;
  jitter?: number;
  packetLoss?: number;
  ispName?: string;
  clientIp?: string;
  serverLocation?: string;
  resultUrl?: string;
  complete?: boolean;
  error?: string;
}

interface ClientSpeedTestProps {
  officeId: string;
  selectedISP?: string;
  selectedSection?: string;
  onComplete: (result: any) => void;
  onError: (error: string, errorData?: any) => void;
  onProgress?: (progress: SpeedTestProgress) => void;
}

export default function ClientSpeedTest({
  officeId,
  selectedISP,
  selectedSection,
  onComplete,
  onError,
  onProgress,
}: ClientSpeedTestProps) {
  const [progress, setProgress] = useState<SpeedTestProgress>({
    type: 'progress',
    stage: 'connecting',
    progress: 0,
    download: 0,
    upload: 0,
    ping: 0,
  });

  const [isRunning, setIsRunning] = useState(false);
  const [userISP, setUserISP] = useState<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);

  // Detect user's ISP using multiple services
  const detectUserISP = async (): Promise<string> => {
    const services = [
      { url: 'https://ipapi.co/json/', parse: (data: any) => data.org },
      { url: 'https://ipwhois.app/json/', parse: (data: any) => data.isp },
      { url: 'https://api.ipgeolocation.io/ipgeo?apiKey=free', parse: (data: any) => data.isp },
      { url: 'https://httpbin.org/ip', parse: (data: any) => data.origin },
    ];

    for (const service of services) {
      try {
        const response = await fetch(service.url, { 
          signal: AbortSignal.timeout(5000),
          headers: { 'Accept': 'application/json' }
        });
        
        if (response.ok) {
          const data = await response.json();
          const isp = service.parse(data);
          if (isp && isp !== 'unknown' && typeof isp === 'string') {
            console.log(`✅ Detected ISP from ${service.url}: ${isp}`);
            return isp.replace(/^AS\d+\s+/, ''); // Remove AS number prefix
          }
        }
      } catch (error) {
        console.log(`⚠️ Failed to detect ISP from ${service.url}:`, error);
      }
    }

    return 'Auto-Detected ISP';
  };

  // Run client-side speed test using multiple test endpoints
  const runClientSpeedTest = async () => {
    if (isRunning) return;

    setIsRunning(true);
    abortControllerRef.current = new AbortController();

    try {
      // First detect user's ISP
      setProgress({
        type: 'progress',
        stage: 'connecting',
        progress: 5,
        download: 0,
        upload: 0,
        ping: 0,
      });

      const detectedISP = await detectUserISP();
      setUserISP(detectedISP);
      console.log(`🌐 User ISP detected: ${detectedISP}`);

      // Update progress
      setProgress(prev => ({ ...prev, progress: 10, ispName: detectedISP }));
      onProgress?.({ ...progress, progress: 10, ispName: detectedISP });

      // Run ping test
      await runPingTest();

      // Run download test
      await runDownloadTest();

      // Run upload test
      await runUploadTest();

      // Complete the test
      const preliminaryResult = {
        download: progress.download,
        upload: progress.upload,
        ping: progress.ping,
        jitter: progress.jitter || 0,
        packetLoss: progress.packetLoss || 0,
        ispName: detectedISP,
        clientIp: await getClientIP(),
        serverLocation: 'Client-Side Test',
        testType: 'client-side',
        timestamp: new Date().toISOString(),
      };

      // Validate the results server-side if ISP is selected
      let finalResult: any = preliminaryResult;
      if (selectedISP) {
        try {
          const validationResponse = await fetch('/api/speedtest/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              selectedISP,
              detectedISP,
              testResult: preliminaryResult,
            }),
          });

          if (validationResponse.ok) {
            const validationData = await validationResponse.json();
            finalResult = {
              ...preliminaryResult,
              ispValidation: validationData.validation,
              serverValidated: true,
            };
            
            console.log('✅ Speed test validated server-side:', validationData);
          } else {
            const errorData = await validationResponse.json();
            console.error('❌ Server validation failed:', errorData);
            
            // If validation fails due to ISP mismatch, still proceed but note the issue
            if (errorData.validation?.allowProceed === false) {
              finalResult = {
                ...preliminaryResult,
                ispValidation: errorData.validation,
                serverValidated: false,
                validationError: errorData.error,
              };
            }
          }
        } catch (validationError) {
          console.error('❌ Validation request failed:', validationError);
          // Proceed without validation if server is unavailable
        }
      }

      setProgress({
        type: 'result',
        stage: 'complete',
        progress: 100,
        download: progress.download,
        upload: progress.upload,
        ping: progress.ping,
        jitter: progress.jitter,
        packetLoss: progress.packetLoss,
        ispName: detectedISP,
        complete: true,
      });

      onComplete(finalResult);

    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Speed test aborted');
        return;
      }

      console.error('Speed test error:', error);
      onError(error.message || 'Speed test failed');
    } finally {
      setIsRunning(false);
    }
  };

  // Get client IP
  const getClientIP = async (): Promise<string> => {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch {
      return 'Unknown';
    }
  };

  // Run ping test using multiple servers
  const runPingTest = async () => {
    const testServers = [
      'https://www.google.com/favicon.ico',
      'https://www.cloudflare.com/favicon.ico',
      'https://www.microsoft.com/favicon.ico',
    ];

    let bestPing = Infinity;
    const pingResults: number[] = [];

    for (let i = 0; i < 3; i++) {
      for (const server of testServers) {
        try {
          const start = performance.now();
          await fetch(server, { 
            method: 'HEAD', 
            cache: 'no-cache',
            signal: AbortSignal.timeout(5000)
          });
          const ping = performance.now() - start;
          pingResults.push(ping);
          bestPing = Math.min(bestPing, ping);
        } catch {
          // Ignore failed pings
        }
      }

      const progressPercent = ((i + 1) / 3) * 20; // 20% for ping phase
      setProgress(prev => ({
        ...prev,
        stage: 'ping',
        progress: 10 + progressPercent,
        ping: bestPing === Infinity ? 0 : bestPing,
      }));
      onProgress?.({ ...progress, stage: 'ping', progress: 10 + progressPercent, ping: bestPing === Infinity ? 0 : bestPing });

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Calculate jitter
    if (pingResults.length > 1) {
      const avgPing = pingResults.reduce((a, b) => a + b, 0) / pingResults.length;
      const jitter = Math.sqrt(pingResults.reduce((sum, ping) => sum + Math.pow(ping - avgPing, 2), 0) / pingResults.length);
      setProgress(prev => ({ ...prev, jitter }));
    }
  };

  // Run download test using multiple file downloads
  const runDownloadTest = async () => {
    const testFiles = [
      { url: 'https://speed.cloudflare.com/__down?bytes=10000000', size: 10000000 }, // 10MB
      { url: 'https://speed.cloudflare.com/__down?bytes=25000000', size: 25000000 }, // 25MB
    ];

    let maxDownload = 0;

    for (let fileIndex = 0; fileIndex < testFiles.length; fileIndex++) {
      const file = testFiles[fileIndex];
      
      try {
        const start = performance.now();
        let loaded = 0;

        const response = await fetch(file.url, {
          signal: abortControllerRef.current?.signal,
        });

        if (!response.body) throw new Error('No response body');

        const reader = response.body.getReader();
        const contentLength = file.size;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          loaded += value?.length || 0;
          const elapsed = (performance.now() - start) / 1000; // seconds
          
          if (elapsed > 0) {
            const currentSpeed = (loaded * 8) / (elapsed * 1000000); // Mbps
            maxDownload = Math.max(maxDownload, currentSpeed);

            const fileProgress = (fileIndex / testFiles.length) + (loaded / contentLength / testFiles.length);
            const overallProgress = 30 + (fileProgress * 40); // 30-70% for download

            setProgress(prev => ({
              ...prev,
              stage: 'download',
              progress: overallProgress,
              download: currentSpeed,
            }));
            onProgress?.({ ...progress, stage: 'download', progress: overallProgress, download: currentSpeed });
          }
        }
      } catch (error) {
        console.log(`Download test failed for file ${fileIndex + 1}:`, error);
      }
    }

    setProgress(prev => ({ ...prev, download: maxDownload }));
  };

  // Run upload test using POST requests
  const runUploadTest = async () => {
    const uploadSizes = [1000000, 5000000]; // 1MB, 5MB
    let maxUpload = 0;

    for (let sizeIndex = 0; sizeIndex < uploadSizes.length; sizeIndex++) {
      const size = uploadSizes[sizeIndex];
      const data = new ArrayBuffer(size);

      try {
        const start = performance.now();
        
        await fetch('https://httpbin.org/post', {
          method: 'POST',
          body: data,
          signal: abortControllerRef.current?.signal,
        });

        const elapsed = (performance.now() - start) / 1000; // seconds
        if (elapsed > 0) {
          const uploadSpeed = (size * 8) / (elapsed * 1000000); // Mbps
          maxUpload = Math.max(maxUpload, uploadSpeed);

          const overallProgress = 70 + ((sizeIndex + 1) / uploadSizes.length) * 25; // 70-95%

          setProgress(prev => ({
            ...prev,
            stage: 'upload',
            progress: overallProgress,
            upload: uploadSpeed,
          }));
          onProgress?.({ ...progress, stage: 'upload', progress: overallProgress, upload: uploadSpeed });
        }
      } catch (error) {
        console.log(`Upload test failed for size ${size}:`, error);
      }
    }

    setProgress(prev => ({ ...prev, upload: maxUpload }));
  };

  // Start test on mount
  useEffect(() => {
    runClientSpeedTest();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Custom speedometer display */}
      <div className="text-center space-y-4">
        {/* Speed displays */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-600">
              {progress.download.toFixed(1)}
            </div>
            <div className="text-sm text-gray-600">Mbps Down</div>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-600">
              {progress.upload.toFixed(1)}
            </div>
            <div className="text-sm text-gray-600">Mbps Up</div>
          </div>
          <div className="bg-orange-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-orange-600">
              {progress.ping.toFixed(0)}
            </div>
            <div className="text-sm text-gray-600">ms Ping</div>
          </div>
        </div>

        {/* Progress indicator */}
        <div className="relative w-32 h-32 mx-auto">
          <svg className="transform -rotate-90 w-32 h-32">
            <circle
              cx="64"
              cy="64"
              r="56"
              stroke="currentColor"
              strokeWidth="8"
              fill="transparent"
              className="text-gray-200"
            />
            <circle
              cx="64"
              cy="64"
              r="56"
              stroke="currentColor"
              strokeWidth="8"
              fill="transparent"
              strokeDasharray={`${2 * Math.PI * 56}`}
              strokeDashoffset={`${2 * Math.PI * 56 * (1 - progress.progress / 100)}`}
              className="text-blue-600 transition-all duration-300"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-lg font-bold">{Math.round(progress.progress)}%</div>
              <div className="text-xs text-gray-500 capitalize">{progress.stage}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="text-center space-y-2">
        <div className="text-sm text-gray-600">
          {progress.stage === 'connecting' && 'Connecting and detecting ISP...'}
          {progress.stage === 'ping' && 'Testing latency...'}
          {progress.stage === 'download' && 'Testing download speed...'}
          {progress.stage === 'upload' && 'Testing upload speed...'}
          {progress.stage === 'complete' && 'Test complete!'}
        </div>
        
        {userISP && (
          <div className="text-xs text-gray-500">
            Detected ISP: {userISP}
          </div>
        )}

        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress.progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
