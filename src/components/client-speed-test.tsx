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

      console.log('📊 Preliminary test results:', preliminaryResult);

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

      // Update final progress with actual results
      const finalProgress = {
        type: 'result' as const,
        stage: 'complete' as const,
        progress: 100,
        download: finalResult.download,
        upload: finalResult.upload,
        ping: finalResult.ping,
        jitter: finalResult.jitter,
        packetLoss: finalResult.packetLoss,
        ispName: detectedISP,
        complete: true,
      };

      setProgress(finalProgress);
      console.log('🎯 Final speed test results:', finalResult);
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
      'https://speed.cloudflare.com/',
    ];

    let bestPing = Infinity;
    const pingResults: number[] = [];

    // Run multiple rounds of ping tests
    for (let round = 0; round < 5; round++) {
      for (const server of testServers) {
        try {
          const start = performance.now();
          await fetch(server, { 
            method: 'HEAD', 
            cache: 'no-cache',
            signal: AbortSignal.timeout(5000),
            headers: {
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache',
            }
          });
          const ping = performance.now() - start;
          pingResults.push(ping);
          bestPing = Math.min(bestPing, ping);
        } catch {
          // Ignore failed pings
        }
      }

      const progressPercent = ((round + 1) / 5) * 20; // 20% for ping phase
      const currentPing = bestPing === Infinity ? 0 : bestPing;
      
      setProgress(prev => ({
        ...prev,
        stage: 'ping',
        progress: 10 + progressPercent,
        ping: currentPing,
      }));
      onProgress?.({ ...progress, stage: 'ping', progress: 10 + progressPercent, ping: currentPing });

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Calculate jitter and final ping
    if (pingResults.length > 1) {
      const avgPing = pingResults.reduce((a, b) => a + b, 0) / pingResults.length;
      const jitter = Math.sqrt(pingResults.reduce((sum, ping) => sum + Math.pow(ping - avgPing, 2), 0) / pingResults.length);
      const finalPing = avgPing; // Use average ping for final result
      
      setProgress(prev => ({ 
        ...prev, 
        ping: finalPing,
        jitter 
      }));
      
      console.log(`Ping test completed: ${finalPing.toFixed(1)}ms avg, ${jitter.toFixed(1)}ms jitter, ${bestPing.toFixed(1)}ms best`);
    }
  };

  // Run download test using multiple file downloads
  const runDownloadTest = async () => {
    const testFiles = [
      { url: 'https://speed.cloudflare.com/__down?bytes=1000000', size: 1000000 }, // 1MB
      { url: 'https://speed.cloudflare.com/__down?bytes=5000000', size: 5000000 }, // 5MB
      { url: 'https://speed.cloudflare.com/__down?bytes=10000000', size: 10000000 }, // 10MB
    ];

    let maxDownload = 0;
    const downloadSpeeds: number[] = [];

    for (let fileIndex = 0; fileIndex < testFiles.length; fileIndex++) {
      const file = testFiles[fileIndex];
      
      try {
        const start = performance.now();
        let loaded = 0;

        const response = await fetch(file.url, {
          signal: abortControllerRef.current?.signal,
          cache: 'no-cache',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
          }
        });

        if (!response.body) throw new Error('No response body');

        const reader = response.body.getReader();
        const startTime = performance.now();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          loaded += value?.length || 0;
          const elapsed = (performance.now() - startTime) / 1000; // seconds
          
          if (elapsed > 0.5) { // Only calculate after 500ms to get stable readings
            const currentSpeed = (loaded * 8) / (elapsed * 1000000); // Mbps
            maxDownload = Math.max(maxDownload, currentSpeed);
            downloadSpeeds.push(currentSpeed);

            const fileProgress = (fileIndex / testFiles.length) + (loaded / file.size / testFiles.length);
            const overallProgress = 30 + (fileProgress * 40); // 30-70% for download

            setProgress(prev => ({
              ...prev,
              stage: 'download',
              progress: Math.min(70, overallProgress),
              download: currentSpeed,
            }));
            onProgress?.({ ...progress, stage: 'download', progress: Math.min(70, overallProgress), download: currentSpeed });
          }
        }

        // Calculate final speed for this file
        const totalTime = (performance.now() - start) / 1000;
        if (totalTime > 0) {
          const fileSpeed = (loaded * 8) / (totalTime * 1000000); // Mbps
          downloadSpeeds.push(fileSpeed);
          maxDownload = Math.max(maxDownload, fileSpeed);
        }

      } catch (error) {
        console.log(`Download test failed for file ${fileIndex + 1}:`, error);
      }

      // Small delay between files
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Use the best speed recorded
    const finalDownloadSpeed = downloadSpeeds.length > 0 ? Math.max(...downloadSpeeds) : 0;
    setProgress(prev => ({ ...prev, download: finalDownloadSpeed }));
    console.log(`Download test completed: ${finalDownloadSpeed.toFixed(2)} Mbps (max: ${maxDownload.toFixed(2)} Mbps)`);
  };

  // Run upload test using POST requests
  const runUploadTest = async () => {
    const uploadSizes = [500000, 1000000, 2000000]; // 500KB, 1MB, 2MB
    let maxUpload = 0;
    const uploadSpeeds: number[] = [];

    for (let sizeIndex = 0; sizeIndex < uploadSizes.length; sizeIndex++) {
      const size = uploadSizes[sizeIndex];
      
      // Create random data to upload
      const data = new Uint8Array(size);
      for (let i = 0; i < size; i++) {
        data[i] = Math.floor(Math.random() * 256);
      }

      try {
        const start = performance.now();
        
        const response = await fetch('https://httpbin.org/post', {
          method: 'POST',
          body: data,
          signal: abortControllerRef.current?.signal,
          headers: {
            'Content-Type': 'application/octet-stream',
            'Cache-Control': 'no-cache',
          }
        });

        const elapsed = (performance.now() - start) / 1000; // seconds
        if (elapsed > 0) {
          const uploadSpeed = (size * 8) / (elapsed * 1000000); // Mbps
          maxUpload = Math.max(maxUpload, uploadSpeed);
          uploadSpeeds.push(uploadSpeed);

          const overallProgress = 70 + ((sizeIndex + 1) / uploadSizes.length) * 25; // 70-95%

          setProgress(prev => ({
            ...prev,
            stage: 'upload',
            progress: overallProgress,
            upload: uploadSpeed,
          }));
          onProgress?.({ ...progress, stage: 'upload', progress: overallProgress, upload: uploadSpeed });

          console.log(`Upload test ${sizeIndex + 1}: ${size} bytes in ${elapsed.toFixed(2)}s = ${uploadSpeed.toFixed(2)} Mbps`);
        }

      } catch (error) {
        console.log(`Upload test failed for size ${size}:`, error);
      }

      // Small delay between uploads
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Use the best speed recorded
    const finalUploadSpeed = uploadSpeeds.length > 0 ? Math.max(...uploadSpeeds) : 0;
    setProgress(prev => ({ ...prev, upload: finalUploadSpeed }));
    console.log(`Upload test completed: ${finalUploadSpeed.toFixed(2)} Mbps (max: ${maxUpload.toFixed(2)} Mbps)`);
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
