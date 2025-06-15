import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Clean existing data first
  console.log('🧹 Cleaning existing data...');
  await prisma.speedTest.deleteMany();
  await prisma.testSchedule.deleteMany();
  await prisma.user.deleteMany({ where: { role: 'OFFICE' } });
  await prisma.office.deleteMany();
  console.log('✅ Cleaned existing data');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@speedtest.com' },
    update: {},
    create: {
      email: 'admin@speedtest.com',
      name: 'Admin User',
      password: adminPassword,
      role: 'ADMIN',
    },
  });
  console.log('✅ Created admin user:', admin.email);
  // Create sample offices
  const offices = [
    {
      unitOffice: 'New York Office',
      location: 'New York, NY',
      isp: 'Verizon FiOS',
      isps: JSON.stringify(['Verizon FiOS', 'Spectrum', 'Optimum']),
      description: 'Main headquarters office',
    },
    {
      unitOffice: 'Los Angeles Office',
      location: 'Los Angeles, CA',
      isp: 'Spectrum',
      isps: JSON.stringify(['Spectrum', 'AT&T Fiber']),
      description: 'West coast operations center',
    },
    {
      unitOffice: 'Chicago Office',
      location: 'Chicago, IL',
      isp: 'Comcast Xfinity',
      isps: JSON.stringify(['Comcast Xfinity', 'AT&T', 'RCN']),
      description: 'Midwest regional office',
    },
  ];

  const createdOffices = [];
  for (const officeData of offices) {
    const office = await prisma.office.create({
      data: officeData,
    });
    createdOffices.push(office);
    console.log('✅ Created office:', office.unitOffice);
  }

  // Create office users
  const officeUsers = [
    {
      email: 'newyork@speedtest.com',
      name: 'New York Manager',
      password: await bcrypt.hash('ny123', 10),
      officeId: createdOffices[0].id,
    },
    {
      email: 'losangeles@speedtest.com',
      name: 'Los Angeles Manager',
      password: await bcrypt.hash('la123', 10),
      officeId: createdOffices[1].id,
    },
    {
      email: 'chicago@speedtest.com',
      name: 'Chicago Manager',
      password: await bcrypt.hash('ch123', 10),
      officeId: createdOffices[2].id,
    },
  ];

  for (const userData of officeUsers) {
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {},
      create: {
        ...userData,
        role: 'OFFICE',
      },
    });
    console.log('✅ Created office user:', user.email);
  }
  // Create test schedules for each office per ISP
  const timeSlots = ['MORNING', 'NOON', 'AFTERNOON'] as const;
  
  for (const office of createdOffices) {
    const officeIsps = JSON.parse(office.isps || '[]');
    
    for (const isp of officeIsps) {
      for (const timeSlot of timeSlots) {
        const schedule = await prisma.testSchedule.create({
          data: {
            officeId: office.id,
            isp: isp,
            timeSlot,
            nextRun: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
          },
        });
        console.log(`✅ Created ${timeSlot} schedule for ${office.unitOffice} - ${isp}`);
      }
    }
  }

  // Create some sample speed test data
  const sampleTests = [];
  const now = new Date();
  
  for (let i = 0; i < 30; i++) {
    const testDate = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000)); // Last 30 days
    
    for (const office of createdOffices) {
      // Create 1-3 tests per day per office
      const testsPerDay = Math.floor(Math.random() * 3) + 1;
      
      for (let j = 0; j < testsPerDay; j++) {
        const testTime = new Date(testDate);
        testTime.setHours(9 + (j * 3), Math.floor(Math.random() * 60), 0, 0);
          sampleTests.push({
          officeId: office.id,
          download: Math.round((Math.random() * 100 + 50) * 100) / 100,
          upload: Math.round((Math.random() * 50 + 25) * 100) / 100,
          ping: Math.round((Math.random() * 30 + 10) * 100) / 100,
          jitter: Math.round((Math.random() * 5 + 1) * 100) / 100,
          packetLoss: Math.round(Math.random() * 2 * 100) / 100,
          isp: office.isp, // Include ISP information
          serverId: '12345',
          serverName: 'Test Server',
          timestamp: testTime,
          rawData: JSON.stringify({ mockData: true }),
        });
      }
    }
  }

  await prisma.speedTest.createMany({
    data: sampleTests,
  });

  console.log(`✅ Created ${sampleTests.length} sample speed tests`);
  console.log('🎉 Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
