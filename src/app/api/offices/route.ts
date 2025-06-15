import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { speedTestScheduler } from '@/lib/scheduler';
import bcrypt from 'bcryptjs';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }    if (session.user?.role !== 'ADMIN') {
      // Office users can only see their own office
      const office = await prisma.office.findUnique({
        where: { id: session.user?.officeId || '' },
        include: {
          _count: {
            select: {
              speedTests: true,
              users: true,
            },
          },
        },
      });

      if (!office) {
        return NextResponse.json({ error: 'Office not found' }, { status: 404 });
      }

      return NextResponse.json({ offices: [office] });
    }    // Admin can see all offices
    const offices = await prisma.office.findMany({
      include: {
        _count: {
          select: {
            speedTests: true,
            users: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ offices });
  } catch (error) {
    console.error('Error fetching offices:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }    const body = await request.json();
    const { unitOffice, subUnitOffice, location, section, isp, isps, description, userEmail, userName, userPassword } = body;

    console.log('POST /api/offices - Create request:', { unitOffice, location, isp, isps });

    if (!unitOffice || !location || !isp) {
      return NextResponse.json({ error: 'Missing required office fields' }, { status: 400 });
    }

    if (!userEmail || !userName || !userPassword) {
      return NextResponse.json({ error: 'Missing required user fields' }, { status: 400 });
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: userEmail }
    });

    if (existingUser) {
      return NextResponse.json({ error: 'User email already exists' }, { status: 400 });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(userPassword, 12);    // Create office and user in a transaction
    const result = await prisma.$transaction(async (tx) => {      // Create the office exactly as specified - no automatic parent creation
      const office = await tx.office.create({        data: {
          unitOffice,
          subUnitOffice: subUnitOffice || null,
          location,
          section,
          isp,
          isps: isps || null, // Store the JSON string of all ISPs
          description,
          parentId: null, // Always null since we're not using hierarchy for now
        } as any, // Type assertion to work around Prisma type cache issues
      });

      // Create the user for this office
      const user = await tx.user.create({
        data: {
          email: userEmail,
          name: userName,
          password: hashedPassword,
          role: 'OFFICE',
          officeId: office.id,
        },
      });

      return { office, user };
    });

    // Set up automated test schedules for this office
    await speedTestScheduler.setupOfficeSchedules(result.office.id);

    return NextResponse.json({
      office: result.office,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
      }
    });
  } catch (error) {
    console.error('Error creating office:', error);
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json({ error: 'Office combination already exists' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const officeId = searchParams.get('id');

    if (!officeId) {
      return NextResponse.json({ error: 'Office ID is required' }, { status: 400 });
    }

    // Delete office and all related data in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete all speed tests for this office
      await tx.speedTest.deleteMany({
        where: { officeId }
      });

      // Delete all test schedules for this office
      await tx.testSchedule.deleteMany({
        where: { officeId }
      });

      // Delete all users for this office
      await tx.user.deleteMany({
        where: { officeId }
      });

      // Finally delete the office
      await tx.office.delete({
        where: { id: officeId }
      });
    });

    return NextResponse.json({ message: 'Office and all related data deleted successfully' });
  } catch (error) {
    console.error('Error deleting office:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }    const body = await request.json();
    const { id, unitOffice, subUnitOffice, location, section, isp, isps, description } = body;

    console.log('PUT /api/offices - Update request:', { id, unitOffice, location, isp, isps });

    if (!id || !unitOffice || !location || !isp) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if office exists
    const existingOffice = await prisma.office.findUnique({
      where: { id }
    });

    if (!existingOffice) {
      return NextResponse.json({ error: 'Office not found' }, { status: 404 });
    }    // Update the office
    const updatedOffice = await prisma.office.update({
      where: { id },      data: {
        unitOffice,
        subUnitOffice,
        location,
        section,
        isp,
        isps: isps || null, // Store the JSON string of all ISPs
        description,
      } as any, // Type assertion to work around Prisma type cache issues
      include: {
        _count: {
          select: {
            speedTests: true,
            users: true,
          },
        },
      },
    });

    return NextResponse.json({ office: updatedOffice });
  } catch (error) {
    console.error('Error updating office:', error);
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json({ error: 'Office name already exists' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
