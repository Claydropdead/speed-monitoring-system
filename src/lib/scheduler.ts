import * as cron from 'node-cron';
import { prisma } from '@/lib/prisma';
import { runSpeedTest } from '@/lib/speedtest';
import { TimeSlot } from '@/types';

class SpeedTestScheduler {
  private jobs: Map<string, cron.ScheduledTask> = new Map();

  constructor() {
    this.initializeSchedules();
  }

  private async initializeSchedules() {
    try {
      const schedules = await prisma.testSchedule.findMany({
        where: { isActive: true },
        include: { office: true },
      });      schedules.forEach((schedule) => {
        this.scheduleTest(schedule.id, schedule.officeId, schedule.timeSlot);
      });
    } catch (error) {
      console.error('Failed to initialize schedules:', error);
    }
  }
  private getScheduleTime(timeSlot: TimeSlot): string {
    switch (timeSlot) {
      case TimeSlot.MORNING:
        return '0 9 * * *'; // 9:00 AM daily (within 6:00 AM - 11:59 AM window)
      case TimeSlot.NOON:
        return '0 12 * * *'; // 12:00 PM daily (within 12:00 PM - 12:59 PM window)
      case TimeSlot.AFTERNOON:
        return '0 15 * * *'; // 3:00 PM daily (within 1:00 PM - 6:00 PM window)
      default:
        throw new Error(`Invalid time slot: ${timeSlot}`);
    }
  }

  public scheduleTest(scheduleId: string, officeId: string, timeSlot: TimeSlot) {
    const cronPattern = this.getScheduleTime(timeSlot);
    
    const task = cron.schedule(
      cronPattern,
      async () => {
        await this.executeScheduledTest(scheduleId, officeId, timeSlot);      },
      {
        timezone: 'America/New_York', // Adjust timezone as needed
      }
    );this.jobs.set(scheduleId, task);
  }  private async executeScheduledTest(scheduleId: string, officeId: string, timeSlot: TimeSlot) {
    try {
      // Get office info to capture ISP at time of test
      const office = await prisma.office.findUnique({
        where: { id: officeId },
        select: { isp: true }
      });

      if (!office) {
        console.error(`Office not found for scheduled test: ${officeId}`);
        return;
      }

      // Run the speed test
      const testData = await runSpeedTest();      // Save the test result
      await prisma.speedTest.create({
        data: {
          officeId,
          download: testData.download,
          upload: testData.upload,
          ping: testData.ping,
          jitter: testData.jitter,
          packetLoss: testData.packetLoss,
          isp: testData.ispName || office.isp, // Use detected ISP first, fallback to office ISP
          serverId: testData.serverId,
          serverName: testData.serverName,
          rawData: testData.rawData,
        } as any,
      });

      // Update the schedule
      const nextRun = this.getNextRunTime(timeSlot);
      await prisma.testSchedule.update({
        where: { id: scheduleId },
        data: {
          lastRun: new Date(),
          nextRun,        },
      });
    } catch (error) {
      console.error(`Failed to run scheduled test for office ${officeId}:`, error);
    }
  }

  private getNextRunTime(timeSlot: TimeSlot): Date {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    switch (timeSlot) {
      case TimeSlot.MORNING:
        tomorrow.setHours(9, 0, 0, 0);
        break;
      case TimeSlot.NOON:
        tomorrow.setHours(12, 0, 0, 0);
        break;
      case TimeSlot.AFTERNOON:
        tomorrow.setHours(15, 0, 0, 0);
        break;
    }

    return tomorrow;
  }

  public addSchedule(scheduleId: string, officeId: string, timeSlot: TimeSlot) {
    this.scheduleTest(scheduleId, officeId, timeSlot);
  }

  public removeSchedule(scheduleId: string) {
    const task = this.jobs.get(scheduleId);    if (task) {
      task.stop();
      this.jobs.delete(scheduleId);
    }
  }
  public async setupOfficeSchedules(officeId: string) {
    try {
      // Get office with its ISPs
      const office = await prisma.office.findUnique({
        where: { id: officeId },
        select: { isps: true, isp: true }
      });

      if (!office) {
        console.error(`Office not found: ${officeId}`);
        return;
      }

      const officeIsps = JSON.parse(office.isps || `["${office.isp}"]`) as string[];
      const timeSlots = [TimeSlot.MORNING, TimeSlot.NOON, TimeSlot.AFTERNOON];
      
      for (const isp of officeIsps) {
        for (const timeSlot of timeSlots) {
          const existingSchedule = await prisma.testSchedule.findUnique({
            where: {
              officeId_isp_timeSlot: {
                officeId,
                isp,
                timeSlot,
              },
            },
          });          if (!existingSchedule) {
            const schedule = await prisma.testSchedule.create({
              data: {
                officeId,
                isp,
                timeSlot,
                nextRun: this.getNextRunTime(timeSlot),
              },
            });

            this.scheduleTest(schedule.id, officeId, timeSlot);
          }
        }
      }
    } catch (error) {
      console.error(`Failed to setup schedules for office ${officeId}:`, error);
    }
  }
}

export const speedTestScheduler = new SpeedTestScheduler();
