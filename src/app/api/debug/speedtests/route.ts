import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if ((session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get recent speed tests with office info
    const speedTests = await prisma.speedTest.findMany({
      take: 10,
      orderBy: { timestamp: 'desc' },
      include: {
        office: {
          select: {
            unitOffice: true,
            subUnitOffice: true,
            section: true,
            isp: true,
            isps: true,
            sectionISPs: true
          }
        }
      }
    });

    // Get unique ISPs from speed tests
    const uniqueISPs = await prisma.speedTest.findMany({
      distinct: ['isp'],
      select: { isp: true }
    });

    return NextResponse.json({
      recentSpeedTests: speedTests.map(test => ({
        id: test.id,
        isp: test.isp,
        timestamp: test.timestamp,
        download: test.download,
        office: test.office.unitOffice + (test.office.subUnitOffice ? ` > ${test.office.subUnitOffice}` : ''),
        officeISP: test.office.isp,
        officeISPs: test.office.isps,
        section: test.office.section
      })),
      uniqueISPsInSpeedTests: uniqueISPs.map(item => item.isp)
    });

  } catch (error) {
    console.error('Debug API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
