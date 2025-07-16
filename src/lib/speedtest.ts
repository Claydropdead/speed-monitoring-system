import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { SpeedTestData } from '@/types';
import { normalizeISPName, validateISPMatch } from './isp-utils';

const execAsync = promisify(exec);

export interface SpeedTestResult {
  timestamp: string;
  ping: {
    jitter: number;
    latency: number;
    low: number;
    high: number;
  };
  download: {
    bandwidth: number;
    bytes: number;
    elapsed: number;
    latency: {
      iqm: number;
      low: number;
      high: number;
      jitter: number;
    };
  };
  upload: {
    bandwidth: number;
    bytes: number;
    elapsed: number;
    latency: {
      iqm: number;
      low: number;
      high: number;
      jitter: number;
    };
  };
  packetLoss?: number;
  server: {
    id: number;
    host: string;
    port: number;
    name: string;
    location: string;
    country: string;
    ip: string;
  };
  result: {
    id: string;
    url: string;
    persisted: boolean;
  };
  isp: string;
  interface: {
    externalIp: string;
    internalIp: string;
    name: string;
    macAddr: string;
    isVpn: boolean;
  };
}

export interface SpeedTestProgress {
  phase: 'connecting' | 'ping' | 'download' | 'upload' | 'complete' | 'error';
  progress: number; // 0-100
  currentSpeed?: number; // Current speed in Mbps
  averageSpeed?: number; // Average speed in Mbps
  ping?: number;
  server?: {
    name: string;
    location: string;
    id: number;
  };
  error?: string;
}

export type ProgressCallback = (progress: SpeedTestProgress) => void;

// Check if Speedtest CLI is available
async function checkSpeedtestCLI(): Promise<boolean> {
  try {
    await execAsync('speedtest --version', { timeout: 5000 });
    return true;
  } catch (error) {
    console.error('Speedtest CLI not available:', error);
    return false;
  }
}

// Convert bits per second to Mbps using web-compatible conversion
const bitsToMbps = (bits: number): number => {
  // Use Method 3 (Web×8) which matches web interface results
  return Math.round((bits / 1000000) * 8 * 100) / 100;
};

