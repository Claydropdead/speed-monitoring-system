import { NextRequest, NextResponse } from 'next/server';
import { testSpeedtestCLI, runQuickSpeedtest } from '@/lib/speedtest-test';

export async function GET(request: NextRequest) {
  try {
    console.log('🔧 Testing Speedtest CLI on Railway...');
    
    // Test 1: Check if CLI is available
    const cliTest = await testSpeedtestCLI();
    console.log('🔍 CLI availability test:', cliTest);
    
    if (!cliTest.available) {
      return NextResponse.json({
        success: false,
        error: 'Speedtest CLI not available',
        details: cliTest,
        environment: {
          platform: process.platform,
          arch: process.arch,
          node_version: process.version,
          path: process.env.PATH,
        }
      });
    }
    
    // Test 2: Try running a quick test
    console.log('🏃 Running quick speedtest...');
    const quickTest = await runQuickSpeedtest(cliTest.path);
    console.log('🏃 Quick test result:', quickTest);
    
    return NextResponse.json({
      success: true,
      cli_available: true,
      cli_info: cliTest,
      quick_test: quickTest,
      environment: {
        platform: process.platform,
        arch: process.arch,
        node_version: process.version,
        working_directory: process.cwd(),
      }
    });
    
  } catch (error) {
    console.error('❌ Speedtest CLI test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      environment: {
        platform: process.platform,
        arch: process.arch,
        node_version: process.version,
        path: process.env.PATH,
      }
    });
  }
}
