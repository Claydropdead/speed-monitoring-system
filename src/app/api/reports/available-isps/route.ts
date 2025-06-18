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

    const { searchParams } = new URL(request.url);
    const unit = searchParams.get('unit');
    const subunit = searchParams.get('subunit');
    const section = searchParams.get('section');

    // Build where clause for offices
    const officeWhere: any = {};
    if (unit) officeWhere.unitOffice = unit;
    if (subunit) officeWhere.subUnitOffice = subunit;
    if (section) officeWhere.section = section;

    // Get offices that match the criteria
    const offices = await prisma.office.findMany({
      where: officeWhere,
      select: { id: true }
    });

    const officeIds = offices.map((office: any) => office.id);

    // Get unique ISPs from speed tests for these offices
    const speedTests = await prisma.speedTest.findMany({
      where: {
        officeId: {
          in: officeIds
        },
        isp: {
          not: null
        }
      },
      select: {
        isp: true
      },
      distinct: ['isp']
    });    const isps = speedTests
      .map((test: any) => test.isp)
      .filter(Boolean)
      .sort();

    console.log('Available ISPs from speed tests:', isps);

    return NextResponse.json({ isps });

  } catch (error) {
    console.error('Error fetching available ISPs:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
