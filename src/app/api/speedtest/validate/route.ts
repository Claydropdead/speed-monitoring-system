import { NextRequest, NextResponse } from 'next/server';
import { validateISPMatch, normalizeISPName } from '@/lib/isp-utils';

export async function POST(request: NextRequest) {
  try {
    const { selectedISP, detectedISP, testResult } = await request.json();

    if (!selectedISP || !detectedISP || !testResult) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate the ISP match
    const validation = validateISPMatch(selectedISP, detectedISP, true); // Use relaxed mode for client-side detection

    // Basic validation of test results to prevent unrealistic values
    const { download, upload, ping } = testResult;
    
    // Check for reasonable values (prevent obvious cheating)
    const isReasonable = 
      download >= 0 && download <= 10000 && // 0-10 Gbps
      upload >= 0 && upload <= 10000 &&     // 0-10 Gbps
      ping >= 0 && ping <= 1000;            // 0-1000ms

    if (!isReasonable) {
      return NextResponse.json(
        { 
          error: 'Invalid test results detected',
          validation: {
            isMatch: false,
            confidence: 0,
            allowProceed: false,
            reason: 'Test results appear to be invalid or manipulated'
          }
        },
        { status: 400 }
      );
    }

    // Add server-side timestamp and validation
    const validatedResult = {
      ...testResult,
      serverValidatedAt: new Date().toISOString(),
      ispValidation: validation,
      testType: 'client-side-validated',
      selectedISPNormalized: normalizeISPName(selectedISP),
      detectedISPNormalized: normalizeISPName(detectedISP),
    };

    return NextResponse.json({
      success: true,
      validation,
      validatedResult,
      allowProceed: validation.allowProceed
    });

  } catch (error) {
    console.error('Error validating speed test:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
