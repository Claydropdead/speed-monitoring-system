import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { runSpeedTest, validateSpeedTestData } from '@/lib/speedtest';
import { normalizeISPName, resolveISPFromId } from '@/lib/isp-utils';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const officeId = searchParams.get('officeId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const page = parseInt(searchParams.get('page') || '1');
    const admin = searchParams.get('admin') === 'true';

    // Check permissions
    if (session.user?.role !== 'ADMIN' && !admin && session.user?.officeId !== officeId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const where: any = {};
    if (session.user?.role !== 'ADMIN' && !admin) {
      where.officeId = session.user?.officeId;
    } else if (officeId) {
      where.officeId = officeId;
    }

    const offset = (page - 1) * limit;
    const total = await prisma.speedTest.count({ where });

    const tests = await prisma.speedTest.findMany({
      where,
      select: {
        id: true,
        download: true,
        upload: true,
        ping: true,
        jitter: true,
        packetLoss: true,
        isp: true,
        serverId: true,
        serverName: true,
        timestamp: true,
        rawData: true, // Include rawData to extract section info
        office: {
          select: {
            id: true,
            unitOffice: true,
            subUnitOffice: true,
            location: true,
            isp: true,
          },
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
      skip: offset,
      take: limit,
    });

    return NextResponse.json({
      tests,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        current: page,
        limit,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { officeId, runTest, selectedISP } = body;

    // Determine the correct office ID to use
    let targetOfficeId: string;
    if (session.user?.role === 'ADMIN' && officeId) {
      // Admin can specify office ID
      targetOfficeId = officeId;
    } else {
      // Regular users use their own office
      targetOfficeId = session.user?.officeId!;
    }

    // Check permissions
    if (session.user?.role !== 'ADMIN' && session.user?.officeId !== targetOfficeId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (runTest) {
      // For now, skip ISP validation to get the system working
      // TODO: Implement ISP validation using the available-isps endpoint

      // Get office info including ISP configuration
      const office = await prisma.office.findUnique({
        where: { id: targetOfficeId },
        select: { 
          isp: true, 
          isps: true, 
          sectionISPs: true 
        },
      });

      if (!office) {
        return NextResponse.json({ error: 'Office not found' }, { status: 404 });
      }

      // Resolve the selected ISP from ID to actual ISP name
      let actualISPName = selectedISP;
      let ispDisplayName = selectedISP;
      
      console.log(`🔍 Processing speed test for office: ${targetOfficeId}, selectedISP: ${selectedISP}`);
      console.log(`🔍 Office data:`, { 
        isp: office.isp, 
        isps: office.isps, 
        sectionISPs: office.sectionISPs 
      });
      
      if (selectedISP) {
        const resolvedISP = resolveISPFromId(selectedISP, office);
        console.log(`🔍 resolveISPFromId result:`, resolvedISP);
        if (resolvedISP) {
          actualISPName = resolvedISP.name;
          ispDisplayName = resolvedISP.displayName;
          console.log(`🔍 Resolved ISP ID "${selectedISP}" to "${actualISPName}" (display: "${ispDisplayName}")`);
        } else {
          // Fallback: treat selectedISP as direct name
          actualISPName = selectedISP;
          ispDisplayName = selectedISP;
          console.log(`⚠️ Could not resolve ISP ID "${selectedISP}", using as direct name`);
        }
      }

      const { testResult } = body;

      let testData;
      if (testResult) {
        // Use pre-computed results from SSE stream
        testData = testResult;
      } else {
        // Run a new speed test with the actual ISP name (not ID)
        const ispNameForTest = actualISPName || selectedISP;
        testData = await runSpeedTest(ispNameForTest);

        if (!validateSpeedTestData(testData)) {
          return NextResponse.json({ error: 'Invalid speed test data' }, { status: 400 });
        }
      }

      // Determine which ISP name to save
      let ispToSave: string;

      if (actualISPName) {
        // Use the display name which includes descriptions for unique identification
        ispToSave = ispDisplayName;
        console.log(`🏷️ Using resolved ISP: "${ispToSave}"`);
      } else {
        // No specific ISP selected - use detected ISP from speedtest or office default
        const detectedISP = (testData as any).ispName || office.isp;
        ispToSave = normalizeISPName(detectedISP);
        console.log(`🏷️ Using detected/default ISP: "${detectedISP}" -> normalized: "${ispToSave}"`);
      }

      // Save to database
      const speedTest = await prisma.speedTest.create({
        data: {
          officeId: targetOfficeId,
          download: testData.download,
          upload: testData.upload,
          ping: testData.ping,
          jitter: testData.jitter || 0,
          packetLoss: testData.packetLoss || 0,
          isp: ispToSave, // Use the resolved ISP display name for unique identification
          serverId: testData.serverId || '',
          serverName: testData.serverName || '',
          rawData: testData.rawData || '',
        },
        include: {
          office: {
            select: {
              id: true,
              unitOffice: true,
              subUnitOffice: true,
              location: true,
              isp: true,
            },
          },
        },
      });

      return NextResponse.json(speedTest);
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (error) {
    console.error('Error in speedtest POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
