/**
 * Client-side speed test implementation
 * This runs in the user's browser to test their actual internet connection
 * instead of the server's connection (which would be Railway's connection)
 */

export interface ClientSpeedTestResult {
  download: number; // Mbps
  upload: number; // Mbps
  ping: number; // ms
  jitter?: number; // ms
  packetLoss?: number; // percentage
  serverId?: string;
  serverName?: string;
  serverLocation?: string;
  ispName?: string;
  clientIP?: string;
  resultUrl?: string;
  timestamp: string;
  testDuration: number; // seconds
}

export interface SpeedTestProgress {
  stage: 'connecting' | 'ping' | 'download' | 'upload' | 'complete';
  progress: number; // 0-100
  currentSpeed?: number; // Current speed in Mbps
  ping?: number;
  jitter?: number;
  message?: string;
}

export type ProgressCallback = (progress: SpeedTestProgress) => void;

/**
 * Client-side speed test using multiple browser-based testing methods
 */
export class ClientSpeedTest {
  private abortController: AbortController | null = null;
  private isRunning = false;

  /**
   * Run a comprehensive speed test in the client's browser
   */
  async runSpeedTest(
    onProgress: ProgressCallback,
    testConfig?: {
      duration?: number; // Test duration in seconds
      downloadSize?: number; // MB
      uploadSize?: number; // MB
    }
  ): Promise<ClientSpeedTestResult> {
    if (this.isRunning) {
      throw new Error('Speed test is already running');
    }

    this.isRunning = true;
    this.abortController = new AbortController();
    const startTime = Date.now();

    try {
      console.log('🚀 [Client Speed Test] Starting client-side speed test');
      
      // Stage 1: Connection and server discovery
      onProgress({
        stage: 'connecting',
        progress: 5,
        message: 'Connecting to speed test servers...'
      });

      const serverInfo = await this.findBestServer();
      console.log('🌐 [Client Speed Test] Server info:', serverInfo);

      // Stage 2: Ping test
      onProgress({
        stage: 'ping',
        progress: 15,
        message: 'Testing latency...'
      });

      const pingResults = await this.testPing(serverInfo.url);
      console.log('🏓 [Client Speed Test] Ping results:', pingResults);

      onProgress({
        stage: 'ping',
        progress: 25,
        ping: pingResults.ping,
        jitter: pingResults.jitter,
        message: `Ping: ${pingResults.ping}ms`
      });

      // Stage 3: Download test
      onProgress({
        stage: 'download',
        progress: 30,
        message: 'Testing download speed...'
      });

      const downloadResult = await this.testDownload(
        serverInfo.url,
        testConfig?.downloadSize || 25, // Default 25MB
        (progress, speed) => {
          onProgress({
            stage: 'download',
            progress: 30 + (progress * 0.35), // 30% to 65%
            currentSpeed: speed,
            ping: pingResults.ping,
            message: `Download: ${speed.toFixed(1)} Mbps`
          });
        }
      );

      console.log('⬇️ [Client Speed Test] Download result:', downloadResult);

      // Stage 4: Upload test
      onProgress({
        stage: 'upload',
        progress: 65,
        message: 'Testing upload speed...'
      });

      const uploadResult = await this.testUpload(
        serverInfo.url,
        testConfig?.uploadSize || 10, // Default 10MB
        (progress, speed) => {
          onProgress({
            stage: 'upload',
            progress: 65 + (progress * 0.3), // 65% to 95%
            currentSpeed: speed,
            ping: pingResults.ping,
            message: `Upload: ${speed.toFixed(1)} Mbps`
          });
        }
      );

      console.log('⬆️ [Client Speed Test] Upload result:', uploadResult);

      // Stage 5: Get client info
      const clientInfo = await this.getClientInfo();
      console.log('📱 [Client Speed Test] Client info:', clientInfo);

      // Complete
      onProgress({
        stage: 'complete',
        progress: 100,
        message: 'Speed test complete!'
      });

      const result: ClientSpeedTestResult = {
        download: downloadResult.speed,
        upload: uploadResult.speed,
        ping: pingResults.ping,
        jitter: pingResults.jitter,
        packetLoss: 0, // Browser tests don't typically measure packet loss
        serverId: serverInfo.id,
        serverName: serverInfo.name,
        serverLocation: serverInfo.location,
        ispName: clientInfo.isp,
        clientIP: clientInfo.ip,
        timestamp: new Date().toISOString(),
        testDuration: (Date.now() - startTime) / 1000
      };

      console.log('✅ [Client Speed Test] Test completed:', result);
      return result;

    } catch (error) {
      console.error('❌ [Client Speed Test] Test failed:', error);
      throw error;
    } finally {
      this.isRunning = false;
      this.abortController = null;
    }
  }