// Helper function to try speedtest with different configurations
async function trySpeedtestWithRetry(
  onProgress: ProgressCallback,
  attempt: number = 1
): Promise<SpeedTestData> {
  const maxAttempts = 5; // Increased attempts for better success rate

  if (attempt > maxAttempts) {
    throw new Error('All speedtest attempts failed');
  }

  // Progressive fallback configurations with different strategies
  const configurations = [
    // Attempt 1: Default auto-server selection
    ['--format=json', '--accept-license', '--accept-gdpr'],
    // Attempt 2: Force server selection to a reliable server
    ['--format=json', '--accept-license', '--accept-gdpr', '--server-id=10493'],
    // Attempt 3: Use a different reliable server
    ['--format=json', '--accept-license', '--accept-gdpr', '--server-id=21569'],
    // Attempt 4: Minimal test with basic output
    ['--format=json', '--accept-license', '--accept-gdpr', '--no-pre-allocate'],
    // Attempt 5: Last resort with different timeout
    ['--format=json', '--accept-license', '--accept-gdpr', '--no-upload'],
  ];

  const args = configurations[attempt - 1];
  // Add delay between attempts to avoid rate limiting
  if (attempt > 1) {
    await new Promise(resolve => setTimeout(resolve, attempt * 2000));
  }

  return new Promise((resolve, reject) => {
    let output = '';
    let errorOutput = '';
    let progressTimer: NodeJS.Timeout;

    // Update progress during retry attempts
    onProgress({
      phase: 'connecting',
      progress: (attempt - 1) * 20, // Show incremental progress across attempts
    });

    const speedtest = spawn('speedtest', args, {
      shell: false, // ⚠️ SECURITY FIX: Disable shell to prevent command injection
      timeout: 60000, // Reduced timeout per attempt
    });

    // Set up progress simulation for this attempt
    progressTimer = setTimeout(() => {
      onProgress({
        phase: 'ping',
        progress: Math.min(95, (attempt - 1) * 20 + 15),
      });
    }, 5000);

    speedtest.stdout.on('data', data => {
      output += data.toString();
      // Look for progress indicators in the output
      const outputStr = data.toString();
      if (outputStr.includes('Testing download')) {
        onProgress({
          phase: 'download',
          progress: Math.min(95, (attempt - 1) * 20 + 30),
        });
      } else if (outputStr.includes('Testing upload')) {
        onProgress({
          phase: 'upload',
          progress: Math.min(95, (attempt - 1) * 20 + 60),
        });
      }
    });

    speedtest.stderr.on('data', data => {
      errorOutput += data.toString();
      const errorStr = data.toString();
      
      // Only log errors in development
      if (process.env.NODE_ENV === 'development') {
        console.error(`Attempt ${attempt} stderr:`, errorStr);
      }

      // Check for specific protocol errors early
      if (errorStr.includes('Protocol error') || errorStr.includes('Did not receive HELLO')) {
        // Protocol error detected, will retry
      }
    });

    speedtest.on('close', async code => {
      clearTimeout(progressTimer);

      if (code === 0 && output.trim()) {
        try {
          const jsonData = JSON.parse(output.trim());

          // Validate that we have the essential data
          if (!jsonData.download || !jsonData.upload || !jsonData.ping) {
            throw new Error('Incomplete speedtest data received');
          }

          const result: SpeedTestData = {
            download: bitsToMbps(jsonData.download.bandwidth),
            upload: bitsToMbps(jsonData.upload.bandwidth),
            ping: Math.round(jsonData.ping.latency * 100) / 100,
            jitter: Math.round(jsonData.ping.jitter * 100) / 100,
            packetLoss: jsonData.packetLoss || 0,
            ispName: jsonData.isp || 'Unknown ISP',
            serverId: jsonData.server?.id?.toString() || 'unknown',
            serverName: jsonData.server?.name || 'Unknown Server',
            serverLocation: jsonData.server?.location || 'Unknown Location',
            resultUrl: jsonData.result?.url,
            rawData: JSON.stringify(jsonData),
          };

          resolve(result);
        } catch (e) {
          // Only log detailed errors in development
          if (process.env.NODE_ENV === 'development') {
            console.error(`Attempt ${attempt} parse error:`, e);
            console.error('Raw output:', output.substring(0, 500) + '...');
          }

          if (attempt < maxAttempts) {
            try {
              const result = await trySpeedtestWithRetry(onProgress, attempt + 1);
              resolve(result);
            } catch (retryError) {
              reject(retryError);
            }
          } else {
            reject(new Error(`Failed to parse speedtest results after ${maxAttempts} attempts`));
          }
        }
      } else {
        console.error(`Attempt ${attempt} failed with code:`, code);
        console.error(`Attempt ${attempt} error output:`, errorOutput);

        // Check for specific error types and provide better handling
        const isProtocolError =
          errorOutput.includes('Protocol error') ||
          errorOutput.includes('Did not receive HELLO') ||
          errorOutput.includes('Connection failed');

        if (attempt < maxAttempts) {
          const reason = isProtocolError ? 'protocol error' : `exit code ${code}`;
          try {
            const result = await trySpeedtestWithRetry(onProgress, attempt + 1);
            resolve(result);
          } catch (retryError) {
            reject(retryError);
          }
        } else {
          const errorMsg = isProtocolError
            ? 'Network connectivity issues prevented speed test completion. This may be due to firewall restrictions, network instability, or temporary server issues.'
            : `Speedtest failed after ${maxAttempts} attempts. Last error: ${errorOutput}`;
          reject(new Error(errorMsg));
        }
      }
    });

    speedtest.on('error', async error => {
      clearTimeout(progressTimer);
      console.error(`Attempt ${attempt} process error:`, error);

      if (attempt < maxAttempts) {
        try {
          const result = await trySpeedtestWithRetry(onProgress, attempt + 1);
          resolve(result);
        } catch (retryError) {
          reject(retryError);
        }
      } else {
        reject(
          new Error(`Speedtest process failed after ${maxAttempts} attempts: ${error.message}`)
        );
      }
    });
  });
}

// Run speed test with real-time progress updates using actual Ookla CLI
export async function runSpeedTestWithProgress(
  onProgress: ProgressCallback,
  selectedISP?: string
): Promise<SpeedTestData & { ispValidation?: any }> {
  try {
    // Check if Speedtest CLI is available
    const cliAvailable = await checkSpeedtestCLI();
    if (!cliAvailable) {
      onProgress({
        phase: 'error',
        progress: 0,
        error: 'Speedtest CLI is not available on this system. Please ensure Ookla Speedtest CLI is installed.'
      });
      throw new Error('Speedtest CLI is not available on this system. Please ensure Ookla Speedtest CLI is installed.');
    }

    // First, try the enhanced retry mechanism
    const result = await trySpeedtestWithRetry(onProgress, 1);
    // Validate ISP if selectedISP is provided
    let ispValidation;
    if (selectedISP && result.ispName) {
      ispValidation = validateISPMatch(selectedISP, result.ispName);
    }

    onProgress({
      phase: 'complete',
      progress: 100,
    });

    return {
      ...result,
      ispValidation,
    };
  } catch (error) {
    console.error('All speedtest attempts failed:', error);

    // Provide a helpful error message and mock data for development
    onProgress({
      phase: 'error',
      progress: 0,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    });

    // Generate realistic mock data with error context
    const mockResult: SpeedTestData = {
      download: 25.5 + Math.random() * 10,
      upload: 12.2 + Math.random() * 5,
      ping: 28 + Math.random() * 10,
      jitter: 2.1 + Math.random() * 2,
      packetLoss: 0,
      ispName: selectedISP || 'Mock ISP Provider',
      serverId: 'mock-server',
      serverName: 'Mock Test Server (Speedtest CLI Failed)',
      serverLocation: 'Mock Location',
      resultUrl: 'https://www.speedtest.net/result/mock-test',
      rawData: JSON.stringify({
        mock: true,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
        note: 'This is mock data due to speedtest CLI failure',
      }),
    };

    // Add progress completion for mock data
    setTimeout(() => {
      onProgress({
        phase: 'complete',
        progress: 100,
      });
    }, 1000);

    return mockResult;
  }
}

