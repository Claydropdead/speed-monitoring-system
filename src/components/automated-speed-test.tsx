/**
 * Automated client-side speed test similar to server-side Ookla CLI
 * This prevents cheating by automating the test while still testing the user's real connection
 */

'use client';

import { useEffect, useState, useRef } from 'react';

interface AutomatedSpeedTestResult {
  download: number;
  upload: number;
  ping: number;
  jitter: number;
  isp: string;
  serverName: string;
  serverLocation: string;
  clientIP: string;
  timestamp: string;
  rawData: string;
}

interface AutomatedSpeedTestProps {
  onComplete: (result: AutomatedSpeedTestResult) => void;
  onError: (error: string) => void;
  onStart?: () => void;
}

interface TestProgress {
  stage: 'connecting' | 'ping' | 'download' | 'upload' | 'complete';
  progress: number; // 0-100
  currentSpeed?: number;
  ping?: number;
  jitter?: number;
  message?: string;
}

export default function AutomatedSpeedTest({ onComplete, onError, onStart }: AutomatedSpeedTestProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<TestProgress>({
    stage: 'connecting',
    progress: 0,
    message: 'Initializing...'
  });
  const abortControllerRef = useRef<AbortController | null>(null);

  const runAutomatedTest = async () => {
    if (isRunning) return;

    const startTime = Date.now();

    try {
      setIsRunning(true);
      onStart?.();
      abortControllerRef.current = new AbortController();

      console.log('🚀 Starting automated client-side speed test...');

      // Stage 1: Get client info (IP, ISP)
      setProgress({ stage: 'connecting', progress: 5, message: 'Detecting your IP and ISP...' });
      const clientInfo = await getClientInfo();
      console.log('🌐 Client info detected:', clientInfo);

      // Stage 2: Find best server
      setProgress({ stage: 'connecting', progress: 15, message: 'Finding best speed test server...' });
      const serverInfo = await findBestServer();
      console.log('🖥️ Best server selected:', serverInfo);

      // Stage 3: Ping test
      setProgress({ stage: 'ping', progress: 25, message: 'Testing latency...' });
      const pingResults = await testPing(serverInfo.url);
      console.log('🏓 Ping test results:', pingResults);

      setProgress({ 
        stage: 'ping', 
        progress: 35, 
        ping: pingResults.ping,
        jitter: pingResults.jitter,
        message: `Ping: ${pingResults.ping}ms, Jitter: ${pingResults.jitter}ms` 
      });

      // Stage 4: Download test
      setProgress({ stage: 'download', progress: 40, message: 'Testing download speed...' });
      const downloadResult = await testDownload(serverInfo.url, (downloadProgress, speed) => {
        setProgress({
          stage: 'download',
          progress: 40 + (downloadProgress * 0.25), // 40% to 65%
          currentSpeed: speed,
          message: `Download: ${speed.toFixed(1)} Mbps`
        });
      });
      console.log('⬇️ Download test results:', downloadResult);

      // Stage 5: Upload test
      setProgress({ stage: 'upload', progress: 65, message: 'Testing upload speed...' });
      const uploadResult = await testUpload(serverInfo.url, (uploadProgress, speed) => {
        setProgress({
          stage: 'upload',
          progress: 65 + (uploadProgress * 0.30), // 65% to 95%
          currentSpeed: speed,
          message: `Upload: ${speed.toFixed(1)} Mbps`
        });
      });
      console.log('⬆️ Upload test results:', uploadResult);

      // Stage 6: Complete
      setProgress({ stage: 'complete', progress: 100, message: 'Speed test completed!' });

      const result: AutomatedSpeedTestResult = {
        download: downloadResult.speed,
        upload: uploadResult.speed,
        ping: pingResults.ping,
        jitter: pingResults.jitter,
        isp: clientInfo.isp,
        serverName: serverInfo.name,
        serverLocation: serverInfo.location,
        clientIP: clientInfo.ip,
        timestamp: new Date().toISOString(),
        rawData: JSON.stringify({
          clientInfo,
          serverInfo,
          pingResults,
          downloadResult,
          uploadResult,
          testDuration: Date.now() - startTime
        })
      };

      console.log('✅ Automated speed test completed:', result);
      onComplete(result);

    } catch (error) {
      console.error('❌ Automated speed test failed:', error);
      onError(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setIsRunning(false);
      abortControllerRef.current = null;
    }
  };

  const stopTest = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsRunning(false);
    setProgress({ stage: 'connecting', progress: 0, message: 'Test cancelled' });
  };

  // Client info detection (IP and ISP)
  const getClientInfo = async (): Promise<{ ip: string; isp: string }> => {
    const services = [
      'https://ipapi.co/json/',
      'https://ipwhois.app/json/',
      'https://api.ipify.org?format=json'
    ];

    for (const service of services) {
      try {
        const response = await fetch(service, {
          signal: abortControllerRef.current?.signal
        });

        if (response.ok) {
          const data = await response.json();
          return {
            ip: data.ip || data.query || 'Unknown',
            isp: data.org || data.isp || data.as || 'Unknown ISP'
          };
        }
      } catch (error) {
        continue; // Try next service
      }
    }

    throw new Error('Unable to detect IP and ISP information');
  };

  // Find best speed test server
  const findBestServer = async (): Promise<{ url: string; name: string; location: string; id: string }> => {
    const testServers = [
      {
        id: 'cloudflare',
        name: 'Cloudflare Speed Test',
        location: 'Global CDN',
        url: 'https://speed.cloudflare.com'
      },
      {
        id: 'fast',
        name: 'Fast.com (Netflix)',
        location: 'Global',
        url: 'https://fast.com'
      },
      {
        id: 'google',
        name: 'Google Cloud',
        location: 'Global',
        url: 'https://storage.googleapis.com'
      }
    ];

    let bestServer = testServers[0];
    let bestLatency = Infinity;

    for (const server of testServers) {
      try {
        const start = performance.now();
        const response = await fetch(server.url, {
          method: 'HEAD',
          signal: abortControllerRef.current?.signal
        });
        const latency = performance.now() - start;

        if (response.ok && latency < bestLatency) {
          bestLatency = latency;
          bestServer = server;
        }
      } catch (error) {
        continue; // Try next server
      }
    }

    return bestServer;
  };

  // Ping test
  const testPing = async (serverUrl: string): Promise<{ ping: number; jitter: number }> => {
    const pingTests = 5;
    const latencies: number[] = [];

    for (let i = 0; i < pingTests; i++) {
      const start = performance.now();
      try {
        await fetch(serverUrl, {
          method: 'HEAD',
          signal: abortControllerRef.current?.signal
        });
        const latency = performance.now() - start;
        latencies.push(latency);
      } catch (error) {
        latencies.push(1000); // High latency for failed requests
      }
    }

    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const jitter = Math.sqrt(
      latencies.reduce((sum, lat) => sum + Math.pow(lat - avgLatency, 2), 0) / latencies.length
    );

    return {
      ping: Math.round(avgLatency),
      jitter: Math.round(jitter)
    };
  };

  // Download speed test
  const testDownload = async (
    serverUrl: string,
    onProgress: (progress: number, speed: number) => void
  ): Promise<{ speed: number }> => {
    const testDuration = 10; // seconds
    const chunkSize = 1024 * 1024; // 1MB chunks
    const targetSize = 50 * 1024 * 1024; // 50MB total

    const startTime = performance.now();
    let downloadedBytes = 0;
    let chunks = 0;
    const maxChunks = Math.floor(targetSize / chunkSize);

    // Use a reliable download endpoint
    const downloadUrls = [
      'https://httpbin.org/bytes/1048576', // 1MB
      'https://speed.cloudflare.com/__down?bytes=1048576', // 1MB from Cloudflare
      'https://proof.ovh.net/files/1Mb.dat' // 1MB file
    ];

    while (chunks < maxChunks && (performance.now() - startTime) / 1000 < testDuration) {
      try {
        const urlIndex = chunks % downloadUrls.length;
        const response = await fetch(downloadUrls[urlIndex], {
          signal: abortControllerRef.current?.signal
        });

        if (response.ok) {
          const blob = await response.blob();
          downloadedBytes += blob.size;
          chunks++;

          const elapsed = (performance.now() - startTime) / 1000;
          const speedMbps = (downloadedBytes * 8) / (elapsed * 1000000);
          const progress = Math.min((chunks / maxChunks) * 100, 100);

          onProgress(progress, speedMbps);
        }
      } catch (error) {
        break; // Stop on error
      }
    }

    const totalTime = (performance.now() - startTime) / 1000;
    const speedMbps = (downloadedBytes * 8) / (totalTime * 1000000);

    return { speed: Math.round(speedMbps * 100) / 100 };
  };

  // Upload speed test
  const testUpload = async (
    serverUrl: string,
    onProgress: (progress: number, speed: number) => void
  ): Promise<{ speed: number }> => {
    const testDuration = 10; // seconds
    const chunkSize = 64 * 1024; // 64KB chunks
    const totalChunks = 100;

    // Generate random data
    const data = new Uint8Array(chunkSize);
    crypto.getRandomValues(data);

    const startTime = performance.now();
    let uploadedBytes = 0;

    for (let i = 0; i < totalChunks && (performance.now() - startTime) / 1000 < testDuration; i++) {
      try {
        await fetch('https://httpbin.org/post', {
          method: 'POST',
          body: data,
          signal: abortControllerRef.current?.signal
        });

        uploadedBytes += chunkSize;

        const elapsed = (performance.now() - startTime) / 1000;
        const speedMbps = (uploadedBytes * 8) / (elapsed * 1000000);
        const progress = Math.min((i / totalChunks) * 100, 100);

        onProgress(progress, speedMbps);
      } catch (error) {
        break; // Stop on error
      }
    }

    const totalTime = (performance.now() - startTime) / 1000;
    const speedMbps = (uploadedBytes * 8) / (totalTime * 1000000);

    return { speed: Math.round(speedMbps * 100) / 100 };
  };

  const getProgressColor = () => {
    switch (progress.stage) {
      case 'connecting': return 'bg-blue-500';
      case 'ping': return 'bg-yellow-500';
      case 'download': return 'bg-green-500';
      case 'upload': return 'bg-purple-500';
      case 'complete': return 'bg-emerald-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Automated Speed Test
        </h3>
        <p className="text-sm text-gray-600">
          This will automatically test your internet speed using your actual connection
        </p>
      </div>

      {!isRunning ? (
        <button
          onClick={runAutomatedTest}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
        >
          Start Automated Speed Test
        </button>
      ) : (
        <div className="space-y-4">
          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all duration-300 ${getProgressColor()}`}
              style={{ width: `${progress.progress}%` }}
            />
          </div>

          {/* Progress Info */}
          <div className="text-center space-y-2">
            <div className="text-sm font-medium text-gray-900 capitalize">
              {progress.stage === 'connecting' ? 'Connecting' : 
               progress.stage === 'ping' ? 'Testing Latency' :
               progress.stage === 'download' ? 'Testing Download' :
               progress.stage === 'upload' ? 'Testing Upload' : 'Complete'}
            </div>
            <div className="text-xs text-gray-600">
              {progress.message}
            </div>
            <div className="text-lg font-bold text-gray-900">
              {progress.progress.toFixed(0)}%
            </div>
          </div>

          {/* Current Stats */}
          {(progress.ping || progress.currentSpeed) && (
            <div className="grid grid-cols-2 gap-4 text-center">
              {progress.ping && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-xs text-gray-600">Ping</div>
                  <div className="text-lg font-semibold">{progress.ping}ms</div>
                </div>
              )}
              {progress.currentSpeed && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-xs text-gray-600">Speed</div>
                  <div className="text-lg font-semibold">{progress.currentSpeed.toFixed(1)} Mbps</div>
                </div>
              )}
            </div>
          )}

          {/* Cancel Button */}
          <button
            onClick={stopTest}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Cancel Test
          </button>
        </div>
      )}
    </div>
  );
}
