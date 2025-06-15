import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const officeId = searchParams.get('officeId');
    const days = parseInt(searchParams.get('days') || '30');

    // Check permissions
    if (session.user.role !== 'ADMIN' && session.user.officeId !== officeId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const dateFilter = new Date();
    dateFilter.setDate(dateFilter.getDate() - days);

    const where = officeId ? { officeId } : 
      session.user.role === 'ADMIN' ? {} : { officeId: session.user.officeId! };

    // Get basic stats
    const [totalTests, todayTests, avgStats, officesCount] = await Promise.all([
      prisma.speedTest.count({ where }),
      prisma.speedTest.count({
        where: {
          ...where,
          timestamp: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
      prisma.speedTest.aggregate({
        where: {
          ...where,
          timestamp: { gte: dateFilter },
        },
        _avg: {
          download: true,
          upload: true,
          ping: true,
        },
      }),
      session.user.role === 'ADMIN' ? prisma.office.count() : 1,
    ]);

    // Get chart data for the last 30 days
    const chartData = await prisma.speedTest.findMany({
      where: {
        ...where,
        timestamp: { gte: dateFilter },
      },
      select: {
        timestamp: true,
        download: true,
        upload: true,
        ping: true,
      },
      orderBy: { timestamp: 'asc' },
    });

    // Group data by date
    const groupedData = chartData.reduce((acc, test) => {
      const date = test.timestamp.toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = { download: [], upload: [], ping: [], count: 0 };
      }
      acc[date].download.push(test.download);
      acc[date].upload.push(test.upload);
      acc[date].ping.push(test.ping);
      acc[date].count++;
      return acc;
    }, {} as Record<string, { download: number[]; upload: number[]; ping: number[]; count: number }>);

    const formattedChartData = Object.entries(groupedData).map(([date, values]) => ({
      date,
      download: Math.round((values.download.reduce((a, b) => a + b, 0) / values.download.length) * 100) / 100,
      upload: Math.round((values.upload.reduce((a, b) => a + b, 0) / values.upload.length) * 100) / 100,
      ping: Math.round((values.ping.reduce((a, b) => a + b, 0) / values.ping.length) * 100) / 100,
    }));

    const stats = {
      totalTests,
      testsToday: todayTests,
      officesCount,
      averageDownload: Math.round((avgStats._avg.download || 0) * 100) / 100,
      averageUpload: Math.round((avgStats._avg.upload || 0) * 100) / 100,
      averagePing: Math.round((avgStats._avg.ping || 0) * 100) / 100,
      chartData: formattedChartData,
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