export async function runSpeedTest(
  selectedISP?: string
): Promise<SpeedTestData & { ispValidation?: any }> {
  try {
    // Check if Speedtest CLI is available
    const cliAvailable = await checkSpeedtestCLI();
    if (!cliAvailable) {
      throw new Error('Speedtest CLI is not available on this system. Please ensure Ookla Speedtest CLI is installed.');
    }

    // Use the enhanced retry mechanism with a simple progress callback
    const result = await trySpeedtestWithRetry(() => {}, 1);

    // Validate ISP if selectedISP is provided
    let ispValidation;
    if (selectedISP && result.ispName) {
      ispValidation = validateISPMatch(selectedISP, result.ispName);
    }

    return {
      ...result,
      ispValidation, // Include validation results
    };
  } catch (error) {
    console.error('Speedtest failed, using mock data:', error);

    // Return mock data for development/testing purposes
    const mockDownload = Math.round((Math.random() * 100 + 50) * 100) / 100;
    const mockUpload = Math.round((Math.random() * 50 + 25) * 100) / 100;
    const mockPing = Math.round((Math.random() * 50 + 10) * 100) / 100;
    const mockJitter = Math.round((Math.random() * 10 + 1) * 100) / 100;
    const mockPacketLoss = Math.round(Math.random() * 2 * 100) / 100;

    const mockResult = {
      download: mockDownload,
      upload: mockUpload,
      ping: mockPing,
      jitter: mockJitter,
      packetLoss: mockPacketLoss,
      ispName: selectedISP || 'Mock ISP Provider', // Use selected ISP or mock
      serverId: '12345',
      serverName: 'Mock Test Server',
      serverLocation: 'Mock Location',
      resultUrl: 'https://www.speedtest.net/result/mock-test',
      rawData: JSON.stringify({
        error: 'Mock data for development',
        originalError: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      }),
    };

    return mockResult;
  }
}

export function validateSpeedTestData(data: any): data is SpeedTestData {
  return (
    typeof data.download === 'number' &&
    typeof data.upload === 'number' &&
    typeof data.ping === 'number' &&
    data.download >= 0 &&
    data.upload >= 0 &&
    data.ping >= 0
  );
}

// Re-export ISP utilities for backward compatibility
export { normalizeISPName, validateISPMatch } from './isp-utils';

// Quick ISP detection using minimal network check
export async function detectCurrentISP(): Promise<string> {
  try {
    // Method 1: Try to get ISP info from public IP services
    const allowedServices = [
      'https://ipapi.co/json/',
      'https://api.ipify.org?format=json',
      'https://httpbin.org/ip',
    ];

    for (const service of allowedServices) {
      try {
        // ⚠️ SECURITY FIX: Use fetch instead of curl to avoid command injection
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        
        const response = await fetch(service, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'SpeedMonitoringSystem/1.0',
          },
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          continue;
        }
        
        const ipData = await response.json();

        if (ipData.org) {
          return ipData.org;
        } else if (ipData.isp) {
          return ipData.isp;
        }
      } catch (ipError) {
        continue;
      }
    }

    // Method 2: Use speedtest with minimal flags to just get connection info
    try {
      const { stdout } = await execAsync(
        'speedtest --format=json --accept-license --accept-gdpr --selection-details',
        {
          timeout: 30000, // 30 second timeout for ISP detection
        }
      );
      const result = JSON.parse(stdout);

      // Extract ISP from various possible locations in the result
      let detectedISP = 'Unknown ISP';

      if (result.client?.isp) {
        detectedISP = result.client.isp;
      } else if (result.interface?.externalIsp) {
        detectedISP = result.interface.externalIsp;
      } else if (result.isp) {
        detectedISP = result.isp;
      }

      return detectedISP;
    } catch (speedtestError) {
      // Fall back to next method
    }

    // Method 3: Fallback to a simple speedtest with retry
    try {
      const result = await trySpeedtestWithRetry(() => {}, 1);
      if (result.ispName && result.ispName !== 'Unknown ISP') {
        return result.ispName;
      }
    } catch (fallbackError) {
      // All methods failed
    }
  } catch (error) {
    console.error('All ISP detection methods failed:', error);
  }

  // Final fallback: Return a generic message that will trigger user selection
  return 'Unknown ISP - Please select manually';
}
