import { spawn } from 'child_process';

/**
 * Test Speedtest CLI functionality for Railway deployment
 */
export async function testSpeedtestCLI(): Promise<{
  available: boolean;
  version?: string;
  error?: string;
  path?: string;
}> {
  return new Promise((resolve) => {
    console.log('🔍 Testing Speedtest CLI availability...');
    
    // Try different possible paths for the CLI
    const possiblePaths = [
      'speedtest',           // Standard PATH
      '/usr/local/bin/speedtest',  // Our Dockerfile installation path
      '/usr/bin/speedtest',        // Alternative system path
      './speedtest',               // Local directory
    ];
    
    let pathIndex = 0;
    
    const tryNextPath = () => {
      if (pathIndex >= possiblePaths.length) {
        resolve({
          available: false,
          error: 'Speedtest CLI not found in any expected location'
        });
        return;
      }
      
      const currentPath = possiblePaths[pathIndex];
      console.log(`🔍 Trying path: ${currentPath}`);
      
      const test = spawn(currentPath, ['--version'], {
        timeout: 10000, // 10 second timeout
      });
      
      let output = '';
      let hasResponded = false;
      
      test.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      test.stderr.on('data', (data) => {
        output += data.toString();
      });
      
      test.on('close', (code) => {
        if (hasResponded) return;
        hasResponded = true;
        
        if (code === 0 && output.includes('Speedtest')) {
          resolve({
            available: true,
            version: output.trim(),
            path: currentPath
          });
        } else {
          pathIndex++;
          tryNextPath();
        }
      });
      
      test.on('error', (error) => {
        if (hasResponded) return;
        hasResponded = true;
        
        console.log(`❌ Path ${currentPath} failed:`, error.message);
        pathIndex++;
        tryNextPath();
      });
      
      // Timeout fallback
      setTimeout(() => {
        if (hasResponded) return;
        hasResponded = true;
        
        test.kill();
        pathIndex++;
        tryNextPath();
      }, 10000);
    };
    
    tryNextPath();
  });
}

/**
 * Run a quick speedtest to verify functionality
 */
export async function runQuickSpeedtest(cliPath: string = 'speedtest'): Promise<{
  success: boolean;
  output?: any;
  error?: string;
}> {
  return new Promise((resolve) => {
    console.log('🏃 Running quick speedtest...');
    
    const speedtest = spawn(cliPath, [
      '--accept-license',
      '--accept-gdpr', 
      '--format=json',
      '--no-upload',  // Skip upload for faster test
      '--progress=no' // No progress output for cleaner JSON
    ], {
      timeout: 60000, // 1 minute timeout
    });
    
    let output = '';
    let errorOutput = '';
    
    speedtest.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    speedtest.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    speedtest.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(output.trim());
          resolve({
            success: true,
            output: result
          });
        } catch (error) {
          resolve({
            success: false,
            error: `Failed to parse JSON output: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
        }
      } else {
        resolve({
          success: false,
          error: `Speedtest failed with code ${code}. Error: ${errorOutput}`
        });
      }
    });
    
    speedtest.on('error', (error) => {
      resolve({
        success: false,
        error: error.message
      });
    });
  });
}
