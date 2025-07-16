import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';

/**
 * Production health check for Speedtest CLI
 * This endpoint helps verify that the CLI is properly installed and working on Railway
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🏥 [Health Check] Starting Speedtest CLI health check...');
    
    const startTime = Date.now();
    
    // Test CLI availability
    const cliCheck = await checkSpeedtestCLI();
    const duration = Date.now() - startTime;
    
    console.log(`🏥 [Health Check] CLI check completed in ${duration}ms:`, cliCheck);
    
    if (cliCheck.available) {
      return NextResponse.json({
        status: 'healthy',
        speedtest_cli: 'available',
        cli_info: cliCheck,
        check_duration_ms: duration,
        timestamp: new Date().toISOString(),
        environment: {
          platform: process.platform,
          arch: process.arch,
          node_version: process.version,
          railway_environment: process.env.RAILWAY_ENVIRONMENT || 'unknown',
        }
      });
    } else {
      return NextResponse.json({
        status: 'unhealthy',
        speedtest_cli: 'not_available',
        error: cliCheck.error,
        check_duration_ms: duration,
        timestamp: new Date().toISOString(),
        environment: {
          platform: process.platform,
          arch: process.arch,
          node_version: process.version,
          railway_environment: process.env.RAILWAY_ENVIRONMENT || 'unknown',
          path: process.env.PATH,
        }
      }, { status: 503 });
    }
    
  } catch (error) {
    console.error('🚨 [Health Check] Health check failed:', error);
    
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

/**
 * Check if Speedtest CLI is available and functional
 */
async function checkSpeedtestCLI(): Promise<{
  available: boolean;
  version?: string;
  path?: string;
  error?: string;
}> {
  return new Promise((resolve) => {
    console.log('🔍 [Health Check] Testing CLI paths...');
    
    // Try different possible paths for Railway
    const possiblePaths = [
      'speedtest',                    // Standard PATH
      '/usr/local/bin/speedtest',     // Our Dockerfile installation path
      '/usr/bin/speedtest',           // Alternative system path
      '/bin/speedtest',               // Another possible location
    ];
    
    let pathIndex = 0;
    
    const tryNextPath = () => {
      if (pathIndex >= possiblePaths.length) {
        console.log('❌ [Health Check] No working CLI path found');
        resolve({
          available: false,
          error: `Speedtest CLI not found in any of the expected locations: ${possiblePaths.join(', ')}`
        });
        return;
      }
      
      const currentPath = possiblePaths[pathIndex];
      console.log(`🔍 [Health Check] Trying path: ${currentPath}`);
      
      const test = spawn(currentPath, ['--version'], {
        timeout: 15000, // 15 second timeout for production
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let output = '';
      let errorOutput = '';
      let hasResponded = false;
      
      test.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      test.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      test.on('close', (code) => {
        if (hasResponded) return;
        hasResponded = true;
        
        console.log(`🔍 [Health Check] Path ${currentPath} closed with code ${code}`);
        console.log(`🔍 [Health Check] Output: ${output.substring(0, 200)}`);
        
        if (code === 0 && (output.includes('Speedtest') || output.includes('Ookla'))) {
          console.log(`✅ [Health Check] CLI found at: ${currentPath}`);
          resolve({
            available: true,
            version: output.trim(),
            path: currentPath
          });
        } else {
          console.log(`❌ [Health Check] Path ${currentPath} failed - code: ${code}, output: ${output}`);
          pathIndex++;
          setTimeout(tryNextPath, 100); // Small delay before trying next path
        }
      });
      
      test.on('error', (error) => {
        if (hasResponded) return;
        hasResponded = true;
        
        console.log(`❌ [Health Check] Path ${currentPath} error:`, error.message);
        pathIndex++;
        setTimeout(tryNextPath, 100); // Small delay before trying next path
      });
      
      // Timeout fallback for production reliability
      setTimeout(() => {
        if (hasResponded) return;
        hasResponded = true;
        
        console.log(`⏰ [Health Check] Path ${currentPath} timed out`);
        test.kill();
        pathIndex++;
        setTimeout(tryNextPath, 100);
      }, 15000);
    };
    
    tryNextPath();
  });
}
