import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { detectCurrentISP } from '@/lib/speedtest';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('API: Starting ISP detection');

    // Run quick ISP detection
    const detectedISP = await detectCurrentISP();

    console.log(`🌐 API: Detected ISP: ${detectedISP}`);

    return NextResponse.json({
      detectedISP,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ API: ISP detection failed:', error);
    return NextResponse.json(
      {
        error: 'Failed to detect ISP',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