  /**
   * Find the best speed test server
   */
  private async findBestServer(): Promise<{
    id: string;
    name: string;
    location: string;
    url: string;
  }> {
    // Use public speed test APIs or create test endpoints
    // For now, we'll use a simple approach with known fast servers
    
    const testServers = [
      {
        id: 'cloudflare',
        name: 'Cloudflare',
        location: 'Global CDN',
        url: 'https://speed.cloudflare.com/__down'
      },
      {
        id: 'google',
        name: 'Google',
        location: 'Global',
        url: 'https://storage.googleapis.com/gcp-public-data-nexrad-l2'
      }
    ];

    // Test latency to each server and pick the fastest
    let bestServer = testServers[0];
    let bestLatency = Infinity;

    for (const server of testServers) {
      try {
        const start = performance.now();
        const response = await fetch(server.url, {
          method: 'HEAD',
          signal: this.abortController?.signal
        });
        const latency = performance.now() - start;
        
        if (response.ok && latency < bestLatency) {
          bestLatency = latency;
          bestServer = server;
        }
      } catch (error) {
        console.log(`Server ${server.name} unreachable:`, error);
      }
    }

    return bestServer;
  }

  /**
   * Test ping/latency
   */
  private async testPing(serverUrl: string): Promise<{
    ping: number;
    jitter: number;
  }> {
    const pingTests = 5;
    const latencies: number[] = [];

    for (let i = 0; i < pingTests; i++) {
      const start = performance.now();
      try {
        await fetch(serverUrl, {
          method: 'HEAD',
          signal: this.abortController?.signal
        });
        const latency = performance.now() - start;
        latencies.push(latency);
      } catch (error) {
        // If one ping fails, use a high latency value
        latencies.push(1000);
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
  }

  /**
   * Test download speed
   */
  private async testDownload(
    serverUrl: string,
    sizeMB: number,
    onProgress: (progress: number, speed: number) => void
  ): Promise<{ speed: number }> {
    const chunks: ArrayBuffer[] = [];
    const chunkSize = 1024 * 1024; // 1MB chunks
    const totalSize = sizeMB * 1024 * 1024; // Convert to bytes
    
    const startTime = performance.now();
    let downloadedBytes = 0;

    try {
      // Create a large download URL (we'll use a publicly available large file)
      const downloadUrl = `https://httpbin.org/bytes/${totalSize}`;
      
      const response = await fetch(downloadUrl, {
        signal: this.abortController?.signal
      });

      if (!response.ok || !response.body) {
        throw new Error('Download test failed');
      }

      const reader = response.body.getReader();
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        chunks.push(value.buffer instanceof ArrayBuffer ? value.buffer : new ArrayBuffer(value.length));
        downloadedBytes += value.length;
        
        const elapsed = (performance.now() - startTime) / 1000; // seconds
        const speedMbps = (downloadedBytes * 8) / (elapsed * 1000000); // Convert to Mbps
        const progress = (downloadedBytes / totalSize) * 100;
        
        onProgress(Math.min(progress, 100), speedMbps);
      }
      
    } catch (error) {
      console.warn('Download test failed, using fallback method:', error);
      // Fallback: download smaller chunks multiple times
      return await this.fallbackDownloadTest(onProgress);
    }

    const totalTime = (performance.now() - startTime) / 1000;
    const speedMbps = (downloadedBytes * 8) / (totalTime * 1000000);
    
    return { speed: Math.round(speedMbps * 100) / 100 };
  }

  /**
   * Fallback download test using smaller requests
   */
  private async fallbackDownloadTest(
    onProgress: (progress: number, speed: number) => void
  ): Promise<{ speed: number }> {
    const testDuration = 10; // seconds
    const chunkSize = 1024 * 1024; // 1MB
    const chunks = 5;
    
    const startTime = performance.now();
    let totalBytes = 0;
    
    for (let i = 0; i < chunks; i++) {
      const chunkStart = performance.now();
      
      try {
        const response = await fetch(`https://httpbin.org/bytes/${chunkSize}`, {
          signal: this.abortController?.signal
        });
        
        if (response.ok) {
          await response.blob(); // Read the response
          totalBytes += chunkSize;
        }
      } catch (error) {
        console.warn('Chunk download failed:', error);
      }
      
      const elapsed = (performance.now() - startTime) / 1000;
      const speedMbps = (totalBytes * 8) / (elapsed * 1000000);
      const progress = ((i + 1) / chunks) * 100;
      
      onProgress(progress, speedMbps);
    }
    
    const totalTime = (performance.now() - startTime) / 1000;
    const speedMbps = (totalBytes * 8) / (totalTime * 1000000);
    
    return { speed: Math.round(speedMbps * 100) / 100 };
  }

  /**
   * Test upload speed
   */
  private async testUpload(
    serverUrl: string,
    sizeMB: number,
    onProgress: (progress: number, speed: number) => void
  ): Promise<{ speed: number }> {
    const totalSize = sizeMB * 1024 * 1024; // Convert to bytes
    const chunkSize = 64 * 1024; // 64KB chunks
    const chunks = Math.ceil(totalSize / chunkSize);
    
    // Generate random data to upload
    const data = new Uint8Array(chunkSize);
    crypto.getRandomValues(data);
    
    const startTime = performance.now();
    let uploadedBytes = 0;
    
    for (let i = 0; i < chunks; i++) {
      try {
        const chunkData = i === chunks - 1 ? 
          data.slice(0, totalSize - uploadedBytes) : data;
        
        await fetch('https://httpbin.org/post', {
          method: 'POST',
          body: chunkData,
          signal: this.abortController?.signal
        });
        
        uploadedBytes += chunkData.length;
        
        const elapsed = (performance.now() - startTime) / 1000;
        const speedMbps = (uploadedBytes * 8) / (elapsed * 1000000);
        const progress = (uploadedBytes / totalSize) * 100;
        
        onProgress(Math.min(progress, 100), speedMbps);
        
      } catch (error) {
        console.warn('Upload chunk failed:', error);
        break;
      }
    }
    
    const totalTime = (performance.now() - startTime) / 1000;
    const speedMbps = (uploadedBytes * 8) / (totalTime * 1000000);
    
    return { speed: Math.round(speedMbps * 100) / 100 };
  }

  /**
   * Get client information (IP and ISP)
   */
  private async getClientInfo(): Promise<{
    ip: string;
    isp: string;
  }> {
    try {
      // Try multiple IP/ISP detection services
      const services = [
        'https://ipapi.co/json/',
        'https://ipwhois.app/json/',
      ];

      for (const service of services) {
        try {
          const response = await fetch(service, {
            signal: this.abortController?.signal
          });
          
          if (response.ok) {
            const data = await response.json();
            return {
              ip: data.ip || data.query || 'Unknown',
              isp: data.org || data.isp || data.as || 'Unknown ISP'
            };
          }
        } catch (error) {
          continue;
        }
      }
      
      return { ip: 'Unknown', isp: 'Unknown ISP' };
    } catch (error) {
      return { ip: 'Unknown', isp: 'Unknown ISP' };
    }
  }

  /**
   * Stop the running speed test
   */
  stop(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.isRunning = false;
  }

  /**
   * Check if a speed test is currently running
   */
  isTestRunning(): boolean {
    return this.isRunning;
  }
}
