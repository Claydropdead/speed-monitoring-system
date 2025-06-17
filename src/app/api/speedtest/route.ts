import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { runSpeedTest, validateSpeedTestData } from '@/lib/speedtest';

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
    }    const where: any = {};
    if (session.user?.role !== 'ADMIN' && !admin) {
      where.officeId = session.user?.officeId;
    } else if (officeId) {
      where.officeId = officeId;
    }

    const offset = (page - 1) * limit;
    const total = await prisma.speedTest.count({ where });

    const tests = await prisma.speedTest.findMany({
      where,
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

    // Check permissions
    if (session.user?.role !== 'ADMIN' && session.user?.officeId !== officeId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (runTest) {
      // For now, skip ISP validation to get the system working
      // TODO: Implement ISP validation using the available-isps endpoint

      const { testResult } = body;
      
      let testData;
      if (testResult) {
        // Use pre-computed results from SSE stream
        testData = testResult;
      } else {
        // Run a new speed test with ISP validation
        testData = await runSpeedTest(selectedISP);
        
        if (!validateSpeedTestData(testData)) {
          return NextResponse.json({ error: 'Invalid speed test data' }, { status: 400 });
        }
      }

      // Get office info to capture ISP at time of test
      const office = await prisma.office.findUnique({
        where: { id: officeId || session.user.officeId! },
        select: { isp: true }
      });

      if (!office) {
        return NextResponse.json({ error: 'Office not found' }, { status: 404 });
      }

      // Save to database
      const speedTest = await prisma.speedTest.create({
        data: {
          officeId: officeId || session.user.officeId!,
          download: testData.download,
          upload: testData.upload,
          ping: testData.ping,
          jitter: testData.jitter || 0,
          packetLoss: testData.packetLoss || 0,
          isp: selectedISP || (testData as any).ispName || office.isp, // Use selected ISP, detected ISP, or fallback to office ISP
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