import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding example database with sample data...');

  // Clean existing data first
  console.log('🧹 Cleaning existing data...');
  await prisma.speedTest.deleteMany();
  await prisma.testSchedule.deleteMany();
  await prisma.user.deleteMany();
  await prisma.office.deleteMany();
  console.log('✅ Cleaned existing data');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.create({
    data: {
      email: 'admin@speedtest.local',
      name: 'System Administrator',
      password: adminPassword,
      role: 'ADMIN',
    },
  });
  console.log('✅ Created admin user:', admin.email);
  // Create sample offices with different ISPs and locations
  const office1 = await prisma.office.create({
    data: {
      unitOffice: 'Main Office - Downtown',
      location: 'Downtown Business District',
      description: 'Primary corporate office with high-speed requirements',
      section: 'Administration',
      isp: 'Comcast Business',
      isps: JSON.stringify(['Comcast Business', 'Verizon FiOS']),
      sectionISPs: JSON.stringify({
        'Administration': 'Comcast Business',
        'IT Department': 'Verizon FiOS'
      }),
    },
  });

  const office2 = await prisma.office.create({
    data: {
      unitOffice: 'Branch Office - North',
      location: 'North Industrial Park',
      description: 'Manufacturing and logistics center',
      section: 'Quality Control',
      isp: 'AT&T Business',
      isps: JSON.stringify(['AT&T Business', 'Spectrum Business']),
      sectionISPs: JSON.stringify({
        'Quality Control': 'AT&T Business',
        'Production': 'Spectrum Business'
      }),
    },
  });

  const office3 = await prisma.office.create({
    data: {
      unitOffice: 'Remote Office - West',
      location: 'West Side Business Center',
      description: 'Customer service and support center',
      section: 'Technical Support',
      isp: 'Cox Business',
      isps: JSON.stringify(['Cox Business', 'CenturyLink']),
      sectionISPs: JSON.stringify({
        'Technical Support': 'Cox Business',
        'Customer Service': 'CenturyLink'
      }),
    },
  });

  console.log('✅ Created sample offices');
  // Create office users for each office
  const office1UserPassword = await bcrypt.hash('office123', 10);
  const office1User = await prisma.user.create({
    data: {
      email: 'manager@mainoffice.local',
      name: 'John Manager',
      password: office1UserPassword,
      role: 'OFFICE',
      officeId: office1.id,
    },
  });

  const office2UserPassword = await bcrypt.hash('office123', 10);
  const office2User = await prisma.user.create({
    data: {
      email: 'supervisor@northbranch.local',
      name: 'Sarah Supervisor',
      password: office2UserPassword,
      role: 'OFFICE',
      officeId: office2.id,
    },
  });

  const office3UserPassword = await bcrypt.hash('office123', 10);
  const office3User = await prisma.user.create({
    data: {
      email: 'coordinator@westoffice.local',
      name: 'Mike Coordinator',
      password: office3UserPassword,
      role: 'OFFICE',
      officeId: office3.id,
    },
  });

  console.log('✅ Created office users');

  // Create sample speed test data for the last 30 days
  const now = new Date();
  const sampleData = [];

  // Generate realistic speed test data
  for (let day = 30; day >= 0; day--) {
    const testDate = new Date(now);
    testDate.setDate(testDate.getDate() - day);
    
    // Three tests per day (morning, afternoon, evening)
    const timeSlots = [
      { hour: 9, minute: 0 }, // 9:00 AM
      { hour: 14, minute: 30 }, // 2:30 PM
      { hour: 18, minute: 15 }, // 6:15 PM
    ];

    for (const office of [office1, office2, office3]) {
      for (const timeSlot of timeSlots) {
        const testDateTime = new Date(testDate);
        testDateTime.setHours(timeSlot.hour, timeSlot.minute, 0, 0);

        // Generate realistic speed test results based on office type
        let baseDownload, baseUpload, basePing;
        
        if (office.id === office1.id) {
          // Main office - high-speed business connection
          baseDownload = 800 + Math.random() * 200; // 800-1000 Mbps
          baseUpload = 400 + Math.random() * 100;   // 400-500 Mbps
          basePing = 5 + Math.random() * 10;        // 5-15 ms
        } else if (office.id === office2.id) {
          // Branch office - medium-speed connection
          baseDownload = 300 + Math.random() * 200; // 300-500 Mbps
          baseUpload = 150 + Math.random() * 100;   // 150-250 Mbps
          basePing = 10 + Math.random() * 15;       // 10-25 ms
        } else {
          // Remote office - standard business connection
          baseDownload = 100 + Math.random() * 150; // 100-250 Mbps
          baseUpload = 50 + Math.random() * 75;     // 50-125 Mbps
          basePing = 15 + Math.random() * 20;       // 15-35 ms
        }

        // Add some variation for different times of day
        const timeVariation = timeSlot.hour === 14 ? 0.8 : 1.0; // Slower in afternoon
          // Select ISP (primary more often than secondary)
        const availableIsps = office.isps ? JSON.parse(office.isps) : [office.isp];
        const useSecondary = Math.random() < 0.3 && availableIsps.length > 1; // 30% chance of secondary ISP
        const selectedIsp = useSecondary ? availableIsps[1] : availableIsps[0];

        sampleData.push({
          officeId: office.id,
          download: Math.round(baseDownload * timeVariation * 100) / 100,
          upload: Math.round(baseUpload * timeVariation * 100) / 100,
          ping: Math.round(basePing * 100) / 100,
          jitter: Math.round((1 + Math.random() * 3) * 100) / 100, // 1-4 ms jitter
          timestamp: testDateTime,
          isp: selectedIsp || office.isp,
        });
      }
    }
  }

  // Insert all speed test data
  await prisma.speedTest.createMany({
    data: sampleData,
  });

  console.log(`✅ Created ${sampleData.length} sample speed test records`);
  // Create test schedules for each office (3 times daily)
  const schedules = [
    { timeSlot: 'MORNING', description: 'Morning baseline test' },
    { timeSlot: 'NOON', description: 'Noon peak usage test' },
    { timeSlot: 'AFTERNOON', description: 'Afternoon usage test' },
  ];

  for (const office of [office1, office2, office3]) {
    const availableIsps = office.isps ? JSON.parse(office.isps) : [office.isp];
    
    for (const schedule of schedules) {
      // Create schedule for primary ISP
      await prisma.testSchedule.create({
        data: {
          officeId: office.id,
          isp: availableIsps[0],
          timeSlot: schedule.timeSlot as any,
          isActive: true,
        },
      });
      
      // Create schedule for secondary ISP if available
      if (availableIsps.length > 1) {
        await prisma.testSchedule.create({
          data: {
            officeId: office.id,
            isp: availableIsps[1],
            timeSlot: schedule.timeSlot as any,
            isActive: true,
          },
        });
      }
    }
  }

  console.log('✅ Created test schedules for all offices');

  // Display summary
  console.log('\n📊 Sample Data Summary:');
  console.log('========================');
  console.log('👤 Users Created:');
  console.log(`   Admin: ${admin.email} / admin123`);
  console.log(`   Office 1: ${office1User.email} / office123`);
  console.log(`   Office 2: ${office2User.email} / office123`);
  console.log(`   Office 3: ${office3User.email} / office123`);
    console.log('\n🏢 Offices Created:');
  console.log(`   ${office1.unitOffice} - ${office1.location}`);
  const office1Isps = office1.isps ? JSON.parse(office1.isps) : [office1.isp];
  console.log(`     ISPs: ${office1Isps.join(', ')}`);
  console.log(`   ${office2.unitOffice} - ${office2.location}`);
  const office2Isps = office2.isps ? JSON.parse(office2.isps) : [office2.isp];
  console.log(`     ISPs: ${office2Isps.join(', ')}`);
  console.log(`   ${office3.unitOffice} - ${office3.location}`);
  const office3Isps = office3.isps ? JSON.parse(office3.isps) : [office3.isp];
  console.log(`     ISPs: ${office3Isps.join(', ')}`);
  
  console.log(`\n⚡ Speed Tests: ${sampleData.length} records (30 days of data)`);
  console.log('📅 Test Schedules: Multiple schedules for each office and ISP combination');
  
  console.log('\n🎉 Example database seeded successfully!');
  console.log('💡 This is sample data for development and testing purposes.');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding example database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
